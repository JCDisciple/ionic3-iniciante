import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, ...props },
  ref,
) {
  const palette = usePalette();
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        className={`min-h-[48px] rounded-card border bg-surface px-4 text-base text-ink ${
          error ? 'border-danger' : 'border-line'
        }`}
        {...props}
      />
      {error ? (
        <Text className="text-sm text-danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-sm text-muted">{hint}</Text>
      ) : null}
    </View>
  );
});
