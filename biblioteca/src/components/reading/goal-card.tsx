import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { GoalRing } from '@/components/charts/goal-ring';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Body, Muted } from '@/components/ui/typography';
import { todayISO } from '@/lib/dates';
import { useMyGoals, useStatsReadings } from '@/lib/queries';
import { goalProgress } from '@/lib/stats';

const PACE_TEXT = {
  ahead: 'Adiantado em relação à meta',
  on_track: 'No ritmo da meta',
  behind: 'Um pouco atrás da meta',
} as const;

/** Anel da meta anual na Início. Sem meta, convida a definir uma. */
export function GoalCard() {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const goals = useMyGoals();
  const readings = useStatsReadings('mine');
  const goal = goals.data?.find((g) => g.year === year) ?? null;

  if (goals.isPending || readings.isPending) return null;

  if (!goal?.target_books) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/metas')}>
        <Card className="flex-row items-center gap-3">
          <Icon name="flag-outline" color="accent" />
          <View className="flex-1">
            <Body className="font-semibold">Defina sua meta de {year}</Body>
            <Muted>Quantos livros e páginas você quer ler este ano?</Muted>
          </View>
          <Icon name="chevron-forward" size={18} color="muted" />
        </Card>
      </Pressable>
    );
  }

  const progress = goalProgress(readings.data ?? [], goal, year, today);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/relatorios?aba=meta')}>
      <Card className="flex-row items-center gap-4">
        <GoalRing value={progress.books} target={goal.target_books} />
        <View className="flex-1 gap-1">
          <Body className="font-semibold">Meta de {year}</Body>
          {progress.pace ? <Muted>{PACE_TEXT[progress.pace]}</Muted> : null}
          {progress.projectedBooks !== null ? (
            <Body className="text-sm">
              No ritmo atual você termina o ano com {progress.projectedBooks}{' '}
              {progress.projectedBooks === 1 ? 'livro' : 'livros'}.
            </Body>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
