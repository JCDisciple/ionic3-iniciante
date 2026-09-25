import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Muted, serif } from '@/components/ui/typography';
import { MaxContentWidth } from '@/constants/theme';
import { todayISO } from '@/lib/dates';
import { useGenres, useStatsReadings } from '@/lib/queries';
import { formatNumber, yearSummary } from '@/lib/stats';
import { useCurrentLibrary } from '@/providers/library-provider';

/** "Meu ano em leituras": o resumo do ano numa tela só (RF5). */
export default function YearSummaryScreen() {
  const params = useLocalSearchParams<{ ano?: string }>();
  const year = Number(params.ano) || Number(todayISO().slice(0, 4));
  const current = useCurrentLibrary();
  const readings = useStatsReadings('mine');
  const genres = useGenres();
  const { width } = useWindowDimensions();
  const names = useMemo(
    () => new Map((genres.data ?? []).map((g) => [g.id, g.name])),
    [genres.data],
  );

  if (readings.isPending) return null;
  const summary = yearSummary(readings.data ?? [], names, year);
  const coverWidth = Math.floor((Math.min(width, MaxContentWidth) - 32 - 8 * 4) / 5);

  const facts = [
    summary.topGenre && { label: 'Gênero favorito', value: summary.topGenre },
    summary.topAuthor && { label: 'Autor mais lido', value: summary.topAuthor },
    summary.busiestMonth && { label: 'Mês mais animado', value: summary.busiestMonth },
    summary.longest && {
      label: 'Livro mais longo',
      value: `${summary.longest.title} · ${formatNumber(summary.longest.pages)} págs.`,
    },
    summary.favorite && {
      label: 'Nota mais alta',
      value: `${summary.favorite.title} · ${'★'.repeat(summary.favorite.rating)}`,
    },
    summary.avgRating && { label: 'Nota média', value: `${formatNumber(summary.avgRating)} de 5` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <Stack.Screen options={{ title: `${year} em leituras` }} />
      <Screen edges={[]}>
        {summary.books === 0 ? (
          <EmptyState
            icon="sparkles-outline"
            title={`Seu ${year} ainda está em branco`}
            message="Conclua leituras (ou registre as antigas com a data de término) para montar o resumo do ano."
          />
        ) : (
          <>
            <View className="items-center gap-1 rounded-3xl bg-accent px-6 py-8">
              <Text className="text-base text-on-accent" style={serif}>
                {current.display_name}, em {year} você leu
              </Text>
              <Text accessibilityRole="header" className="text-7xl font-semibold text-on-accent">
                {summary.books}
              </Text>
              <Text className="text-lg text-on-accent">
                {summary.books === 1 ? 'livro' : 'livros'}
              </Text>
              <Text className="mt-2 text-base text-on-accent">
                {formatNumber(summary.pages)} páginas viradas
              </Text>
            </View>

            {facts.length > 0 ? (
              <View className="gap-2">
                {facts.map((fact) => (
                  <View
                    key={fact.label}
                    className="rounded-card border border-line bg-surface px-4 py-3">
                    <Muted>{fact.label}</Muted>
                    <Text className="text-lg font-semibold text-ink" style={serif}>
                      {fact.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="gap-2">
              <Muted>Na ordem em que você terminou</Muted>
              <View className="flex-row flex-wrap gap-2">
                {summary.covers.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={c.title}
                    onPress={() => router.push(`/livro/${c.bookId}`)}>
                    <BookCover book={c} width={coverWidth} />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </Screen>
    </>
  );
}
