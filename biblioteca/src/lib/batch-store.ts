import { useSyncExternalStore } from 'react';

import { safeStorage } from '@/lib/safe-storage';
import type { BookData } from '@/types/models';

/**
 * Fila do modo lote: ISBNs escaneados em sequência para revisar no fim.
 * Fica guardada no aparelho para não se perder se o app fechar no meio.
 */
export type BatchItem = {
  isbn13: string;
  state: 'pending' | 'found' | 'not_found' | 'error' | 'exists' | 'saved';
  book: BookData | null;
  /** Livro que já está no acervo com este ISBN. */
  existingBookId: string | null;
};

const STORAGE_KEY = 'batch-queue';
let items: BatchItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function load() {
  if (loaded) return;
  loaded = true;
  const raw = await safeStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const stored = JSON.parse(raw) as BatchItem[];
    // Itens salvos não precisam voltar; os que estavam buscando voltam a "pendente".
    items = stored
      .filter((item) => item.state !== 'saved')
      .map((item) => (item.state === 'error' ? { ...item, state: 'pending' as const } : item));
    for (const listener of listeners) listener();
  } catch {
    items = [];
  }
}

export const batchStore = {
  /** Adiciona um ISBN; retorna false se já estava na fila. */
  add(isbn13: string): boolean {
    if (items.some((item) => item.isbn13 === isbn13)) return false;
    items = [...items, { isbn13, state: 'pending', book: null, existingBookId: null }];
    emit();
    return true;
  },
  update(isbn13: string, changes: Partial<BatchItem>) {
    items = items.map((item) => (item.isbn13 === isbn13 ? { ...item, ...changes } : item));
    emit();
  },
  remove(isbn13: string) {
    items = items.filter((item) => item.isbn13 !== isbn13);
    emit();
  },
  clearSaved() {
    items = items.filter((item) => item.state !== 'saved');
    emit();
  },
  clear() {
    items = [];
    emit();
  },
  get: () => items,
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

export function useBatch(): BatchItem[] {
  return useSyncExternalStore(subscribe, batchStore.get, batchStore.get);
}
