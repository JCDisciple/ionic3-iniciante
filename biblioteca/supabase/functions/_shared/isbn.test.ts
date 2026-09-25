import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cleanIsbn,
  isBookBarcode,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  isbn13To10,
  parseIsbn,
} from './isbn.ts';

test('valida dígito verificador do ISBN-13', () => {
  assert.equal(isValidIsbn13('9788535902778'), true);
  assert.equal(isValidIsbn13('9788535902779'), false);
  assert.equal(isValidIsbn13('9791032305690'), true);
  assert.equal(isValidIsbn13('1234567890128'), false); // EAN que não é livro
});

test('valida dígito verificador do ISBN-10, inclusive X', () => {
  assert.equal(isValidIsbn10('8535902775'), true);
  assert.equal(isValidIsbn10('8535902776'), false);
  assert.equal(isValidIsbn10('080442957X'), true);
});

test('converte entre ISBN-10 e ISBN-13', () => {
  assert.equal(isbn10To13('8535902775'), '9788535902778');
  assert.equal(isbn13To10('9788535902778'), '8535902775');
  assert.equal(isbn13To10('9780804429573'), '080442957X');
  assert.equal(isbn13To10('9791032305690'), null);
});

test('parseIsbn aceita hífens e espaços e devolve as duas formas', () => {
  assert.equal(cleanIsbn('978-85-359-0277-8'), '9788535902778');
  assert.deepEqual(parseIsbn('978-85-359-0277-8'), {
    isbn13: '9788535902778',
    isbn10: '8535902775',
  });
  assert.deepEqual(parseIsbn('85 359 0277 5'), { isbn13: '9788535902778', isbn10: '8535902775' });
  assert.deepEqual(parseIsbn('0-8044-2957-x'), { isbn13: '9780804429573', isbn10: '080442957X' });
  assert.equal(parseIsbn('9788535902779'), null);
  assert.equal(parseIsbn('abc'), null);
});

test('isBookBarcode aceita só EAN-13 de livro', () => {
  assert.equal(isBookBarcode('9788535902778'), true);
  assert.equal(isBookBarcode('7891000315507'), false); // produto de mercado
  assert.equal(isBookBarcode('978853590277'), false);
});
