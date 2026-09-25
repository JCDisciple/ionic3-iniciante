/**
 * POST /functions/v1/isbn-lookup
 *   { "isbn": "978-85-359-0277-8" } → { found: boolean, book: BookData | null, cached: boolean }
 *   { "query": "machado de assis" } → { results: BookData[] }
 *
 * Roda no servidor para esconder a chave do Google Books e guardar o
 * resultado por ISBN em public.isbn_cache. Exige usuário logado (verify_jwt).
 *
 * Segredos: GOOGLE_BOOKS_API_KEY (opcional, mas sem ela a cota é mínima).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { lookupIsbn, searchBooks, type BookData } from '../_shared/book-sources.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { parseIsbn } from '../_shared/isbn.ts';

const FOUND_TTL_DAYS = 90;
const NOT_FOUND_TTL_DAYS = 7;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const googleApiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? null;

function isFresh(updatedAt: string, found: boolean): boolean {
  const ttl = (found ? FOUND_TTL_DAYS : NOT_FOUND_TTL_DAYS) * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(updatedAt).getTime() < ttl;
}

async function handleIsbn(input: string): Promise<Response> {
  const isbn = parseIsbn(input);
  if (!isbn) return json({ error: 'invalid_isbn' }, 400);

  const { data: cached } = await admin
    .from('isbn_cache')
    .select('found, data, updated_at')
    .eq('isbn', isbn.isbn13)
    .maybeSingle();

  if (cached && isFresh(cached.updated_at, cached.found)) {
    return json({ found: cached.found, book: cached.data as BookData | null, cached: true });
  }

  const book = await lookupIsbn(isbn.isbn13, { fetch, googleApiKey });

  await admin
    .from('isbn_cache')
    .upsert({ isbn: isbn.isbn13, found: !!book, data: book }, { onConflict: 'isbn' });

  return json({ found: !!book, book, cached: false });
}

async function handleSearch(query: string): Promise<Response> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return json({ results: [] });
  const results = await searchBooks(trimmed.slice(0, 200), { fetch, googleApiKey });
  return json({ results });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { isbn?: unknown; query?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  try {
    if (typeof body.isbn === 'string') return await handleIsbn(body.isbn);
    if (typeof body.query === 'string') return await handleSearch(body.query);
    return json({ error: 'missing_isbn_or_query' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: 'lookup_failed' }, 500);
  }
});
