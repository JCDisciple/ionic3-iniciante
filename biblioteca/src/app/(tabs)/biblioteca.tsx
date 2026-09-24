import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Heading } from '@/components/ui/typography';
import { MaxContentWidth } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { useShelf, type ShelfCopy } from '@/lib/queries';

type Shelf = 'physical' | 'online' | 'all';

const SHELVES: { value: Shelf; label: string }[] = [
  { value: 'physical', label: 'Física' },
  { value: 'online', label: 'Online' },
  { value: 'all', label: 'Tudo' },
];

const COLUMN_GAP = 12;
const H_PADDING = 16;

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function LibraryScreen() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const shelf = useShelf();
  const [selected, setSelected] = useState<Shelf>('physical');
  const [search, setSearch] = useState('');

  const contentWidth = Math.min(width, MaxContentWidth) - H_PADDING * 2;
  const columns = contentWidth > 560 ? 5 : 3;
  const coverWidth = Math.floor((contentWidth - COLUMN_GAP * (columns - 1)) / columns);

  const items = useMemo(() => {
    const term = normalize(search.trim());
    const seen = new Set<string>();
    return (shelf.data ?? []).filter((copy: ShelfCopy) => {
      if (selected === 'physical' && copy.format !== 'physical') return false;
      if (selected === 'online' && copy.format === 'physical') return false;
      // Um livro com vários exemplares aparece uma vez por prateleira.
      if (seen.has(copy.book_id)) return false;
      if (term) {
        const haystack = normalize(
          [
            copy.book.title,
            copy.book.authors.join(' '),
            copy.book.isbn_13 ?? '',
            copy.book.isbn_10 ?? '',
          ].join(' '),
        );
        if (!haystack.includes(term)) return false;
      }
      seen.add(copy.book_id);
      return true;
    });
  }, [shelf.data, selected, search]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-paper">
      <View className="w-full flex-1 self-center" style={{ maxWidth: MaxContentWidth }}>
        <View className="gap-4 px-4 pb-3 pt-4">
          <Heading>Biblioteca</Heading>

          <View accessibilityRole="tablist" className="flex-row rounded-card bg-sunken p-1">
            {SHELVES.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(option.value)}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
                    active ? 'bg-surface shadow-sm' : ''
                  }`}>
                  <Text className={`text-sm ${active ? 'font-semibold text-ink' : 'text-muted'}`}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="min-h-[48px] flex-row items-center gap-2 rounded-card border border-line bg-surface px-4">
            <Icon name="search" size={18} color="muted" />
            <TextInput
              accessibilityLabel="Buscar por título, autor ou ISBN"
              placeholder="Título, autor ou ISBN"
              placeholderTextColor={palette.muted}
              value={search}
              onChangeText={setSearch}
              className="flex-1 py-3 text-base text-ink"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
        </View>

        {shelf.isLoading ? (
          <ActivityIndicator className="mt-10" color={palette.accent} />
        ) : (
          <FlatList
            key={columns}
            data={items}
            keyExtractor={(copy) => copy.book_id}
            numColumns={columns}
            columnWrapperStyle={{ gap: COLUMN_GAP }}
            contentContainerStyle={{
              paddingHorizontal: H_PADDING,
              paddingBottom: 32,
              gap: 16,
              flexGrow: 1,
            }}
            renderItem={({ item }) => (
              <View style={{ width: coverWidth }} className="gap-1.5">
                <BookCover book={item.book} width={coverWidth} />
                <Text className="text-xs text-ink" numberOfLines={2}>
                  {item.book.title}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              search ? (
                <EmptyState
                  icon="search"
                  title="Nada encontrado"
                  message={`Nenhum livro corresponde a “${search}”.`}
                />
              ) : (
                <EmptyState
                  icon={selected === 'online' ? 'tablet-portrait-outline' : 'library-outline'}
                  title={
                    selected === 'online' ? 'Nenhum livro digital ainda' : 'Sua estante está vazia'
                  }
                  message={
                    selected === 'online'
                      ? 'E-books, audiobooks e assinaturas aparecem aqui.'
                      : 'Escaneie o código de barras dos seus livros para catalogar o acervo em segundos.'
                  }
                  action={
                    <Button
                      title="Escanear livro"
                      icon="barcode-outline"
                      onPress={() => router.push('/scanner')}
                    />
                  }
                />
              )
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
