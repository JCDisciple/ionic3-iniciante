import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Heading } from '@/components/ui/typography';

/**
 * Leitor de código de barras. A câmera (expo-camera / @zxing/browser), a busca
 * de ISBN em cascata e o modo lote entram na Fase 2 (Acervo).
 */
export default function ScannerScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Heading className="text-2xl">Adicionar livro</Heading>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-full bg-sunken">
          <Icon name="close" />
        </Pressable>
      </View>
      <View className="flex-1 justify-center px-4">
        <EmptyState
          icon="barcode-outline"
          title="Leitor chegando na próxima fase"
          message="Aqui você vai escanear o ISBN e ver capa, título e autores preenchidos automaticamente."
        />
      </View>
    </SafeAreaView>
  );
}
