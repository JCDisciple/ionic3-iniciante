import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { usePalette } from '@/hooks/use-palette';
import type { PaletteColors } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: keyof PaletteColors;
};

export function Icon({ name, size = 22, color = 'ink' }: IconProps) {
  const palette = usePalette();
  return <Ionicons name={name} size={size} color={palette[color]} />;
}
