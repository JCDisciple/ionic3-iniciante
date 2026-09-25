/** Na web não há notificação local agendada: o lembrete diário é do app das lojas. */
export const dailyReminderSupported = false;
export const getDailyReminderHour = async (): Promise<number | null> => null;
export const setDailyReminderHour = async (_hour: number | null): Promise<boolean> => false;
