import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Body, Heading, Muted, serif } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { inviteErrorMessage, pendingInvite } from '@/lib/invites';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useLibrary } from '@/providers/library-provider';
import type { InvitePreview } from '@/types/models';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, user } = useAuth();
  const { acceptInvite, memberships } = useLibrary();
  const palette = usePalette();

  const validToken = typeof token === 'string' && UUID_PATTERN.test(token);

  const inviteQuery = useQuery({
    queryKey: ['invite', token],
    enabled: validToken && !!session,
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_invite', { p_token: token });
      if (rpcError) throw rpcError;
      return ((data ?? []) as InvitePreview[])[0] ?? null;
    },
  });
  const invite = inviteQuery.data ?? null;
  const loading = inviteQuery.isLoading;

  const [displayName, setDisplayName] = useState(
    () =>
      memberships[0]?.display_name ??
      (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
      '',
  );
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Sem login ainda: guarda o convite para aceitar depois de entrar.
  useEffect(() => {
    if (validToken && !session) pendingInvite.set(token);
  }, [token, validToken, session]);

  async function handleAccept() {
    if (!displayName.trim()) {
      setError('Como você quer ser chamado?');
      return;
    }
    setError(null);
    setAccepting(true);
    try {
      await acceptInvite(token, displayName);
      await pendingInvite.clear();
      router.replace('/');
    } catch (e) {
      setError(inviteErrorMessage(e as { message?: string }));
      setAccepting(false);
    }
  }

  async function handleDecline() {
    await pendingInvite.clear();
    router.replace('/');
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 justify-center gap-6 py-8">
        <View className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-sunken">
            <Icon name="people" size={30} color="accent" />
          </View>
          <Heading className="text-center">Convite para a família</Heading>
        </View>

        {!validToken ? (
          <InviteProblem message="Este link de convite é inválido." />
        ) : !session ? (
          <Card className="gap-4">
            <Body className="text-center">
              Entre ou crie sua conta para aceitar o convite. Guardamos o link para você.
            </Body>
            <Button title="Entrar" onPress={() => router.replace('/login')} />
          </Card>
        ) : !invite ? (
          <InviteProblem message="Convite não encontrado." />
        ) : invite.status !== 'valid' ? (
          <InviteProblem
            message={
              invite.status === 'expired'
                ? 'Este convite expirou. Peça um novo link a quem convidou.'
                : 'Este convite já foi usado.'
            }
          />
        ) : (
          <Card className="gap-4">
            <Body className="text-center">
              {invite.invited_by_name ?? 'Alguém'} convidou você para a{' '}
              <Body className="font-semibold" style={serif}>
                {invite.library_name}
              </Body>
              .
            </Body>
            <Muted className="text-center">
              Vocês vão compartilhar o acervo e os empréstimos. Suas leituras e metas continuam
              suas.
            </Muted>
            <TextField
              label="Seu nome na família"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={60}
              error={error}
            />
            <Button title="Aceitar convite" loading={accepting} onPress={handleAccept} />
            <Button title="Agora não" variant="ghost" onPress={handleDecline} />
          </Card>
        )}
      </View>
    </Screen>
  );
}

function InviteProblem({ message }: { message: string }) {
  async function goHome() {
    await pendingInvite.clear();
    router.replace('/');
  }
  return (
    <Card className="gap-4">
      <Body className="text-center">{message}</Body>
      <Button title="Continuar" variant="secondary" onPress={goHome} />
    </Card>
  );
}
