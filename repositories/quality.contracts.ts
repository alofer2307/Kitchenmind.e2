import type { SqlCommand } from "./commercial.contracts";
import type { QualityFieldDefinitionInput } from "@/rules/quality.rules";
import type { QualityEvidenceDownload, QualitySnapshot, TenantActor } from "@/types";

export interface QualityDataProvider {
  first<T>(sql: string, values?: unknown[]): Promise<T | null>;
  all<T>(sql: string, values?: unknown[]): Promise<T[]>;
  run(sql: string, values?: unknown[]): Promise<number>;
  batch(commands: SqlCommand[]): Promise<number[]>;
}

export interface QualityTemplateInput {
  organizationId: string;
  rootTemplateId?: string | null;
  branchId?: string | null;
  code: string;
  name: string;
  category: string;
  instructions: string;
  scheduleType: string;
  defaultDueTime?: string | null;
  fields: QualityFieldDefinitionInput[];
  idempotencyKey: string;
}

export interface QualityDraftUpdateInput extends Omit<QualityTemplateInput, "organizationId" | "rootTemplateId" | "branchId" | "idempotencyKey"> {
  organizationId: string;
  templateVersionId: string;
  expectedVersion: number;
}

export interface QualityLogScheduleInput {
  organizationId: string;
  branchId: string;
  templateVersionId: string;
  shiftId?: string | null;
  operationalDate: string;
  dueAt: string;
  assignedToMembershipId?: string | null;
  idempotencyKey: string;
}

export interface QualityScheduleRuleInput {
  organizationId: string;
  branchId: string;
  templateVersionId: string;
  shiftId?: string | null;
  assignedToMembershipId?: string | null;
  scheduleType: "daily" | "per_shift" | "days" | "multiple_daily" | "interval" | "adhoc";
  daysOfWeek: number[];
  times: string[];
  intervalMinutes?: number | null;
  timezone: string;
  startDate: string;
  endDate?: string | null;
  idempotencyKey: string;
}

export interface QualityAnswerInput {
  fieldId: string;
  value: string | number | boolean | null;
  notes?: string;
}

export interface QualityEvidenceAuthorization {
  membershipId: string;
  organizationId: string;
  branchId: string;
  logInstanceId: string;
  answerId: string | null;
  correctiveActionId: string | null;
}

export interface TenantQualityRepository {
  ensureCatalog(): Promise<void>;
  snapshot(identity: TenantActor, filters: { organizationId?: string; branchId?: string | null; period: "today" | "last_7_days" | "last_30_days" | "month"; selectedLogId?: string | null }): Promise<QualitySnapshot>;
  authorizeExport(identity: TenantActor, organizationId: string): Promise<void>;
  createTemplate(identity: TenantActor, input: QualityTemplateInput): Promise<{ templateVersionId: string }>;
  updateDraftTemplate(identity: TenantActor, input: QualityDraftUpdateInput): Promise<void>;
  publishTemplate(identity: TenantActor, organizationId: string, templateVersionId: string, expectedVersion: number): Promise<void>;
  createTemplateRevision(identity: TenantActor, organizationId: string, templateVersionId: string, reason: string, idempotencyKey: string): Promise<{ templateVersionId: string }>;
  scheduleLog(identity: TenantActor, input: QualityLogScheduleInput): Promise<{ logId: string; reused: boolean }>;
  createScheduleRule(identity: TenantActor, input: QualityScheduleRuleInput): Promise<{ ruleId: string; reused: boolean }>;
  generateScheduleRule(identity: TenantActor, input: { organizationId: string; ruleId: string; throughDate: string; idempotencyKey: string }): Promise<{ runId: string; generated: number; reused: number; occurrenceCount: number }>;
  saveAnswers(identity: TenantActor, organizationId: string, logId: string, expectedVersion: number, answers: QualityAnswerInput[]): Promise<void>;
  completeLog(identity: TenantActor, organizationId: string, logId: string, expectedVersion: number, signerName: string, signatureStatement: string): Promise<void>;
  createLogRevision(identity: TenantActor, organizationId: string, logId: string, reason: string, idempotencyKey: string): Promise<{ logId: string }>;
  updateCorrectiveAction(identity: TenantActor, input: { organizationId: string; actionId: string; expectedVersion: number; status: "open" | "assigned" | "in_progress" | "resolved" | "cancelled"; assignedToMembershipId?: string | null; rootCause?: string; immediateCorrection?: string; preventiveAction?: string; resolution?: string; dueAt?: string | null }): Promise<void>;
  verifyCorrectiveAction(identity: TenantActor, input: { organizationId: string; actionId: string; expectedVersion: number; verificationNotes: string }): Promise<void>;
  authorizeEvidenceUpload(identity: TenantActor, input: { organizationId: string; logId: string; answerId?: string | null; correctiveActionId?: string | null }): Promise<QualityEvidenceAuthorization>;
  recordEvidence(input: QualityEvidenceAuthorization & { evidenceId: string; objectKey: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string; note: string; evidenceType: "general" | "before" | "after" | "document" }): Promise<void>;
  evidence(identity: TenantActor, organizationId: string, evidenceId: string): Promise<QualityEvidenceDownload>;
}
