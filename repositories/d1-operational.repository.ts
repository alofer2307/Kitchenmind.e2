import type { SqlCommand } from "./commercial.contracts";
import type { EmployeeImportPreview, EmployeeImportRowInput, OperationalDataProvider, OperationalRepository, OperationsSnapshotFilters } from "./operational.contracts";
import {
  attendanceLatenessMinutes,
  decideOperationalAttendance,
  isServiceActive,
  localOperationalDate,
  maskExternalTemplateId,
  operationalDateForService,
  operationalDateForShift,
  parseMetadata,
  serviceConfig,
  shiftAppliesOnOperationalDate,
  shiftConfig,
} from "@/rules/operations.rules";
import type {
  BiometricCredentialSummary,
  DeviceIdentity,
  KioskCaptureInput,
  KioskCaptureResult,
  OperationalAttendanceSummary,
  OperationalAttendanceExportRow,
  OperationalDeviceSummary,
  OperationalEmployeeDetail,
  OperationalEmployeeSummary,
  OperationalEmployeeStatus,
  OperationalPersonSummary,
  OperationalShiftSummary,
  OperationalSyncBatchSummary,
  OperationsActor,
  OperationsSnapshot,
  OrganizationStatus,
} from "@/types";

const OPERATIONAL_PERMISSIONS = [
  ["personnel.employees.read", "Consultar personal operativo."],
  ["personnel.employees.manage", "Administrar personas operativas y su relación con empleados."],
  ["personnel.attendance.read", "Consultar eventos productivos de asistencia."],
  ["personnel.attendance.capture", "Registrar eventos productivos de asistencia."],
  ["personnel.attendance.adjust", "Crear ajustes auditados de asistencia sin modificar el evento original."],
  ["personnel.biometric.read", "Consultar estado y trazabilidad de credenciales biométricas externas."],
  ["personnel.biometric.enroll", "Enrolar referencias biométricas externas sin almacenar huellas crudas."],
  ["personnel.biometric.revoke", "Revocar referencias biométricas externas preservando el historial."],
  ["personnel.shifts.manage", "Crear, configurar y asignar turnos de personal."],
  ["personnel.attendance.export", "Exportar asistencia autorizada en formatos estructurados."],
  ["devices.read", "Consultar dispositivos operativos y su salud."],
  ["devices.manage", "Configurar y vincular dispositivos operativos."],
] as const;

const ALL_OPERATIONAL_PERMISSIONS = OPERATIONAL_PERMISSIONS.map(([code]) => code);

const OPERATIONAL_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ALL_OPERATIONAL_PERMISSIONS,
  administrator: ALL_OPERATIONAL_PERMISSIONS,
  regional_supervisor: ["personnel.employees.read", "personnel.attendance.read", "personnel.attendance.adjust", "personnel.attendance.export", "personnel.biometric.read", "personnel.biometric.enroll", "personnel.biometric.revoke", "personnel.shifts.manage", "devices.read"],
  human_resources: ["personnel.employees.read", "personnel.employees.manage", "personnel.attendance.read", "personnel.attendance.adjust", "personnel.attendance.export", "personnel.biometric.read", "personnel.biometric.enroll", "personnel.biometric.revoke", "personnel.shifts.manage", "devices.read"],
  branch_manager: ["personnel.employees.read", "personnel.employees.manage", "personnel.attendance.read", "personnel.attendance.adjust", "personnel.attendance.export", "personnel.biometric.read", "personnel.biometric.enroll", "personnel.biometric.revoke", "personnel.shifts.manage", "devices.read", "devices.manage"],
  quality_supervisor: ["personnel.employees.read", "personnel.attendance.read", "devices.read"],
  nutrition: ["personnel.employees.read", "devices.read"],
  operator: ["personnel.employees.read", "personnel.attendance.read", "devices.read"],
  auditor: ["personnel.employees.read", "personnel.attendance.read", "personnel.attendance.export", "personnel.biometric.read", "devices.read"],
  viewer: ["personnel.employees.read", "personnel.attendance.read", "devices.read"],
};

interface MembershipContext {
  membershipId: string;
  organizationId: string;
  organizationStatus: OrganizationStatus;
  organizationCode: string;
  organizationName: string;
  timezone: string;
  displayName: string;
  permissions: string[];
  roleNames: string[];
  scopes: Array<{ type: string; id: string | null; accessMode: string }>;
}

interface CredentialPersonRow {
  credentialId: string;
  personId: string;
  personName: string;
  personStatus: string;
  personBranchId: string;
  employeeId: string | null;
  employeeNumber: string | null;
  employeeStatus: string | null;
  shiftId: string | null;
  shiftName: string | null;
  shiftMetadataJson: string | null;
  clientId: string | null;
  costCenterId: string | null;
}

const nowIso = () => new Date().toISOString();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeCode = (value: string) => value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const bool = (value: unknown) => value === true || value === 1;

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(",");
}

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `kmdev_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function audit(organizationId: string, actorType: string, actorId: string, action: string, entity: string, entityId: string | null, reason: string, after?: unknown, outcome = "success"): SqlCommand {
  return {
    sql: `INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [crypto.randomUUID(), organizationId, actorType, actorId, action, entity, entityId, outcome, reason, after === undefined ? null : JSON.stringify(after), nowIso()],
  };
}

function invalidateDashboard(organizationId: string): SqlCommand {
  return { sql: "DELETE FROM dashboard_cache_entries WHERE organization_id = ?", values: [organizationId] };
}

function validTimestamp(value: string, offline: boolean): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("La fecha del evento no es válida.");
  const now = Date.now();
  if (parsed.getTime() > now + 5 * 60_000) throw new Error("La fecha del dispositivo está demasiado adelantada.");
  const maximumAge = offline ? 30 * 24 * 60 * 60_000 : 15 * 60_000;
  if (parsed.getTime() < now - maximumAge) throw new Error(offline ? "El evento offline excede la ventana de sincronización de 30 días." : "El evento en línea es demasiado antiguo.");
  return parsed.toISOString();
}

function validTime(value: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("La hora debe usar formato HH:MM.");
  return value;
}

function validDays(values: number[]): number[] {
  const result = Array.from(new Set(values));
  if (result.some((value) => !Number.isInteger(value) || value < 0 || value > 6)) throw new Error("Los días de la semana deben estar entre 0 y 6.");
  return result.sort((a, b) => a - b);
}

function validIdempotencyKey(value: string): string {
  const clean = value.trim();
  if (clean.length < 8 || clean.length > 220) throw new Error("La clave idempotente no es válida.");
  return clean;
}

function normalizedProvider(value: string | null | undefined): string {
  const clean = (value ?? "generic").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (!clean) throw new Error("El proveedor biométrico no es válido.");
  return clean;
}


function deriveDeviceHealth(status: string, lastSeenAt: string | null, healthJson: string | null): { status: OperationalDeviceSummary["healthStatus"]; detail: string | null } {
  if (status !== "active") return { status: "disabled", detail: "El dispositivo está deshabilitado." };
  const parsed = asJson<Record<string, unknown>>(healthJson, {});
  if (parsed.status === "degraded") return { status: "degraded", detail: typeof parsed.detail === "string" ? parsed.detail : "El bridge reportó operación degradada." };
  if (!lastSeenAt) return { status: "unknown", detail: "Todavía no se ha recibido heartbeat." };
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(age)) return { status: "unknown", detail: "La última señal no tiene una fecha válida." };
  if (age <= 5 * 60_000) return { status: "online", detail: typeof parsed.detail === "string" ? parsed.detail : null };
  return { status: "offline", detail: `Sin heartbeat durante ${Math.max(1, Math.floor(age / 60_000))} min.` };
}

function validEmployeeStatus(value: string): asserts value is OperationalEmployeeStatus {
  if (!["active", "inactive", "suspended", "terminated"].includes(value)) throw new Error("El estado del empleado no es válido.");
}

function validDateOnly(value: string, label: string): string {
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error(`${label} debe usar formato AAAA-MM-DD.`);
  return clean;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha operacional no es válida.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requireDeviceCapability(device: DeviceIdentity, capability: "attendance" | "services"): void {
  if (!device.capabilities.includes("*") && !device.capabilities.includes(capability)) throw new Error(`El dispositivo no está autorizado para ${capability === "attendance" ? "asistencia" : "servicios"}.`);
}

export class D1OperationalRepository implements OperationalRepository {
  constructor(private readonly provider: OperationalDataProvider) {}

  async ensureCatalog(): Promise<void> {
    const commands: SqlCommand[] = [];
    for (const [code, description] of OPERATIONAL_PERMISSIONS) {
      commands.push({ sql: "INSERT OR IGNORE INTO organization_permissions (id, code, description) VALUES (?, ?, ?)", values: [`org-permission-${code}`, code, description] });
    }
    for (const [roleCode, permissions] of Object.entries(OPERATIONAL_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        commands.push({
          sql: `INSERT OR IGNORE INTO organization_role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM organization_roles r JOIN organization_permissions p ON p.code = ?
            WHERE r.code = ? AND r.status = 'active'`,
          values: [permission, roleCode],
        });
      }
    }
    await this.provider.batch(commands);
  }

  private async membership(identity: OperationsActor, organizationId?: string, permission?: string, write = false): Promise<MembershipContext> {
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT m.id AS membershipId, m.organization_id AS organizationId, m.display_name AS displayName,
      o.status AS organizationStatus, o.code AS organizationCode, o.commercial_name AS organizationName, o.default_timezone AS timezone,
      r.name AS roleName, p.code AS permissionCode
      FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
      LEFT JOIN membership_role_assignments mra ON mra.membership_id = m.id
      LEFT JOIN organization_roles r ON r.id = mra.role_id AND r.organization_id = m.organization_id AND r.status = 'active'
      LEFT JOIN organization_role_permissions rp ON rp.role_id = r.id
      LEFT JOIN organization_permissions p ON p.id = rp.permission_id
      WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' ${organizationId ? "AND m.organization_id = ?" : ""}
      ORDER BY m.joined_at, r.name LIMIT 1000`, organizationId ? [identity.authUserId, normalizeEmail(identity.email), organizationId] : [identity.authUserId, normalizeEmail(identity.email)]);
    if (!rows.length) throw new Error("No existe una membresía activa para esta cuenta.");
    const selectedId = organizationId ?? String(rows[0].organizationId);
    const selected = rows.filter((row) => String(row.organizationId) === selectedId);
    if (!selected.length) throw new Error("No existe una membresía activa para esta organización.");
    const organizationStatus = String(selected[0].organizationStatus) as OrganizationStatus;
    if (!["active", "restricted"].includes(organizationStatus)) throw new Error("La organización todavía no está activa para esta operación.");
    if (write && organizationStatus === "restricted") throw new Error("La organización está restringida y permanece en modo de solo lectura.");
    const permissions = Array.from(new Set(selected.map((row) => row.permissionCode ? String(row.permissionCode) : "").filter(Boolean)));
    if (permission && !permissions.includes(permission)) throw new Error("No tienes permiso para realizar esta operación.");
    const scopes = await this.provider.all<{ type: string; id: string | null; accessMode: string }>("SELECT scope_type AS type, scope_id AS id, access_mode AS accessMode FROM membership_scopes WHERE membership_id = ?", [String(selected[0].membershipId)]);
    if (!scopes.length) throw new Error("La membresía no tiene un alcance autorizado.");
    await this.provider.run("UPDATE customer_users SET last_access_at = ?, updated_at = ? WHERE auth_user_id = ?", [nowIso(), nowIso(), identity.authUserId]);
    return {
      membershipId: String(selected[0].membershipId), organizationId: selectedId, organizationStatus,
      organizationCode: String(selected[0].organizationCode), organizationName: String(selected[0].organizationName), timezone: String(selected[0].timezone),
      displayName: String(selected[0].displayName), permissions,
      roleNames: Array.from(new Set(selected.map((row) => row.roleName ? String(row.roleName) : "").filter(Boolean))), scopes,
    };
  }

  private scopeAllows(member: MembershipContext, branchId: string, write: boolean): boolean {
    const modes = write ? ["manage", "write"] : ["manage", "write", "read"];
    if (member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && modes.includes(scope.accessMode))) return true;
    return member.scopes.some((scope) => scope.type === "branch" && scope.id === branchId && modes.includes(scope.accessMode));
  }

  private hasOrganizationScope(member: MembershipContext, write: boolean): boolean {
    const modes = write ? ["manage", "write"] : ["manage", "write", "read"];
    return member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && modes.includes(scope.accessMode));
  }

  private async assertBranch(member: MembershipContext, branchId: string, write: boolean): Promise<{ id: string; timezone: string }> {
    const branch = await this.provider.first<{ id: string; timezone: string }>("SELECT id, timezone FROM tenant_branches WHERE id = ? AND organization_id = ? AND status = 'active'", [branchId, member.organizationId]);
    if (!branch) throw new Error("No se encontró la sucursal dentro de tu organización.");
    if (!this.scopeAllows(member, branchId, write)) throw new Error("Tu alcance no permite operar esa sucursal.");
    return branch;
  }

  private async authorizedBranches(member: MembershipContext): Promise<Array<{ id: string; code: string; name: string; timezone: string; status: string }>> {
    if (this.hasOrganizationScope(member, false)) return this.provider.all("SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' ORDER BY name", [member.organizationId]);
    const branchIds = Array.from(new Set(member.scopes.filter((scope) => scope.type === "branch" && scope.id && ["read", "write", "manage"].includes(scope.accessMode)).map((scope) => String(scope.id))));
    if (!branchIds.length) return [];
    return this.provider.all(`SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' AND id IN (${placeholders(branchIds)}) ORDER BY name`, [member.organizationId, ...branchIds]);
  }

  private async assertModule(organizationId: string, moduleCode: "PERSONNEL" | "SERVICES"): Promise<void> {
    const timestamp = nowIso();
    const override = await this.provider.first<{ enabled: unknown }>(`SELECT enabled FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'module' AND module_code = ? AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?) ORDER BY created_at DESC LIMIT 1`, [organizationId, moduleCode, timestamp, timestamp]);
    if (override) {
      if (!bool(override.enabled)) throw new Error(`El módulo ${moduleCode} no está habilitado para esta organización.`);
      return;
    }
    const entitlement = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM organization_entitlements WHERE organization_id = ? AND module_code = ? AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?)`, [organizationId, moduleCode, timestamp, timestamp]);
    if ((entitlement?.count ?? 0) === 0) throw new Error(`El módulo ${moduleCode} no está contratado para esta organización.`);
  }

  async snapshot(identity: OperationsActor, filters: OperationsSnapshotFilters): Promise<OperationsSnapshot> {
    await this.ensureCatalog();
    const member = await this.membership(identity, filters.organizationId, "personnel.employees.read");
    await this.assertModule(member.organizationId, "PERSONNEL");
    const canReadAttendance = member.permissions.includes("personnel.attendance.read");
    const canReadBiometric = member.permissions.includes("personnel.biometric.read");
    const canReadDevices = member.permissions.includes("devices.read");
    const branches = await this.authorizedBranches(member);
    if (!branches.length) throw new Error("No tienes sucursales activas dentro de tu alcance.");
    const branchId = filters.branchId && filters.branchId !== "all" ? filters.branchId : null;
    if (branchId && !branches.some((branch) => branch.id === branchId)) throw new Error("La sucursal solicitada está fuera de tu alcance autorizado.");
    const branchIds = branchId ? [branchId] : branches.map((branch) => branch.id);
    const scopeSql = placeholders(branchIds);
    const referenceTimezone = branchId ? branches.find((branch) => branch.id === branchId)?.timezone ?? member.timezone : member.timezone;
    const requestedDate = filters.operationalDate?.trim();
    const operationalDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : localOperationalDate(nowIso(), referenceTimezone);
    const search = (filters.employeeSearch ?? "").trim().slice(0, 100);
    const employeeStatus = filters.employeeStatus && filters.employeeStatus !== "all" ? filters.employeeStatus : "all";
    if (employeeStatus !== "all") validEmployeeStatus(employeeStatus);
    const pageSize = Math.min(100, Math.max(10, Math.floor(filters.employeePageSize ?? 50)));
    const page = Math.max(1, Math.floor(filters.employeePage ?? 1));
    const employeeWhere: string[] = [`e.organization_id = ?`, `e.branch_id IN (${scopeSql})`];
    const employeeValues: unknown[] = [member.organizationId, ...branchIds];
    if (employeeStatus !== "all") { employeeWhere.push("e.status = ?"); employeeValues.push(employeeStatus); }
    if (search) {
      employeeWhere.push("(e.employee_number LIKE ? ESCAPE '\\' OR e.name LIKE ? ESCAPE '\\' OR COALESCE(e.email,'') LIKE ? ESCAPE '\\')");
      const like = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      employeeValues.push(like, like, like);
    }
    const employeeWhereSql = employeeWhere.join(" AND ");

    const [availableOrganizations, employeeCountRow, employeeRows, deviceRows, credentialRows, shiftRows, attendanceRows, syncRows, aggregateRow, activeSchedulingRows] = await Promise.all([
      this.provider.all<{ id: string; name: string; status: string }>(`SELECT DISTINCT o.id, o.commercial_name AS name, o.status FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' AND o.status IN ('active','restricted') ORDER BY o.commercial_name LIMIT 100`, [identity.authUserId, normalizeEmail(identity.email)]),
      this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM tenant_employees e WHERE ${employeeWhereSql}`, employeeValues),
      this.provider.all<Record<string, unknown>>(`SELECT e.id, p.id AS personId, e.branch_id AS branchId, b.name AS branchName, e.employee_number AS employeeNumber, e.name, p.first_name AS firstName, p.last_name AS lastName, p.second_last_name AS secondLastName, e.email, e.shift_id AS shiftId, s.name AS shiftName, e.status, e.hired_at AS hiredAt, e.terminated_at AS terminatedAt, e.version,
        ${canReadBiometric ? "(SELECT COUNT(*) FROM biometric_credentials bc WHERE bc.person_id = p.id AND bc.status = 'active')" : "0"} AS biometricCredentialCount
        FROM tenant_employees e JOIN tenant_branches b ON b.id = e.branch_id AND b.organization_id = e.organization_id
        LEFT JOIN tenant_people p ON p.employee_id = e.id AND p.organization_id = e.organization_id
        LEFT JOIN tenant_shifts s ON s.id = e.shift_id AND s.organization_id = e.organization_id
        WHERE ${employeeWhereSql} ORDER BY CASE e.status WHEN 'active' THEN 0 WHEN 'suspended' THEN 1 WHEN 'inactive' THEN 2 ELSE 3 END, e.name, e.employee_number LIMIT ? OFFSET ?`, [...employeeValues, pageSize, (page - 1) * pageSize]),
      canReadDevices ? this.provider.all<Record<string, unknown>>(`SELECT d.id, d.branch_id AS branchId, d.code, d.name, d.device_type AS deviceType, d.provider, d.serial_number AS serialNumber, d.capabilities_json AS capabilitiesJson, d.status, d.health_json AS healthJson, d.bridge_version AS bridgeVersion, d.last_health_at AS lastHealthAt, d.last_seen_at AS lastSeenAt, d.last_sync_at AS lastSyncAt, d.registered_at AS registeredAt, d.version,
        EXISTS(SELECT 1 FROM tenant_device_credentials dc WHERE dc.device_id = d.id AND dc.status = 'active' AND (dc.expires_at IS NULL OR dc.expires_at > ?)) AS hasActiveCredential
        FROM tenant_devices d WHERE d.organization_id = ? AND (d.branch_id IS NULL OR d.branch_id IN (${scopeSql})) ORDER BY d.status, d.name LIMIT 200`, [nowIso(), member.organizationId, ...branchIds]) : Promise.resolve([]),
      canReadBiometric ? this.provider.all<Record<string, unknown>>(`SELECT bc.id, bc.person_id AS personId, p.name AS personName, bc.provider, bc.external_template_id AS externalTemplateId, bc.device_id AS deviceId, bc.method, bc.status, bc.enrolled_at AS enrolledAt, bc.revoked_at AS revokedAt, bc.reason, bc.version
        FROM biometric_credentials bc JOIN tenant_people p ON p.id = bc.person_id AND p.person_type = 'employee' WHERE bc.organization_id = ? AND p.branch_id IN (${scopeSql}) ORDER BY bc.enrolled_at DESC LIMIT 500`, [member.organizationId, ...branchIds]) : Promise.resolve([]),
      this.provider.all<Record<string, unknown>>(`SELECT id, branch_id AS branchId, code, name, metadata_json AS metadataJson, status FROM tenant_shifts WHERE organization_id = ? AND (branch_id IS NULL OR branch_id IN (${scopeSql})) ORDER BY status, name LIMIT 200`, [member.organizationId, ...branchIds]),
      canReadAttendance ? this.provider.all<Record<string, unknown>>(`SELECT a.id, a.branch_id AS branchId, a.person_id AS personId, a.employee_id AS employeeId, e.employee_number AS employeeNumber, e.name AS employeeName, a.shift_id AS shiftId, s.name AS shiftName, a.device_id AS deviceId, a.event_type AS eventType, a.adjusted_event_type AS adjustedEventType, a.late_minutes AS lateMinutes, a.event_timestamp AS eventTimestamp, a.operational_date AS operationalDate, a.source, a.synchronization_status AS synchronizationStatus, a.reason
        FROM operational_attendance_events a JOIN tenant_employees e ON e.id = a.employee_id LEFT JOIN tenant_shifts s ON s.id = a.shift_id
        WHERE a.organization_id = ? AND a.branch_id IN (${scopeSql}) AND a.operational_date = ? ORDER BY a.event_timestamp DESC LIMIT 1000`, [member.organizationId, ...branchIds, operationalDate]) : Promise.resolve([]),
      canReadDevices ? this.provider.all<Record<string, unknown>>(`SELECT sb.id, sb.branch_id AS branchId, sb.device_id AS deviceId, d.name AS deviceName, sb.status, sb.event_count AS eventCount, sb.accepted_count AS acceptedCount, sb.rejected_count AS rejectedCount, sb.attempt_count AS attemptCount, sb.last_error AS lastError, sb.started_at AS startedAt, sb.completed_at AS completedAt, sb.last_attempt_at AS lastAttemptAt
        FROM operational_sync_batches sb JOIN tenant_devices d ON d.id = sb.device_id WHERE sb.organization_id = ? AND sb.branch_id IN (${scopeSql}) ORDER BY sb.created_at DESC LIMIT 200`, [member.organizationId, ...branchIds]) : Promise.resolve([]),
      this.provider.first<Record<string, number>>(`SELECT
        (SELECT COUNT(*) FROM tenant_employees e WHERE e.organization_id = ? AND e.branch_id IN (${scopeSql}) AND e.status = 'active') AS employeesActive,
        (SELECT COUNT(*) FROM tenant_employees e WHERE e.organization_id = ? AND e.branch_id IN (${scopeSql}) AND e.status <> 'active') AS employeesInactive,
        (SELECT COUNT(*) FROM tenant_employees e WHERE e.organization_id = ? AND e.branch_id IN (${scopeSql}) AND e.status = 'active' AND NOT EXISTS (SELECT 1 FROM tenant_people p JOIN biometric_credentials bc ON bc.person_id = p.id AND bc.status = 'active' WHERE p.employee_id = e.id)) AS employeesWithoutBiometric,
        (SELECT COUNT(*) FROM operational_attendance_events a WHERE a.organization_id = ? AND a.branch_id IN (${scopeSql}) AND a.operational_date = ? AND (a.event_type IN ('entry','late') OR (a.event_type = 'manual_adjustment' AND a.adjusted_event_type IN ('entry','late')))) AS attendanceEntries,
        (SELECT COUNT(*) FROM operational_attendance_events a WHERE a.organization_id = ? AND a.branch_id IN (${scopeSql}) AND a.operational_date = ? AND (a.event_type = 'exit' OR (a.event_type = 'manual_adjustment' AND a.adjusted_event_type = 'exit'))) AS attendanceExits,
        (SELECT COUNT(*) FROM operational_attendance_events a WHERE a.organization_id = ? AND a.branch_id IN (${scopeSql}) AND a.operational_date = ? AND (a.event_type = 'late' OR (a.event_type = 'manual_adjustment' AND a.adjusted_event_type = 'late'))) AS lateArrivals,
        (SELECT COUNT(*) FROM operational_attendance_events a WHERE a.organization_id = ? AND a.branch_id IN (${scopeSql}) AND a.operational_date = ? AND (a.event_type = 'incident' OR (a.event_type = 'manual_adjustment' AND a.adjusted_event_type = 'incident'))) AS attendanceIncidents,
        (SELECT COUNT(*) FROM (SELECT a.employee_id, COALESCE(a.adjusted_event_type,a.event_type) AS effectiveType FROM operational_attendance_events a WHERE a.organization_id = ? AND a.branch_id IN (${scopeSql}) AND a.operational_date = ? AND a.id = (SELECT last.id FROM operational_attendance_events last WHERE last.organization_id = a.organization_id AND last.employee_id = a.employee_id AND last.operational_date = a.operational_date ORDER BY last.event_timestamp DESC, last.created_at DESC LIMIT 1)) latest WHERE latest.effectiveType IN ('entry','late')) AS peopleInside,
        ((SELECT COUNT(*) FROM operational_sync_batches sb WHERE sb.organization_id = ? AND sb.branch_id IN (${scopeSql}) AND sb.status IN ('pending','processing','failed')) + (SELECT COUNT(*) FROM operational_sync_items si JOIN operational_sync_batches sb ON sb.id = si.batch_id WHERE sb.organization_id = ? AND sb.branch_id IN (${scopeSql}) AND si.status IN ('pending','failed'))) AS pendingSyncEvents`, [
          member.organizationId, ...branchIds,
          member.organizationId, ...branchIds,
          member.organizationId, ...branchIds,
          member.organizationId, ...branchIds, operationalDate,
          member.organizationId, ...branchIds, operationalDate,
          member.organizationId, ...branchIds, operationalDate,
          member.organizationId, ...branchIds, operationalDate,
          member.organizationId, ...branchIds, operationalDate,
          member.organizationId, ...branchIds,
          member.organizationId, ...branchIds,
        ]),
      canReadAttendance ? this.provider.all<Record<string, unknown>>(`SELECT e.id, e.branch_id AS branchId, b.timezone, e.shift_id AS shiftId, s.metadata_json AS shiftMetadataJson
        FROM tenant_employees e JOIN tenant_branches b ON b.id = e.branch_id AND b.organization_id = e.organization_id LEFT JOIN tenant_shifts s ON s.id = e.shift_id AND s.organization_id = e.organization_id
        WHERE e.organization_id = ? AND e.branch_id IN (${scopeSql}) AND e.status = 'active'`, [member.organizationId, ...branchIds]) : Promise.resolve([]),
    ]);

    const employees: OperationalEmployeeSummary[] = employeeRows.map((row) => ({
      id: String(row.id), personId: row.personId ? String(row.personId) : null, branchId: String(row.branchId), branchName: String(row.branchName), employeeNumber: String(row.employeeNumber), name: String(row.name),
      firstName: row.firstName ? String(row.firstName) : null, lastName: row.lastName ? String(row.lastName) : null, secondLastName: row.secondLastName ? String(row.secondLastName) : null, email: row.email ? String(row.email) : null,
      shiftId: row.shiftId ? String(row.shiftId) : null, shiftName: row.shiftName ? String(row.shiftName) : null, status: String(row.status) as OperationalEmployeeStatus, hiredAt: row.hiredAt ? String(row.hiredAt) : null, terminatedAt: row.terminatedAt ? String(row.terminatedAt) : null,
      biometricCredentialCount: Number(row.biometricCredentialCount ?? 0), version: Number(row.version ?? 1),
    }));
    const people: OperationalPersonSummary[] = employees.filter((employee) => employee.personId).map((employee) => ({ id: employee.personId as string, branchId: employee.branchId, employeeId: employee.id, employeeNumber: employee.employeeNumber, clientId: null, clientName: null, costCenterId: null, externalNumber: employee.employeeNumber, name: employee.name, firstName: employee.firstName, lastName: employee.lastName, secondLastName: employee.secondLastName, personType: "employee", status: employee.status === "active" ? "active" : "inactive", biometricCredentialCount: employee.biometricCredentialCount, version: employee.version }));
    const devices: OperationalDeviceSummary[] = deviceRows.map((row) => {
      const derived = deriveDeviceHealth(String(row.status), row.lastSeenAt ? String(row.lastSeenAt) : null, row.healthJson ? String(row.healthJson) : null);
      return { id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name), deviceType: String(row.deviceType) as OperationalDeviceSummary["deviceType"], provider: String(row.provider), serialNumber: row.serialNumber ? String(row.serialNumber) : null, capabilities: asJson<string[]>(row.capabilitiesJson ? String(row.capabilitiesJson) : null, []), status: String(row.status) as OperationalDeviceSummary["status"], healthStatus: derived.status, healthDetail: derived.detail, bridgeVersion: row.bridgeVersion ? String(row.bridgeVersion) : null, lastSeenAt: row.lastSeenAt ? String(row.lastSeenAt) : null, lastHealthAt: row.lastHealthAt ? String(row.lastHealthAt) : null, lastSyncAt: row.lastSyncAt ? String(row.lastSyncAt) : null, registeredAt: String(row.registeredAt), hasActiveCredential: bool(row.hasActiveCredential), version: Number(row.version) };
    });
    const biometricCredentials: BiometricCredentialSummary[] = credentialRows.map((row) => ({ id: String(row.id), personId: String(row.personId), personName: String(row.personName), provider: String(row.provider), externalTemplateIdMasked: maskExternalTemplateId(String(row.externalTemplateId)), deviceId: row.deviceId ? String(row.deviceId) : null, method: "fingerprint", status: String(row.status) as BiometricCredentialSummary["status"], enrolledAt: String(row.enrolledAt), revokedAt: row.revokedAt ? String(row.revokedAt) : null, reason: row.reason ? String(row.reason) : null, version: Number(row.version) }));
    const shifts: OperationalShiftSummary[] = shiftRows.map((row) => { const config = shiftConfig(row.metadataJson ? String(row.metadataJson) : null); return { id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name), startTime: config.startTime ?? "", endTime: config.endTime ?? "", toleranceMinutes: config.toleranceMinutes, daysOfWeek: config.daysOfWeek, crossesMidnight: Boolean(config.startTime && config.endTime && config.endTime <= config.startTime), status: String(row.status) as OperationalShiftSummary["status"] }; });
    const attendance: OperationalAttendanceSummary[] = attendanceRows.map((row) => ({ id: String(row.id), branchId: String(row.branchId), personId: row.personId ? String(row.personId) : null, employeeId: String(row.employeeId), employeeNumber: String(row.employeeNumber), employeeName: String(row.employeeName), shiftId: row.shiftId ? String(row.shiftId) : null, shiftName: row.shiftName ? String(row.shiftName) : null, deviceId: row.deviceId ? String(row.deviceId) : null, eventType: String(row.eventType) as OperationalAttendanceSummary["eventType"], adjustedEventType: row.adjustedEventType ? String(row.adjustedEventType) as OperationalAttendanceSummary["adjustedEventType"] : null, lateMinutes: row.lateMinutes === null || row.lateMinutes === undefined ? null : Number(row.lateMinutes), eventTimestamp: String(row.eventTimestamp), operationalDate: String(row.operationalDate), source: String(row.source) as OperationalAttendanceSummary["source"], synchronizationStatus: String(row.synchronizationStatus) as OperationalAttendanceSummary["synchronizationStatus"], reason: row.reason ? String(row.reason) : null }));
    const syncBatches: OperationalSyncBatchSummary[] = syncRows.map((row) => ({ id: String(row.id), branchId: String(row.branchId), deviceId: String(row.deviceId), deviceName: String(row.deviceName), status: String(row.status) as OperationalSyncBatchSummary["status"], eventCount: Number(row.eventCount), acceptedCount: Number(row.acceptedCount), rejectedCount: Number(row.rejectedCount), attemptCount: Number(row.attemptCount), lastError: row.lastError ? String(row.lastError) : null, startedAt: String(row.startedAt), completedAt: row.completedAt ? String(row.completedAt) : null, lastAttemptAt: row.lastAttemptAt ? String(row.lastAttemptAt) : null }));

    const attendanceEmployeeIds = new Set(attendance.filter((event) => ["entry", "late"].includes(event.eventType) || (event.eventType === "manual_adjustment" && ["entry", "late"].includes(event.adjustedEventType ?? ""))).map((event) => event.employeeId));
    let employeesExpected = 0;
    let potentialAbsences = 0;
    const now = nowIso();
    for (const row of activeSchedulingRows) {
      if (!row.shiftId || !row.shiftMetadataJson) continue;
      const config = shiftConfig(String(row.shiftMetadataJson));
      if (!config.startTime || !shiftAppliesOnOperationalDate(operationalDate, String(row.timezone), config)) continue;
      employeesExpected += 1;
      const branchToday = localOperationalDate(now, String(row.timezone));
      if (branchToday !== operationalDate || attendanceEmployeeIds.has(String(row.id))) continue;
      const [h, m] = config.startTime.split(":").map(Number);
      const localNowParts = new Intl.DateTimeFormat("en-US", { timeZone: String(row.timezone), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
      const partMap = Object.fromEntries(localNowParts.map((part) => [part.type, part.value]));
      const currentMinutes = Number(partMap.hour) * 60 + Number(partMap.minute);
      if (currentMinutes > h * 60 + m + config.toleranceMinutes + 30) potentialAbsences += 1;
    }
    const devicesOnline = devices.filter((device) => device.healthStatus === "online").length;
    const devicesOffline = devices.filter((device) => device.healthStatus === "offline" || device.healthStatus === "unknown").length;
    const devicesDegraded = devices.filter((device) => device.healthStatus === "degraded").length;
    const total = Number(employeeCountRow?.count ?? 0);
    const employeeDetail = filters.employeeId ? await this.employeeDetailFromMember(member, filters.employeeId) : null;

    return {
      organization: { id: member.organizationId, code: member.organizationCode, name: member.organizationName, status: member.organizationStatus, timezone: member.timezone },
      membership: { id: member.membershipId, displayName: member.displayName, roleNames: member.roleNames, permissions: member.permissions }, availableOrganizations, branches, selectedBranchId: branchId,
      employees, people, employeeDetail, employeePagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)), search, status: employeeStatus },
      clients: [], costCenters: [], devices, biometricCredentials, shifts, serviceTypes: [], attendance, services: [], syncBatches,
      metrics: { employeesActive: Number(aggregateRow?.employeesActive ?? 0), employeesInactive: Number(aggregateRow?.employeesInactive ?? 0), employeesWithoutBiometric: canReadBiometric ? Number(aggregateRow?.employeesWithoutBiometric ?? 0) : 0, employeesExpected, attendanceEntries: canReadAttendance ? Number(aggregateRow?.attendanceEntries ?? 0) : 0, attendanceExits: canReadAttendance ? Number(aggregateRow?.attendanceExits ?? 0) : 0, lateArrivals: canReadAttendance ? Number(aggregateRow?.lateArrivals ?? 0) : 0, attendanceIncidents: canReadAttendance ? Number(aggregateRow?.attendanceIncidents ?? 0) : 0, potentialAbsences, peopleInside: canReadAttendance ? Number(aggregateRow?.peopleInside ?? 0) : 0, pendingSyncEvents: canReadDevices ? Number(aggregateRow?.pendingSyncEvents ?? 0) : 0, devicesOnline, devicesOffline, devicesDegraded, servicesTotal: 0, serviceDuplicatesRejected: 0, serviceOverrides: 0 },
      capabilities: { personnelRead: member.permissions.includes("personnel.employees.read"), personnelManage: member.permissions.includes("personnel.employees.manage") && member.organizationStatus !== "restricted", shiftsManage: member.permissions.includes("personnel.shifts.manage") && member.organizationStatus !== "restricted", attendanceRead: member.permissions.includes("personnel.attendance.read"), attendanceCapture: member.permissions.includes("personnel.attendance.capture") && member.organizationStatus !== "restricted", attendanceAdjust: member.permissions.includes("personnel.attendance.adjust") && member.organizationStatus !== "restricted", attendanceExport: member.permissions.includes("personnel.attendance.export"), biometricRead: member.permissions.includes("personnel.biometric.read"), biometricEnroll: member.permissions.includes("personnel.biometric.enroll") && member.organizationStatus !== "restricted", biometricRevoke: member.permissions.includes("personnel.biometric.revoke") && member.organizationStatus !== "restricted", devicesRead: member.permissions.includes("devices.read"), devicesManage: member.permissions.includes("devices.manage") && member.organizationStatus !== "restricted", crossBranch: this.hasOrganizationScope(member, false) && branches.length > 1, restricted: member.organizationStatus === "restricted", servicesRead: false, servicesCapture: false, servicesOverride: false, servicesConfigure: false },
      filters: { branchId, operationalDate }, generatedAt: nowIso(), biometricPrivacyNote: "KitchenMind conserva referencias externas de enrolamiento y trazabilidad. No almacena imágenes de huellas ni plantillas biométricas crudas en D1, R2, localStorage, IndexedDB o analítica.", dinersDeferred: true,
    };
  }

  private async employeeDetailFromMember(member: MembershipContext, employeeId: string): Promise<OperationalEmployeeDetail> {
    const canReadAttendance = member.permissions.includes("personnel.attendance.read");
    const canReadBiometric = member.permissions.includes("personnel.biometric.read");
    const row = await this.provider.first<Record<string, unknown>>(`SELECT e.id, p.id AS personId, e.branch_id AS branchId, b.name AS branchName, e.employee_number AS employeeNumber, e.name, p.first_name AS firstName, p.last_name AS lastName, p.second_last_name AS secondLastName, e.email, e.shift_id AS shiftId, s.name AS shiftName, e.status, e.hired_at AS hiredAt, e.terminated_at AS terminatedAt, e.version,
      ${canReadBiometric ? "(SELECT COUNT(*) FROM biometric_credentials bc WHERE bc.person_id = p.id AND bc.status = 'active')" : "0"} AS biometricCredentialCount
      FROM tenant_employees e JOIN tenant_branches b ON b.id = e.branch_id AND b.organization_id = e.organization_id
      LEFT JOIN tenant_people p ON p.employee_id = e.id AND p.organization_id = e.organization_id
      LEFT JOIN tenant_shifts s ON s.id = e.shift_id AND s.organization_id = e.organization_id
      WHERE e.id = ? AND e.organization_id = ? LIMIT 1`, [employeeId, member.organizationId]);
    if (!row) throw new Error("El empleado no existe dentro de esta organización.");
    await this.assertBranch(member, String(row.branchId), false);
    const personId = row.personId ? String(row.personId) : null;
    const [shiftRows, branchRows, credentialRows, attendanceRows, auditRows] = await Promise.all([
      this.provider.all<Record<string, unknown>>(`SELECT esa.id, esa.employee_id AS employeeId, esa.shift_id AS shiftId, s.name AS shiftName, esa.starts_on AS startsOn, esa.ends_on AS endsOn, esa.reason, m.display_name AS assignedByName, esa.created_at AS createdAt, esa.version
        FROM employee_shift_assignments esa JOIN tenant_shifts s ON s.id = esa.shift_id LEFT JOIN organization_memberships m ON m.id = esa.assigned_by
        WHERE esa.organization_id = ? AND esa.employee_id = ? ORDER BY esa.starts_on DESC, esa.created_at DESC LIMIT 100`, [member.organizationId, employeeId]),
      this.provider.all<Record<string, unknown>>(`SELECT eba.id, eba.employee_id AS employeeId, eba.branch_id AS branchId, b.name AS branchName, eba.is_primary AS isPrimary, eba.starts_on AS startsOn, eba.ends_on AS endsOn, eba.reason, m.display_name AS assignedByName, eba.created_at AS createdAt, eba.version
        FROM employee_branch_assignments eba JOIN tenant_branches b ON b.id = eba.branch_id LEFT JOIN organization_memberships m ON m.id = eba.assigned_by
        WHERE eba.organization_id = ? AND eba.employee_id = ? ORDER BY eba.starts_on DESC, eba.created_at DESC LIMIT 100`, [member.organizationId, employeeId]),
      canReadBiometric && personId ? this.provider.all<Record<string, unknown>>(`SELECT bc.id, bc.person_id AS personId, p.name AS personName, bc.provider, bc.external_template_id AS externalTemplateId, bc.device_id AS deviceId, bc.method, bc.status, bc.enrolled_at AS enrolledAt, bc.revoked_at AS revokedAt, bc.reason, bc.version FROM biometric_credentials bc JOIN tenant_people p ON p.id = bc.person_id WHERE bc.organization_id = ? AND bc.person_id = ? ORDER BY bc.enrolled_at DESC LIMIT 100`, [member.organizationId, personId]) : Promise.resolve([]),
      canReadAttendance ? this.provider.all<Record<string, unknown>>(`SELECT a.id, a.branch_id AS branchId, a.person_id AS personId, a.employee_id AS employeeId, e.employee_number AS employeeNumber, e.name AS employeeName, a.shift_id AS shiftId, s.name AS shiftName, a.device_id AS deviceId, a.event_type AS eventType, a.adjusted_event_type AS adjustedEventType, a.late_minutes AS lateMinutes, a.event_timestamp AS eventTimestamp, a.operational_date AS operationalDate, a.source, a.synchronization_status AS synchronizationStatus, a.reason FROM operational_attendance_events a JOIN tenant_employees e ON e.id = a.employee_id LEFT JOIN tenant_shifts s ON s.id = a.shift_id WHERE a.organization_id = ? AND a.employee_id = ? ORDER BY a.event_timestamp DESC LIMIT 200`, [member.organizationId, employeeId]) : Promise.resolve([]),
      this.provider.all<Record<string, unknown>>(`SELECT ae.id, ae.action, ae.reason, ae.outcome, ae.created_at AS createdAt, COALESCE(m.display_name, ae.actor_type) AS actorLabel FROM organization_audit_events ae LEFT JOIN organization_memberships m ON ae.actor_type = 'customer_membership' AND m.id = ae.actor_id WHERE ae.organization_id = ? AND (ae.entity_id = ? ${personId ? "OR ae.entity_id = ?" : ""}) ORDER BY ae.created_at DESC LIMIT 200`, personId ? [member.organizationId, employeeId, personId] : [member.organizationId, employeeId]),
    ]);
    const base: OperationalEmployeeSummary = { id: String(row.id), personId, branchId: String(row.branchId), branchName: String(row.branchName), employeeNumber: String(row.employeeNumber), name: String(row.name), firstName: row.firstName ? String(row.firstName) : null, lastName: row.lastName ? String(row.lastName) : null, secondLastName: row.secondLastName ? String(row.secondLastName) : null, email: row.email ? String(row.email) : null, shiftId: row.shiftId ? String(row.shiftId) : null, shiftName: row.shiftName ? String(row.shiftName) : null, status: String(row.status) as OperationalEmployeeStatus, hiredAt: row.hiredAt ? String(row.hiredAt) : null, terminatedAt: row.terminatedAt ? String(row.terminatedAt) : null, biometricCredentialCount: Number(row.biometricCredentialCount ?? 0), version: Number(row.version ?? 1) };
    return {
      ...base,
      shiftAssignments: shiftRows.map((item) => ({ id: String(item.id), employeeId: String(item.employeeId), shiftId: String(item.shiftId), shiftName: String(item.shiftName), startsOn: String(item.startsOn), endsOn: item.endsOn ? String(item.endsOn) : null, reason: String(item.reason ?? ""), assignedByName: String(item.assignedByName ?? "Sistema"), createdAt: String(item.createdAt), version: Number(item.version ?? 1) })),
      branchAssignments: branchRows.map((item) => ({ id: String(item.id), employeeId: String(item.employeeId), branchId: String(item.branchId), branchName: String(item.branchName), isPrimary: bool(item.isPrimary), startsOn: String(item.startsOn), endsOn: item.endsOn ? String(item.endsOn) : null, reason: String(item.reason ?? ""), assignedByName: String(item.assignedByName ?? "Sistema"), createdAt: String(item.createdAt), version: Number(item.version ?? 1) })),
      biometricCredentials: credentialRows.map((item) => ({ id: String(item.id), personId: String(item.personId), personName: String(item.personName), provider: String(item.provider), externalTemplateIdMasked: maskExternalTemplateId(String(item.externalTemplateId)), deviceId: item.deviceId ? String(item.deviceId) : null, method: "fingerprint", status: String(item.status) as BiometricCredentialSummary["status"], enrolledAt: String(item.enrolledAt), revokedAt: item.revokedAt ? String(item.revokedAt) : null, reason: item.reason ? String(item.reason) : null, version: Number(item.version ?? 1) })),
      attendance: attendanceRows.map((item) => ({ id: String(item.id), branchId: String(item.branchId), personId: item.personId ? String(item.personId) : null, employeeId: String(item.employeeId), employeeNumber: String(item.employeeNumber), employeeName: String(item.employeeName), shiftId: item.shiftId ? String(item.shiftId) : null, shiftName: item.shiftName ? String(item.shiftName) : null, deviceId: item.deviceId ? String(item.deviceId) : null, eventType: String(item.eventType) as OperationalAttendanceSummary["eventType"], adjustedEventType: item.adjustedEventType ? String(item.adjustedEventType) as OperationalAttendanceSummary["adjustedEventType"] : null, lateMinutes: item.lateMinutes === null || item.lateMinutes === undefined ? null : Number(item.lateMinutes), eventTimestamp: String(item.eventTimestamp), operationalDate: String(item.operationalDate), source: String(item.source) as OperationalAttendanceSummary["source"], synchronizationStatus: String(item.synchronizationStatus) as OperationalAttendanceSummary["synchronizationStatus"], reason: item.reason ? String(item.reason) : null })),
      audit: auditRows.map((item) => ({ id: String(item.id), action: String(item.action), reason: item.reason ? String(item.reason) : null, outcome: String(item.outcome), createdAt: String(item.createdAt), actorLabel: String(item.actorLabel ?? "Sistema") })),
    };
  }

  async employeeDetail(identity: OperationsActor, input: { organizationId: string; employeeId: string }): Promise<OperationalEmployeeDetail> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.employees.read");
    await this.assertModule(member.organizationId, "PERSONNEL");
    return this.employeeDetailFromMember(member, input.employeeId);
  }

  async createEmployee(identity: OperationsActor, input: { organizationId: string; branchId: string; employeeNumber: string; name: string; firstName?: string | null; lastName?: string | null; secondLastName?: string | null; email?: string | null; shiftId?: string | null; hiredAt?: string | null }): Promise<{ employeeId: string; personId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.employees.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    await this.assertBranch(member, input.branchId, true);
    const employeeNumber = input.employeeNumber.trim();
    const name = input.name.trim();
    if (employeeNumber.length < 1 || employeeNumber.length > 100) throw new Error("El número de empleado no es válido.");
    if (name.length < 2 || name.length > 160) throw new Error("El nombre del empleado no es válido.");
    const duplicate = await this.provider.first<{ id: string }>("SELECT id FROM tenant_employees WHERE organization_id = ? AND upper(employee_number) = upper(?)", [member.organizationId, employeeNumber]);
    if (duplicate) throw new Error("Ya existe un empleado con ese número dentro de la organización.");
    const limit = await this.provider.first<{ hardLimit: number | null }>("SELECT hard_limit AS hardLimit FROM organization_feature_limits WHERE organization_id = ? AND feature_code = 'employees'", [member.organizationId]);
    if (limit?.hardLimit !== null && limit?.hardLimit !== undefined) {
      const usage = await this.provider.first<{ count: number }>("SELECT COUNT(*) AS count FROM tenant_employees WHERE organization_id = ? AND status <> 'terminated'", [member.organizationId]);
      if ((usage?.count ?? 0) >= limit.hardLimit) throw new Error("La organización alcanzó el límite contratado de empleados.");
    }
    if (input.shiftId) {
      const shift = await this.provider.first<{ branchId: string | null }>("SELECT branch_id AS branchId FROM tenant_shifts WHERE id = ? AND organization_id = ? AND status = 'active'", [input.shiftId, member.organizationId]);
      if (!shift || (shift.branchId && shift.branchId !== input.branchId)) throw new Error("El turno no aplica a la sucursal del empleado.");
    }
    const hiredAt = input.hiredAt ? validDateOnly(input.hiredAt, "La fecha de alta") : null;
    const employeeId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const timestamp = nowIso();
    const startsOn = hiredAt ?? timestamp.slice(0, 10);
    const commands: SqlCommand[] = [
      { sql: `INSERT INTO tenant_employees (id, organization_id, branch_id, employee_number, name, email, shift_id, status, hired_at, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 1)`, values: [employeeId, member.organizationId, input.branchId, employeeNumber, name, input.email?.trim().toLowerCase() || null, input.shiftId ?? null, hiredAt, timestamp, timestamp, member.membershipId] },
      { sql: `INSERT INTO tenant_people (id, organization_id, branch_id, employee_id, external_number, name, first_name, last_name, second_last_name, person_type, status, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'employee', 'active', ?, ?, ?, 1)`, values: [personId, member.organizationId, input.branchId, employeeId, employeeNumber, name, input.firstName?.trim() || null, input.lastName?.trim() || null, input.secondLastName?.trim() || null, timestamp, timestamp, member.membershipId] },
      { sql: `INSERT INTO employee_branch_assignments (id, organization_id, employee_id, branch_id, is_primary, starts_on, reason, assigned_by, created_at, version) VALUES (?, ?, ?, ?, 1, ?, 'Sucursal principal al crear empleado.', ?, ?, 1)`, values: [crypto.randomUUID(), member.organizationId, employeeId, input.branchId, startsOn, member.membershipId, timestamp] },
      audit(member.organizationId, "customer_membership", member.membershipId, "personnel.employee.created", "tenant_employee", employeeId, "Empleado creado desde Personal.", { branchId: input.branchId, employeeNumber, shiftId: input.shiftId ?? null }),
      invalidateDashboard(member.organizationId),
    ];
    if (input.shiftId) commands.splice(3, 0, { sql: `INSERT INTO employee_shift_assignments (id, organization_id, employee_id, shift_id, starts_on, reason, assigned_by, created_at, version) VALUES (?, ?, ?, ?, ?, 'Turno inicial al crear empleado.', ?, ?, 1)`, values: [crypto.randomUUID(), member.organizationId, employeeId, input.shiftId, startsOn, member.membershipId, timestamp] });
    commands.push({ sql: `UPDATE organization_feature_limits SET current_usage = current_usage + 1 WHERE organization_id = ? AND feature_code = 'employees'`, values: [member.organizationId] });
    await this.provider.batch(commands);
    return { employeeId, personId };
  }

  async updateEmployee(identity: OperationsActor, input: { organizationId: string; branchId: string; employeeNumber: string; name: string; firstName?: string | null; lastName?: string | null; secondLastName?: string | null; email?: string | null; shiftId?: string | null; hiredAt?: string | null; employeeId: string; expectedVersion: number }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.employees.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    await this.assertBranch(member, input.branchId, true);
    const current = await this.provider.first<{ branchId: string; status: string; version: number; personId: string | null }>(`SELECT e.branch_id AS branchId, e.status, e.version, p.id AS personId FROM tenant_employees e LEFT JOIN tenant_people p ON p.employee_id = e.id WHERE e.id = ? AND e.organization_id = ?`, [input.employeeId, member.organizationId]);
    if (!current) throw new Error("El empleado no existe.");
    await this.assertBranch(member, current.branchId, true);
    if (current.version !== input.expectedVersion) throw new Error("El empleado cambió en otra sesión. Recarga antes de guardar.");
    const employeeNumber = input.employeeNumber.trim();
    const name = input.name.trim();
    if (!employeeNumber || name.length < 2) throw new Error("Revisa el número y nombre del empleado.");
    const duplicate = await this.provider.first<{ id: string }>("SELECT id FROM tenant_employees WHERE organization_id = ? AND upper(employee_number) = upper(?) AND id <> ?", [member.organizationId, employeeNumber, input.employeeId]);
    if (duplicate) throw new Error("Ya existe otro empleado con ese número.");
    if (input.branchId !== current.branchId) throw new Error("Los cambios de sucursal deben registrarse mediante una asignación con vigencia para conservar el historial.");
    const currentShift = await this.provider.first<{ shiftId: string | null }>("SELECT shift_id AS shiftId FROM tenant_employees WHERE id = ? AND organization_id = ?", [input.employeeId, member.organizationId]);
    if ((input.shiftId ?? null) !== (currentShift?.shiftId ?? null)) throw new Error("Los cambios de turno deben registrarse mediante una asignación con vigencia para conservar el historial.");
    const timestamp = nowIso();
    const changed = await this.provider.run(`UPDATE tenant_employees SET employee_number = ?, name = ?, email = ?, hired_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND version = ?`, [employeeNumber, name, input.email?.trim().toLowerCase() || null, input.hiredAt ? validDateOnly(input.hiredAt, "La fecha de alta") : null, timestamp, input.employeeId, member.organizationId, input.expectedVersion]);
    if (changed !== 1) throw new Error("El empleado cambió en otra sesión. Recarga antes de guardar.");
    const commands: SqlCommand[] = [];
    if (current.personId) commands.push({ sql: `UPDATE tenant_people SET branch_id = ?, external_number = ?, name = ?, first_name = ?, last_name = ?, second_last_name = ?, status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, values: [current.branchId, employeeNumber, name, input.firstName?.trim() || null, input.lastName?.trim() || null, input.secondLastName?.trim() || null, current.status === "active" ? "active" : "inactive", timestamp, current.personId, member.organizationId] });
    else commands.push({ sql: `INSERT INTO tenant_people (id, organization_id, branch_id, employee_id, external_number, name, first_name, last_name, second_last_name, person_type, status, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'employee', ?, ?, ?, ?, 1)`, values: [crypto.randomUUID(), member.organizationId, current.branchId, input.employeeId, employeeNumber, name, input.firstName?.trim() || null, input.lastName?.trim() || null, input.secondLastName?.trim() || null, current.status === "active" ? "active" : "inactive", timestamp, timestamp, member.membershipId] });
    commands.push(audit(member.organizationId, "customer_membership", member.membershipId, "personnel.employee.updated", "tenant_employee", input.employeeId, "Datos operativos del empleado actualizados.", { branchId: input.branchId, employeeNumber, shiftId: input.shiftId ?? null }), invalidateDashboard(member.organizationId));
    await this.provider.batch(commands);
  }

  async setEmployeeStatus(identity: OperationsActor, input: { organizationId: string; employeeId: string; status: OperationalEmployeeStatus; reason: string; expectedVersion: number }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.employees.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    validEmployeeStatus(input.status);
    const current = await this.provider.first<{ branchId: string; status: string; version: number; personId: string | null }>(`SELECT e.branch_id AS branchId, e.status, e.version, p.id AS personId FROM tenant_employees e LEFT JOIN tenant_people p ON p.employee_id = e.id WHERE e.id = ? AND e.organization_id = ?`, [input.employeeId, member.organizationId]);
    if (!current) throw new Error("El empleado no existe.");
    await this.assertBranch(member, current.branchId, true);
    if (current.version !== input.expectedVersion) throw new Error("El empleado cambió en otra sesión.");
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) throw new Error("Explica el motivo del cambio de estado.");
    const timestamp = nowIso();
    const terminatedAt = input.status === "terminated" ? timestamp : null;
    const changed = await this.provider.run(`UPDATE tenant_employees SET status = ?, terminated_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND version = ?`, [input.status, terminatedAt, timestamp, input.employeeId, member.organizationId, input.expectedVersion]);
    if (changed !== 1) throw new Error("El empleado cambió en otra sesión.");
    const commands: SqlCommand[] = [];
    if (current.status !== "terminated" && input.status === "terminated") commands.push({ sql: `UPDATE organization_feature_limits SET current_usage = CASE WHEN current_usage > 0 THEN current_usage - 1 ELSE 0 END WHERE organization_id = ? AND feature_code = 'employees'`, values: [member.organizationId] });
    if (current.status === "terminated" && input.status !== "terminated") commands.push({ sql: `UPDATE organization_feature_limits SET current_usage = current_usage + 1 WHERE organization_id = ? AND feature_code = 'employees'`, values: [member.organizationId] });
    if (current.personId) commands.push({ sql: `UPDATE tenant_people SET status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, values: [input.status === "active" ? "active" : "inactive", timestamp, current.personId, member.organizationId] });
    if (input.status === "terminated" && current.personId) commands.push({ sql: `UPDATE biometric_credentials SET status = 'revoked', revoked_at = ?, revoked_by = ?, reason = ?, updated_at = ?, version = version + 1 WHERE organization_id = ? AND person_id = ? AND status = 'active'`, values: [timestamp, member.membershipId, `Baja laboral: ${reason}`.slice(0, 500), timestamp, member.organizationId, current.personId] });
    commands.push(audit(member.organizationId, "customer_membership", member.membershipId, "personnel.employee.status_changed", "tenant_employee", input.employeeId, reason, { from: current.status, to: input.status }), invalidateDashboard(member.organizationId));
    await this.provider.batch(commands);
  }

  async createShift(identity: OperationsActor, input: { organizationId: string; branchId?: string | null; code: string; name: string; startTime: string; endTime: string; toleranceMinutes: number; daysOfWeek: number[] }): Promise<{ shiftId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.shifts.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    if (input.branchId) await this.assertBranch(member, input.branchId, true); else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para crear un turno global.");
    const code = normalizeCode(input.code || input.name); const name = input.name.trim();
    if (!code || name.length < 2) throw new Error("Revisa el código y nombre del turno.");
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM tenant_shifts WHERE organization_id = ? AND code = ?", [member.organizationId, code]);
    if (existing) throw new Error("Ya existe un turno con ese código.");
    const metadata = { startTime: validTime(input.startTime), endTime: validTime(input.endTime), toleranceMinutes: input.toleranceMinutes, daysOfWeek: validDays(input.daysOfWeek) };
    if (!Number.isInteger(input.toleranceMinutes) || input.toleranceMinutes < 0 || input.toleranceMinutes > 240) throw new Error("La tolerancia debe estar entre 0 y 240 minutos.");
    const shiftId = crypto.randomUUID(); const timestamp = nowIso();
    await this.provider.batch([{ sql: `INSERT INTO tenant_shifts (id, organization_id, branch_id, code, name, status, metadata_json, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, values: [shiftId, member.organizationId, input.branchId ?? null, code, name, JSON.stringify(metadata), timestamp, timestamp, member.membershipId] }, audit(member.organizationId, "customer_membership", member.membershipId, "personnel.shift.created", "tenant_shift", shiftId, "Turno operativo creado.", metadata), invalidateDashboard(member.organizationId)]);
    return { shiftId };
  }

  async assignShift(identity: OperationsActor, input: { organizationId: string; employeeId: string; shiftId: string; startsOn: string; endsOn?: string | null; reason: string }): Promise<{ assignmentId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.shifts.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const employee = await this.provider.first<{ branchId: string }>("SELECT branch_id AS branchId FROM tenant_employees WHERE id = ? AND organization_id = ?", [input.employeeId, member.organizationId]);
    if (!employee) throw new Error("El empleado no existe.");
    await this.assertBranch(member, employee.branchId, true);
    const shift = await this.provider.first<{ branchId: string | null }>("SELECT branch_id AS branchId FROM tenant_shifts WHERE id = ? AND organization_id = ? AND status = 'active'", [input.shiftId, member.organizationId]);
    if (!shift || (shift.branchId && shift.branchId !== employee.branchId)) throw new Error("El turno no aplica a la sucursal del empleado.");
    const startsOn = validDateOnly(input.startsOn, "La fecha inicial");
    const endsOn = input.endsOn ? validDateOnly(input.endsOn, "La fecha final") : null;
    if (endsOn && endsOn < startsOn) throw new Error("La fecha final no puede ser anterior a la inicial.");
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw new Error("Explica el motivo de la asignación de turno.");
    const openPrevious = await this.provider.first<{ id: string; startsOn: string }>(`SELECT id, starts_on AS startsOn FROM employee_shift_assignments WHERE organization_id = ? AND employee_id = ? AND ends_on IS NULL AND starts_on < ? ORDER BY starts_on DESC LIMIT 1`, [member.organizationId, input.employeeId, startsOn]);
    const overlap = await this.provider.first<{ id: string }>(`SELECT id FROM employee_shift_assignments WHERE organization_id = ? AND employee_id = ? AND id <> COALESCE(?, '') AND starts_on <= COALESCE(?, '9999-12-31') AND COALESCE(ends_on, '9999-12-31') >= ? LIMIT 1`, [member.organizationId, input.employeeId, openPrevious?.id ?? null, endsOn, startsOn]);
    if (overlap) throw new Error("El empleado ya tiene un turno asignado que se traslapa con ese periodo.");
    const assignmentId = crypto.randomUUID();
    const timestamp = nowIso();
    const today = timestamp.slice(0, 10);
    const commands: SqlCommand[] = [];
    if (openPrevious) commands.push({ sql: `UPDATE employee_shift_assignments SET ends_on = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND ends_on IS NULL`, values: [shiftDate(startsOn, -1), openPrevious.id, member.organizationId] });
    commands.push({ sql: `INSERT INTO employee_shift_assignments (id, organization_id, employee_id, shift_id, starts_on, ends_on, reason, assigned_by, created_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [assignmentId, member.organizationId, input.employeeId, input.shiftId, startsOn, endsOn, reason, member.membershipId, timestamp] });
    if (startsOn <= today && (!endsOn || endsOn >= today)) commands.push({ sql: `UPDATE tenant_employees SET shift_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, values: [input.shiftId, timestamp, input.employeeId, member.organizationId] });
    commands.push(audit(member.organizationId, "customer_membership", member.membershipId, "personnel.shift.assigned", "tenant_employee", input.employeeId, reason, { shiftId: input.shiftId, startsOn, endsOn }), invalidateDashboard(member.organizationId));
    await this.provider.batch(commands);
    return { assignmentId };
  }

  async assignBranch(identity: OperationsActor, input: { organizationId: string; employeeId: string; branchId: string; startsOn: string; endsOn?: string | null; isPrimary: boolean; reason: string }): Promise<{ assignmentId: string }> {
    await this.ensureCatalog(); const member = await this.membership(identity, input.organizationId, "personnel.employees.manage", true); await this.assertModule(member.organizationId, "PERSONNEL"); await this.assertBranch(member, input.branchId, true);
    const employee = await this.provider.first<{ branchId: string; personId: string | null }>(`SELECT e.branch_id AS branchId, p.id AS personId FROM tenant_employees e LEFT JOIN tenant_people p ON p.employee_id = e.id WHERE e.id = ? AND e.organization_id = ?`, [input.employeeId, member.organizationId]);
    if (!employee) throw new Error("El empleado no existe."); await this.assertBranch(member, employee.branchId, true);
    const startsOn = validDateOnly(input.startsOn, "La fecha inicial"); const endsOn = input.endsOn ? validDateOnly(input.endsOn, "La fecha final") : null; if (endsOn && endsOn < startsOn) throw new Error("La fecha final no puede ser anterior a la inicial.");
    const duplicate = await this.provider.first<{ id: string }>(`SELECT id FROM employee_branch_assignments WHERE organization_id = ? AND employee_id = ? AND branch_id = ? AND starts_on = ?`, [member.organizationId, input.employeeId, input.branchId, startsOn]); if (duplicate) return { assignmentId: duplicate.id };
    const reason = input.reason.trim(); if (reason.length < 3) throw new Error("Explica el motivo de la asignación de sucursal."); const assignmentId = crypto.randomUUID(); const timestamp = nowIso(); const today = timestamp.slice(0, 10);
    const commands: SqlCommand[] = [{ sql: `INSERT INTO employee_branch_assignments (id, organization_id, employee_id, branch_id, is_primary, starts_on, ends_on, reason, assigned_by, created_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [assignmentId, member.organizationId, input.employeeId, input.branchId, input.isPrimary ? 1 : 0, startsOn, endsOn, reason, member.membershipId, timestamp] }];
    if (input.isPrimary && startsOn <= today && (!endsOn || endsOn >= today)) { commands.push({ sql: `UPDATE employee_branch_assignments SET is_primary = 0 WHERE organization_id = ? AND employee_id = ? AND id <> ? AND is_primary = 1 AND starts_on <= ? AND COALESCE(ends_on,'9999-12-31') >= ?`, values: [member.organizationId, input.employeeId, assignmentId, today, today] }); commands.push({ sql: `UPDATE tenant_employees SET branch_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, values: [input.branchId, timestamp, input.employeeId, member.organizationId] }); if (employee.personId) commands.push({ sql: `UPDATE tenant_people SET branch_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, values: [input.branchId, timestamp, employee.personId, member.organizationId] }); }
    commands.push(audit(member.organizationId, "customer_membership", member.membershipId, "personnel.branch.assigned", "tenant_employee", input.employeeId, reason, { branchId: input.branchId, isPrimary: input.isPrimary, startsOn, endsOn }), invalidateDashboard(member.organizationId)); await this.provider.batch(commands); return { assignmentId };
  }

  async createClient(identity: OperationsActor, input: { organizationId: string; code: string; name: string; billingReference?: string | null }): Promise<{ id: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "services.configure", true);
    await this.assertModule(member.organizationId, "SERVICES");
    if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para administrar clientes.");
    const code = normalizeCode(input.code || input.name);
    const name = input.name.trim();
    if (!code || name.length < 2 || name.length > 160) throw new Error("Revisa el código y nombre del cliente.");
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM tenant_clients WHERE organization_id = ? AND code = ?", [member.organizationId, code]);
    if (existing) return existing;
    const id = crypto.randomUUID();
    await this.provider.batch([
      { sql: `INSERT INTO tenant_clients (id, organization_id, code, name, billing_reference, status, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?)`, values: [id, member.organizationId, code, name, input.billingReference?.trim() || null, member.membershipId] },
      audit(member.organizationId, "customer_membership", member.membershipId, "services.client.created", "tenant_client", id, "Cliente operativo creado.", { code, name }),
      invalidateDashboard(member.organizationId),
    ]);
    return { id };
  }

  async createPerson(identity: OperationsActor, input: { organizationId: string; branchId: string; name: string; personType: "employee" | "diner" | "visitor" | "contractor"; employeeId?: string | null; clientId?: string | null; costCenterId?: string | null; externalNumber?: string | null }): Promise<{ id: string }> {
    await this.ensureCatalog();
    const permission = input.personType === "employee" ? "personnel.employees.manage" : "services.configure";
    const moduleCode = input.personType === "employee" ? "PERSONNEL" : "SERVICES";
    const member = await this.membership(identity, input.organizationId, permission, true);
    await this.assertModule(member.organizationId, moduleCode);
    await this.assertBranch(member, input.branchId, true);
    const name = input.name.trim();
    if (name.length < 2 || name.length > 160) throw new Error("Escribe un nombre válido.");
    if (input.employeeId) {
      const employee = await this.provider.first<{ id: string; branchId: string; status: string }>("SELECT id, branch_id AS branchId, status FROM tenant_employees WHERE id = ? AND organization_id = ?", [input.employeeId, member.organizationId]);
      if (!employee || employee.branchId !== input.branchId || employee.status !== "active") throw new Error("El empleado no pertenece a esta sucursal o está inactivo.");
      const linked = await this.provider.first<{ id: string }>("SELECT id FROM tenant_people WHERE employee_id = ?", [input.employeeId]);
      if (linked) return linked;
    }
    if (input.clientId) {
      const client = await this.provider.first<{ id: string }>("SELECT id FROM tenant_clients WHERE id = ? AND organization_id = ? AND status = 'active'", [input.clientId, member.organizationId]);
      if (!client) throw new Error("El cliente no pertenece a esta organización.");
    }
    if (input.costCenterId) {
      const center = await this.provider.first<{ id: string; clientId: string | null }>("SELECT id, client_id AS clientId FROM tenant_cost_centers WHERE id = ? AND organization_id = ? AND status = 'active'", [input.costCenterId, member.organizationId]);
      if (!center || (input.clientId && center.clientId && center.clientId !== input.clientId)) throw new Error("El centro de costo no corresponde al cliente seleccionado.");
    }
    const externalNumber = input.externalNumber?.trim() || null;
    if (externalNumber) {
      const existing = await this.provider.first<{ id: string }>("SELECT id FROM tenant_people WHERE organization_id = ? AND external_number = ?", [member.organizationId, externalNumber]);
      if (existing) return existing;
    }
    const id = crypto.randomUUID();
    await this.provider.batch([
      { sql: `INSERT INTO tenant_people (id, organization_id, branch_id, employee_id, client_id, cost_center_id, external_number, name, person_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`, values: [id, member.organizationId, input.branchId, input.employeeId ?? null, input.clientId ?? null, input.costCenterId ?? null, externalNumber, name, input.personType, member.membershipId] },
      audit(member.organizationId, "customer_membership", member.membershipId, "operations.person.created", "tenant_person", id, "Persona operativa creada sin convertirla en usuario de KitchenMind.", { branchId: input.branchId, personType: input.personType, employeeId: input.employeeId ?? null }),
      invalidateDashboard(member.organizationId),
    ]);
    return { id };
  }

  async ensureEmployeePeople(identity: OperationsActor, organizationId: string): Promise<{ created: number; reused: number }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "personnel.employees.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const branches = await this.authorizedBranches(member);
    const writableBranchIds = branches.filter((branch) => this.scopeAllows(member, branch.id, true)).map((branch) => branch.id);
    if (!writableBranchIds.length) throw new Error("No tienes sucursales con alcance de escritura.");
    const rows = await this.provider.all<{ id: string; branchId: string; employeeNumber: string; name: string }>(`SELECT e.id, e.branch_id AS branchId, e.employee_number AS employeeNumber, e.name FROM tenant_employees e LEFT JOIN tenant_people p ON p.employee_id = e.id WHERE e.organization_id = ? AND e.branch_id IN (${placeholders(writableBranchIds)}) AND e.status = 'active' AND p.id IS NULL ORDER BY e.id LIMIT 5000`, [member.organizationId, ...writableBranchIds]);
    const existing = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM tenant_employees e JOIN tenant_people p ON p.employee_id = e.id WHERE e.organization_id = ? AND e.branch_id IN (${placeholders(writableBranchIds)}) AND e.status = 'active'`, [member.organizationId, ...writableBranchIds]);
    const timestamp = nowIso();
    const commands: SqlCommand[] = rows.map((row) => ({ sql: `INSERT OR IGNORE INTO tenant_people (id, organization_id, branch_id, employee_id, external_number, name, person_type, status, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, 'employee', 'active', ?, ?, ?, 1)`, values: [crypto.randomUUID(), member.organizationId, row.branchId, row.id, row.employeeNumber, row.name, timestamp, timestamp, member.membershipId] }));
    if (rows.length) commands.push(audit(member.organizationId, "customer_membership", member.membershipId, "personnel.people.synchronized", "tenant_people", null, "Se crearon identidades operativas separadas para empleados existentes.", { created: rows.length }));
    commands.push(invalidateDashboard(member.organizationId));
    await this.provider.batch(commands);
    return { created: rows.length, reused: Number(existing?.count ?? 0) };
  }

  private async validateEmployeeImportRows(member: MembershipContext, rows: EmployeeImportRowInput[]): Promise<EmployeeImportPreview> {
    if (!rows.length || rows.length > 5000) throw new Error("La importación debe contener entre 1 y 5,000 empleados.");
    const branches = await this.authorizedBranches(member);
    const writable = branches.filter((branch) => this.scopeAllows(member, branch.id, true));
    const branchByCode = new Map(writable.map((branch) => [normalizeCode(branch.code), branch]));
    const shifts = await this.provider.all<{ id: string; branchId: string | null; code: string }>("SELECT id, branch_id AS branchId, code FROM tenant_shifts WHERE organization_id = ? AND status = 'active'", [member.organizationId]);
    const existing = await this.provider.all<{ employeeNumber: string }>("SELECT employee_number AS employeeNumber FROM tenant_employees WHERE organization_id = ?", [member.organizationId]);
    const existingNumbers = new Set(existing.map((row) => row.employeeNumber.trim().toUpperCase()));
    const seen = new Set<string>();
    const output: EmployeeImportPreview["rows"] = [];
    for (const row of rows) {
      const errors: string[] = [];
      const employeeNumber = row.employeeNumber.trim();
      const name = row.name.trim();
      const numberKey = employeeNumber.toUpperCase();
      const branch = branchByCode.get(normalizeCode(row.branchCode));
      if (!employeeNumber) errors.push("Falta número de empleado.");
      if (name.length < 2) errors.push("Falta nombre válido.");
      if (!branch) errors.push(`Sucursal no válida o fuera de alcance: ${row.branchCode}.`);
      let shiftId: string | null = null;
      if (row.shiftCode?.trim()) {
        const code = normalizeCode(row.shiftCode);
        const shift = shifts.find((item) => normalizeCode(item.code) === code && (!item.branchId || item.branchId === branch?.id));
        if (!shift) errors.push(`Turno no válido para la sucursal: ${row.shiftCode}.`);
        else shiftId = shift.id;
      }
      if (row.hiredAt && !/^\d{4}-\d{2}-\d{2}$/.test(row.hiredAt)) errors.push("Fecha de alta inválida; usa AAAA-MM-DD.");
      const duplicate = existingNumbers.has(numberKey) || seen.has(numberKey);
      if (duplicate) errors.push("Número de empleado duplicado.");
      seen.add(numberKey);
      const status = errors.length ? (duplicate ? "duplicate" : "rejected") : "valid";
      output.push({ rowNumber: row.rowNumber, employeeNumber, name, status, errors, branchId: branch?.id, shiftId });
    }
    return { total: output.length, valid: output.filter((row) => row.status === "valid").length, duplicates: output.filter((row) => row.status === "duplicate").length, rejected: output.filter((row) => row.status === "rejected").length, rows: output };
  }

  async previewEmployeeImport(identity: OperationsActor, input: { organizationId: string; rows: EmployeeImportRowInput[] }): Promise<EmployeeImportPreview> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.employees.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    return this.validateEmployeeImportRows(member, input.rows);
  }

  async commitEmployeeImport(identity: OperationsActor, input: { organizationId: string; rows: EmployeeImportRowInput[]; idempotencyKey: string }): Promise<{ imported: number; reused: boolean }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.employees.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const rawKey = validIdempotencyKey(input.idempotencyKey);
    const auditKey = `employee-import:${member.membershipId}:${rawKey}`;
    const prior = await this.provider.first<{ id: string; metadataJson: string | null }>("SELECT id, after_json AS metadataJson FROM organization_audit_events WHERE organization_id = ? AND action = 'personnel.employees.imported' AND entity_id = ? LIMIT 1", [member.organizationId, auditKey]);
    if (prior) {
      const metadata = asJson<{ imported?: number }>(prior.metadataJson, {});
      return { imported: Number(metadata.imported ?? 0), reused: true };
    }
    const preview = await this.validateEmployeeImportRows(member, input.rows);
    if (preview.duplicates || preview.rejected || preview.valid !== preview.total) throw new Error("La importación contiene duplicados o filas rechazadas. Corrige el archivo antes de confirmar; no se insertó ningún empleado.");
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    for (const validated of preview.rows) {
      const source = input.rows.find((row) => row.rowNumber === validated.rowNumber)!;
      const employeeId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const status = source.status ?? "active";
      commands.push({ sql: `INSERT INTO tenant_employees (id, organization_id, branch_id, employee_number, name, email, shift_id, status, hired_at, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [employeeId, member.organizationId, validated.branchId!, source.employeeNumber.trim(), source.name.trim(), source.email?.trim().toLowerCase() || null, validated.shiftId ?? null, status, source.hiredAt || null, timestamp, timestamp, member.membershipId] });
      commands.push({ sql: `INSERT INTO tenant_people (id, organization_id, branch_id, employee_id, external_number, name, person_type, status, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, 'employee', ?, ?, ?, ?, 1)`, values: [personId, member.organizationId, validated.branchId!, employeeId, source.employeeNumber.trim(), source.name.trim(), status === "active" ? "active" : "inactive", timestamp, timestamp, member.membershipId] });
      commands.push({ sql: `INSERT INTO employee_branch_assignments (id, organization_id, employee_id, branch_id, is_primary, starts_on, ends_on, reason, assigned_by, created_at, version) VALUES (?, ?, ?, ?, 1, ?, NULL, 'Importación masiva E.2', ?, ?, 1)`, values: [crypto.randomUUID(), member.organizationId, employeeId, validated.branchId!, source.hiredAt || timestamp.slice(0,10), member.membershipId, timestamp] });
      if (validated.shiftId) commands.push({ sql: `INSERT INTO employee_shift_assignments (id, organization_id, employee_id, shift_id, starts_on, ends_on, reason, assigned_by, created_at, version) VALUES (?, ?, ?, ?, ?, NULL, 'Importación masiva E.2', ?, ?, 1)`, values: [crypto.randomUUID(), member.organizationId, employeeId, validated.shiftId, source.hiredAt || timestamp.slice(0,10), member.membershipId, timestamp] });
    }
    commands.push(audit(member.organizationId, "customer_membership", member.membershipId, "personnel.employees.imported", "tenant_employee", auditKey, "Importación masiva de empleados completada sin inserciones parciales.", { imported: preview.total, source: "csv" }));
    commands.push(invalidateDashboard(member.organizationId));
    await this.provider.batch(commands);
    return { imported: preview.total, reused: false };
  }

  async configureShift(identity: OperationsActor, input: { organizationId: string; shiftId: string; startTime: string; endTime: string; toleranceMinutes: number; daysOfWeek: number[] }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.shifts.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const row = await this.provider.first<{ branchId: string | null; metadataJson: string }>("SELECT branch_id AS branchId, metadata_json AS metadataJson FROM tenant_shifts WHERE id = ? AND organization_id = ? AND status = 'active'", [input.shiftId, member.organizationId]);
    if (!row) throw new Error("El turno no existe.");
    if (row.branchId) await this.assertBranch(member, row.branchId, true); else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para configurar un turno global.");
    if (!Number.isInteger(input.toleranceMinutes) || input.toleranceMinutes < 0 || input.toleranceMinutes > 240) throw new Error("La tolerancia debe estar entre 0 y 240 minutos.");
    const metadata = { ...parseMetadata(row.metadataJson), startTime: validTime(input.startTime), endTime: validTime(input.endTime), toleranceMinutes: input.toleranceMinutes, daysOfWeek: validDays(input.daysOfWeek) };
    await this.provider.batch([
      { sql: "UPDATE tenant_shifts SET metadata_json = ?, updated_at = ? WHERE id = ? AND organization_id = ?", values: [JSON.stringify(metadata), nowIso(), input.shiftId, member.organizationId] },
      audit(member.organizationId, "customer_membership", member.membershipId, "personnel.shift.operational_configured", "tenant_shift", input.shiftId, "Horario operativo del turno actualizado.", metadata),
      invalidateDashboard(member.organizationId),
    ]);
  }

  async configureServiceType(identity: OperationsActor, input: { organizationId: string; serviceTypeId: string; startTime: string; endTime: string; daysOfWeek: number[]; perPersonLimit: number }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "services.configure", true);
    await this.assertModule(member.organizationId, "SERVICES");
    const row = await this.provider.first<{ branchId: string | null; metadataJson: string }>("SELECT branch_id AS branchId, metadata_json AS metadataJson FROM tenant_service_types WHERE id = ? AND organization_id = ? AND status = 'active'", [input.serviceTypeId, member.organizationId]);
    if (!row) throw new Error("El tipo de servicio no existe.");
    if (row.branchId) await this.assertBranch(member, row.branchId, true); else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para configurar un servicio global.");
    if (!Number.isInteger(input.perPersonLimit) || input.perPersonLimit < 1 || input.perPersonLimit > 20) throw new Error("El límite por persona debe estar entre 1 y 20.");
    const metadata = { ...parseMetadata(row.metadataJson), startTime: validTime(input.startTime), endTime: validTime(input.endTime), daysOfWeek: validDays(input.daysOfWeek), perPersonLimit: input.perPersonLimit };
    await this.provider.batch([
      { sql: "UPDATE tenant_service_types SET metadata_json = ?, updated_at = ? WHERE id = ? AND organization_id = ?", values: [JSON.stringify(metadata), nowIso(), input.serviceTypeId, member.organizationId] },
      audit(member.organizationId, "customer_membership", member.membershipId, "services.type.operational_configured", "tenant_service_type", input.serviceTypeId, "Ventana y límite operativo del servicio actualizados.", metadata),
      invalidateDashboard(member.organizationId),
    ]);
  }

  async createDevice(identity: OperationsActor, input: { organizationId: string; branchId: string; code: string; name: string; deviceType: "biometric" | "kiosk" | "tablet" | "scanner" | "admin_station"; provider: string; serialNumber?: string | null; capabilities: string[] }): Promise<{ deviceId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "devices.manage", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    await this.assertBranch(member, input.branchId, true);
    const code = normalizeCode(input.code); const name = input.name.trim();
    if (!code || name.length < 2 || name.length > 120) throw new Error("Revisa el código y nombre del dispositivo.");
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM tenant_devices WHERE organization_id = ? AND code = ?", [member.organizationId, code]);
    if (existing) throw new Error("Ya existe un dispositivo con ese código.");
    const provider = normalizedProvider(input.provider);
    const capabilities = Array.from(new Set(input.capabilities.map((value) => value.trim().toLowerCase()).filter((value) => ["attendance", "enrollment", "*"].includes(value))));
    if (!capabilities.length) throw new Error("Selecciona al menos una capacidad del dispositivo.");
    const serialNumber = input.serialNumber?.trim().slice(0,120) || null;
    if (serialNumber) { const serial = await this.provider.first<{id:string}>("SELECT id FROM tenant_devices WHERE organization_id = ? AND serial_number = ?", [member.organizationId, serialNumber]); if (serial) throw new Error("Ese número de serie ya está registrado."); }
    const deviceId = crypto.randomUUID(); const timestamp = nowIso();
    await this.provider.batch([
      { sql: `INSERT INTO tenant_devices (id, organization_id, branch_id, code, name, status, metadata_json, device_type, provider, serial_number, capabilities_json, configuration_json, health_json, registered_at, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, 'active', '{}', ?, ?, ?, ?, '{}', '{}', ?, ?, ?, ?, 1)`, values: [deviceId, member.organizationId, input.branchId, code, name, input.deviceType, provider, serialNumber, JSON.stringify(capabilities), timestamp, timestamp, timestamp, member.membershipId] },
      audit(member.organizationId, "customer_membership", member.membershipId, "devices.created", "tenant_device", deviceId, "Dispositivo de Personal creado.", { branchId: input.branchId, code, deviceType: input.deviceType, provider, serialNumber, capabilities }),
      invalidateDashboard(member.organizationId),
    ]);
    return { deviceId };
  }

  async configureDevice(identity: OperationsActor, input: { organizationId: string; deviceId: string; deviceType: "biometric" | "kiosk" | "tablet" | "scanner" | "admin_station"; provider: string; serialNumber?: string | null; capabilities: string[]; configuration?: Record<string, unknown>; expectedVersion: number }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "devices.manage", true);
    const device = await this.provider.first<{ branchId: string | null; version: number }>("SELECT branch_id AS branchId, version FROM tenant_devices WHERE id = ? AND organization_id = ? AND status = 'active'", [input.deviceId, member.organizationId]);
    if (!device) throw new Error("El dispositivo no existe.");
    if (!device.branchId) throw new Error("El dispositivo debe vincularse a una sucursal antes de operar.");
    await this.assertBranch(member, device.branchId, true);
    if (device.version !== input.expectedVersion) throw new Error("El dispositivo cambió en otra sesión. Recarga antes de guardar.");
    const provider = normalizedProvider(input.provider);
    const capabilities = Array.from(new Set(input.capabilities.map((value) => value.trim().toLowerCase()).filter((value) => ["attendance", "enrollment", "*"].includes(value))));
    if (!capabilities.length) throw new Error("Selecciona al menos una capacidad del dispositivo.");
    const serialNumber = input.serialNumber?.trim().slice(0, 120) || null;
    const configuration = input.configuration && typeof input.configuration === "object" && !Array.isArray(input.configuration) ? input.configuration : {};
    const changed = await this.provider.run(`UPDATE tenant_devices SET device_type = ?, provider = ?, serial_number = ?, capabilities_json = ?, configuration_json = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND version = ?`, [input.deviceType, provider, serialNumber, JSON.stringify(capabilities), JSON.stringify(configuration), nowIso(), input.deviceId, member.organizationId, input.expectedVersion]);
    if (changed !== 1) throw new Error("El dispositivo cambió en otra sesión. Recarga antes de guardar.");
    await this.provider.batch([
      audit(member.organizationId, "customer_membership", member.membershipId, "devices.configured", "tenant_device", input.deviceId, "Dispositivo preparado para operación productiva.", { deviceType: input.deviceType, provider, serialNumber, capabilities }),
      invalidateDashboard(member.organizationId),
    ]);
  }

  async enrollBiometric(identity: OperationsActor, input: { organizationId: string; personId: string; provider: string; externalTemplateId: string; deviceId?: string | null }): Promise<{ credentialId: string; reused: boolean }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.biometric.enroll", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const person = await this.provider.first<{ id: string; branchId: string; status: string; employeeId: string | null; employeeStatus: string | null }>(`SELECT p.id, p.branch_id AS branchId, p.status, p.employee_id AS employeeId, e.status AS employeeStatus FROM tenant_people p LEFT JOIN tenant_employees e ON e.id = p.employee_id AND e.organization_id = p.organization_id WHERE p.id = ? AND p.organization_id = ? AND p.person_type = 'employee'`, [input.personId, member.organizationId]);
    if (!person || !person.employeeId || person.status !== "active" || person.employeeStatus !== "active") throw new Error("El empleado no está activo dentro de esta organización.");
    await this.assertBranch(member, person.branchId, true);
    const provider = normalizedProvider(input.provider);
    const externalTemplateId = input.externalTemplateId.trim();
    if (externalTemplateId.length < 3 || externalTemplateId.length > 200) throw new Error("La referencia externa de la plantilla biométrica no es válida.");
    if (input.deviceId) {
      const device = await this.provider.first<{ branchId: string | null; provider: string; status: string }>("SELECT branch_id AS branchId, provider, status FROM tenant_devices WHERE id = ? AND organization_id = ?", [input.deviceId, member.organizationId]);
      if (!device || device.status !== "active" || device.branchId !== person.branchId) throw new Error("El dispositivo biométrico no pertenece a la sucursal de la persona.");
      if (device.provider !== provider && device.provider !== "generic") throw new Error("El proveedor biométrico no coincide con el dispositivo.");
    }
    const existing = await this.provider.first<{ id: string; personId: string; status: string }>("SELECT id, person_id AS personId, status FROM biometric_credentials WHERE organization_id = ? AND provider = ? AND external_template_id = ?", [member.organizationId, provider, externalTemplateId]);
    if (existing) {
      if (existing.personId === person.id && existing.status === "active") return { credentialId: existing.id, reused: true };
      throw new Error("Esa referencia biométrica ya está vinculada. Revoca el enrolamiento anterior y genera una referencia nueva desde el dispositivo.");
    }
    const credentialId = crypto.randomUUID();
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `INSERT INTO biometric_credentials (id, organization_id, person_id, provider, external_template_id, device_id, method, status, enrolled_at, enrolled_by, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, 'fingerprint', 'active', ?, ?, ?, ?, 1)`, values: [credentialId, member.organizationId, person.id, provider, externalTemplateId, input.deviceId ?? null, timestamp, member.membershipId, timestamp, timestamp] },
      audit(member.organizationId, "customer_membership", member.membershipId, "biometric.enrolled", "biometric_credential", credentialId, "Se vinculó una referencia externa de huella. KitchenMind no recibió ni almacenó la huella cruda.", { personId: person.id, provider, deviceId: input.deviceId ?? null }),
    ]);
    return { credentialId, reused: false };
  }

  async revokeBiometric(identity: OperationsActor, input: { organizationId: string; credentialId: string; expectedVersion: number; reason: string }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.biometric.revoke", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const credential = await this.provider.first<{ personId: string; branchId: string; status: string; version: number }>(`SELECT bc.person_id AS personId, p.branch_id AS branchId, bc.status, bc.version FROM biometric_credentials bc JOIN tenant_people p ON p.id = bc.person_id WHERE bc.id = ? AND bc.organization_id = ?`, [input.credentialId, member.organizationId]);
    if (!credential) throw new Error("La credencial biométrica no existe.");
    await this.assertBranch(member, credential.branchId, true);
    if (credential.status !== "active") return;
    if (credential.version !== input.expectedVersion) throw new Error("El enrolamiento cambió en otra sesión.");
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Explica por qué se revoca el enrolamiento.");
    const changed = await this.provider.run(`UPDATE biometric_credentials SET status = 'revoked', revoked_at = ?, revoked_by = ?, reason = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'active' AND version = ?`, [nowIso(), member.membershipId, reason, nowIso(), input.credentialId, member.organizationId, input.expectedVersion]);
    if (changed !== 1) throw new Error("El enrolamiento cambió en otra sesión.");
    await this.provider.batch([audit(member.organizationId, "customer_membership", member.membershipId, "biometric.revoked", "biometric_credential", input.credentialId, reason, { personId: credential.personId })]);
  }

  async issueDeviceCredential(identity: OperationsActor, input: { organizationId: string; deviceId: string; expiresAt?: string | null }): Promise<{ deviceId: string; token: string; tokenPrefix: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "devices.manage", true);
    const device = await this.provider.first<{ id: string; branchId: string | null; status: string; capabilitiesJson: string }>("SELECT id, branch_id AS branchId, status, capabilities_json AS capabilitiesJson FROM tenant_devices WHERE id = ? AND organization_id = ?", [input.deviceId, member.organizationId]);
    if (!device || device.status !== "active" || !device.branchId) throw new Error("El dispositivo debe estar activo y vinculado a una sucursal.");
    await this.assertBranch(member, device.branchId, true);
    const capabilities = asJson<string[]>(device.capabilitiesJson, []);
    if (!capabilities.length) throw new Error("Configura las capacidades del dispositivo antes de emitir una credencial.");
    const expiresAt = input.expiresAt?.trim() || null;
    if (expiresAt && (Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now())) throw new Error("La vigencia del dispositivo debe terminar en el futuro.");
    const token = randomDeviceToken();
    const tokenHash = await sha256(token);
    const tokenPrefix = token.slice(0, 14);
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE tenant_device_credentials SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE device_id = ? AND organization_id = ? AND status = 'active'`, values: [timestamp, member.membershipId, device.id, member.organizationId] },
      { sql: `INSERT INTO tenant_device_credentials (id, organization_id, device_id, token_hash, token_prefix, status, issued_at, issued_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, values: [crypto.randomUUID(), member.organizationId, device.id, tokenHash, tokenPrefix, timestamp, member.membershipId, expiresAt, timestamp] },
      audit(member.organizationId, "customer_membership", member.membershipId, "devices.credential.issued", "tenant_device", device.id, "Se rotó la credencial privada del dispositivo.", { tokenPrefix, expiresAt, capabilities }),
    ]);
    return { deviceId: device.id, token, tokenPrefix };
  }

  async revokeDeviceCredential(identity: OperationsActor, input: { organizationId: string; deviceId: string; reason: string }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "devices.manage", true);
    const device = await this.provider.first<{ branchId: string | null }>("SELECT branch_id AS branchId FROM tenant_devices WHERE id = ? AND organization_id = ?", [input.deviceId, member.organizationId]);
    if (!device || !device.branchId) throw new Error("El dispositivo no existe o no está vinculado.");
    await this.assertBranch(member, device.branchId, true);
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Explica por qué se revoca la credencial del dispositivo.");
    await this.provider.batch([
      { sql: `UPDATE tenant_device_credentials SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE device_id = ? AND organization_id = ? AND status = 'active'`, values: [nowIso(), member.membershipId, input.deviceId, member.organizationId] },
      audit(member.organizationId, "customer_membership", member.membershipId, "devices.credential.revoked", "tenant_device", input.deviceId, reason),
    ]);
  }

  async manualAttendanceAdjustment(identity: OperationsActor, input: { organizationId: string; branchId: string; employeeId: string; adjustedEventType: "entry" | "exit" | "late" | "incident"; occurredAt: string; reason: string; originalEventId?: string | null; idempotencyKey: string }): Promise<{ eventId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.attendance.adjust", true);
    await this.assertModule(member.organizationId, "PERSONNEL");
    const branch = await this.assertBranch(member, input.branchId, true);
    const employee = await this.provider.first<{ id: string; personId: string | null; status: string }>(`SELECT e.id, p.id AS personId, e.status FROM tenant_employees e LEFT JOIN tenant_people p ON p.employee_id = e.id AND p.organization_id = e.organization_id WHERE e.id = ? AND e.organization_id = ? AND e.branch_id = ?`, [input.employeeId, member.organizationId, input.branchId]);
    if (!employee || employee.status === "terminated") throw new Error("El empleado no pertenece a la sucursal o está dado de baja.");
    if (input.originalEventId) {
      const original = await this.provider.first<{ id: string }>("SELECT id FROM operational_attendance_events WHERE id = ? AND organization_id = ? AND branch_id = ? AND employee_id = ?", [input.originalEventId, member.organizationId, input.branchId, employee.id]);
      if (!original) throw new Error("El evento original no pertenece al empleado seleccionado.");
    }
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) throw new Error("El ajuste manual requiere un motivo claro.");
    const occurredAt = validTimestamp(input.occurredAt, true);
    const localDate = localOperationalDate(occurredAt, branch.timezone);
    const candidates = await this.provider.all<{ shiftId: string; metadataJson: string }>(`SELECT esa.shift_id AS shiftId, s.metadata_json AS metadataJson FROM employee_shift_assignments esa JOIN tenant_shifts s ON s.id = esa.shift_id AND s.organization_id = esa.organization_id WHERE esa.organization_id = ? AND esa.employee_id = ? AND esa.starts_on <= ? AND COALESCE(esa.ends_on,'9999-12-31') >= ? ORDER BY esa.starts_on DESC LIMIT 10`, [member.organizationId, employee.id, localDate, shiftDate(localDate, -1)]);
    let effectiveShift: { shiftId: string; metadataJson: string; operationalDate: string } | null = null;
    for (const candidate of candidates) {
      const config = shiftConfig(candidate.metadataJson);
      const date = operationalDateForShift(occurredAt, branch.timezone, config);
      const assignment = await this.provider.first<{ ok: number }>(`SELECT 1 AS ok FROM employee_shift_assignments WHERE organization_id = ? AND employee_id = ? AND shift_id = ? AND starts_on <= ? AND COALESCE(ends_on,'9999-12-31') >= ? LIMIT 1`, [member.organizationId, employee.id, candidate.shiftId, date, date]);
      if (assignment && shiftAppliesOnOperationalDate(date, branch.timezone, config)) { effectiveShift = { ...candidate, operationalDate: date }; break; }
    }
    const operationalDate = effectiveShift?.operationalDate ?? localDate;
    const lateMinutes = input.adjustedEventType === "late" && effectiveShift ? attendanceLatenessMinutes(occurredAt, branch.timezone, shiftConfig(effectiveShift.metadataJson)) : null;
    const key = `manual:${member.membershipId}:${validIdempotencyKey(input.idempotencyKey)}`;
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM operational_attendance_events WHERE organization_id = ? AND idempotency_key = ?", [member.organizationId, key]);
    if (existing) return { eventId: existing.id };
    const id = crypto.randomUUID();
    await this.provider.batch([
      { sql: `INSERT INTO operational_attendance_events (id, organization_id, branch_id, person_id, employee_id, shift_id, event_type, adjusted_event_type, original_event_id, late_minutes, event_timestamp, operational_date, source, idempotency_key, synchronization_status, reason, recorded_by_membership_id, server_received_at) VALUES (?, ?, ?, ?, ?, ?, 'manual_adjustment', ?, ?, ?, ?, ?, 'manual', ?, 'synced', ?, ?, ?)`, values: [id, member.organizationId, input.branchId, employee.personId, employee.id, effectiveShift?.shiftId ?? null, input.adjustedEventType, input.originalEventId ?? null, lateMinutes, occurredAt, operationalDate, key, reason, member.membershipId, nowIso()] },
      audit(member.organizationId, "customer_membership", member.membershipId, "attendance.manual_adjustment", "operational_attendance_event", id, reason, { employeeId: employee.id, personId: employee.personId, adjustedEventType: input.adjustedEventType, originalEventId: input.originalEventId ?? null, shiftId: effectiveShift?.shiftId ?? null, operationalDate }),
      invalidateDashboard(member.organizationId),
    ]);
    return { eventId: id };
  }

  async attendanceExport(identity: OperationsActor, input: { organizationId: string; branchId?: string | null; operationalDate: string }): Promise<OperationalAttendanceExportRow[]> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "personnel.attendance.export");
    await this.assertModule(member.organizationId, "PERSONNEL");
    const branches = await this.authorizedBranches(member);
    const requested = input.branchId ? [input.branchId] : branches.map((branch) => branch.id);
    if (!requested.length || requested.some((id) => !branches.some((branch) => branch.id === id))) throw new Error("La sucursal solicitada está fuera de tu alcance autorizado.");
    const operationalDate = validDateOnly(input.operationalDate, "La fecha operacional");
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT a.operational_date AS operationalDate, a.employee_id AS employeeId, e.employee_number AS employeeNumber, e.name AS employeeName, b.name AS branchName, s.name AS shiftName,
      MIN(CASE WHEN COALESCE(a.adjusted_event_type,a.event_type) IN ('entry','late') THEN a.event_timestamp END) AS entryAt,
      MAX(CASE WHEN COALESCE(a.adjusted_event_type,a.event_type) = 'exit' THEN a.event_timestamp END) AS exitAt,
      MAX(CASE WHEN COALESCE(a.adjusted_event_type,a.event_type) = 'late' THEN COALESCE(a.late_minutes,0) END) AS lateMinutes,
      SUM(CASE WHEN COALESCE(a.adjusted_event_type,a.event_type) = 'incident' THEN 1 ELSE 0 END) AS incidentCount
      FROM operational_attendance_events a JOIN tenant_employees e ON e.id = a.employee_id AND e.organization_id = a.organization_id JOIN tenant_branches b ON b.id = a.branch_id AND b.organization_id = a.organization_id LEFT JOIN tenant_shifts s ON s.id = a.shift_id AND s.organization_id = a.organization_id
      WHERE a.organization_id = ? AND a.branch_id IN (${placeholders(requested)}) AND a.operational_date = ?
      GROUP BY a.operational_date, a.employee_id, e.employee_number, e.name, b.name, s.name ORDER BY b.name, e.name, e.employee_number LIMIT 10000`, [member.organizationId, ...requested, operationalDate]);
    await this.provider.batch([audit(member.organizationId, "customer_membership", member.membershipId, "attendance.exported", "operational_attendance_event", null, "Se exportó asistencia dentro del alcance autorizado.", { operationalDate, branchIds: requested, rows: rows.length })]);
    return rows.map((row) => ({ operationalDate: String(row.operationalDate), employeeId: String(row.employeeId), employeeNumber: String(row.employeeNumber), employeeName: String(row.employeeName), branchName: String(row.branchName), shiftName: row.shiftName ? String(row.shiftName) : null, entryAt: row.entryAt ? String(row.entryAt) : null, exitAt: row.exitAt ? String(row.exitAt) : null, lateMinutes: row.lateMinutes === null || row.lateMinutes === undefined ? null : Number(row.lateMinutes), incidentCount: Number(row.incidentCount ?? 0) }));
  }

  async overrideService(identity: OperationsActor, input: { organizationId: string; branchId: string; personId: string; serviceTypeId: string; occurredAt?: string | null; reason: string; idempotencyKey: string }): Promise<{ eventId: string; reused: boolean }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "services.override", true);
    await this.assertModule(member.organizationId, "SERVICES");
    const branch = await this.assertBranch(member, input.branchId, true);
    const [person, serviceType] = await Promise.all([
      this.provider.first<{ id: string; employeeId: string | null; clientId: string | null; costCenterId: string | null; status: string }>("SELECT id, employee_id AS employeeId, client_id AS clientId, cost_center_id AS costCenterId, status FROM tenant_people WHERE id = ? AND organization_id = ? AND branch_id = ?", [input.personId, member.organizationId, input.branchId]),
      this.provider.first<{ id: string; branchId: string | null }>("SELECT id, branch_id AS branchId FROM tenant_service_types WHERE id = ? AND organization_id = ? AND status = 'active'", [input.serviceTypeId, member.organizationId]),
    ]);
    if (!person || person.status !== "active") throw new Error("La persona no está activa en esta sucursal.");
    if (!serviceType || (serviceType.branchId && serviceType.branchId !== input.branchId)) throw new Error("El servicio no aplica a esta sucursal.");
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) throw new Error("La excepción requiere un motivo claro.");
    const occurredAt = validTimestamp(input.occurredAt ?? nowIso(), true);
    const operationalDate = localOperationalDate(occurredAt, branch.timezone);
    const key = `override:${member.membershipId}:${validIdempotencyKey(input.idempotencyKey)}`;
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM operational_service_events WHERE organization_id = ? AND idempotency_key = ?", [member.organizationId, key]);
    if (existing) return { eventId: existing.id, reused: true };
    const id = crypto.randomUUID();
    await this.provider.batch([
      { sql: `INSERT INTO operational_service_events (id, organization_id, branch_id, person_id, employee_id, client_id, cost_center_id, service_type_id, event_timestamp, operational_date, source, idempotency_key, synchronization_status, override, override_reason, authorized_by_membership_id, server_received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, 'synced', 1, ?, ?, ?)`, values: [id, member.organizationId, input.branchId, person.id, person.employeeId, person.clientId, person.costCenterId, serviceType.id, occurredAt, operationalDate, key, reason, member.membershipId, nowIso()] },
      audit(member.organizationId, "customer_membership", member.membershipId, "services.override", "operational_service_event", id, reason, { personId: person.id, serviceTypeId: serviceType.id }),
      invalidateDashboard(member.organizationId),
    ]);
    return { eventId: id, reused: false };
  }

  async authenticateDevice(token: string): Promise<DeviceIdentity> {
    const clean = token.trim();
    if (clean.length < 40 || clean.length > 120) throw new Error("La credencial del dispositivo no es válida.");
    const tokenHash = await sha256(clean);
    const row = await this.provider.first<Record<string, unknown>>(`SELECT dc.id AS credentialId, dc.organization_id AS organizationId, dc.device_id AS deviceId, d.branch_id AS branchId, d.code AS deviceCode, d.name AS deviceName, d.provider, d.capabilities_json AS capabilitiesJson, dc.expires_at AS expiresAt,
      d.status AS deviceStatus, b.status AS branchStatus, o.status AS organizationStatus
      FROM tenant_device_credentials dc JOIN tenant_devices d ON d.id = dc.device_id AND d.organization_id = dc.organization_id
      JOIN tenant_branches b ON b.id = d.branch_id AND b.organization_id = d.organization_id
      JOIN tenant_organizations o ON o.id = d.organization_id AND o.deleted_at IS NULL
      WHERE dc.token_hash = ? AND dc.status = 'active' LIMIT 1`, [tokenHash]);
    if (!row || String(row.deviceStatus) !== "active" || String(row.branchStatus) !== "active" || String(row.organizationStatus) !== "active") throw new Error("El dispositivo no está autorizado.");
    if (row.expiresAt && String(row.expiresAt) <= nowIso()) throw new Error("La credencial del dispositivo venció.");
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: "UPDATE tenant_device_credentials SET last_used_at = ? WHERE id = ?", values: [timestamp, String(row.credentialId)] },
      { sql: "UPDATE tenant_devices SET last_seen_at = ?, updated_at = ? WHERE id = ?", values: [timestamp, timestamp, String(row.deviceId)] },
    ]);
    return {
      credentialId: String(row.credentialId), organizationId: String(row.organizationId), branchId: String(row.branchId), deviceId: String(row.deviceId), deviceCode: String(row.deviceCode), deviceName: String(row.deviceName),
      provider: String(row.provider), capabilities: asJson<string[]>(row.capabilitiesJson ? String(row.capabilitiesJson) : null, []),
    };
  }

  async heartbeat(device: DeviceIdentity, input: { bridgeVersion?: string | null; health?: Record<string, unknown>; status?: "online" | "degraded" | "unknown" }): Promise<{ receivedAt: string }> {
    const receivedAt = nowIso();
    const health = input.health && typeof input.health === "object" && !Array.isArray(input.health) ? { ...input.health } : {};
    const status = input.status ?? "online";
    const payload = JSON.stringify({ ...health, status });
    if (payload.length > 12_000) throw new Error("El estado de salud del dispositivo es demasiado grande.");
    const bridgeVersion = input.bridgeVersion?.trim().slice(0, 80) || null;
    const changed = await this.provider.run(`UPDATE tenant_devices SET health_json = ?, bridge_version = ?, last_health_at = ?, last_seen_at = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND branch_id = ? AND status = 'active'`, [payload, bridgeVersion, receivedAt, receivedAt, receivedAt, device.deviceId, device.organizationId, device.branchId]);
    if (changed !== 1) throw new Error("El dispositivo ya no está autorizado.");
    return { receivedAt };
  }

  private async credentialPerson(device: DeviceIdentity, provider: string, externalTemplateId: string): Promise<CredentialPersonRow | null> {
    return this.provider.first<CredentialPersonRow>(`SELECT bc.id AS credentialId, p.id AS personId, p.name AS personName, p.status AS personStatus, p.branch_id AS personBranchId,
      e.id AS employeeId, e.employee_number AS employeeNumber, e.status AS employeeStatus, e.shift_id AS shiftId, s.name AS shiftName, s.metadata_json AS shiftMetadataJson,
      p.client_id AS clientId, p.cost_center_id AS costCenterId
      FROM biometric_credentials bc JOIN tenant_people p ON p.id = bc.person_id AND p.organization_id = bc.organization_id
      LEFT JOIN tenant_employees e ON e.id = p.employee_id AND e.organization_id = p.organization_id
      LEFT JOIN tenant_shifts s ON s.id = e.shift_id AND s.organization_id = p.organization_id
      WHERE bc.organization_id = ? AND bc.provider = ? AND bc.external_template_id = ? AND bc.status = 'active' AND (bc.device_id IS NULL OR bc.device_id = ?) LIMIT 1`, [device.organizationId, provider, externalTemplateId, device.deviceId]);
  }

  private async recordUnknownServiceAttempt(device: DeviceIdentity, input: KioskCaptureInput, occurredAt: string, operationalDate: string, result: string, reason: string): Promise<void> {
    const attemptKey = `attempt:${device.deviceId}:${validIdempotencyKey(input.idempotencyKey)}`;
    await this.provider.batch([
      { sql: `INSERT OR IGNORE INTO operational_service_attempts (id, organization_id, branch_id, person_id, service_type_id, device_id, event_id, result, reason, attempted_at, operational_date, idempotency_key) VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), device.organizationId, device.branchId, device.deviceId, result, reason, occurredAt, operationalDate, attemptKey] },
      audit(device.organizationId, "device", device.deviceId, `service.${result}`, "operational_service_attempt", null, reason, { operationalDate }, result === "registered" ? "success" : "denied"),
    ]);
  }

  private async captureAttendance(device: DeviceIdentity, person: CredentialPersonRow, input: KioskCaptureInput, occurredAt: string): Promise<KioskCaptureResult> {
    requireDeviceCapability(device, "attendance");
    if (!person.employeeId || person.employeeStatus !== "active" || person.personStatus !== "active" || person.personBranchId !== device.branchId) return { status: "unknown", eventKind: "attendance", occurredAt };
    const branch = await this.provider.first<{ timezone: string; name: string }>("SELECT timezone, name FROM tenant_branches WHERE id = ? AND organization_id = ? AND status = 'active'", [device.branchId, device.organizationId]);
    if (!branch) throw new Error("La sucursal del dispositivo no está disponible.");
    const localDate = localOperationalDate(occurredAt, branch.timezone);
    const shiftCandidates = await this.provider.all<{ shiftId: string; shiftName: string; metadataJson: string; startsOn: string; endsOn: string | null }>(`SELECT esa.shift_id AS shiftId, s.name AS shiftName, s.metadata_json AS metadataJson, esa.starts_on AS startsOn, esa.ends_on AS endsOn FROM employee_shift_assignments esa JOIN tenant_shifts s ON s.id = esa.shift_id AND s.organization_id = esa.organization_id AND s.status = 'active' WHERE esa.organization_id = ? AND esa.employee_id = ? AND esa.starts_on <= ? AND COALESCE(esa.ends_on,'9999-12-31') >= ? ORDER BY esa.starts_on DESC LIMIT 10`, [device.organizationId, person.employeeId, localDate, shiftDate(localDate, -1)]);
    let shiftId = person.shiftId;
    let shiftName = person.shiftName;
    let config = person.shiftId ? shiftConfig(person.shiftMetadataJson) : null;
    for (const candidate of shiftCandidates) {
      const candidateConfig = shiftConfig(candidate.metadataJson);
      const date = operationalDateForShift(occurredAt, branch.timezone, candidateConfig);
      if (candidate.startsOn <= date && (!candidate.endsOn || candidate.endsOn >= date) && shiftAppliesOnOperationalDate(date, branch.timezone, candidateConfig)) { shiftId = candidate.shiftId; shiftName = candidate.shiftName; config = candidateConfig; break; }
    }
    const eventKey = `device:${device.deviceId}:${validIdempotencyKey(input.idempotencyKey)}`;
    const existingByKey = await this.provider.first<{ id: string; eventType: string; eventTimestamp: string; lateMinutes: number | null }>("SELECT id, event_type AS eventType, event_timestamp AS eventTimestamp, late_minutes AS lateMinutes FROM operational_attendance_events WHERE organization_id = ? AND idempotency_key = ?", [device.organizationId, eventKey]);
    const context = { personId: person.personId, personName: person.personName, employeeNumber: person.employeeNumber ?? "", shiftName: shiftName ?? null, branchName: branch.name };
    if (existingByKey) return { status: "duplicate", eventKind: "attendance", eventId: existingByKey.id, ...context, eventType: existingByKey.eventType as "entry" | "exit" | "late" | "incident" | "manual_adjustment", lateMinutes: existingByKey.lateMinutes === null ? null : Number(existingByKey.lateMinutes), occurredAt: existingByKey.eventTimestamp, offline: Boolean(input.offlineEventId) };
    const recent = await this.provider.all<{ id: string; eventType: string; eventTimestamp: string; operationalDate: string }>(`SELECT id, COALESCE(adjusted_event_type,event_type) AS eventType, event_timestamp AS eventTimestamp, operational_date AS operationalDate FROM operational_attendance_events WHERE organization_id = ? AND employee_id = ? AND event_timestamp <= ? AND event_timestamp >= ? ORDER BY event_timestamp DESC, created_at DESC LIMIT 20`, [device.organizationId, person.employeeId, occurredAt, new Date(new Date(occurredAt).getTime() - 36 * 60 * 60_000).toISOString()]);
    const decision = decideOperationalAttendance(recent, occurredAt, branch.timezone, config, 90);
    if (decision.kind === "duplicate") {
      const previous = await this.provider.first<{ id: string; eventType: string; eventTimestamp: string; lateMinutes: number | null }>("SELECT id, COALESCE(adjusted_event_type,event_type) AS eventType, event_timestamp AS eventTimestamp, late_minutes AS lateMinutes FROM operational_attendance_events WHERE id = ? AND organization_id = ?", [decision.previousEventId, device.organizationId]);
      if (!previous) throw new Error("No fue posible recuperar el evento previo.");
      await this.provider.batch([audit(device.organizationId, "device", device.deviceId, "attendance.duplicate", "operational_attendance_event", previous.id, "Lectura rechazada dentro de la ventana anti-rebote.", { employeeId: person.employeeId })]);
      return { status: "duplicate", eventKind: "attendance", eventId: previous.id, ...context, eventType: previous.eventType as "entry" | "exit" | "late" | "incident" | "manual_adjustment", lateMinutes: previous.lateMinutes === null ? null : Number(previous.lateMinutes), occurredAt: previous.eventTimestamp, offline: Boolean(input.offlineEventId) };
    }
    const lateMinutes = decision.eventType === "late" ? attendanceLatenessMinutes(occurredAt, branch.timezone, config) : null;
    const id = crypto.randomUUID();
    const serverReceivedAt = nowIso();
    const threshold = new Date(new Date(occurredAt).getTime() - 90_000).toISOString();
    let changed = 0;
    try {
      changed = await this.provider.run(`INSERT INTO operational_attendance_events (id, organization_id, branch_id, person_id, employee_id, shift_id, device_id, biometric_credential_id, event_type, late_minutes, event_timestamp, operational_date, source, idempotency_key, synchronization_status, offline_event_id, server_received_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM operational_attendance_events prev WHERE prev.organization_id = ? AND prev.employee_id = ? AND prev.event_timestamp >= ? AND prev.event_timestamp <= ? AND COALESCE(prev.adjusted_event_type,prev.event_type) IN ('entry','exit','late','incident'))`, [id, device.organizationId, device.branchId, person.personId, person.employeeId, shiftId, device.deviceId, person.credentialId, decision.eventType, lateMinutes, occurredAt, decision.operationalDate, input.offlineEventId ? "offline_sync" : "biometric", eventKey, input.offlineEventId ?? null, serverReceivedAt, device.organizationId, person.employeeId, threshold, occurredAt]);
    } catch (error) {
      const race = await this.provider.first<{ id: string; eventType: string; eventTimestamp: string; lateMinutes: number | null }>("SELECT id, COALESCE(adjusted_event_type,event_type) AS eventType, event_timestamp AS eventTimestamp, late_minutes AS lateMinutes FROM operational_attendance_events WHERE organization_id = ? AND idempotency_key = ?", [device.organizationId, eventKey]);
      if (race) return { status: "duplicate", eventKind: "attendance", eventId: race.id, ...context, eventType: race.eventType as "entry" | "exit" | "late" | "incident" | "manual_adjustment", lateMinutes: race.lateMinutes === null ? null : Number(race.lateMinutes), occurredAt: race.eventTimestamp, offline: Boolean(input.offlineEventId) };
      throw error;
    }
    if (changed !== 1) {
      const previous = await this.provider.first<{ id: string; eventType: string; eventTimestamp: string; lateMinutes: number | null }>(`SELECT id, COALESCE(adjusted_event_type,event_type) AS eventType, event_timestamp AS eventTimestamp, late_minutes AS lateMinutes FROM operational_attendance_events WHERE organization_id = ? AND employee_id = ? AND event_timestamp >= ? AND event_timestamp <= ? AND COALESCE(adjusted_event_type,event_type) IN ('entry','exit','late','incident') ORDER BY event_timestamp DESC LIMIT 1`, [device.organizationId, person.employeeId, threshold, occurredAt]);
      if (!previous) throw new Error("El evento fue rechazado por concurrencia pero no se encontró el registro previo.");
      await this.provider.batch([audit(device.organizationId, "device", device.deviceId, "attendance.duplicate", "operational_attendance_event", previous.id, "Lectura concurrente rechazada por el guardado atómico anti-rebote.", { employeeId: person.employeeId })]);
      return { status: "duplicate", eventKind: "attendance", eventId: previous.id, ...context, eventType: previous.eventType as "entry" | "exit" | "late" | "incident" | "manual_adjustment", lateMinutes: previous.lateMinutes === null ? null : Number(previous.lateMinutes), occurredAt: previous.eventTimestamp, offline: Boolean(input.offlineEventId) };
    }
    await this.provider.batch([
      audit(device.organizationId, "device", device.deviceId, `attendance.${decision.eventType}`, "operational_attendance_event", id, "Evento de asistencia registrado desde dispositivo autorizado.", { employeeId: person.employeeId, personId: person.personId, shiftId, lateMinutes, operationalDate: decision.operationalDate, source: input.offlineEventId ? "offline_sync" : "biometric" }),
      invalidateDashboard(device.organizationId),
    ]);
    return { status: "registered", eventKind: "attendance", eventId: id, ...context, eventType: decision.eventType, lateMinutes, occurredAt, offline: Boolean(input.offlineEventId) };
  }

  private async captureService(device: DeviceIdentity, person: CredentialPersonRow, input: KioskCaptureInput, occurredAt: string): Promise<KioskCaptureResult> {
    requireDeviceCapability(device, "services");
    const branch = await this.provider.first<{ timezone: string }>("SELECT timezone FROM tenant_branches WHERE id = ? AND organization_id = ? AND status = 'active'", [device.branchId, device.organizationId]);
    if (!branch) throw new Error("La sucursal del dispositivo no está disponible.");
    const localDate = localOperationalDate(occurredAt, branch.timezone);
    if (person.personStatus !== "active" || person.personBranchId !== device.branchId) {
      await this.recordUnknownServiceAttempt(device, input, occurredAt, localDate, "inactive_person", "La persona está inactiva o no pertenece a la sucursal del dispositivo.");
      return { status: "unknown", eventKind: "service", occurredAt };
    }
    const rows = await this.provider.all<{ id: string; name: string; branchId: string | null; metadataJson: string }>(`SELECT id, name, branch_id AS branchId, metadata_json AS metadataJson FROM tenant_service_types WHERE organization_id = ? AND status = 'active' AND (branch_id IS NULL OR branch_id = ?) ORDER BY CASE WHEN branch_id = ? THEN 0 ELSE 1 END, name LIMIT 100`, [device.organizationId, device.branchId, device.branchId]);
    const candidates = input.requestedServiceTypeId ? rows.filter((row) => row.id === input.requestedServiceTypeId) : rows;
    const selected = candidates.map((row) => ({ row, config: serviceConfig(row.metadataJson) })).find(({ config }) => isServiceActive(occurredAt, branch.timezone, config));
    if (!selected) {
      await this.recordUnknownServiceAttempt(device, input, occurredAt, localDate, "no_active_service", "No existe un servicio configurado y activo para esta hora.");
      return { status: "no_active_service", eventKind: "service", personId: person.personId, personName: person.personName, occurredAt };
    }
    const operationalDate = operationalDateForService(occurredAt, branch.timezone, selected.config);
    const eventKey = `device:${device.deviceId}:${validIdempotencyKey(input.idempotencyKey)}`;
    const attemptKey = `attempt:${device.deviceId}:${validIdempotencyKey(input.idempotencyKey)}`;
    const existingByKey = await this.provider.first<{ id: string; eventTimestamp: string }>("SELECT id, event_timestamp AS eventTimestamp FROM operational_service_events WHERE organization_id = ? AND idempotency_key = ?", [device.organizationId, eventKey]);
    if (existingByKey) {
      await this.provider.run(`INSERT OR IGNORE INTO operational_service_attempts (id, organization_id, branch_id, person_id, service_type_id, device_id, event_id, result, reason, attempted_at, operational_date, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'duplicate', 'Reintento idempotente del mismo evento.', ?, ?, ?)`, [crypto.randomUUID(), device.organizationId, device.branchId, person.personId, selected.row.id, device.deviceId, existingByKey.id, occurredAt, operationalDate, attemptKey]);
      return { status: "duplicate", eventKind: "service", eventId: existingByKey.id, personId: person.personId, personName: person.personName, serviceTypeId: selected.row.id, serviceTypeName: selected.row.name, occurredAt, previousAt: existingByKey.eventTimestamp, offline: Boolean(input.offlineEventId) };
    }
    const previous = await this.provider.first<{ id: string; eventTimestamp: string; count: number }>(`SELECT id, event_timestamp AS eventTimestamp, (SELECT COUNT(*) FROM operational_service_events c WHERE c.organization_id = ? AND c.person_id = ? AND c.service_type_id = ? AND c.operational_date = ?) AS count FROM operational_service_events WHERE organization_id = ? AND person_id = ? AND service_type_id = ? AND operational_date = ? ORDER BY event_timestamp DESC LIMIT 1`, [device.organizationId, person.personId, selected.row.id, operationalDate, device.organizationId, person.personId, selected.row.id, operationalDate]);
    if ((previous?.count ?? 0) >= selected.config.perPersonLimit && previous) {
      await this.provider.batch([
        { sql: `INSERT OR IGNORE INTO operational_service_attempts (id, organization_id, branch_id, person_id, service_type_id, device_id, event_id, result, reason, attempted_at, operational_date, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'duplicate', 'Límite de servicios por persona alcanzado.', ?, ?, ?)`, values: [crypto.randomUUID(), device.organizationId, device.branchId, person.personId, selected.row.id, device.deviceId, previous.id, occurredAt, operationalDate, attemptKey] },
        audit(device.organizationId, "device", device.deviceId, "service.duplicate", "operational_service_event", previous.id, "Servicio rechazado porque la persona ya alcanzó su límite para esta ventana.", { personId: person.personId, serviceTypeId: selected.row.id, operationalDate }),
        invalidateDashboard(device.organizationId),
      ]);
      return { status: "duplicate", eventKind: "service", eventId: previous.id, personId: person.personId, personName: person.personName, serviceTypeId: selected.row.id, serviceTypeName: selected.row.name, occurredAt, previousAt: previous.eventTimestamp, offline: Boolean(input.offlineEventId) };
    }
    const id = crypto.randomUUID();
    let changed = 0;
    try {
      changed = await this.provider.run(`INSERT INTO operational_service_events (id, organization_id, branch_id, person_id, employee_id, client_id, cost_center_id, service_type_id, device_id, biometric_credential_id, event_timestamp, operational_date, source, idempotency_key, synchronization_status, offline_event_id, override, server_received_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, 0, ?
        WHERE (SELECT COUNT(*) FROM operational_service_events existing WHERE existing.organization_id = ? AND existing.person_id = ? AND existing.service_type_id = ? AND existing.operational_date = ?) < ?`, [id, device.organizationId, device.branchId, person.personId, person.employeeId, person.clientId, person.costCenterId, selected.row.id, device.deviceId, person.credentialId, occurredAt, operationalDate, input.offlineEventId ? "offline_sync" : "biometric", eventKey, input.offlineEventId ?? null, nowIso(), device.organizationId, person.personId, selected.row.id, operationalDate, selected.config.perPersonLimit]);
    } catch (error) {
      const race = await this.provider.first<{ id: string; eventTimestamp: string }>("SELECT id, event_timestamp AS eventTimestamp FROM operational_service_events WHERE organization_id = ? AND idempotency_key = ?", [device.organizationId, eventKey]);
      if (race) return { status: "duplicate", eventKind: "service", eventId: race.id, personId: person.personId, personName: person.personName, serviceTypeId: selected.row.id, serviceTypeName: selected.row.name, occurredAt, previousAt: race.eventTimestamp, offline: Boolean(input.offlineEventId) };
      throw error;
    }
    if (changed !== 1) {
      const race = await this.provider.first<{ id: string; eventTimestamp: string }>(`SELECT id, event_timestamp AS eventTimestamp FROM operational_service_events WHERE organization_id = ? AND person_id = ? AND service_type_id = ? AND operational_date = ? ORDER BY event_timestamp DESC LIMIT 1`, [device.organizationId, person.personId, selected.row.id, operationalDate]);
      if (!race) throw new Error("El límite de servicio fue alcanzado de forma concurrente, pero no se encontró el evento previo.");
      await this.provider.batch([
        { sql: `INSERT OR IGNORE INTO operational_service_attempts (id, organization_id, branch_id, person_id, service_type_id, device_id, event_id, result, reason, attempted_at, operational_date, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'duplicate', 'Límite alcanzado durante una captura concurrente.', ?, ?, ?)`, values: [crypto.randomUUID(), device.organizationId, device.branchId, person.personId, selected.row.id, device.deviceId, race.id, occurredAt, operationalDate, attemptKey] },
        audit(device.organizationId, "device", device.deviceId, "service.duplicate", "operational_service_event", race.id, "Captura concurrente rechazada por el límite atómico por persona y servicio.", { personId: person.personId, serviceTypeId: selected.row.id, operationalDate }),
        invalidateDashboard(device.organizationId),
      ]);
      return { status: "duplicate", eventKind: "service", eventId: race.id, personId: person.personId, personName: person.personName, serviceTypeId: selected.row.id, serviceTypeName: selected.row.name, occurredAt, previousAt: race.eventTimestamp, offline: Boolean(input.offlineEventId) };
    }
    await this.provider.batch([
      { sql: `INSERT OR IGNORE INTO operational_service_attempts (id, organization_id, branch_id, person_id, service_type_id, device_id, event_id, result, reason, attempted_at, operational_date, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', 'Servicio registrado correctamente.', ?, ?, ?)`, values: [crypto.randomUUID(), device.organizationId, device.branchId, person.personId, selected.row.id, device.deviceId, id, occurredAt, operationalDate, attemptKey] },
      audit(device.organizationId, "device", device.deviceId, "service.registered", "operational_service_event", id, "Servicio registrado desde dispositivo autorizado.", { personId: person.personId, serviceTypeId: selected.row.id, operationalDate, source: input.offlineEventId ? "offline_sync" : "biometric" }),
      invalidateDashboard(device.organizationId),
    ]);
    return { status: "registered", eventKind: "service", eventId: id, personId: person.personId, personName: person.personName, serviceTypeId: selected.row.id, serviceTypeName: selected.row.name, occurredAt, offline: Boolean(input.offlineEventId) };
  }

  async captureFromDevice(device: DeviceIdentity, input: KioskCaptureInput): Promise<KioskCaptureResult> {
    if (input.eventKind !== "attendance") throw new Error("El módulo de comensales está diferido por decisión de producto.");
    await this.assertModule(device.organizationId, "PERSONNEL");
    const occurredAt = validTimestamp(input.occurredAt, Boolean(input.offlineEventId));
    const provider = normalizedProvider(input.provider ?? device.provider);
    const externalTemplateId = input.externalTemplateId.trim();
    if (externalTemplateId.length < 3 || externalTemplateId.length > 200) throw new Error("La referencia biométrica no es válida.");
    validIdempotencyKey(input.idempotencyKey);
    const person = await this.credentialPerson(device, provider, externalTemplateId);
    if (!person) {
      await this.provider.batch([audit(device.organizationId, "device", device.deviceId, "attendance.unknown", "biometric_credential", null, "No existe una credencial biométrica activa para la referencia enviada por el dispositivo.", undefined, "denied")]);
      return { status: "unknown", eventKind: "attendance", occurredAt };
    }
    return this.captureAttendance(device, person, input, occurredAt);
  }

  async ingestSyncBatch(device: DeviceIdentity, input: { idempotencyKey: string; events: KioskCaptureInput[] }): Promise<{ batchId: string; reused: boolean; accepted: number; rejected: number; results: KioskCaptureResult[] }> {
    const batchKey = `sync:${device.deviceId}:${validIdempotencyKey(input.idempotencyKey)}`;
    if (!input.events.length || input.events.length > 250) throw new Error("Un lote offline debe contener entre 1 y 250 eventos.");
    if (input.events.some((event) => event.eventKind !== "attendance")) throw new Error("Los lotes E.2 solo aceptan eventos de asistencia. Comensales está diferido por decisión de producto.");
    const repeated = await this.provider.first<{ id: string; acceptedCount: number; rejectedCount: number }>("SELECT id, accepted_count AS acceptedCount, rejected_count AS rejectedCount FROM operational_sync_batches WHERE organization_id = ? AND idempotency_key = ?", [device.organizationId, batchKey]);
    if (repeated) return { batchId: repeated.id, reused: true, accepted: Number(repeated.acceptedCount), rejected: Number(repeated.rejectedCount), results: [] };
    const batchId = crypto.randomUUID();
    const startedAt = nowIso();
    await this.provider.batch([
      { sql: `INSERT INTO operational_sync_batches (id, organization_id, branch_id, device_id, idempotency_key, status, event_count, accepted_count, rejected_count, attempt_count, started_at, last_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'processing', ?, 0, 0, 1, ?, ?, ?, ?)`, values: [batchId, device.organizationId, device.branchId, device.deviceId, batchKey, input.events.length, startedAt, startedAt, startedAt, startedAt] },
      audit(device.organizationId, "device", device.deviceId, "sync.batch.started", "operational_sync_batch", batchId, "El dispositivo inició un lote de sincronización offline.", { eventCount: input.events.length }),
      invalidateDashboard(device.organizationId),
    ]);
    const results: KioskCaptureResult[] = [];
    let accepted = 0;
    let rejected = 0;
    let lastError: string | null = null;
    for (const event of input.events) {
      const offlineEventId = event.offlineEventId?.trim();
      if (!offlineEventId || offlineEventId.length > 160) {
        rejected += 1;
        lastError = "Un evento del lote no tiene offlineEventId válido.";
        await this.provider.run(`INSERT OR IGNORE INTO operational_sync_items (id, batch_id, entity_type, offline_event_id, idempotency_key, status, error_code, error_message, attempt_count, last_attempt_at) VALUES (?, ?, ?, ?, ?, 'rejected', 'invalid_offline_event_id', ?, 1, ?)`, [crypto.randomUUID(), batchId, event.eventKind, offlineEventId || `missing-${crypto.randomUUID()}`, event.idempotencyKey, lastError, nowIso()]);
        continue;
      }
      try {
        const result = await this.captureFromDevice(device, { ...event, offlineEventId });
        results.push(result);
        accepted += 1;
        await this.provider.run(`INSERT OR IGNORE INTO operational_sync_items (id, batch_id, entity_type, offline_event_id, idempotency_key, status, server_entity_id, attempt_count, last_attempt_at) VALUES (?, ?, ?, ?, ?, 'synced', ?, 1, ?)`, [crypto.randomUUID(), batchId, event.eventKind, offlineEventId, event.idempotencyKey, "eventId" in result ? result.eventId : null, nowIso()]);
      } catch (error) {
        rejected += 1;
        lastError = error instanceof Error ? error.message.slice(0, 500) : "Error de sincronización.";
        await this.provider.run(`INSERT OR IGNORE INTO operational_sync_items (id, batch_id, entity_type, offline_event_id, idempotency_key, status, error_code, error_message, attempt_count, last_attempt_at) VALUES (?, ?, ?, ?, ?, 'failed', 'capture_failed', ?, 1, ?)`, [crypto.randomUUID(), batchId, event.eventKind, offlineEventId, event.idempotencyKey, lastError, nowIso()]);
      }
    }
    const completedAt = nowIso();
    const status = rejected > 0 ? "failed" : "synced";
    await this.provider.batch([
      { sql: `UPDATE operational_sync_batches SET status = ?, accepted_count = ?, rejected_count = ?, last_error = ?, completed_at = ?, last_attempt_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`, values: [status, accepted, rejected, lastError, completedAt, completedAt, completedAt, batchId, device.organizationId] },
      { sql: `UPDATE tenant_devices SET last_sync_at = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`, values: [completedAt, completedAt, completedAt, device.deviceId] },
      audit(device.organizationId, "device", device.deviceId, "sync.batch.completed", "operational_sync_batch", batchId, rejected ? "El lote terminó con eventos rechazados." : "El lote terminó sin eventos rechazados.", { accepted, rejected, status }, rejected ? "partial" : "success"),
      invalidateDashboard(device.organizationId),
    ]);
    return { batchId, reused: false, accepted, rejected, results };
  }
}
