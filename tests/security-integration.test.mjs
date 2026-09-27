import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const temporaryDirectory = mkdtempSync(join(tmpdir(), "kitchenmind-security-"));
const databasePath = join(temporaryDirectory, "security.sqlite");
const bundlePath = join(root, `.security-test-bundle-${process.pid}.mjs`);
const schemaPath = join(temporaryDirectory, "schema.json");

const ids = {
  organizationA: "00000000-0000-4000-8000-000000000001",
  organizationB: "00000000-0000-4000-8000-000000000002",
  branchA1: "10000000-0000-4000-8000-000000000001",
  branchA2: "10000000-0000-4000-8000-000000000002",
  branchB1: "10000000-0000-4000-8000-000000000003",
  employeeA1: "20000000-0000-4000-8000-000000000001",
  employeeA2: "20000000-0000-4000-8000-000000000002",
  employeeB1: "20000000-0000-4000-8000-000000000003",
};

let api;
let database;
const identityA = { authUserId: "auth-user-a", email: "a@example.test", displayName: "User A" };
const invitationToken = "invitation-token-that-is-long-enough-for-security-testing-0001";

function insert(sql, values = []) { database.prepare(sql).run(...values); }

function seedTenantFixtures() {
  const now = new Date().toISOString();
  for (const [id, code] of [[ids.organizationA, "ORGA"], [ids.organizationB, "ORGB"]]) {
    insert(`INSERT INTO tenant_organizations
      (id, code, slug, commercial_name, business_profile_id, country_code, default_currency, default_timezone, locale,
       contact_email, contact_phone, status, onboarding_status, source_prospect_id, source_quote_id,
       source_quote_version_id, created_by_platform_user_id, version)
      VALUES (?, ?, ?, ?, 'profile', 'MX', 'MXN', 'America/Mexico_City', 'es-MX', ?, '0000000000', 'active',
       'completed', 'prospect', ?, 'quote-version', 'platform-user', 1)`, [id, code, code.toLowerCase(), `Organization ${code}`, `${code.toLowerCase()}@example.test`, `quote-${code}`]);
    insert(`INSERT INTO organization_entitlements
      (id, organization_id, module_code, source_type, source_quote_version_id, enabled, effective_from, status, created_by)
      VALUES (?, ?, 'PERSONNEL', 'manual', 'quote-version', 1, ?, 'active', 'platform-user')`, [`entitlement-${code}`, id, now]);
  }
  for (const [id, organizationId, code] of [
    [ids.branchA1, ids.organizationA, "A1"], [ids.branchA2, ids.organizationA, "A2"], [ids.branchB1, ids.organizationB, "B1"],
  ]) insert("INSERT INTO tenant_branches (id, organization_id, code, name, timezone, status, created_by) VALUES (?, ?, ?, ?, 'America/Mexico_City', 'active', 'platform-user')", [id, organizationId, code, `Branch ${code}`]);

  insert("INSERT INTO customer_users (id, auth_user_id, email, display_name, status) VALUES ('customer-a', ?, ?, 'User A', 'active')", [identityA.authUserId, identityA.email]);
  insert("INSERT INTO organization_memberships (id, organization_id, user_id, status, display_name, joined_at, invited_by) VALUES ('membership-a', ?, 'customer-a', 'active', 'User A', ?, 'platform-user')", [ids.organizationA, now]);
  insert("INSERT INTO organization_roles (id, organization_id, code, name, status) VALUES ('role-a', ?, 'administrator', 'Administrator', 'active')", [ids.organizationA]);
  insert("INSERT INTO organization_roles (id, organization_id, code, name, status) VALUES ('role-b', ?, 'owner', 'Owner', 'active')", [ids.organizationB]);
  insert("INSERT INTO membership_role_assignments (membership_id, role_id) VALUES ('membership-a', 'role-a')");
  insert("INSERT INTO membership_scopes (id, membership_id, scope_type, scope_id, access_mode) VALUES ('scope-a1', 'membership-a', 'branch', ?, 'manage')", [ids.branchA1]);
  insert(`INSERT INTO organization_invitations
    (id, organization_id, email_normalized, intended_role_id, token_hash, status, expires_at, created_by_platform_user_id)
    VALUES ('invitation-b', ?, 'invited@example.test', 'role-b', ?, 'pending', '2999-01-01T00:00:00.000Z', 'platform-user')`,
    [ids.organizationB, createHash("sha256").update(invitationToken).digest("hex")]);

  for (const [id, organizationId, branchId, number] of [
    [ids.employeeA1, ids.organizationA, ids.branchA1, "A-1"],
    [ids.employeeA2, ids.organizationA, ids.branchA2, "A-2"],
    [ids.employeeB1, ids.organizationB, ids.branchB1, "B-1"],
  ]) insert("INSERT INTO tenant_employees (id, organization_id, branch_id, employee_number, name, status, created_by, version) VALUES (?, ?, ?, ?, ?, 'active', 'platform-user', 1)", [id, organizationId, branchId, number, `Employee ${number}`]);
}

before(async () => {
  execFileSync(process.execPath, ["scripts/create-portable-database.mjs", databasePath, schemaPath], { cwd: root, stdio: "ignore" });
  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = OFF");
  seedTenantFixtures();
  database.close();

  await build({
    stdin: {
      contents: `
        export * from "./services/native-auth.service.ts";
        export * from "./services/platform-security.service.ts";
        export * from "./services/tenant-operations.service.ts";
        export * from "./services/tenancy.service.ts";
        export { generateTotp } from "./lib/platform-mfa.ts";
      `,
      resolveDir: root,
      sourcefile: "security-test-entry.ts",
    },
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    plugins: [{
      name: "server-only-test-stub",
      setup(builder) {
        builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "test-stub" }));
        builder.onLoad({ filter: /.*/, namespace: "test-stub" }, () => ({ contents: "" }));
      },
    }],
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "local-test-token";
  process.env.KITCHENMIND_PLATFORM_OWNER_EMAIL = "owner@example.test";
  process.env.KITCHENMIND_PLATFORM_MFA_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  api = await import(`${new URL(`file://${bundlePath}`).href}?run=${Date.now()}`);
  database = new DatabaseSync(databasePath);
});

after(() => {
  try { database?.close(); } catch {}
  rmSync(bundlePath, { force: true });
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("native authentication hashes passwords, locks repeated failures, expires/revokes sessions and consumes reset tokens", async () => {
  const identity = await api.createCredential({ email: "auth@example.test", displayName: "Auth Test", password: "StrongPass123" });
  assert.equal((await api.authenticate("AUTH@example.test", "StrongPass123")).id, identity.id);
  for (let attempt = 0; attempt < 8; attempt += 1) await assert.rejects(api.authenticate(identity.email, "incorrect-password"), /incorrectos|bloqueada/);
  await assert.rejects(api.authenticate(identity.email, "StrongPass123"), /bloqueada/);

  database.prepare("UPDATE auth_credentials SET locked_until = NULL, failed_attempts = 0 WHERE subject_id = ?").run(identity.id);
  const session = await api.createSession(identity);
  assert.equal((await api.identityFromSession(session.token))?.id, identity.id);
  await api.revokeSession(session.token);
  assert.equal(await api.identityFromSession(session.token), null);

  const expired = await api.createSession(identity);
  database.prepare("UPDATE auth_sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE subject_id = ? AND revoked_at IS NULL").run(identity.id);
  assert.equal(await api.identityFromSession(expired.token), null);

  const resetToken = await api.issuePasswordReset(identity.email);
  assert.ok(resetToken);
  await api.resetPassword(resetToken, "NewStrongPass456");
  await assert.rejects(api.resetPassword(resetToken, "AnotherPass789"), /ya no es válido/);
  assert.equal((await api.authenticate(identity.email, "NewStrongPass456")).id, identity.id);
});

test("Platform requires owner identity, MFA enrollment and a live second-factor session", async () => {
  const stranger = { id: "stranger", email: "stranger@example.test", displayName: "Stranger", fullName: null };
  await assert.rejects(api.requirePlatformUser(stranger), (error) => error.code === "platform_access_denied");
  const owner = { id: "owner-auth", email: "owner@example.test", displayName: "Owner", fullName: null };
  assert.equal((await api.getPlatformGate(owner, null)).kind, "enroll");
  await assert.rejects(api.requireActivePlatformSession(owner, null), (error) => error.code === "platform_session_required");
  const setup = await api.createMfaSetup(owner);
  assert.match(setup.authenticatorUri, /^otpauth:\/\/totp\//);
  await assert.rejects(api.enrollPlatformMfa(owner, setup.enrollmentToken, "000000"), (error) => error.code === "mfa_invalid_code");
  const enrollment = await api.enrollPlatformMfa(owner, setup.enrollmentToken, await api.generateTotp(setup.secret));
  assert.ok(enrollment.sessionToken);
  assert.equal((await api.requireActivePlatformSession(owner, enrollment.sessionToken, "platform.access")).authUserId, owner.id);
  await api.revokeCurrentPlatformSession(owner, enrollment.sessionToken);
  await assert.rejects(api.requireActivePlatformSession(owner, enrollment.sessionToken), (error) => error.code === "platform_session_required");
});

test("invitations are single-tenant and cannot be accepted by a different authenticated email", async () => {
  const anonymousService = new api.CustomerOnboardingService(null);
  const preview = await anonymousService.invitation(invitationToken);
  assert.equal(preview.email, "invited@example.test");
  assert.equal(preview.status, "pending");
  const attackerService = new api.CustomerOnboardingService(identityA);
  await assert.rejects(attackerService.accept({ token: invitationToken }), /correo al que se dirigió/);
  assert.equal(database.prepare("SELECT status FROM organization_invitations WHERE id = 'invitation-b'").get().status, "pending");
});

test("organization A cannot read, create, modify or remove organization B resources", async () => {
  const service = new api.TenantOperationsService(identityA);
  await assert.rejects(service.snapshot({ organizationId: ids.organizationB }), /membresía/);
  await assert.rejects(service.createEmployee({ organizationId: ids.organizationB, branchId: ids.branchB1, employeeNumber: "ATTACK", name: "Cross Tenant" }), /membresía/);
  await assert.rejects(service.updateEmployee({ organizationId: ids.organizationA, branchId: ids.branchA1, employeeId: ids.employeeB1, employeeNumber: "B-1", name: "Cross Tenant", expectedVersion: 1 }), /no existe/);
  await assert.rejects(service.setEmployeeStatus({ organizationId: ids.organizationA, employeeId: ids.employeeB1, status: "terminated", reason: "Cross tenant deletion attempt", expectedVersion: 1 }), /no existe/);
  assert.equal(database.prepare("SELECT status FROM tenant_employees WHERE id = ?").get(ids.employeeB1).status, "active");
});

test("branch-scoped member cannot read, create, modify or remove resources in another branch", async () => {
  const service = new api.TenantOperationsService(identityA);
  const snapshot = await service.snapshot({ organizationId: ids.organizationA, branchId: ids.branchA1 });
  assert.deepEqual(snapshot.branches.map((branch) => branch.id), [ids.branchA1]);
  assert.ok(snapshot.employees.every((employee) => employee.branchId === ids.branchA1));
  await assert.rejects(service.snapshot({ organizationId: ids.organizationA, branchId: ids.branchA2 }), /alcance/);
  await assert.rejects(service.createEmployee({ organizationId: ids.organizationA, branchId: ids.branchA2, employeeNumber: "A-ATTACK", name: "Wrong Branch" }), /alcance/);
  await assert.rejects(service.updateEmployee({ organizationId: ids.organizationA, branchId: ids.branchA2, employeeId: ids.employeeA2, employeeNumber: "A-2", name: "Wrong Branch", expectedVersion: 1 }), /alcance/);
  await assert.rejects(service.setEmployeeStatus({ organizationId: ids.organizationA, employeeId: ids.employeeA2, status: "terminated", reason: "Cross branch deletion attempt", expectedVersion: 1 }), /alcance/);
  assert.equal(database.prepare("SELECT status FROM tenant_employees WHERE id = ?").get(ids.employeeA2).status, "active");
});
