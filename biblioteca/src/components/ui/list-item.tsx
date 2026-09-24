import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';

type ListItemProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  badge?: string;
  destructive?: boolean;
};

export function ListItem({ icon, title, subtitle, onPress, badge, destructive }: ListItemProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="min-h-[56px] flex-row items-center gap-3 px-4 py-3 active:bg-sunken">
      <Icon name={icon} color={destructive ? 'danger' : 'muted'} />
      <View className="flex-1">
        <Text className={`text-base ${destructive ? 'text-danger' : 'text-ink'}`}>{title}</Text>
        {subtitle ? <Text className="text-sm text-muted">{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View className="rounded-full bg-sunken px-2.5 py-1">
          <Text className="text-xs font-semibold text-muted">{badge}</Text>
        </View>
      ) : null}
      {onPress && !destructive ? <Icon name="chevron-forward" size={18} color="muted" /> : null}
    </Pressable>
  );
}
