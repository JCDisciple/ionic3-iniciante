import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/** URL para onde o Supabase devolve o usuário após o link mágico ou o Google. */
export function authRedirectUrl() {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/callback`;
  }
  return Linking.createURL('/auth/callback');
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = authRedirectUrl();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await completeSignInFromUrl(result.url);
  }
}

/** Troca o ?code= (PKCE) de um deep link pela sessão. Só é usado no nativo. */
export async function completeSignInFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const errorDescription = queryParams?.error_description;
  if (typeof errorDescription === 'string') {
    throw new Error(errorDescription);
  }
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  queryClient.clear();
}
