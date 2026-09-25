import type { OrganizationStatus, TenantActor } from "./tenancy";

/**
 * `diner` remains in the type vocabulary only as a future extension point.
 * Sprint E.2 exposes and mutates employees only; diner/service workflows are deferred.
 */
export type OperationalPersonType = "employee" | "diner" | "visitor" | "contractor";
export type OperationalRecordStatus = "active" | "inactive";
export type OperationalEmployeeStatus = "active" | "inactive" | "suspended" | "terminated";
export type BiometricMethod = "fingerprint";
export type BiometricCredentialStatus = "active" | "revoked" | "replaced";
export type OperationalDeviceType = "biometric" | "kiosk" | "tablet" | "scanner" | "admin_station";
export type OperationalDeviceHealthStatus = "online" | "offline" | "degraded" | "disabled" | "unknown";
export type OperationalSyncStatus = "pending" | "processing" | "synced" | "failed" | "rejected";
export type OperationalAttendanceEventType = "entry" | "exit" | "late" | "incident" | "manual_adjustment";
export type OperationalAttendanceSource = "biometric" | "scanner" | "manual" | "offline_sync";
export type OperationalServiceSource = "biometric" | "scanner" | "manual" | "offline_sync";
export type ServiceAttemptResult = "registered" | "duplicate" | "no_active_service" | "unknown_person" | "inactive_person" | "unauthorized_device" | "rejected";

export interface OperationsOrganizationSummary {
  id: string;
  code: string;
  name: string;
  status: OrganizationStatus;
  timezone: string;
}

export interface OperationsMembershipSummary {
  id: string;
  displayName: string;
  roleNames: string[];
  permissions: string[];
}

export interface OperationsBranchSummary {
  id: string;
  code: string;
  name: string;
  timezone: string;
  status: string;
}

export interface OperationalClientSummary {
  id: string;
  code: string;
  name: string;
  billingReference: string | null;
  status: OperationalRecordStatus;
}

export interface OperationalCostCenterSummary {
  id: string;
  clientId: string | null;
  branchId: string | null;
  code: string;
  name: string;
  status: OperationalRecordStatus;
}

export interface OperationalEmployeeSummary {
  id: string;
  personId: string | null;
  branchId: string;
  branchName: string;
  employeeNumber: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  secondLastName: string | null;
  email: string | null;
  shiftId: string | null;
  shiftName: string | null;
  status: OperationalEmployeeStatus;
  hiredAt: string | null;
  terminatedAt: string | null;
  biometricCredentialCount: number;
  version: number;
}

export interface OperationalPersonSummary {
  id: string;
  branchId: string;
  employeeId: string | null;
  employeeNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  costCenterId: string | null;
  externalNumber: string | null;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  secondLastName?: string | null;
  personType: OperationalPersonType;
  status: OperationalRecordStatus;
  biometricCredentialCount: number;
  version: number;
}

export interface OperationalEmployeeShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  shiftName: string;
  startsOn: string;
  endsOn: string | null;
  reason: string;
  assignedByName: string;
  createdAt: string;
  version: number;
}

export interface OperationalEmployeeBranchAssignment {
  id: string;
  employeeId: string;
  branchId: string;
  branchName: string;
  isPrimary: boolean;
  startsOn: string;
  endsOn: string | null;
  reason: string;
  assignedByName: string;
  createdAt: string;
  version: number;
}

export interface OperationalEmployeeAuditItem {
  id: string;
  action: string;
  reason: string | null;
  outcome: string;
  createdAt: string;
  actorLabel: string;
}

export interface OperationalEmployeeDetail extends OperationalEmployeeSummary {
  shiftAssignments: OperationalEmployeeShiftAssignment[];
  branchAssignments: OperationalEmployeeBranchAssignment[];
  biometricCredentials: BiometricCredentialSummary[];
  attendance: OperationalAttendanceSummary[];
  audit: OperationalEmployeeAuditItem[];
}

export interface OperationalDeviceSummary {
  id: string;
  branchId: string | null;
  code: string;
  name: string;
  deviceType: OperationalDeviceType;
  provider: string;
  serialNumber: string | null;
  capabilities: string[];
  status: OperationalRecordStatus;
  healthStatus: OperationalDeviceHealthStatus;
  healthDetail: string | null;
  bridgeVersion: string | null;
  lastSeenAt: string | null;
  lastHealthAt: string | null;
  lastSyncAt: string | null;
  registeredAt: string;
  hasActiveCredential: boolean;
  version: number;
}

export interface BiometricCredentialSummary {
  id: string;
  personId: string;
  personName: string;
  provider: string;
  externalTemplateIdMasked: string;
  deviceId: string | null;
  method: BiometricMethod;
  status: BiometricCredentialStatus;
  enrolledAt: string;
  revokedAt: string | null;
  reason: string | null;
  version: number;
}

export interface OperationalAttendanceExportRow {
  operationalDate: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  branchName: string;
  shiftName: string | null;
  entryAt: string | null;
  exitAt: string | null;
  lateMinutes: number | null;
  incidentCount: number;
}

export interface OperationalAttendanceSummary {
  id: string;
  branchId: string;
  personId: string | null;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  shiftId: string | null;
  shiftName: string | null;
  deviceId: string | null;
  eventType: OperationalAttendanceEventType;
  adjustedEventType: Exclude<OperationalAttendanceEventType, "manual_adjustment"> | null;
  lateMinutes: number | null;
  eventTimestamp: string;
  operationalDate: string;
  source: OperationalAttendanceSource;
  synchronizationStatus: OperationalSyncStatus;
  reason: string | null;
}

/** Future diner contract. It is intentionally not exposed as a productive module in E.2. */
export interface OperationalServiceEventSummary {
  id: string;
  branchId: string;
  personId: string;
  personName: string;
  employeeId: string | null;
  clientId: string | null;
  clientName: string | null;
  serviceTypeId: string;
  serviceTypeName: string;
  deviceId: string | null;
  eventTimestamp: string;
  operationalDate: string;
  source: OperationalServiceSource;
  synchronizationStatus: OperationalSyncStatus;
  override: boolean;
  overrideReason: string | null;
}

export interface OperationalServiceTypeSummary {
  id: string;
  branchId: string | null;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  perPersonLimit: number;
  status: OperationalRecordStatus;
}

export interface OperationalShiftSummary {
  id: string;
  branchId: string | null;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  daysOfWeek: number[];
  crossesMidnight: boolean;
  status: OperationalRecordStatus;
}

export interface OperationalSyncBatchSummary {
  id: string;
  branchId: string;
  deviceId: string;
  deviceName: string;
  status: OperationalSyncStatus;
  eventCount: number;
  acceptedCount: number;
  rejectedCount: number;
  attemptCount: number;
  lastError: string | null;
  startedAt: string;
  completedAt: string | null;
  lastAttemptAt: string | null;
}

export interface OperationsMetrics {
  employeesActive: number;
  employeesInactive: number;
  employeesWithoutBiometric: number;
  employeesExpected: number;
  attendanceEntries: number;
  attendanceExits: number;
  lateArrivals: number;
  attendanceIncidents: number;
  potentialAbsences: number;
  peopleInside: number;
  pendingSyncEvents: number;
  devicesOnline: number;
  devicesOffline: number;
  devicesDegraded: number;
  /** Deferred by product decision. Kept only to avoid breaking old dashboard contracts. */
  servicesTotal: number;
  serviceDuplicatesRejected: number;
  serviceOverrides: number;
}

export interface OperationsCapabilities {
  personnelRead: boolean;
  personnelManage: boolean;
  shiftsManage: boolean;
  attendanceRead: boolean;
  attendanceCapture: boolean;
  attendanceAdjust: boolean;
  attendanceExport: boolean;
  biometricRead: boolean;
  biometricEnroll: boolean;
  biometricRevoke: boolean;
  devicesRead: boolean;
  devicesManage: boolean;
  crossBranch: boolean;
  restricted: boolean;
  /** Diner/service module intentionally deferred in E.2. */
  servicesRead: false;
  servicesCapture: false;
  servicesOverride: false;
  servicesConfigure: false;
}

export interface OperationsSnapshot {
  organization: OperationsOrganizationSummary;
  membership: OperationsMembershipSummary;
  availableOrganizations: Array<{ id: string; name: string; status: string }>;
  branches: OperationsBranchSummary[];
  selectedBranchId: string | null;
  employees: OperationalEmployeeSummary[];
  people: OperationalPersonSummary[];
  employeeDetail: OperationalEmployeeDetail | null;
  employeePagination: { page: number; pageSize: number; total: number; pages: number; search: string; status: OperationalEmployeeStatus | "all" };
  clients: OperationalClientSummary[];
  costCenters: OperationalCostCenterSummary[];
  devices: OperationalDeviceSummary[];
  biometricCredentials: BiometricCredentialSummary[];
  shifts: OperationalShiftSummary[];
  serviceTypes: OperationalServiceTypeSummary[];
  attendance: OperationalAttendanceSummary[];
  services: OperationalServiceEventSummary[];
  syncBatches: OperationalSyncBatchSummary[];
  metrics: OperationsMetrics;
  capabilities: OperationsCapabilities;
  filters: { branchId: string | null; operationalDate: string };
  generatedAt: string;
  biometricPrivacyNote: string;
  dinersDeferred: true;
}

export interface DeviceIdentity {
  credentialId: string;
  organizationId: string;
  branchId: string;
  deviceId: string;
  deviceCode: string;
  deviceName: string;
  provider: string;
  capabilities: string[];
}

export interface KioskCaptureInput {
  eventKind: "attendance" | "service";
  externalTemplateId: string;
  provider?: string;
  occurredAt: string;
  offlineEventId?: string | null;
  idempotencyKey: string;
  syncBatchKey?: string | null;
  requestedServiceTypeId?: string | null;
}

export type KioskCaptureResult =
  | { status: "registered"; eventKind: "attendance"; eventId: string; personId: string; personName: string; employeeNumber: string; shiftName: string | null; branchName: string; eventType: OperationalAttendanceEventType; lateMinutes: number | null; occurredAt: string; offline: boolean }
  | { status: "duplicate"; eventKind: "attendance"; eventId: string; personId: string; personName: string; employeeNumber: string; shiftName: string | null; branchName: string; eventType: OperationalAttendanceEventType; lateMinutes: number | null; occurredAt: string; offline: boolean }
  | { status: "registered"; eventKind: "service"; eventId: string; personId: string; personName: string; serviceTypeId: string; serviceTypeName: string; occurredAt: string; offline: boolean }
  | { status: "duplicate"; eventKind: "service"; eventId: string; personId: string; personName: string; serviceTypeId: string; serviceTypeName: string; occurredAt: string; previousAt: string; offline: boolean }
  | { status: "no_active_service"; eventKind: "service"; personId: string; personName: string; occurredAt: string }
  | { status: "unknown"; eventKind: "attendance" | "service"; occurredAt: string };

export type OperationsActor = TenantActor;
