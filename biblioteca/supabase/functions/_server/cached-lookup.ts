/**
 * Busca de ISBN com cache em public.isbn_cache (service role). Usada pelas
 * Edge Functions isbn-lookup e import-enrich. Fica fora de _shared porque
 * depende do cliente do Supabase (o app não importa daqui).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { lookupIsbn, type BookData } from '../_shared/book-sources.ts';

const FOUND_TTL_DAYS = 90;
const NOT_FOUND_TTL_DAYS = 7;

function isFresh(updatedAt: string, found: boolean): boolean {
  const ttl = (found ? FOUND_TTL_DAYS : NOT_FOUND_TTL_DAYS) * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(updatedAt).getTime() < ttl;
}

export async function cachedLookup(
  admin: SupabaseClient,
  isbn13: string,
  googleApiKey: string | null,
): Promise<{ book: BookData | null; cached: boolean }> {
  const { data: cached } = await admin
    .from('isbn_cache')
    .select('found, data, updated_at')
    .eq('isbn', isbn13)
    .maybeSingle();

  if (cached && isFresh(cached.updated_at, cached.found)) {
    return { book: cached.data as BookData | null, cached: true };
  }

  const book = await lookupIsbn(isbn13, { fetch, googleApiKey });
  await admin.from('isbn_cache').upsert({ isbn: isbn13, found: !!book, data: book }, { onConflict: 'isbn' });
  return { book, cached: false };
}
