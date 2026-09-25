import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Vibração curta de confirmação (leitura do código, livro salvo). */
export function vibrateSuccess() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(60);
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function vibrateWarning() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([40, 60, 40]);
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
