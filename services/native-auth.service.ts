import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { requirePlatformDatabase } from "@/db/runtime";

export const AUTH_SESSION_COOKIE = "kitchenmind_session";
const SESSION_DAYS = 14;
const RESET_MINUTES = 30;
const PASSWORD_BYTES = 32;

export interface NativeIdentity {
  id: string;
  email: string;
  displayName: string;
  fullName: string | null;
}

function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function isoAfterMs(ms: number): string { return new Date(Date.now() + ms).toISOString(); }
function hashPassword(password: string, saltHex: string): string {
  return scryptSync(password, Buffer.from(saltHex, "hex"), PASSWORD_BYTES, { N: 16384, r: 8, p: 1 }).toString("hex");
}
function assertPassword(password: string): void {
  if (password.length < 10 || password.length > 200) throw new Error("La contraseña debe tener entre 10 y 200 caracteres.");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error("La contraseña debe incluir al menos una letra y un número.");
}

export async function ensureOwnerCredential(emailInput: string, password: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const owner = normalizeEmail(process.env.KITCHENMIND_PLATFORM_OWNER_EMAIL ?? "");
  const bootstrapPassword = process.env.KITCHENMIND_OWNER_PASSWORD ?? "";
  if (!owner || email !== owner || !bootstrapPassword || password !== bootstrapPassword) return;
  const db = requirePlatformDatabase();
  const existing = await db.prepare("SELECT id FROM auth_credentials WHERE email_normalized = ? LIMIT 1").bind(email).first<{ id: string }>();
  if (existing) return;
  assertPassword(password);
  const subjectId = `owner:${sha256(email).slice(0, 24)}`;
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  const now = new Date().toISOString();
  const result = await db.prepare(`INSERT INTO auth_credentials (id, subject_id, email_normalized, display_name, password_salt, password_hash, status, failed_attempts, password_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)`).bind(crypto.randomUUID(), subjectId, email, "KitchenMind Platform", salt, hash, now, now, now).run();
  if (!result.success) throw new Error(result.error ?? "No fue posible crear la cuenta propietaria.");
}

export async function createCredential(input: { email: string; displayName: string; password: string; subjectId?: string }): Promise<NativeIdentity> {
  const email = normalizeEmail(input.email);
  assertPassword(input.password);
  const db = requirePlatformDatabase();
  const existing = await db.prepare("SELECT subject_id AS subjectId FROM auth_credentials WHERE email_normalized = ? LIMIT 1").bind(email).first<{ subjectId: string }>();
  if (existing) throw new Error("Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.");
  const subjectId = input.subjectId ?? crypto.randomUUID();
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(input.password, salt);
  const now = new Date().toISOString();
  const result = await db.prepare(`INSERT INTO auth_credentials (id, subject_id, email_normalized, display_name, password_salt, password_hash, status, failed_attempts, password_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)`).bind(crypto.randomUUID(), subjectId, email, input.displayName.trim() || email, salt, hash, now, now, now).run();
  if (!result.success) throw new Error(result.error ?? "No fue posible crear la cuenta.");
  return { id: subjectId, email, displayName: input.displayName.trim() || email, fullName: input.displayName.trim() || null };
}

export async function authenticate(emailInput: string, password: string): Promise<NativeIdentity> {
  const email = normalizeEmail(emailInput);
  await ensureOwnerCredential(email, password);
  const db = requirePlatformDatabase();
  const row = await db.prepare(`SELECT subject_id AS subjectId, email_normalized AS email, display_name AS displayName, password_salt AS salt, password_hash AS passwordHash, status, failed_attempts AS failedAttempts, locked_until AS lockedUntil FROM auth_credentials WHERE email_normalized = ? LIMIT 1`).bind(email).first<{ subjectId: string; email: string; displayName: string; salt: string; passwordHash: string; status: string; failedAttempts: number; lockedUntil: string | null }>();
  if (!row || row.status !== "active") throw new Error("Correo o contraseña incorrectos.");
  if (row.lockedUntil && row.lockedUntil > new Date().toISOString()) throw new Error("La cuenta está temporalmente bloqueada. Intenta más tarde.");
  const computed = Buffer.from(hashPassword(password, row.salt), "hex");
  const expected = Buffer.from(row.passwordHash, "hex");
  const valid = computed.length === expected.length && timingSafeEqual(computed, expected);
  if (!valid) {
    const attempts = Number(row.failedAttempts ?? 0) + 1;
    const lockedUntil = attempts >= 8 ? isoAfterMs(15 * 60 * 1000) : null;
    await db.prepare("UPDATE auth_credentials SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE subject_id = ?").bind(lockedUntil ? 0 : attempts, lockedUntil, new Date().toISOString(), row.subjectId).run();
    throw new Error("Correo o contraseña incorrectos.");
  }
  await db.prepare("UPDATE auth_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE subject_id = ?").bind(new Date().toISOString(), row.subjectId).run();
  return { id: row.subjectId, email: row.email, displayName: row.displayName, fullName: row.displayName };
}

export async function createSession(identity: NativeIdentity): Promise<{ token: string; expiresAt: string }> {
  const db = requirePlatformDatabase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const now = new Date().toISOString();
  const expiresAt = isoAfterMs(SESSION_DAYS * 24 * 60 * 60 * 1000);
  const result = await db.prepare(`INSERT INTO auth_sessions (id, subject_id, token_hash, email_normalized, display_name, created_at, last_seen_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).bind(crypto.randomUUID(), identity.id, tokenHash, identity.email, identity.displayName, now, now, expiresAt).run();
  if (!result.success) throw new Error(result.error ?? "No fue posible crear la sesión.");
  return { token, expiresAt };
}

export async function identityFromSession(token: string | null | undefined): Promise<NativeIdentity | null> {
  if (!token) return null;
  const db = requirePlatformDatabase();
  const row = await db.prepare(`SELECT subject_id AS subjectId, email_normalized AS email, display_name AS displayName, expires_at AS expiresAt, revoked_at AS revokedAt FROM auth_sessions WHERE token_hash = ? LIMIT 1`).bind(sha256(token)).first<{ subjectId: string; email: string; displayName: string; expiresAt: string; revokedAt: string | null }>();
  if (!row || row.revokedAt || row.expiresAt <= new Date().toISOString()) return null;
  void db.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), sha256(token)).run().catch(() => undefined);
  return { id: row.subjectId, email: row.email, displayName: row.displayName, fullName: row.displayName };
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await requirePlatformDatabase().prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(new Date().toISOString(), sha256(token)).run();
}

export async function issuePasswordReset(emailInput: string): Promise<string | null> {
  const email = normalizeEmail(emailInput);
  const db = requirePlatformDatabase();
  const credential = await db.prepare("SELECT subject_id AS subjectId FROM auth_credentials WHERE email_normalized = ? AND status = 'active' LIMIT 1").bind(email).first<{ subjectId: string }>();
  if (!credential) return null;
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO password_reset_tokens (id, subject_id, email_normalized, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)").bind(crypto.randomUUID(), credential.subjectId, email, sha256(token), isoAfterMs(RESET_MINUTES * 60 * 1000), now).run();
  return token;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  assertPassword(password);
  const db = requirePlatformDatabase();
  const tokenHash = sha256(token);
  const row = await db.prepare("SELECT id, subject_id AS subjectId, expires_at AS expiresAt, used_at AS usedAt FROM password_reset_tokens WHERE token_hash = ? LIMIT 1").bind(tokenHash).first<{ id: string; subjectId: string; expiresAt: string; usedAt: string | null }>();
  if (!row || row.usedAt || row.expiresAt <= new Date().toISOString()) throw new Error("El enlace de recuperación ya no es válido.");
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare("UPDATE auth_credentials SET password_salt = ?, password_hash = ?, password_updated_at = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE subject_id = ?").bind(salt, hash, now, now, row.subjectId),
    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").bind(now, row.id),
    db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE subject_id = ? AND revoked_at IS NULL").bind(now, row.subjectId),
    db.prepare("UPDATE platform_sessions SET revoked_at = ? WHERE platform_user_id IN (SELECT id FROM platform_users WHERE auth_user_id = ?) AND revoked_at IS NULL").bind(now, row.subjectId),
  ]);
  const failed = results.find((result) => !result.success);
  if (failed) throw new Error(failed.error ?? "No fue posible actualizar la contraseña.");
}

export async function sendResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [normalizeEmail(email)], subject: "Recupera tu acceso a KitchenMind", html: `<p>Usa este enlace para crear una contraseña nueva:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>El enlace vence en 30 minutos.</p>` }),
    cache: "no-store",
  });
  return response.ok;
}
