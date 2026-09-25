import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCsv, toTable } from './csv.ts';
import {
  cleanCell,
  detectSource,
  guessMapping,
  parseAuthors,
  parseDate,
  parseFormat,
  parseGenres,
  parseOwned,
  parseRating,
  parseStatus,
  splitTitle,
  toRecord,
} from './mapping.ts';
import { planImport, summarize, toRpcRow } from './plan.ts';

// Cabeçalho oficial da exportação do Goodreads (Minha estante → Exportar)
const GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
2767052,"The Hunger Games (The Hunger Games, #1)",Suzanne Collins,"Collins, Suzanne",,"=""0439023483""","=""9780439023481""",4,4.33,Scholastic Press,Hardcover,374,2008,2008,2023/05/14,2023/01/02,"dystopian, young-adult, favorites","dystopian (#3)",read,"Muito bom.<br/>Recomendo",,,1,1
44767458,Dune,Frank Herbert,"Herbert, Frank",,"=""""","=""""",0,4.27,Ace,Kindle Edition,688,2019,1965,,2024/02/10,to-read,,to-read,,,,0,0
13079982,"Fahrenheit 451",Ray Bradbury,"Bradbury, Ray",,"=""1451673310""","=""9781451673319""",5,3.97,Simon & Schuster,Paperback,249,2012,1953,2022/11/30,2022/11/01,,,read,,,,1,0
`;

test('reconhece o CSV do Goodreads e mapeia as colunas oficiais', () => {
  const table = toTable(parseCsv(GOODREADS));
  assert.equal(detectSource(table.headers), 'goodreads');
  const m = guessMapping(table.headers);
  const name = (key: keyof typeof m) => (m[key] === null ? null : table.headers[m[key]!]);
  assert.equal(name('title'), 'Title');
  assert.equal(name('authors'), 'Author');
  assert.equal(name('isbn'), 'ISBN13');
  assert.equal(name('isbn_alt'), 'ISBN');
  assert.equal(name('status'), 'Exclusive Shelf');
  assert.equal(name('finished_at'), 'Date Read');
  assert.equal(name('owned'), 'Owned Copies');
  assert.equal(name('format'), 'Binding');
  assert.equal(name('year'), 'Year Published');
  assert.equal(name('genres'), 'Bookshelves');

  const records = table.rows.map((row, i) => toRecord(row, m, i));
  const [hunger, dune, fahrenheit] = records;
  assert.equal(hunger.title, 'The Hunger Games');
  assert.equal(hunger.subtitle, 'The Hunger Games, #1');
  assert.equal(hunger.isbn13, '9780439023481');
  assert.equal(hunger.status, 'read');
  assert.equal(hunger.finished_at, '2023-05-14');
  assert.equal(hunger.rating, 4);
  assert.equal(hunger.owned, true);
  assert.equal(hunger.format, 'physical');
  assert.equal(hunger.review, 'Muito bom.\nRecomendo');
  assert.deepEqual(hunger.categories, ['dystopian', 'young adult']);
  assert.equal(dune.isbn13, null);
  assert.equal(dune.status, 'want');
  assert.equal(dune.rating, null);
  assert.equal(dune.format, 'ebook');
  assert.equal(dune.owned, false);
  assert.equal(fahrenheit.owned, false);
});

test('planilha em português com ponto e vírgula', () => {
  const csv =
    'Título;Autor;Editora;Ano;Páginas;Situação;Nota;Data de término;Tenho\n' +
    'Dom Casmurro;Assis, Machado de;Garnier;1899;256;Lido;9;15/03/2024;sim\n' +
    'Torto Arado;Itamar Vieira Junior;Todavia;2019;264;Quero ler;;;não\n' +
    ';Sem título;;;;;;;\n';
  const table = toTable(parseCsv(csv));
  assert.equal(detectSource(table.headers), null);
  const m = guessMapping(table.headers);
  const [dom, torto, vazio] = table.rows.map((row, i) => toRecord(row, m, i));
  assert.deepEqual(dom.authors, ['Machado de Assis']);
  assert.equal(dom.rating, 5); // 9/10 → 4,5 → 5
  assert.equal(dom.finished_at, '2024-03-15');
  assert.equal(dom.owned, true);
  assert.equal(torto.status, 'want');
  assert.equal(torto.owned, false);
  assert.deepEqual(vazio.errors, ['Sem título']);
});

test('conversores de valor', () => {
  assert.equal(cleanCell('="9780439023481"'), '9780439023481');
  assert.equal(parseStatus('currently-reading'), 'reading');
  assert.equal(parseStatus('Relendo'), 'reading');
  assert.equal(parseStatus('Abandonei'), 'abandoned');
  assert.equal(parseStatus('Já li'), 'read');
  assert.equal(parseStatus('ficção'), null);
  assert.equal(parseRating('0'), null);
  assert.equal(parseRating('4,5'), 5);
  assert.equal(parseRating('3'), 3);
  assert.equal(parseDate('2023/05/14'), '2023-05-14');
  assert.equal(parseDate('5/1/2024'), '2024-01-05');
  assert.equal(parseDate('2019'), '2019-12-31');
  assert.equal(parseDate('45000'), '2023-03-15');
  assert.equal(parseDate('31/02/2024'), null);
  assert.equal(parseOwned('2'), true);
  assert.equal(parseOwned('Não'), false);
  assert.equal(parseFormat('Audible Audio'), 'audiobook');
  assert.equal(parseFormat('Kindle Unlimited'), 'subscription');
  assert.equal(parseFormat('Mass Market Paperback'), 'physical');
  assert.deepEqual(parseAuthors('Neil Gaiman & Terry Pratchett'), [
    'Neil Gaiman',
    'Terry Pratchett',
  ]);
  assert.deepEqual(parseAuthors('Machado de Assis, José de Alencar'), [
    'Machado de Assis',
    'José de Alencar',
  ]);
  assert.deepEqual(parseGenres('to-read, sci-fi; clássicos'), ['sci fi', 'clássicos']);
  assert.deepEqual(splitTitle('Grande Sertão: Veredas'), {
    title: 'Grande Sertão: Veredas',
    subtitle: null,
  });
  assert.deepEqual(splitTitle('Mistborn (Mistborn, #1)'), {
    title: 'Mistborn',
    subtitle: 'Mistborn, #1',
  });
});

test('plano: duplicados no acervo e no arquivo, ações padrão e linhas para a RPC', () => {
  const csv =
    'Título,Autor,ISBN,Situação,Tenho,Data de término,Data de início\n' +
    'Dom Casmurro,Machado de Assis,9788535902778,Lido,,2024-03-01,2024-02-01\n' +
    'Duna,Frank Herbert,,Lido,,2024-01-10,2024-02-01\n' +
    'dom casmurro,Machado de Assis,,Lido,,,\n' +
    'Sapiens,Yuval Noah Harari,,,sim,,\n' +
    'Ébano,Ryszard Kapuściński,,,,,\n' +
    'Torto Arado,Itamar Vieira Junior,,,,,\n';
  const table = toTable(parseCsv(csv));
  const records = table.rows.map((row, i) => toRecord(row, guessMapping(table.headers), i));
  const existing = [
    { id: 'b-dom', title: 'Dom Casmurro', authors: ['Machado de Assis'], isbn_13: '9788535902778' },
    { id: 'b-torto', title: 'Torto Arado', authors: ['Itamar Vieira Junior'], isbn_13: null },
  ];
  const plan = planImport(records, existing, 'reading');
  assert.deepEqual(
    plan.map((r) => [r.record.title, r.action, r.existingBookId, r.duplicateOfIndex]),
    [
      ['Dom Casmurro', 'reading', 'b-dom', null], // já no acervo, com leitura → só leitura
      ['Duna', 'reading', null, null],
      ['dom casmurro', 'skip', 'b-dom', 0], // repetido no arquivo
      ['Sapiens', 'copy', null, null], // "Tenho: sim"
      ['Ébano', 'reading', null, null], // padrão escolhido
      ['Torto Arado', 'skip', 'b-torto', null], // já no acervo, sem leitura → nada a fazer
    ],
  );
  assert.deepEqual(summarize(plan), {
    total: 6,
    copies: 1,
    readings: 3,
    skipped: 2,
    inLibrary: 3,
    duplicatesInFile: 1,
    invalid: 0,
  });

  const dom = toRpcRow(plan[0], ['g1']);
  assert.deepEqual(dom.book, { id: 'b-dom' });
  assert.deepEqual(dom.genre_ids, []);
  assert.equal(dom.reading!.origin, 'no_longer_owned');

  const duna = toRpcRow(plan[1], []);
  assert.equal(duna.reading!.started_at, null); // início depois do fim foi descartado
  assert.equal(duna.reading!.finished_at, '2024-01-10');

  const sapiens = toRpcRow(plan[3], ['g2']);
  assert.deepEqual(sapiens.copy, { format: 'physical' });
  assert.equal(sapiens.reading, null);
  assert.equal(sapiens.book.source, 'import');

  const ebano = toRpcRow(plan[4], []);
  assert.equal(ebano.reading!.status, 'read'); // "só leitura" sem situação = lido
});
