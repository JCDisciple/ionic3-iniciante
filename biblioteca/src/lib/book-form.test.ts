import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  emptyBookForm,
  emptyCopyForm,
  emptyReadingForm,
  formFromData,
  parseAuthors,
  parsePrice,
  toReadingInput,
  validateBook,
  validateCopy,
} from './book-form.ts';

test('parseAuthors separa por vírgula, ponto e vírgula e " e "', () => {
  assert.deepEqual(parseAuthors('Machado de Assis, José de Alencar; Clarice Lispector'), [
    'Machado de Assis',
    'José de Alencar',
    'Clarice Lispector',
  ]);
  assert.deepEqual(parseAuthors('Neil Gaiman e Terry Pratchett'), [
    'Neil Gaiman',
    'Terry Pratchett',
  ]);
  assert.deepEqual(parseAuthors('Ana, ana,  '), ['Ana']);
  // " e " seguido de minúscula faz parte do nome
  assert.deepEqual(parseAuthors('Irmãos e irmãs'), ['Irmãos e irmãs']);
});

test('validateBook exige título e valida ISBN, ano e páginas', () => {
  const { errors } = validateBook({ ...emptyBookForm(), isbn: '123', year: 'abc', pages: '0' });
  assert.ok(errors.title && errors.isbn && errors.year && errors.pages);

  const { input } = validateBook({
    ...emptyBookForm(),
    title: '  Dom   Casmurro ',
    isbn: '85-359-0277-5',
    year: '1899',
    pages: '256',
    authors: 'Machado de Assis',
  });
  assert.equal(input!.title, 'Dom Casmurro');
  assert.equal(input!.isbn_13, '9788535902778');
  assert.equal(input!.isbn_10, '8535902775');
  assert.equal(input!.year, 1899);
  assert.equal(input!.subtitle, null);
});

test('formFromData preenche a partir da API e mantém o ISBN escaneado', () => {
  const values = formFromData(
    {
      isbn_13: '9780000000002',
      isbn_10: null,
      title: 'Livro',
      subtitle: null,
      authors: ['A', 'B'],
      publisher: 'Ed',
      year: 2020,
      pages: 100,
      language: 'en',
      cover_url: 'https://x',
      categories: [],
      source: 'google',
    },
    '9788535902778',
  );
  assert.equal(values.isbn, '9788535902778');
  assert.equal(values.authors, 'A, B');
  assert.equal(values.source, 'google');
  assert.equal(formFromData(null, '9788535902778').title, '');
});

test('parsePrice entende formato brasileiro', () => {
  assert.equal(parsePrice('39,90'), 39.9);
  assert.equal(parsePrice('R$ 1.234,50'), 1234.5);
  assert.equal(parsePrice('45'), 45);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('abc'), 'invalid');
});

test('validateCopy guarda só os campos do formato', () => {
  const ebook = validateCopy({
    ...emptyCopyForm(),
    format: 'ebook',
    platform: 'Kindle',
    location: 'Sala',
    price: '10',
  });
  assert.deepEqual(ebook.input, {
    format: 'ebook',
    platform: 'Kindle',
    location: null,
    condition: null,
    acquired_at: null,
    price: null,
  });
  assert.equal(
    validateCopy({ ...emptyCopyForm(), price: 'x' }).errors.price,
    'Valor inválido. Ex.: 39,90',
  );
});

test('toReadingInput: origem própria com exemplar, externa sem', () => {
  assert.equal(toReadingInput(emptyReadingForm(), true), null);
  const own = toReadingInput(
    { ...emptyReadingForm(), status: 'read', finishedAt: '2026-09-01' },
    true,
  )!;
  assert.equal(own.origin, 'own');
  assert.equal(own.finished_at, '2026-09-01');

  const borrowed = toReadingInput(
    {
      ...emptyReadingForm(),
      status: 'reading',
      origin: 'borrowed',
      lentBy: ' Ana ',
      startedAt: '2026-09-20',
    },
    false,
  )!;
  assert.equal(borrowed.origin, 'borrowed');
  assert.equal(borrowed.lent_by, 'Ana');
  assert.equal(borrowed.finished_at, null);

  const wantNoCopy = toReadingInput({ ...emptyReadingForm(), status: 'want' }, false)!;
  assert.equal(wantNoCopy.origin, 'borrowed');
});
