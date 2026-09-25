import { formatIsbn } from '@shared/isbn.ts';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { PlanLimitNotice } from '@/components/plan-limit-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Body, Muted } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { batchStore, useBatch, type BatchItem } from '@/lib/batch-store';
import { addToLibrary, findBookByIsbn } from '@/lib/books';
import { vibrateSuccess } from '@/lib/feedback';
import { mapCategories } from '@/lib/genres';
import { planLimitError, type PlanLimitKind } from '@/lib/plans';
import { lookupIsbn } from '@/lib/lookup';
import { useGenreAliases, useGenres, useInvalidateLibrary } from '@/lib/queries';
import { useCurrentLibrary } from '@/providers/library-provider';

const CONCURRENCY = 3;

/** Revisão do modo lote: busca os metadados de cada ISBN e salva tudo de uma vez. */
export default function BatchReviewScreen() {
  const current = useCurrentLibrary();
  const items = useBatch();
  const genres = useGenres();
  const aliases = useGenreAliases();
  const invalidate = useInvalidateLibrary();
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [limit, setLimit] = useState<PlanLimitKind | null>(null);
  const inFlight = useRef(new Set<string>());

  // Busca os pendentes, no máximo 3 por vez.
  useEffect(() => {
    const pending = items.filter((i) => i.state === 'pending' && !inFlight.current.has(i.isbn13));
    const slots = CONCURRENCY - inFlight.current.size;
    for (const item of pending.slice(0, Math.max(0, slots))) {
      inFlight.current.add(item.isbn13);
      resolveItem(current.library_id, item.isbn13).finally(() =>
        inFlight.current.delete(item.isbn13),
      );
    }
  }, [items, current.library_id]);

  const ready = items.filter((i) => i.state === 'found');
  const resolving = items.some((i) => i.state === 'pending');

  async function saveAll() {
    setSaving(true);
    let saved = 0;
    for (const item of ready) {
      if (!item.book?.title) continue;
      const { genreIds } = mapCategories(
        item.book.categories,
        genres.data ?? [],
        aliases.data ?? [],
      );
      try {
        await addToLibrary({
          libraryId: current.library_id,
          book: {
            isbn_13: item.isbn13,
            isbn_10: item.book.isbn_10,
            title: item.book.title,
            subtitle: item.book.subtitle,
            authors: item.book.authors,
            publisher: item.book.publisher,
            year: item.book.year,
            pages: item.book.pages,
            language: item.book.language,
            cover_url: item.book.cover_url,
            source: item.book.source ?? 'manual',
          },
          genreIds,
          copy: {
            format: 'physical',
            platform: null,
            location: location.trim() || null,
            condition: null,
            acquired_at: null,
            price: null,
          },
          reading: null,
        });
        batchStore.update(item.isbn13, { state: 'saved' });
        saved++;
      } catch (e) {
        const reached = planLimitError(e);
        batchStore.update(item.isbn13, { state: reached ? 'found' : 'error' });
        if (reached) {
          setLimit(reached);
          break;
        }
      }
    }
    setSaving(false);
    setSavedCount((n) => n + saved);
    if (saved > 0) {
      vibrateSuccess();
      invalidate();
    }
  }

  function finish() {
    batchStore.clearSaved();
    router.dismissTo('/biblioteca');
  }

  const visible = items.filter((i) => i.state !== 'saved');

  return (
    <>
      <Stack.Screen options={{ title: 'Revisar lote' }} />
      <Screen edges={[]}>
        {savedCount > 0 ? (
          <Card className="flex-row items-center gap-3 border-success/40">
            <Icon name="checkmark-circle" color="success" />
            <Body className="flex-1">
              {savedCount} {savedCount === 1 ? 'livro salvo' : 'livros salvos'} na estante.
            </Body>
            {visible.length === 0 ? <Button title="Concluir" onPress={finish} /> : null}
          </Card>
        ) : null}

        {limit ? <PlanLimitNotice kind={limit} /> : null}

        {visible.length === 0 && savedCount === 0 ? (
          <EmptyState
            icon="layers-outline"
            title="Fila vazia"
            message="Ligue o modo lote no scanner e leia vários livros em sequência."
            action={
              <Button title="Abrir scanner" onPress={() => router.replace('/scanner?lote=1')} />
            }
          />
        ) : null}

        {visible.length > 0 ? (
          <>
            <TextField
              label="Onde eles ficam? (opcional)"
              placeholder="Ex.: Sala, estante 2"
              value={location}
              onChangeText={setLocation}
              hint="Vale para todos os livros deste lote. Cada um entra como exemplar físico."
            />

            <Card flush>
              {visible.map((item) => (
                <BatchRow key={item.isbn13} item={item} />
              ))}
            </Card>

            <View className="gap-3">
              <Button
                title={
                  resolving
                    ? 'Buscando dados…'
                    : ready.length === 0
                      ? 'Nada pronto para salvar'
                      : `Salvar ${ready.length} ${ready.length === 1 ? 'livro' : 'livros'}`
                }
                icon="checkmark"
                loading={saving}
                disabled={ready.length === 0 || resolving}
                onPress={saveAll}
              />
              <Button
                title="Continuar escaneando"
                variant="secondary"
                icon="barcode-outline"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/scanner?lote=1')
                }
              />
              <Muted className="text-center">
                Livros não encontrados ou que já estão no acervo ficam de fora. Toque em um item
                para completar os dados.
              </Muted>
            </View>
          </>
        ) : null}
      </Screen>
    </>
  );
}

async function resolveItem(libraryId: string, isbn13: string) {
  try {
    const existing = await findBookByIsbn(libraryId, isbn13);
    if (existing) {
      batchStore.update(isbn13, {
        state: 'exists',
        existingBookId: existing.id,
        book: { ...emptyData(isbn13), title: existing.title },
      });
      return;
    }
    const result = await lookupIsbn(isbn13);
    batchStore.update(isbn13, {
      state: result.found ? 'found' : 'not_found',
      book: result.book,
    });
  } catch {
    batchStore.update(isbn13, { state: 'error' });
  }
}

function emptyData(isbn13: string) {
  return {
    isbn_13: isbn13,
    isbn_10: null,
    title: null,
    subtitle: null,
    authors: [],
    publisher: null,
    year: null,
    pages: null,
    language: null,
    cover_url: null,
    categories: [],
    source: null,
  };
}

const STATE_LABELS: Record<BatchItem['state'], string> = {
  pending: 'Buscando…',
  found: 'Pronto',
  not_found: 'Não encontrado — complete à mão',
  error: 'Falhou — toque para tentar de novo',
  exists: 'Já está no acervo',
  saved: 'Salvo',
};

function BatchRow({ item }: { item: BatchItem }) {
  const palette = usePalette();
  const title = item.book?.title;

  function open() {
    if (item.state === 'error') {
      batchStore.update(item.isbn13, { state: 'pending' });
      return;
    }
    if (item.state === 'exists' && item.existingBookId) {
      router.push(`/livro/${item.existingBookId}`);
      return;
    }
    router.push({ pathname: '/livro/novo', params: { isbn: item.isbn13, lote: '1' } });
  }

  return (
    <View className="flex-row items-center gap-3 border-b border-line px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title ? `Revisar ${title}` : `Revisar ISBN ${item.isbn13}`}
        onPress={open}
        disabled={item.state === 'pending'}
        className="flex-1 flex-row items-center gap-3">
        {item.state === 'pending' ? (
          <View className="h-[66px] w-11 items-center justify-center rounded-md bg-sunken">
            <ActivityIndicator color={palette.muted} />
          </View>
        ) : (
          <BookCover
            book={{
              title: title ?? '?',
              authors: item.book?.authors ?? [],
              cover_url: item.book?.cover_url ?? null,
            }}
            width={44}
          />
        )}
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>
            {title ?? formatIsbn(item.isbn13)}
          </Text>
          {item.book?.authors[0] ? (
            <Text className="text-sm text-muted" numberOfLines={1}>
              {item.book.authors.join(', ')}
            </Text>
          ) : null}
          <Text
            className={`text-xs ${
              item.state === 'found'
                ? 'text-success'
                : item.state === 'not_found' || item.state === 'error'
                  ? 'text-danger'
                  : 'text-muted'
            }`}>
            {STATE_LABELS[item.state]}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tirar da fila"
        onPress={() => batchStore.remove(item.isbn13)}
        className="h-11 w-11 items-center justify-center">
        <Icon name="close-circle-outline" size={22} color="muted" />
      </Pressable>
    </View>
  );
}
