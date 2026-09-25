import { useState } from 'react';
import { Text, View } from 'react-native';

import { useChartColors } from '@/hooks/use-palette';
import { luminance } from '@/lib/chart-scale';

type StackedBarProps = {
  segments: { key: string; label: string; value: number }[];
};

/**
 * Parte do todo em uma barra horizontal de 100%: 2px de respiro entre os
 * segmentos, % dentro só quando cabe, e legenda (sempre) com os valores.
 */
export function StackedBar({ segments }: StackedBarProps) {
  const colors = useChartColors();
  const [width, setWidth] = useState(0);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <View className="gap-3">
      <View
        className="flex-row overflow-hidden rounded"
        style={{ height: 24, gap: 2 }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={segments
          .map((s) => `${s.label}: ${s.value} (${pct(s.value)}%)`)
          .join('; ')}>
        {total === 0 ? (
          <View className="flex-1" style={{ backgroundColor: colors.empty }} />
        ) : (
          visible.map((s) => {
            const color = colors.series[segments.indexOf(s)];
            const segWidth = (s.value / total) * width;
            const label = `${pct(s.value)}%`;
            return (
              <View
                key={s.key}
                style={{ flex: s.value, backgroundColor: color }}
                className="items-center justify-center">
                {segWidth >= 44 ? (
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: luminance(color) > 0.35 ? '#1F1B16' : '#FFFFFF' }}>
                    {label}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-2">
        {segments.map((s, i) => (
          <View key={s.key} className="flex-row items-center gap-1.5">
            <View
              style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.series[i] }}
            />
            <Text className="text-sm text-ink">{s.label}</Text>
            <Text className="text-sm text-muted">
              {s.value} · {pct(s.value)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
