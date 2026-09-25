import { parseIsbn } from '@shared/isbn.ts';

import type { CopyFormat, ReadingStatus } from '@/types/models';

/**
 * Mapeamento de colunas → campos do app, com predefinições para o CSV oficial
 * do Goodreads, exportações do Skoob e planilhas próprias (RF9). Puro e testável.
 */

export type ImportSource = 'goodreads' | 'skoob' | 'sheet';

export const FIELDS = [
  { key: 'title', label: 'Título', required: true },
  { key: 'authors', label: 'Autor(es)' },
  { key: 'extra_authors', label: 'Outros autores' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'isbn_alt', label: 'ISBN alternativo' },
  { key: 'publisher', label: 'Editora' },
  { key: 'year', label: 'Ano' },
  { key: 'pages', label: 'Páginas' },
  { key: 'status', label: 'Situação da leitura' },
  { key: 'rating', label: 'Nota' },
  { key: 'started_at', label: 'Data de início' },
  { key: 'finished_at', label: 'Data de término' },
  { key: 'review', label: 'Resenha' },
  { key: 'genres', label: 'Gêneros ou estantes' },
  { key: 'owned', label: 'Tenho o livro' },
  { key: 'format', label: 'Formato' },
] as const;

export type FieldKey = (typeof FIELDS)[number]['key'];
/** Campo → índice da coluna (ou null = não importar). */
export type Mapping = Record<FieldKey, number | null>;

export function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Sinônimos por campo, em ordem de preferência (já normalizados). */
const SYNONYMS: Record<FieldKey, string[]> = {
  title: ['title', 'titulo', 'nome do livro', 'livro', 'nome', 'book title', 'book'],
  authors: ['author', 'autor', 'autores', 'authors', 'autor a', 'escritor', 'author l f'],
  extra_authors: ['additional authors', 'outros autores', 'coautores', 'coautor'],
  isbn: ['isbn13', 'isbn 13', 'isbn'],
  isbn_alt: ['isbn', 'isbn10', 'isbn 10'],
  publisher: ['publisher', 'editora'],
  year: [
    'year published',
    'ano',
    'ano de publicacao',
    'publicacao',
    'ano publicacao',
    'original publication year',
    'year',
  ],
  pages: [
    'number of pages',
    'paginas',
    'pages',
    'numero de paginas',
    'n de paginas',
    'no de paginas',
    'qtd paginas',
  ],
  status: [
    'exclusive shelf',
    'status',
    'situacao',
    'estante',
    'shelf',
    'leitura',
    'tipo de leitura',
  ],
  rating: ['my rating', 'nota', 'minha nota', 'avaliacao', 'minha avaliacao', 'rating', 'estrelas'],
  started_at: ['date started', 'data de inicio', 'inicio', 'comecei em', 'started'],
  finished_at: [
    'date read',
    'data de leitura',
    'data de termino',
    'termino',
    'terminei em',
    'lido em',
    'data lido',
    'fim',
    'data',
  ],
  review: [
    'my review',
    'resenha',
    'minha resenha',
    'review',
    'comentario',
    'comentarios',
    'opiniao',
  ],
  genres: ['bookshelves', 'generos', 'genero', 'categoria', 'categorias', 'tags', 'estantes'],
  owned: ['owned copies', 'tenho', 'possuo', 'no acervo', 'tenho o livro'],
  format: ['binding', 'formato', 'tipo', 'midia'],
};

export function emptyMapping(): Mapping {
  return Object.fromEntries(FIELDS.map((f) => [f.key, null])) as Mapping;
}

/** Reconhece o CSV oficial do Goodreads pelos cabeçalhos. */
export function detectSource(headers: string[]): ImportSource | null {
  const set = new Set(headers.map(normalizeHeader));
  if (set.has('book id') && set.has('exclusive shelf')) return 'goodreads';
  if ([...set].some((h) => h.includes('skoob'))) return 'skoob';
  return null;
}

/** Sugere o mapeamento pelos nomes das colunas (sempre revisável na tela). */
export function guessMapping(headers: string[]): Mapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = emptyMapping();
  const used = new Set<number>();
  for (const field of FIELDS) {
    for (const synonym of SYNONYMS[field.key]) {
      const index = normalized.findIndex((h, i) => h === synonym && !used.has(i));
      if (index >= 0) {
        mapping[field.key] = index;
        used.add(index);
        break;
      }
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Conversão de valores
// ---------------------------------------------------------------------------

/** Tira o ="..." que o Goodreads coloca nos ISBNs e espaços nas pontas. */
export function cleanCell(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  const excel = trimmed.match(/^="(.*)"$/);
  return (excel ? excel[1] : trimmed).trim();
}

const STATUS_WORDS: [RegExp, ReadingStatus][] = [
  [/^(to read|quero ler|quero|desejad|para ler|a ler|want|wishlist|lista)/, 'want'],
  [/^(currently reading|lendo|relendo|reading|em leitura|comecei)/, 'reading'],
  [/^(read|lido|lidos|ja li|li|finished|terminado|concluido)$/, 'read'],
  [/^(abandon|did not finish|dnf|parei|desisti)/, 'abandoned'],
];

export function parseStatus(value: string): ReadingStatus | null {
  const key = normalizeHeader(cleanCell(value));
  if (!key) return null;
  return STATUS_WORDS.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

/** 0 = sem nota (Goodreads); 1–5 direto; 6–10 vira escala de 5; aceita "4,5". */
export function parseRating(value: string): number | null {
  const n = Number(cleanCell(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const five = n > 5 ? n / 2 : n;
  return Math.min(5, Math.max(1, Math.round(five)));
}

const pad = (n: number) => String(n).padStart(2, '0');
function validDate(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Datas em AAAA/MM/DD (Goodreads), AAAA-MM-DD, DD/MM/AAAA (Brasil), número de
 * série do Excel ou só o ano (vira 31/12 daquele ano, para contar no ano certo).
 */
export function parseDate(value: string): string | null {
  const v = cleanCell(value);
  if (!v) return null;
  let m = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  if (/^\d{4}$/.test(v)) return validDate(+v, 12, 31);
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    // Série do Excel: dias desde 30/12/1899
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86_400_000);
    return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  return null;
}

export function parsePositiveInt(value: string, max = 100_000): number | null {
  const v = cleanCell(value).replace(/\.(?=\d{3}\b)/g, '');
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}

export function parseYear(value: string): number | null {
  const m = cleanCell(value).match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

export function parseOwned(value: string): boolean | null {
  const key = normalizeHeader(cleanCell(value));
  if (!key) return null;
  if (/^\d+$/.test(key)) return Number(key) > 0;
  if (/^(sim|s|yes|y|x|true|verdadeiro|tenho|ok)$/.test(key)) return true;
  if (/^(nao|n|no|false|falso)$/.test(key)) return false;
  return null;
}

export function parseFormat(value: string): CopyFormat | null {
  const key = normalizeHeader(cleanCell(value));
  if (!key) return null;
  if (/kindle unlimited|assinatura|skeelo|kobo plus|subscription/.test(key)) return 'subscription';
  if (/audi|audio/.test(key)) return 'audiobook';
  if (/kindle|ebook|e book|epub|digital|kobo|nook/.test(key)) return 'ebook';
  if (/paperback|hardcover|brochura|capa|fisico|impresso|mass market|print|livro/.test(key))
    return 'physical';
  return null;
}

/**
 * Autores separados por ";", "/", " & " ou vírgula (quando cada parte é um nome
 * completo). "Assis, Machado de" (formato sobrenome, nome) vira "Machado de Assis".
 */
export function parseAuthors(value: string): string[] {
  const v = cleanCell(value);
  if (!v) return [];
  let parts = v.split(/\s*(?:;|\/|&|\|)\s*/).filter(Boolean);
  if (parts.length === 1 && v.includes(',')) {
    const pieces = v.split(/\s*,\s*/).filter(Boolean);
    if (pieces.length === 2 && !pieces[0].includes(' ')) parts = [`${pieces[1]} ${pieces[0]}`];
    else if (pieces.every((p) => p.includes(' '))) parts = pieces;
  }
  const seen = new Set<string>();
  return parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
}

const IGNORED_SHELVES = new Set([
  'to read',
  'currently reading',
  'read',
  'favorites',
  'favoritos',
  'owned',
  'kindle',
]);

export function parseGenres(value: string): string[] {
  return cleanCell(value)
    .split(/\s*[,;|]\s*/)
    .map((s) => s.replace(/-/g, ' ').trim())
    .filter((s) => s && !IGNORED_SHELVES.has(normalizeHeader(s)));
}

// ---------------------------------------------------------------------------
// Linha normalizada
// ---------------------------------------------------------------------------

export type ImportRecord = {
  index: number;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  year: number | null;
  pages: number | null;
  status: ReadingStatus | null;
  rating: number | null;
  started_at: string | null;
  finished_at: string | null;
  review: string | null;
  categories: string[];
  owned: boolean | null;
  format: CopyFormat | null;
  errors: string[];
};

/**
 * "Título (Série, #1)" (padrão do Goodreads) vira título + série no subtítulo.
 * Dois-pontos não dividem: "Grande Sertão: Veredas" é um título só.
 */
export function splitTitle(raw: string): { title: string; subtitle: string | null } {
  const series = raw.match(/^(.*?)\s*\(([^()]*#\s*\d+[^()]*)\)\s*$/);
  if (series && series[1].trim()) return { title: series[1].trim(), subtitle: series[2].trim() };
  return { title: raw.trim(), subtitle: null };
}

export function toRecord(cells: string[], mapping: Mapping, index: number): ImportRecord {
  const get = (key: FieldKey) => (mapping[key] === null ? '' : cleanCell(cells[mapping[key]!]));
  const { title, subtitle } = splitTitle(get('title'));
  const isbn = parseIsbn(get('isbn')) ?? parseIsbn(get('isbn_alt'));
  const finished = parseDate(get('finished_at'));
  let status = parseStatus(get('status'));
  if (!status && finished) status = 'read';
  const review = get('review')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  const errors: string[] = [];
  if (!title) errors.push('Sem título');

  return {
    index,
    title,
    subtitle,
    authors: [...parseAuthors(get('authors')), ...parseAuthors(get('extra_authors'))].filter(
      (a, i, all) => all.findIndex((b) => b.toLowerCase() === a.toLowerCase()) === i,
    ),
    isbn13: isbn?.isbn13 ?? null,
    isbn10: isbn?.isbn10 ?? null,
    publisher: get('publisher') || null,
    year: parseYear(get('year')),
    pages: parsePositiveInt(get('pages'), 20_000),
    status,
    rating: parseRating(get('rating')),
    started_at: parseDate(get('started_at')),
    finished_at: finished,
    review: review ? review.slice(0, 2000) : null,
    categories: parseGenres(get('genres')),
    owned: parseOwned(get('owned')),
    format: parseFormat(get('format')),
    errors,
  };
}
