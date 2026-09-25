import type { AuditEvent } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  "employee.created": "Empleado creado",
  "employee.updated": "Empleado actualizado",
  "employee.deactivated": "Empleado desactivado",
  "shift.created": "Turno creado",
  "shift.updated": "Turno actualizado",
  "attendance.entry": "Entrada registrada",
  "attendance.exit": "Salida registrada",
  "attendance.late": "Retardo registrado",
  "attendance.duplicate": "Duplicado de asistencia evitado",
  "attendance.manual_adjustment": "Asistencia corregida manualmente",
  "service.registered": "Servicio registrado",
  "service.duplicate": "Servicio duplicado evitado",
  "service.override": "Servicio excepcional autorizado",
  "purchase.suggested": "Compra sugerida",
};

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function filterAuditEvents(events: AuditEvent[], filters: { query?: string; branchId?: string; category?: string }): AuditEvent[] {
  const query = filters.query?.trim().toLocaleLowerCase("es-MX");
  return events.filter((event) => {
    if (filters.branchId && event.branchId !== filters.branchId) return false;
    if (filters.category && !event.action.startsWith(`${filters.category}.`)) return false;
    if (!query) return true;
    return [event.action, event.entity, event.reason, event.entityId].filter(Boolean).some((value) => String(value).toLocaleLowerCase("es-MX").includes(query));
  });
}
