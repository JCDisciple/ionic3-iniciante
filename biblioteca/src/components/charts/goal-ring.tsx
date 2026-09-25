import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useChartColors } from '@/hooks/use-palette';

type GoalRingProps = {
  value: number;
  target: number;
  size?: number;
  label?: string;
};

/** Anel da meta anual: fração lida em torno do número (sem legenda — o texto diz o que é). */
export function GoalRing({ value, target, size = 112, label = 'livros' }: GoalRingProps) {
  const colors = useChartColors();
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? Math.min(1, value / target) : 0;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${value} de ${target} ${label}`}
      accessibilityValue={{ min: 0, max: target, now: value }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.track}
          strokeWidth={stroke}
          fill="none"
        />
        {fraction > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.series[0]}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * fraction} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-2xl font-semibold text-ink">{value}</Text>
        <Text className="text-xs text-muted">de {target}</Text>
      </View>
    </View>
  );
}
