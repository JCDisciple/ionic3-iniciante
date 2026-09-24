import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Body, Heading, Muted } from '@/components/ui/typography';

/** Exibida quando o .env.local ainda não tem as chaves do Supabase. */
export function SetupNotice({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);

  return (
    <Screen>
      <View className="gap-2 pt-8">
        <Heading>Quase lá</Heading>
        <Body>O app ainda não está conectado ao Supabase.</Body>
      </View>
      <Card className="gap-3">
        <Muted>1. Copie o arquivo .env.example para .env.local</Muted>
        <Muted>2. Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY</Muted>
        <Muted>3. Aplique as migrações: npx supabase db push</Muted>
        <Muted>4. Reinicie o servidor: npx expo start</Muted>
      </Card>
      <Text className="text-xs text-muted">Veja o README.md para o passo a passo completo.</Text>
    </Screen>
  );
}
