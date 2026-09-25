"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const ORGANIZATION_KEY = "kitchenmind.selected.organization";
const ORGANIZATION_EVENT = "kitchenmind:organization";

interface OrganizationContextValue {
  selectedOrganizationId: string | null;
  selectOrganization: (organizationId: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(ORGANIZATION_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(ORGANIZATION_EVENT, listener);
  };
}

function getSnapshot(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(ORGANIZATION_KEY);
}

export function OrganizationContextProvider({ children }: { children: React.ReactNode }) {
  const selectedOrganizationId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const selectOrganization = useCallback((organizationId: string) => {
    window.localStorage.setItem(ORGANIZATION_KEY, organizationId);
    window.dispatchEvent(new Event(ORGANIZATION_EVENT));
  }, []);
  const value = useMemo(() => ({ selectedOrganizationId, selectOrganization }), [selectedOrganizationId, selectOrganization]);
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganizationSelection(): OrganizationContextValue {
  const value = useContext(OrganizationContext);
  if (!value) throw new Error("OrganizationContext no está disponible.");
  return value;
}
