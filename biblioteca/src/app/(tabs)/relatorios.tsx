import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ActivityGrid } from '@/components/charts/activity-grid';
import { ChartCard, StatTile } from '@/components/charts/chart-card';
import { ColumnChart } from '@/components/charts/column-chart';
import { GoalLine } from '@/components/charts/goal-line';
import { HBarList } from '@/components/charts/hbar-list';
import { StackedBar } from '@/components/charts/stacked-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { OptionSheet } from '@/components/ui/option-sheet';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Body, Heading, Muted } from '@/components/ui/typography';
import { todayISO } from '@/lib/dates';
import {
  useFamilyGoals,
  useGenres,
  useMembers,
  useMyGoals,
  useStatsProgress,
  useStatsReadings,
} from '@/lib/queries';
import {
  activityGrid,
  cumulativeBooks,
  formatNumber,
  genreDistribution,
  goalProgress,
  MONTH_NAMES,
  monthlyTotals,
  originSplit,
  pace,
  topAuthors,
  yearsWithData,
  yearTotals,
  type StatsProgress,
  type StatsReading,
} from '@/lib/stats';
import { useCurrentLibrary } from '@/providers/library-provider';

type Tab = 'periodo' | 'meta' | 'generos' | 'ritmo';
type Scope = 'mine' | 'family';

const TABS: { value: Tab; label: string }[] = [
  { value: 'periodo', label: 'Período' },
  { value: 'meta', label: 'Meta' },
  { value: 'generos', label: 'Gêneros' },
  { value: 'ritmo', label: 'Ritmo' },
];

const plural = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`;

export default function ReportsScreen() {
  const params = useLocalSearchParams<{ aba?: string }>();
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.value === params.aba) ? (params.aba as Tab) : 'periodo',
  );
  const [scope, setScope] = useState<Scope>('mine');
  const [year, setYear] = useState(currentYear);
  const [yearSheet, setYearSheet] = useState(false);

  const readings = useStatsReadings(scope);
  const progress = useStatsProgress();
  const data = readings.data ?? [];
  const years = yearsWithData(data, currentYear);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Heading>Relatórios</Heading>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Meu ano em leituras ${year}`}
          onPress={() => router.push({ pathname: '/resumo', params: { ano: String(year) } })}
          className="min-h-[44px] flex-row items-center gap-1.5 px-1">
          <Icon name="sparkles-outline" size={18} color="accent" />
          <Text className="text-sm font-semibold text-accent">Meu ano</Text>
        </Pressable>
      </View>

      {/* Uma linha de filtros acima de tudo o que eles afetam */}
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Meus" selected={scope === 'mine'} onPress={() => setScope('mine')} />
        <Chip
          label="Da família"
          icon="people-outline"
          selected={scope === 'family'}
          onPress={() => setScope('family')}
        />
        <Chip
          label={String(year)}
          icon="calendar-outline"
          dropdown
          onPress={() => setYearSheet(true)}
        />
      </View>

      <SegmentedControl
        accessibilityLabel="Relatório"
        options={TABS}
        value={tab}
        onChange={setTab}
      />

      {readings.isPending ? null : (
        <View className={`gap-4 ${readings.isFetching ? 'opacity-60' : ''}`}>
          {tab === 'periodo' ? <PeriodTab readings={data} year={year} today={today} /> : null}
          {tab === 'meta' ? (
            <GoalTab readings={data} year={year} today={today} scope={scope} />
          ) : null}
          {tab === 'generos' ? <GenresTab readings={data} year={year} /> : null}
          {tab === 'ritmo' ? (
            <PaceTab readings={data} progress={progress.data ?? []} year={year} today={today} />
          ) : null}
        </View>
      )}

      <OptionSheet
        visible={yearSheet}
        title="Ano"
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        selected={[String(year)]}
        onSelect={(v) => setYear(Number(v))}
        onClose={() => setYearSheet(false)}
      />
    </Screen>
  );
}

function NoReadings({ year }: { year: number }) {
  return (
    <EmptyState
      icon="stats-chart-outline"
      title={`Nenhum livro terminado em ${year}`}
      message="Quando você concluir leituras, os números aparecem aqui. Leituras antigas também contam: registre com a data em que terminou."
    />
  );
}

// ---------------------------------------------------------------------------

function PeriodTab({
  readings,
  year,
  today,
}: {
  readings: StatsReading[];
  year: number;
  today: string;
}) {
  const totals = yearTotals(readings, year);
  const months = monthlyTotals(readings, year);
  const currentMonth = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : null;
  if (totals.books === 0 && totals.abandoned === 0) return <NoReadings year={year} />;

  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        <StatTile label="Livros lidos" value={formatNumber(totals.books)} />
        <StatTile label="Páginas" value={formatNumber(totals.pages)} />
        <StatTile label="Páginas por livro" value={formatNumber(totals.avgPages)} detail="média" />
        <StatTile label="Abandonados" value={formatNumber(totals.abandoned)} />
      </View>
      <ChartCard
        title="Livros por mês"
        subtitle={`Livros terminados em ${year}`}
        tableHeader={['Mês', 'Livros']}
        table={months.map((m) => ({ label: MONTH_NAMES[m.month], value: formatNumber(m.books) }))}>
        <ColumnChart
          accessibilityLabel={`Livros por mês em ${year}`}
          initialSelected={currentMonth}
          data={months.map((m) => ({
            key: String(m.month),
            label: m.label,
            value: m.books,
            readout: `${plural(m.books, 'livro', 'livros')} em ${MONTH_NAMES[m.month]}`,
          }))}
        />
      </ChartCard>
      <ChartCard
        title="Páginas por mês"
        subtitle="Soma das páginas dos livros terminados"
        tableHeader={['Mês', 'Páginas']}
        table={months.map((m) => ({ label: MONTH_NAMES[m.month], value: formatNumber(m.pages) }))}>
        <ColumnChart
          accessibilityLabel={`Páginas por mês em ${year}`}
          initialSelected={currentMonth}
          data={months.map((m) => ({
            key: String(m.month),
            label: m.label,
            value: m.pages,
            readout: `${plural(m.pages, 'página', 'páginas')} em ${MONTH_NAMES[m.month]}`,
          }))}
        />
      </ChartCard>
    </>
  );
}

// ---------------------------------------------------------------------------

const PACE_TEXT = {
  ahead: 'Adiantado em relação à meta',
  on_track: 'No ritmo da meta',
  behind: 'Um pouco atrás da meta',
} as const;

function GoalTab({
  readings,
  year,
  today,
  scope,
}: {
  readings: StatsReading[];
  year: number;
  today: string;
  scope: Scope;
}) {
  const current = useCurrentLibrary();
  const myGoals = useMyGoals();
  const familyGoals = useFamilyGoals();
  const members = useMembers();

  if (scope === 'family') {
    const goals = (familyGoals.data ?? []).filter((g) => g.year === year);
    return (
      <>
        {(members.data ?? []).map((member) => {
          const goal = goals.find((g) => g.member_id === member.id) ?? null;
          const memberReadings = readings.filter((r) => r.member_id === member.id);
          const p = goalProgress(memberReadings, goal, year, today);
          return (
            <Card key={member.id} className="gap-2">
              <View className="flex-row justify-between">
                <Body className="font-semibold">
                  {member.display_name}
                  {member.id === current.id ? ' (você)' : ''}
                </Body>
                <Muted>
                  {goal?.target_books
                    ? `${p.books} de ${goal.target_books}`
                    : plural(p.books, 'livro', 'livros')}
                </Muted>
              </View>
              {goal?.target_books ? (
                <>
                  <ProgressBar
                    value={p.books / goal.target_books}
                    accessibilityLabel={`Meta de ${member.display_name}`}
                  />
                  {p.pace ? <Muted>{PACE_TEXT[p.pace]}</Muted> : null}
                </>
              ) : (
                <Muted>Sem meta para {year}.</Muted>
              )}
            </Card>
          );
        })}
      </>
    );
  }

  const goal = (myGoals.data ?? []).find((g) => g.year === year) ?? null;
  if (!goal?.target_books && !goal?.target_pages) {
    return (
      <EmptyState
        icon="flag-outline"
        title={`Sem meta para ${year}`}
        message="Defina quantos livros e páginas quer ler e acompanhe o ritmo por aqui."
        action={<Button title="Definir meta" onPress={() => router.push('/metas')} />}
      />
    );
  }

  const p = goalProgress(readings, goal, year, today);
  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        {p.targetBooks ? (
          <StatTile
            label="Livros"
            value={`${p.books} de ${p.targetBooks}`}
            detail={`${Math.round((p.books / p.targetBooks) * 100)}% da meta`}
          />
        ) : null}
        {p.targetPages ? (
          <StatTile
            label="Páginas"
            value={formatNumber(p.pages)}
            detail={`de ${formatNumber(p.targetPages)} · ${Math.round((p.pages / p.targetPages) * 100)}%`}
          />
        ) : null}
      </View>
      <Card className="gap-3">
        {p.targetBooks ? (
          <View className="gap-1.5">
            <Muted>Livros</Muted>
            <ProgressBar
              value={p.books / p.targetBooks}
              height={10}
              accessibilityLabel="Meta de livros"
            />
          </View>
        ) : null}
        {p.targetPages ? (
          <View className="gap-1.5">
            <Muted>Páginas</Muted>
            <ProgressBar
              value={p.pages / p.targetPages}
              height={10}
              accessibilityLabel="Meta de páginas"
            />
          </View>
        ) : null}
        {p.pace ? <Body className="font-semibold">{PACE_TEXT[p.pace]}</Body> : null}
        {p.projectedBooks !== null && Number(today.slice(0, 4)) === year ? (
          <Body>
            No ritmo atual você termina o ano com {plural(p.projectedBooks, 'livro', 'livros')}
            {p.projectedPages ? ` e ${plural(p.projectedPages, 'página', 'páginas')}` : ''}.
          </Body>
        ) : null}
      </Card>
      {p.targetBooks ? (
        <ChartCard
          title="Acumulado do ano"
          subtitle="Livros lidos até o fim de cada mês, contra o ritmo que bate a meta"
          tableHeader={['Mês', 'Lidos · meta']}
          table={cumulativeBooks(readings, year, today).map((v, i) => ({
            label: MONTH_NAMES[i],
            value: `${v ?? '—'} · ${Math.round((p.targetBooks! * (i + 1)) / 12)}`,
          }))}>
          <GoalLine cumulative={cumulativeBooks(readings, year, today)} target={p.targetBooks} />
        </ChartCard>
      ) : null}
      {p.targetBooks ? (
        <Button
          title="Compartilhar meta no Instagram"
          variant="secondary"
          icon="logo-instagram"
          onPress={() =>
            router.push({ pathname: '/compartilhar', params: { tipo: 'meta', ano: String(year) } })
          }
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

function GenresTab({ readings, year }: { readings: StatsReading[]; year: number }) {
  const genres = useGenres();
  const names = useMemo(
    () => new Map((genres.data ?? []).map((g) => [g.id, g.name])),
    [genres.data],
  );
  const totals = yearTotals(readings, year);
  if (totals.books === 0) return <NoReadings year={year} />;

  const byGenre = genreDistribution(readings, names, year);
  const authors = topAuthors(readings, year);
  const origin = originSplit(readings, year);
  const segments = [
    { key: 'physical', label: 'Físico', value: origin.physical },
    { key: 'online', label: 'Online', value: origin.online },
    { key: 'external', label: 'Fora do acervo', value: origin.external },
  ];

  return (
    <>
      <ChartCard
        title="Gêneros"
        subtitle="Livros terminados por gênero (um livro pode ter mais de um)"
        tableHeader={['Gênero', 'Livros']}
        table={byGenre.map((g) => ({ label: g.label, value: formatNumber(g.value) }))}>
        <HBarList rows={byGenre} />
      </ChartCard>
      <ChartCard
        title="Autores mais lidos"
        tableHeader={['Autor', 'Livros · páginas']}
        table={authors.map((a) => ({
          label: a.label,
          value: `${a.value} · ${formatNumber(a.pages)}`,
        }))}>
        <HBarList
          rows={authors.map((a) => ({ ...a, detail: plural(a.pages, 'página', 'páginas') }))}
        />
      </ChartCard>
      <ChartCard
        title="De onde vieram"
        subtitle="Exemplar físico, digital (e-book, audiobook, assinatura) ou fora do acervo"
        tableHeader={['Origem', 'Livros']}
        table={segments.map((s) => ({ label: s.label, value: formatNumber(s.value) }))}>
        <StackedBar segments={segments} />
      </ChartCard>
    </>
  );
}

// ---------------------------------------------------------------------------

function PaceTab({
  readings,
  progress,
  year,
  today,
}: {
  readings: StatsReading[];
  progress: StatsProgress[];
  year: number;
  today: string;
}) {
  const p = pace(readings, progress, year, today);
  const grid = activityGrid(p.days, today, 12);

  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        <StatTile
          label="Dias por livro"
          value={p.avgDaysPerBook !== null ? formatNumber(p.avgDaysPerBook) : '—'}
          detail="média, do início ao fim"
        />
        <StatTile
          label="Páginas por dia"
          value={formatNumber(p.pagesPerDay)}
          detail={`média em ${year}`}
        />
        <StatTile label="Horas de audiobook" value={formatNumber(p.audiobookHours)} />
        <StatTile
          label="Sequência"
          value={plural(p.current, 'dia', 'dias')}
          detail={`recorde: ${plural(p.longest, 'dia', 'dias')}`}
        />
      </View>
      <ChartCard
        title="Dias com leitura"
        subtitle="Últimas 12 semanas · conta progresso, inícios e términos"
        tableHeader={['Semana (início)', 'Dias com leitura']}
        table={grid.map((week) => ({
          label: week.find(Boolean)?.date.split('-').reverse().join('/') ?? '',
          value: String(week.filter((d) => d?.active).length),
        }))}>
        <ActivityGrid weeks={grid} />
      </ChartCard>
      <Muted>
        Dica: registre o progresso pelo “+ progresso” da Início para manter a sequência.
      </Muted>
    </>
  );
}
