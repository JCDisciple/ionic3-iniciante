import { useQuery } from '@tanstack/react-query';
import { createContext, use, useCallback, useMemo, useState, type PropsWithChildren } from 'react';

import { safeStorage } from '@/lib/safe-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import type { Membership } from '@/types/models';

const CURRENT_LIBRARY_KEY = 'current-library-id';

type LibraryState = {
  /** Todas as casas das quais o usuário participa. */
  memberships: Membership[];
  /** Casa selecionada (com o registro de membro do usuário nela). */
  current: Membership | null;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
  selectLibrary: (libraryId: string) => Promise<void>;
  refresh: () => Promise<void>;
  createLibrary: (name: string, displayName: string) => Promise<string>;
  acceptInvite: (token: string, displayName: string) => Promise<string>;
};

const LibraryContext = createContext<LibraryState | null>(null);

export function LibraryProvider({ children }: PropsWithChildren) {
  const { user, isLoading: authLoading } = useAuth();
  // Só o id importa: o objeto user muda a cada renovação de token.
  const userId = user?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['memberships', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const [{ data, error }, storedId] = await Promise.all([
        supabase
          .from('library_members')
          .select('*, library:libraries(*)')
          .eq('user_id', userId!)
          .order('created_at'),
        safeStorage.getItem(CURRENT_LIBRARY_KEY),
      ]);
      if (error) throw error;
      return { rows: (data ?? []) as Membership[], storedId };
    },
  });
  const { refetch } = query;

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const selectLibrary = useCallback(async (libraryId: string) => {
    setSelectedId(libraryId);
    await safeStorage.setItem(CURRENT_LIBRARY_KEY, libraryId);
  }, []);

  const createLibrary = useCallback(
    async (name: string, displayName: string) => {
      const { data, error } = await supabase.rpc('create_library', {
        p_name: name,
        p_display_name: displayName,
      });
      if (error) throw error;
      const libraryId = data as string;
      await selectLibrary(libraryId);
      await refetch();
      return libraryId;
    },
    [refetch, selectLibrary],
  );

  const acceptInvite = useCallback(
    async (token: string, displayName: string) => {
      const { data, error } = await supabase.rpc('accept_invite', {
        p_token: token,
        p_display_name: displayName,
      });
      if (error) throw error;
      const libraryId = data as string;
      await selectLibrary(libraryId);
      await refetch();
      return libraryId;
    },
    [refetch, selectLibrary],
  );

  const value = useMemo<LibraryState>(() => {
    const memberships = (userId && query.data?.rows) || [];
    const preferredId = selectedId ?? query.data?.storedId;
    const current = memberships.find((m) => m.library_id === preferredId) ?? memberships[0] ?? null;
    return {
      memberships,
      current,
      isOwner: current?.role === 'owner',
      isLoading: authLoading || (!!userId && query.isPending),
      error: query.isError ? 'Não foi possível carregar sua biblioteca.' : null,
      selectLibrary,
      refresh,
      createLibrary,
      acceptInvite,
    };
  }, [
    userId,
    query.data,
    query.isPending,
    query.isError,
    selectedId,
    authLoading,
    selectLibrary,
    refresh,
    createLibrary,
    acceptInvite,
  ]);

  return <LibraryContext value={value}>{children}</LibraryContext>;
}

export function useLibrary() {
  const context = use(LibraryContext);
  if (!context) throw new Error('useLibrary precisa estar dentro de <LibraryProvider>');
  return context;
}

/** Atalho para telas que só existem com uma casa selecionada. */
export function useCurrentLibrary() {
  const { current } = useLibrary();
  if (!current) throw new Error('Nenhuma biblioteca selecionada');
  return current;
}
