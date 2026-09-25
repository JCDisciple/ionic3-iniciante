import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fixCase,
  isComplete,
  lookupIsbn,
  parseBrasilApi,
  parseGoogleResponse,
  parseOpenLibraryResponse,
  parseOpenLibrarySearchDoc,
  parseYear,
  searchBooks,
  sourceUrls,
  type FetchLike,
} from './book-sources.ts';

const ISBN = '9788535902778';

const brasilApi = {
  isbn: ISBN,
  title: 'DOM CASMURRO',
  subtitle: null,
  authors: ['MACHADO DE ASSIS'],
  publisher: 'PENGUIN-COMPANHIA',
  synopsis: '…',
  year: 2016,
  format: 'PHYSICAL',
  page_count: 424,
  subjects: ['Ficção brasileira', 'Romance'],
  location: 'SÃO PAULO, SP',
  retail_price: null,
  cover_url: null,
  provider: 'cbl',
};

const google = {
  totalItems: 1,
  items: [
    {
      volumeInfo: {
        title: 'Dom Casmurro',
        authors: ['Machado de Assis'],
        publisher: 'Penguin',
        publishedDate: '2016-05-01',
        pageCount: 400,
        categories: ['Fiction / Literary'],
        language: 'pt-BR',
        imageLinks: {
          smallThumbnail:
            'http://books.google.com/books/content?id=X&printsec=frontcover&img=1&zoom=5&edge=curl',
          thumbnail:
            'http://books.google.com/books/content?id=X&printsec=frontcover&img=1&zoom=1&edge=curl',
        },
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: '8535902775' },
          { type: 'ISBN_13', identifier: ISBN },
        ],
      },
    },
  ],
};

const openLibrary = {
  [`ISBN:${ISBN}`]: {
    title: 'Dom Casmurro',
    authors: [{ name: 'Machado de Assis' }],
    publishers: [{ name: 'Companhia das Letras' }],
    publish_date: '2016',
    number_of_pages: 424,
    subjects: [{ name: 'Brazilian fiction' }],
    cover: {
      medium: 'https://covers.openlibrary.org/b/id/1-M.jpg',
      large: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    },
    identifiers: { isbn_13: [ISBN] },
  },
};

function fakeFetch(responses: Record<string, unknown>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const key = Object.keys(responses).find((prefix) => url.startsWith(prefix));
    if (!key || responses[key] === undefined)
      return { ok: false, status: 404, json: async () => ({}) };
    if (responses[key] instanceof Error) throw responses[key];
    return { ok: true, status: 200, json: async () => responses[key] };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const urls = sourceUrls(ISBN);

test('fixCase corrige textos todos em maiúsculas', () => {
  assert.equal(fixCase('MACHADO DE ASSIS'), 'Machado de Assis');
  assert.equal(fixCase('O ALIENISTA'), 'O Alienista');
  assert.equal(fixCase('iPhone para Leigos'), 'iPhone para Leigos');
});

test('parseYear extrai o ano de formatos variados', () => {
  assert.equal(parseYear('2016-05-01'), 2016);
  assert.equal(parseYear('May 1999'), 1999);
  assert.equal(parseYear('c1987'), 1987);
  assert.equal(parseYear(2001), 2001);
  assert.equal(parseYear('s.d.'), null);
});

test('normaliza BrasilAPI', () => {
  const book = parseBrasilApi(brasilApi)!;
  assert.equal(book.title, 'Dom Casmurro');
  assert.deepEqual(book.authors, ['Machado de Assis']);
  assert.equal(book.publisher, 'Penguin-companhia');
  assert.equal(book.pages, 424);
  assert.equal(book.year, 2016);
  assert.equal(book.isbn_10, '8535902775');
  assert.deepEqual(book.categories, ['Ficção brasileira', 'Romance']);
  assert.equal(book.cover_url, null);
  assert.equal(parseBrasilApi({ message: 'ISBN não encontrado' }), null);
});

test('normaliza Google Books (capa em https, sem edge=curl)', () => {
  const book = parseGoogleResponse(google)!;
  assert.equal(
    book.cover_url,
    'https://books.google.com/books/content?id=X&printsec=frontcover&img=1&zoom=1',
  );
  assert.equal(book.language, 'pt');
  assert.equal(book.year, 2016);
  assert.deepEqual(book.categories, ['Fiction / Literary']);
  assert.equal(parseGoogleResponse({ totalItems: 0 }), null);
});

test('normaliza Open Library', () => {
  const book = parseOpenLibraryResponse(openLibrary, ISBN)!;
  assert.equal(book.cover_url, 'https://covers.openlibrary.org/b/id/1-L.jpg');
  assert.equal(book.publisher, 'Companhia das Letras');
  assert.deepEqual(book.categories, ['Brazilian fiction']);
  assert.equal(parseOpenLibraryResponse({}, ISBN), null);
});

test('cascata: BrasilAPI vence, Google completa capa; Open Library não é usada', async () => {
  const fetch = fakeFetch({
    [urls.brasilapi]: brasilApi,
    [urls.google]: google,
    [urls.openlibrary]: openLibrary,
  });
  const book = (await lookupIsbn(ISBN, { fetch }))!;
  assert.equal(book.source, 'brasilapi');
  assert.equal(book.pages, 424); // BrasilAPI, não Google (400)
  assert.equal(book.publisher, 'Penguin-companhia');
  assert.match(book.cover_url!, /books\.google\.com/);
  assert.deepEqual(book.categories, ['Ficção brasileira', 'Romance']);
  assert.equal(book.language, 'pt');
  assert.equal(isComplete(book), true);
});

test('cascata: sem BrasilAPI, Google vira a fonte', async () => {
  const fetch = fakeFetch({ [urls.google]: google, [urls.openlibrary]: openLibrary });
  const book = (await lookupIsbn(ISBN, { fetch }))!;
  assert.equal(book.source, 'google');
  assert.equal(book.pages, 400);
});

test('cascata: fonte com erro de rede é ignorada', async () => {
  const fetch = fakeFetch({
    [urls.brasilapi]: new Error('timeout'),
    [urls.openlibrary]: openLibrary,
  });
  const book = (await lookupIsbn(ISBN, { fetch }))!;
  assert.equal(book.source, 'openlibrary');
  assert.equal(book.isbn_13, ISBN);
});

test('cascata: nenhuma fonte achou → null', async () => {
  assert.equal(await lookupIsbn(ISBN, { fetch: fakeFetch({}) }), null);
});

test('cascata: sem capa em nenhuma fonte, usa a capa por ISBN da Open Library', async () => {
  const fetch = fakeFetch({ [urls.brasilapi]: brasilApi });
  const book = (await lookupIsbn(ISBN, { fetch }))!;
  assert.equal(book.cover_url, `https://covers.openlibrary.org/b/isbn/${ISBN}-L.jpg?default=false`);
});

test('chave do Google vai na URL quando configurada', () => {
  assert.match(sourceUrls(ISBN, 'abc').google, /&key=abc$/);
});

test('busca por título junta Google e Open Library sem repetir', async () => {
  const fetch = fakeFetch({
    'https://www.googleapis.com/books/v1/volumes?q=': google,
    'https://openlibrary.org/search.json': {
      docs: [
        { title: 'Dom Casmurro', author_name: ['Machado de Assis'], isbn: [ISBN] },
        {
          title: 'Memórias Póstumas de Brás Cubas',
          author_name: ['Machado de Assis'],
          isbn: ['0195101707', '9788535910667'],
          cover_i: 42,
        },
      ],
    },
  });
  const results = await searchBooks('machado de assis', { fetch });
  assert.equal(results.length, 2);
  assert.equal(results[0].source, 'google');
  assert.equal(results[1].isbn_13, '9788535910667'); // prefere edição brasileira
  assert.equal(results[1].cover_url, 'https://covers.openlibrary.org/b/id/42-L.jpg');
});

test('parseOpenLibrarySearchDoc ignora documento sem título', () => {
  assert.equal(parseOpenLibrarySearchDoc({ author_name: ['x'] }), null);
});
