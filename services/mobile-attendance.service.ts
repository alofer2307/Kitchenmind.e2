import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { requirePlatformDatabase, type D1DatabaseLike } from "@/db/runtime";
import { attendanceLatenessMinutes, decideOperationalAttendance, localOperationalDate, operationalDateForShift, shiftAppliesOnOperationalDate, shiftConfig } from "@/rules/operations.rules";
import type { KitchenMindUser } from "@/services/auth-session.service";

const db = (): D1DatabaseLike => requirePlatformDatabase();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const email = (value: string) => value.trim().toLowerCase();
const now = () => new Date().toISOString();

export class MobileAttendanceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function first<T>(sql: string, ...args: unknown[]): Promise<T | null> {
  return db().prepare(sql).bind(...args).first<T>();
}
async function all<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  const result = await db().prepare(sql).bind(...args).all<T>();
  if (!result.success) throw new Error(result.error ?? "Error de base de datos.");
  return result.results;
}
async function run(sql: string, ...args: unknown[]): Promise<number> {
  const result = await db().prepare(sql).bind(...args).run();
  if (!result.success) throw new Error(result.error ?? "Error de base de datos.");
  return Number(result.meta?.changes ?? 0);
}

type Branch = { id: string; organizationId: string; name: string; timezone: string; status: string };
type Policy = { latitude: number; longitude: number; radiusMeters: number; maxAccuracyMeters: number; enabled: number };
type Account = { employeeId: string; organizationId: string; branchId: string; employeeName: string; employeeNumber: string; employeeEmail: string | null; branchName: string; timezone: string; employeeStatus: string; organizationStatus: string; accountEmail: string; policyEnabled: number | null; radiusMeters: number | null };

async function adminBranch(identity: KitchenMindUser, organizationId: string, branchId: string): Promise<{ membershipId: string; branch: Branch }> {
  const branch = await first<Branch>("SELECT id, organization_id AS organizationId, name, timezone, status FROM tenant_branches WHERE id = ? AND organization_id = ?", branchId, organizationId);
  if (!branch || branch.status !== "active") throw new MobileAttendanceError("La sucursal no está activa.", 404);
  const member = await first<{ id: string }>(`SELECT m.id FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id
    JOIN membership_role_assignments mra ON mra.membership_id = m.id JOIN organization_role_permissions rp ON rp.role_id = mra.role_id
    JOIN organization_permissions p ON p.id = rp.permission_id
    WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active'
      AND m.organization_id = ? AND p.code = 'personnel.attendance.adjust'
      AND EXISTS (SELECT 1 FROM membership_scopes s WHERE s.membership_id = m.id AND s.access_mode IN ('write','manage')
        AND ((s.scope_type = 'organization' AND (s.scope_id IS NULL OR s.scope_id = ?)) OR (s.scope_type = 'branch' AND s.scope_id = ?))) LIMIT 1`, identity.id, email(identity.email), organizationId, organizationId, branchId);
  if (!member) throw new MobileAttendanceError("No tienes permiso para configurar el checado de esta sucursal.", 403);
  return { membershipId: member.id, branch };
}

export async function policyForAdmin(identity: KitchenMindUser, organizationId: string, branchId: string) {
  await adminBranch(identity, organizationId, branchId);
  return first<Policy>("SELECT latitude, longitude, radius_meters AS radiusMeters, max_accuracy_meters AS maxAccuracyMeters, enabled FROM mobile_attendance_policies WHERE organization_id = ? AND branch_id = ?", organizationId, branchId);
}

export async function mobileEmployeesForAdmin(identity: KitchenMindUser, organizationId: string, branchId: string, search: string) {
  await adminBranch(identity, organizationId, branchId);
  const like = `%${search.trim().slice(0, 80).replace(/[\\%_]/g, "\\$&")}%`;
  return all<{ id: string; name: string; employeeNumber: string; email: string | null; accountStatus: string | null }>(`SELECT e.id, e.name, e.employee_number AS employeeNumber, e.email, a.status AS accountStatus
    FROM tenant_employees e LEFT JOIN mobile_attendance_accounts a ON a.employee_id = e.id
    WHERE e.organization_id = ? AND e.branch_id = ? AND e.status = 'active'
      AND (e.name LIKE ? ESCAPE '\\' OR e.employee_number LIKE ? ESCAPE '\\' OR COALESCE(e.email,'') LIKE ? ESCAPE '\\')
    ORDER BY e.name LIMIT 30`, organizationId, branchId, like, like, like);
}

export async function configureMobilePolicy(identity: KitchenMindUser, input: { organizationId: string; branchId: string; latitude: number; longitude: number; radiusMeters: number; maxAccuracyMeters: number; enabled: boolean }) {
  const { membershipId } = await adminBranch(identity, input.organizationId, input.branchId);
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180 ||
      !Number.isInteger(input.radiusMeters) || input.radiusMeters < 75 || input.radiusMeters > 1000 ||
      !Number.isInteger(input.maxAccuracyMeters) || input.maxAccuracyMeters < 10 || input.maxAccuracyMeters > 200 ||
      typeof input.enabled !== "boolean") throw new MobileAttendanceError("Revisa la ubicación, el radio y la precisión permitida.");
  await run(`INSERT INTO mobile_attendance_policies (branch_id, organization_id, latitude, longitude, radius_meters, max_accuracy_meters, enabled, updated_by_membership_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(branch_id) DO UPDATE SET latitude=excluded.latitude, longitude=excluded.longitude,
    radius_meters=excluded.radius_meters, max_accuracy_meters=excluded.max_accuracy_meters, enabled=excluded.enabled,
    updated_by_membership_id=excluded.updated_by_membership_id, updated_at=excluded.updated_at`, input.branchId, input.organizationId,
    input.latitude, input.longitude, input.radiusMeters, input.maxAccuracyMeters, input.enabled ? 1 : 0, membershipId, now());
  return { saved: true };
}

export async function inviteMobileEmployee(identity: KitchenMindUser, input: { organizationId: string; branchId: string; employeeId: string }) {
  const { membershipId } = await adminBranch(identity, input.organizationId, input.branchId);
  const employee = await first<{ id: string; email: string | null; status: string }>("SELECT id, email, status FROM tenant_employees WHERE id = ? AND organization_id = ? AND branch_id = ?", input.employeeId, input.organizationId, input.branchId);
  if (!employee || employee.status !== "active" || !employee.email) throw new MobileAttendanceError("El empleado debe estar activo y tener un correo registrado.");
  const duplicate = await first<{ count: number }>("SELECT COUNT(*) AS count FROM tenant_employees WHERE organization_id = ? AND lower(email) = ? AND status = 'active'", input.organizationId, email(employee.email));
  if (Number(duplicate?.count) !== 1) throw new MobileAttendanceError("El correo debe pertenecer a un único empleado activo de la empresa.");
  const linked = await first<{ status: string }>("SELECT status FROM mobile_attendance_accounts WHERE employee_id = ?", employee.id);
  if (linked?.status === "active") throw new MobileAttendanceError("Este empleado ya tiene acceso móvil.");
  const token = randomBytes(32).toString("base64url");
  const timestamp = now();
  await run("UPDATE mobile_attendance_enrollments SET used_at = ? WHERE employee_id = ? AND used_at IS NULL", timestamp, employee.id);
  await run(`INSERT INTO mobile_attendance_enrollments (id, organization_id, employee_id, email_normalized, token_hash, expires_at, created_by_membership_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, randomUUID(), input.organizationId, employee.id, email(employee.email), hash(token), new Date(Date.now() + 7 * 86400000).toISOString(), membershipId, timestamp);
  return { invitationPath: `/checar/activar?token=${encodeURIComponent(token)}`, employeeEmail: email(employee.email) };
}

export async function revokeMobileEmployee(identity: KitchenMindUser, input: { organizationId: string; branchId: string; employeeId: string }) {
  await adminBranch(identity, input.organizationId, input.branchId);
  const employee = await first<{ id: string }>("SELECT id FROM tenant_employees WHERE id = ? AND organization_id = ? AND branch_id = ?", input.employeeId, input.organizationId, input.branchId);
  if (!employee) throw new MobileAttendanceError("El empleado no pertenece a esta sucursal.", 404);
  const timestamp = now();
  await run("UPDATE mobile_attendance_accounts SET status = 'revoked', revoked_at = ? WHERE organization_id = ? AND employee_id = ? AND status = 'active'", timestamp, input.organizationId, input.employeeId);
  await run("UPDATE mobile_attendance_enrollments SET used_at = ? WHERE organization_id = ? AND employee_id = ? AND used_at IS NULL", timestamp, input.organizationId, input.employeeId);
  return { revoked: true };
}

export async function enrollment(token: string) {
  if (token.length < 40 || token.length > 200) throw new MobileAttendanceError("El enlace no es válido.", 404);
  const row = await first<{ email: string; employeeName: string; expiresAt: string; usedAt: string | null; status: string }>(`SELECT i.email_normalized AS email, e.name AS employeeName, i.expires_at AS expiresAt, i.used_at AS usedAt, e.status
    FROM mobile_attendance_enrollments i JOIN tenant_employees e ON e.id = i.employee_id AND e.organization_id = i.organization_id WHERE i.token_hash = ?`, hash(token));
  if (!row || row.usedAt || row.expiresAt < now() || row.status !== "active") throw new MobileAttendanceError("El enlace venció o ya fue utilizado.", 404);
  return { email: row.email, employeeName: row.employeeName };
}

export async function acceptMobileEnrollment(token: string, identity: KitchenMindUser) {
  const preview = await enrollment(token);
  if (preview.email !== email(identity.email)) throw new MobileAttendanceError("Inicia sesión con el correo al que se dirigió la invitación.", 403);
  const row = await first<{ id: string; organizationId: string; employeeId: string; employeeEmail: string | null; employeeStatus: string }>(`SELECT i.id, i.organization_id AS organizationId, i.employee_id AS employeeId, e.email AS employeeEmail, e.status AS employeeStatus
    FROM mobile_attendance_enrollments i JOIN tenant_employees e ON e.id = i.employee_id AND e.organization_id = i.organization_id WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?`, hash(token), now());
  if (!row || row.employeeStatus !== "active" || email(row.employeeEmail ?? "") !== preview.email) throw new MobileAttendanceError("El empleado ya no está autorizado.", 403);
  const timestamp = now();
  const changed = await run("UPDATE mobile_attendance_enrollments SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?", timestamp, row.id, timestamp);
  if (!changed) throw new MobileAttendanceError("El enlace ya fue utilizado.", 409);
  try {
    await run(`INSERT INTO mobile_attendance_accounts (employee_id, organization_id, auth_user_id, email_normalized, status, enrolled_at)
      VALUES (?, ?, ?, ?, 'active', ?) ON CONFLICT(employee_id) DO UPDATE SET auth_user_id=excluded.auth_user_id,
      email_normalized=excluded.email_normalized, status='active', enrolled_at=excluded.enrolled_at, revoked_at=NULL`, row.employeeId, row.organizationId, identity.id, preview.email, timestamp);
  } catch (error) {
    await run("UPDATE mobile_attendance_enrollments SET used_at = NULL WHERE id = ? AND used_at = ?", row.id, timestamp);
    throw error;
  }
  return { employeeId: row.employeeId };
}

async function accountsFor(identity: KitchenMindUser): Promise<Account[]> {
  return all<Account>(`SELECT a.employee_id AS employeeId, a.organization_id AS organizationId, e.branch_id AS branchId, e.name AS employeeName,
      e.employee_number AS employeeNumber, e.email AS employeeEmail, b.name AS branchName, b.timezone, e.status AS employeeStatus,
      o.status AS organizationStatus, a.email_normalized AS accountEmail, p.enabled AS policyEnabled, p.radius_meters AS radiusMeters
    FROM mobile_attendance_accounts a JOIN tenant_employees e ON e.id = a.employee_id AND e.organization_id = a.organization_id
      JOIN tenant_branches b ON b.id = e.branch_id AND b.organization_id = e.organization_id AND b.status = 'active'
      JOIN tenant_organizations o ON o.id = a.organization_id AND o.deleted_at IS NULL
      LEFT JOIN mobile_attendance_policies p ON p.branch_id = b.id AND p.organization_id = o.id
    WHERE a.auth_user_id = ? AND a.email_normalized = ? AND a.status = 'active' AND e.status = 'active' AND lower(e.email) = ?
      AND o.status = 'active' AND EXISTS (SELECT 1 FROM organization_entitlements ent WHERE ent.organization_id = a.organization_id
      AND ent.module_code = 'PERSONNEL' AND ent.enabled = 1 AND ent.status = 'active' AND ent.effective_from <= ? AND (ent.effective_until IS NULL OR ent.effective_until > ?))`, identity.id, email(identity.email), email(identity.email), now(), now());
}

export async function mobileAttendanceHome(identity: KitchenMindUser) {
  const accounts = await accountsFor(identity);
  const summaries = await Promise.all(accounts.map(async (account) => {
    const events = await all<{ id: string; eventType: string; occurredAt: string; operationalDate: string; lateMinutes: number | null }>(`SELECT id, COALESCE(adjusted_event_type,event_type) AS eventType, event_timestamp AS occurredAt, operational_date AS operationalDate, late_minutes AS lateMinutes
      FROM operational_attendance_events WHERE organization_id = ? AND employee_id = ? ORDER BY event_timestamp DESC LIMIT 10`, account.organizationId, account.employeeId);
    return { employeeId: account.employeeId, organizationId: account.organizationId, employeeName: account.employeeName, employeeNumber: account.employeeNumber,
      branchName: account.branchName, enabled: account.policyEnabled === 1, events };
  }));
  return summaries;
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const x = (bLat - aLat) * rad;
  const y = (bLon - aLon) * rad;
  const v = Math.sin(x / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(y / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}

export async function registerMobileAttendance(identity: KitchenMindUser, input: { employeeId: string; action: "entry" | "exit"; latitude: number; longitude: number; accuracy: number; capturedAt: string; idempotencyKey: string }) {
  if (!input || !["entry", "exit"].includes(input.action) || !/^[0-9a-f-]{36}$/i.test(input.employeeId) || !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) throw new MobileAttendanceError("Solicitud inválida.");
  const captured = new Date(input.capturedAt).getTime();
  if (!Number.isFinite(captured) || Math.abs(Date.now() - captured) > 90000 || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180 || !Number.isFinite(input.accuracy) || input.accuracy < 0) throw new MobileAttendanceError("Actualiza tu ubicación e intenta de nuevo.");
  const account = (await accountsFor(identity)).find((item) => item.employeeId === input.employeeId);
  if (!account) throw new MobileAttendanceError("No hay una cuenta de empleado activa para este registro.", 403);
  const policy = await first<Policy>("SELECT latitude, longitude, radius_meters AS radiusMeters, max_accuracy_meters AS maxAccuracyMeters, enabled FROM mobile_attendance_policies WHERE organization_id = ? AND branch_id = ?", account.organizationId, account.branchId);
  if (!policy || !policy.enabled) throw new MobileAttendanceError("El checado móvil aún no está activado en tu sucursal.", 403);
  if (input.accuracy > policy.maxAccuracyMeters) throw new MobileAttendanceError("La ubicación no tiene suficiente precisión. Acércate a una ventana o solicita apoyo a supervisión.", 422);
  const distance = distanceMeters(input.latitude, input.longitude, Number(policy.latitude), Number(policy.longitude));
  if (distance + input.accuracy > policy.radiusMeters) throw new MobileAttendanceError("No se pudo confirmar que estás dentro de la sucursal. Solicita apoyo a supervisión.", 403);
  const timestamp = now();
  const key = `mobile:${account.employeeId}:${input.idempotencyKey}`;
  const previousKey = await first<{ id: string; eventType: string; occurredAt: string }>("SELECT id, event_type AS eventType, event_timestamp AS occurredAt FROM operational_attendance_events WHERE organization_id = ? AND idempotency_key = ?", account.organizationId, key);
  if (previousKey) return { eventId: previousKey.id, eventType: previousKey.eventType, occurredAt: previousKey.occurredAt, duplicate: true };
  const localDate = localOperationalDate(timestamp, account.timezone);
  const candidates = await all<{ id: string; metadataJson: string }>(`SELECT s.id, s.metadata_json AS metadataJson FROM employee_shift_assignments esa JOIN tenant_shifts s ON s.id = esa.shift_id AND s.status = 'active'
    WHERE esa.organization_id = ? AND esa.employee_id = ? AND esa.starts_on <= ? AND (esa.ends_on IS NULL OR esa.ends_on >= ?)
    ORDER BY esa.starts_on DESC LIMIT 10`, account.organizationId, account.employeeId, localDate, new Date(Date.parse(localDate + "T12:00:00Z") - 86400000).toISOString().slice(0, 10));
  let shift: { id: string; metadataJson: string } | null = null;
  for (const candidate of candidates) {
    const day = operationalDateForShift(timestamp, account.timezone, shiftConfig(candidate.metadataJson));
    const assignment = await first<{ ok: number }>("SELECT 1 AS ok FROM employee_shift_assignments WHERE organization_id = ? AND employee_id = ? AND shift_id = ? AND starts_on <= ? AND (ends_on IS NULL OR ends_on >= ?) LIMIT 1", account.organizationId, account.employeeId, candidate.id, day, day);
    if (assignment && shiftAppliesOnOperationalDate(day, account.timezone, shiftConfig(candidate.metadataJson))) { shift = candidate; break; }
  }
  const config = shift ? shiftConfig(shift.metadataJson) : null;
  const recent = await all<{ id: string; eventType: string; eventTimestamp: string; operationalDate: string }>(`SELECT id, COALESCE(adjusted_event_type,event_type) AS eventType, event_timestamp AS eventTimestamp, operational_date AS operationalDate
    FROM operational_attendance_events WHERE organization_id = ? AND employee_id = ? AND event_timestamp >= ? AND event_timestamp <= ? ORDER BY event_timestamp DESC LIMIT 20`, account.organizationId, account.employeeId, new Date(Date.now() - 36 * 3600000).toISOString(), timestamp);
  const decision = decideOperationalAttendance(recent, timestamp, account.timezone, config);
  if (decision.kind === "duplicate") throw new MobileAttendanceError("Ya registraste asistencia hace un momento.", 409);
  if ((decision.eventType === "exit" ? "exit" : "entry") !== input.action) throw new MobileAttendanceError(input.action === "entry" ? "Ya tienes una entrada abierta. Registra tu salida." : "Primero debes registrar tu entrada.", 409);
  const person = await first<{ id: string }>("SELECT id FROM tenant_people WHERE organization_id = ? AND employee_id = ? AND status = 'active' LIMIT 1", account.organizationId, account.employeeId);
  const eventId = randomUUID();
  const threshold = new Date(Date.now() - 90000).toISOString();
  const result = await db().batch([
    db().prepare(`INSERT INTO operational_attendance_events (id, organization_id, branch_id, person_id, employee_id, shift_id, event_type, late_minutes, event_timestamp, operational_date, source, idempotency_key, synchronization_status, server_received_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mobile', ?, 'synced', ?
      WHERE NOT EXISTS (SELECT 1 FROM operational_attendance_events x WHERE x.organization_id = ? AND x.employee_id = ? AND x.event_timestamp >= ? AND x.event_timestamp <= ? AND COALESCE(x.adjusted_event_type,x.event_type) IN ('entry','late','exit','incident'))`)
      .bind(eventId, account.organizationId, account.branchId, person?.id ?? null, account.employeeId, shift?.id ?? null, decision.eventType,
        decision.eventType === "late" ? attendanceLatenessMinutes(timestamp, account.timezone, config) : null, timestamp, decision.operationalDate, key, timestamp,
        account.organizationId, account.employeeId, threshold, timestamp),
    db().prepare(`INSERT INTO mobile_attendance_evidence (event_id, distance_meters, accuracy_meters, location_checked_at, policy_radius_meters)
      SELECT ?, ?, ?, ?, ? FROM operational_attendance_events WHERE id = ?`).bind(eventId, Math.round(distance), Math.round(input.accuracy), timestamp, policy.radiusMeters, eventId),
    db().prepare(`INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at)
      SELECT ?, ?, 'employee', ?, ?, 'operational_attendance_event', ?, 'success', 'Registro móvil con ubicación validada.', ?, ?
      FROM operational_attendance_events WHERE id = ?`).bind(randomUUID(), account.organizationId, identity.id, `attendance.${decision.eventType}`, eventId,
        JSON.stringify({ employeeId: account.employeeId, branchId: account.branchId, distanceMeters: Math.round(distance), accuracyMeters: Math.round(input.accuracy) }), timestamp, eventId),
    db().prepare("DELETE FROM dashboard_cache_entries WHERE organization_id = ?").bind(account.organizationId),
  ]);
  const failure = result.find((item) => !item.success);
  if (failure) throw new Error(failure.error ?? "No se pudo guardar la asistencia.");
  if (!result[0]?.meta?.changes) throw new MobileAttendanceError("Ya registraste asistencia hace un momento.", 409);
  return { eventId, eventType: decision.eventType, occurredAt: timestamp, duplicate: false };
}
