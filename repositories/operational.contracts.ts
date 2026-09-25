import type { SqlCommand } from "./commercial.contracts";
import type {
  DeviceIdentity,
  KioskCaptureInput,
  KioskCaptureResult,
  OperationalEmployeeDetail,
  OperationalEmployeeStatus,
  OperationalAttendanceExportRow,
  OperationsActor,
  OperationsSnapshot,
} from "@/types";

export interface OperationalDataProvider {
  first<T>(sql: string, values?: unknown[]): Promise<T | null>;
  all<T>(sql: string, values?: unknown[]): Promise<T[]>;
  run(sql: string, values?: unknown[]): Promise<number>;
  batch(commands: SqlCommand[]): Promise<number[]>;
}

export interface OperationsSnapshotFilters {
  organizationId?: string;
  branchId?: string | null;
  operationalDate?: string | null;
  employeeSearch?: string | null;
  employeeStatus?: OperationalEmployeeStatus | "all" | null;
  employeePage?: number | null;
  employeePageSize?: number | null;
  employeeId?: string | null;
}

export interface EmployeeWriteInput {
  organizationId: string;
  branchId: string;
  employeeNumber: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  secondLastName?: string | null;
  email?: string | null;
  shiftId?: string | null;
  hiredAt?: string | null;
}

export interface EmployeeImportRowInput {
  rowNumber: number;
  employeeNumber: string;
  name: string;
  email?: string | null;
  branchCode: string;
  shiftCode?: string | null;
  hiredAt?: string | null;
  status?: OperationalEmployeeStatus | null;
}

export interface EmployeeImportPreview {
  total: number;
  valid: number;
  duplicates: number;
  rejected: number;
  rows: Array<{ rowNumber: number; employeeNumber: string; name: string; status: "valid" | "duplicate" | "rejected"; errors: string[]; branchId?: string; shiftId?: string | null }>;
}

export interface OperationalRepository {
  ensureCatalog(): Promise<void>;
  snapshot(identity: OperationsActor, filters: OperationsSnapshotFilters): Promise<OperationsSnapshot>;
  employeeDetail(identity: OperationsActor, input: { organizationId: string; employeeId: string }): Promise<OperationalEmployeeDetail>;
  createEmployee(identity: OperationsActor, input: EmployeeWriteInput): Promise<{ employeeId: string; personId: string }>;
  updateEmployee(identity: OperationsActor, input: EmployeeWriteInput & { employeeId: string; expectedVersion: number }): Promise<void>;
  setEmployeeStatus(identity: OperationsActor, input: { organizationId: string; employeeId: string; status: OperationalEmployeeStatus; reason: string; expectedVersion: number }): Promise<void>;
  ensureEmployeePeople(identity: OperationsActor, organizationId: string): Promise<{ created: number; reused: number }>;
  previewEmployeeImport(identity: OperationsActor, input: { organizationId: string; rows: EmployeeImportRowInput[] }): Promise<EmployeeImportPreview>;
  commitEmployeeImport(identity: OperationsActor, input: { organizationId: string; rows: EmployeeImportRowInput[]; idempotencyKey: string }): Promise<{ imported: number; reused: boolean }>;
  createShift(identity: OperationsActor, input: { organizationId: string; branchId?: string | null; code: string; name: string; startTime: string; endTime: string; toleranceMinutes: number; daysOfWeek: number[] }): Promise<{ shiftId: string }>;
  configureShift(identity: OperationsActor, input: { organizationId: string; shiftId: string; startTime: string; endTime: string; toleranceMinutes: number; daysOfWeek: number[] }): Promise<void>;
  assignShift(identity: OperationsActor, input: { organizationId: string; employeeId: string; shiftId: string; startsOn: string; endsOn?: string | null; reason: string }): Promise<{ assignmentId: string }>;
  assignBranch(identity: OperationsActor, input: { organizationId: string; employeeId: string; branchId: string; startsOn: string; endsOn?: string | null; isPrimary: boolean; reason: string }): Promise<{ assignmentId: string }>;
  createDevice(identity: OperationsActor, input: { organizationId: string; branchId: string; code: string; name: string; deviceType: "biometric" | "kiosk" | "tablet" | "scanner" | "admin_station"; provider: string; serialNumber?: string | null; capabilities: string[] }): Promise<{ deviceId: string }>;
  configureDevice(identity: OperationsActor, input: { organizationId: string; deviceId: string; deviceType: "biometric" | "kiosk" | "tablet" | "scanner" | "admin_station"; provider: string; serialNumber?: string | null; capabilities: string[]; configuration?: Record<string, unknown>; expectedVersion: number }): Promise<void>;
  enrollBiometric(identity: OperationsActor, input: { organizationId: string; personId: string; provider: string; externalTemplateId: string; deviceId?: string | null }): Promise<{ credentialId: string; reused: boolean }>;
  revokeBiometric(identity: OperationsActor, input: { organizationId: string; credentialId: string; expectedVersion: number; reason: string }): Promise<void>;
  issueDeviceCredential(identity: OperationsActor, input: { organizationId: string; deviceId: string; expiresAt?: string | null }): Promise<{ deviceId: string; token: string; tokenPrefix: string }>;
  revokeDeviceCredential(identity: OperationsActor, input: { organizationId: string; deviceId: string; reason: string }): Promise<void>;
  manualAttendanceAdjustment(identity: OperationsActor, input: { organizationId: string; branchId: string; employeeId: string; adjustedEventType: "entry" | "exit" | "late" | "incident"; occurredAt: string; reason: string; originalEventId?: string | null; idempotencyKey: string }): Promise<{ eventId: string }>;
  attendanceExport(identity: OperationsActor, input: { organizationId: string; branchId?: string | null; operationalDate: string }): Promise<OperationalAttendanceExportRow[]>;
  authenticateDevice(token: string): Promise<DeviceIdentity>;
  heartbeat(device: DeviceIdentity, input: { bridgeVersion?: string | null; health?: Record<string, unknown>; status?: "online" | "degraded" | "unknown" }): Promise<{ receivedAt: string }>;
  captureFromDevice(device: DeviceIdentity, input: KioskCaptureInput): Promise<KioskCaptureResult>;
  ingestSyncBatch(device: DeviceIdentity, input: { idempotencyKey: string; events: KioskCaptureInput[] }): Promise<{ batchId: string; reused: boolean; accepted: number; rejected: number; results: KioskCaptureResult[] }>;
}
