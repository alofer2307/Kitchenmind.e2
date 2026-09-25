"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createId } from "@/utils/id";

const DEVICE_EVENT = "kitchenmind:device-settings";

export function useDeviceSetting(key: string, fallback: string): [string, (value: string) => void] {
  const storageKey = `kitchenmind.device.${key}`;
  const subscribe = useCallback((listener: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) listener(); };
    const onCustom = (event: Event) => { if ((event as CustomEvent<string>).detail === storageKey) listener(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DEVICE_EVENT, onCustom);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(DEVICE_EVENT, onCustom); };
  }, [storageKey]);
  const getSnapshot = useCallback(() => window.localStorage.getItem(storageKey) ?? fallback, [fallback, storageKey]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback((next: string) => {
    window.localStorage.setItem(storageKey, next);
    window.dispatchEvent(new CustomEvent<string>(DEVICE_EVENT, { detail: storageKey }));
  }, [storageKey]);
  return [value, setValue];
}

export function getOrCreateDeviceId(kiosk: "attendance" | "services"): string {
  const key = `kitchenmind.device.${kiosk}.id`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = createId(`device-${kiosk}`);
  window.localStorage.setItem(key, id);
  return id;
}
