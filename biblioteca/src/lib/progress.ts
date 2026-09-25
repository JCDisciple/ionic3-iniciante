import type { CopyFormat } from '@/types/models';

/** Como o progresso é medido: páginas (físico), % (e-book) ou minutos (audiobook). */
export type ProgressUnit = 'page' | 'percent' | 'minutes';

export type ProgressRow = {
  date: string;
  page: number | null;
  percent: number | null;
  minutes: number | null;
};

type BookSize = { pages: number | null; audio_minutes: number | null };

export const UNIT_LABELS: Record<ProgressUnit, { short: string; long: string }> = {
  page: { short: 'pág.', long: 'Página' },
  percent: { short: '%', long: 'Porcentagem' },
  minutes: { short: 'min', long: 'Minutos ouvidos' },
};

export function defaultUnit(format: CopyFormat | null | undefined, book: BookSize): ProgressUnit {
  if (format === 'audiobook') return 'minutes';
  if (format === 'ebook' || format === 'subscription') return 'percent';
  return book.pages ? 'page' : 'percent';
}

/** Registro mais recente (por data). */
export function latest<T extends ProgressRow>(rows: T[]): T | null {
  return rows.reduce<T | null>((best, row) => (!best || row.date > best.date ? row : best), null);
}

/** Fração lida (0–1) a partir de um registro, usando o que houver. */
export function fractionOf(row: ProgressRow | null, book: BookSize): number {
  if (!row) return 0;
  const candidates = [
    row.percent != null ? Number(row.percent) / 100 : null,
    row.page != null && book.pages ? row.page / book.pages : null,
    row.minutes != null && book.audio_minutes ? row.minutes / book.audio_minutes : null,
  ].filter((v): v is number => v !== null);
  if (candidates.length === 0) return 0;
  return Math.min(1, Math.max(0, Math.max(...candidates)));
}

export function describe(row: ProgressRow | null, book: BookSize): string {
  if (!row) return 'Ainda sem progresso';
  if (row.page != null)
    return book.pages ? `Página ${row.page} de ${book.pages}` : `Página ${row.page}`;
  if (row.minutes != null) {
    const h = Math.floor(row.minutes / 60);
    const m = row.minutes % 60;
    const done = h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
    return book.audio_minutes ? `${done} de ${Math.round(book.audio_minutes / 60)}h` : done;
  }
  return `${Math.round(Number(row.percent))}%`;
}

export type ProgressInput = { page: number | null; percent: number | null; minutes: number | null };

/** Valida o número digitado para a unidade escolhida. */
export function parseProgress(
  text: string,
  unit: ProgressUnit,
  book: BookSize,
): { input: ProgressInput; error: null } | { input: null; error: string } {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { input: null, error: 'Digite um número.' };
  const value = Number(normalized);
  if (unit === 'percent') {
    if (value > 100) return { input: null, error: 'A porcentagem vai até 100.' };
    return {
      input: { page: null, percent: Math.round(value * 100) / 100, minutes: null },
      error: null,
    };
  }
  if (!Number.isInteger(value)) return { input: null, error: 'Use um número inteiro.' };
  if (unit === 'page') {
    if (book.pages && value > book.pages)
      return { input: null, error: `O livro tem ${book.pages} páginas.` };
    return { input: { page: value, percent: null, minutes: null }, error: null };
  }
  return { input: { page: null, percent: null, minutes: value }, error: null };
}

/** Chegou ao fim? (sugere concluir a leitura) */
export function reachedEnd(input: ProgressInput, book: BookSize): boolean {
  return fractionOf({ date: '', ...input }, book) >= 1;
}
