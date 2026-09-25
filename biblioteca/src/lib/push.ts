/**
 * Lembretes por notificação. No app nativo (lojas, v2) serão feitos com
 * expo-notifications; por enquanto só a web (PWA) tem push.
 */
export type PushState = 'unsupported' | 'denied' | 'enabled' | 'disabled';

export async function getPushState(): Promise<PushState> {
  return 'unsupported';
}

export async function enablePush(): Promise<PushState> {
  return 'unsupported';
}

export async function disablePush(): Promise<PushState> {
  return 'unsupported';
}
