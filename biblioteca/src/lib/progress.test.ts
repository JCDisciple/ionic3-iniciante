import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  defaultUnit,
  describe,
  fractionOf,
  latest,
  parseProgress,
  reachedEnd,
} from './progress.ts';

const book = { pages: 400, audio_minutes: 600 };

test('unidade padrão segue o formato do exemplar', () => {
  assert.equal(defaultUnit('physical', book), 'page');
  assert.equal(defaultUnit('ebook', book), 'percent');
  assert.equal(defaultUnit('audiobook', book), 'minutes');
  assert.equal(defaultUnit(null, { pages: null, audio_minutes: null }), 'percent');
});

test('fração e descrição', () => {
  assert.equal(fractionOf({ date: 'x', page: 100, percent: null, minutes: null }, book), 0.25);
  assert.equal(fractionOf({ date: 'x', page: null, percent: 50, minutes: null }, book), 0.5);
  assert.equal(fractionOf({ date: 'x', page: null, percent: null, minutes: 900 }, book), 1);
  assert.equal(fractionOf(null, book), 0);
  assert.equal(
    describe({ date: 'x', page: 120, percent: null, minutes: null }, book),
    'Página 120 de 400',
  );
  assert.equal(
    describe({ date: 'x', page: null, percent: null, minutes: 95 }, book),
    '1h35 de 10h',
  );
  assert.equal(describe({ date: 'x', page: null, percent: 33.3, minutes: null }, book), '33%');
});

test('latest pega o registro mais recente', () => {
  const rows = [
    { date: '2026-09-01', page: 10, percent: null, minutes: null },
    { date: '2026-09-10', page: 50, percent: null, minutes: null },
    { date: '2026-09-05', page: 30, percent: null, minutes: null },
  ];
  assert.equal(latest(rows)!.page, 50);
  assert.equal(latest([]), null);
});

test('parseProgress valida por unidade', () => {
  assert.deepEqual(parseProgress('120', 'page', book).input, {
    page: 120,
    percent: null,
    minutes: null,
  });
  assert.equal(parseProgress('500', 'page', book).error, 'O livro tem 400 páginas.');
  assert.equal(parseProgress('12,5', 'page', book).error, 'Use um número inteiro.');
  assert.deepEqual(parseProgress('42,5', 'percent', book).input, {
    page: null,
    percent: 42.5,
    minutes: null,
  });
  assert.equal(parseProgress('120', 'percent', book).error, 'A porcentagem vai até 100.');
  assert.equal(parseProgress('abc', 'minutes', book).error, 'Digite um número.');
  assert.equal(reachedEnd({ page: 400, percent: null, minutes: null }, book), true);
  assert.equal(reachedEnd({ page: 399, percent: null, minutes: null }, book), false);
});
