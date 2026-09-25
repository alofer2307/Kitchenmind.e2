import type {
  CustomerAccessSnapshot,
  CustomerOnboardingSnapshot,
  CustomerWorkspaceSnapshot,
  InvitationPreview,
  OrganizationDetail,
  OrganizationSummary,
  ProvisioningEligibility,
  ProvisionOrganizationResult,
  TenantActor,
  TenantOverview,
} from "@/types";
import type { SqlCommand } from "./commercial.contracts";

export interface TenancyDataProvider {
  first<T>(sql: string, values?: unknown[]): Promise<T | null>;
  all<T>(sql: string, values?: unknown[]): Promise<T[]>;
  run(sql: string, values?: unknown[]): Promise<void>;
  batch(commands: SqlCommand[]): Promise<void>;
}

export type CustomerIdentity = TenantActor;

export interface TenancyRepository {
  ensureCatalog(platformUserId: string): Promise<void>;
  overview(): Promise<TenantOverview>;
  acceptedQuotes(): Promise<ProvisioningEligibility[]>;
  eligibility(quoteId: string): Promise<ProvisioningEligibility>;
  provision(quoteId: string, idempotencyKey: string, platformUserId: string): Promise<ProvisionOrganizationResult>;
  organizations(): Promise<OrganizationSummary[]>;
  organization(id: string): Promise<OrganizationDetail | null>;
  platformWorkspace(organizationId: string, branchId?: string): Promise<CustomerWorkspaceSnapshot | null>;
  issueInvitation(organizationId: string, reason: string, platformUserId: string): Promise<{ invitationId: string; invitationUrl: string }>;
  revokeInvitation(organizationId: string, invitationId: string, reason: string, platformUserId: string): Promise<void>;
  createFeatureOverride(organizationId: string, input: { targetType: "module" | "feature_limit"; code: string; enabled?: boolean; overrideLimit?: number; effectiveUntil: string; reason: string }, platformUserId: string): Promise<void>;
  setOrganizationSuspension(organizationId: string, version: number, suspended: boolean, reason: string, platformUserId: string): Promise<void>;
  invitation(token: string): Promise<InvitationPreview | null>;
  acceptInvitation(token: string, identity: CustomerIdentity): Promise<{ organizationId: string }>;
  customerAccess(identity: CustomerIdentity): Promise<CustomerAccessSnapshot>;
  customerWorkspace(identity: CustomerIdentity, organizationId?: string, branchId?: string): Promise<CustomerWorkspaceSnapshot>;
  customerOnboarding(identity: CustomerIdentity, organizationId?: string): Promise<CustomerOnboardingSnapshot>;
  updateProfile(identity: CustomerIdentity, organizationId: string, version: number, input: Record<string, unknown>): Promise<void>;
  createResource(identity: CustomerIdentity, organizationId: string, input: Record<string, unknown>): Promise<void>;
  importEmployees(identity: CustomerIdentity, organizationId: string, idempotencyKey: string, rows: unknown[]): Promise<{ batchId: string; validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> }>;
  importCatalog(identity: CustomerIdentity, organizationId: string, catalogType: string, idempotencyKey: string, rows: unknown[]): Promise<{ batchId: string; validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> }>;
  updateTask(identity: CustomerIdentity, organizationId: string, taskId: string, status: string, reason?: string): Promise<void>;
  requestReview(identity: CustomerIdentity, organizationId: string): Promise<void>;
  evaluateActivation(organizationId: string, platformUserId: string): Promise<OrganizationDetail>;
  activate(organizationId: string, version: number, platformUserId: string): Promise<void>;
}
