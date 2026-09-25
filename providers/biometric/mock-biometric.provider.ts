import type { KioskCaptureInput } from "@/types";
import type { BiometricEnrollment, BiometricHealth, BiometricIdentification, BiometricProvider } from "./biometric.provider";

/** Solo para desarrollo y pruebas. Nunca se selecciona automáticamente en producción. */
export class MockBiometricProvider implements BiometricProvider {
  constructor(private readonly externalTemplateId = "dev-template-001") {}
  private assertDevelopment() { const mode = (globalThis as typeof globalThis & { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV; if (mode === "production") throw new Error("El proveedor biométrico simulado está deshabilitado en producción."); }
  async enrollPerson(personId: string): Promise<BiometricEnrollment> { this.assertDevelopment(); return { provider: "mock", externalTemplateId: this.externalTemplateId, capturedAt: new Date().toISOString(), enrollmentReference: `dev:${personId}` }; }
  async identify(): Promise<BiometricIdentification> { this.assertDevelopment(); return { provider: "mock", externalTemplateId: this.externalTemplateId, capturedAt: new Date().toISOString() }; }
  async verify(): Promise<boolean> { this.assertDevelopment(); return true; }
  async healthCheck(): Promise<BiometricHealth> { this.assertDevelopment(); return { available: true, provider: "mock", deviceSerial: "DEV-ONLY", detail: "Proveedor simulado de desarrollo." }; }
  async syncUsers() { this.assertDevelopment(); return { synchronized: 0 }; }
  async pullEvents(): Promise<KioskCaptureInput[]> { this.assertDevelopment(); return []; }
  async getDeviceStatus() { return this.healthCheck(); }
}
