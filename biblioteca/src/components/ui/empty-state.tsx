import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Body, Muted, serif } from '@/components/ui/typography';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 rounded-card border border-dashed border-line px-6 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-sunken">
        <Icon name={icon} size={30} color="accent" />
      </View>
      <Body className="text-center text-lg font-semibold" style={serif}>
        {title}
      </Body>
      <Muted className="max-w-xs text-center">{message}</Muted>
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
