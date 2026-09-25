import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { formatDate, toISODate } from '@/lib/dates';

import type { DateFieldProps } from './date-field.types';

function fromISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** No nativo abre o seletor de data do sistema. */
export function DateField({ label, value, onChange, min, max, hint }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'sem data'}`}
        onPress={() => setOpen(true)}
        className="min-h-[48px] flex-row items-center justify-between rounded-card border border-line bg-surface px-4">
        <Text className={`text-base ${value ? 'text-ink' : 'text-muted'}`}>
          {value ? formatDate(value) : 'Escolher data'}
        </Text>
        <Icon name="calendar-outline" size={20} color="muted" />
      </Pressable>
      {hint ? <Text className="text-sm text-muted">{hint}</Text> : null}
      {open ? (
        <DateTimePicker
          value={value ? fromISO(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={min ? fromISO(min) : undefined}
          maximumDate={max ? fromISO(max) : undefined}
          onChange={(event, date) => {
            setOpen(Platform.OS === 'ios');
            if (event.type === 'set' && date) onChange(toISODate(date));
            if (Platform.OS === 'ios' && event.type !== 'set') setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
