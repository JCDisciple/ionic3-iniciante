import { Text, View } from 'react-native';

import { useChartColors } from '@/hooks/use-palette';
import { formatNumber } from '@/lib/stats';

type HBarListProps = {
  rows: { key: string; label: string; value: number; detail?: string }[];
  unit?: (value: number) => string;
};

/**
 * Barras horizontais ordenadas (gêneros, autores): uma cor só, rótulo acima,
 * valor na ponta da barra. Categorias nominais não ganham degradê.
 */
export function HBarList({ rows, unit = (v) => formatNumber(v) }: HBarListProps) {
  const colors = useChartColors();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View
          key={row.key}
          className="gap-1"
          accessible
          accessibilityLabel={`${row.label}: ${unit(row.value)}${row.detail ? `, ${row.detail}` : ''}`}>
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {row.label}
            </Text>
            {row.detail ? <Text className="text-xs text-muted">{row.detail}</Text> : null}
          </View>
          <View className="flex-row items-center gap-2">
            <View
              style={{
                width: `${Math.max(2, (row.value / max) * 82)}%`,
                height: 14,
                backgroundColor: colors.series[0],
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
            <Text
              className="text-sm font-semibold text-ink"
              style={{ fontVariant: ['tabular-nums'] }}>
              {unit(row.value)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
