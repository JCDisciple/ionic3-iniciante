import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { OptionSheet, type SheetOption } from '@/components/ui/option-sheet';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Heading } from '@/components/ui/typography';
import { MaxContentWidth } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { todayISO } from '@/lib/dates';
import { FORMAT_LABELS, READING_STATUS_LABELS } from '@/lib/labels';
import { useGenres, useMyReadingStatusByBook, useOpenLoans, useShelf } from '@/lib/queries';
import {
  activeFilterCount,
  applyFilters,
  defaultFilters,
  facetValues,
  groupShelf,
  type ShelfBook,
  type ShelfFilters,
  type ShelfKind,
  type ShelfSort,
  type StatusFilter,
} from '@/lib/shelf';

const SHELVES: { value: ShelfKind; label: string }[] = [
  { value: 'physical', label: 'Física' },
  { value: 'online', label: 'Online' },
  { value: 'all', label: 'Tudo' },
];

const SORTS: { value: ShelfSort; label: string }[] = [
  { value: 'recent', label: 'Recentes' },
  { value: 'title', label: 'Título' },
  { value: 'author', label: 'Autor' },
  { value: 'year', label: 'Ano' },
];

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: 'unread', label: 'Não lidos' },
  { value: 'want', label: READING_STATUS_LABELS.want },
  { value: 'reading', label: READING_STATUS_LABELS.reading },
  { value: 'read', label: READING_STATUS_LABELS.read },
  { value: 'abandoned', label: READING_STATUS_LABELS.abandoned },
];

type Sheet = 'sort' | 'genre' | 'author' | 'status' | 'platform' | 'location' | null;

const COLUMN_GAP = 12;
const H_PADDING = 16;

export default function LibraryScreen() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const shelf = useShelf();
  const genres = useGenres();
  const loans = useOpenLoans();
  const statusByBook = useMyReadingStatusByBook();
  const [filters, setFilters] = useState<ShelfFilters>(defaultFilters);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sheet, setSheet] = useState<Sheet>(null);

  const contentWidth = Math.min(width, MaxContentWidth) - H_PADDING * 2;
  const columns = view === 'list' ? 1 : contentWidth > 560 ? 5 : 3;
  const coverWidth = Math.floor((contentWidth - COLUMN_GAP * (columns - 1)) / columns);

  const grouped = useMemo(
    () => groupShelf(shelf.data ?? [], filters.shelf),
    [shelf.data, filters.shelf],
  );
  const facets = useMemo(() => facetValues(grouped), [grouped]);
  const items = useMemo(
    () => applyFilters(grouped, filters, statusByBook),
    [grouped, filters, statusByBook],
  );

  const set = (patch: Partial<ShelfFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const filterCount = activeFilterCount(filters);
  const lateLoans = (loans.data ?? []).filter((l) => l.due_at && l.due_at < todayISO()).length;
  const genreName = (id: string) => genres.data?.find((g) => g.id === id)?.name ?? '';

  const sheetConfig: Record<
    Exclude<Sheet, null>,
    {
      title: string;
      options: SheetOption[];
      selected: string[];
      multiple?: boolean;
      clear?: string;
      onSelect: (v: string) => void;
      onClear?: () => void;
    }
  > = {
    sort: {
      title: 'Ordenar por',
      options: SORTS,
      selected: [filters.sort],
      onSelect: (v) => set({ sort: v as ShelfSort }),
    },
    genre: {
      title: 'Gêneros',
      multiple: true,
      options: (genres.data ?? []).map((g) => ({ value: g.id, label: g.name })),
      selected: filters.genreIds,
      clear: 'Todos os gêneros',
      onSelect: (v) =>
        set({
          genreIds: filters.genreIds.includes(v)
            ? filters.genreIds.filter((g) => g !== v)
            : [...filters.genreIds, v],
        }),
      onClear: () => set({ genreIds: [] }),
    },
    author: {
      title: 'Autor',
      options: facets.authors.map((a) => ({ value: a, label: a })),
      selected: filters.author ? [filters.author] : [],
      clear: 'Todos os autores',
      onSelect: (v) => set({ author: v }),
      onClear: () => set({ author: null }),
    },
    status: {
      title: 'Minha leitura',
      options: STATUSES,
      selected: filters.status ? [filters.status] : [],
      clear: 'Qualquer status',
      onSelect: (v) => set({ status: v as StatusFilter }),
      onClear: () => set({ status: null }),
    },
    platform: {
      title: 'Plataforma',
      options: facets.platforms.map((p) => ({ value: p, label: p })),
      selected: filters.platform ? [filters.platform] : [],
      clear: 'Todas as plataformas',
      onSelect: (v) => set({ platform: v }),
      onClear: () => set({ platform: null }),
    },
    location: {
      title: 'Onde fica',
      options: facets.locations.map((l) => ({ value: l, label: l })),
      selected: filters.location ? [filters.location] : [],
      clear: 'Todos os lugares',
      onSelect: (v) => set({ location: v }),
      onClear: () => set({ location: null }),
    },
  };
  const current = sheet ? sheetConfig[sheet] : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-paper">
      <View className="w-full flex-1 self-center" style={{ maxWidth: MaxContentWidth }}>
        <View className="gap-4 pb-3 pt-4">
          <View className="flex-row items-center justify-between px-4">
            <Heading>Biblioteca</Heading>
            <View className="flex-row">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Emprestados${lateLoans ? `, ${lateLoans} atrasados` : ''}`}
                onPress={() => router.push('/emprestados')}
                className="h-11 w-11 items-center justify-center">
                <Icon name="hand-right-outline" color="ink" />
                {lateLoans > 0 ? (
                  <View className="absolute right-1.5 top-1.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1">
                    <Text className="text-[10px] font-bold text-white">{lateLoans}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={view === 'grid' ? 'Ver em lista' : 'Ver em grade'}
                onPress={() => setView(view === 'grid' ? 'list' : 'grid')}
                className="h-11 w-11 items-center justify-center">
                <Icon name={view === 'grid' ? 'list-outline' : 'grid-outline'} color="ink" />
              </Pressable>
            </View>
          </View>

          <View className="px-4">
            <SegmentedControl
              accessibilityLabel="Estante"
              options={SHELVES}
              value={filters.shelf}
              onChange={(shelfKind) => set({ shelf: shelfKind, platform: null, location: null })}
            />
          </View>

          <View className="mx-4 min-h-[48px] flex-row items-center gap-2 rounded-card border border-line bg-surface px-4">
            <Icon name="search" size={18} color="muted" />
            <TextInput
              accessibilityLabel="Buscar por título, autor ou ISBN"
              placeholder="Título, autor ou ISBN"
              placeholderTextColor={palette.muted}
              value={filters.search}
              onChangeText={(search) => set({ search })}
              className="flex-1 py-3 text-base text-ink"
              returnKeyType="search"
              autoCorrect={false}
            />
            {filters.search ? (
              <Pressable
                accessibilityLabel="Limpar busca"
                onPress={() => set({ search: '' })}
                className="h-9 w-9 items-center justify-center">
                <Icon name="close-circle" size={18} color="muted" />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4">
            <Chip
              label={SORTS.find((s) => s.value === filters.sort)!.label}
              icon="swap-vertical"
              dropdown
              onPress={() => setSheet('sort')}
            />
            <Chip
              label={
                filters.genreIds.length === 0
                  ? 'Gênero'
                  : filters.genreIds.length === 1
                    ? genreName(filters.genreIds[0])
                    : `${filters.genreIds.length} gêneros`
              }
              selected={filters.genreIds.length > 0}
              dropdown
              onPress={() => setSheet('genre')}
            />
            <Chip
              label={filters.author ?? 'Autor'}
              selected={!!filters.author}
              dropdown
              onPress={() => setSheet('author')}
            />
            <Chip
              label={
                filters.status ? STATUSES.find((s) => s.value === filters.status)!.label : 'Status'
              }
              selected={!!filters.status}
              dropdown
              onPress={() => setSheet('status')}
            />
            {filters.shelf !== 'physical' ? (
              <Chip
                label={filters.platform ?? 'Plataforma'}
                selected={!!filters.platform}
                dropdown
                onPress={() => setSheet('platform')}
              />
            ) : null}
            {filters.shelf !== 'online' ? (
              <Chip
                label={filters.location ?? 'Local'}
                selected={!!filters.location}
                dropdown
                onPress={() => setSheet('location')}
              />
            ) : null}
            {filterCount > 0 ? (
              <Chip
                label="Limpar"
                icon="close"
                onPress={() =>
                  set({ genreIds: [], author: null, status: null, platform: null, location: null })
                }
              />
            ) : null}
          </ScrollView>
        </View>

        {shelf.isLoading ? (
          <ActivityIndicator className="mt-10" color={palette.accent} />
        ) : (
          <FlatList
            key={`${view}-${columns}`}
            data={items}
            keyExtractor={(item) => item.book.id}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? { gap: COLUMN_GAP } : undefined}
            contentContainerStyle={{
              paddingHorizontal: H_PADDING,
              paddingBottom: 32,
              gap: view === 'grid' ? 16 : 8,
              flexGrow: 1,
            }}
            renderItem={({ item }) =>
              view === 'grid' ? (
                <GridItem item={item} width={coverWidth} />
              ) : (
                <ListItemRow item={item} />
              )
            }
            ListHeaderComponent={
              items.length > 0 ? (
                <Text className="pb-1 text-sm text-muted">
                  {items.length} {items.length === 1 ? 'livro' : 'livros'}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              filters.search || filterCount > 0 ? (
                <EmptyState
                  icon="search"
                  title="Nada encontrado"
                  message="Nenhum livro corresponde à busca e aos filtros."
                  action={
                    <Button
                      title="Limpar filtros"
                      variant="secondary"
                      onPress={() => setFilters({ ...defaultFilters(), shelf: filters.shelf })}
                    />
                  }
                />
              ) : (
                <EmptyState
                  icon={filters.shelf === 'online' ? 'tablet-portrait-outline' : 'library-outline'}
                  title={
                    filters.shelf === 'online'
                      ? 'Nenhum livro digital ainda'
                      : 'Sua estante está vazia'
                  }
                  message={
                    filters.shelf === 'online'
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

      {current ? (
        <OptionSheet
          visible
          title={current.title}
          options={current.options}
          selected={current.selected}
          multiple={current.multiple}
          clearLabel={current.clear}
          onClear={current.onClear}
          onSelect={current.onSelect}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function LoanBadge() {
  return (
    <View className="absolute -right-1.5 -top-1.5 h-7 w-7 items-center justify-center rounded-full border-2 border-paper bg-accent">
      <Icon name="hand-right" size={13} color="onAccent" />
    </View>
  );
}

function GridItem({ item, width }: { item: ShelfBook; width: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.book.title}${item.onLoan ? ', emprestado' : ''}`}
      onPress={() => router.push(`/livro/${item.book.id}`)}
      style={{ width }}
      className="gap-1.5 active:opacity-80">
      <View>
        <BookCover book={item.book} width={width} />
        {item.onLoan ? <LoanBadge /> : null}
      </View>
      <Text className="text-xs text-ink" numberOfLines={2}>
        {item.book.title}
      </Text>
    </Pressable>
  );
}

function ListItemRow({ item }: { item: ShelfBook }) {
  const details = [
    item.book.year,
    item.formats.map((f) => FORMAT_LABELS[f]).join(' + '),
    item.platforms.join(', ') || item.locations.join(', '),
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/livro/${item.book.id}`)}
      className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3 active:bg-sunken">
      <BookCover book={item.book} width={44} />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-ink" numberOfLines={2}>
          {item.book.title}
        </Text>
        <Text className="text-sm text-muted" numberOfLines={1}>
          {item.book.authors.join(', ')}
        </Text>
        <Text className="text-xs text-muted" numberOfLines={1}>
          {details.join(' · ')}
        </Text>
      </View>
      {item.onLoan ? <Icon name="hand-right-outline" size={18} color="accent" /> : null}
    </Pressable>
  );
}
