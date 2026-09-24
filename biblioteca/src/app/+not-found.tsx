import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 justify-center bg-paper px-4">
      <EmptyState
        icon="help-circle-outline"
        title="Página não encontrada"
        message="Este endereço não existe ou mudou de lugar."
        action={<Button title="Ir para o início" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
