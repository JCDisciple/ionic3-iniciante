import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useChartColors, usePalette } from '@/hooks/use-palette';
import { niceScale } from '@/lib/chart-scale';
import { formatNumber } from '@/lib/stats';

export type ColumnDatum = { key: string; label: string; value: number; readout: string };

type ColumnChartProps = {
  data: ColumnDatum[];
  height?: number;
  /** Índice destacado ao abrir (ex.: mês atual). */
  initialSelected?: number | null;
  accessibilityLabel: string;
};

const AXIS_W = 36;
const X_BAND = 22;
const MAX_BAR = 24;

/** Path de coluna: ponta de dados arredondada (4px), base reta na linha de base. */
export function columnPath(x: number, top: number, width: number, base: number) {
  const r = Math.min(4, width / 2, base - top);
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${base} Z`;
}

/** Colunas de série única (ex.: livros por mês). Toque numa coluna mostra o valor. */
export function ColumnChart({
  data,
  height = 168,
  initialSelected = null,
  accessibilityLabel,
}: ColumnChartProps) {
  const colors = useChartColors();
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(initialSelected);

  const max = Math.max(0, ...data.map((d) => d.value));
  const { top, ticks } = niceScale(max);
  const plotH = height - X_BAND - 8;
  const plotW = Math.max(0, width - AXIS_W);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(MAX_BAR, band * 0.62);
  const y = (v: number) => 8 + plotH - (v / top) * plotH;
  const base = y(0);
  const showEvery = band < 22 ? 2 : 1;
  const current = selected !== null ? data[selected] : null;

  return (
    <View
      className="gap-2"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`${accessibilityLabel}. ${data.map((d) => d.readout).join('; ')}`}>
      <Text className="min-h-[20px] text-sm text-ink" accessibilityLiveRegion="polite">
        {current ? current.readout : 'Toque numa coluna para ver o valor.'}
      </Text>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line
              key={t}
              x1={AXIS_W}
              x2={width}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? colors.axis : colors.grid}
              strokeWidth={1}
            />
          ))}
          {ticks.map((t) => (
            <SvgText
              key={`l${t}`}
              x={AXIS_W - 6}
              y={y(t) + 4}
              fontSize={11}
              fill={palette.muted}
              textAnchor="end">
              {formatNumber(t)}
            </SvgText>
          ))}
          {data.map((d, i) => {
            const x = AXIS_W + i * band + (band - barW) / 2;
            const isSelected = selected === i;
            return d.value > 0 ? (
              <Path
                key={d.key}
                d={columnPath(x, y(d.value), barW, base)}
                fill={colors.series[0]}
                opacity={selected === null || isSelected ? 1 : 0.7}
              />
            ) : null;
          })}
          {current && current.value > 0 && selected !== null ? (
            <SvgText
              x={AXIS_W + selected * band + band / 2}
              y={y(current.value) - 6}
              fontSize={12}
              fontWeight="600"
              fill={palette.ink}
              textAnchor="middle">
              {formatNumber(current.value)}
            </SvgText>
          ) : null}
          {data.map((d, i) =>
            i % showEvery === 0 ? (
              <SvgText
                key={`x${d.key}`}
                x={AXIS_W + i * band + band / 2}
                y={height - 6}
                fontSize={11}
                fill={selected === i ? palette.ink : palette.muted}
                fontWeight={selected === i ? '600' : '400'}
                textAnchor="middle">
                {d.label}
              </SvgText>
            ) : null,
          )}
          {data.map((d, i) => (
            <Rect
              key={`hit${d.key}`}
              x={AXIS_W + i * band}
              y={0}
              width={Math.max(band, 24)}
              height={height}
              fill="transparent"
              onPress={() => setSelected(selected === i ? null : i)}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
