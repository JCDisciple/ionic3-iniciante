import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PlanLimitNotice } from '@/components/plan-limit-notice';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Body, Label, Muted, serif } from '@/components/ui/typography';
import { confirm } from '@/lib/confirm';
import { inviteUrl } from '@/lib/invites';
import { planLimitError, type PlanLimitKind } from '@/lib/plans';
import { queryKeys, useMembers, useOpenInvites } from '@/lib/queries';
import { shareLink } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useCurrentLibrary, useLibrary } from '@/providers/library-provider';
import type { LibraryInvite, LibraryMember } from '@/types/models';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function FamilyScreen() {
  const { user } = useAuth();
  const { isOwner, refresh } = useLibrary();
  const current = useCurrentLibrary();
  const queryClient = useQueryClient();
  const members = useMembers();
  const invites = useOpenInvites(isOwner);

  const [libraryName, setLibraryName] = useState(current.library.name);
  const [inviteEmail, setInviteEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [limit, setLimit] = useState<PlanLimitKind | null>(null);

  const invalidateInvites = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.invites(current.library_id) });
  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.members(current.library_id) });

  const createInvite = useMutation({
    mutationFn: async (email: string | null) => {
      const { data, error } = await supabase
        .from('library_invites')
        .insert({ library_id: current.library_id, invited_by: user!.id, email })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryInvite;
    },
    onSuccess: invalidateInvites,
  });

  async function shareInvite(invite: LibraryInvite) {
    const url = inviteUrl(invite.token);
    const result = await shareLink(`Entre na ${current.library.name} no app Biblioteca:`, url);
    setNotice(result === 'copied' ? 'Link copiado. Envie para quem você quer convidar.' : null);
  }

  async function handleLinkInvite() {
    try {
      const invite = await createInvite.mutateAsync(null);
      await shareInvite(invite);
    } catch (e) {
      setLimit(planLimitError(e));
      if (!planLimitError(e)) setNotice('Não foi possível criar o convite. Tente de novo.');
    }
  }

  async function handleEmailInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Digite um e-mail válido.');
      return;
    }
    setEmailError(null);
    let invite: LibraryInvite;
    try {
      invite = await createInvite.mutateAsync(email);
    } catch (e) {
      setLimit(planLimitError(e));
      if (!planLimitError(e)) setEmailError('Não foi possível criar o convite. Tente de novo.');
      return;
    }
    setInviteEmail('');
    const subject = encodeURIComponent(`Convite para a ${current.library.name}`);
    const body = encodeURIComponent(
      `Oi! Estou te convidando para a nossa biblioteca no app Biblioteca.\n\nAbra este link e entre com este e-mail (${email}):\n${inviteUrl(invite.token)}`,
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() =>
      setNotice('Convite criado. Compartilhe o link abaixo por mensagem.'),
    );
  }

  async function revokeInvite(invite: LibraryInvite) {
    await supabase.from('library_invites').delete().eq('id', invite.id);
    invalidateInvites();
  }

  async function removeMember(member: LibraryMember) {
    const ok = await confirm(
      `Remover ${member.display_name}?`,
      'A pessoa perde o acesso ao acervo da casa, e as leituras e metas dela nesta biblioteca serão apagadas.',
      'Remover',
    );
    if (!ok) return;
    await supabase.from('library_members').delete().eq('id', member.id);
    invalidateMembers();
  }

  async function leaveLibrary() {
    const ok = await confirm(
      'Sair desta biblioteca?',
      'Você perde o acesso ao acervo, e suas leituras e metas nesta biblioteca serão apagadas.',
      'Sair',
    );
    if (!ok) return;
    await supabase.from('library_members').delete().eq('id', current.id);
    await refresh();
    router.replace('/');
  }

  async function saveLibraryName() {
    const name = libraryName.trim();
    if (!name || name === current.library.name) return;
    await supabase.from('libraries').update({ name }).eq('id', current.library_id);
    await refresh();
  }

  return (
    <Screen edges={[]}>
      <View className="gap-2">
        <Label className="px-1">Pessoas</Label>
        <Card flush>
          {(members.data ?? []).map((member) => (
            <View key={member.id} className="min-h-[56px] flex-row items-center gap-3 px-4 py-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-sunken">
                <Text className="text-base font-semibold text-accent" style={serif}>
                  {member.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Body>
                  {member.display_name}
                  {member.user_id === user?.id ? ' (você)' : ''}
                </Body>
                <Muted>{member.role === 'owner' ? 'Dono' : 'Membro'}</Muted>
              </View>
              {isOwner && member.user_id !== user?.id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${member.display_name}`}
                  onPress={() => removeMember(member)}
                  className="h-11 w-11 items-center justify-center">
                  <Icon name="person-remove-outline" size={20} color="danger" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>
        <Muted className="px-1">
          O acervo e os empréstimos são compartilhados. Leituras, notas e metas são de cada pessoa.
        </Muted>
      </View>

      {isOwner ? (
        <>
          <View className="gap-3">
            <Label className="px-1">Convidar</Label>
            <Button
              title="Compartilhar link de convite"
              icon="link-outline"
              loading={createInvite.isPending && createInvite.variables === null}
              onPress={handleLinkInvite}
            />
            <Card className="gap-3">
              <TextField
                label="Convidar por e-mail"
                placeholder="pessoa@exemplo.com"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                inputMode="email"
                error={emailError}
                hint="O convite só vale para este e-mail."
              />
              <Button
                title="Enviar convite"
                variant="secondary"
                icon="mail-outline"
                loading={createInvite.isPending && createInvite.variables !== null}
                onPress={handleEmailInvite}
              />
            </Card>
            {notice ? <Muted className="px-1 text-success">{notice}</Muted> : null}
            {limit ? <PlanLimitNotice kind={limit} /> : null}
          </View>

          {invites.data && invites.data.length > 0 ? (
            <View className="gap-2">
              <Label className="px-1">Convites em aberto</Label>
              <Card flush>
                {invites.data.map((invite) => (
                  <View
                    key={invite.id}
                    className="min-h-[56px] flex-row items-center gap-2 px-4 py-2">
                    <View className="flex-1">
                      <Body numberOfLines={1}>{invite.email ?? 'Link de convite'}</Body>
                      <Muted>Vale até {formatDate(invite.expires_at)} · uso único</Muted>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Compartilhar convite"
                      onPress={() => shareInvite(invite)}
                      className="h-11 w-11 items-center justify-center">
                      <Icon name="share-outline" size={20} color="accent" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar convite"
                      onPress={() => revokeInvite(invite)}
                      className="h-11 w-11 items-center justify-center">
                      <Icon name="close-circle-outline" size={20} color="muted" />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <View className="gap-3">
            <Label className="px-1">Biblioteca</Label>
            <Card className="gap-3">
              <TextField
                label="Nome da biblioteca"
                value={libraryName}
                onChangeText={setLibraryName}
                maxLength={80}
                onBlur={saveLibraryName}
                onSubmitEditing={saveLibraryName}
                returnKeyType="done"
              />
              <Muted>Plano: {current.library.plan === 'pro' ? 'Pro' : 'Gratuito'}</Muted>
            </Card>
          </View>
        </>
      ) : (
        <Button
          title="Sair desta biblioteca"
          variant="danger"
          icon="exit-outline"
          onPress={leaveLibrary}
        />
      )}
    </Screen>
  );
}
