import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Muted } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { confirm } from '@/lib/confirm';
import { normalizeKey } from '@/lib/genres';
import { useGenreCounts, useGenres, useInvalidateLibrary } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useCurrentLibrary, useLibrary } from '@/providers/library-provider';
import type { Genre } from '@/types/models';

/** Lista de gêneros da biblioteca. Só o dono cria, renomeia, mescla e exclui (RF8). */
export default function GenresScreen() {
  const current = useCurrentLibrary();
  const { isOwner } = useLibrary();
  const genres = useGenres();
  const counts = useGenreCounts();
  const invalidate = useInvalidateLibrary();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState<Genre | null>(null);

  const list = genres.data ?? [];

  function exists(name: string, exceptId?: string) {
    const key = normalizeKey(name);
    return list.some((g) => g.id !== exceptId && normalizeKey(g.name) === key);
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    if (exists(name)) {
      setError('Já existe um gênero com esse nome.');
      return;
    }
    const { error: insertError } = await supabase
      .from('genres')
      .insert({ library_id: current.library_id, name });
    if (insertError) {
      setError('Não foi possível criar.');
      return;
    }
    setError(null);
    setNewName('');
    invalidate();
  }

  async function rename(genre: Genre, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === genre.name) return;
    if (exists(trimmed, genre.id)) {
      setError(`Já existe “${trimmed}”. Use “Mesclar” para juntar os dois.`);
      return;
    }
    setError(null);
    await supabase.from('genres').update({ name: trimmed }).eq('id', genre.id);
    invalidate();
  }

  async function remove(genre: Genre) {
    const count = counts.data?.get(genre.id) ?? 0;
    const ok = await confirm(
      `Excluir “${genre.name}”?`,
      count > 0
        ? `${count} ${count === 1 ? 'livro perde' : 'livros perdem'} este gênero. Para não perder, use “Mesclar”.`
        : 'Nenhum livro usa este gênero.',
      'Excluir',
    );
    if (!ok) return;
    await supabase.from('genres').delete().eq('id', genre.id);
    invalidate();
  }

  async function merge(targetId: string) {
    if (!merging) return;
    await supabase.rpc('merge_genres', { p_source_id: merging.id, p_target_id: targetId });
    setMerging(null);
    invalidate();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Gêneros' }} />
      <Screen edges={[]}>
        {isOwner ? (
          <View className="gap-2">
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <TextField
                  label="Novo gênero"
                  placeholder="Ex.: Literatura russa"
                  value={newName}
                  onChangeText={setNewName}
                  onSubmitEditing={create}
                  returnKeyType="done"
                  maxLength={60}
                />
              </View>
              <Button title="Criar" onPress={create} disabled={!newName.trim()} />
            </View>
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}
            <Muted>
              Toque no nome para renomear. Categorias das fontes que não casam com nenhum gênero
              viram sugestões na hora de cadastrar.
            </Muted>
          </View>
        ) : (
          <Muted>Só quem é dono da biblioteca edita os gêneros.</Muted>
        )}

        <Card flush>
          {list.map((genre) => (
            <GenreRow
              key={`${genre.id}-${genre.name}`}
              genre={genre}
              count={counts.data?.get(genre.id) ?? 0}
              editable={isOwner}
              onRename={(name) => rename(genre, name)}
              onMerge={() => setMerging(genre)}
              onDelete={() => remove(genre)}
            />
          ))}
        </Card>

        <OptionSheet
          visible={merging !== null}
          title={`Mesclar “${merging?.name ?? ''}” em…`}
          options={list
            .filter((g) => g.id !== merging?.id)
            .map((g) => ({ value: g.id, label: g.name }))}
          selected={[]}
          onSelect={merge}
          onClose={() => setMerging(null)}
        />
      </Screen>
    </>
  );
}

function GenreRow({
  genre,
  count,
  editable,
  onRename,
  onMerge,
  onDelete,
}: {
  genre: Genre;
  count: number;
  editable: boolean;
  onRename: (name: string) => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  const palette = usePalette();
  const [name, setName] = useState(genre.name);

  return (
    <View className="min-h-[56px] flex-row items-center gap-1 border-b border-line pl-4 pr-1">
      {editable ? (
        <TextInput
          accessibilityLabel={`Renomear ${genre.name}`}
          value={name}
          onChangeText={setName}
          onBlur={() => onRename(name)}
          onSubmitEditing={() => onRename(name)}
          returnKeyType="done"
          maxLength={60}
          placeholderTextColor={palette.muted}
          className="flex-1 py-3 text-base text-ink"
        />
      ) : (
        <Text className="flex-1 py-3 text-base text-ink">{genre.name}</Text>
      )}
      <Text className="px-2 text-sm text-muted">{count}</Text>
      {editable ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mesclar ${genre.name}`}
            onPress={onMerge}
            className="h-11 w-11 items-center justify-center">
            <Icon name="git-merge-outline" size={20} color="muted" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${genre.name}`}
            onPress={onDelete}
            className="h-11 w-11 items-center justify-center">
            <Icon name="trash-outline" size={20} color="danger" />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
