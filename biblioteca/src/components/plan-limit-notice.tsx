import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Body } from '@/components/ui/typography';
import { PLAN_LIMIT_MESSAGES, type PlanLimitKind } from '@/lib/plans';

/** Aviso exibido quando o banco recusa algo por limite do plano. */
export function PlanLimitNotice({ kind }: { kind: PlanLimitKind }) {
  return (
    <Card className="gap-3 border-accent/40">
      <View className="flex-row items-start gap-3">
        <Icon name="sparkles-outline" color="accent" />
        <Body className="flex-1">{PLAN_LIMIT_MESSAGES[kind]}</Body>
      </View>
      <Button title="Ver planos" icon="arrow-forward" onPress={() => router.push('/planos')} />
    </Card>
  );
}
