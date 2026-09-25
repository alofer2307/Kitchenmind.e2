import type { ScanAttempt } from "@/rules/scanner.rules";
import type { KitchenMindDataProvider } from "@/repositories";
import type { AttendanceEvent, AttendanceEventType, Branch, Employee, Shift } from "@/types";
import { createIdempotencyKey } from "@/utils/id";
import { toDateKey } from "@/utils/date";
import { decideAttendanceEvent } from "@/rules/attendance.rules";
import { recordAudit } from "./audit.service";
import { requirePermission } from "./authorization.service";

export interface AttendanceScanInput {
  organizationId: string;
  branchId: string;
  deviceId: string;
  attempt: ScanAttempt;
  duplicateWindowSeconds?: number;
  syncStatus?: AttendanceEvent["syncStatus"];
}

export type AttendanceScanResult =
  | { status: "unknown" }
  | { status: "duplicate"; employee: Employee; branch: Branch; shift: Shift; event: AttendanceEvent }
  | { status: "registered"; employee: Employee; branch: Branch; shift: Shift; event: AttendanceEvent };

export async function processAttendanceScan(provider: KitchenMindDataProvider, input: AttendanceScanInput): Promise<AttendanceScanResult> {
  const employee = await provider.employees.findByIdentifier(input.organizationId, input.attempt.identifier);
  if (!employee || employee.branchId !== input.branchId) return { status: "unknown" };
  const [branch, shift, events] = await Promise.all([
    provider.branches.getById(employee.branchId),
    provider.shifts.getById(employee.shiftId),
    provider.attendance.listByEmployee(employee.id),
  ]);
  if (!branch || !shift) throw new Error("La ficha del empleado no tiene sucursal o turno válido.");
  const decision = decideAttendanceEvent(events, shift, input.attempt.scannedAt, {
    duplicateWindowSeconds: input.duplicateWindowSeconds ?? 90,
    timezone: branch.timezone,
  });
  if (decision.kind === "duplicate") {
    await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.deviceId, action: "attendance.duplicate", entity: "attendanceEvent", entityId: decision.previousEvent.id, before: decision.previousEvent, reason: "Escaneo dentro del periodo anti-duplicados." });
    return { status: "duplicate", employee, branch, shift, event: decision.previousEvent };
  }
  const dateKey = toDateKey(input.attempt.scannedAt);
  const idempotencyKey = createIdempotencyKey(["attendance", employee.id, decision.eventType, dateKey]);
  const existing = await provider.attendance.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.deviceId, action: "attendance.duplicate", entity: "attendanceEvent", entityId: existing.id, before: existing, reason: "La clave idempotente ya fue procesada." });
    return { status: "duplicate", employee, branch, shift, event: existing };
  }
  const event = await provider.attendance.create({
    organizationId: input.organizationId,
    branchId: input.branchId,
    employeeId: employee.id,
    timestamp: input.attempt.scannedAt,
    eventType: decision.eventType,
    deviceId: input.deviceId,
    idempotencyKey,
    source: "scanner",
    syncStatus: input.syncStatus ?? "synced",
    createdBy: input.deviceId,
  });
  await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.deviceId, action: `attendance.${event.eventType}`, entity: "attendanceEvent", entityId: event.id, after: event });
  return { status: "registered", employee, branch, shift, event };
}

export async function createManualAttendanceAdjustment(
  provider: KitchenMindDataProvider,
  input: { organizationId: string; branchId: string; employeeId: string; actorUserId: string; adjustedEventType: Exclude<AttendanceEventType, "manual_adjustment">; timestamp: string; reason: string },
): Promise<AttendanceEvent> {
  await requirePermission(provider, input.actorUserId, "attendance.adjust");
  if (!input.reason.trim()) throw new Error("La corrección manual requiere un motivo.");
  const employee = await provider.employees.getById(input.employeeId);
  if (!employee || employee.organizationId !== input.organizationId || employee.branchId !== input.branchId) throw new Error("El empleado no pertenece a esta sucursal.");
  const event = await provider.attendance.create({
    organizationId: input.organizationId,
    branchId: input.branchId,
    employeeId: input.employeeId,
    timestamp: input.timestamp,
    eventType: "manual_adjustment",
    adjustedEventType: input.adjustedEventType,
    deviceId: "admin",
    idempotencyKey: createIdempotencyKey(["attendance-adjustment", input.employeeId, input.adjustedEventType, input.timestamp]),
    source: "manual",
    syncStatus: "synced",
    reason: input.reason.trim(),
    actorUserId: input.actorUserId,
    createdBy: input.actorUserId,
  });
  await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.actorUserId, action: "attendance.manual_adjustment", entity: "attendanceEvent", entityId: event.id, after: event, reason: input.reason.trim() });
  return event;
}
