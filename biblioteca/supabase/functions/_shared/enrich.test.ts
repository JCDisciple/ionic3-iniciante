import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyBook } from './book-sources.ts';
import { enrichmentPatch } from './enrich.ts';

const book = { subtitle: null, authors: ['Machado de Assis'], publisher: 'Garnier', year: null, pages: null, language: null, cover_url: null };

test('preenche só o que está vazio', () => {
  const data = { ...emptyBook(), title: 'Dom Casmurro', authors: ['Outro'], publisher: 'Penguin', year: 2016, pages: 424, cover_url: 'https://capa', language: 'pt' };
  assert.deepEqual(enrichmentPatch(book, data), { cover_url: 'https://capa', pages: 424, year: 2016, language: 'pt' });
});

test('sem dados, nada muda', () => {
  assert.deepEqual(enrichmentPatch(book, null), {});
});
