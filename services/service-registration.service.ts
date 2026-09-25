import type { KitchenMindDataProvider } from "@/repositories";
import type { ScanAttempt } from "@/rules/scanner.rules";
import { resolveCurrentServiceType } from "@/rules/service.rules";
import type { Branch, Employee, InternalClient, ServiceEvent, ServiceType } from "@/types";
import { toDateKey } from "@/utils/date";
import { createId, createIdempotencyKey } from "@/utils/id";
import { requirePermission } from "./authorization.service";
import { recordAudit } from "./audit.service";

export interface ServiceScanInput {
  organizationId: string;
  branchId: string;
  deviceId: string;
  attempt: ScanAttempt;
  syncStatus?: ServiceEvent["syncStatus"];
}

export type ServiceScanResult =
  | { status: "unknown" }
  | { status: "no_active_service"; employee: Employee; branch: Branch }
  | { status: "duplicate"; employee: Employee; branch: Branch; client?: InternalClient; serviceType: ServiceType; event: ServiceEvent }
  | { status: "registered"; employee: Employee; branch: Branch; client?: InternalClient; serviceType: ServiceType; event: ServiceEvent };

export async function processServiceScan(provider: KitchenMindDataProvider, input: ServiceScanInput): Promise<ServiceScanResult> {
  const employee = await provider.employees.findByIdentifier(input.organizationId, input.attempt.identifier);
  if (!employee || employee.branchId !== input.branchId) return { status: "unknown" };
  const [branch, serviceTypes, client] = await Promise.all([
    provider.branches.getById(input.branchId),
    provider.services.serviceTypes.list(),
    employee.clientId ? provider.services.clients.getById(employee.clientId) : Promise.resolve(null),
  ]);
  if (!branch) throw new Error("La sucursal del dispositivo no está disponible.");
  const serviceType = resolveCurrentServiceType(serviceTypes, { organizationId: input.organizationId, branchId: input.branchId, timestamp: input.attempt.scannedAt, timezone: branch.timezone });
  if (!serviceType) return { status: "no_active_service", employee, branch };
  const idempotencyKey = createIdempotencyKey(["service", employee.id, serviceType.id, toDateKey(input.attempt.scannedAt)]);
  const existing = await provider.services.findEventByIdempotencyKey(idempotencyKey);
  if (existing) {
    await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.deviceId, action: "service.duplicate", entity: "serviceEvent", entityId: existing.id, before: existing, reason: "El servicio ya fue registrado dentro del mismo periodo." });
    return { status: "duplicate", employee, branch, client: client ?? undefined, serviceType, event: existing };
  }
  const event = await provider.services.serviceEvents.create({
    organizationId: input.organizationId,
    branchId: input.branchId,
    employeeId: employee.id,
    clientId: employee.clientId,
    serviceTypeId: serviceType.id,
    timestamp: input.attempt.scannedAt,
    deviceId: input.deviceId,
    idempotencyKey,
    source: "scanner",
    syncStatus: input.syncStatus ?? "synced",
    override: false,
    createdBy: input.deviceId,
  });
  await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.deviceId, action: "service.registered", entity: "serviceEvent", entityId: event.id, after: event });
  return { status: "registered", employee, branch, client: client ?? undefined, serviceType, event };
}

export async function overrideServiceRegistration(
  provider: KitchenMindDataProvider,
  input: { organizationId: string; branchId: string; employeeId: string; serviceTypeId: string; actorUserId: string; reason: string; timestamp?: string },
): Promise<ServiceEvent> {
  await requirePermission(provider, input.actorUserId, "services.override");
  if (!input.reason.trim()) throw new Error("El registro excepcional requiere un motivo.");
  const [employee, serviceType] = await Promise.all([provider.employees.getById(input.employeeId), provider.services.serviceTypes.getById(input.serviceTypeId)]);
  if (!employee || employee.organizationId !== input.organizationId || employee.branchId !== input.branchId) throw new Error("El empleado no pertenece a esta sucursal.");
  if (!serviceType || serviceType.organizationId !== input.organizationId) throw new Error("El tipo de servicio no es válido.");
  const timestamp = input.timestamp ?? new Date().toISOString();
  const event = await provider.services.serviceEvents.create({
    organizationId: input.organizationId,
    branchId: input.branchId,
    employeeId: input.employeeId,
    clientId: employee.clientId,
    serviceTypeId: input.serviceTypeId,
    timestamp,
    deviceId: "admin",
    idempotencyKey: createIdempotencyKey(["service-override", input.employeeId, input.serviceTypeId, createId("exception")]),
    source: "manual",
    syncStatus: "synced",
    override: true,
    overrideReason: input.reason.trim(),
    actorUserId: input.actorUserId,
    createdBy: input.actorUserId,
  });
  await recordAudit(provider, { organizationId: input.organizationId, branchId: input.branchId, actorId: input.actorUserId, action: "service.override", entity: "serviceEvent", entityId: event.id, after: event, reason: input.reason.trim() });
  return event;
}
