import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';
import { useCurrentLibrary } from '@/providers/library-provider';
import type { Usage } from '@/lib/plans';
import type { StatsProgress, StatsReading } from '@/lib/stats';
import type {
  Book,
  Copy,
  Goal,
  Genre,
  GenreAlias,
  LibraryInvite,
  LibraryMember,
  Loan,
  Reading,
  ReadingProgress,
  ReadingStatus,
  Wish,
} from '@/types/models';

/**
 * Chaves de cache sempre começam por ['library', libraryId], para isolar trocas
 * de casa e permitir invalidar tudo de uma biblioteca de uma vez.
 */
export const queryKeys = {
  library: (libraryId: string) => ['library', libraryId] as const,
  members: (libraryId: string) => ['library', libraryId, 'members'] as const,
  invites: (libraryId: string) => ['library', libraryId, 'invites'] as const,
  shelf: (libraryId: string) => ['library', libraryId, 'shelf'] as const,
  recentBooks: (libraryId: string) => ['library', libraryId, 'recent-books'] as const,
  book: (libraryId: string, bookId: string) => ['library', libraryId, 'book', bookId] as const,
  genres: (libraryId: string) => ['library', libraryId, 'genres'] as const,
  genreAliases: (libraryId: string) => ['library', libraryId, 'genre-aliases'] as const,
  genreCounts: (libraryId: string) => ['library', libraryId, 'genre-counts'] as const,
  openLoans: (libraryId: string) => ['library', libraryId, 'open-loans'] as const,
  myReadings: (libraryId: string, memberId: string) =>
    ['library', libraryId, 'member', memberId, 'readings'] as const,
  reading: (libraryId: string, readingId: string) =>
    ['library', libraryId, 'reading', readingId] as const,
  goals: (libraryId: string, memberId: string) =>
    ['library', libraryId, 'member', memberId, 'goals'] as const,
  statsReadings: (libraryId: string, scope: string) =>
    ['library', libraryId, 'stats', scope, 'readings'] as const,
  statsProgress: (libraryId: string) => ['library', libraryId, 'stats', 'progress'] as const,
  familyGoals: (libraryId: string) => ['library', libraryId, 'family-goals'] as const,
};

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Invalida todas as consultas da biblioteca atual (use após qualquer escrita). */
export function useInvalidateLibrary() {
  const queryClient = useQueryClient();
  const { library_id } = useCurrentLibrary();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.library(library_id) }),
    [queryClient, library_id],
  );
}

export function useMembers() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.members(library_id),
    queryFn: async () =>
      unwrap<LibraryMember[]>(
        await supabase
          .from('library_members')
          .select('*')
          .eq('library_id', library_id)
          .order('created_at'),
      ),
  });
}

export function useOpenInvites(enabled: boolean) {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.invites(library_id),
    enabled,
    queryFn: async () =>
      unwrap<LibraryInvite[]>(
        await supabase
          .from('library_invites')
          .select('*')
          .eq('library_id', library_id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ),
  });
}

export type ShelfCopy = Copy & {
  book: Book & { book_genres: { genre_id: string }[] };
  loans: Pick<Loan, 'id' | 'borrower_name' | 'due_at' | 'returned_at'>[];
};

/** Exemplares ativos da casa, com o livro, os gêneros e os empréstimos. */
export function useShelf() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.shelf(library_id),
    queryFn: async () =>
      unwrap<ShelfCopy[]>(
        await supabase
          .from('copies')
          .select(
            '*, book:books(*, book_genres(genre_id)), loans(id, borrower_name, due_at, returned_at)',
          )
          .eq('library_id', library_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ),
  });
}

/** Últimos livros que entraram no acervo (livros só da lista de desejos ficam de fora). */
export function useRecentBooks(limit = 10) {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.recentBooks(library_id),
    queryFn: async () => {
      const rows = unwrap<{ book: Book }[]>(
        await supabase
          .from('copies')
          .select('book:books(*)')
          .eq('library_id', library_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(limit * 2),
      );
      const seen = new Set<string>();
      return rows
        .map((r) => r.book)
        .filter((b) => b && !seen.has(b.id) && seen.add(b.id))
        .slice(0, limit);
    },
  });
}

export type ReadingWithBook = Reading & {
  book: Book;
  copy: Pick<Copy, 'id' | 'format'> | null;
  reading_progress: Pick<ReadingProgress, 'date' | 'page' | 'percent' | 'minutes'>[];
};

/** Minhas leituras (todas), da mais recente para a mais antiga. */
export function useMyReadings() {
  const { library_id, id: memberId } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.myReadings(library_id, memberId),
    queryFn: async () =>
      unwrap<ReadingWithBook[]>(
        await supabase
          .from('readings')
          .select(
            '*, book:books(*), copy:copies(id, format), reading_progress(date, page, percent, minutes)',
          )
          .eq('member_id', memberId)
          .order('updated_at', { ascending: false }),
      ),
  });
}

export function useMyCurrentReadings() {
  const query = useMyReadings();
  return { ...query, data: query.data?.filter((r) => r.status === 'reading') };
}

/** Status da minha leitura mais recente de cada livro (para o filtro da biblioteca). */
export function useMyReadingStatusByBook() {
  const query = useMyReadings();
  const map = new Map<string, ReadingStatus>();
  for (const reading of query.data ?? []) {
    if (!map.has(reading.book_id)) map.set(reading.book_id, reading.status);
  }
  return map;
}

export type BookDetail = Book & {
  book_genres: { genre_id: string }[];
  copies: (Copy & { loans: Loan[] })[];
  readings: (Reading & { member: Pick<LibraryMember, 'id' | 'display_name'> | null })[];
};

export function useBook(bookId: string | undefined) {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.book(library_id, bookId ?? ''),
    enabled: !!bookId,
    queryFn: async () =>
      unwrap<BookDetail | null>(
        await supabase
          .from('books')
          .select(
            '*, book_genres(genre_id), copies(*, loans(*)), readings(*, member:library_members(id, display_name))',
          )
          .eq('library_id', library_id)
          .eq('id', bookId!)
          .maybeSingle(),
      ),
  });
}

export function useGenres() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.genres(library_id),
    staleTime: 5 * 60_000,
    queryFn: async () =>
      unwrap<Genre[]>(
        await supabase.from('genres').select('*').eq('library_id', library_id).order('name'),
      ),
  });
}

export function useGenreAliases() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.genreAliases(library_id),
    staleTime: 5 * 60_000,
    queryFn: async () =>
      unwrap<GenreAlias[]>(
        await supabase.from('genre_aliases').select('*').eq('library_id', library_id),
      ),
  });
}

/** Quantos livros há em cada gênero. */
export function useGenreCounts() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.genreCounts(library_id),
    queryFn: async () => {
      const rows = unwrap<{ genre_id: string }[]>(
        await supabase.from('book_genres').select('genre_id').eq('library_id', library_id),
      );
      const counts = new Map<string, number>();
      for (const row of rows) counts.set(row.genre_id, (counts.get(row.genre_id) ?? 0) + 1);
      return counts;
    },
  });
}

export type OpenLoan = Loan & {
  copy: Pick<Copy, 'id' | 'format' | 'location'> & {
    book: Pick<Book, 'id' | 'title' | 'authors' | 'cover_url'>;
  };
};

/** Empréstimos em aberto, do mais atrasado para o mais folgado (sem data por último). */
export function useOpenLoans() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.openLoans(library_id),
    queryFn: async () =>
      unwrap<OpenLoan[]>(
        await supabase
          .from('loans')
          .select('*, copy:copies(id, format, location, book:books(id, title, authors, cover_url))')
          .eq('library_id', library_id)
          .is('returned_at', null)
          .order('due_at', { ascending: true, nullsFirst: false }),
      ),
  });
}

export type ReadingDetail = Reading & {
  book: Book;
  copy: Pick<Copy, 'id' | 'format' | 'platform' | 'location' | 'status'> | null;
  reading_progress: ReadingProgress[];
};

export function useReading(readingId: string | undefined) {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.reading(library_id, readingId ?? ''),
    enabled: !!readingId,
    queryFn: async () =>
      unwrap<ReadingDetail | null>(
        await supabase
          .from('readings')
          .select(
            '*, book:books(*), copy:copies(id, format, platform, location, status), reading_progress(*)',
          )
          .eq('library_id', library_id)
          .eq('id', readingId!)
          .maybeSingle(),
      ),
  });
}

/** Minhas metas (todos os anos). */
export function useMyGoals() {
  const { library_id, id: memberId } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.goals(library_id, memberId),
    queryFn: async () =>
      unwrap<Goal[]>(
        await supabase
          .from('goals')
          .select('*')
          .eq('member_id', memberId)
          .order('year', { ascending: false }),
      ),
  });
}

/** Metas de todos da casa (para o relatório "da família"). */
export function useFamilyGoals() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.familyGoals(library_id),
    queryFn: async () =>
      unwrap<Goal[]>(await supabase.from('goals').select('*').eq('library_id', library_id)),
  });
}

/** Leituras para os relatórios: só as minhas ou as de toda a família. */
export function useStatsReadings(scope: 'mine' | 'family') {
  const { library_id, id: memberId } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.statsReadings(library_id, scope),
    queryFn: async () => {
      let query = supabase
        .from('readings')
        .select(
          'id, member_id, book_id, status, origin, started_at, finished_at, rating, book:books(title, authors, pages, audio_minutes, cover_url, book_genres(genre_id)), copy:copies(format)',
        )
        .eq('library_id', library_id);
      if (scope === 'mine') query = query.eq('member_id', memberId);
      return unwrap<StatsReading[]>(await query);
    },
  });
}

/** Dias com registro de progresso (últimos ~400 dias), para ritmo e sequência. */
export function useStatsProgress() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.statsProgress(library_id),
    queryFn: async () => {
      const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
      return unwrap<StatsProgress[]>(
        await supabase
          .from('reading_progress')
          .select('reading_id, date')
          .eq('library_id', library_id)
          .gte('date', since),
      );
    },
  });
}

/** Plano atual e uso × limites (RPC library_usage). */
export function useLibraryUsage() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: ['library', library_id, 'usage'] as const,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('library_usage', { p_library_id: library_id });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Usage[])[0] ?? null;
    },
  });
}

export type WishWithBook = Wish & {
  book: Book;
  member: Pick<LibraryMember, 'id' | 'display_name'> | null;
};

/** Desejos de toda a casa (cada um edita os seus). */
export function useWishes() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: ['library', library_id, 'wishes'] as const,
    queryFn: async () =>
      unwrap<WishWithBook[]>(
        await supabase
          .from('wishes')
          .select('*, book:books(*), member:library_members(id, display_name)')
          .eq('library_id', library_id)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  });
}
