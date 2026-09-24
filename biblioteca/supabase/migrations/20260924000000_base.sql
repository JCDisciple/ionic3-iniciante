-- =============================================================================
-- Biblioteca e Leituras — esquema base (Fase 1)
--
-- Regra central: Livro (books, a obra) ≠ Exemplar (copies, o que a casa possui)
-- ≠ Leitura (readings, o que cada pessoa leu). Tudo pertence a uma library
-- (a casa). Livros, exemplares, empréstimos e gêneros são da library; leituras
-- e metas são de cada membro.
--
-- Integridade entre inquilinos: as tabelas filhas carregam library_id e usam
-- chaves estrangeiras compostas (id, library_id), de modo que é impossível
-- apontar para um registro de outra library.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.library_plan as enum ('free', 'pro');
create type public.member_role as enum ('owner', 'member');
create type public.book_source as enum ('brasilapi', 'google', 'openlibrary', 'manual', 'import');
create type public.copy_format as enum ('physical', 'ebook', 'audiobook', 'subscription');
create type public.copy_status as enum ('active', 'sold', 'donated', 'lost', 'expired');
create type public.reading_origin as enum ('own', 'borrowed', 'library', 'subscription', 'no_longer_owned');
create type public.reading_status as enum ('want', 'reading', 'read', 'abandoned');
create type public.import_source as enum ('goodreads', 'skoob', 'sheet');
create type public.import_status as enum ('pending', 'processing', 'done', 'failed');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete restrict,
  plan public.library_plan not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.library_members (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, user_id),
  unique (id, library_id)
);
create index library_members_user_id_idx on public.library_members (user_id);

create table public.library_invites (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  email text check (email is null or position('@' in email) > 1),
  role public.member_role not null default 'member',
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index library_invites_library_id_idx on public.library_invites (library_id);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  isbn_13 text check (isbn_13 ~ '^97[89][0-9]{10}$'),
  isbn_10 text check (isbn_10 ~ '^[0-9]{9}[0-9X]$'),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  subtitle text,
  authors text[] not null default '{}',
  publisher text,
  year smallint check (year between 0 and 2100),
  pages integer check (pages > 0),
  audio_minutes integer check (audio_minutes > 0),
  language text,
  cover_url text,
  source public.book_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, library_id)
);
create unique index books_library_isbn13_key on public.books (library_id, isbn_13) where isbn_13 is not null;
create index books_library_title_idx on public.books (library_id, lower(title));

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, library_id),
  foreign key (parent_id, library_id) references public.genres (id, library_id) on delete cascade,
  check (parent_id is null or parent_id <> id)
);
create unique index genres_library_name_key on public.genres (library_id, lower(name));

create table public.book_genres (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  book_id uuid not null,
  genre_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, genre_id),
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade,
  foreign key (genre_id, library_id) references public.genres (id, library_id) on delete cascade
);
create index book_genres_genre_id_idx on public.book_genres (genre_id);

create table public.copies (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  book_id uuid not null,
  format public.copy_format not null default 'physical',
  platform text,
  location text,
  condition text,
  acquired_at date,
  price numeric(10, 2) check (price >= 0),
  owner_member_id uuid,
  status public.copy_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, library_id),
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade,
  -- ON DELETE SET NULL (coluna) mantém o exemplar se o membro sair da casa.
  foreign key (owner_member_id, library_id) references public.library_members (id, library_id)
    on delete set null (owner_member_id)
);
create index copies_book_id_idx on public.copies (book_id);
create index copies_library_status_idx on public.copies (library_id, status, format);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  copy_id uuid not null,
  borrower_name text not null check (char_length(btrim(borrower_name)) between 1 and 120),
  borrower_phone text,
  lent_at date not null default current_date,
  due_at date,
  returned_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (copy_id, library_id) references public.copies (id, library_id) on delete cascade,
  check (due_at is null or due_at >= lent_at),
  check (returned_at is null or returned_at >= lent_at)
);
-- Um exemplar só pode estar emprestado para uma pessoa por vez.
create unique index loans_open_copy_key on public.loans (copy_id) where returned_at is null;
create index loans_library_open_idx on public.loans (library_id, due_at) where returned_at is null;

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  member_id uuid not null,
  book_id uuid not null,
  copy_id uuid,
  origin public.reading_origin not null default 'own',
  lent_by text,
  status public.reading_status not null default 'want',
  started_at date,
  finished_at date,
  rating smallint check (rating between 1 and 5),
  review text check (review is null or char_length(review) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, library_id),
  foreign key (member_id, library_id) references public.library_members (id, library_id) on delete cascade,
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade,
  -- Se o exemplar for apagado, a leitura continua existindo (fora do acervo).
  foreign key (copy_id, library_id) references public.copies (id, library_id) on delete set null (copy_id),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);
create index readings_member_status_idx on public.readings (member_id, status);
create index readings_library_finished_idx on public.readings (library_id, finished_at);
create index readings_book_id_idx on public.readings (book_id);
create index readings_copy_id_idx on public.readings (copy_id);

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  reading_id uuid not null,
  date date not null default current_date,
  page integer check (page >= 0),
  percent numeric(5, 2) check (percent between 0 and 100),
  minutes integer check (minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (reading_id, library_id) references public.readings (id, library_id) on delete cascade,
  check (num_nonnulls(page, percent, minutes) >= 1)
);
create index reading_progress_reading_date_idx on public.reading_progress (reading_id, date);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  member_id uuid not null,
  year smallint not null check (year between 2000 and 2100),
  target_books integer check (target_books > 0),
  target_pages integer check (target_pages > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, year),
  foreign key (member_id, library_id) references public.library_members (id, library_id) on delete cascade
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  source public.import_source not null,
  file_url text,
  status public.import_status not null default 'pending',
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index imports_library_id_idx on public.imports (library_id);

-- updated_at automático em todas as tabelas
do $$
declare
  t text;
begin
  foreach t in array array[
    'libraries', 'library_members', 'library_invites', 'books', 'genres', 'book_genres',
    'copies', 'loans', 'readings', 'reading_progress', 'goals', 'imports'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Funções de apoio ao RLS (security definer para evitar recursão de políticas)
-- -----------------------------------------------------------------------------
create or replace function private.is_member(p_library_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_members m
    where m.library_id = p_library_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_owner(p_library_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_members m
    where m.library_id = p_library_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- true quando o membro informado é o próprio usuário logado
create or replace function private.is_me(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_members m
    where m.id = p_member_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.reading_is_mine(p_reading_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.readings r
    join public.library_members m on m.id = r.member_id
    where r.id = p_reading_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.member_role(p_member_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.library_members m where m.id = p_member_id;
$$;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.libraries enable row level security;
alter table public.library_members enable row level security;
alter table public.library_invites enable row level security;
alter table public.books enable row level security;
alter table public.genres enable row level security;
alter table public.book_genres enable row level security;
alter table public.copies enable row level security;
alter table public.loans enable row level security;
alter table public.readings enable row level security;
alter table public.reading_progress enable row level security;
alter table public.goals enable row level security;
alter table public.imports enable row level security;

-- libraries: criação somente pela RPC create_library
create policy "membros veem a biblioteca" on public.libraries
  for select to authenticated using ((select private.is_member(id)));
create policy "dono edita a biblioteca" on public.libraries
  for update to authenticated
  using ((select private.is_owner(id)))
  with check ((select private.is_owner(id)));
create policy "dono apaga a biblioteca" on public.libraries
  for delete to authenticated using ((select private.is_owner(id)));

-- O plano e o dono não são editáveis pelo cliente (cobrança fica no servidor).
revoke update on public.libraries from authenticated;
grant update (name) on public.libraries to authenticated;

-- library_members: entrada somente pelas RPCs create_library / accept_invite
create policy "membros veem os membros" on public.library_members
  for select to authenticated using ((select private.is_member(library_id)));
create policy "dono edita membros" on public.library_members
  for update to authenticated
  using ((select private.is_owner(library_id)))
  -- o dono não pode se rebaixar (a casa ficaria sem dono). is_owner também no
  -- WITH CHECK: políticas permissivas somam seus WITH CHECK com OR.
  with check (
    (select private.is_owner(library_id))
    and (user_id <> (select auth.uid()) or role = 'owner')
  );
create policy "membro edita o próprio nome" on public.library_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and role = (select private.member_role(id)));
create policy "dono remove membros" on public.library_members
  for delete to authenticated
  using ((select private.is_owner(library_id)) and user_id <> (select auth.uid()));
create policy "membro sai da casa" on public.library_members
  for delete to authenticated
  using (user_id = (select auth.uid()) and role = 'member');

revoke update on public.library_members from authenticated;
grant update (display_name, role) on public.library_members to authenticated;

-- library_invites: só o dono gerencia; aceitar é pela RPC
create policy "dono vê convites" on public.library_invites
  for select to authenticated using ((select private.is_owner(library_id)));
create policy "dono cria convites" on public.library_invites
  for insert to authenticated
  with check ((select private.is_owner(library_id)) and invited_by = (select auth.uid()));
create policy "dono apaga convites" on public.library_invites
  for delete to authenticated using ((select private.is_owner(library_id)));

-- Dados compartilhados da casa: qualquer membro lê e escreve
do $$
declare
  t text;
begin
  foreach t in array array['books', 'book_genres', 'copies', 'loans', 'imports'] loop
    execute format(
      'create policy "membros leem" on public.%I for select to authenticated
         using ((select private.is_member(library_id)))', t);
    execute format(
      'create policy "membros criam" on public.%I for insert to authenticated
         with check ((select private.is_member(library_id)))', t);
    execute format(
      'create policy "membros editam" on public.%I for update to authenticated
         using ((select private.is_member(library_id)))
         with check ((select private.is_member(library_id)))', t);
    execute format(
      'create policy "membros apagam" on public.%I for delete to authenticated
         using ((select private.is_member(library_id)))', t);
  end loop;
end;
$$;

-- genres: membros leem; o dono cria, renomeia, mescla e exclui
create policy "membros leem" on public.genres
  for select to authenticated using ((select private.is_member(library_id)));
create policy "dono cria" on public.genres
  for insert to authenticated with check ((select private.is_owner(library_id)));
create policy "dono edita" on public.genres
  for update to authenticated
  using ((select private.is_owner(library_id)))
  with check ((select private.is_owner(library_id)));
create policy "dono apaga" on public.genres
  for delete to authenticated using ((select private.is_owner(library_id)));

-- readings e goals: a família lê (relatórios "da família"); cada um escreve as suas
do $$
declare
  t text;
begin
  foreach t in array array['readings', 'goals'] loop
    execute format(
      'create policy "família lê" on public.%I for select to authenticated
         using ((select private.is_member(library_id)))', t);
    execute format(
      'create policy "cada um cria as suas" on public.%I for insert to authenticated
         with check ((select private.is_me(member_id)))', t);
    execute format(
      'create policy "cada um edita as suas" on public.%I for update to authenticated
         using ((select private.is_me(member_id)))
         with check ((select private.is_me(member_id)))', t);
    execute format(
      'create policy "cada um apaga as suas" on public.%I for delete to authenticated
         using ((select private.is_me(member_id)))', t);
  end loop;
end;
$$;

create policy "família lê" on public.reading_progress
  for select to authenticated using ((select private.is_member(library_id)));
create policy "cada um cria o seu" on public.reading_progress
  for insert to authenticated with check ((select private.reading_is_mine(reading_id)));
create policy "cada um edita o seu" on public.reading_progress
  for update to authenticated
  using ((select private.reading_is_mine(reading_id)))
  with check ((select private.reading_is_mine(reading_id)));
create policy "cada um apaga o seu" on public.reading_progress
  for delete to authenticated using ((select private.reading_is_mine(reading_id)));

-- -----------------------------------------------------------------------------
-- Gêneros iniciais (pt-BR)
-- -----------------------------------------------------------------------------
create or replace function private.seed_default_genres(p_library_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.genres (library_id, name)
  select p_library_id, g
  from unnest(array[
    'Ficção', 'Romance', 'Fantasia', 'Ficção científica', 'Terror', 'Suspense e mistério',
    'Policial', 'Literatura brasileira', 'Clássicos', 'Poesia', 'Contos', 'Crônicas',
    'Biografia e memórias', 'História', 'Filosofia', 'Psicologia', 'Autoajuda',
    'Negócios e economia', 'Ciência', 'Tecnologia', 'Política e sociedade',
    'Religião e espiritualidade', 'Infantil', 'Juvenil', 'HQ e mangá', 'Arte e fotografia',
    'Culinária', 'Viagem', 'Educação', 'Saúde e bem-estar'
  ]) as g
  on conflict do nothing;
$$;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Cria uma casa com o usuário atual como dono e a lista inicial de gêneros.
create or replace function public.create_library(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_library_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.libraries (name, owner_id)
  values (btrim(p_name), v_user)
  returning id into v_library_id;

  insert into public.library_members (library_id, user_id, role, display_name)
  values (v_library_id, v_user, 'owner', btrim(p_display_name));

  perform private.seed_default_genres(v_library_id);

  return v_library_id;
end;
$$;

-- Dados públicos mínimos de um convite, para a tela "Você foi convidado".
create or replace function public.get_invite(p_token uuid)
returns table (library_name text, invited_by_name text, email text, expires_at timestamptz, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.name,
    m.display_name,
    i.email,
    i.expires_at,
    case
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end
  from public.library_invites i
  join public.libraries l on l.id = i.library_id
  left join public.library_members m on m.library_id = i.library_id and m.user_id = i.invited_by
  where i.token = p_token;
$$;

-- Aceita um convite (uso único). Convites por e-mail só valem para aquele e-mail.
create or replace function public.accept_invite(p_token uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.library_invites%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_invite from public.library_invites where token = p_token for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  -- Já é membro: nada a fazer (idempotente para quem clica duas vezes).
  if exists (
    select 1 from public.library_members
    where library_id = v_invite.library_id and user_id = v_user
  ) then
    return v_invite.library_id;
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  if v_invite.email is not null and lower(v_invite.email) <> v_email then
    raise exception 'invite_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.library_members (library_id, user_id, role, display_name)
  values (v_invite.library_id, v_user, v_invite.role, btrim(p_display_name));

  update public.library_invites
  set accepted_at = now(), accepted_by = v_user
  where id = v_invite.id;

  return v_invite.library_id;
end;
$$;

revoke all on function public.create_library(text, text) from public, anon;
revoke all on function public.get_invite(uuid) from public, anon;
revoke all on function public.accept_invite(uuid, text) from public, anon;
grant execute on function public.create_library(text, text) to authenticated;
grant execute on function public.get_invite(uuid) to authenticated;
grant execute on function public.accept_invite(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: capas (caminho = <library_id>/<arquivo>)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "membros enviam capas" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (select private.is_member(((storage.foldername(name))[1])::uuid))
  );
create policy "membros trocam capas" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'covers'
    and (select private.is_member(((storage.foldername(name))[1])::uuid))
  );
create policy "membros apagam capas" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'covers'
    and (select private.is_member(((storage.foldername(name))[1])::uuid))
  );
