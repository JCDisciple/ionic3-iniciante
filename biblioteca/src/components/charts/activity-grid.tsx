import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useChartColors } from '@/hooks/use-palette';
import { formatDate } from '@/lib/dates';

type ActivityGridProps = {
  /** Colunas = semanas; cada uma com 7 dias (domingo a sábado); null = futuro. */
  weeks: ({ date: string; active: boolean } | null)[][];
};

const GAP = 3;
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Dias com leitura nas últimas semanas (binário: leu / não leu). */
export function ActivityGrid({ weeks }: ActivityGridProps) {
  const colors = useChartColors();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<{ date: string; active: boolean } | null>(null);
  const labelW = 14;
  const cell = weeks.length
    ? Math.min(22, (width - labelW - GAP * (weeks.length - 1)) / weeks.length)
    : 0;
  const activeDays = weeks.flat().filter((d) => d?.active).length;

  return (
    <View className="gap-2" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text className="min-h-[20px] text-sm text-ink" accessibilityLiveRegion="polite">
        {selected
          ? `${formatDate(selected.date)}: ${selected.active ? 'leu' : 'sem leitura registrada'}`
          : `${activeDays} ${activeDays === 1 ? 'dia' : 'dias'} com leitura nas últimas ${weeks.length} semanas`}
      </Text>
      {cell > 0 ? (
        <View
          className="flex-row"
          accessible
          accessibilityLabel={`${activeDays} dias com leitura nas últimas ${weeks.length} semanas`}>
          <View style={{ width: labelW, gap: GAP }}>
            {WEEKDAYS.map((d, i) => (
              <Text
                key={i}
                style={{ height: cell, lineHeight: cell, fontSize: 9 }}
                className="text-muted">
                {i % 2 === 1 ? d : ''}
              </Text>
            ))}
          </View>
          <Svg width={weeks.length * (cell + GAP)} height={7 * (cell + GAP)}>
            {weeks.map((week, w) =>
              week.map((day, d) =>
                day ? (
                  <Rect
                    key={day.date}
                    x={w * (cell + GAP)}
                    y={d * (cell + GAP)}
                    width={cell}
                    height={cell}
                    rx={3}
                    fill={day.active ? colors.series[0] : colors.empty}
                    stroke={selected?.date === day.date ? colors.axis : 'none'}
                    strokeWidth={selected?.date === day.date ? 2 : 0}
                    onPress={() => setSelected(selected?.date === day.date ? null : day)}
                  />
                ) : null,
              ),
            )}
          </Svg>
        </View>
      ) : null}
      <View className="flex-row gap-4">
        <View className="flex-row items-center gap-1.5">
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.empty }} />
          <Text className="text-xs text-muted">Sem leitura</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.series[0] }}
          />
          <Text className="text-xs text-muted">Com leitura</Text>
        </View>
      </View>
    </View>
  );
}
