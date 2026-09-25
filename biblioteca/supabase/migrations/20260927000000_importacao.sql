-- =============================================================================
-- Fase 4 — Importação e exportação.
-- O arquivo é lido e mapeado no app (a prévia precisa das linhas); a gravação
-- roda no banco em lotes (import_rows) e o enriquecimento de capa/páginas pelo
-- ISBN roda na Edge Function import-enrich.
-- =============================================================================

alter table public.imports
  add column rows_failed integer not null default 0,
  add column rows_skipped integer not null default 0,
  add column file_name text,
  add column options jsonb not null default '{}';

-- Marca livros já enriquecidos (com ou sem sucesso) para não repetir a busca.
alter table public.books add column enriched_at timestamptz;
create index books_enrich_pending_idx on public.books (library_id)
  where enriched_at is null and isbn_13 is not null;

-- add_to_library: a leitura também leva nota e resenha (vindas da importação).
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
      library_id, member_id, book_id, copy_id, origin, lent_by, status, started_at, finished_at,
      rating, review
    ) values (
      p_library_id, v_member_id, v_book_id,
      case when coalesce(v_reading.origin, 'own') = 'own' then coalesce(v_copy_id, v_reading.copy_id) end,
      coalesce(v_reading.origin, 'own'), v_reading.lent_by, coalesce(v_reading.status, 'want'),
      v_reading.started_at, v_reading.finished_at, v_reading.rating, v_reading.review
    );
  end if;

  return v_book_id;
end;
$$;


-- Grava um lote de linhas já mapeadas. Cada linha é
--   { index, book, genre_ids, copy, reading }
-- no formato de add_to_library. Linhas com erro não derrubam o lote: voltam
-- em "errors" e contam em imports.rows_failed.
create or replace function public.import_rows(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_library_id uuid;
  v_row jsonb;
  v_ok integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]';
begin
  select library_id into v_library_id from public.imports where id = p_import_id;
  if v_library_id is null then
    raise exception 'import_not_found' using errcode = 'P0002';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    begin
      perform public.add_to_library(
        v_library_id,
        v_row -> 'book',
        coalesce(
          (select array_agg(g::uuid) from jsonb_array_elements_text(nullif(v_row -> 'genre_ids', 'null'::jsonb)) as g),
          '{}'
        ),
        nullif(v_row -> 'copy', 'null'::jsonb),
        nullif(v_row -> 'reading', 'null'::jsonb)
      );
      v_ok := v_ok + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('index', v_row -> 'index', 'message', sqlerrm);
    end;
  end loop;

  update public.imports
  set rows_imported = rows_imported + v_ok,
      rows_failed = rows_failed + v_failed
  where id = p_import_id;

  return jsonb_build_object('imported', v_ok, 'failed', v_failed, 'errors', v_errors);
end;
$$;

grant execute on function public.import_rows(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: arquivos importados (privado), caminho <library_id>/<arquivo>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('imports', 'imports', false, 20971520)
on conflict (id) do nothing;

create policy "membros enviam importações" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imports'
    and (select private.is_member(((storage.foldername(name))[1])::uuid))
  );
create policy "membros leem importações" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'imports'
    and (select private.is_member(((storage.foldername(name))[1])::uuid))
  );
