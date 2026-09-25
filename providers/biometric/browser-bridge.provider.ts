"use client";

import type { KioskCaptureInput } from "@/types";
import type { BiometricEnrollment, BiometricHealth, BiometricIdentification, BiometricProvider } from "./biometric.provider";

interface KitchenMindBiometricBridge {
  enrollPerson(personId: string): Promise<BiometricEnrollment>;
  identify(): Promise<BiometricIdentification>;
  verify(personId: string): Promise<boolean>;
  healthCheck(): Promise<BiometricHealth>;
  syncUsers(): Promise<{ synchronized: number }>;
  pullEvents(): Promise<KioskCaptureInput[]>;
  getDeviceStatus(): Promise<BiometricHealth>;
  getDeviceToken?(): Promise<string | null>;
  queueEvent?(event: KioskCaptureInput): Promise<void>;
  acknowledgeEvents?(offlineEventIds: string[]): Promise<void>;
}

declare global {
  interface Window { kitchenMindBiometricBridge?: KitchenMindBiometricBridge }
}

function bridge(): KitchenMindBiometricBridge {
  if (typeof window === "undefined" || !window.kitchenMindBiometricBridge) {
    throw new Error("No hay un bridge biométrico compatible conectado a este dispositivo.");
  }
  return window.kitchenMindBiometricBridge;
}

export class BrowserBridgeBiometricProvider implements BiometricProvider {
  enrollPerson(personId: string) { return bridge().enrollPerson(personId); }
  identify() { return bridge().identify(); }
  verify(personId: string) { return bridge().verify(personId); }
  healthCheck() { return bridge().healthCheck(); }
  syncUsers() { return bridge().syncUsers(); }
  pullEvents() { return bridge().pullEvents(); }
  getDeviceStatus() { return bridge().getDeviceStatus(); }
  getDeviceToken() { return bridge().getDeviceToken?.() ?? Promise.resolve(null); }
  queueEvent(event: KioskCaptureInput) {
    const implementation = bridge().queueEvent;
    if (!implementation) throw new Error("El bridge biométrico no tiene una cola offline durable.");
    return implementation(event);
  }
  acknowledgeEvents(offlineEventIds: string[]) { return bridge().acknowledgeEvents?.(offlineEventIds) ?? Promise.resolve(); }
}
