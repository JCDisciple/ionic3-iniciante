import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Muted } from '@/components/ui/typography';

type ChartCardProps = {
  title: string;
  subtitle?: string;
  /** Linhas da tabela equivalente (sempre disponível: nenhum valor depende só do gráfico). */
  table: { label: string; value: string }[];
  tableHeader?: [string, string];
  children: ReactNode;
};

/** Moldura dos gráficos: título, subtítulo e alternância gráfico ↔ tabela. */
export function ChartCard({ title, subtitle, table, tableHeader, children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-base font-semibold text-ink">
            {title}
          </Text>
          {subtitle ? <Muted>{subtitle}</Muted> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showTable ? `Ver gráfico de ${title}` : `Ver tabela de ${title}`}
          onPress={() => setShowTable((v) => !v)}
          className="min-h-[44px] justify-center px-1">
          <Text className="text-sm font-semibold text-accent">
            {showTable ? 'Gráfico' : 'Tabela'}
          </Text>
        </Pressable>
      </View>
      {showTable ? <DataTable rows={table} header={tableHeader} /> : children}
    </Card>
  );
}

export function DataTable({
  rows,
  header,
}: {
  rows: { label: string; value: string }[];
  header?: [string, string];
}) {
  return (
    <View accessibilityRole="list">
      {header ? (
        <View className="flex-row border-b border-line py-2">
          <Text className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {header[0]}
          </Text>
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
            {header[1]}
          </Text>
        </View>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.label}
          className="min-h-[36px] flex-row items-center border-b border-line py-1.5">
          <Text className="flex-1 text-sm text-ink">{row.label}</Text>
          <Text className="text-sm text-ink" style={{ fontVariant: ['tabular-nums'] }}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View className="min-w-[140px] flex-1 gap-0.5 rounded-card border border-line bg-surface p-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-3xl font-semibold text-ink">{value}</Text>
      {detail ? <Text className="text-xs text-muted">{detail}</Text> : null}
    </View>
  );
}
