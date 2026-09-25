import type { ExportData } from '@/lib/export';
import { fetchAllPages } from '@/lib/import/api';
import { supabase } from '@/lib/supabase';

/** Carrega todas as tabelas da biblioteca para a exportação. */
export async function fetchExportData(library: { id: string; name: string }): Promise<ExportData> {
  const page = (table: string, select = '*') =>
    fetchAllPages((from, to) =>
      supabase.from(table).select(select).eq('library_id', library.id).order('id').range(from, to),
    );

  const [members, books, genres, copies, loans, readings, progress, goals] = await Promise.all([
    page('library_members'),
    page('books', '*, book_genres(genre_id)'),
    page('genres'),
    page('copies'),
    page('loans'),
    page('readings'),
    page('reading_progress'),
    page('goals'),
  ]);
  return {
    library,
    members,
    books,
    genres,
    copies,
    loans,
    readings,
    progress,
    goals,
  } as ExportData;
}
