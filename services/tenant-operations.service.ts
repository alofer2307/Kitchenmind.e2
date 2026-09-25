import "server-only";
import { z } from "zod";
import { D1OperationalDataProvider } from "@/providers/d1-operational.provider";
import { D1OperationalRepository } from "@/repositories/d1-operational.repository";
import type { KioskCaptureInput, OperationsActor, OperationalEmployeeStatus, TenantActor } from "@/types";

export class OperationsApplicationError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "operations_invalid_request") {
    super(message);
    this.name = "OperationsApplicationError";
  }
}

function parse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new OperationsApplicationError(result.error.issues[0]?.message ?? "Revisa los datos enviados.");
  return result.data;
}

const id = z.string().uuid();
const nullableId = z.union([id, z.null()]).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime({ offset: true });
const idempotency = z.string().trim().min(8).max(220);
const organization = z.object({ organizationId: id }).strict();
const employeeStatus = z.enum(["active", "inactive", "suspended", "terminated"]);
const hhmm = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

const employeeWrite = organization.extend({
  branchId: id,
  employeeNumber: z.string().trim().min(1).max(100),
  name: z.string().trim().min(2).max(160),
  firstName: z.union([z.string().trim().max(100), z.null()]).optional(),
  lastName: z.union([z.string().trim().max(100), z.null()]).optional(),
  secondLastName: z.union([z.string().trim().max(100), z.null()]).optional(),
  email: z.union([z.string().trim().email().max(180), z.literal(""), z.null()]).optional(),
  shiftId: nullableId,
  hiredAt: z.union([isoDate, z.null()]).optional(),
}).strict();

const employeeUpdate = employeeWrite.extend({ employeeId: id, expectedVersion: z.number().int().positive() }).strict();
const employeeImportRow = z.object({
  rowNumber: z.number().int().positive(),
  employeeNumber: z.string().trim().min(1).max(100),
  name: z.string().trim().min(2).max(160),
  email: z.union([z.string().trim().email().max(180), z.literal(""), z.null()]).optional(),
  branchCode: z.string().trim().min(1).max(80),
  shiftCode: z.union([z.string().trim().max(80), z.literal(""), z.null()]).optional(),
  hiredAt: z.union([isoDate, z.literal(""), z.null()]).optional(),
  status: z.union([employeeStatus, z.null()]).optional(),
}).strict();
const employeeImport = organization.extend({ rows: z.array(employeeImportRow).min(1).max(5000) }).strict();
const employeeImportCommit = employeeImport.extend({ idempotencyKey: idempotency }).strict();

const employeeStatusChange = organization.extend({ employeeId: id, status: employeeStatus, reason: z.string().trim().min(5).max(500), expectedVersion: z.number().int().positive() }).strict();

const createShift = organization.extend({
  branchId: nullableId,
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(120),
  startTime: hhmm,
  endTime: hhmm,
  toleranceMinutes: z.number().int().min(0).max(240),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
}).strict();

const shiftConfiguration = organization.extend({
  shiftId: id,
  startTime: hhmm,
  endTime: hhmm,
  toleranceMinutes: z.number().int().min(0).max(240),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
}).strict();

const assignShift = organization.extend({ employeeId: id, shiftId: id, startsOn: isoDate, endsOn: z.union([isoDate, z.null()]).optional(), reason: z.string().trim().min(3).max(500) }).strict();
const assignBranch = organization.extend({ employeeId: id, branchId: id, startsOn: isoDate, endsOn: z.union([isoDate, z.null()]).optional(), isPrimary: z.boolean(), reason: z.string().trim().min(3).max(500) }).strict();

const deviceCreate = organization.extend({
  branchId: id,
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  deviceType: z.enum(["biometric", "kiosk", "tablet", "scanner", "admin_station"]),
  provider: z.string().trim().min(1).max(60),
  serialNumber: z.union([z.string().trim().max(120), z.null()]).optional(),
  capabilities: z.array(z.enum(["attendance", "enrollment", "*"])).min(1).max(10),
}).strict();

const deviceConfiguration = organization.extend({
  deviceId: id,
  deviceType: z.enum(["biometric", "kiosk", "tablet", "scanner", "admin_station"]),
  provider: z.string().trim().min(1).max(60),
  serialNumber: z.union([z.string().trim().max(120), z.null()]).optional(),
  capabilities: z.array(z.enum(["attendance", "enrollment", "*"])).min(1).max(10),
  configuration: z.record(z.unknown()).optional(),
  expectedVersion: z.number().int().positive(),
}).strict();

const enrollBiometric = organization.extend({ personId: id, provider: z.string().trim().min(1).max(60), externalTemplateId: z.string().trim().min(3).max(200), deviceId: nullableId }).strict();
const revokeBiometric = organization.extend({ credentialId: id, expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(500) }).strict();
const deviceCredential = organization.extend({ deviceId: id, expiresAt: z.union([isoTimestamp, z.null()]).optional() }).strict();
const revokeDeviceCredential = organization.extend({ deviceId: id, reason: z.string().trim().min(5).max(500) }).strict();

const attendanceAdjustment = organization.extend({
  branchId: id,
  employeeId: id,
  adjustedEventType: z.enum(["entry", "exit", "late", "incident"]),
  occurredAt: isoTimestamp,
  reason: z.string().trim().min(5).max(500),
  originalEventId: nullableId,
  idempotencyKey: idempotency,
}).strict();

const kioskCapture = z.object({
  eventKind: z.literal("attendance"),
  externalTemplateId: z.string().trim().min(3).max(200),
  provider: z.string().trim().min(1).max(60).optional(),
  occurredAt: isoTimestamp,
  offlineEventId: z.union([z.string().trim().min(1).max(160), z.null()]).optional(),
  idempotencyKey: idempotency,
  syncBatchKey: z.union([z.string().trim().max(200), z.null()]).optional(),
}).strict();

const syncBatch = z.object({ idempotencyKey: idempotency, events: z.array(kioskCapture).min(1).max(250) }).strict();
const heartbeat = z.object({ bridgeVersion: z.union([z.string().trim().max(80), z.null()]).optional(), health: z.record(z.unknown()).optional(), status: z.enum(["online", "degraded", "unknown"]).optional() }).strict();

export class TenantOperationsService {
  private readonly repository = new D1OperationalRepository(new D1OperationalDataProvider());
  constructor(private readonly identity: TenantActor | null) {}

  private requireIdentity(): OperationsActor {
    if (!this.identity) throw new OperationsApplicationError("Inicia sesión para abrir Personal.", 401, "authentication_required");
    return this.identity;
  }

  async snapshot(params: { organizationId?: string | null; branchId?: string | null; operationalDate?: string | null; employeeSearch?: string | null; employeeStatus?: string | null; employeePage?: string | number | null; employeePageSize?: string | number | null; employeeId?: string | null }) {
    const status = params.employeeStatus && params.employeeStatus !== "all" ? parse(employeeStatus, params.employeeStatus) : "all";
    const page = params.employeePage === null || params.employeePage === undefined || params.employeePage === "" ? null : Number(params.employeePage);
    const pageSize = params.employeePageSize === null || params.employeePageSize === undefined || params.employeePageSize === "" ? null : Number(params.employeePageSize);
    if (page !== null && (!Number.isInteger(page) || page < 1)) throw new OperationsApplicationError("La página no es válida.");
    if (pageSize !== null && (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 100)) throw new OperationsApplicationError("El tamaño de página debe estar entre 10 y 100.");
    return this.repository.snapshot(this.requireIdentity(), {
      organizationId: params.organizationId ? parse(id, params.organizationId) : undefined,
      branchId: params.branchId && params.branchId !== "all" ? parse(id, params.branchId) : null,
      operationalDate: params.operationalDate ? parse(isoDate, params.operationalDate) : null,
      employeeSearch: params.employeeSearch?.trim().slice(0, 100) || null,
      employeeStatus: status as OperationalEmployeeStatus | "all",
      employeePage: page,
      employeePageSize: pageSize,
      employeeId: params.employeeId ? parse(id, params.employeeId) : null,
    });
  }

  async createEmployee(value: unknown) { return this.repository.createEmployee(this.requireIdentity(), parse(employeeWrite, value)); }
  async updateEmployee(value: unknown) { const input = parse(employeeUpdate, value); await this.repository.updateEmployee(this.requireIdentity(), input); return { updated: true }; }
  async setEmployeeStatus(value: unknown) { const input = parse(employeeStatusChange, value); await this.repository.setEmployeeStatus(this.requireIdentity(), input); return { updated: true }; }
  async synchronizeEmployees(value: unknown) { const input = parse(organization, value); return this.repository.ensureEmployeePeople(this.requireIdentity(), input.organizationId); }
  async previewEmployeeImport(value: unknown) { return this.repository.previewEmployeeImport(this.requireIdentity(), parse(employeeImport, value)); }
  async commitEmployeeImport(value: unknown) { return this.repository.commitEmployeeImport(this.requireIdentity(), parse(employeeImportCommit, value)); }
  async createShift(value: unknown) { return this.repository.createShift(this.requireIdentity(), parse(createShift, value)); }
  async configureShift(value: unknown) { const input = parse(shiftConfiguration, value); await this.repository.configureShift(this.requireIdentity(), input); return { updated: true }; }
  async assignShift(value: unknown) { return this.repository.assignShift(this.requireIdentity(), parse(assignShift, value)); }
  async assignBranch(value: unknown) { return this.repository.assignBranch(this.requireIdentity(), parse(assignBranch, value)); }
  async createDevice(value: unknown) { return this.repository.createDevice(this.requireIdentity(), parse(deviceCreate, value)); }
  async configureDevice(value: unknown) { const input = parse(deviceConfiguration, value); await this.repository.configureDevice(this.requireIdentity(), input); return { updated: true }; }
  async enrollBiometric(value: unknown) { return this.repository.enrollBiometric(this.requireIdentity(), parse(enrollBiometric, value)); }
  async revokeBiometric(value: unknown) { const input = parse(revokeBiometric, value); await this.repository.revokeBiometric(this.requireIdentity(), input); return { revoked: true }; }
  async issueDeviceCredential(value: unknown) { return this.repository.issueDeviceCredential(this.requireIdentity(), parse(deviceCredential, value)); }
  async revokeDeviceCredential(value: unknown) { const input = parse(revokeDeviceCredential, value); await this.repository.revokeDeviceCredential(this.requireIdentity(), input); return { revoked: true }; }
  async manualAttendanceAdjustment(value: unknown) { return this.repository.manualAttendanceAdjustment(this.requireIdentity(), parse(attendanceAdjustment, value)); }
  async attendanceExport(params: { organizationId?: string | null; branchId?: string | null; operationalDate?: string | null }) {
    const organizationId = params.organizationId ? parse(id, params.organizationId) : undefined;
    if (!organizationId) throw new OperationsApplicationError("Selecciona una organización para exportar asistencia.");
    const operationalDate = params.operationalDate ? parse(isoDate, params.operationalDate) : new Date().toISOString().slice(0,10);
    return this.repository.attendanceExport(this.requireIdentity(), { organizationId, branchId: params.branchId && params.branchId !== "all" ? parse(id, params.branchId) : null, operationalDate });
  }
}

export class KioskOperationsService {
  private readonly repository = new D1OperationalRepository(new D1OperationalDataProvider());

  async capture(token: string, value: unknown) {
    const device = await this.repository.authenticateDevice(token);
    const input = parse(kioskCapture, value) as KioskCaptureInput;
    return this.repository.captureFromDevice(device, input);
  }

  async synchronize(token: string, value: unknown) {
    const device = await this.repository.authenticateDevice(token);
    const input = parse(syncBatch, value);
    return this.repository.ingestSyncBatch(device, { idempotencyKey: input.idempotencyKey, events: input.events as KioskCaptureInput[] });
  }

  async heartbeat(token: string, value: unknown) {
    const device = await this.repository.authenticateDevice(token);
    return this.repository.heartbeat(device, parse(heartbeat, value));
  }
}

export function operationsErrorStatus(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof OperationsApplicationError) return { message: error.message, status: error.status, code: error.code };
  if (error instanceof Error) {
    if (/Inicia sesión/i.test(error.message)) return { message: error.message, status: 401, code: "authentication_required" };
    if (/no está autorizado|permiso|membresía|alcance|restringida|contratado|habilitado|fuera de tu alcance|no pertenece/i.test(error.message)) return { message: error.message, status: 403, code: "operations_access_denied" };
    if (/no existe|no se encontró|no está activa|no está disponible/i.test(error.message)) return { message: error.message, status: 404, code: "operations_not_found" };
    if (/duplic|límite|cambió|versión|inactivo|ventana|turno|venció|demasiado|ya |traslapa|vigencia|diferido/i.test(error.message)) return { message: error.message, status: 409, code: "operations_rule_conflict" };
    if (/fecha|hora|referencia|motivo|código|nombre|tipo|clave|días|solicitud|lote|proveedor|página|estado/i.test(error.message)) return { message: error.message, status: 400, code: "operations_invalid_request" };
    console.error("KitchenMind operations error", error);
  }
  return { message: "No fue posible completar la operación.", status: 503, code: "operations_unavailable" };
}
