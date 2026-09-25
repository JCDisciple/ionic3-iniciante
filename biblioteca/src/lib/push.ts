import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { safeStorage } from '@/lib/safe-storage';
import { supabase } from '@/lib/supabase';

/**
 * Lembretes de devolução no app das lojas: token do Expo Push salvo em
 * push_subscriptions (kind = 'expo'); o loan-reminders envia pelo Expo.
 */
export type PushState = 'unsupported' | 'denied' | 'enabled' | 'disabled';

const TOKEN_KEY = 'expo-push-token';
const projectId =
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
  Constants.easConfig?.projectId;

export async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lembretes', {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getPushState(): Promise<PushState> {
  if (!projectId) return 'unsupported';
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? 'disabled' : 'denied';
  return (await safeStorage.getItem(TOKEN_KEY)) ? 'enabled' : 'disabled';
}

export async function enablePush(): Promise<PushState> {
  if (!projectId) return 'unsupported';
  await ensureAndroidChannel();
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? 'disabled' : 'denied';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('save_expo_push_token', {
    p_token: token,
    p_platform: Platform.OS,
  });
  if (error) throw new Error(error.message);
  await safeStorage.setItem(TOKEN_KEY, token);
  return 'enabled';
}

export async function disablePush(): Promise<PushState> {
  const token = await safeStorage.getItem(TOKEN_KEY);
  if (token) await supabase.from('push_subscriptions').delete().eq('endpoint', token);
  await safeStorage.removeItem(TOKEN_KEY);
  return 'disabled';
}
