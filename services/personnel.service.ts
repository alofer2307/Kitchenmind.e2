import type { KitchenMindDataProvider } from "@/repositories";
import type { Employee, IdentifierType, Shift } from "@/types";
import { requirePermission } from "./authorization.service";
import { recordAudit } from "./audit.service";

export interface EmployeeDraft {
  organizationId: string;
  branchId: string;
  employeeNumber: string;
  name: string;
  photoUrl?: string;
  shiftId: string;
  clientId?: string;
  identifierType?: IdentifierType;
  identifierValue?: string;
}

export interface ShiftDraft {
  organizationId: string;
  branchId?: string;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  status?: Shift["status"];
}

function normalizeIdentifier(value: string): string {
  return value.trim().toUpperCase();
}

async function validateEmployeeDraft(provider: KitchenMindDataProvider, draft: EmployeeDraft, currentEmployeeId?: string): Promise<void> {
  if (!draft.name.trim() || !draft.employeeNumber.trim() || !draft.branchId || !draft.shiftId) throw new Error("Completa nombre, número, sucursal y turno.");
  const [branch, shift, employees] = await Promise.all([
    provider.branches.getById(draft.branchId),
    provider.shifts.getById(draft.shiftId),
    provider.employees.list(),
  ]);
  if (!branch || branch.organizationId !== draft.organizationId || branch.status !== "active") throw new Error("La sucursal seleccionada no está disponible.");
  if (!shift || shift.organizationId !== draft.organizationId || shift.status !== "active") throw new Error("El turno seleccionado no está disponible.");
  const duplicateNumber = employees.find(
    (employee) => employee.organizationId === draft.organizationId && employee.id !== currentEmployeeId && employee.employeeNumber.toUpperCase() === draft.employeeNumber.trim().toUpperCase(),
  );
  if (duplicateNumber) throw new Error("El número de empleado ya está registrado.");
  if (draft.identifierValue?.trim()) {
    const duplicateIdentifier = await provider.employees.findByIdentifier(draft.organizationId, draft.identifierValue);
    if (duplicateIdentifier && duplicateIdentifier.id !== currentEmployeeId) throw new Error("El identificador ya pertenece a otro empleado.");
  }
}

export async function createEmployee(provider: KitchenMindDataProvider, actorId: string, draft: EmployeeDraft): Promise<Employee> {
  await requirePermission(provider, actorId, "employees.write");
  await validateEmployeeDraft(provider, draft);
  const employee = await provider.employees.create({
    organizationId: draft.organizationId,
    branchId: draft.branchId,
    employeeNumber: draft.employeeNumber.trim(),
    name: draft.name.trim(),
    photoUrl: draft.photoUrl?.trim() || undefined,
    status: "active",
    shiftId: draft.shiftId,
    clientId: draft.clientId || undefined,
    employeeIdentifier: draft.identifierValue?.trim()
      ? { type: draft.identifierType ?? "qr", value: normalizeIdentifier(draft.identifierValue), active: true, assignedAt: new Date().toISOString() }
      : undefined,
    createdBy: actorId,
  });
  await recordAudit(provider, { organizationId: employee.organizationId, branchId: employee.branchId, actorId, action: "employee.created", entity: "employee", entityId: employee.id, after: employee });
  return employee;
}

export async function updateEmployee(provider: KitchenMindDataProvider, actorId: string, employeeId: string, draft: EmployeeDraft): Promise<Employee> {
  await requirePermission(provider, actorId, "employees.write");
  const before = await provider.employees.getById(employeeId);
  if (!before) throw new Error("No se encontró el empleado.");
  await validateEmployeeDraft(provider, draft, employeeId);
  const currentValue = before.employeeIdentifier?.value;
  const nextValue = draft.identifierValue?.trim() ? normalizeIdentifier(draft.identifierValue) : undefined;
  const employee = await provider.employees.update(employeeId, {
    branchId: draft.branchId,
    employeeNumber: draft.employeeNumber.trim(),
    name: draft.name.trim(),
    photoUrl: draft.photoUrl?.trim() || undefined,
    shiftId: draft.shiftId,
    clientId: draft.clientId || undefined,
    employeeIdentifier: nextValue
      ? { type: draft.identifierType ?? "qr", value: nextValue, active: true, assignedAt: currentValue === nextValue ? before.employeeIdentifier?.assignedAt ?? new Date().toISOString() : new Date().toISOString() }
      : undefined,
  });
  await recordAudit(provider, { organizationId: employee.organizationId, branchId: employee.branchId, actorId, action: "employee.updated", entity: "employee", entityId: employee.id, before, after: employee });
  return employee;
}

export async function deactivateEmployee(provider: KitchenMindDataProvider, actorId: string, employeeId: string, reason: string): Promise<Employee> {
  await requirePermission(provider, actorId, "employees.write");
  if (!reason.trim()) throw new Error("Indica el motivo de la desactivación.");
  const before = await provider.employees.getById(employeeId);
  if (!before) throw new Error("No se encontró el empleado.");
  const employee = await provider.employees.deactivate(employeeId, actorId);
  await recordAudit(provider, { organizationId: employee.organizationId, branchId: employee.branchId, actorId, action: "employee.deactivated", entity: "employee", entityId: employee.id, before, after: employee, reason: reason.trim() });
  return employee;
}

export async function createShift(provider: KitchenMindDataProvider, actorId: string, draft: ShiftDraft): Promise<Shift> {
  await requirePermission(provider, actorId, "employees.write");
  if (!draft.name.trim() || !draft.startTime || !draft.endTime || draft.toleranceMinutes < 0) throw new Error("Completa los datos válidos del turno.");
  const shift = await provider.shifts.create({ ...draft, name: draft.name.trim(), status: draft.status ?? "active", createdBy: actorId });
  await recordAudit(provider, { organizationId: shift.organizationId, branchId: shift.branchId, actorId, action: "shift.created", entity: "shift", entityId: shift.id, after: shift });
  return shift;
}

export async function updateShift(provider: KitchenMindDataProvider, actorId: string, shiftId: string, draft: ShiftDraft): Promise<Shift> {
  await requirePermission(provider, actorId, "employees.write");
  const before = await provider.shifts.getById(shiftId);
  if (!before) throw new Error("No se encontró el turno.");
  if (!draft.name.trim() || !draft.startTime || !draft.endTime || draft.toleranceMinutes < 0) throw new Error("Completa los datos válidos del turno.");
  const shift = await provider.shifts.update(shiftId, { ...draft, name: draft.name.trim(), status: draft.status ?? before.status });
  await recordAudit(provider, { organizationId: shift.organizationId, branchId: shift.branchId, actorId, action: "shift.updated", entity: "shift", entityId: shift.id, before, after: shift });
  return shift;
}
