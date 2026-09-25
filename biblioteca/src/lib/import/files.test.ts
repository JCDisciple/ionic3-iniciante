import assert from 'node:assert/strict';
import { test } from 'node:test';

import { strToU8, zipSync } from 'fflate';

import { decodeText, detectDelimiter, parseCsv, toTable } from './csv.ts';
import { columnIndex, readXlsx } from './xlsx.ts';

test('parseCsv lida com aspas, aspas escapadas, quebras de linha e CRLF', () => {
  const text =
    'Title,Author,My Review\r\n"Dom Casmurro","Assis, Machado de","Capitu ""olhos de ressaca""\nfim"\r\nDuna,Frank Herbert,\r\n\r\n';
  assert.deepEqual(parseCsv(text), [
    ['Title', 'Author', 'My Review'],
    ['Dom Casmurro', 'Assis, Machado de', 'Capitu "olhos de ressaca"\nfim'],
    ['Duna', 'Frank Herbert', ''],
  ]);
});

test('detecta ponto e vírgula (Excel pt-BR) e tab', () => {
  assert.equal(detectDelimiter('Título;Autor;Nota\nA;B;5'), ';');
  assert.equal(detectDelimiter('a\tb\tc'), '\t');
  assert.equal(detectDelimiter('"a;b",c,d'), ',');
});

test('decodeText aceita UTF-8 com BOM e cai para Windows-1252', () => {
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x43, 0xc3, 0xa9, 0x75])), 'Céu');
  assert.equal(decodeText(new Uint8Array([0x43, 0xe9, 0x75, 0x20, 0x93, 0x61, 0x94])), 'Céu “a”');
});

test('toTable completa colunas e renomeia cabeçalhos repetidos ou vazios', () => {
  assert.deepEqual(
    toTable([
      ['Título', '', 'Título'],
      ['A', 'B'],
      ['C', 'D', 'E', 'F'],
    ]),
    {
      headers: ['Título', 'Coluna 2', 'Título (2)', 'Coluna 4'],
      rows: [
        ['A', 'B', '', ''],
        ['C', 'D', 'E', 'F'],
      ],
    },
  );
});

test('readXlsx lê strings compartilhadas, inline, números e células puladas', () => {
  const xlsx = zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="Livros" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      '<sst><si><t>Título</t></si><si><t>Páginas</t></si><si><r><t>Dom </t></r><r><t>Casmurro &amp; cia</t></r></si></sst>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="inlineStr"><is><t>x</t></is></c><c r="C2"><v>256</v></c></row>' +
        '<row r="3"/>' +
        '</sheetData></worksheet>',
    ),
  });
  assert.deepEqual(readXlsx(xlsx), [
    ['Título', '', 'Páginas'],
    ['Dom Casmurro & cia', 'x', '256'],
  ]);
  assert.equal(columnIndex('AB12'), 27);
});
