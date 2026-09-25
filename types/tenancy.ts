export type OrganizationStatus = "provisioning" | "onboarding" | "ready_for_review" | "active" | "restricted" | "suspended" | "cancelled";
export type ProvisioningStatus = "pending" | "validating" | "processing" | "completed" | "failed" | "cancelled";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked" | "replaced";
export type MembershipStatus = "invited" | "active" | "suspended" | "revoked";
export type OnboardingProjectStatus = "not_started" | "in_progress" | "blocked" | "ready_for_review" | "changes_requested" | "approved" | "activated" | "cancelled";
export type OnboardingTaskStatus = "pending" | "in_progress" | "completed" | "blocked" | "not_applicable" | "needs_review";

export interface TenantActor {
  authUserId: string;
  email: string;
  displayName: string;
}

export interface ProvisioningEligibility {
  eligible: boolean;
  quoteId: string;
  quoteNumber: string;
  prospectName: string;
  issues: string[];
}

export interface OrganizationSummary {
  id: string;
  code: string;
  slug: string;
  commercialName: string;
  status: OrganizationStatus;
  onboardingStatus: OnboardingProjectStatus;
  onboardingPercentage: number;
  sourceQuoteId: string;
  sourceQuoteNumber: string;
  branchCount: number;
  activeModuleCount: number;
  pendingInvitationCount: number;
  businessProfileId: string;
  administratorEmail: string | null;
  moduleCodes: string[];
  blockerCount: number;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  version: number;
}

export interface OrganizationEntitlement {
  id: string;
  moduleCode: string | null;
  featureCode: string | null;
  enabled: boolean;
  status: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface OrganizationLimit {
  id: string;
  featureCode: string;
  includedQuantity: number;
  hardLimit: number | null;
  warningThreshold: number | null;
  unit: string;
  currentUsage: number;
}

export interface OrganizationFeatureOverride {
  id: string;
  targetType: "module" | "feature_limit";
  moduleCode: string | null;
  featureCode: string | null;
  enabled: boolean | null;
  overrideLimit: number | null;
  effectiveFrom: string;
  effectiveUntil: string;
  reason: string;
  status: string;
}

export interface InvitationSummary {
  id: string;
  email: string;
  roleName: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface OnboardingTaskSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  status: OnboardingTaskStatus;
  required: boolean;
  moduleCode: string | null;
  completedAt: string | null;
  blockedReason: string | null;
}

export interface OnboardingSectionSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  displayOrder: number;
  percentage: number;
  tasks: OnboardingTaskSummary[];
}

export interface ActivationCheckSummary {
  code: string;
  label: string;
  status: "passed" | "failed" | "warning";
  detail: string;
  critical: boolean;
}

export interface OrganizationDetail extends OrganizationSummary {
  legalName: string | null;
  countryCode: string;
  defaultCurrency: string;
  defaultTimezone: string;
  locale: string;
  contactEmail: string;
  contactPhone: string;
  businessProfileId: string;
  entitlements: OrganizationEntitlement[];
  limits: OrganizationLimit[];
  overrides: OrganizationFeatureOverride[];
  invitations: InvitationSummary[];
  onboardingSections: OnboardingSectionSummary[];
  activationChecks: ActivationCheckSummary[];
  subscription: { status: string; billingCycle: string; recurringAmountMinor: number; currency: string } | null;
}

export interface ProvisionOrganizationResult {
  organizationId: string;
  provisioningRequestId: string;
  invitationId: string;
  invitationUrl: string | null;
  reused: boolean;
}

export interface InvitationPreview {
  invitationId: string;
  organizationName: string;
  roleName: string;
  email: string;
  expiresAt: string;
  status: InvitationStatus;
}

export interface CustomerOnboardingSnapshot {
  organization: { id: string; commercialName: string; legalName: string | null; status: OrganizationStatus; timezone: string; locale: string; taxId: string | null; contactEmail: string; contactPhone: string; version: number };
  membership: { id: string; displayName: string; roleNames: string[]; permissions: string[] };
  availableOrganizations: Array<{ id: string; name: string; status: OrganizationStatus }>;
  branches: Array<{ id: string; code: string; name: string; timezone: string; status: string }>;
  areas: Array<{ id: string; branchId: string; code: string; name: string }>;
  warehouses: Array<{ id: string; branchId: string; code: string; name: string }>;
  shifts: Array<{ id: string; branchId: string | null; code: string; name: string }>;
  serviceTypes: Array<{ id: string; branchId: string | null; code: string; name: string }>;
  qualityTemplates: Array<{ id: string; branchId: string | null; code: string; name: string }>;
  products: Array<{ id: string; branchId: string | null; code: string; name: string }>;
  devices: Array<{ id: string; branchId: string | null; code: string; name: string }>;
  sections: OnboardingSectionSummary[];
  progress: number;
  projectStatus: OnboardingProjectStatus;
  imports: Array<{ id: string; type: string; status: string; totalRows: number; validRows: number; invalidRows: number; createdAt: string }>;
}

export interface CustomerOrganizationAccess {
  id: string;
  code: string;
  name: string;
  status: OrganizationStatus;
  membershipStatus: MembershipStatus;
  roleNames: string[];
  onboardingStatus: OnboardingProjectStatus;
  onboardingProgress: number;
  primaryBranchName: string | null;
  moduleCodes: string[];
  lastActivityAt: string;
}

export interface CustomerAccessSnapshot {
  displayName: string;
  organizations: CustomerOrganizationAccess[];
}

export interface CustomerWorkspaceSnapshot {
  organization: {
    id: string;
    code: string;
    commercialName: string;
    status: OrganizationStatus;
    timezone: string;
    lastUpdatedAt: string;
  };
  membership: {
    id: string;
    displayName: string;
    roleNames: string[];
    permissions: string[];
  };
  availableOrganizations: CustomerOrganizationAccess[];
  branches: Array<{ id: string; code: string; name: string; timezone: string; status: string }>;
  currentBranchId: string;
  moduleCodes: string[];
  onboarding: { status: OnboardingProjectStatus; progress: number };
  metrics: {
    employees: number;
    shifts: number;
    serviceTypes: number;
    qualityTemplates: number;
    products: number;
    warehouses: number;
    devices: number;
    inventoryMovements: number;
    pendingImports: number;
  };
}

export interface TenantOverview {
  acceptedQuotesReady: number;
  provisioning: number;
  onboarding: number;
  readyForReview: number;
  active: number;
  failedProvisioning: number;
  pendingInvitations: number;
}
