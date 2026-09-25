"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
  code?: string;
  duplicates?: unknown[];
}

export class CommercialRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly detail?: unknown) {
    super(message);
    this.name = "CommercialRequestError";
  }
}

export async function commercialMutation<T>(action: string, data: unknown): Promise<T> {
  const response = await fetch("/api/platform/commercial", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || body.data === undefined) {
    if (response.status === 401) window.location.assign("/platform");
    throw new CommercialRequestError(body.error ?? "No fue posible completar la operación.", response.status, body.code ?? "commercial_request_failed", body.duplicates);
  }
  return body.data;
}

export function useCommercialQuery<T>(query: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/platform/commercial?${query}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json() as ApiEnvelope<T>;
      if (!response.ok || body.data === undefined) {
        if (response.status === 401) window.location.assign("/platform");
        throw new Error(body.error ?? "No fue posible consultar la información.");
      }
      setData(body.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible consultar la información.");
    } finally {
      setLoading(false);
    }
  }, [enabled, query]);
  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [enabled, load]);
  return { data, error, loading, refresh: load };
}
