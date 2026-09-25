"use client";

import { useCallback, useEffect, useState } from "react";

interface Envelope<T> { data?: T; error?: string; code?: string }

export class TenancyRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = "TenancyRequestError"; }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await response.json() as Envelope<T>;
  if (!response.ok || body.data === undefined) throw new TenancyRequestError(body.error ?? "No fue posible completar la operación.", response.status, body.code ?? "tenancy_request_failed");
  return body.data;
}

export function platformTenancyMutation<T>(action: string, data: unknown): Promise<T> {
  return request<T>("/api/platform/tenancy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
}

export function customerOnboardingMutation<T>(action: string, data: unknown): Promise<T> {
  return request<T>("/api/customer/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
}

export function useTenancyQuery<T>(query: string, audience: "platform" | "customer" = "platform", enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(null);
    try { setData(await request<T>(`/api/${audience === "platform" ? "platform/tenancy" : "customer/onboarding"}?${query}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible consultar la información."); }
    finally { setLoading(false); }
  }, [audience, enabled, query]);
  useEffect(() => { if (!enabled) return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [enabled, load]);
  return { data, error, loading, refresh: load };
}
