import { FORMAT_LABELS, READING_STATUS_LABELS, STATUS_LABELS } from '@/lib/labels';
import type {
  Book,
  Copy,
  Genre,
  Goal,
  LibraryMember,
  Loan,
  Reading,
  ReadingProgress,
} from '@/types/models';

/**
 * Exportação completa (o usuário nunca fica preso ao app):
 * - CSV: uma linha por leitura (ou por livro sem leitura), em colunas que o
 *   próprio importador reconhece — dá para reimportar em outra casa.
 * - JSON: todas as tabelas da biblioteca, com ids, para backup fiel.
 */

export type ExportData = {
  library: { id: string; name: string };
  members: LibraryMember[];
  books: (Book & { book_genres: { genre_id: string }[] })[];
  genres: Genre[];
  copies: Copy[];
  loans: Loan[];
  readings: Reading[];
  progress: ReadingProgress[];
  goals: Goal[];
};

export const CSV_COLUMNS = [
  'Título',
  'Subtítulo',
  'Autor',
  'ISBN',
  'Editora',
  'Ano',
  'Páginas',
  'Gêneros',
  'Formato',
  'Onde fica',
  'Tenho',
  'Leitor',
  'Situação',
  'Nota',
  'Data de início',
  'Data de término',
  'Resenha',
] as const;

/** Campo com ; , aspas ou quebra de linha vai entre aspas (aspas dobradas). */
export function csvField(value: string | number | null | undefined, delimiter = ';'): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /["\n\r]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

export function buildCsv(data: ExportData, delimiter = ';'): string {
  const genreName = new Map(data.genres.map((g) => [g.id, g.name]));
  const memberName = new Map(data.members.map((m) => [m.id, m.display_name]));
  const lines: string[] = [CSV_COLUMNS.join(delimiter)];

  const sortedBooks = [...data.books].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  for (const book of sortedBooks) {
    const copies = data.copies.filter((c) => c.book_id === book.id);
    const active = copies.filter((c) => c.status === 'active');
    const base = [
      book.title,
      book.subtitle,
      book.authors.join('; '),
      book.isbn_13 ?? book.isbn_10,
      book.publisher,
      book.year,
      book.pages,
      book.book_genres
        .map((bg) => genreName.get(bg.genre_id))
        .filter(Boolean)
        .join(', '),
      [...new Set(active.map((c) => FORMAT_LABELS[c.format]))].join(', ') ||
        [
          ...new Set(
            copies.map(
              (c) => `${FORMAT_LABELS[c.format]} (${STATUS_LABELS[c.status].toLowerCase()})`,
            ),
          ),
        ].join(', '),
      [...new Set(active.map((c) => c.location ?? c.platform).filter(Boolean))].join(', '),
      active.length > 0 ? 'sim' : 'não',
    ];
    const readings = data.readings
      .filter((r) => r.book_id === book.id)
      .sort((a, b) =>
        (a.finished_at ?? a.started_at ?? '').localeCompare(b.finished_at ?? b.started_at ?? ''),
      );
    const rows = readings.length
      ? readings.map((r) => [
          ...base,
          memberName.get(r.member_id) ?? '',
          READING_STATUS_LABELS[r.status],
          r.rating,
          br(r.started_at),
          br(r.finished_at),
          r.review,
        ])
      : [[...base, '', '', '', '', '', '']];
    for (const row of rows) lines.push(row.map((v) => csvField(v, delimiter)).join(delimiter));
  }
  // BOM para o Excel reconhecer UTF-8
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function buildJson(data: ExportData, exportedAt = new Date().toISOString()): string {
  return JSON.stringify(
    {
      app: 'Biblioteca e Leituras',
      format_version: 1,
      exported_at: exportedAt,
      ...data,
    },
    null,
    2,
  );
}

export function exportFileName(
  libraryName: string,
  extension: 'csv' | 'json',
  date: string,
): string {
  const slug = libraryName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'biblioteca'}-${date}.${extension}`;
}
