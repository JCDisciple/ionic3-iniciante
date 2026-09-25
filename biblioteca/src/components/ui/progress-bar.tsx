import { View } from 'react-native';

import { useChartColors } from '@/hooks/use-palette';

type ProgressBarProps = {
  /** 0–1 */
  value: number;
  height?: number;
  accessibilityLabel?: string;
};

/** Medidor: preenchimento na cor da série 1 sobre um passo claro da mesma cor. */
export function ProgressBar({ value, height = 8, accessibilityLabel }: ProgressBarProps) {
  const colors = useChartColors();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.track,
        overflow: 'hidden',
      }}>
      <View
        style={{
          height,
          width: `${clamped * 100}%`,
          borderRadius: height / 2,
          backgroundColor: colors.series[0],
        }}
      />
    </View>
  );
}
