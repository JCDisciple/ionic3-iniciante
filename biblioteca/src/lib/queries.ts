import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentLibrary } from '@/providers/library-provider';
import type { Book, Copy, LibraryInvite, LibraryMember, Reading } from '@/types/models';

/** Chaves de cache sempre começam pela library, para isolar trocas de casa. */
export const queryKeys = {
  members: (libraryId: string) => ['library', libraryId, 'members'] as const,
  invites: (libraryId: string) => ['library', libraryId, 'invites'] as const,
  shelf: (libraryId: string) => ['library', libraryId, 'shelf'] as const,
  recentBooks: (libraryId: string) => ['library', libraryId, 'recent-books'] as const,
  myReading: (memberId: string) => ['member', memberId, 'reading'] as const,
};

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
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

export type ShelfCopy = Copy & { book: Book };

/** Exemplares ativos da casa, com o livro embutido. */
export function useShelf() {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.shelf(library_id),
    queryFn: async () =>
      unwrap<ShelfCopy[]>(
        await supabase
          .from('copies')
          .select('*, book:books(*)')
          .eq('library_id', library_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useRecentBooks(limit = 10) {
  const { library_id } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.recentBooks(library_id),
    queryFn: async () =>
      unwrap<Book[]>(
        await supabase
          .from('books')
          .select('*')
          .eq('library_id', library_id)
          .order('created_at', { ascending: false })
          .limit(limit),
      ),
  });
}

export type ReadingWithBook = Reading & { book: Book };

export function useMyCurrentReadings() {
  const { id: memberId } = useCurrentLibrary();
  return useQuery({
    queryKey: queryKeys.myReading(memberId),
    queryFn: async () =>
      unwrap<ReadingWithBook[]>(
        await supabase
          .from('readings')
          .select('*, book:books(*)')
          .eq('member_id', memberId)
          .eq('status', 'reading')
          .order('updated_at', { ascending: false }),
      ),
  });
}
