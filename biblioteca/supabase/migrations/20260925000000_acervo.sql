-- =============================================================================
-- Fase 2 — Acervo: cadastro atômico, gêneros (apelidos e mescla), cache de ISBN,
-- empréstimos com lembretes (Web Push).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Apelidos de gênero: categorias vindas das APIs ("Fiction / Fantasy",
-- "Literatura brasileira") apontando para um gênero da biblioteca. São
-- aprendidos quando alguém mapeia uma sugestão.
-- -----------------------------------------------------------------------------
create table public.genre_aliases (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 120),
  genre_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, alias),
  foreign key (genre_id, library_id) references public.genres (id, library_id) on delete cascade
);
create index genre_aliases_genre_id_idx on public.genre_aliases (genre_id);

create trigger set_updated_at before update on public.genre_aliases
  for each row execute function private.set_updated_at();

alter table public.genre_aliases enable row level security;
create policy "membros leem" on public.genre_aliases
  for select to authenticated using ((select private.is_member(library_id)));
create policy "membros criam" on public.genre_aliases
  for insert to authenticated with check ((select private.is_member(library_id)));
create policy "membros editam" on public.genre_aliases
  for update to authenticated
  using ((select private.is_member(library_id)))
  with check ((select private.is_member(library_id)));
create policy "membros apagam" on public.genre_aliases
  for delete to authenticated using ((select private.is_member(library_id)));

-- Mescla o gênero de origem no de destino (livros, apelidos e subgêneros) e
-- apaga a origem. Só o dono.
create or replace function public.merge_genres(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_library_id uuid;
begin
  select library_id into v_library_id from public.genres where id = p_source_id;

  if v_library_id is null
    or not exists (
      select 1 from public.genres where id = p_target_id and library_id = v_library_id
    )
  then
    raise exception 'genre_not_found' using errcode = 'P0002';
  end if;
  if not private.is_owner(v_library_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_source_id = p_target_id then
    raise exception 'same_genre' using errcode = 'P0001';
  end if;

  insert into public.book_genres (library_id, book_id, genre_id)
  select library_id, book_id, p_target_id
  from public.book_genres
  where genre_id = p_source_id
  on conflict (book_id, genre_id) do nothing;

  insert into public.genre_aliases (library_id, alias, genre_id)
  select v_library_id, name, p_target_id from public.genres where id = p_source_id
  on conflict (library_id, alias) do nothing;

  update public.genre_aliases set genre_id = p_target_id where genre_id = p_source_id;
  update public.genres set parent_id = p_target_id
  where parent_id = p_source_id and id <> p_target_id;

  delete from public.genres where id = p_source_id;
end;
$$;

revoke all on function public.merge_genres(uuid, uuid) from public, anon;
grant execute on function public.merge_genres(uuid, uuid) to authenticated;

-- Troca o conjunto de gêneros de um livro de uma vez.
create or replace function public.set_book_genres(p_book_id uuid, p_genre_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_library_id uuid;
begin
  select library_id into v_library_id from public.books where id = p_book_id;
  if v_library_id is null then
    raise exception 'book_not_found' using errcode = 'P0002';
  end if;

  delete from public.book_genres
  where book_id = p_book_id and genre_id <> all (coalesce(p_genre_ids, '{}'));

  insert into public.book_genres (library_id, book_id, genre_id)
  select v_library_id, p_book_id, g
  from unnest(coalesce(p_genre_ids, '{}')) as g
  on conflict (book_id, genre_id) do nothing;
end;
$$;

grant execute on function public.set_book_genres(uuid, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Cadastro atômico: livro (novo ou existente) + gêneros + exemplar + leitura.
-- Roda com as permissões de quem chama (RLS vale normalmente).
--
-- p_book:    campos de books; com "id", usa esse livro. Sem "id" e com isbn_13
--            já no acervo, reaproveita o livro e só preenche campos vazios.
-- p_copy:    campos de copies, ou null para não criar exemplar.
-- p_reading: { status, origin, lent_by, started_at, finished_at }, ou null.
-- Retorna o id do livro.
-- -----------------------------------------------------------------------------
create or replace function public.add_to_library(
  p_library_id uuid,
  p_book jsonb,
  p_genre_ids uuid[] default '{}',
  p_copy jsonb default null,
  p_reading jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_book public.books;
  v_copy public.copies;
  v_reading public.readings;
  v_book_id uuid;
  v_copy_id uuid;
  v_member_id uuid;
begin
  v_book := jsonb_populate_record(null::public.books, p_book);

  if v_book.id is not null then
    select id into v_book_id from public.books where id = v_book.id and library_id = p_library_id;
    if v_book_id is null then
      raise exception 'book_not_found' using errcode = 'P0002';
    end if;
  elsif v_book.isbn_13 is not null then
    update public.books b set
      isbn_10 = coalesce(b.isbn_10, v_book.isbn_10),
      subtitle = coalesce(b.subtitle, v_book.subtitle),
      authors = case when cardinality(b.authors) = 0 then coalesce(v_book.authors, '{}') else b.authors end,
      publisher = coalesce(b.publisher, v_book.publisher),
      year = coalesce(b.year, v_book.year),
      pages = coalesce(b.pages, v_book.pages),
      audio_minutes = coalesce(b.audio_minutes, v_book.audio_minutes),
      language = coalesce(b.language, v_book.language),
      cover_url = coalesce(b.cover_url, v_book.cover_url)
    where b.library_id = p_library_id and b.isbn_13 = v_book.isbn_13
    returning b.id into v_book_id;
  end if;

  if v_book_id is null then
    insert into public.books (
      library_id, isbn_13, isbn_10, title, subtitle, authors, publisher, year, pages,
      audio_minutes, language, cover_url, source
    ) values (
      p_library_id, v_book.isbn_13, v_book.isbn_10, btrim(v_book.title), v_book.subtitle,
      coalesce(v_book.authors, '{}'), v_book.publisher, v_book.year, v_book.pages,
      v_book.audio_minutes, v_book.language, v_book.cover_url,
      coalesce(v_book.source, 'manual')
    )
    returning id into v_book_id;
  end if;

  insert into public.book_genres (library_id, book_id, genre_id)
  select p_library_id, v_book_id, g from unnest(coalesce(p_genre_ids, '{}')) as g
  on conflict (book_id, genre_id) do nothing;

  if p_copy is not null then
    v_copy := jsonb_populate_record(null::public.copies, p_copy);
    insert into public.copies (
      library_id, book_id, format, platform, location, condition, acquired_at, price,
      owner_member_id, status
    ) values (
      p_library_id, v_book_id, coalesce(v_copy.format, 'physical'), v_copy.platform,
      v_copy.location, v_copy.condition, v_copy.acquired_at, v_copy.price,
      v_copy.owner_member_id, coalesce(v_copy.status, 'active')
    )
    returning id into v_copy_id;
  end if;

  if p_reading is not null then
    select id into v_member_id from public.library_members
    where library_id = p_library_id and user_id = (select auth.uid());

    v_reading := jsonb_populate_record(null::public.readings, p_reading);
    insert into public.readings (
      library_id, member_id, book_id, copy_id, origin, lent_by, status, started_at, finished_at
    ) values (
      p_library_id, v_member_id, v_book_id,
      case when coalesce(v_reading.origin, 'own') = 'own' then v_copy_id end,
      coalesce(v_reading.origin, 'own'), v_reading.lent_by, coalesce(v_reading.status, 'want'),
      v_reading.started_at, v_reading.finished_at
    );
  end if;

  return v_book_id;
end;
$$;

grant execute on function public.add_to_library(uuid, jsonb, uuid[], jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Cache da busca de ISBN (só a Edge Function, com service role, acessa).
-- -----------------------------------------------------------------------------
create table public.isbn_cache (
  id uuid primary key default gen_random_uuid(),
  isbn text not null unique check (isbn ~ '^97[89][0-9]{10}$'),
  found boolean not null,
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.isbn_cache
  for each row execute function private.set_updated_at();

alter table public.isbn_cache enable row level security;
revoke all on public.isbn_cache from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Empréstimos: quem registrou (recebe o lembrete) e controle de envio.
-- -----------------------------------------------------------------------------
alter table public.loans
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null,
  add column last_reminded_on date;

-- -----------------------------------------------------------------------------
-- Inscrições de Web Push (uma por navegador/aparelho).
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function private.set_updated_at();

alter table public.push_subscriptions enable row level security;
create policy "cada um vê as suas" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cada um cria as suas" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cada um edita as suas" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "cada um apaga as suas" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- O mesmo navegador pode trocar de conta: a inscrição passa para quem está logado.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
