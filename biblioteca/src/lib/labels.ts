import type { CopyFormat, CopyStatus, ReadingOrigin, ReadingStatus } from '@/types/models';

export const FORMAT_LABELS: Record<CopyFormat, string> = {
  physical: 'Físico',
  ebook: 'E-book',
  audiobook: 'Audiobook',
  subscription: 'Assinatura',
};

export const STATUS_LABELS: Record<CopyStatus, string> = {
  active: 'No acervo',
  sold: 'Vendido',
  donated: 'Doado',
  lost: 'Perdido',
  expired: 'Saiu da assinatura',
};

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want: 'Quero ler',
  reading: 'Lendo',
  read: 'Lido',
  abandoned: 'Abandonado',
};

export const ORIGIN_LABELS: Record<ReadingOrigin, string> = {
  own: 'Meu exemplar',
  borrowed: 'Emprestado',
  library: 'Biblioteca pública',
  subscription: 'Assinatura',
  no_longer_owned: 'Já não tenho',
};

/** Plataformas sugeridas por formato (o campo aceita texto livre). */
export const PLATFORMS: Record<Exclude<CopyFormat, 'physical'>, string[]> = {
  ebook: ['Kindle', 'Kobo', 'Google Play Livros', 'Apple Books'],
  audiobook: ['Audible', 'Storytel', 'Spotify', 'Ubook'],
  subscription: ['Kindle Unlimited', 'Skeelo', 'Kobo Plus', 'Storytel'],
};

export const CONDITIONS = ['Novo', 'Ótimo', 'Bom', 'Gasto', 'Danificado'];

export const LANGUAGE_LABELS: Record<string, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
  ja: 'Japonês',
};

export const WISH_PRIORITIES: { value: 1 | 2 | 3; label: string }[] = [
  { value: 3, label: 'Quero muito' },
  { value: 2, label: 'Quero' },
  { value: 1, label: 'Um dia' },
];
