import { ChartColors, Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useScheme(): 'light' | 'dark' {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function usePalette() {
  return Palette[useScheme()];
}

export function useChartColors() {
  return ChartColors[useScheme()];
}
