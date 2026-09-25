import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Body, Muted } from '@/components/ui/typography';
import { useScheme } from '@/hooks/use-palette';
import { todayISO } from '@/lib/dates';
import { useGenres, useMyGoals, useStatsReadings } from '@/lib/queries';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  goalCardSvg,
  yearCardSvg,
  type CardTheme,
} from '@/lib/share-card';
import { shareCardImage } from '@/lib/share-image';
import { goalProgress, monthlyTotals, yearSummary } from '@/lib/stats';
import { useCurrentLibrary } from '@/providers/library-provider';

type Template = 'ano' | 'meta';

const PACE_TEXT = {
  ahead: 'Adiantado em relação à meta',
  on_track: 'No ritmo da meta',
  behind: 'Um pouco atrás da meta',
} as const;

/** Imagem dos relatórios para os stories do Instagram. */
export default function ShareCardScreen() {
  const params = useLocalSearchParams<{ tipo?: string; ano?: string }>();
  const today = todayISO();
  const year = Number(params.ano) || Number(today.slice(0, 4));
  const current = useCurrentLibrary();
  const readings = useStatsReadings('mine');
  const genres = useGenres();
  const goals = useMyGoals();
  const { width } = useWindowDimensions();
  const [template, setTemplate] = useState<Template>(params.tipo === 'meta' ? 'meta' : 'ano');
  const [theme, setTheme] = useState<CardTheme>(useScheme());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const previewRef = useRef<View>(null);

  const goal = goals.data?.find((g) => g.year === year) ?? null;
  const svg = useMemo(() => {
    const data = readings.data ?? [];
    if (template === 'meta') {
      const p = goalProgress(data, goal, year, today);
      return goalCardSvg(
        {
          name: current.display_name,
          year,
          books: p.books,
          target: goal?.target_books ?? 0,
          projected: Number(today.slice(0, 4)) === year ? p.projectedBooks : null,
          paceText: p.pace ? PACE_TEXT[p.pace] : null,
        },
        theme,
      );
    }
    const names = new Map((genres.data ?? []).map((g) => [g.id, g.name]));
    const s = yearSummary(data, names, year);
    return yearCardSvg(
      {
        name: current.display_name,
        year,
        books: s.books,
        pages: s.pages,
        monthlyBooks: monthlyTotals(data, year).map((m) => m.books),
        facts: [
          s.topGenre && { label: 'Gênero favorito', value: s.topGenre },
          s.topAuthor && { label: 'Autor mais lido', value: s.topAuthor },
          s.favorite && { label: 'Nota mais alta', value: s.favorite.title },
          s.busiestMonth && { label: 'Mês mais animado', value: s.busiestMonth },
        ].filter(Boolean) as { label: string; value: string }[],
      },
      theme,
    );
  }, [template, theme, readings.data, genres.data, goal, year, today, current.display_name]);

  const previewWidth = Math.min(width - 32, 320);
  const previewHeight = (previewWidth * CARD_HEIGHT) / CARD_WIDTH;
  const noGoal = template === 'meta' && !goal?.target_books;

  async function share() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await shareCardImage(svg, `leituras-${template}-${year}.png`, previewRef);
      if (result === 'downloaded') setMessage('Imagem baixada. Publique pelo app do Instagram.');
    } catch {
      setMessage('Não foi possível gerar a imagem. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Compartilhar' }} />
      <Screen edges={[]}>
        <SegmentedControl
          accessibilityLabel="Modelo"
          options={[
            { value: 'ano', label: `Meu ${year}` },
            { value: 'meta', label: 'Meta do ano' },
          ]}
          value={template}
          onChange={setTemplate}
        />
        <View className="flex-row gap-2">
          <Chip label="Claro" selected={theme === 'light'} onPress={() => setTheme('light')} />
          <Chip label="Escuro" selected={theme === 'dark'} onPress={() => setTheme('dark')} />
        </View>

        {noGoal ? (
          <Body>Defina uma meta para {year} para compartilhar o progresso.</Body>
        ) : (
          <View className="items-center">
            <View
              ref={previewRef}
              collapsable={false}
              accessible
              accessibilityLabel="Prévia da imagem para compartilhar"
              style={{
                width: previewWidth,
                height: previewHeight,
                borderRadius: 16,
                overflow: 'hidden',
              }}>
              <SvgXml xml={svg} width={previewWidth} height={previewHeight} />
            </View>
          </View>
        )}

        <Button
          title={Platform.OS === 'web' ? 'Compartilhar ou baixar imagem' : 'Compartilhar imagem'}
          icon="share-social-outline"
          loading={busy}
          disabled={noGoal || readings.isPending}
          onPress={share}
        />
        {message ? <Muted className="text-center">{message}</Muted> : null}
        <Muted className="text-center">
          Formato de story (1080 × 1920). As capas não entram na imagem.
        </Muted>
      </Screen>
    </>
  );
}
