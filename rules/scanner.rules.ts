import { createId } from "@/utils/id";

export interface ScanAttempt {
  identifier: string;
  scannedAt: string;
  idempotencyKey: string;
}

export function normalizeScannedIdentifier(value: string): string {
  return value.replace(/[\r\n\t]/g, "").trim().toUpperCase();
}

export function createScanAttempt(value: string): ScanAttempt {
  return {
    identifier: normalizeScannedIdentifier(value),
    scannedAt: new Date().toISOString(),
    idempotencyKey: createId("scan"),
  };
}

export function isImmediateDuplicate(previous: { identifier: string; timestamp: number } | null, identifier: string, now: number, duplicateWindowMs: number): boolean {
  return Boolean(previous && previous.identifier === identifier && now - previous.timestamp < duplicateWindowMs);
}
