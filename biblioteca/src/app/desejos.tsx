import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { CopyFields } from '@/components/book/copy-fields';
import { PlanLimitNotice } from '@/components/plan-limit-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Body, Label, Muted, Subheading } from '@/components/ui/typography';
import { emptyCopyForm, validateCopy, type FormErrors } from '@/lib/book-form';
import { fulfillWish, removeWish } from '@/lib/books';
import { confirm } from '@/lib/confirm';
import { vibrateSuccess } from '@/lib/feedback';
import { WISH_PRIORITIES } from '@/lib/labels';
import { planLimitError, type PlanLimitKind } from '@/lib/plans';
import { useInvalidateLibrary, useWishes, type WishWithBook } from '@/lib/queries';
import { shareText } from '@/lib/share';
import { useCurrentLibrary } from '@/providers/library-provider';

const priorityLabel = (p: number) => WISH_PRIORITIES.find((w) => w.value === p)?.label ?? '';

/** Lista de desejos: a minha e a da família (ideias de presente). */
export default function WishesScreen() {
  const current = useCurrentLibrary();
  const wishes = useWishes();
  const invalidate = useInvalidateLibrary();
  const [scope, setScope] = useState<'mine' | 'family'>('mine');
  const [buying, setBuying] = useState<WishWithBook | null>(null);
  const [copied, setCopied] = useState(false);

  const all = wishes.data ?? [];
  const mine = all.filter((w) => w.member_id === current.id);
  const others = all.filter((w) => w.member_id !== current.id);
  const byPerson = new Map<string, WishWithBook[]>();
  for (const w of others) {
    const name = w.member?.display_name ?? 'Alguém';
    byPerson.set(name, [...(byPerson.get(name) ?? []), w]);
  }

  async function share() {
    const lines = mine.map(
      (w) =>
        `• ${w.book.title}${w.book.authors[0] ? ` — ${w.book.authors[0]}` : ''}${w.note ? ` (${w.note})` : ''}`,
    );
    const result = await shareText(`Minha lista de desejos de livros:\n${lines.join('\n')}`);
    if (result === 'copied') setCopied(true);
  }

  async function remove(wish: WishWithBook) {
    const ok = await confirm(
      'Tirar da lista?',
      `“${wish.book.title}” sai da sua lista de desejos.`,
      'Tirar',
    );
    if (!ok) return;
    await removeWish(wish.id);
    invalidate();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Lista de desejos' }} />
      <Screen edges={[]}>
        <SegmentedControl
          accessibilityLabel="Lista"
          options={[
            { value: 'mine', label: `Minha (${mine.length})` },
            { value: 'family', label: `Da família (${others.length})` },
          ]}
          value={scope}
          onChange={setScope}
        />

        {scope === 'mine' ? (
          mine.length === 0 ? (
            <EmptyState
              icon="gift-outline"
              title="Sua lista está vazia"
              message="Escaneie ou busque um livro e escolha “Quero ter”. A família vê a lista — ótimo para presentes."
              action={
                <Button
                  title="Buscar livro"
                  icon="search"
                  onPress={() => router.push('/livro/buscar')}
                />
              }
            />
          ) : (
            <>
              {mine.map((w) => (
                <WishCard
                  key={w.id}
                  wish={w}
                  onBuy={() => setBuying(w)}
                  onRemove={() => remove(w)}
                />
              ))}
              {copied ? (
                <Muted className="text-center">Lista copiada. Cole onde quiser.</Muted>
              ) : null}
              <Button
                title="Compartilhar minha lista"
                variant="secondary"
                icon="share-social-outline"
                onPress={share}
              />
            </>
          )
        ) : byPerson.size === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Ninguém mais tem desejos"
            message="Quando a família adicionar livros à lista, eles aparecem aqui."
          />
        ) : (
          [...byPerson.entries()].map(([name, list]) => (
            <View key={name} className="gap-2">
              <Label className="px-1">{name}</Label>
              {list.map((w) => (
                <WishCard key={w.id} wish={w} onBuy={() => setBuying(w)} gift />
              ))}
            </View>
          ))
        )}

        {buying ? (
          <BuySheet
            wish={buying}
            onCancel={() => setBuying(null)}
            onDone={() => {
              setBuying(null);
              invalidate();
            }}
          />
        ) : null}
      </Screen>
    </>
  );
}

function WishCard({
  wish,
  onBuy,
  onRemove,
  gift = false,
}: {
  wish: WishWithBook;
  onBuy: () => void;
  onRemove?: () => void;
  gift?: boolean;
}) {
  return (
    <Card className="gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/livro/${wish.book_id}`)}
        className="flex-row gap-3">
        <BookCover book={wish.book} width={52} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>
            {wish.book.title}
          </Text>
          {wish.book.authors.length ? (
            <Muted numberOfLines={1}>{wish.book.authors.join(', ')}</Muted>
          ) : null}
          <Text className="text-xs font-semibold text-accent">{priorityLabel(wish.priority)}</Text>
          {wish.note ? <Muted>{wish.note}</Muted> : null}
        </View>
      </Pressable>
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={gift ? 'Dei de presente' : 'Comprei'}
          icon="bag-check-outline"
          onPress={onBuy}
        />
        {onRemove ? <Chip label="Tirar da lista" icon="close" onPress={onRemove} /> : null}
      </View>
    </Card>
  );
}

/** "Comprei": escolhe o formato e o livro entra no acervo. */
function BuySheet({
  wish,
  onCancel,
  onDone,
}: {
  wish: WishWithBook;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [copy, setCopy] = useState(emptyCopyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState<PlanLimitKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const result = validateCopy(copy);
    setErrors(result.errors);
    if (!result.input) return;
    setSaving(true);
    try {
      await fulfillWish(wish.id, result.input);
      vibrateSuccess();
      onDone();
    } catch (e) {
      setLimit(planLimitError(e));
      if (!planLimitError(e)) setError('Não foi possível salvar. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <Card className="gap-4 border-accent/40">
      <Subheading>“{wish.book.title}” chegou!</Subheading>
      <Body>Como ele entra no acervo?</Body>
      <CopyFields
        values={copy}
        errors={errors}
        onChange={(patch) => setCopy((c) => ({ ...c, ...patch }))}
      />
      {limit ? <PlanLimitNotice kind={limit} /> : null}
      {error ? <Body className="text-danger">{error}</Body> : null}
      <View className="flex-row gap-3">
        <Button title="Cancelar" variant="secondary" className="flex-1" onPress={onCancel} />
        <Button title="Pôr na estante" className="flex-1" loading={saving} onPress={save} />
      </View>
    </Card>
  );
}
