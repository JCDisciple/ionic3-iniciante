import { randomUUID } from 'expo-crypto';

import { decodeText, parseCsv, toTable, type Table } from '@/lib/import/csv';
import type { ImportSource } from '@/lib/import/mapping';
import type { ExistingBook } from '@/lib/import/plan';
import { readXlsx } from '@/lib/import/xlsx';
import { supabase } from '@/lib/supabase';

const CHUNK = 100;

/** Lê o arquivo escolhido (URI do seletor, na web é um blob:) como bytes. */
export async function readFileBytes(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}

/** XLSX (zip, começa com "PK") ou CSV/TXT. */
export function fileToTable(name: string, bytes: Uint8Array): Table {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip || /\.xlsx$/i.test(name)) return toTable(readXlsx(bytes));
  return toTable(parseCsv(decodeText(bytes)));
}

/** Busca todas as linhas de uma consulta, contornando o limite de 1.000 do PostgREST. */
export async function fetchAllPages<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  size = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < size) return all;
  }
}

export function fetchExistingBooks(libraryId: string) {
  return fetchAllPages<ExistingBook>((from, to) =>
    supabase
      .from('books')
      .select('id, title, authors, isbn_13')
      .eq('library_id', libraryId)
      .order('id')
      .range(from, to),
  );
}

export async function createImport(params: {
  libraryId: string;
  userId: string;
  source: ImportSource;
  fileName: string;
  rowsTotal: number;
  bytes: Uint8Array;
  options: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase
    .from('imports')
    .insert({
      library_id: params.libraryId,
      created_by: params.userId,
      source: params.source,
      file_name: params.fileName,
      rows_total: params.rowsTotal,
      status: 'processing',
      options: params.options,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  // Guarda o arquivo original (melhor esforço: a importação não depende disso).
  const path = `${params.libraryId}/${data.id}-${params.fileName.replace(/[^\w.-]+/g, '_')}`;
  const upload = await supabase.storage
    .from('imports')
    .upload(path, params.bytes, { upsert: false });
  if (!upload.error) await supabase.from('imports').update({ file_url: path }).eq('id', data.id);
  return data.id as string;
}

export type ImportResult = {
  imported: number;
  failed: number;
  errors: { index: number; message: string }[];
};

/** Envia as linhas em lotes para a RPC import_rows, avisando o progresso. */
export async function runImport(
  importId: string,
  rows: { index: number }[],
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> {
  const total: ImportResult = { imported: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc('import_rows', {
      p_import_id: importId,
      p_rows: chunk,
    });
    if (error) {
      total.failed += chunk.length;
      total.errors.push(...chunk.map((r) => ({ index: r.index, message: error.message })));
    } else {
      const result = data as ImportResult;
      total.imported += result.imported;
      total.failed += result.failed;
      total.errors.push(...result.errors);
    }
    onProgress(Math.min(i + CHUNK, rows.length), rows.length);
  }
  return total;
}

export async function finishImport(importId: string, skipped: number, failed: boolean) {
  await supabase
    .from('imports')
    .update({ status: failed ? 'failed' : 'done', rows_skipped: skipped })
    .eq('id', importId);
}

/**
 * Completa capas e páginas pelo ISBN (Edge Function import-enrich), em lotes,
 * até não sobrar livro pendente. `shouldStop` permite interromper.
 */
export async function enrichLibrary(
  libraryId: string,
  onProgress: (done: number, total: number, updated: number) => void,
  shouldStop: () => boolean,
): Promise<{ processed: number; updated: number }> {
  let processed = 0;
  let updated = 0;
  let total: number | null = null;
  while (!shouldStop()) {
    const { data, error } = await supabase.functions.invoke<{
      processed: number;
      updated: number;
      remaining: number;
    }>('import-enrich', { body: { library_id: libraryId, limit: 20 } });
    if (error || !data) throw error ?? new Error('enrich_failed');
    processed += data.processed;
    updated += data.updated;
    total ??= data.processed + data.remaining;
    onProgress(processed, Math.max(total, processed), updated);
    if (data.remaining === 0 || data.processed === 0) break;
  }
  return { processed, updated };
}

export const newId = () => randomUUID();
