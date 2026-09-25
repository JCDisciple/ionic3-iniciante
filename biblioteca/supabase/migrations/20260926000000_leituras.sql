-- =============================================================================
-- Fase 3 — Leituras e relatórios: progresso, conclusão e metas.
-- As tabelas (readings, reading_progress, goals) e o RLS vêm da migração base;
-- aqui entram as operações atômicas e os índices dos relatórios.
-- =============================================================================

create index reading_progress_library_date_idx on public.reading_progress (library_id, date);
create index readings_library_member_idx on public.readings (library_id, member_id);

-- Um registro de progresso por leitura e dia: registrar de novo no mesmo dia
-- substitui o anterior (evita duplicatas ao tocar duas vezes em "+ progresso").
create unique index reading_progress_reading_date_key on public.reading_progress (reading_id, date);
drop index if exists public.reading_progress_reading_date_idx;

-- Registra progresso (página, % ou minutos) numa data. Se a leitura ainda era
-- "quero ler", passa para "lendo" com início nessa data. Roda com as
-- permissões de quem chama: só o dono da leitura consegue (RLS).
create or replace function public.log_progress(
  p_reading_id uuid,
  p_date date default current_date,
  p_page integer default null,
  p_percent numeric default null,
  p_minutes integer default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_library_id uuid;
begin
  if num_nonnulls(p_page, p_percent, p_minutes) = 0 then
    raise exception 'empty_progress' using errcode = '22023';
  end if;

  update public.readings
  set status = case when status in ('want', 'abandoned') then 'reading' else status end,
      started_at = coalesce(started_at, p_date),
      finished_at = case when status = 'abandoned' then null else finished_at end
  where id = p_reading_id
  returning library_id into v_library_id;

  if v_library_id is null then
    raise exception 'reading_not_found' using errcode = 'P0002';
  end if;

  insert into public.reading_progress (library_id, reading_id, date, page, percent, minutes)
  values (v_library_id, p_reading_id, p_date, p_page, p_percent, p_minutes)
  on conflict (reading_id, date) do update
  set page = excluded.page, percent = excluded.percent, minutes = excluded.minutes;
end;
$$;

grant execute on function public.log_progress(uuid, date, integer, numeric, integer) to authenticated;

-- Conclui (lido) ou abandona uma leitura. Ao concluir, grava também o
-- progresso final (100%) na data de término, para os gráficos de ritmo.
create or replace function public.finish_reading(
  p_reading_id uuid,
  p_status public.reading_status,
  p_finished_at date default current_date,
  p_rating smallint default null,
  p_review text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reading public.readings;
  v_pages integer;
  v_minutes integer;
begin
  if p_status not in ('read', 'abandoned') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.readings
  set status = p_status,
      finished_at = p_finished_at,
      started_at = least(coalesce(started_at, p_finished_at), p_finished_at),
      rating = case when p_status = 'read' then p_rating else rating end,
      review = case when p_status = 'read' then nullif(btrim(p_review), '') else review end
  where id = p_reading_id
  returning * into v_reading;

  if v_reading.id is null then
    raise exception 'reading_not_found' using errcode = 'P0002';
  end if;

  if p_status = 'read' then
    select pages, audio_minutes into v_pages, v_minutes from public.books where id = v_reading.book_id;
    insert into public.reading_progress (library_id, reading_id, date, page, percent, minutes)
    values (v_reading.library_id, v_reading.id, p_finished_at, v_pages, 100, v_minutes)
    on conflict (reading_id, date) do update
    set page = excluded.page, percent = excluded.percent, minutes = excluded.minutes;
  end if;
end;
$$;

grant execute on function public.finish_reading(uuid, public.reading_status, date, smallint, text) to authenticated;

-- add_to_library: a leitura pode apontar para um exemplar já existente
-- (p_reading.copy_id), para releituras do próprio acervo. A FK composta
-- (copy_id, library_id) garante que o exemplar é da mesma casa.
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
      case when coalesce(v_reading.origin, 'own') = 'own' then coalesce(v_copy_id, v_reading.copy_id) end,
      coalesce(v_reading.origin, 'own'), v_reading.lent_by, coalesce(v_reading.status, 'want'),
      v_reading.started_at, v_reading.finished_at
    );
  end if;

  return v_book_id;
end;
$$;

