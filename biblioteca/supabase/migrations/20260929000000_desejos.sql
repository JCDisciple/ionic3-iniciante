-- =============================================================================
-- Fase 5 — Lista de desejos: livros que alguém da casa quer ter. A família vê
-- (ideias de presente); cada pessoa mexe só na sua lista. O livro fica em
-- books sem exemplar, então não aparece no acervo nem conta no limite do plano.
-- =============================================================================

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  book_id uuid not null,
  member_id uuid not null,
  priority smallint not null default 2 check (priority between 1 and 3),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, book_id),
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade,
  foreign key (member_id, library_id) references public.library_members (id, library_id) on delete cascade
);
create index wishes_library_idx on public.wishes (library_id);
create index wishes_book_idx on public.wishes (book_id);

create trigger set_updated_at before update on public.wishes
  for each row execute function private.set_updated_at();

alter table public.wishes enable row level security;
create policy "família lê" on public.wishes
  for select to authenticated using ((select private.is_member(library_id)));
create policy "cada um cria os seus" on public.wishes
  for insert to authenticated with check ((select private.is_me(member_id)));
create policy "cada um edita os seus" on public.wishes
  for update to authenticated
  using ((select private.is_me(member_id)))
  with check ((select private.is_me(member_id)));
create policy "cada um apaga os seus" on public.wishes
  for delete to authenticated using ((select private.is_me(member_id)));

-- Adiciona à minha lista (cria ou reaproveita o livro, como no cadastro).
create or replace function public.add_wish(
  p_library_id uuid,
  p_book jsonb,
  p_genre_ids uuid[] default '{}',
  p_priority smallint default 2,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_book_id uuid;
  v_member_id uuid;
begin
  select id into v_member_id from public.library_members
  where library_id = p_library_id and user_id = (select auth.uid());
  if v_member_id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  v_book_id := public.add_to_library(p_library_id, p_book, p_genre_ids, null, null);

  insert into public.wishes (library_id, book_id, member_id, priority, note)
  values (p_library_id, v_book_id, v_member_id, coalesce(p_priority, 2), nullif(btrim(p_note), ''))
  on conflict (member_id, book_id) do update
  set priority = excluded.priority, note = coalesce(excluded.note, public.wishes.note);

  return v_book_id;
end;
$$;

grant execute on function public.add_wish(uuid, jsonb, uuid[], smallint, text) to authenticated;

-- "Comprei": vira exemplar no acervo e sai da lista. Qualquer membro pode
-- marcar (quem deu o presente, por exemplo), por isso security definer com
-- checagem explícita de que quem chama é da casa.
create or replace function public.fulfill_wish(p_wish_id uuid, p_copy jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wish public.wishes;
begin
  select * into v_wish from public.wishes where id = p_wish_id;
  if v_wish.id is null or not private.is_member(v_wish.library_id) then
    raise exception 'wish_not_found' using errcode = 'P0002';
  end if;

  perform public.add_to_library(
    v_wish.library_id,
    jsonb_build_object('id', v_wish.book_id),
    '{}',
    coalesce(p_copy, '{"format":"physical"}'::jsonb),
    null
  );
  delete from public.wishes where id = p_wish_id;
  return v_wish.book_id;
end;
$$;

revoke all on function public.fulfill_wish(uuid, jsonb) from public, anon;
grant execute on function public.fulfill_wish(uuid, jsonb) to authenticated;
