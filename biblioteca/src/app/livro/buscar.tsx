import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Muted } from '@/components/ui/typography';
import { MaxContentWidth } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { putDraft } from '@/lib/draft-store';
import { searchBooks } from '@/lib/lookup';
import type { BookData } from '@/types/models';

/** Cadastro manual, passo 1: procurar por título/autor antes do formulário vazio (RF2). */
export default function SearchBookScreen() {
  const palette = usePalette();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');

  const results = useQuery({
    queryKey: ['book-search', term],
    enabled: term.length >= 2,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: () => searchBooks(term),
  });

  function choose(book: BookData) {
    const draft = putDraft(book);
    router.push({
      pathname: '/livro/novo',
      params: book.isbn_13 ? { draft, isbn: book.isbn_13 } : { draft },
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Buscar livro' }} />
      <View className="w-full flex-1 self-center bg-paper" style={{ maxWidth: MaxContentWidth }}>
        <View className="gap-2 px-4 pt-4">
          <View className="min-h-[48px] flex-row items-center gap-2 rounded-card border border-line bg-surface px-4">
            <Icon name="search" size={18} color="muted" />
            <TextInput
              accessibilityLabel="Título ou autor"
              placeholder="Título ou autor"
              placeholderTextColor={palette.muted}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => setTerm(text.trim())}
              returnKeyType="search"
              autoFocus
              className="flex-1 py-3 text-base text-ink"
            />
          </View>
          <Muted>Busca no Google Books e na Open Library.</Muted>
        </View>

        {results.isFetching ? (
          <ActivityIndicator className="mt-8" color={palette.accent} />
        ) : (
          <FlatList
            data={results.data ?? []}
            keyExtractor={(book, i) => `${book.isbn_13 ?? book.title}-${i}`}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(item)}
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3 active:bg-sunken">
                <BookCover
                  book={{
                    title: item.title ?? '?',
                    authors: item.authors,
                    cover_url: item.cover_url,
                  }}
                  width={48}
                />
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-ink" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text className="text-sm text-muted" numberOfLines={1}>
                    {[item.authors.join(', '), item.year].filter(Boolean).join(' · ')}
                  </Text>
                  {item.publisher ? (
                    <Text className="text-xs text-muted" numberOfLines={1}>
                      {item.publisher}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={18} color="muted" />
              </Pressable>
            )}
            ListEmptyComponent={
              term ? (
                <EmptyState
                  icon="search"
                  title={results.isError ? 'A busca falhou' : 'Nada encontrado'}
                  message={
                    results.isError
                      ? 'Verifique a conexão e tente de novo, ou cadastre à mão.'
                      : `Nenhum resultado para “${term}”.`
                  }
                />
              ) : null
            }
            ListFooterComponent={
              <View className="pt-4">
                <Button
                  title="Cadastrar manualmente"
                  variant="secondary"
                  icon="create-outline"
                  onPress={() => router.push('/livro/novo')}
                />
              </View>
            }
          />
        )}
      </View>
    </>
  );
}
