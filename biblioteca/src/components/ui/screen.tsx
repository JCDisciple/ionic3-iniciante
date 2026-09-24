import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Rolagem do conteúdo (padrão: true). Desligue para listas virtualizadas. */
  scroll?: boolean;
  edges?: Edge[];
  /** Espaço extra no fim para não ficar sob a barra de abas. */
  bottomInset?: number;
};

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  bottomInset = 32,
}: ScreenProps) {
  const content = (
    <View
      className="w-full flex-1 gap-6 self-center px-4 pt-4"
      style={{ maxWidth: MaxContentWidth }}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-paper">
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomInset }}
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
