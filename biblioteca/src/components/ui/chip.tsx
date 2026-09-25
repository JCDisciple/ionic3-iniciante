import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Seta ▾ indicando que abre uma lista. */
  dropdown?: boolean;
  dashed?: boolean;
};

export function Chip({ label, selected = false, onPress, icon, dropdown, dashed }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      className={`min-h-[40px] flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-80 ${
        selected ? 'border-accent bg-accent/10' : 'border-line bg-surface'
      } ${dashed ? 'border-dashed' : ''}`}>
      {icon ? <Icon name={icon} size={16} color={selected ? 'accent' : 'muted'} /> : null}
      <Text
        numberOfLines={1}
        className={`text-sm ${selected ? 'font-semibold text-accent' : 'text-ink'}`}>
        {label}
      </Text>
      {dropdown ? (
        <Icon name="chevron-down" size={14} color={selected ? 'accent' : 'muted'} />
      ) : null}
    </Pressable>
  );
}
