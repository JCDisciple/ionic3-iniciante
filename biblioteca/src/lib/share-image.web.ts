import type { RefObject } from 'react';

import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/share-card';

export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled';

async function svgToPng(svg: string): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  canvas.getContext('2d')!.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png_failed'))), 'image/png'),
  );
}

/**
 * Na web: gera o PNG e abre o compartilhamento do sistema (no celular,
 * aparece o Instagram); onde não houver, baixa o arquivo.
 */
export async function shareCardImage(
  svg: string,
  fileName: string,
  _viewRef?: RefObject<unknown>,
): Promise<ShareImageResult> {
  const blob = await svgToPng(svg);
  const file = new File([blob], fileName, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
