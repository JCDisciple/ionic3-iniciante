import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { usePalette } from '@/hooks/use-palette';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  className?: string;
};

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-surface border border-line',
  ghost: 'bg-transparent',
  danger: 'bg-surface border border-danger/40',
};

const textByVariant: Record<Variant, string> = {
  primary: 'text-on-accent',
  secondary: 'text-ink',
  ghost: 'text-accent',
  danger: 'text-danger',
};

const iconColorByVariant = {
  primary: 'onAccent',
  secondary: 'ink',
  ghost: 'accent',
  danger: 'danger',
} as const;

export function Button({
  title,
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const palette = usePalette();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`min-h-[48px] flex-row items-center justify-center rounded-card px-5 active:opacity-80 ${
        containerByVariant[variant]
      } ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...props}>
      {loading ? (
        <ActivityIndicator color={palette[iconColorByVariant[variant]]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Icon name={icon} size={20} color={iconColorByVariant[variant]} /> : null}
          <Text className={`text-base font-semibold ${textByVariant[variant]}`}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
