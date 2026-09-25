import { parseIsbn } from '@shared/isbn.ts';

import type { BookInput, CopyInput, ReadingInput } from '@/lib/books';
import type { Book, BookData, CopyFormat, ReadingOrigin, ReadingStatus } from '@/types/models';

/** Estado do formulário (tudo texto, como o usuário digita). */
export type BookFormValues = {
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  year: string;
  pages: string;
  audioMinutes: string;
  language: string | null;
  isbn: string;
  coverUrl: string | null;
  source: BookInput['source'];
};

export type CopyFormValues = {
  format: CopyFormat;
  platform: string;
  location: string;
  condition: string | null;
  acquiredAt: string | null;
  price: string;
};

export type ReadingChoice = 'none' | ReadingStatus;

export type ReadingFormValues = {
  status: ReadingChoice;
  origin: ReadingOrigin;
  lentBy: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type FormErrors = Partial<
  Record<'title' | 'isbn' | 'year' | 'pages' | 'audioMinutes' | 'price', string>
>;

export const emptyBookForm = (): BookFormValues => ({
  title: '',
  subtitle: '',
  authors: '',
  publisher: '',
  year: '',
  pages: '',
  audioMinutes: '',
  language: 'pt',
  isbn: '',
  coverUrl: null,
  source: 'manual',
});

export const emptyCopyForm = (): CopyFormValues => ({
  format: 'physical',
  platform: '',
  location: '',
  condition: null,
  acquiredAt: null,
  price: '',
});

export const emptyReadingForm = (): ReadingFormValues => ({
  status: 'none',
  origin: 'own',
  lentBy: '',
  startedAt: null,
  finishedAt: null,
});

export function formFromData(data: BookData | null, isbn13?: string): BookFormValues {
  const base = emptyBookForm();
  if (!data) return { ...base, isbn: isbn13 ?? '' };
  return {
    ...base,
    title: data.title ?? '',
    subtitle: data.subtitle ?? '',
    authors: data.authors.join(', '),
    publisher: data.publisher ?? '',
    year: data.year ? String(data.year) : '',
    pages: data.pages ? String(data.pages) : '',
    language: data.language ?? base.language,
    isbn: isbn13 ?? data.isbn_13 ?? '',
    coverUrl: data.cover_url,
    source: data.source ?? 'manual',
  };
}

export function formFromBook(book: Book): BookFormValues {
  return {
    title: book.title,
    subtitle: book.subtitle ?? '',
    authors: book.authors.join(', '),
    publisher: book.publisher ?? '',
    year: book.year ? String(book.year) : '',
    pages: book.pages ? String(book.pages) : '',
    audioMinutes: book.audio_minutes ? String(book.audio_minutes) : '',
    language: book.language,
    isbn: book.isbn_13 ?? book.isbn_10 ?? '',
    coverUrl: book.cover_url,
    source: book.source,
  };
}

/** "Machado de Assis, José de Alencar; Clarice" → lista sem vazios/repetidos. */
export function parseAuthors(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[,;]| e (?=[A-ZÀ-Ý])/)
    .map((a) => a.trim().replace(/\s+/g, ' '))
    .filter((a) => {
      const key = a.toLowerCase();
      if (!a || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function optionalInt(text: string, min: number, max: number): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const n = Number(trimmed);
  return n >= min && n <= max ? n : 'invalid';
}

function optional(text: string): string | null {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed : null;
}

export function validateBook(values: BookFormValues): {
  input: BookInput | null;
  errors: FormErrors;
} {
  const errors: FormErrors = {};
  if (!values.title.trim()) errors.title = 'O título é obrigatório.';

  let isbn13: string | null = null;
  let isbn10: string | null = null;
  if (values.isbn.trim()) {
    const parsed = parseIsbn(values.isbn);
    if (!parsed) errors.isbn = 'ISBN inválido. Confira os dígitos.';
    else {
      isbn13 = parsed.isbn13;
      isbn10 = parsed.isbn10;
    }
  }

  const year = optionalInt(values.year, 1, new Date().getFullYear() + 1);
  if (year === 'invalid') errors.year = 'Ano inválido.';
  const pages = optionalInt(values.pages, 1, 20000);
  if (pages === 'invalid') errors.pages = 'Número de páginas inválido.';
  const audioMinutes = optionalInt(values.audioMinutes, 1, 100000);
  if (audioMinutes === 'invalid') errors.audioMinutes = 'Duração inválida.';

  if (Object.keys(errors).length > 0) return { input: null, errors };

  return {
    errors,
    input: {
      isbn_13: isbn13,
      isbn_10: isbn10,
      title: values.title.trim().replace(/\s+/g, ' '),
      subtitle: optional(values.subtitle),
      authors: parseAuthors(values.authors),
      publisher: optional(values.publisher),
      year: year as number | null,
      pages: pages as number | null,
      audio_minutes: audioMinutes as number | null,
      language: values.language,
      cover_url: values.coverUrl,
      source: values.source,
    },
  };
}

/** "39,90" / "R$ 1.234,50" → 39.9 / 1234.5 */
export function parsePrice(text: string): number | null | 'invalid' {
  const cleaned = text.replace(/R\$|\s/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 'invalid';
  return Number(normalized);
}

export function validateCopy(values: CopyFormValues): {
  input: CopyInput | null;
  errors: FormErrors;
} {
  const price = values.format === 'physical' ? parsePrice(values.price) : null;
  if (price === 'invalid') return { input: null, errors: { price: 'Valor inválido. Ex.: 39,90' } };
  const physical = values.format === 'physical';
  return {
    errors: {},
    input: {
      format: values.format,
      platform: physical ? null : optional(values.platform),
      location: physical ? optional(values.location) : null,
      condition: physical ? values.condition : null,
      acquired_at: values.acquiredAt,
      price,
    },
  };
}

export function toReadingInput(values: ReadingFormValues, hasCopy: boolean): ReadingInput | null {
  if (values.status === 'none') return null;
  const origin: ReadingOrigin = hasCopy
    ? 'own'
    : values.origin === 'own'
      ? 'borrowed'
      : values.origin;
  return {
    status: values.status,
    origin,
    lent_by: origin === 'borrowed' ? optional(values.lentBy) : null,
    started_at: values.status === 'reading' || values.status === 'read' ? values.startedAt : null,
    finished_at:
      values.status === 'read' || values.status === 'abandoned' ? values.finishedAt : null,
  };
}
