import type { BookData } from '@/types/models';

/**
 * Passa metadados de um resultado de busca para a pré-visualização sem
 * colocá-los na URL. Vive só na memória da sessão.
 */
const drafts = new Map<string, BookData>();
let counter = 0;

export function putDraft(book: BookData): string {
  const key = `d${Date.now().toString(36)}${(counter++).toString(36)}`;
  drafts.set(key, book);
  return key;
}

export function getDraft(key: string | undefined): BookData | null {
  return key ? (drafts.get(key) ?? null) : null;
}
