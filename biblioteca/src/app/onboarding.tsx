import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Body, Heading, Muted } from '@/components/ui/typography';
import { signOut } from '@/lib/auth';
import { pendingInvite } from '@/lib/invites';
import { useAuth } from '@/providers/auth-provider';
import { useLibrary } from '@/providers/library-provider';

/** Primeiro acesso: criar a biblioteca da casa (ou seguir um convite pendente). */
export default function OnboardingScreen() {
  const { user } = useAuth();
  const { createLibrary, error: loadError, refresh } = useLibrary();
  const suggestedName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';

  const [displayName, setDisplayName] = useState(suggestedName);
  const [libraryName, setLibraryName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    pendingInvite.get().then(setInviteToken);
  }, []);

  async function handleCreate() {
    if (!displayName.trim()) {
      setError('Como você quer ser chamado?');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const name = libraryName.trim() || `Biblioteca de ${displayName.trim()}`;
      await createLibrary(name, displayName);
    } catch {
      setError('Não foi possível criar a biblioteca. Tente novamente.');
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-4">
          <Body className="text-center">{loadError}</Body>
          <Button title="Tentar novamente" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="gap-2 pt-6">
        <Heading>Boas-vindas!</Heading>
        <Muted className="text-base">
          Vamos criar a biblioteca da sua casa. O acervo é compartilhado com a família; leituras e
          metas são de cada pessoa.
        </Muted>
      </View>

      {inviteToken ? (
        <Card className="flex-row items-center gap-3">
          <Icon name="mail-unread-outline" color="accent" />
          <View className="flex-1">
            <Body className="font-semibold">Você tem um convite pendente</Body>
            <Muted>Entre na biblioteca de quem convidou em vez de criar uma nova.</Muted>
          </View>
          <Button
            title="Ver"
            variant="secondary"
            onPress={() => router.push(`/convite/${inviteToken}`)}
          />
        </Card>
      ) : null}

      <View className="gap-4">
        <TextField
          label="Seu nome"
          placeholder="Como a família te chama"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="given-name"
          maxLength={60}
          error={error}
        />
        <TextField
          label="Nome da biblioteca"
          placeholder={
            displayName.trim() ? `Biblioteca de ${displayName.trim()}` : 'Biblioteca da família'
          }
          value={libraryName}
          onChangeText={setLibraryName}
          maxLength={80}
          hint="Você pode mudar depois no Perfil."
        />
        <Button
          title="Criar biblioteca"
          icon="library-outline"
          loading={saving}
          onPress={handleCreate}
        />
      </View>

      <View className="mt-auto items-center">
        <Muted>Entrou como {user?.email}</Muted>
        <Button title="Sair" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
