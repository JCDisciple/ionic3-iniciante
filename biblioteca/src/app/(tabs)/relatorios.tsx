import { View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Heading, Muted } from '@/components/ui/typography';

export default function ReportsScreen() {
  return (
    <Screen>
      <View className="gap-1">
        <Heading>Relatórios</Heading>
        <Muted>Período, meta anual, gêneros e autores, ritmo.</Muted>
      </View>
      <EmptyState
        icon="stats-chart-outline"
        title="Seus números aparecem aqui"
        message="Assim que você registrar leituras, mostramos livros e páginas por mês, o progresso da meta e seu ritmo."
      />
    </Screen>
  );
}
