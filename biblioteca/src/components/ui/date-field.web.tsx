import { createElement } from 'react';
import { Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

import type { DateFieldProps } from './date-field.types';

/** Na web usa o seletor de data nativo do navegador (<input type="date">). */
export function DateField({ label, value, onChange, min, max, hint }: DateFieldProps) {
  const palette = usePalette();
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      {createElement('input', {
        type: 'date',
        value: value ?? '',
        min,
        max,
        'aria-label': label,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value || null),
        style: {
          minHeight: 48,
          borderRadius: 16,
          border: `1px solid ${palette.line}`,
          background: palette.surface,
          color: palette.ink,
          padding: '0 16px',
          fontSize: 16,
          fontFamily: 'inherit',
          colorScheme: 'light dark',
        },
      })}
      {hint ? <Text className="text-sm text-muted">{hint}</Text> : null}
    </View>
  );
}
