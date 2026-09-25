export type DashboardPeriod = "today" | "last_7_days" | "last_30_days";
export type DashboardWidgetSize = "small" | "medium" | "large" | "full";
export type DashboardSourceStatus = "available" | "unavailable" | "stale";
export type DashboardValueStatus = "ready" | "empty" | "unavailable" | "stale";
export type AttentionSeverity = "critical" | "warning" | "info";

export interface DashboardWidgetCatalogItem {
  code: string;
  name: string;
  description: string;
  category: string;
  widgetType: string;
  supportedSizes: DashboardWidgetSize[];
  metricCode: string | null;
  sourceModuleCode: string | null;
  requiredFeatureCode: string | null;
  requiredPermission: string | null;
  requiredScopeType: string;
  dataSourceCode: string;
  supportedFilters: string[];
  refreshPolicy: string;
  staleAfterSeconds: number;
  emptyStateType: string;
  sensitivityLevel: string;
  displayOrder: number;
  sourceStatus: DashboardSourceStatus;
  availabilityReason: string | null;
  supportsBranch: boolean;
  supportsPeriod: boolean;
  defaultSize: DashboardWidgetSize;
  sensitive: boolean;
  status: "active" | "inactive";
  version: number;
}

export interface DashboardResolvedWidget extends DashboardWidgetCatalogItem {
  position: number;
  size: DashboardWidgetSize;
  value: number | string | null;
  valueLabel: string;
  detail: string;
  valueStatus: DashboardValueStatus;
  href: string | null;
  updatedAt: string | null;
}

export interface DashboardAttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  reason: string;
  href: string;
  branchId: string | null;
  moduleCode: string | null;
}

export interface DashboardBranchSummary {
  id: string;
  code: string;
  name: string;
  timezone: string;
  employees: number;
  configuredSources: number;
  pendingSetup: number;
  inventoryMovements: number;
  lastActivityAt: string | null;
}

export interface DashboardPresetSummary {
  code: string;
  name: string;
  description: string;
  audience: string;
  version: number;
}

export interface DashboardSnapshot {
  organization: {
    id: string;
    code: string;
    name: string;
    status: string;
    businessProfileCode: string;
    timezone: string;
  };
  membership: {
    id: string;
    displayName: string;
    roleCodes: string[];
    roleNames: string[];
    permissions: string[];
  };
  availableOrganizations: Array<{ id: string; name: string; status: string }>;
  branches: Array<{ id: string; code: string; name: string; timezone: string; status: string }>;
  selectedBranchId: string | null;
  filters: { period: DashboardPeriod; branchId: string | null; timezone: string };
  moduleCodes: string[];
  featureCodes: string[];
  preset: DashboardPresetSummary;
  presetReason: string;
  widgets: DashboardResolvedWidget[];
  attention: DashboardAttentionItem[];
  branchSummaries: DashboardBranchSummary[];
  preference: {
    exists: boolean;
    version: number;
    layout: Array<{ code: string; visible: boolean; size: DashboardWidgetSize; position: number }>;
    defaultFilters: { period: DashboardPeriod; branchId: string | null };
    availablePresets: DashboardPresetSummary[];
  };
  capabilities: {
    configureSelf: boolean;
    configureOrganization: boolean;
    export: boolean;
    crossBranch: boolean;
    sensitiveCosts: boolean;
  };
  freshness: {
    generatedAt: string;
    expiresAt: string;
    fromCache: boolean;
    offlineSnapshot: boolean;
    mode: "live" | "server_cache" | "offline_snapshot";
    unavailableSourceCount: number;
  };
}

export interface DashboardCatalogSnapshot {
  widgets: DashboardWidgetCatalogItem[];
  presets: Array<DashboardPresetSummary & { widgets: Array<{ code: string; position: number; size: DashboardWidgetSize; required: boolean }> }>;
  roleDefaults: Array<{ roleCode: string; presetCode: string; priority: number }>;
  businessProfileDefaults: Array<{ businessProfileCode: string; presetCode: string }>;
  organizations: Array<{ id: string; code: string; name: string; status: string; businessProfileCode: string }>;
  selectedOrganization: {
    id: string;
    presetCode: string;
    presetName: string;
    presetReason: string;
    overrides: Array<{ id: string; targetType: string; targetCode: string; enabled: boolean | null; size: DashboardWidgetSize | null; displayOrder: number | null; effectiveUntil: string | null; reason: string; status: string; version: number }>;
  } | null;
}

export interface PlatformDashboardCatalogSnapshot extends DashboardCatalogSnapshot {
  capabilities: {
    manage: boolean;
  };
}
