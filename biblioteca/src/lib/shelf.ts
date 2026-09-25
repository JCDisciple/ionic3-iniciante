import type { Book, CopyFormat, ReadingStatus } from '@/types/models';

/** Um exemplar como vem da consulta da estante (useShelf). */
export type ShelfCopyLike = {
  id: string;
  book_id: string;
  format: CopyFormat;
  platform: string | null;
  location: string | null;
  created_at: string;
  book: Book & { book_genres: { genre_id: string }[] };
  loans: { returned_at: string | null; due_at: string | null }[];
};

/** Um livro na estante, com os exemplares que a casa tem dele. */
export type ShelfBook = {
  book: ShelfCopyLike['book'];
  formats: CopyFormat[];
  platforms: string[];
  locations: string[];
  genreIds: string[];
  onLoan: boolean;
  addedAt: string;
};

export type ShelfKind = 'physical' | 'online' | 'all';
export type ShelfSort = 'recent' | 'title' | 'author' | 'year';
export type StatusFilter = ReadingStatus | 'unread';

export type ShelfFilters = {
  shelf: ShelfKind;
  search: string;
  sort: ShelfSort;
  genreIds: string[];
  author: string | null;
  status: StatusFilter | null;
  platform: string | null;
  location: string | null;
};

export const defaultFilters = (): ShelfFilters => ({
  shelf: 'physical',
  search: '',
  sort: 'recent',
  genreIds: [],
  author: null,
  status: null,
  platform: null,
  location: null,
});

export function normalizeText(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Agrupa exemplares por livro, respeitando Física / Online / Tudo. */
export function groupShelf(copies: ShelfCopyLike[], shelf: ShelfKind): ShelfBook[] {
  const byBook = new Map<string, ShelfBook>();
  for (const copy of copies) {
    if (shelf === 'physical' && copy.format !== 'physical') continue;
    if (shelf === 'online' && copy.format === 'physical') continue;
    let item = byBook.get(copy.book_id);
    if (!item) {
      item = {
        book: copy.book,
        formats: [],
        platforms: [],
        locations: [],
        genreIds: copy.book.book_genres.map((bg) => bg.genre_id),
        onLoan: false,
        addedAt: copy.created_at,
      };
      byBook.set(copy.book_id, item);
    }
    if (!item.formats.includes(copy.format)) item.formats.push(copy.format);
    if (copy.platform && !item.platforms.includes(copy.platform))
      item.platforms.push(copy.platform);
    if (copy.location && !item.locations.includes(copy.location))
      item.locations.push(copy.location);
    if (copy.loans.some((l) => !l.returned_at)) item.onLoan = true;
    if (copy.created_at > item.addedAt) item.addedAt = copy.created_at;
  }
  return [...byBook.values()];
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Sobrenome para ordenar por autor ("Machado de Assis" → "Assis"). */
function authorSortKey(book: Book) {
  const first = book.authors[0];
  if (!first) return '￿';
  const parts = first.trim().split(/\s+/);
  return `${parts[parts.length - 1]} ${first}`;
}

export function applyFilters(
  items: ShelfBook[],
  filters: ShelfFilters,
  statusByBook: Map<string, ReadingStatus>,
): ShelfBook[] {
  const term = normalizeText(filters.search.trim());
  const filtered = items.filter(({ book, genreIds, platforms, locations }) => {
    if (term) {
      const haystack = normalizeText(
        [
          book.title,
          book.subtitle ?? '',
          book.authors.join(' '),
          book.isbn_13 ?? '',
          book.isbn_10 ?? '',
        ].join(' '),
      );
      // Busca por ISBN com hífens
      const digits = term.replace(/[^0-9x]/g, '');
      if (!haystack.includes(term) && !(digits.length >= 10 && haystack.includes(digits)))
        return false;
    }
    if (filters.genreIds.length && !filters.genreIds.some((g) => genreIds.includes(g)))
      return false;
    if (filters.author && !book.authors.includes(filters.author)) return false;
    if (filters.status) {
      const status = statusByBook.get(book.id);
      if (filters.status === 'unread' ? status === 'read' : status !== filters.status) return false;
    }
    if (filters.platform && !platforms.includes(filters.platform)) return false;
    if (filters.location && !locations.includes(filters.location)) return false;
    return true;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'title':
      sorted.sort((a, b) => collator.compare(a.book.title, b.book.title));
      break;
    case 'author':
      sorted.sort(
        (a, b) =>
          collator.compare(authorSortKey(a.book), authorSortKey(b.book)) ||
          collator.compare(a.book.title, b.book.title),
      );
      break;
    case 'year':
      sorted.sort((a, b) => (b.book.year ?? -1) - (a.book.year ?? -1));
      break;
    default:
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
  return sorted;
}

/** Valores distintos para os menus de filtro. */
export function facetValues(items: ShelfBook[]) {
  const authors = new Set<string>();
  const platforms = new Set<string>();
  const locations = new Set<string>();
  for (const item of items) {
    item.book.authors.forEach((a) => authors.add(a));
    item.platforms.forEach((p) => platforms.add(p));
    item.locations.forEach((l) => locations.add(l));
  }
  const sort = (values: Set<string>) => [...values].sort(collator.compare);
  return { authors: sort(authors), platforms: sort(platforms), locations: sort(locations) };
}

export function activeFilterCount(filters: ShelfFilters) {
  return (
    filters.genreIds.length +
    Number(!!filters.author) +
    Number(!!filters.status) +
    Number(!!filters.platform) +
    Number(!!filters.location)
  );
}
