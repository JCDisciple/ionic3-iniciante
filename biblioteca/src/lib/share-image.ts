import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';

import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/share-card';

export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled';

/** No nativo: captura a prévia (SvgXml) em 1080×1920 e abre a folha de compartilhamento. */
export async function shareCardImage(
  _svg: string,
  _fileName: string,
  viewRef?: RefObject<unknown>,
): Promise<ShareImageResult> {
  if (!viewRef?.current) throw new Error('preview_not_ready');
  const uri = await captureRef(viewRef, {
    format: 'png',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    result: 'tmpfile',
  });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  return 'shared';
}
