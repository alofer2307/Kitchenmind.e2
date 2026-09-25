"use client";

import { useCallback, useEffect, useState } from "react";
import { clearDashboardOfflineSnapshots, loadDashboardOfflineSnapshot, saveDashboardOfflineSnapshot } from "@/offline/dashboard-snapshot-cache";
import type { DashboardSnapshot } from "@/types";

interface Envelope<T> { data?: T; error?: string; code?: string }

export class DashboardRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = "DashboardRequestError"; }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await response.json() as Envelope<T>;
  if (!response.ok || body.data === undefined) throw new DashboardRequestError(body.error ?? "No fue posible consultar el tablero.", response.status, body.code ?? "dashboard_request_failed");
  return body.data;
}

export function customerDashboardMutation<T>(action: string, data: unknown): Promise<T> {
  return request<T>("/api/customer/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
}

export function platformDashboardMutation<T>(action: string, data: unknown): Promise<T> {
  return request<T>("/api/platform/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<DashboardSnapshot>;
  return Boolean(snapshot.organization?.id && snapshot.membership?.id && snapshot.freshness?.generatedAt && Array.isArray(snapshot.widgets));
}

export function useDashboardQuery<T>(query: string, audience: "customer" | "platform" = "customer", enabled = true, offlineUserId?: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(null);
    try {
      const next = await request<T>(`/api/${audience}/dashboard?${query}`);
      setData(next);
      if (audience === "customer" && offlineUserId && isDashboardSnapshot(next)) void saveDashboardOfflineSnapshot(offlineUserId, query, next).catch(() => undefined);
    } catch (caught) {
      const denied = caught instanceof DashboardRequestError && (caught.status === 401 || caught.status === 403);
      if (audience === "customer" && offlineUserId && denied) void clearDashboardOfflineSnapshots(offlineUserId).catch(() => undefined);
      const canUseOffline = audience === "customer" && offlineUserId && typeof navigator !== "undefined" && !navigator.onLine && (!(caught instanceof DashboardRequestError) || caught.status >= 500);
      if (canUseOffline) {
        const offline = await loadDashboardOfflineSnapshot(offlineUserId, query).catch(() => null);
        if (offline) {
          setData(offline as T);
          setError(null);
          return;
        }
      }
      setError(caught instanceof Error ? caught.message : "No fue posible consultar el tablero.");
    }
    finally { setLoading(false); }
  }, [audience, enabled, offlineUserId, query]);
  useEffect(() => { if (!enabled) return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [enabled, load]);
  return { data, error, loading, refresh: load };
}
