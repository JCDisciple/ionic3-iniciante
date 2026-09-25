import * as Notifications from 'expo-notifications';

import { ensureAndroidChannel } from '@/lib/push';
import { safeStorage } from '@/lib/safe-storage';

/** Lembrete diário de leitura (notificação local, só no app das lojas). */
const KEY = 'daily-reading-hour';
const ID = 'daily-reading';

export const dailyReminderSupported = true;

export async function getDailyReminderHour(): Promise<number | null> {
  const value = await safeStorage.getItem(KEY);
  return value ? Number(value) : null;
}

/** null desliga. Retorna false se a pessoa negou a permissão. */
export async function setDailyReminderHour(hour: number | null): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  if (hour === null) {
    await safeStorage.removeItem(KEY);
    return true;
  }
  await ensureAndroidChannel();
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'Hora de ler 📖',
      body: 'Algumas páginas hoje? Registre o progresso para manter a sequência.',
      data: { url: '/' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      channelId: 'lembretes',
    },
  });
  await safeStorage.setItem(KEY, String(hour));
  return true;
}
