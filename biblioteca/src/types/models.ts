/**
 * Tipos de domínio espelhando supabase/migrations. Nomes em inglês no código,
 * rótulos em pt-BR ficam em src/lib/labels.ts.
 */

export type LibraryPlan = 'free' | 'pro';
export type MemberRole = 'owner' | 'member';
export type BookSource = 'brasilapi' | 'google' | 'openlibrary' | 'manual' | 'import';
export type CopyFormat = 'physical' | 'ebook' | 'audiobook' | 'subscription';
export type CopyStatus = 'active' | 'sold' | 'donated' | 'lost' | 'expired';
export type ReadingOrigin = 'own' | 'borrowed' | 'library' | 'subscription' | 'no_longer_owned';
export type ReadingStatus = 'want' | 'reading' | 'read' | 'abandoned';

type Timestamps = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type Library = Timestamps & {
  name: string;
  owner_id: string;
  plan: LibraryPlan;
};

export type LibraryMember = Timestamps & {
  library_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string;
};

export type LibraryInvite = Timestamps & {
  library_id: string;
  token: string;
  email: string | null;
  role: MemberRole;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

export type InvitePreview = {
  library_name: string;
  invited_by_name: string | null;
  email: string | null;
  expires_at: string;
  status: 'valid' | 'accepted' | 'expired';
};

export type Book = Timestamps & {
  library_id: string;
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

export type Genre = Timestamps & {
  library_id: string;
  name: string;
  parent_id: string | null;
};

export type Copy = Timestamps & {
  library_id: string;
  book_id: string;
  format: CopyFormat;
  platform: string | null;
  location: string | null;
  condition: string | null;
  acquired_at: string | null;
  price: number | null;
  owner_member_id: string | null;
  status: CopyStatus;
};

export type Loan = Timestamps & {
  library_id: string;
  copy_id: string;
  borrower_name: string;
  borrower_phone: string | null;
  lent_at: string;
  due_at: string | null;
  returned_at: string | null;
};

export type Reading = Timestamps & {
  library_id: string;
  member_id: string;
  book_id: string;
  copy_id: string | null;
  origin: ReadingOrigin;
  lent_by: string | null;
  status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  rating: number | null;
  review: string | null;
};

export type ReadingProgress = Timestamps & {
  library_id: string;
  reading_id: string;
  date: string;
  page: number | null;
  percent: number | null;
  minutes: number | null;
};

export type Goal = Timestamps & {
  library_id: string;
  member_id: string;
  year: number;
  target_books: number | null;
  target_pages: number | null;
};

/** Linha de library_members com a library embutida (select=*,library:libraries(*)). */
export type Membership = LibraryMember & { library: Library };
