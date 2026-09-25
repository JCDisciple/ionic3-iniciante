import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/**
 * Compartilha um link pela folha de compartilhamento do sistema. Na web, cai
 * para a área de transferência quando o navegador não suporta Web Share.
 * Retorna 'copied' quando o link foi apenas copiado.
 */
export async function shareLink(message: string, url: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ text: message, url });
        return 'shared';
      } catch {
        // cancelado ou bloqueado: copia
      }
    }
    await Clipboard.setStringAsync(url);
    return 'copied';
  }
  await Share.share({ message: `${message}\n${url}` });
  return 'shared';
}

/** Compartilha só texto (ex.: lista de desejos). Na web sem Web Share, copia. */
export async function shareText(text: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ text });
        return 'shared';
      } catch {
        // cancelado ou bloqueado: copia
      }
    }
    await Clipboard.setStringAsync(text);
    return 'copied';
  }
  await Share.share({ message: text });
  return 'shared';
}
