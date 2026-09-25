import { randomUUID } from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import type {
  Book,
  BookSource,
  Copy,
  CopyFormat,
  CopyStatus,
  ReadingOrigin,
  ReadingStatus,
} from '@/types/models';

/** Campos editáveis do livro no formulário de cadastro/edição. */
export type BookInput = {
  isbn_13: string | null;
  isbn_10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  year: number | null;
  pages: number | null;
  audio_minutes: number | null;
  language: string | null;
  cover_url: string | null;
  source: BookSource;
};

export type CopyInput = {
  format: CopyFormat;
  platform: string | null;
  location: string | null;
  condition: string | null;
  acquired_at: string | null;
  price: number | null;
};

export type ReadingInput = {
  status: ReadingStatus;
  origin: ReadingOrigin;
  lent_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  /** Exemplar já existente (releitura do próprio acervo). */
  copy_id?: string | null;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/**
 * Cadastro atômico (RPC add_to_library): livro novo ou existente + gêneros +
 * exemplar opcional + leitura opcional. Retorna o id do livro.
 */
export async function addToLibrary(params: {
  libraryId: string;
  book: Partial<BookInput> & { id?: string };
  genreIds: string[];
  copy: CopyInput | null;
  reading: ReadingInput | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_to_library', {
    p_library_id: params.libraryId,
    p_book: params.book,
    p_genre_ids: params.genreIds,
    p_copy: params.copy,
    p_reading: params.reading,
  });
  fail(error);
  return data as string;
}

export async function findBookByIsbn(libraryId: string, isbn13: string) {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, copies(id, status)')
    .eq('library_id', libraryId)
    .eq('isbn_13', isbn13)
    .maybeSingle();
  fail(error);
  return data as (Pick<Book, 'id' | 'title'> & { copies: Pick<Copy, 'id' | 'status'>[] }) | null;
}

export async function updateBook(bookId: string, book: Partial<BookInput>, genreIds: string[]) {
  const { error } = await supabase.from('books').update(book).eq('id', bookId);
  fail(error);
  const { error: genresError } = await supabase.rpc('set_book_genres', {
    p_book_id: bookId,
    p_genre_ids: genreIds,
  });
  fail(genresError);
}

export async function deleteBook(bookId: string) {
  const { error } = await supabase.from('books').delete().eq('id', bookId);
  fail(error);
}

export async function updateCopy(
  copyId: string,
  changes: Partial<CopyInput & { status: CopyStatus }>,
) {
  const { error } = await supabase.from('copies').update(changes).eq('id', copyId);
  fail(error);
}

export async function deleteCopy(copyId: string) {
  const { error } = await supabase.from('copies').delete().eq('id', copyId);
  fail(error);
}

export async function createLoan(params: {
  libraryId: string;
  copyId: string;
  borrowerName: string;
  borrowerPhone: string | null;
  lentAt: string;
  dueAt: string | null;
}) {
  const { error } = await supabase.from('loans').insert({
    library_id: params.libraryId,
    copy_id: params.copyId,
    borrower_name: params.borrowerName,
    borrower_phone: params.borrowerPhone,
    lent_at: params.lentAt,
    due_at: params.dueAt,
  });
  fail(error);
}

export async function returnLoan(loanId: string, returnedAt: string) {
  const { error } = await supabase
    .from('loans')
    .update({ returned_at: returnedAt })
    .eq('id', loanId);
  fail(error);
}

/**
 * Envia uma foto de capa para o Storage (covers/<library_id>/<uuid>.jpg) e
 * devolve a URL pública.
 */
export async function uploadCover(libraryId: string, uri: string, mimeType = 'image/jpeg') {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${libraryId}/${randomUUID()}.${extension}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('covers').upload(path, body, {
    contentType: mimeType,
    upsert: false,
  });
  fail(error);
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------------
// Leituras (Fase 3)
// ---------------------------------------------------------------------------

export async function logProgress(params: {
  readingId: string;
  date: string;
  page: number | null;
  percent: number | null;
  minutes: number | null;
}) {
  const { error } = await supabase.rpc('log_progress', {
    p_reading_id: params.readingId,
    p_date: params.date,
    p_page: params.page,
    p_percent: params.percent,
    p_minutes: params.minutes,
  });
  fail(error);
}

export async function deleteProgress(progressId: string) {
  const { error } = await supabase.from('reading_progress').delete().eq('id', progressId);
  fail(error);
}

export async function finishReading(params: {
  readingId: string;
  status: 'read' | 'abandoned';
  finishedAt: string;
  rating: number | null;
  review: string | null;
}) {
  const { error } = await supabase.rpc('finish_reading', {
    p_reading_id: params.readingId,
    p_status: params.status,
    p_finished_at: params.finishedAt,
    p_rating: params.rating,
    p_review: params.review,
  });
  fail(error);
}

export async function updateReading(
  readingId: string,
  changes: Partial<{
    status: ReadingStatus;
    started_at: string | null;
    finished_at: string | null;
    rating: number | null;
    review: string | null;
    origin: ReadingOrigin;
    lent_by: string | null;
  }>,
) {
  const { error } = await supabase.from('readings').update(changes).eq('id', readingId);
  fail(error);
}

export async function deleteReading(readingId: string) {
  const { error } = await supabase.from('readings').delete().eq('id', readingId);
  fail(error);
}

/** Cria ou atualiza a meta do ano (uma por pessoa e ano). */
export async function saveGoal(params: {
  libraryId: string;
  memberId: string;
  year: number;
  targetBooks: number | null;
  targetPages: number | null;
}) {
  const { error } = await supabase.from('goals').upsert(
    {
      library_id: params.libraryId,
      member_id: params.memberId,
      year: params.year,
      target_books: params.targetBooks,
      target_pages: params.targetPages,
    },
    { onConflict: 'member_id,year' },
  );
  fail(error);
}
