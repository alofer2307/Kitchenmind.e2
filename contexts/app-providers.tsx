"use client";

import { DataProviderContextProvider } from "./data-provider-context";
import { Toaster } from "@/components/ui/sonner";
import { OfflineContextProvider } from "./offline-context";
import { SessionContextProvider } from "./session-context";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { OrganizationContextProvider } from "./organization-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DataProviderContextProvider>
      <SessionContextProvider>
        <OrganizationContextProvider>
          <OfflineContextProvider>
            {children}
            <ServiceWorkerRegistration />
            <Toaster position="top-center" richColors />
          </OfflineContextProvider>
        </OrganizationContextProvider>
      </SessionContextProvider>
    </DataProviderContextProvider>
  );
}
