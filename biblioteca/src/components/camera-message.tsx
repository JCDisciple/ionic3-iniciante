import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function CameraMessage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center gap-3 bg-black/80 px-8">
      <Text className="text-center text-lg font-semibold text-white">{title}</Text>
      <Text className="text-center text-base text-white/80">{message}</Text>
      {action}
    </View>
  );
}
