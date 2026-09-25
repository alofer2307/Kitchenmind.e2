"use client";

import { useCallback, useEffect, useState } from "react";

interface Envelope<T> { data?: T; error?: string; code?: string }

export class QualityRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = "QualityRequestError"; }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await response.json() as Envelope<T>;
  if (!response.ok || body.data === undefined) throw new QualityRequestError(body.error ?? "No fue posible completar la operación de Calidad.", response.status, body.code ?? "quality_request_failed");
  return body.data;
}

export function qualityMutation<T>(action: string, data: unknown): Promise<T> {
  return request<T>("/api/customer/quality", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
}

export async function uploadQualityEvidence(data: FormData): Promise<{ evidenceId: string }> {
  return request<{ evidenceId: string }>("/api/customer/quality/evidence", { method: "POST", body: data });
}

export function useQualityQuery<T>(query: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const load = useCallback(async () => {
    if (!enabled) return undefined;
    setLoading(true); setError(null);
    try {
      const next = await request<T>(`/api/customer/quality?${query}`);
      setData(next);
      return next;
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible consultar Calidad."); return undefined; }
    finally { setLoading(false); }
  }, [enabled, query]);
  useEffect(() => { if (!enabled) return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [enabled, load]);
  return { data, error, loading, refresh: load };
}
