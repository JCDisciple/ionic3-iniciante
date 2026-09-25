import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activityGrid,
  cumulativeBooks,
  formatNumber,
  genreDistribution,
  goalProgress,
  monthlyTotals,
  originKind,
  originSplit,
  pace,
  readingDays,
  streaks,
  topAuthors,
  yearSummary,
  yearTotals,
  yearsWithData,
  type StatsReading,
} from './stats.ts';

let n = 0;
function reading(
  partial: Partial<StatsReading> & {
    pages?: number | null;
    authors?: string[];
    genres?: string[];
    title?: string;
  },
): StatsReading {
  n++;
  return {
    id: `r${n}`,
    member_id: 'm1',
    book_id: `b${n}`,
    status: 'read',
    origin: 'own',
    started_at: null,
    finished_at: null,
    rating: null,
    copy: { format: 'physical' },
    ...partial,
    book: {
      title: partial.title ?? `Livro ${n}`,
      authors: partial.authors ?? ['Autor'],
      pages: partial.pages === undefined ? 200 : partial.pages,
      audio_minutes: null,
      cover_url: null,
      book_genres: (partial.genres ?? []).map((genre_id) => ({ genre_id })),
      ...partial.book,
    },
  };
}

const genres = new Map([
  ['romance', 'Romance'],
  ['fantasia', 'Fantasia'],
  ['historia', 'História'],
]);

const readings: StatsReading[] = [
  reading({
    title: 'Dom Casmurro',
    finished_at: '2026-01-15',
    started_at: '2026-01-01',
    pages: 256,
    authors: ['Machado de Assis'],
    genres: ['romance'],
    rating: 5,
  }),
  reading({
    finished_at: '2026-01-30',
    started_at: '2026-01-20',
    pages: 100,
    authors: ['Machado de Assis'],
    genres: ['romance', 'historia'],
    rating: 3,
  }),
  reading({
    title: 'Duna',
    finished_at: '2026-03-10',
    started_at: '2026-02-01',
    pages: 680,
    authors: ['Frank Herbert'],
    genres: ['fantasia'],
    copy: { format: 'ebook' },
  }),
  reading({ finished_at: '2026-03-20', pages: null, origin: 'borrowed', copy: null }),
  reading({ finished_at: '2025-12-31', pages: 300 }),
  reading({ status: 'reading', started_at: '2026-09-20', finished_at: null }),
  reading({ status: 'abandoned', finished_at: '2026-04-01' }),
];

test('monthlyTotals e yearTotals contam livros terminados no ano', () => {
  const months = monthlyTotals(readings, 2026);
  assert.equal(months[0].books, 2);
  assert.equal(months[0].pages, 356);
  assert.equal(months[2].books, 2);
  assert.equal(months[2].pages, 680);
  assert.deepEqual(yearTotals(readings, 2026), {
    books: 4,
    pages: 1036,
    avgPages: 345,
    abandoned: 1,
  });
  assert.deepEqual(yearsWithData(readings, 2027), [2027, 2026, 2025]);
});

test('meta: projeção e ritmo linear', () => {
  // 30/06/2026 = dia 181 de 365
  const progress = goalProgress(
    readings,
    { target_books: 12, target_pages: null },
    2026,
    '2026-06-30',
  );
  assert.equal(progress.books, 4);
  assert.equal(progress.projectedBooks, 8); // 4 / (181/365)
  assert.equal(Math.round(progress.expectedBooksToday!), 6);
  assert.equal(progress.pace, 'behind');

  const ahead = goalProgress(readings, { target_books: 4, target_pages: 1000 }, 2026, '2026-06-30');
  assert.equal(ahead.pace, 'ahead');

  const past = goalProgress(readings, null, 2025, '2026-06-30');
  assert.equal(past.projectedBooks, 1);
  assert.equal(past.pace, null);
});

test('cumulativeBooks para no mês atual', () => {
  const cumulative = cumulativeBooks(readings, 2026, '2026-04-10');
  assert.deepEqual(cumulative.slice(0, 5), [2, 2, 4, 4, null]);
});

test('genreDistribution conta livro com dois gêneros nos dois e junta o resto', () => {
  assert.deepEqual(genreDistribution(readings, genres, 2026), [
    { key: 'romance', label: 'Romance', value: 2 },
    { key: 'fantasia', label: 'Fantasia', value: 1 },
    { key: 'historia', label: 'História', value: 1 },
    { key: 'none', label: 'Sem gênero', value: 1 },
  ]);
  const limited = genreDistribution(readings, genres, 2026, 1);
  assert.deepEqual(
    limited.map((g) => [g.label, g.value]),
    [
      ['Romance', 2],
      ['Outros', 2],
      ['Sem gênero', 1],
    ],
  );
});

test('topAuthors ordena por livros e páginas', () => {
  const authors = topAuthors(readings, 2026, 2);
  assert.equal(authors[0].label, 'Machado de Assis');
  assert.equal(authors[0].value, 2);
  assert.equal(authors[0].pages, 356);
  assert.equal(authors[1].label, 'Frank Herbert');
});

test('origem: físico, online e fora do acervo', () => {
  assert.equal(originKind({ origin: 'own', copy: null }), 'external');
  assert.deepEqual(originSplit(readings, 2026), { physical: 2, online: 1, external: 1 });
});

test('streaks: atual termina hoje ou ontem, maior sequência', () => {
  const days = new Set([
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-20',
    '2026-09-21',
    '2026-09-22',
  ]);
  assert.deepEqual(streaks(days, '2026-09-22'), { current: 3, longest: 3 });
  assert.deepEqual(streaks(days, '2026-09-23'), { current: 3, longest: 3 });
  assert.deepEqual(streaks(days, '2026-09-24'), { current: 0, longest: 3 });
  assert.deepEqual(streaks(new Set(), '2026-09-24'), { current: 0, longest: 0 });
});

test('readingDays junta progresso, início e término', () => {
  const days = readingDays(readings.slice(0, 1), [
    { reading_id: readings[0].id, date: '2026-01-05' },
    { reading_id: 'outra', date: '2026-01-06' },
  ]);
  assert.deepEqual([...days].sort(), ['2026-01-01', '2026-01-05', '2026-01-15']);
});

test('pace: dias por livro e páginas por dia', () => {
  const p = pace(readings, [], 2026, '2026-04-10'); // 100 dias decorridos
  // durações: 15, 11, 38 → média 21
  assert.equal(p.avgDaysPerBook, 21);
  assert.equal(p.pagesPerDay, 10.4);
});

test('activityGrid termina na semana de hoje, sem dias futuros', () => {
  const grid = activityGrid(new Set(['2026-09-24']), '2026-09-24', 2); // quinta-feira
  assert.equal(grid.length, 2);
  assert.equal(grid[1][4]!.date, '2026-09-24');
  assert.equal(grid[1][4]!.active, true);
  assert.equal(grid[1][5], null);
  assert.equal(grid[0][0]!.date, '2026-09-13');
});

test('yearSummary', () => {
  const summary = yearSummary(readings, genres, 2026);
  assert.equal(summary.books, 4);
  assert.equal(summary.topGenre, 'Romance');
  assert.equal(summary.topAuthor, 'Machado de Assis');
  assert.equal(summary.busiestMonth, 'janeiro');
  assert.deepEqual(summary.longest, { title: 'Duna', pages: 680 });
  assert.deepEqual(summary.favorite, { title: 'Dom Casmurro', rating: 5 });
  assert.equal(summary.avgRating, 4);
  assert.equal(summary.covers[0].title, 'Dom Casmurro');
});

test('formatNumber em pt-BR', () => {
  assert.equal(formatNumber(1284), '1.284');
  assert.equal(formatNumber(12900), '12,9 mil');
  assert.equal(formatNumber(10.5), '10,5');
});
