/**
 * POST /functions/v1/import-enrich  { "library_id": "...", "limit": 20 }
 *   → { processed, updated, remaining }
 *
 * Depois de uma importação, completa capa, páginas etc. dos livros com ISBN
 * que ainda não foram enriquecidos (books.enriched_at nulo). O app chama em
 * sequência até `remaining` chegar a zero, mostrando o progresso.
 *
 * Lê e grava os livros com o JWT de quem chamou (RLS: só membros da casa);
 * o cache de ISBN usa o service role.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { cachedLookup } from '../_server/cached-lookup.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { enrichmentPatch, type EnrichableBook } from '../_shared/enrich.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const googleApiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? null;
const CONCURRENCY = 4;
const MAX_LIMIT = 40;

type PendingBook = EnrichableBook & { id: string; isbn_13: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  let body: { library_id?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (typeof body.library_id !== 'string') return json({ error: 'missing_library_id' }, 400);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || 20));

  const pendingQuery = () =>
    user
      .from('books')
      .select('id, isbn_13, subtitle, authors, publisher, year, pages, language, cover_url', {
        count: 'exact',
      })
      .eq('library_id', body.library_id as string)
      .is('enriched_at', null)
      .not('isbn_13', 'is', null);

  const { data, error } = await pendingQuery().limit(limit);
  if (error) return json({ error: error.message }, 400);
  const books = (data ?? []) as PendingBook[];

  let updated = 0;
  for (let i = 0; i < books.length; i += CONCURRENCY) {
    await Promise.all(
      books.slice(i, i + CONCURRENCY).map(async (book) => {
        const { book: found } = await cachedLookup(admin, book.isbn_13, googleApiKey).catch(() => ({
          book: null,
        }));
        const patch = enrichmentPatch(book, found);
        if (Object.keys(patch).length > 0) updated++;
        await user
          .from('books')
          .update({ ...patch, enriched_at: new Date().toISOString() })
          .eq('id', book.id);
      }),
    );
  }

  const { count } = await pendingQuery().limit(0);
  return json({ processed: books.length, updated, remaining: count ?? 0 });
});
