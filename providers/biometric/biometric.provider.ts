import type { KioskCaptureInput } from "@/types";

export interface BiometricHealth {
  available: boolean;
  provider: string;
  deviceSerial: string | null;
  detail: string;
}

export interface BiometricIdentification {
  provider: string;
  externalTemplateId: string;
  capturedAt: string;
}

export interface BiometricEnrollment extends BiometricIdentification {
  enrollmentReference: string;
}

export interface BiometricProvider {
  /** Enrola en el lector/SDK. KitchenMind recibe solo una referencia externa, nunca la huella cruda. */
  enrollPerson(personId: string): Promise<BiometricEnrollment>;
  /** Identifica en el lector/SDK y devuelve solo la referencia externa ya enrolada. */
  identify(): Promise<BiometricIdentification>;
  verify(personId: string): Promise<boolean>;
  healthCheck(): Promise<BiometricHealth>;
  syncUsers(): Promise<{ synchronized: number }>;
  pullEvents(): Promise<KioskCaptureInput[]>;
  getDeviceStatus(): Promise<BiometricHealth>;
  /** Opcional: el bridge nativo puede custodiar la credencial del dispositivo fuera del navegador. */
  getDeviceToken?(): Promise<string | null>;
  /** Opcional: cola durable del bridge/lector para cortes de Internet. */
  queueEvent?(event: KioskCaptureInput): Promise<void>;
  acknowledgeEvents?(offlineEventIds: string[]): Promise<void>;
}
