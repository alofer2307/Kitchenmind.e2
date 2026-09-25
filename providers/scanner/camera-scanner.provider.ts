export interface CameraScanResult {
  value: string;
  format?: string;
}

export interface CameraScannerProvider {
  readonly available: boolean;
  start(onResult: (result: CameraScanResult) => void): Promise<void>;
  stop(): Promise<void>;
}

export class UnavailableCameraScannerProvider implements CameraScannerProvider {
  readonly available = false;

  async start(): Promise<void> {
    throw new Error("El escaneo por cámara todavía no está habilitado en este dispositivo.");
  }

  async stop(): Promise<void> {
    return Promise.resolve();
  }
}
