import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { Body, Label, Muted } from '@/components/ui/typography';
import { saveGoal } from '@/lib/books';
import { todayISO } from '@/lib/dates';
import { useInvalidateLibrary, useMyGoals, useStatsReadings } from '@/lib/queries';
import { formatNumber, yearTotals } from '@/lib/stats';
import { useCurrentLibrary } from '@/providers/library-provider';
import type { Goal } from '@/types/models';

function parseTarget(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(/\./g, '');
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : 'invalid';
}

/** Meta anual em livros e em páginas, por pessoa (RF5). */
export default function GoalsScreen() {
  const goals = useMyGoals();
  const readings = useStatsReadings('mine');
  const thisYear = Number(todayISO().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const goal = goals.data?.find((g) => g.year === year) ?? null;
  const past = (goals.data ?? []).filter((g) => g.year < thisYear);

  return (
    <>
      <Stack.Screen options={{ title: 'Metas de leitura' }} />
      <Screen edges={[]}>
        <SegmentedControl
          accessibilityLabel="Ano"
          options={[
            { value: String(thisYear), label: String(thisYear) },
            { value: String(thisYear + 1), label: String(thisYear + 1) },
          ]}
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
        />
        {goals.isPending ? null : (
          <GoalForm key={`${year}-${goal?.updated_at ?? 'novo'}`} year={year} goal={goal} />
        )}

        {past.length > 0 ? (
          <View className="gap-2">
            <Label className="px-1">Anos anteriores</Label>
            {past.map((g) => {
              const totals = yearTotals(readings.data ?? [], g.year);
              return (
                <Card key={g.id} className="gap-2">
                  <Body className="font-semibold">{g.year}</Body>
                  {g.target_books ? (
                    <>
                      <Muted>
                        {totals.books} de {g.target_books} livros
                        {totals.books >= g.target_books ? ' · meta batida!' : ''}
                      </Muted>
                      <ProgressBar value={totals.books / g.target_books} />
                    </>
                  ) : null}
                  {g.target_pages ? (
                    <Muted>
                      {formatNumber(totals.pages)} de {formatNumber(g.target_pages)} páginas
                    </Muted>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : null}
      </Screen>
    </>
  );
}

function GoalForm({ year, goal }: { year: number; goal: Goal | null }) {
  const current = useCurrentLibrary();
  const invalidate = useInvalidateLibrary();
  const [books, setBooks] = useState(goal?.target_books ? String(goal.target_books) : '');
  const [pages, setPages] = useState(goal?.target_pages ? String(goal.target_pages) : '');
  const [errors, setErrors] = useState<{ books?: string; pages?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const booksValue = parseTarget(books);
  const perMonth = typeof booksValue === 'number' ? Math.round((booksValue / 12) * 10) / 10 : null;

  async function save() {
    const targetBooks = parseTarget(books);
    const targetPages = parseTarget(pages);
    const next = {
      books: targetBooks === 'invalid' ? 'Use um número inteiro maior que zero.' : undefined,
      pages: targetPages === 'invalid' ? 'Use um número inteiro maior que zero.' : undefined,
    };
    setErrors(next);
    if (next.books || next.pages) return;
    setSaving(true);
    try {
      await saveGoal({
        libraryId: current.library_id,
        memberId: current.id,
        year,
        targetBooks: targetBooks as number | null,
        targetPages: targetPages as number | null,
      });
      invalidate();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-4">
      <TextField
        label="Livros no ano"
        placeholder="Ex.: 24"
        value={books}
        onChangeText={(t) => {
          setBooks(t);
          setSaved(false);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        error={errors.books}
        hint={perMonth ? `Cerca de ${formatNumber(perMonth)} por mês.` : undefined}
      />
      <TextField
        label="Páginas no ano (opcional)"
        placeholder="Ex.: 8000"
        value={pages}
        onChangeText={(t) => {
          setPages(t);
          setSaved(false);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        error={errors.pages}
      />
      <Button
        title={saved ? 'Meta salva' : 'Salvar meta'}
        icon="flag-outline"
        loading={saving}
        onPress={save}
      />
      <Muted>Sua meta é só sua; a família vê o progresso nos relatórios “da família”.</Muted>
    </Card>
  );
}
