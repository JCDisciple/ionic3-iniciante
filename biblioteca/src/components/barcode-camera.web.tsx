import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { CameraMessage } from '@/components/camera-message';

import type { BarcodeCameraProps, CameraState } from './barcode-camera.types';

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
]);

/** Leitor na web: câmera traseira via getUserMedia + @zxing/browser. */
export function BarcodeCamera({ onCode, paused = false }: BarcodeCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCodeRef = useRef(onCode);
  const [state, setState] = useState<CameraState>('starting');

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (paused || !videoRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setState('unavailable'));
      return;
    }

    let controls: IScannerControls | null = null;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
        videoRef.current,
        (result) => {
          if (result) onCodeRef.current(result.getText());
        },
      )
      .then((c) => {
        if (cancelled) c.stop();
        else {
          controls = c;
          setState('ready');
        }
      })
      .catch((error: { name?: string }) => {
        if (cancelled) return;
        setState(error?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [paused]);

  return (
    <View className="flex-1 bg-black">
      {createElement('video', {
        ref: videoRef,
        muted: true,
        playsInline: true,
        autoPlay: true,
        style: { width: '100%', height: '100%', objectFit: 'cover' },
      })}
      {state === 'denied' ? (
        <CameraMessage
          title="Sem acesso à câmera"
          message="Libere a câmera nas permissões do navegador ou digite o ISBN abaixo."
        />
      ) : state === 'unavailable' ? (
        <CameraMessage
          title="Câmera indisponível"
          message="Este navegador não liberou a câmera. Digite o ISBN abaixo."
        />
      ) : null}
    </View>
  );
}
