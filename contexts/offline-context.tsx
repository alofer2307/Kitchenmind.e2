"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useDataProvider } from "./data-provider-context";
import { OfflineQueue, type OfflineQueueInput } from "@/offline/offline-queue";
import { SyncManager } from "@/offline/sync-manager";

interface OfflineContextValue {
  connected: boolean;
  pendingCount: number;
  enqueue: (input: OfflineQueueInput) => Promise<void>;
  retry: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

function subscribeConnectivity(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getConnectivity(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function OfflineContextProvider({ children }: { children: React.ReactNode }) {
  const { provider } = useDataProvider();
  const [queue] = useState(() => new OfflineQueue());
  const [manager] = useState(() => new SyncManager(provider, queue));
  const connected = useSyncExternalStore(subscribeConnectivity, getConnectivity, () => true);
  const pendingCount = useSyncExternalStore(queue.subscribe, queue.getPendingSnapshot, () => 0);

  useEffect(() => {
    void queue.initialize().then(() => manager.syncPending());
  }, [manager, queue]);

  useEffect(() => {
    if (connected) void manager.syncPending();
  }, [connected, manager]);

  const enqueue = useCallback(async (input: OfflineQueueInput) => {
    await queue.enqueue(input);
  }, [queue]);
  const retry = useCallback(async () => {
    await manager.syncPending();
  }, [manager]);
  const value = useMemo(() => ({ connected, pendingCount, enqueue, retry }), [connected, pendingCount, enqueue, retry]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineState(): OfflineContextValue {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("OfflineContext no está disponible.");
  return value;
}
