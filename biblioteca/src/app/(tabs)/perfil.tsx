import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Heading, Label, Muted } from '@/components/ui/typography';
import { usePush } from '@/hooks/use-push';
import { signOut } from '@/lib/auth';
import { queryKeys } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useCurrentLibrary, useLibrary } from '@/providers/library-provider';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { memberships, selectLibrary, refresh, isOwner } = useLibrary();
  const current = useCurrentLibrary();
  const queryClient = useQueryClient();
  const push = usePush();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(current.display_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    if (!name.trim()) {
      setError('O nome não pode ficar vazio.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from('library_members')
      .update({ display_name: name.trim() })
      .eq('id', current.id);
    setSaving(false);
    if (updateError) {
      setError('Não foi possível salvar.');
      return;
    }
    setError(null);
    setEditingName(false);
    await refresh();
    queryClient.invalidateQueries({ queryKey: queryKeys.members(current.library_id) });
  }

  return (
    <Screen>
      <View className="gap-1">
        <Heading>{current.display_name}</Heading>
        <Muted>{user?.email}</Muted>
      </View>

      {editingName ? (
        <Card className="gap-3">
          <TextField
            label="Seu nome na família"
            value={name}
            onChangeText={setName}
            maxLength={60}
            error={error}
            autoFocus
          />
          <View className="flex-row gap-3">
            <Button
              title="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setEditingName(false)}
            />
            <Button title="Salvar" className="flex-1" loading={saving} onPress={saveName} />
          </View>
        </Card>
      ) : null}

      <View className="gap-2">
        <Label className="px-1">Biblioteca</Label>
        <Card flush>
          <ListItem
            icon="people-outline"
            title="Família e convites"
            subtitle={current.library.name}
            badge={isOwner ? 'Dono' : 'Membro'}
            onPress={() => router.push('/familia')}
          />
          {memberships.length > 1
            ? memberships
                .filter((m) => m.library_id !== current.library_id)
                .map((m) => (
                  <ListItem
                    key={m.id}
                    icon="swap-horizontal-outline"
                    title={`Trocar para ${m.library.name}`}
                    onPress={() => selectLibrary(m.library_id)}
                  />
                ))
            : null}
        </Card>
      </View>

      <View className="gap-2">
        <Label className="px-1">Conta</Label>
        <Card flush>
          <ListItem
            icon="create-outline"
            title="Editar meu nome"
            onPress={() => setEditingName(true)}
          />
          <ListItem icon="contrast-outline" title="Tema" subtitle="Automático, segue o sistema" />
        </Card>
      </View>

      <View className="gap-2">
        <Label className="px-1">Acervo</Label>
        <Card flush>
          <ListItem
            icon="pricetags-outline"
            title="Gêneros"
            subtitle={isOwner ? 'Criar, renomear e mesclar' : 'Ver a lista da casa'}
            onPress={() => router.push('/generos')}
          />
          <ListItem
            icon="hand-right-outline"
            title="Emprestados"
            onPress={() => router.push('/emprestados')}
          />
          {push.state !== 'unsupported' && push.state !== 'loading' ? (
            <ListItem
              icon={push.state === 'enabled' ? 'notifications' : 'notifications-outline'}
              title="Lembretes de devolução"
              subtitle={
                push.state === 'enabled'
                  ? 'Ativados neste aparelho — toque para desativar'
                  : push.state === 'denied'
                    ? 'Bloqueados nas permissões do navegador'
                    : 'Toque para ativar neste aparelho'
              }
              onPress={push.state === 'denied' || push.busy ? undefined : push.toggle}
            />
          ) : null}
        </Card>
      </View>

      <View className="gap-2">
        <Label className="px-1">Em breve</Label>
        <Card flush>
          <ListItem icon="flag-outline" title="Metas de leitura" badge="Em breve" />
          <ListItem icon="cloud-upload-outline" title="Importar e exportar" badge="Em breve" />
        </Card>
      </View>

      <Card flush>
        <ListItem icon="log-out-outline" title="Sair" destructive onPress={signOut} />
      </Card>
    </Screen>
  );
}
