import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import {
  dailyReminderSupported,
  getDailyReminderHour,
  setDailyReminderHour,
} from '@/lib/daily-reminder';

const HOURS = [8, 12, 21];

/** Perfil: lembrete diário de leitura (só no app das lojas). */
export function DailyReminderRow() {
  const [hour, setHour] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    getDailyReminderHour().then((h) => alive && setHour(h));
    return () => {
      alive = false;
    };
  }, []);

  if (!dailyReminderSupported) return null;

  async function choose(next: number | null) {
    const ok = await setDailyReminderHour(next);
    setDenied(!ok);
    if (ok) setHour(next);
  }

  return (
    <View className="gap-2 px-4 py-3">
      <Text className="text-base text-ink">Lembrete diário de leitura</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Desligado" selected={hour === null} onPress={() => choose(null)} />
        {HOURS.map((h) => (
          <Chip key={h} label={`${h}h`} selected={hour === h} onPress={() => choose(h)} />
        ))}
      </View>
      {denied ? (
        <Text className="text-sm text-danger">
          Permita notificações nas configurações do aparelho.
        </Text>
      ) : null}
    </View>
  );
}
