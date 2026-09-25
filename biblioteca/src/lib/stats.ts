/**
 * Estatísticas de leitura (RF5), puras e testáveis. Recebem as leituras já
 * filtradas ("minhas" ou "da família") e devolvem números prontos para as
 * telas de Relatórios, a meta anual da Início e o resumo "Meu ano em leituras".
 *
 * Convenções:
 * - Um livro conta no período em que foi TERMINADO (status "read" + finished_at).
 * - Páginas lidas = páginas do livro terminado (releituras contam de novo).
 * - Datas são AAAA-MM-DD, no fuso do aparelho.
 */

import type { CopyFormat, ReadingOrigin, ReadingStatus } from '@/types/models';

export type StatsReading = {
  id: string;
  member_id: string;
  book_id: string;
  status: ReadingStatus;
  origin: ReadingOrigin;
  started_at: string | null;
  finished_at: string | null;
  rating: number | null;
  book: {
    title: string;
    authors: string[];
    pages: number | null;
    audio_minutes: number | null;
    cover_url: string | null;
    book_genres: { genre_id: string }[];
  };
  copy: { format: CopyFormat } | null;
};

export type StatsProgress = { reading_id: string; date: string };

export const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
export const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const daysBetweenInclusive = (from: string, to: string) =>
  Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
export const daysInYear = (year: number) => (isLeap(year) ? 366 : 365);

/** Leituras terminadas (status "read") no ano. */
export function finishedIn(readings: StatsReading[], year: number): StatsReading[] {
  const prefix = `${year}-`;
  return readings.filter((r) => r.status === 'read' && r.finished_at?.startsWith(prefix));
}

const pagesOf = (r: StatsReading) => r.book.pages ?? 0;

/** Anos com alguma leitura terminada, do mais recente, sempre incluindo o atual. */
export function yearsWithData(readings: StatsReading[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const r of readings) {
    if (r.status === 'read' && r.finished_at) years.add(Number(r.finished_at.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export type MonthTotal = { month: number; label: string; books: number; pages: number };

export function monthlyTotals(readings: StatsReading[], year: number): MonthTotal[] {
  const months = MONTH_LABELS.map((label, month) => ({ month, label, books: 0, pages: 0 }));
  for (const r of finishedIn(readings, year)) {
    const m = Number(r.finished_at!.slice(5, 7)) - 1;
    months[m].books += 1;
    months[m].pages += pagesOf(r);
  }
  return months;
}

export function yearTotals(readings: StatsReading[], year: number) {
  const done = finishedIn(readings, year);
  const pages = done.reduce((sum, r) => sum + pagesOf(r), 0);
  const withPages = done.filter((r) => r.book.pages).length;
  return {
    books: done.length,
    pages,
    avgPages: withPages ? Math.round(pages / withPages) : 0,
    abandoned: readings.filter(
      (r) => r.status === 'abandoned' && r.finished_at?.startsWith(`${year}-`),
    ).length,
  };
}

// ---------------------------------------------------------------------------
// Meta anual
// ---------------------------------------------------------------------------

export type GoalTarget = { target_books: number | null; target_pages: number | null } | null;

export type GoalProgress = {
  books: number;
  pages: number;
  targetBooks: number | null;
  targetPages: number | null;
  /** Fração do ano já decorrida (0–1). */
  yearFraction: number;
  /** Projeção de fim de ano no ritmo atual (null se o ano não começou). */
  projectedBooks: number | null;
  projectedPages: number | null;
  /** Livros que já deveriam estar lidos para bater a meta no ritmo linear. */
  expectedBooksToday: number | null;
  /** 'ahead' | 'on_track' | 'behind' comparando com o ritmo linear (null sem meta). */
  pace: 'ahead' | 'on_track' | 'behind' | null;
};

export function goalProgress(
  readings: StatsReading[],
  goal: GoalTarget,
  year: number,
  today: string,
): GoalProgress {
  const totals = yearTotals(readings, year);
  const currentYear = Number(today.slice(0, 4));
  const elapsed =
    year < currentYear
      ? daysInYear(year)
      : year > currentYear
        ? 0
        : daysBetweenInclusive(`${year}-01-01`, today);
  const yearFraction = elapsed / daysInYear(year);
  const project = (value: number) => (yearFraction > 0 ? Math.round(value / yearFraction) : null);
  const targetBooks = goal?.target_books ?? null;
  const expectedBooksToday = targetBooks ? targetBooks * yearFraction : null;

  let pace: GoalProgress['pace'] = null;
  if (targetBooks && expectedBooksToday !== null) {
    const diff = totals.books - expectedBooksToday;
    pace = diff >= 1 ? 'ahead' : diff <= -1 ? 'behind' : 'on_track';
  }

  return {
    books: totals.books,
    pages: totals.pages,
    targetBooks,
    targetPages: goal?.target_pages ?? null,
    yearFraction,
    projectedBooks: year === currentYear ? project(totals.books) : totals.books,
    projectedPages: year === currentYear ? project(totals.pages) : totals.pages,
    expectedBooksToday,
    pace,
  };
}

/** Livros acumulados ao fim de cada mês (até o mês atual, no ano corrente). */
export function cumulativeBooks(
  readings: StatsReading[],
  year: number,
  today: string,
): (number | null)[] {
  const months = monthlyTotals(readings, year);
  const lastMonth = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : 11;
  let sum = 0;
  return months.map((m) => {
    sum += m.books;
    return m.month <= lastMonth ? sum : null;
  });
}

// ---------------------------------------------------------------------------
// Gêneros e autores
// ---------------------------------------------------------------------------

export type Share = { key: string; label: string; value: number };

/**
 * Livros terminados por gênero (um livro com dois gêneros conta nos dois).
 * Mostra os `limit` maiores e junta o resto em "Outros".
 */
export function genreDistribution(
  readings: StatsReading[],
  genreNames: Map<string, string>,
  year: number,
  limit = 7,
): Share[] {
  const counts = new Map<string, number>();
  let withoutGenre = 0;
  for (const r of finishedIn(readings, year)) {
    const ids = r.book.book_genres.map((g) => g.genre_id).filter((id) => genreNames.has(id));
    if (ids.length === 0) withoutGenre++;
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .map(([key, value]) => ({ key, label: genreNames.get(key)!, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'));
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, s) => sum + s.value, 0);
  if (rest > 0) top.push({ key: 'other', label: 'Outros', value: rest });
  if (withoutGenre > 0) top.push({ key: 'none', label: 'Sem gênero', value: withoutGenre });
  return top;
}

export function topAuthors(
  readings: StatsReading[],
  year: number,
  limit = 5,
): (Share & { pages: number })[] {
  const byAuthor = new Map<string, { value: number; pages: number }>();
  for (const r of finishedIn(readings, year)) {
    for (const author of r.book.authors) {
      const entry = byAuthor.get(author) ?? { value: 0, pages: 0 };
      entry.value += 1;
      entry.pages += pagesOf(r);
      byAuthor.set(author, entry);
    }
  }
  return [...byAuthor.entries()]
    .map(([label, v]) => ({ key: label, label, ...v }))
    .sort(
      (a, b) => b.value - a.value || b.pages - a.pages || a.label.localeCompare(b.label, 'pt-BR'),
    )
    .slice(0, limit);
}

export type OriginKind = 'physical' | 'online' | 'external';

export function originKind(r: Pick<StatsReading, 'origin' | 'copy'>): OriginKind {
  if (r.origin !== 'own' || !r.copy) return 'external';
  return r.copy.format === 'physical' ? 'physical' : 'online';
}

/** Proporção físico × online × fora do acervo entre os livros terminados. */
export function originSplit(readings: StatsReading[], year: number): Record<OriginKind, number> {
  const split: Record<OriginKind, number> = { physical: 0, online: 0, external: 0 };
  for (const r of finishedIn(readings, year)) split[originKind(r)] += 1;
  return split;
}

// ---------------------------------------------------------------------------
// Ritmo e tempo
// ---------------------------------------------------------------------------

/** Dias em que houve leitura: registros de progresso, inícios e términos. */
export function readingDays(readings: StatsReading[], progress: StatsProgress[]): Set<string> {
  const ids = new Set(readings.map((r) => r.id));
  const days = new Set<string>();
  for (const p of progress) if (ids.has(p.reading_id)) days.add(p.date.slice(0, 10));
  for (const r of readings) {
    if (r.started_at) days.add(r.started_at);
    if (r.finished_at && r.status === 'read') days.add(r.finished_at);
  }
  return days;
}

/** Sequência atual (terminando hoje ou ontem) e a maior sequência de dias seguidos. */
export function streaks(days: Set<string>, today: string): { current: number; longest: number } {
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of sorted) {
    const ms = toUtc(day);
    run = prev !== null && ms - prev === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = ms;
  }

  let current = 0;
  let cursor = toUtc(today);
  if (!days.has(today)) cursor -= DAY_MS; // ainda dá tempo de ler hoje
  while (days.has(fromUtc(cursor))) {
    current++;
    cursor -= DAY_MS;
  }
  return { current, longest };
}

export function pace(
  readings: StatsReading[],
  progress: StatsProgress[],
  year: number,
  today: string,
) {
  const done = finishedIn(readings, year);
  const durations = done
    .filter((r) => r.started_at && r.started_at <= r.finished_at!)
    .map((r) => daysBetweenInclusive(r.started_at!, r.finished_at!));
  const avgDaysPerBook = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const currentYear = Number(today.slice(0, 4));
  const elapsed =
    year < currentYear
      ? daysInYear(year)
      : year > currentYear
        ? 0
        : daysBetweenInclusive(`${year}-01-01`, today);
  const pages = done.reduce((sum, r) => sum + pagesOf(r), 0);
  const audioMinutes = done
    .filter((r) => r.copy?.format === 'audiobook' || (r.book.audio_minutes && !r.book.pages))
    .reduce((sum, r) => sum + (r.book.audio_minutes ?? 0), 0);

  const days = readingDays(readings, progress);
  return {
    avgDaysPerBook,
    pagesPerDay: elapsed > 0 ? Math.round((pages / elapsed) * 10) / 10 : 0,
    audiobookHours: Math.round((audioMinutes / 60) * 10) / 10,
    ...streaks(days, today),
    days,
  };
}

/**
 * Grade de dias das últimas `weeks` semanas (colunas = semanas, domingo a
 * sábado), terminando na semana de `today`. Dias futuros vêm como null.
 */
export function activityGrid(
  days: Set<string>,
  today: string,
  weeks = 12,
): ({ date: string; active: boolean } | null)[][] {
  const todayMs = toUtc(today);
  const weekday = new Date(todayMs).getUTCDay();
  const start = todayMs - (weekday + (weeks - 1) * 7) * DAY_MS;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const ms = start + (w * 7 + d) * DAY_MS;
      if (ms > todayMs) return null;
      const date = fromUtc(ms);
      return { date, active: days.has(date) };
    }),
  );
}

// ---------------------------------------------------------------------------
// Meu ano em leituras
// ---------------------------------------------------------------------------

export function yearSummary(
  readings: StatsReading[],
  genreNames: Map<string, string>,
  year: number,
) {
  const done = finishedIn(readings, year);
  const totals = yearTotals(readings, year);
  const months = monthlyTotals(readings, year);
  const busiest = months.reduce((best, m) => (m.books > best.books ? m : best), months[0]);
  const longest = done.reduce<StatsReading | null>(
    (best, r) => ((r.book.pages ?? 0) > (best?.book.pages ?? 0) ? r : best),
    null,
  );
  const favorite = [...done]
    .filter((r) => r.rating)
    .sort((a, b) => b.rating! - a.rating! || b.finished_at!.localeCompare(a.finished_at!))[0];
  const genres = genreDistribution(readings, genreNames, year, 3).filter(
    (g) => g.key !== 'other' && g.key !== 'none',
  );
  const ratings = done.filter((r) => r.rating).map((r) => r.rating!);

  return {
    books: totals.books,
    pages: totals.pages,
    topGenre: genres[0]?.label ?? null,
    topAuthor: topAuthors(readings, year, 1)[0]?.label ?? null,
    busiestMonth: busiest.books > 0 ? MONTH_NAMES[busiest.month] : null,
    longest:
      longest && longest.book.pages
        ? { title: longest.book.title, pages: longest.book.pages }
        : null,
    favorite: favorite ? { title: favorite.book.title, rating: favorite.rating! } : null,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    covers: [...done]
      .sort((a, b) => a.finished_at!.localeCompare(b.finished_at!))
      .map((r) => ({
        id: r.id,
        bookId: r.book_id,
        title: r.book.title,
        authors: r.book.authors,
        cover_url: r.book.cover_url,
      })),
  };
}

/** 1284 → "1.284"; 12900 → "12,9 mil" (compacto a partir de 10 mil). */
export function formatNumber(value: number): string {
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
