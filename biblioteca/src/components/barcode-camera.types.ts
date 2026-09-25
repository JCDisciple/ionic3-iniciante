export type BarcodeCameraProps = {
  /** Chamado a cada código EAN-13 lido (o chamador filtra ISBN e repetições). */
  onCode: (code: string) => void;
  /** Pausa a leitura (ex.: tela fora de foco). */
  paused?: boolean;
};

export type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable';
