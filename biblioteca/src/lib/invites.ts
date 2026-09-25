import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { safeStorage } from '@/lib/safe-storage';

const PENDING_INVITE_KEY = 'pending-invite-token';

/** Link público do convite. No nativo usa a URL do PWA, se configurada. */
export function inviteUrl(token: string) {
  const path = `/convite/${token}`;
  if (Platform.OS === 'web') return `${window.location.origin}${path}`;
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  return appUrl ? `${appUrl.replace(/\/$/, '')}${path}` : Linking.createURL(path);
}

/** Guarda o convite aberto antes do login, para aceitar depois de entrar. */
export const pendingInvite = {
  get: () => safeStorage.getItem(PENDING_INVITE_KEY),
  set: (token: string) => safeStorage.setItem(PENDING_INVITE_KEY, token),
  clear: () => safeStorage.removeItem(PENDING_INVITE_KEY),
};

const INVITE_ERRORS: Record<string, string> = {
  invite_not_found: 'Convite não encontrado.',
  invite_already_used: 'Este convite já foi usado.',
  invite_expired: 'Este convite expirou. Peça um novo link a quem convidou.',
  invite_email_mismatch: 'Este convite foi enviado para outro e-mail.',
  plan_limit_members:
    'A biblioteca chegou ao limite de pessoas do plano. Peça a quem convidou para conferir o plano.',
};

export function inviteErrorMessage(error: { message?: string } | null | undefined) {
  const message = error?.message ?? '';
  const key = Object.keys(INVITE_ERRORS).find((k) => message.includes(k));
  return key ? INVITE_ERRORS[key] : 'Não foi possível aceitar o convite. Tente novamente.';
}
