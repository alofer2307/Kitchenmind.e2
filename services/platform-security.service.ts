import "server-only";
import type { KitchenMindUser } from "@/services/auth-session.service";
import { requirePlatformDatabase, requirePlatformMfaKey, requirePlatformOwnerEmail, type D1DatabaseLike, type D1PreparedStatementLike } from "@/db/runtime";
import {
  createAuthenticatorUri,
  generateRecoveryCodes,
  generateSessionToken,
  generateTotpSecret,
  normalizeRecoveryCode,
  openSealedText,
  sealText,
  sha256,
  verifyTotp,
} from "@/lib/platform-mfa";
import type { PlatformIdentitySummary, PlatformSecurityEventSummary, PlatformSecuritySnapshot } from "@/types";

export const PLATFORM_SESSION_COOKIE = "__Host-kitchenmind_platform";
export const PLATFORM_SESSION_SECONDS = 8 * 60 * 60;

const OWNER_ROLE_ID = "platform-role-owner";
const MAX_FAILED_ATTEMPTS = 5;
const FAILURE_WINDOW_MINUTES = 15;

export const PLATFORM_PERMISSIONS = [
  { id: "platform-permission-access", code: "platform.access", description: "Entrar a KitchenMind Platform." },
  { id: "platform-permission-security", code: "platform.security.manage", description: "Administrar MFA, recuperación y sesiones." },
  { id: "platform-permission-audit", code: "platform.audit.read", description: "Consultar auditoría interna." },
  { id: "platform-permission-organizations", code: "platform.organizations.manage", description: "Administrar organizaciones cliente." },
  { id: "platform-permission-billing", code: "platform.billing.manage", description: "Administrar planes, cotizaciones y cobros." },
  { id: "platform-permission-support", code: "platform.support.manage", description: "Administrar accesos de soporte auditados." },
  { id: "platform-permission-prospects-read", code: "platform.prospects.read", description: "Consultar prospectos y oportunidades." },
  { id: "platform-permission-prospects-create", code: "platform.prospects.create", description: "Registrar prospectos." },
  { id: "platform-permission-prospects-update", code: "platform.prospects.update", description: "Actualizar oportunidades y seguimientos." },
  { id: "platform-permission-prospects-archive", code: "platform.prospects.archive", description: "Archivar prospectos sin eliminarlos." },
  { id: "platform-permission-diagnoses-read", code: "platform.diagnoses.read", description: "Consultar diagnósticos comerciales." },
  { id: "platform-permission-diagnoses-manage", code: "platform.diagnoses.manage", description: "Crear y versionar diagnósticos." },
  { id: "platform-permission-catalog-read", code: "platform.catalog.read", description: "Consultar módulos y características comerciales." },
  { id: "platform-permission-catalog-manage", code: "platform.catalog.manage", description: "Administrar el catálogo comercial." },
  { id: "platform-permission-pricing-read", code: "platform.pricing.read", description: "Consultar catálogos de precios." },
  { id: "platform-permission-pricing-manage", code: "platform.pricing.manage", description: "Crear y publicar versiones de precios." },
  { id: "platform-permission-quotes-read", code: "platform.quotes.read", description: "Consultar cotizaciones." },
  { id: "platform-permission-quotes-create", code: "platform.quotes.create", description: "Crear cotizaciones." },
  { id: "platform-permission-quotes-update", code: "platform.quotes.update", description: "Crear revisiones de cotizaciones." },
  { id: "platform-permission-quotes-send", code: "platform.quotes.send", description: "Registrar el envío de cotizaciones." },
  { id: "platform-permission-quotes-accept", code: "platform.quotes.accept", description: "Registrar aceptación o rechazo de cotizaciones." },
  { id: "platform-permission-quotes-cancel", code: "platform.quotes.cancel", description: "Cancelar cotizaciones." },
  { id: "platform-permission-quotes-discount", code: "platform.quotes.discount", description: "Autorizar descuentos con motivo." },
  { id: "platform-permission-commercial-audit", code: "platform.commercial_audit.read", description: "Consultar auditoría comercial." },
  { id: "platform-permission-organizations-read", code: "platform.organizations.read", description: "Consultar organizaciones y aprovisionamientos." },
  { id: "platform-permission-organizations-provision", code: "platform.organizations.provision", description: "Aprovisionar organizaciones desde cotizaciones aceptadas." },
  { id: "platform-permission-organizations-configure", code: "platform.organizations.configure", description: "Corregir configuración no comercial de organizaciones." },
  { id: "platform-permission-organizations-activate", code: "platform.organizations.activate", description: "Revisar y activar organizaciones." },
  { id: "platform-permission-organizations-suspend", code: "platform.organizations.suspend", description: "Restringir o suspender organizaciones con motivo." },
  { id: "platform-permission-onboarding-read", code: "platform.onboarding.read", description: "Consultar el avance del onboarding de clientes." },
  { id: "platform-permission-onboarding-manage", code: "platform.onboarding.manage", description: "Gestionar bloqueos y tareas de onboarding." },
  { id: "platform-permission-invitations-create", code: "platform.invitations.create", description: "Emitir y reemplazar invitaciones de administradores." },
  { id: "platform-permission-invitations-revoke", code: "platform.invitations.revoke", description: "Revocar invitaciones de organizaciones." },
  { id: "platform-permission-entitlements-read", code: "platform.entitlements.read", description: "Consultar módulos y límites contratados." },
  { id: "platform-permission-entitlements-override", code: "platform.entitlements.override", description: "Aplicar excepciones temporales y auditadas." },
  { id: "platform-permission-imports-read", code: "platform.imports.read", description: "Consultar importaciones iniciales." },
  { id: "platform-permission-provisioning-retry", code: "platform.provisioning.retry", description: "Reintentar aprovisionamientos fallidos." },
  { id: "platform-permission-customer-access-audit", code: "platform.customer_access.audit.read", description: "Consultar auditoría de acceso de clientes." },
  { id: "platform-permission-dashboard-catalog-read", code: "platform.dashboard_catalog.read", description: "Consultar catálogo, presets y fuentes del tablero operativo." },
  { id: "platform-permission-dashboard-catalog-manage", code: "platform.dashboard_catalog.manage", description: "Administrar widgets y overrides auditados del tablero." },
] as const;

export type PlatformPermissionCode = (typeof PLATFORM_PERMISSIONS)[number]["code"];

export interface PlatformUserRow {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  status: "active" | "suspended";
}

interface MfaCredentialRow {
  id: string;
  encryptedSecret: string;
  verifiedAt: string;
}

interface PlatformSessionRow {
  id: string;
  expiresAt: string;
}

interface EnrollmentPayload {
  version: 1;
  authUserId: string;
  platformUserId: string;
  secret: string;
  expiresAt: string;
}

export type PlatformGateResult =
  | { kind: "unauthenticated" }
  | { kind: "unauthorized" }
  | { kind: "enroll"; identity: PlatformIdentitySummary }
  | { kind: "challenge"; identity: PlatformIdentitySummary }
  | { kind: "granted"; identity: PlatformIdentitySummary; security: PlatformSecuritySnapshot };

export class PlatformSecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "PlatformSecurityError";
  }
}

function identitySummary(identity: KitchenMindUser): PlatformIdentitySummary {
  return { displayName: identity.displayName, email: identity.email };
}

function nowIso(): string {
  return new Date().toISOString();
}

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1_000).toISOString();
}

function assertBatch(results: { success: boolean; error?: string }[]): void {
  const failed = results.find((result) => !result.success);
  if (failed) throw new Error(failed.error ?? "No fue posible guardar la operación de seguridad.");
}

async function run(statement: D1PreparedStatementLike): Promise<void> {
  const result = await statement.run();
  if (!result.success) throw new Error(result.error ?? "No fue posible guardar la operación de seguridad.");
}

function auditStatement(
  database: D1DatabaseLike,
  input: {
    platformUserId?: string;
    authUserId?: string;
    action: string;
    entity: string;
    entityId?: string;
    outcome: "success" | "denied" | "failed";
    reason?: string;
    metadata?: Record<string, string | number | boolean>;
    createdAt?: string;
  },
): D1PreparedStatementLike {
  return database.prepare(
    `INSERT INTO platform_audit_events
      (id, platform_user_id, auth_user_id, action, entity, entity_id, outcome, reason, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    input.platformUserId ?? null,
    input.authUserId ?? null,
    input.action,
    input.entity,
    input.entityId ?? null,
    input.outcome,
    input.reason ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.createdAt ?? nowIso(),
  );
}

async function recordAudit(
  database: D1DatabaseLike,
  input: Parameters<typeof auditStatement>[1],
): Promise<void> {
  await run(auditStatement(database, input));
}

export async function recordPlatformAudit(input: Parameters<typeof auditStatement>[1]): Promise<void> {
  await recordAudit(requirePlatformDatabase(), input);
}

async function ensureOwnerAuthorization(database: D1DatabaseLike, platformUserId?: string): Promise<void> {
  if (platformUserId) {
    const granted = await database.prepare(
      `SELECT COUNT(*) AS count
         FROM platform_user_roles ur
         JOIN platform_role_permissions rp ON rp.role_id = ur.role_id
         JOIN platform_permissions p ON p.id = rp.permission_id
        WHERE ur.platform_user_id = ? AND ur.role_id = ?`,
    ).bind(platformUserId, OWNER_ROLE_ID).first<{ count: number }>();
    if ((granted?.count ?? 0) >= PLATFORM_PERMISSIONS.length) return;
  }
  const timestamp = nowIso();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(
      `INSERT OR IGNORE INTO platform_roles (id, code, name, description, status, created_at, updated_at)
       VALUES (?, 'platform_owner', 'Platform Owner', 'Control total de KitchenMind Platform.', 'active', ?, ?)`,
    ).bind(OWNER_ROLE_ID, timestamp, timestamp),
    ...PLATFORM_PERMISSIONS.map((permission) => database.prepare(
      `INSERT OR IGNORE INTO platform_permissions (id, code, description, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(permission.id, permission.code, permission.description, timestamp)),
    ...PLATFORM_PERMISSIONS.map((permission) => database.prepare(
      `INSERT OR IGNORE INTO platform_role_permissions (role_id, permission_id, created_at) VALUES (?, ?, ?)`,
    ).bind(OWNER_ROLE_ID, permission.id, timestamp)),
  ];
  if (platformUserId) {
    statements.push(database.prepare(
      `INSERT OR IGNORE INTO platform_user_roles (platform_user_id, role_id, created_at) VALUES (?, ?, ?)`,
    ).bind(platformUserId, OWNER_ROLE_ID, timestamp));
  }
  assertBatch(await database.batch(statements));
}

async function initializePlatformOwner(database: D1DatabaseLike, identity: KitchenMindUser): Promise<PlatformUserRow | null> {
  const existing = await database.prepare(
    `SELECT id, auth_user_id AS authUserId, email, display_name AS displayName, status
       FROM platform_users WHERE auth_user_id = ? LIMIT 1`,
  ).bind(identity.id).first<PlatformUserRow>();

  if (existing) {
    if (existing.status !== "active") return null;
    await ensureOwnerAuthorization(database, existing.id);
    await run(database.prepare(
      `UPDATE platform_users SET email = ?, display_name = ?, updated_at = ?, last_access_at = ? WHERE id = ?`,
    ).bind(identity.email.trim().toLowerCase(), identity.displayName, nowIso(), nowIso(), existing.id));
    return { ...existing, email: identity.email.trim().toLowerCase(), displayName: identity.displayName };
  }

  const countRow = await database.prepare("SELECT COUNT(*) AS count FROM platform_users").first<{ count: number }>();
  if ((countRow?.count ?? 0) > 0) {
    await recordAudit(database, {
      authUserId: identity.id,
      action: "platform.access.denied",
      entity: "platform",
      outcome: "denied",
      reason: "La identidad no pertenece al equipo autorizado de KitchenMind.",
    });
    return null;
  }

  const expectedEmail = requirePlatformOwnerEmail();
  const normalizedEmail = identity.email.trim().toLowerCase();
  if (normalizedEmail !== expectedEmail) {
    await recordAudit(database, {
      authUserId: identity.id,
      action: "platform.bootstrap.denied",
      entity: "platform_user",
      outcome: "denied",
      reason: "La identidad no coincide con la propietaria configurada para el bootstrap.",
    });
    return null;
  }

  const platformUserId = `platform-user-${(await sha256(identity.id)).slice(0, 24)}`;
  const timestamp = nowIso();
  await ensureOwnerAuthorization(database);
  const statements: D1PreparedStatementLike[] = [
    database.prepare(
      `INSERT INTO platform_users
        (id, auth_user_id, email, display_name, status, created_at, updated_at, last_access_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).bind(platformUserId, identity.id, normalizedEmail, identity.displayName, timestamp, timestamp, timestamp),
    database.prepare(
      `INSERT INTO platform_user_roles (platform_user_id, role_id, created_at) VALUES (?, ?, ?)`,
    ).bind(platformUserId, OWNER_ROLE_ID, timestamp),
    auditStatement(database, {
      platformUserId,
      authUserId: identity.id,
      action: "platform.owner.bootstrapped",
      entity: "platform_user",
      entityId: platformUserId,
      outcome: "success",
      reason: "Alta inicial segura de la propietaria de KitchenMind.",
      createdAt: timestamp,
    }),
  ];
  assertBatch(await database.batch(statements));
  return { id: platformUserId, authUserId: identity.id, email: normalizedEmail, displayName: identity.displayName, status: "active" };
}

async function hasPlatformPermission(
  database: D1DatabaseLike,
  platformUserId: string,
  permission: PlatformPermissionCode,
): Promise<boolean> {
  const row = await database.prepare(
    `SELECT 1 AS allowed
       FROM platform_user_roles ur
       JOIN platform_roles r ON r.id = ur.role_id AND r.status = 'active'
       JOIN platform_role_permissions rp ON rp.role_id = r.id
       JOIN platform_permissions p ON p.id = rp.permission_id
      WHERE ur.platform_user_id = ? AND p.code = ?
      LIMIT 1`,
  ).bind(platformUserId, permission).first<{ allowed: number }>();
  return row?.allowed === 1;
}

export async function platformUserHasPermission(
  platformUserId: string,
  permission: PlatformPermissionCode,
): Promise<boolean> {
  return hasPlatformPermission(requirePlatformDatabase(), platformUserId, permission);
}

export async function requirePlatformUser(
  identity: KitchenMindUser,
  permission: PlatformPermissionCode = "platform.access",
): Promise<PlatformUserRow> {
  const database = requirePlatformDatabase();
  const platformUser = await initializePlatformOwner(database, identity);
  if (!platformUser) throw new PlatformSecurityError("Esta cuenta no tiene acceso a KitchenMind Platform.", 403, "platform_access_denied");
  if (!(await hasPlatformPermission(database, platformUser.id, permission))) {
    await recordAudit(database, {
      platformUserId: platformUser.id,
      authUserId: identity.id,
      action: "platform.permission.denied",
      entity: "platform_permission",
      entityId: permission,
      outcome: "denied",
      reason: "La cuenta no tiene el permiso requerido.",
    });
    throw new PlatformSecurityError("No tienes permiso para realizar esta acción.", 403, "platform_permission_denied");
  }
  return platformUser;
}

export async function requireActivePlatformSession(
  identity: KitchenMindUser,
  sessionToken: string | null,
  permission: PlatformPermissionCode = "platform.access",
): Promise<PlatformUserRow> {
  const platformUser = await requirePlatformUser(identity, permission);
  const session = await getPlatformSession(requirePlatformDatabase(), platformUser, sessionToken);
  if (!session) {
    throw new PlatformSecurityError("Verifica nuevamente tu segundo factor.", 401, "platform_session_required");
  }
  return platformUser;
}

async function getMfaCredential(database: D1DatabaseLike, platformUserId: string): Promise<MfaCredentialRow | null> {
  return database.prepare(
    `SELECT id, encrypted_secret AS encryptedSecret, verified_at AS verifiedAt
       FROM platform_mfa_credentials WHERE platform_user_id = ? LIMIT 1`,
  ).bind(platformUserId).first<MfaCredentialRow>();
}

async function getPlatformSession(
  database: D1DatabaseLike,
  platformUser: PlatformUserRow,
  sessionToken: string | null,
): Promise<PlatformSessionRow | null> {
  if (!sessionToken) return null;
  const tokenHash = await sha256(sessionToken);
  const timestamp = nowIso();
  const session = await database.prepare(
    `SELECT s.id, s.expires_at AS expiresAt
       FROM platform_sessions s
       JOIN platform_users u ON u.id = s.platform_user_id
      WHERE s.token_hash = ?
        AND s.platform_user_id = ?
        AND u.auth_user_id = ?
        AND u.status = 'active'
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
      LIMIT 1`,
  ).bind(tokenHash, platformUser.id, platformUser.authUserId, timestamp).first<PlatformSessionRow>();
  if (session) await run(database.prepare("UPDATE platform_sessions SET last_seen_at = ? WHERE id = ?").bind(timestamp, session.id));
  return session;
}

async function getSecuritySnapshot(
  database: D1DatabaseLike,
  platformUser: PlatformUserRow,
  session: PlatformSessionRow,
): Promise<PlatformSecuritySnapshot> {
  const timestamp = nowIso();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const [sessionCount, failedCount, eventsResult] = await Promise.all([
    database.prepare(
      `SELECT COUNT(*) AS count FROM platform_sessions
        WHERE platform_user_id = ? AND revoked_at IS NULL AND expires_at > ?`,
    ).bind(platformUser.id, timestamp).first<{ count: number }>(),
    database.prepare(
      `SELECT COUNT(*) AS count FROM platform_audit_events
        WHERE platform_user_id = ? AND outcome = 'failed' AND created_at >= ?`,
    ).bind(platformUser.id, since).first<{ count: number }>(),
    database.prepare(
      `SELECT id, action, outcome, reason, created_at AS createdAt
         FROM platform_audit_events
        WHERE platform_user_id = ?
        ORDER BY created_at DESC
        LIMIT 6`,
    ).bind(platformUser.id).all<PlatformSecurityEventSummary>(),
  ]);
  if (!eventsResult.success) throw new Error(eventsResult.error ?? "No fue posible consultar la auditoría de seguridad.");
  return {
    mfaEnabled: true,
    activeSessionCount: sessionCount?.count ?? 0,
    failedAttemptsLast24Hours: failedCount?.count ?? 0,
    currentSessionExpiresAt: session.expiresAt,
    recentEvents: eventsResult.results,
  };
}

export async function getPlatformGate(identity: KitchenMindUser | null, sessionToken: string | null): Promise<PlatformGateResult> {
  if (!identity) return { kind: "unauthenticated" };
  let platformUser: PlatformUserRow;
  try {
    platformUser = await requirePlatformUser(identity);
  } catch (error) {
    if (error instanceof PlatformSecurityError && error.status === 403) return { kind: "unauthorized" };
    throw error;
  }
  const database = requirePlatformDatabase();
  const credential = await getMfaCredential(database, platformUser.id);
  if (!credential) return { kind: "enroll", identity: identitySummary(identity) };
  const session = await getPlatformSession(database, platformUser, sessionToken);
  if (!session) return { kind: "challenge", identity: identitySummary(identity) };
  return {
    kind: "granted",
    identity: identitySummary(identity),
    security: await getSecuritySnapshot(database, platformUser, session),
  };
}

export async function createMfaSetup(identity: KitchenMindUser): Promise<{ secret: string; authenticatorUri: string; enrollmentToken: string; expiresAt: string }> {
  const platformUser = await requirePlatformUser(identity, "platform.security.manage");
  const database = requirePlatformDatabase();
  if (await getMfaCredential(database, platformUser.id)) {
    throw new PlatformSecurityError("El autenticador ya está configurado.", 409, "mfa_already_enrolled");
  }
  const secret = generateTotpSecret();
  const expiresAt = addSeconds(new Date(), 10 * 60);
  const payload: EnrollmentPayload = {
    version: 1,
    authUserId: identity.id,
    platformUserId: platformUser.id,
    secret,
    expiresAt,
  };
  const enrollmentToken = await sealText(JSON.stringify(payload), requirePlatformMfaKey());
  return { secret, authenticatorUri: createAuthenticatorUri(secret, identity.email), enrollmentToken, expiresAt };
}

async function assertChallengeAllowed(database: D1DatabaseLike, identity: KitchenMindUser): Promise<void> {
  const since = new Date(Date.now() - FAILURE_WINDOW_MINUTES * 60 * 1_000).toISOString();
  const row = await database.prepare(
    `SELECT COUNT(*) AS count FROM platform_audit_events
      WHERE auth_user_id = ? AND action = 'platform.mfa.failed' AND created_at >= ?`,
  ).bind(identity.id, since).first<{ count: number }>();
  if ((row?.count ?? 0) >= MAX_FAILED_ATTEMPTS) {
    throw new PlatformSecurityError("Demasiados intentos. Espera unos minutos antes de volver a intentar.", 429, "mfa_rate_limited");
  }
}

async function recordMfaFailure(database: D1DatabaseLike, platformUser: PlatformUserRow, identity: KitchenMindUser): Promise<never> {
  await recordAudit(database, {
    platformUserId: platformUser.id,
    authUserId: identity.id,
    action: "platform.mfa.failed",
    entity: "platform_session",
    outcome: "failed",
    reason: "Código de verificación no válido.",
  });
  throw new PlatformSecurityError("El código no es válido o ya venció.", 401, "mfa_invalid_code");
}

function isEnrollmentPayload(value: unknown): value is EnrollmentPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.authUserId === "string" && typeof record.platformUserId === "string" && typeof record.secret === "string" && typeof record.expiresAt === "string";
}

async function prepareSession(database: D1DatabaseLike, platformUser: PlatformUserRow, action: string): Promise<{
  token: string;
  expiresAt: string;
  statements: D1PreparedStatementLike[];
}> {
  const token = generateSessionToken();
  const tokenHash = await sha256(token);
  const timestamp = nowIso();
  const expiresAt = addSeconds(new Date(), PLATFORM_SESSION_SECONDS);
  const sessionId = crypto.randomUUID();
  return {
    token,
    expiresAt,
    statements: [
      database.prepare(
        `INSERT INTO platform_sessions
          (id, platform_user_id, token_hash, created_at, last_seen_at, expires_at, mfa_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(sessionId, platformUser.id, tokenHash, timestamp, timestamp, expiresAt, timestamp),
      auditStatement(database, {
        platformUserId: platformUser.id,
        authUserId: platformUser.authUserId,
        action,
        entity: "platform_session",
        entityId: sessionId,
        outcome: "success",
        createdAt: timestamp,
      }),
    ],
  };
}

export async function enrollPlatformMfa(
  identity: KitchenMindUser,
  enrollmentToken: string,
  code: string,
): Promise<{ sessionToken: string; expiresAt: string; recoveryCodes: string[] }> {
  const platformUser = await requirePlatformUser(identity, "platform.security.manage");
  const database = requirePlatformDatabase();
  await assertChallengeAllowed(database, identity);
  if (await getMfaCredential(database, platformUser.id)) {
    throw new PlatformSecurityError("El autenticador ya está configurado.", 409, "mfa_already_enrolled");
  }

  let payload: EnrollmentPayload;
  try {
    const parsed: unknown = JSON.parse(await openSealedText(enrollmentToken, requirePlatformMfaKey()));
    if (!isEnrollmentPayload(parsed)) throw new Error("Invalid enrollment payload");
    payload = parsed;
  } catch {
    return recordMfaFailure(database, platformUser, identity);
  }
  if (payload.authUserId !== identity.id || payload.platformUserId !== platformUser.id || new Date(payload.expiresAt).getTime() <= Date.now()) {
    return recordMfaFailure(database, platformUser, identity);
  }
  if (!(await verifyTotp(code, payload.secret))) return recordMfaFailure(database, platformUser, identity);

  const timestamp = nowIso();
  const encryptedSecret = await sealText(payload.secret, requirePlatformMfaKey());
  const recoveryCodes = generateRecoveryCodes();
  const recoveryRows = await Promise.all(recoveryCodes.map(async (recoveryCode) => ({
    id: crypto.randomUUID(),
    hash: await sha256(normalizeRecoveryCode(recoveryCode)),
  })));
  const session = await prepareSession(database, platformUser, "platform.mfa.enrolled");
  const statements: D1PreparedStatementLike[] = [
    database.prepare(
      `INSERT INTO platform_mfa_credentials
        (id, platform_user_id, type, encrypted_secret, verified_at, created_at, updated_at)
       VALUES (?, ?, 'totp', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), platformUser.id, encryptedSecret, timestamp, timestamp, timestamp),
    database.prepare("DELETE FROM platform_recovery_codes WHERE platform_user_id = ?").bind(platformUser.id),
    ...recoveryRows.map((row) => database.prepare(
      `INSERT INTO platform_recovery_codes (id, platform_user_id, code_hash, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(row.id, platformUser.id, row.hash, timestamp)),
    ...session.statements,
  ];
  assertBatch(await database.batch(statements));
  return { sessionToken: session.token, expiresAt: session.expiresAt, recoveryCodes };
}

export async function completePlatformMfaChallenge(
  identity: KitchenMindUser,
  code: string,
): Promise<{ sessionToken: string; expiresAt: string; usedRecoveryCode: boolean }> {
  const platformUser = await requirePlatformUser(identity, "platform.access");
  const database = requirePlatformDatabase();
  await assertChallengeAllowed(database, identity);
  const credential = await getMfaCredential(database, platformUser.id);
  if (!credential) throw new PlatformSecurityError("Configura primero el autenticador.", 409, "mfa_not_enrolled");

  let valid = false;
  let usedRecoveryCode = false;
  if (/^\d{6}$/.test(code.trim())) {
    const secret = await openSealedText(credential.encryptedSecret, requirePlatformMfaKey());
    valid = await verifyTotp(code, secret);
  } else {
    const codeHash = await sha256(normalizeRecoveryCode(code));
    const consumed = await database.prepare(
      `UPDATE platform_recovery_codes SET used_at = ?
        WHERE platform_user_id = ? AND code_hash = ? AND used_at IS NULL
        RETURNING id`,
    ).bind(nowIso(), platformUser.id, codeHash).first<{ id: string }>();
    valid = Boolean(consumed);
    usedRecoveryCode = valid;
  }
  if (!valid) return recordMfaFailure(database, platformUser, identity);

  const session = await prepareSession(
    database,
    platformUser,
    usedRecoveryCode ? "platform.recovery_code.used" : "platform.mfa.verified",
  );
  assertBatch(await database.batch(session.statements));
  return { sessionToken: session.token, expiresAt: session.expiresAt, usedRecoveryCode };
}

export async function revokeOtherPlatformSessions(
  identity: KitchenMindUser,
  currentSessionToken: string,
): Promise<number> {
  const platformUser = await requirePlatformUser(identity, "platform.security.manage");
  const database = requirePlatformDatabase();
  const currentHash = await sha256(currentSessionToken);
  const timestamp = nowIso();
  if (!(await getPlatformSession(database, platformUser, currentSessionToken))) {
    throw new PlatformSecurityError("Verifica nuevamente tu segundo factor.", 401, "platform_session_required");
  }
  const count = await database.prepare(
    `SELECT COUNT(*) AS count FROM platform_sessions
      WHERE platform_user_id = ? AND token_hash <> ? AND revoked_at IS NULL AND expires_at > ?`,
  ).bind(platformUser.id, currentHash, timestamp).first<{ count: number }>();
  await run(database.prepare(
    `UPDATE platform_sessions SET revoked_at = ?
      WHERE platform_user_id = ? AND token_hash <> ? AND revoked_at IS NULL`,
  ).bind(timestamp, platformUser.id, currentHash));
  await recordAudit(database, {
    platformUserId: platformUser.id,
    authUserId: identity.id,
    action: "platform.sessions.others_revoked",
    entity: "platform_session",
    outcome: "success",
    metadata: { revokedCount: count?.count ?? 0 },
  });
  return count?.count ?? 0;
}

export async function revokeCurrentPlatformSession(identity: KitchenMindUser, sessionToken: string): Promise<void> {
  const platformUser = await requirePlatformUser(identity, "platform.access");
  const database = requirePlatformDatabase();
  const tokenHash = await sha256(sessionToken);
  const timestamp = nowIso();
  await run(database.prepare(
    `UPDATE platform_sessions SET revoked_at = ?
      WHERE platform_user_id = ? AND token_hash = ? AND revoked_at IS NULL`,
  ).bind(timestamp, platformUser.id, tokenHash));
  await recordAudit(database, {
    platformUserId: platformUser.id,
    authUserId: identity.id,
    action: "platform.session.revoked",
    entity: "platform_session",
    outcome: "success",
  });
}
