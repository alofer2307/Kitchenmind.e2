"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { KitchenMindDataProvider } from "@/repositories";
import { LocalDemoProvider } from "@/providers";

const DataProviderContext = createContext<KitchenMindDataProvider | null>(null);

export function DataProviderContextProvider({ children }: { children: React.ReactNode }) {
  const [provider] = useState<KitchenMindDataProvider>(() => new LocalDemoProvider());

  useEffect(() => {
    provider.hydrate();
  }, [provider]);

  return <DataProviderContext.Provider value={provider}>{children}</DataProviderContext.Provider>;
}

export function useDataProvider(): { provider: KitchenMindDataProvider; revision: number } {
  const provider = useContext(DataProviderContext);
  if (!provider) throw new Error("KitchenMindDataProvider no está disponible.");
  const revision = useSyncExternalStore(provider.subscribe.bind(provider), provider.getRevision, () => 0);
  return { provider, revision };
}
