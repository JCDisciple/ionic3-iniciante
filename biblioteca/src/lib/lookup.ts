import { supabase } from '@/lib/supabase';
import type { BookData } from '@/types/models';

export type LookupResponse = { found: boolean; book: BookData | null; cached: boolean };

/** Busca de ISBN na Edge Function (cascata BrasilAPI → Google Books → Open Library). */
export async function lookupIsbn(isbn13: string): Promise<LookupResponse> {
  const { data, error } = await supabase.functions.invoke<LookupResponse>('isbn-lookup', {
    body: { isbn: isbn13 },
  });
  if (error || !data) throw error ?? new Error('lookup_failed');
  return data;
}

/** Busca por título/autor para o cadastro manual (RF2). */
export async function searchBooks(query: string): Promise<BookData[]> {
  const { data, error } = await supabase.functions.invoke<{ results: BookData[] }>('isbn-lookup', {
    body: { query },
  });
  if (error || !data) throw error ?? new Error('search_failed');
  return data.results;
}
