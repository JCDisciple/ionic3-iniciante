import { normalizeHeader, type ImportRecord } from '@/lib/import/mapping';
import type { ReadingOrigin } from '@/types/models';

/**
 * Prévia da importação: detecta duplicados (no acervo e dentro do próprio
 * arquivo) por ISBN ou título + autor e decide o que fazer com cada linha.
 */

/** 'copy' = entra no acervo como exemplar; 'reading' = só a leitura; 'skip' = ignora. */
export type RowAction = 'copy' | 'reading' | 'skip';

export type ExistingBook = { id: string; title: string; authors: string[]; isbn_13: string | null };

export type PlannedRow = {
  record: ImportRecord;
  /** Livro do acervo que corresponde a esta linha. */
  existingBookId: string | null;
  /** Linha anterior do arquivo com o mesmo livro. */
  duplicateOfIndex: number | null;
  action: RowAction;
};

export function bookKey(title: string, authors: string[]): string {
  return `${normalizeHeader(title)}|${normalizeHeader(authors[0] ?? '')}`;
}

export function planImport(
  records: ImportRecord[],
  existing: ExistingBook[],
  defaultAction: Exclude<RowAction, 'skip'>,
): PlannedRow[] {
  const byIsbn = new Map(existing.filter((b) => b.isbn_13).map((b) => [b.isbn_13!, b.id]));
  const byTitle = new Map(existing.map((b) => [bookKey(b.title, b.authors), b.id]));
  const seenInFile = new Map<string, number>();

  return records.map((record) => {
    const keys = [record.isbn13, bookKey(record.title, record.authors)].filter(Boolean) as string[];
    const existingBookId =
      (record.isbn13 && byIsbn.get(record.isbn13)) ||
      byTitle.get(bookKey(record.title, record.authors)) ||
      null;
    const duplicateOfIndex =
      keys.map((k) => seenInFile.get(k)).find((i) => i !== undefined) ?? null;
    keys.forEach((k) => !seenInFile.has(k) && seenInFile.set(k, record.index));

    let action: RowAction;
    if (record.errors.length > 0 || duplicateOfIndex !== null) action = 'skip';
    else if (existingBookId) action = record.status ? 'reading' : 'skip';
    else if (record.owned === true) action = 'copy';
    else if (record.owned === false) action = 'reading';
    else action = defaultAction;

    return { record, existingBookId, duplicateOfIndex, action };
  });
}

export function summarize(rows: PlannedRow[]) {
  return {
    total: rows.length,
    copies: rows.filter((r) => r.action === 'copy').length,
    readings: rows.filter((r) => r.action === 'reading').length,
    skipped: rows.filter((r) => r.action === 'skip').length,
    inLibrary: rows.filter((r) => r.existingBookId).length,
    duplicatesInFile: rows.filter((r) => r.duplicateOfIndex !== null).length,
    invalid: rows.filter((r) => r.record.errors.length > 0).length,
  };
}

/**
 * Origem de uma leitura sem exemplar: leituras já feitas entram como "já não
 * tenho"; as desejadas/em andamento, como "emprestado" (dá para mudar depois).
 */
function externalOrigin(record: ImportRecord): ReadingOrigin {
  if (record.format === 'subscription') return 'subscription';
  return record.status === 'read' || record.status === 'abandoned' ? 'no_longer_owned' : 'borrowed';
}

/** Linha no formato da RPC import_rows (mesmo contrato de add_to_library). */
export function toRpcRow(row: PlannedRow, genreIds: string[]) {
  const { record, action } = row;
  const status = record.status ?? (action === 'reading' ? 'read' : null);
  const finished = status === 'read' || status === 'abandoned';
  const finishedAt = finished ? record.finished_at : null;
  // Datas invertidas no arquivo derrubariam a linha: descarta o início.
  const startedAt =
    status === 'want' || (record.started_at && finishedAt && record.started_at > finishedAt)
      ? null
      : record.started_at;

  return {
    index: record.index,
    book: row.existingBookId
      ? { id: row.existingBookId }
      : {
          title: record.title,
          subtitle: record.subtitle,
          authors: record.authors,
          isbn_13: record.isbn13,
          isbn_10: record.isbn10,
          publisher: record.publisher,
          year: record.year,
          pages: record.pages,
          source: 'import',
        },
    genre_ids: row.existingBookId ? [] : genreIds,
    copy: action === 'copy' ? { format: record.format ?? 'physical' } : null,
    reading: status
      ? {
          status,
          origin: action === 'copy' ? 'own' : externalOrigin(record),
          started_at: startedAt,
          finished_at: finishedAt,
          rating: status === 'read' ? record.rating : null,
          review: status === 'read' ? record.review : null,
        }
      : null,
  };
}
