"use client";

import { useCallback, useEffect, useState } from "react";

interface Envelope<T> { data?: T; error?: string; code?: string }

export class OperationsRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = "OperationsRequestError"; }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await response.json() as Envelope<T>;
  if (!response.ok || body.data === undefined) throw new OperationsRequestError(body.error ?? "No fue posible completar la operación.", response.status, body.code ?? "operations_request_failed");
  return body.data;
}

export function operationsMutation<T>(action: string, data: unknown): Promise<T> {
  return request<T>("/api/customer/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
}

export function useOperationsQuery<T>(query: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const next = await request<T>(`/api/customer/operations?${query}`); setData(next); return next; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible consultar la operación."); return undefined; }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return { data, error, loading, refresh: load };
}
