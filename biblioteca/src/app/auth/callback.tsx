import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Body, Muted } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { pendingInvite } from '@/lib/invites';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/**
 * Destino do link mágico e do OAuth. Na web o supabase-js já troca o ?code=
 * pela sessão ao carregar; no nativo trocamos aqui a partir do deep link.
 */
export default function AuthCallbackScreen() {
  const palette = usePalette();
  const { session } = useAuth();
  const { code, error_description } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [exchangeFailed, setExchangeFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !code || session) return;
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setExchangeFailed(true);
    });
  }, [code, session]);

  useEffect(() => {
    if (!session) return;
    pendingInvite.get().then((token) => {
      router.replace(token ? `/convite/${token}` : '/');
    });
  }, [session]);

  const failed = !session && (exchangeFailed || !!error_description);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
      {failed ? (
        <>
          <Body className="text-center font-semibold">O link expirou ou já foi usado.</Body>
          <Muted className="text-center">Peça um novo link na tela de entrada.</Muted>
          <Button title="Voltar para a entrada" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={palette.accent} size="large" />
          <Muted>Entrando…</Muted>
        </>
      )}
    </View>
  );
}
