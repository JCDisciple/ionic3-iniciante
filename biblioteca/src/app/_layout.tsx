import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SetupNotice } from '@/components/setup-notice';
import { navigationTheme } from '@/constants/theme';
import { useScheme } from '@/hooks/use-palette';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { LibraryProvider, useLibrary } from '@/providers/library-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useScheme();

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {isSupabaseConfigured ? (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LibraryProvider>
              <RootNavigator />
            </LibraryProvider>
          </AuthProvider>
        </QueryClientProvider>
      ) : (
        <SetupNotice onReady={() => SplashScreen.hideAsync()} />
      )}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session } = useAuth();
  const { current, isLoading } = useLibrary();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  const signedIn = !!session;
  const hasLibrary = signedIn && !!current;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasLibrary}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={hasLibrary}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="scanner"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="familia" options={{ headerShown: true, title: 'Família' }} />
        <Stack.Screen name="lote" options={{ headerShown: true }} />
        <Stack.Screen name="livro/novo" options={{ headerShown: true }} />
        <Stack.Screen name="livro/buscar" options={{ headerShown: true }} />
        <Stack.Screen name="livro/[id]/index" options={{ headerShown: true }} />
        <Stack.Screen name="livro/[id]/editar" options={{ headerShown: true }} />
        <Stack.Screen
          name="emprestar/[copyId]"
          options={{ headerShown: true, presentation: 'modal' }}
        />
        <Stack.Screen name="emprestados" options={{ headerShown: true }} />
        <Stack.Screen name="generos" options={{ headerShown: true }} />
        <Stack.Screen name="leitura/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="metas" options={{ headerShown: true }} />
        <Stack.Screen name="resumo" options={{ headerShown: true, title: 'Meu ano em leituras' }} />
        <Stack.Screen name="leitura/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="metas" options={{ headerShown: true }} />
        <Stack.Screen name="resumo" options={{ headerShown: true, title: 'Meu ano em leituras' }} />
      </Stack.Protected>

      {/* Acessíveis em qualquer estado: retorno do login e links de convite. */}
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="convite/[token]" />
    </Stack>
  );
}
