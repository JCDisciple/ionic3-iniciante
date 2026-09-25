import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { useChartColors, usePalette } from '@/hooks/use-palette';
import { niceScale } from '@/lib/chart-scale';
import { MONTH_LABELS, MONTH_NAMES } from '@/lib/stats';

type GoalLineProps = {
  /** Livros acumulados ao fim de cada mês (null = mês futuro). */
  cumulative: (number | null)[];
  target: number;
  height?: number;
};

const AXIS_W = 32;
const X_BAND = 22;

/**
 * Meta anual: livros acumulados (série 1, linha de 2px com marcador final)
 * contra o ritmo linear que bate a meta (referência em cinza). Um eixo só.
 */
export function GoalLine({ cumulative, target, height = 180 }: GoalLineProps) {
  const colors = useChartColors();
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const lastIndex = cumulative.reduce<number>((last, v, i) => (v !== null ? i : last), -1);
  const [selected, setSelected] = useState<number | null>(lastIndex >= 0 ? lastIndex : null);

  const max = Math.max(target, ...cumulative.map((v) => v ?? 0));
  const { top, ticks } = niceScale(max);
  const plotW = Math.max(0, width - AXIS_W - 12);
  const plotH = height - X_BAND - 10;
  // x no FIM de cada mês; o ponto 0 é 1º de janeiro
  const x = (i: number) => AXIS_W + ((i + 1) / 12) * plotW;
  const y = (v: number) => 10 + plotH - (v / top) * plotH;
  const expected = (i: number) => Math.round(((target * (i + 1)) / 12) * 10) / 10;

  const points = [
    `${AXIS_W},${y(0)}`,
    ...cumulative.slice(0, lastIndex + 1).map((v, i) => `${x(i)},${y(v ?? 0)}`),
  ].join(' ');
  const sel =
    selected !== null ? { value: cumulative[selected], expected: expected(selected) } : null;

  return (
    <View className="gap-2" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text className="min-h-[20px] text-sm text-ink" accessibilityLiveRegion="polite">
        {sel && selected !== null
          ? sel.value !== null
            ? `${sel.value} ${sel.value === 1 ? 'livro' : 'livros'} até o fim de ${MONTH_NAMES[selected]} · a meta pedia ${Math.round(sel.expected)}`
            : `Fim de ${MONTH_NAMES[selected]}: a meta pede ${Math.round(sel.expected)}`
          : 'Toque num mês para ver o acumulado.'}
      </Text>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line
              key={t}
              x1={AXIS_W}
              x2={width - 12}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? colors.axis : colors.grid}
              strokeWidth={1}
            />
          ))}
          {ticks.map((t) => (
            <SvgText
              key={`t${t}`}
              x={AXIS_W - 6}
              y={y(t) + 4}
              fontSize={11}
              fill={palette.muted}
              textAnchor="end">
              {t}
            </SvgText>
          ))}
          <Line
            x1={AXIS_W}
            y1={y(0)}
            x2={x(11)}
            y2={y(target)}
            stroke={palette.muted}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.6}
          />
          {lastIndex >= 0 ? (
            <Polyline
              points={points}
              fill="none"
              stroke={colors.series[0]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {selected !== null ? (
            <Line
              x1={x(selected)}
              x2={x(selected)}
              y1={10}
              y2={y(0)}
              stroke={colors.axis}
              strokeWidth={1}
            />
          ) : null}
          {lastIndex >= 0 ? (
            <>
              <Circle
                cx={x(lastIndex)}
                cy={y(cumulative[lastIndex] ?? 0)}
                r={6}
                fill={palette.surface}
              />
              <Circle
                cx={x(lastIndex)}
                cy={y(cumulative[lastIndex] ?? 0)}
                r={4}
                fill={colors.series[0]}
              />
              <SvgText
                x={x(lastIndex)}
                y={y(cumulative[lastIndex] ?? 0) - 10}
                fontSize={12}
                fontWeight="600"
                fill={palette.ink}
                textAnchor="middle">
                {cumulative[lastIndex]}
              </SvgText>
            </>
          ) : null}
          {MONTH_LABELS.map((label, i) =>
            i % 3 === 0 ? (
              <SvgText
                key={label}
                x={x(i)}
                y={height - 6}
                fontSize={11}
                fill={palette.muted}
                textAnchor="middle">
                {label}
              </SvgText>
            ) : null,
          )}
          {MONTH_LABELS.map((label, i) => (
            <Rect
              key={`hit${label}`}
              x={x(i) - plotW / 24}
              y={0}
              width={Math.max(plotW / 12, 24)}
              height={height}
              fill="transparent"
              onPress={() => setSelected(i)}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View className="flex-row gap-4">
        <LegendLine color={colors.series[0]} label="Livros lidos (acumulado)" />
        <LegendLine color={palette.muted} label="Ritmo da meta" faded />
      </View>
    </View>
  );
}

function LegendLine({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{
          width: 16,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          opacity: faded ? 0.6 : 1,
        }}
      />
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
