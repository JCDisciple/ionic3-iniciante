/**
 * Validação e conversão de ISBN. Código puro, sem dependências: usado pela
 * Edge Function (Deno) e pelo app (via alias @shared).
 */

export type Isbn = { isbn13: string; isbn10: string | null };

/** Mantém só dígitos e X (ISBN-10), aceitando hífens e espaços na entrada. */
export function cleanIsbn(input: string): string {
  return input.replace(/[^0-9xX]/g, '').toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = isbn[i] === 'X' ? 10 : Number(isbn[i]);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(isbn)) return false;
  return isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];
}

function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isbn10To13(isbn10: string): string {
  const base = `978${isbn10.slice(0, 9)}`;
  return base + isbn13CheckDigit(base);
}

/** Só ISBN-13 com prefixo 978 tem equivalente ISBN-10. */
export function isbn13To10(isbn13: string): string | null {
  if (!isbn13.startsWith('978')) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

/** Aceita ISBN-10 ou 13 (com ou sem hífens) e devolve as duas formas, ou null. */
export function parseIsbn(input: string): Isbn | null {
  const isbn = cleanIsbn(input);
  if (isbn.length === 13 && isValidIsbn13(isbn)) return { isbn13: isbn, isbn10: isbn13To10(isbn) };
  if (isbn.length === 10 && isValidIsbn10(isbn)) return { isbn13: isbn10To13(isbn), isbn10: isbn };
  return null;
}

/** Código EAN-13 lido pela câmera que é um ISBN válido (prefixo 978/979). */
export function isBookBarcode(code: string): boolean {
  return /^97[89][0-9]{10}$/.test(code) && isValidIsbn13(code);
}

/** 9788535902778 → 978-85-359-0277-8 não é trivial (depende do grupo); exibimos em blocos. */
export function formatIsbn(isbn13: string): string {
  return `${isbn13.slice(0, 3)}-${isbn13.slice(3, 12)}-${isbn13.slice(12)}`;
}
