import type { DashboardCatalogSnapshot, DashboardPeriod, DashboardSnapshot, DashboardWidgetSize, PlatformActor, TenantActor } from "@/types";
import type { TenancyDataProvider } from "./tenancy.contracts";

export type DashboardDataProvider = TenancyDataProvider;

export interface DashboardFilters {
  organizationId?: string;
  branchId?: string | null;
  period?: DashboardPeriod;
}

export interface DashboardRepository {
  ensureCatalog(): Promise<void>;
  customerSnapshot(identity: TenantActor, filters: DashboardFilters): Promise<DashboardSnapshot>;
  exportCustomerSnapshot(identity: TenantActor, filters: DashboardFilters): Promise<DashboardSnapshot>;
  savePreference(identity: TenantActor, organizationId: string, input: { presetCode: string; version: number; layout: Array<{ code: string; visible: boolean; size: DashboardWidgetSize; position: number }>; defaultFilters: { period: DashboardPeriod; branchId: string | null } }): Promise<void>;
  resetPreference(identity: TenantActor, organizationId: string): Promise<void>;
  saveOrganizationOverride(identity: TenantActor, organizationId: string, input: { targetType: "preset" | "widget"; targetCode: string; enabled?: boolean; size?: DashboardWidgetSize; displayOrder?: number; effectiveUntil?: string; reason: string }): Promise<void>;
  catalog(organizationId?: string): Promise<DashboardCatalogSnapshot>;
  setWidgetStatus(actor: PlatformActor, input: { code: string; active: boolean; version: number; reason: string }): Promise<void>;
  savePlatformOrganizationOverride(actor: PlatformActor, organizationId: string, input: { targetType: "preset" | "widget"; targetCode: string; enabled?: boolean; size?: DashboardWidgetSize; displayOrder?: number; effectiveUntil?: string; reason: string }): Promise<void>;
}
