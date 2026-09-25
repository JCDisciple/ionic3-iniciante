import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCsv, buildJson, csvField, exportFileName, type ExportData } from './export.ts';
import { decodeText, parseCsv, toTable } from './import/csv.ts';
import { guessMapping, toRecord } from './import/mapping.ts';

const ts = { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const data: ExportData = {
  library: { id: 'L', name: 'Biblioteca dos Esteves' },
  members: [
    { id: 'm1', library_id: 'L', user_id: 'u', role: 'owner', display_name: 'Rodrigo', ...ts },
  ],
  genres: [{ id: 'g1', library_id: 'L', name: 'Clássicos', parent_id: null, ...ts }],
  books: [
    {
      id: 'b1',
      library_id: 'L',
      isbn_13: '9788535902778',
      isbn_10: null,
      title: 'Dom Casmurro',
      subtitle: null,
      authors: ['Machado de Assis'],
      publisher: 'Penguin; Companhia',
      year: 1899,
      pages: 256,
      audio_minutes: null,
      language: 'pt',
      cover_url: null,
      source: 'manual',
      book_genres: [{ genre_id: 'g1' }],
      ...ts,
    },
    {
      id: 'b2',
      library_id: 'L',
      isbn_13: null,
      isbn_10: null,
      title: 'Duna',
      subtitle: null,
      authors: ['Frank Herbert'],
      publisher: null,
      year: null,
      pages: null,
      audio_minutes: null,
      language: null,
      cover_url: null,
      source: 'import',
      book_genres: [],
      ...ts,
    },
  ],
  copies: [
    {
      id: 'c1',
      library_id: 'L',
      book_id: 'b1',
      format: 'physical',
      platform: null,
      location: 'Sala',
      condition: null,
      acquired_at: null,
      price: null,
      owner_member_id: null,
      status: 'active',
      ...ts,
    },
  ],
  loans: [],
  readings: [
    {
      id: 'r1',
      library_id: 'L',
      member_id: 'm1',
      book_id: 'b1',
      copy_id: 'c1',
      origin: 'own',
      lent_by: null,
      status: 'read',
      started_at: '2024-02-01',
      finished_at: '2024-03-01',
      rating: 5,
      review: 'Capitu, "olhos de ressaca";\nleiam!',
      ...ts,
    },
  ],
  progress: [],
  goals: [],
};

test('csvField escapa delimitador, aspas e quebras de linha', () => {
  assert.equal(csvField('a;b'), '"a;b"');
  assert.equal(csvField('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvField(null), '');
  assert.equal(csvField(42), '42');
});

test('CSV exportado é reimportável pelo próprio importador', () => {
  const csv = buildCsv(data);
  assert.ok(csv.startsWith('﻿Título;'));
  const table = toTable(parseCsv(decodeText(new TextEncoder().encode(csv))));
  assert.equal(table.rows.length, 2);
  const records = table.rows.map((row, i) => toRecord(row, guessMapping(table.headers), i));
  const dom = records.find((r) => r.title === 'Dom Casmurro')!;
  assert.equal(dom.isbn13, '9788535902778');
  assert.equal(dom.publisher, 'Penguin; Companhia');
  assert.equal(dom.status, 'read');
  assert.equal(dom.rating, 5);
  assert.equal(dom.started_at, '2024-02-01');
  assert.equal(dom.finished_at, '2024-03-01');
  assert.equal(dom.review, 'Capitu, "olhos de ressaca";\nleiam!');
  assert.equal(dom.owned, true);
  assert.equal(dom.format, 'physical');
  assert.deepEqual(dom.categories, ['Clássicos']);
  const duna = records.find((r) => r.title === 'Duna')!;
  assert.equal(duna.owned, false);
  assert.equal(duna.status, null);
});

test('JSON traz metadados e todas as tabelas', () => {
  const parsed = JSON.parse(buildJson(data, '2026-09-27T10:00:00Z'));
  assert.equal(parsed.format_version, 1);
  assert.equal(parsed.exported_at, '2026-09-27T10:00:00Z');
  assert.equal(parsed.books.length, 2);
  assert.equal(parsed.readings[0].review, data.readings[0].review);
});

test('nome do arquivo sem acentos', () => {
  assert.equal(
    exportFileName('Biblioteca dos Estêves!', 'csv', '2026-09-27'),
    'biblioteca-dos-esteves-2026-09-27.csv',
  );
});
