export type QualityTemplateCategory = "temperature" | "water" | "receiving" | "cleaning" | "hygiene" | "other";
export type QualityTemplateStatus = "draft" | "published" | "archived";
export type QualityScheduleType = "adhoc" | "daily" | "per_shift" | "days" | "multiple_daily" | "interval";
export type OperationalQualityFieldType = "number" | "boolean" | "text" | "select";
export type QualityDeviationSeverity = "warning" | "critical";
export type QualityLogStatus = "pending" | "upcoming" | "in_progress" | "overdue" | "completed" | "corrected" | "cancelled";
export type QualityCorrectiveStatus = "open" | "assigned" | "in_progress" | "overdue" | "resolved" | "verified" | "cancelled";

export interface OperationalQualityTemplateField {
  id: string;
  code: string;
  label: string;
  description: string;
  fieldType: OperationalQualityFieldType;
  unit: string | null;
  required: boolean;
  minimum: number | null;
  maximum: number | null;
  expectedBoolean: boolean | null;
  options: string[];
  nonCompliantOptions: string[];
  deviationSeverity: QualityDeviationSeverity;
  evidenceRequiredOnDeviation: boolean;
  displayOrder: number;
}

export interface QualityTemplateVersion {
  id: string;
  rootTemplateId: string;
  rootBranchId: string | null;
  code: string;
  name: string;
  versionNumber: number;
  version: number;
  status: QualityTemplateStatus;
  category: QualityTemplateCategory;
  instructions: string;
  scheduleType: QualityScheduleType;
  defaultDueTime: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  fields: OperationalQualityTemplateField[];
}

export interface QualityTemplateRoot {
  id: string;
  branchId: string | null;
  code: string;
  name: string;
  status: string;
  versions: QualityTemplateVersion[];
}

export interface QualityLogAnswer {
  id: string;
  fieldId: string;
  valueType: OperationalQualityFieldType;
  value: string | number | boolean | null;
  inRange: boolean | null;
  notes: string;
  capturedAt: string;
  capturedByName: string;
  version: number;
}


export interface QualityTimelineEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  outcome: string;
  reason: string | null;
  actorName: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface QualityEvidenceSummary {
  id: string;
  logInstanceId: string;
  answerId: string | null;
  correctiveActionId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string;
  evidenceType: "general" | "before" | "after" | "document";
  capturedAt: string;
  capturedByName: string;
}

export interface QualityLogSummary {
  id: string;
  branchId: string;
  branchName: string;
  templateVersionId: string;
  templateName: string;
  templateCategory: QualityTemplateCategory;
  templateVersionNumber: number;
  operationalDate: string;
  dueAt: string;
  status: QualityLogStatus;
  completionPercentage: number;
  deviationCount: number;
  assignedToName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  signerName: string | null;
  revisionOfLogId: string | null;
  revisionNumber: number;
  revisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  fields: OperationalQualityTemplateField[];
  answers: QualityLogAnswer[];
  evidence: QualityEvidenceSummary[];
}

export interface QualityCorrectiveActionSummary {
  id: string;
  branchId: string;
  branchName: string;
  logInstanceId: string;
  answerId: string | null;
  title: string;
  description: string;
  severity: QualityDeviationSeverity;
  status: QualityCorrectiveStatus;
  assignedToMembershipId: string | null;
  assignedToName: string | null;
  dueAt: string | null;
  rootCause: string | null;
  immediateCorrection: string | null;
  preventiveAction: string | null;
  resolution: string | null;
  verificationNotes: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  version: number;
}

export interface QualityScheduleRuleSummary {
  id: string;
  branchId: string;
  branchName: string;
  templateVersionId: string;
  templateName: string;
  shiftId: string | null;
  assignedToMembershipId: string | null;
  scheduleType: QualityScheduleType;
  daysOfWeek: number[];
  times: string[];
  intervalMinutes: number | null;
  timezone: string;
  startDate: string;
  endDate: string | null;
  status: "active" | "paused" | "archived";
  lastGeneratedThrough: string | null;
  version: number;
}

export interface QualitySnapshot {
  organization: { id: string; code: string; name: string; status: string; timezone: string };
  membership: { id: string; displayName: string; roleNames: string[]; permissions: string[] };
  availableOrganizations: Array<{ id: string; name: string; status: string }>;
  branches: Array<{ id: string; code: string; name: string; timezone: string; status: string }>;
  shifts: Array<{ id: string; branchId: string | null; code: string; name: string }>;
  assignees: Array<{ id: string; displayName: string }>;
  selectedBranchId: string | null;
  templates: QualityTemplateRoot[];
  logs: QualityLogSummary[];
  correctiveActions: QualityCorrectiveActionSummary[];
  scheduleRules: QualityScheduleRuleSummary[];
  timeline: QualityTimelineEvent[];
  metrics: {
    publishedTemplates: number;
    scheduledInPeriod: number;
    eligibleLogs: number;
    pendingLogs: number;
    inProgressLogs: number;
    completedInPeriod: number;
    deviationsInPeriod: number;
    openCorrectiveActions: number;
    overdueCorrectiveActions: number;
    overdueLogs: number;
    criticalDeviationsInPeriod: number;
    compliancePercent: number | null;
    averageResolutionMinutes: number | null;
    recurrentDeviationGroups: number;
  };
  capabilities: {
    read: boolean;
    configureTemplates: boolean;
    capture: boolean;
    manageCorrectiveActions: boolean;
    uploadEvidence: boolean;
    exportReports: boolean;
    crossBranch: boolean;
    restricted: boolean;
  };
  filters: { branchId: string | null; periodStart: string };
  generatedAt: string;
  selectedLogId: string | null;
  regulatoryNote: string;
}

export interface QualityEvidenceDownload {
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}
