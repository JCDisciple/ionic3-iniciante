import { Alert, Platform } from 'react-native';

/** Confirmação simples que funciona no nativo (Alert) e na web (window.confirm). */
export function confirm(
  title: string,
  message: string,
  confirmLabel = 'Confirmar',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
