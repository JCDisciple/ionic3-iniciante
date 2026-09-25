/**
 * Normalização das fontes de metadados (BrasilAPI, Google Books, Open Library)
 * e a regra de cascata: as fontes são consultadas em paralelo, mas combinadas
 * na ordem de prioridade — a primeira que trouxer um campo vence, e as seguintes
 * só completam o que faltar (capa e gênero, em geral).
 *
 * Código puro (fetch injetado) para rodar no Deno e nos testes do Node.
 */

import { isbn13To10, parseIsbn } from './isbn.ts';

export type BookSource = 'brasilapi' | 'google' | 'openlibrary';

export type BookData = {
  isbn_13: string | null;
  isbn_10: string | null;
  title: string | null;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  year: number | null;
  pages: number | null;
  language: string | null;
  cover_url: string | null;
  /** Categorias/assuntos brutos das APIs; o app mapeia para os gêneros da casa. */
  categories: string[];
  /** Fonte que forneceu o título (vai para books.source). */
  source: BookSource | null;
};

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export const emptyBook = (): BookData => ({
  isbn_13: null,
  isbn_10: null,
  title: null,
  subtitle: null,
  authors: [],
  publisher: null,
  year: null,
  pages: null,
  language: null,
  cover_url: null,
  categories: [],
  source: null,
});

// ---------------------------------------------------------------------------
// Utilitários de limpeza
// ---------------------------------------------------------------------------

const LOWERCASE_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'a',
  'o',
  'em',
  'y',
  'of',
  'the',
  'and',
]);

/** "MACHADO DE ASSIS" → "Machado de Assis". Só mexe em textos todos em maiúsculas. */
export function fixCase(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed !== trimmed.toUpperCase() || !/[A-ZÀ-Ý]/.test(trimmed)) return trimmed;
  return trimmed
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function parseYear(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 && value <= 2100 ? value : null;
  const match = typeof value === 'string' ? value.match(/\d{4}/) : null;
  return match ? Number(match[0]) : null;
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const LANGUAGE_CODES: Record<string, string> = {
  por: 'pt',
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  jpn: 'ja',
};

export function normalizeLanguage(value: unknown): string | null {
  const code = str(value)
    ?.toLowerCase()
    .replace(/^\/languages\//, '');
  if (!code) return null;
  if (LANGUAGE_CODES[code]) return LANGUAGE_CODES[code];
  const short = code.split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(short) ? short : null;
}

function httpsUrl(value: unknown): string | null {
  const url = str(value);
  return url ? url.replace(/^http:\/\//, 'https://') : null;
}

// ---------------------------------------------------------------------------
// BrasilAPI — https://brasilapi.com.br/api/isbn/v1/{isbn}
// ---------------------------------------------------------------------------

export function parseBrasilApi(json: unknown): BookData | null {
  if (!json || typeof json !== 'object') return null;
  const data = json as Record<string, unknown>;
  const title = str(data.title);
  if (!title) return null;
  const isbn = parseIsbn(String(data.isbn ?? ''));
  return {
    ...emptyBook(),
    isbn_13: isbn?.isbn13 ?? null,
    isbn_10: isbn?.isbn10 ?? null,
    title: fixCase(title),
    subtitle: str(data.subtitle) ? fixCase(str(data.subtitle)!) : null,
    authors: Array.isArray(data.authors)
      ? uniq(
          data.authors
            .map(str)
            .filter(Boolean)
            .map((a) => fixCase(a!)),
        )
      : [],
    publisher: str(data.publisher) ? fixCase(str(data.publisher)!) : null,
    year: parseYear(data.year),
    pages: positiveInt(data.page_count),
    cover_url: httpsUrl(data.cover_url),
    categories: Array.isArray(data.subjects)
      ? uniq(data.subjects.map(str).filter(Boolean) as string[])
      : [],
    source: 'brasilapi',
  };
}

// ---------------------------------------------------------------------------
// Google Books — volumes?q=isbn:{isbn}
// ---------------------------------------------------------------------------

type GoogleVolumeInfo = {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  language?: string;
  imageLinks?: Record<string, string>;
  industryIdentifiers?: { type: string; identifier: string }[];
};

export function googleCoverUrl(imageLinks: Record<string, string> | undefined): string | null {
  const raw = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail;
  const url = httpsUrl(raw);
  return url ? url.replace(/&edge=curl/g, '') : null;
}

export function parseGoogleVolume(info: GoogleVolumeInfo | undefined): BookData | null {
  const title = str(info?.title);
  if (!info || !title) return null;
  const ids = info.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
  const parsed = parseIsbn(isbn13 ?? isbn10 ?? '');
  return {
    ...emptyBook(),
    isbn_13: parsed?.isbn13 ?? null,
    isbn_10: parsed?.isbn10 ?? null,
    title,
    subtitle: str(info.subtitle),
    authors: uniq((info.authors ?? []).map(str).filter(Boolean) as string[]),
    publisher: str(info.publisher),
    year: parseYear(info.publishedDate),
    pages: positiveInt(info.pageCount),
    language: normalizeLanguage(info.language),
    cover_url: googleCoverUrl(info.imageLinks),
    categories: uniq((info.categories ?? []).map(str).filter(Boolean) as string[]),
    source: 'google',
  };
}

export function parseGoogleResponse(json: unknown): BookData | null {
  const items = (json as { items?: { volumeInfo?: GoogleVolumeInfo }[] } | null)?.items;
  return parseGoogleVolume(items?.[0]?.volumeInfo);
}

// ---------------------------------------------------------------------------
// Open Library — api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data
// ---------------------------------------------------------------------------

type OpenLibraryEntry = {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: ({ name?: string } | string)[];
  cover?: { small?: string; medium?: string; large?: string };
  identifiers?: { isbn_13?: string[]; isbn_10?: string[] };
  languages?: { key?: string }[];
};

export function parseOpenLibraryEntry(entry: OpenLibraryEntry | undefined): BookData | null {
  const title = str(entry?.title);
  if (!entry || !title) return null;
  const parsed = parseIsbn(
    entry.identifiers?.isbn_13?.[0] ?? entry.identifiers?.isbn_10?.[0] ?? '',
  );
  return {
    ...emptyBook(),
    isbn_13: parsed?.isbn13 ?? null,
    isbn_10: parsed?.isbn10 ?? null,
    title,
    subtitle: str(entry.subtitle),
    authors: uniq((entry.authors ?? []).map((a) => str(a.name)).filter(Boolean) as string[]),
    publisher: str(entry.publishers?.[0]?.name),
    year: parseYear(entry.publish_date),
    pages: positiveInt(entry.number_of_pages),
    language: normalizeLanguage(entry.languages?.[0]?.key),
    cover_url: httpsUrl(entry.cover?.large ?? entry.cover?.medium),
    categories: uniq(
      (entry.subjects ?? [])
        .map((s) => (typeof s === 'string' ? str(s) : str(s.name)))
        .filter(Boolean)
        .slice(0, 8) as string[],
    ),
    source: 'openlibrary',
  };
}

export function parseOpenLibraryResponse(json: unknown, isbn13: string): BookData | null {
  const map = (json ?? {}) as Record<string, OpenLibraryEntry>;
  return parseOpenLibraryEntry(map[`ISBN:${isbn13}`] ?? Object.values(map)[0]);
}

// ---------------------------------------------------------------------------
// Cascata
// ---------------------------------------------------------------------------

/** Completa `base` com o que faltar em `extra`. */
export function mergeBookData(base: BookData, extra: BookData | null): BookData {
  if (!extra) return base;
  return {
    isbn_13: base.isbn_13 ?? extra.isbn_13,
    isbn_10: base.isbn_10 ?? extra.isbn_10,
    title: base.title ?? extra.title,
    subtitle: base.subtitle ?? extra.subtitle,
    authors: base.authors.length > 0 ? base.authors : extra.authors,
    publisher: base.publisher ?? extra.publisher,
    year: base.year ?? extra.year,
    pages: base.pages ?? extra.pages,
    language: base.language ?? extra.language,
    cover_url: base.cover_url ?? extra.cover_url,
    categories: base.categories.length > 0 ? base.categories : extra.categories,
    source: base.source ?? (extra.title ? extra.source : null),
  };
}

/** "Completo" = dá para salvar sem digitar nada: título, autor, capa, páginas e gênero. */
export function isComplete(book: BookData): boolean {
  return (
    !!book.title &&
    book.authors.length > 0 &&
    !!book.cover_url &&
    !!book.pages &&
    book.categories.length > 0
  );
}

export type LookupOptions = {
  fetch: FetchLike;
  googleApiKey?: string | null;
  /** Tempo máximo por fonte, em ms (a meta do PRD é 3 s no total). */
  timeoutMs?: number;
};

async function getJson(
  fetchFn: FetchLike,
  url: string,
  timeoutMs: number,
): Promise<unknown | null> {
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function sourceUrls(isbn13: string, googleApiKey?: string | null) {
  const key = googleApiKey ? `&key=${encodeURIComponent(googleApiKey)}` : '';
  return {
    brasilapi: `https://brasilapi.com.br/api/isbn/v1/${isbn13}`,
    google: `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}${key}`,
    openlibrary: `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`,
  };
}

/**
 * Busca um ISBN nas três fontes (em paralelo) e combina na ordem
 * BrasilAPI → Google Books → Open Library. Retorna null se ninguém achou.
 */
export async function lookupIsbn(isbn13: string, options: LookupOptions): Promise<BookData | null> {
  const timeoutMs = options.timeoutMs ?? 2500;
  const urls = sourceUrls(isbn13, options.googleApiKey);
  const [brasil, google, openlibrary] = await Promise.all([
    getJson(options.fetch, urls.brasilapi, timeoutMs).then(parseBrasilApi),
    getJson(options.fetch, urls.google, timeoutMs).then(parseGoogleResponse),
    getJson(options.fetch, urls.openlibrary, timeoutMs).then((json) =>
      parseOpenLibraryResponse(json, isbn13),
    ),
  ]);

  let book = emptyBook();
  for (const result of [brasil, google, openlibrary]) {
    book = mergeBookData(book, result);
    if (isComplete(book)) break;
  }
  if (!book.title) return null;

  // O ISBN pesquisado prevalece sobre o que as APIs devolveram (edições diferentes).
  return {
    ...book,
    isbn_13: isbn13,
    isbn_10: isbn13To10(isbn13) ?? book.isbn_10,
    cover_url:
      book.cover_url ?? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`,
  };
}

// ---------------------------------------------------------------------------
// Busca por título/autor (cadastro manual, RF2)
// ---------------------------------------------------------------------------

type OpenLibrarySearchDoc = {
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  publisher?: string[];
  language?: string[];
  subject?: string[];
};

export function parseOpenLibrarySearchDoc(doc: OpenLibrarySearchDoc): BookData | null {
  const title = str(doc.title);
  if (!title) return null;
  const isbns = (doc.isbn ?? []).map(parseIsbn).filter(Boolean) as {
    isbn13: string;
    isbn10: string | null;
  }[];
  // Prefere edição brasileira (978-85 / 978-65) quando houver.
  const isbn = isbns.find((i) => /^97(8|9)(85|65)/.test(i.isbn13)) ?? isbns[0] ?? null;
  return {
    ...emptyBook(),
    isbn_13: isbn?.isbn13 ?? null,
    isbn_10: isbn?.isbn10 ?? null,
    title,
    subtitle: str(doc.subtitle),
    authors: uniq((doc.author_name ?? []).map(str).filter(Boolean) as string[]),
    publisher: str(doc.publisher?.[0]),
    year: parseYear(doc.first_publish_year),
    pages: positiveInt(doc.number_of_pages_median),
    language: normalizeLanguage(doc.language?.[0]),
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    categories: uniq((doc.subject ?? []).slice(0, 8)),
    source: 'openlibrary',
  };
}

export function searchUrls(query: string, googleApiKey?: string | null) {
  const q = encodeURIComponent(query.trim());
  const key = googleApiKey ? `&key=${encodeURIComponent(googleApiKey)}` : '';
  return {
    google: `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=12&printType=books${key}`,
    openlibrary: `https://openlibrary.org/search.json?q=${q}&limit=12&fields=title,subtitle,author_name,first_publish_year,isbn,cover_i,number_of_pages_median,publisher,language,subject`,
  };
}

/** Resultados do Google primeiro, depois Open Library, sem repetir ISBN/título. */
export async function searchBooks(query: string, options: LookupOptions): Promise<BookData[]> {
  const timeoutMs = options.timeoutMs ?? 2500;
  const urls = searchUrls(query, options.googleApiKey);
  const [google, openlibrary] = await Promise.all([
    getJson(options.fetch, urls.google, timeoutMs),
    getJson(options.fetch, urls.openlibrary, timeoutMs),
  ]);

  const googleItems = (
    (google as { items?: { volumeInfo?: GoogleVolumeInfo }[] } | null)?.items ?? []
  ).map((item) => parseGoogleVolume(item.volumeInfo));
  const olItems = ((openlibrary as { docs?: OpenLibrarySearchDoc[] } | null)?.docs ?? []).map(
    parseOpenLibrarySearchDoc,
  );

  const seen = new Set<string>();
  const results: BookData[] = [];
  for (const book of [...googleItems, ...olItems]) {
    if (!book) continue;
    const key =
      book.isbn_13 ?? `${book.title?.toLowerCase()}|${book.authors[0]?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(book);
  }
  return results.slice(0, 20);
}
