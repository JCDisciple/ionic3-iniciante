import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyFilters,
  defaultFilters,
  facetValues,
  groupShelf,
  type ShelfCopyLike,
} from './shelf.ts';

function book(
  id: string,
  title: string,
  authors: string[],
  year: number | null,
  genres: string[] = [],
) {
  return {
    id,
    library_id: 'L',
    isbn_13: id === 'b1' ? '9788535902778' : null,
    isbn_10: null,
    title,
    subtitle: null,
    authors,
    publisher: null,
    year,
    pages: null,
    audio_minutes: null,
    language: null,
    cover_url: null,
    source: 'manual' as const,
    created_at: '',
    updated_at: '',
    book_genres: genres.map((genre_id) => ({ genre_id })),
  };
}

const b1 = book('b1', 'Dom Casmurro', ['Machado de Assis'], 1899, ['romance']);
const b2 = book('b2', 'Ébano', ['Ryszard Kapuściński'], 1998, ['viagem']);
const b3 = book('b3', 'A hora da estrela', ['Clarice Lispector'], 1977, ['romance', 'br']);

const copy = (id: string, b: typeof b1, extra: Partial<ShelfCopyLike> = {}): ShelfCopyLike => ({
  id,
  book_id: b.id,
  format: 'physical',
  platform: null,
  location: null,
  created_at: `2026-09-0${id.slice(1)}`,
  book: b,
  loans: [],
  ...extra,
});

const copies = [
  copy('c1', b1, { location: 'Sala' }),
  copy('c2', b1, { format: 'ebook', platform: 'Kindle' }),
  copy('c3', b2, { location: 'Quarto', loans: [{ returned_at: null, due_at: '2026-09-01' }] }),
  copy('c4', b3, { format: 'audiobook', platform: 'Audible' }),
];

test('groupShelf separa Física / Online / Tudo e agrupa por livro', () => {
  assert.deepEqual(
    groupShelf(copies, 'physical').map((i) => i.book.id),
    ['b1', 'b2'],
  );
  assert.deepEqual(
    groupShelf(copies, 'online').map((i) => i.book.id),
    ['b1', 'b3'],
  );
  const all = groupShelf(copies, 'all');
  assert.equal(all.length, 3);
  const dom = all.find((i) => i.book.id === 'b1')!;
  assert.deepEqual(dom.formats, ['physical', 'ebook']);
  assert.equal(dom.addedAt, '2026-09-02');
  assert.equal(all.find((i) => i.book.id === 'b2')!.onLoan, true);
});

test('busca ignora acentos e aceita ISBN com hífens', () => {
  const items = groupShelf(copies, 'all');
  const f = defaultFilters();
  assert.deepEqual(
    applyFilters(items, { ...f, search: 'ebano' }, new Map()).map((i) => i.book.id),
    ['b2'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, search: 'kapuscinski' }, new Map()).map((i) => i.book.id),
    ['b2'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, search: '978-85-359-0277-8' }, new Map()).map((i) => i.book.id),
    ['b1'],
  );
});

test('filtros de gênero, autor, status, plataforma e local', () => {
  const items = groupShelf(copies, 'all');
  const f = defaultFilters();
  const status = new Map([
    ['b1', 'read' as const],
    ['b3', 'reading' as const],
  ]);
  assert.deepEqual(
    applyFilters(items, { ...f, genreIds: ['romance'], sort: 'title' }, status).map(
      (i) => i.book.id,
    ),
    ['b3', 'b1'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, author: 'Clarice Lispector' }, status).map((i) => i.book.id),
    ['b3'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, status: 'reading' }, status).map((i) => i.book.id),
    ['b3'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, status: 'unread', sort: 'title' }, status).map((i) => i.book.id),
    ['b3', 'b2'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, platform: 'Kindle' }, status).map((i) => i.book.id),
    ['b1'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, location: 'Quarto' }, status).map((i) => i.book.id),
    ['b2'],
  );
});

test('ordenação por título (pt-BR), autor (sobrenome), ano e recentes', () => {
  const items = groupShelf(copies, 'all');
  const f = defaultFilters();
  assert.deepEqual(
    applyFilters(items, { ...f, sort: 'title' }, new Map()).map((i) => i.book.title),
    ['A hora da estrela', 'Dom Casmurro', 'Ébano'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, sort: 'author' }, new Map()).map((i) => i.book.id),
    ['b1', 'b2', 'b3'],
  );
  assert.deepEqual(
    applyFilters(items, { ...f, sort: 'year' }, new Map()).map((i) => i.book.year),
    [1998, 1977, 1899],
  );
  assert.deepEqual(
    applyFilters(items, f, new Map()).map((i) => i.book.id),
    ['b3', 'b2', 'b1'],
  );
});

test('facetValues lista autores, plataformas e locais', () => {
  const facets = facetValues(groupShelf(copies, 'all'));
  assert.deepEqual(facets.platforms, ['Audible', 'Kindle']);
  assert.deepEqual(facets.locations, ['Quarto', 'Sala']);
  assert.equal(facets.authors.length, 3);
});
