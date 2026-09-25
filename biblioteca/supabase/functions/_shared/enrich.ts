import type { BookData } from './book-sources.ts';

export type EnrichableBook = {
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  year: number | null;
  pages: number | null;
  language: string | null;
  cover_url: string | null;
};

/**
 * Campos a preencher num livro importado a partir dos metadados encontrados:
 * só completa o que está vazio, nunca sobrescreve o que veio do arquivo.
 */
export function enrichmentPatch(book: EnrichableBook, data: BookData | null): Partial<EnrichableBook> {
  if (!data) return {};
  const patch: Partial<EnrichableBook> = {};
  if (!book.cover_url && data.cover_url) patch.cover_url = data.cover_url;
  if (!book.pages && data.pages) patch.pages = data.pages;
  if (!book.publisher && data.publisher) patch.publisher = data.publisher;
  if (!book.year && data.year) patch.year = data.year;
  if (!book.language && data.language) patch.language = data.language;
  if (!book.subtitle && data.subtitle) patch.subtitle = data.subtitle;
  if (book.authors.length === 0 && data.authors.length > 0) patch.authors = data.authors;
  return patch;
}
