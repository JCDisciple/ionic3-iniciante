/** Mensagens para a API do Expo Push (https://exp.host/--/api/v2/push/send). Puro. */

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type ReminderMessage = { title: string; body: string; url: string; tag?: string };

export function expoMessages(tokens: string[], message: ReminderMessage) {
  return tokens.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    sound: 'default',
    data: { url: message.url },
    channelId: 'lembretes',
  }));
}

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/** Tokens a apagar: o aparelho desinstalou o app ou revogou a permissão. */
export function invalidTokens(tokens: string[], tickets: Ticket[]): string[] {
  return tickets
    .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
    .filter((t): t is string => !!t);
}
