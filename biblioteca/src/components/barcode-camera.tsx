import { CameraView, useCameraPermissions } from 'expo-camera';
import { View } from 'react-native';

import { CameraMessage } from '@/components/camera-message';
import { Button } from '@/components/ui/button';

import type { BarcodeCameraProps } from './barcode-camera.types';

/** Leitor no nativo: expo-camera com leitura de EAN-13. */
export function BarcodeCamera({ onCode, paused = false }: BarcodeCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-black">
        <CameraMessage
          title="Permita o uso da câmera"
          message="A câmera lê o código de barras do livro. Você também pode digitar o ISBN abaixo."
          action={
            permission.canAskAgain ? (
              <Button title="Permitir câmera" onPress={requestPermission} />
            ) : undefined
          }
        />
      </View>
    );
  }

  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      active={!paused}
      barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
      onBarcodeScanned={paused ? undefined : (result) => onCode(result.data)}
    />
  );
}
