import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("uses standard Next.js commands for Vercel", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(pkg.dependencies.next, "16.2.6");
});

test("runtime no longer imports ChatGPT Sites or Cloudflare Workers bindings", async () => {
  const runtime = await read("db/runtime.ts");
  const auth = await read("services/auth-session.service.ts");
  assert.doesNotMatch(runtime, /cloudflare:workers/);
  assert.doesNotMatch(auth, /oai-authenticated-user|signin-with-chatgpt|signout-with-chatgpt/);
  assert.match(runtime, /TURSO_DATABASE_URL/);
  assert.match(auth, /kitchenmind_session|AUTH_SESSION_COOKIE/);
});

test("native authentication has password hashing, sessions and recovery", async () => {
  const auth = await read("services/native-auth.service.ts");
  const migration = await read("drizzle/0012_native_auth_vercel.sql");
  assert.match(auth, /scryptSync/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /password_reset_tokens/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_credentials/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_sessions/);
});

test("service worker never caches authenticated product routes", async () => {
  const sw = await read("public/sw.js");
  for (const prefix of ["/app", "/platform", "/api/customer", "/api/platform", "/api/auth"]) assert.match(sw, new RegExp(prefix.replaceAll("/", "\\/")));
  assert.match(sw, /respondWith\(fetch\(event\.request\)\)/);
  assert.ok(sw.indexOf("PRIVATE_PREFIXES") < sw.indexOf("cache.put(event.request"));
  assert.match(sw, /if \(!STATIC_SHELL\.includes\(url\.pathname\)\) return/);
});

test("deployment template documents all required Vercel variables", async () => {
  const env = await read(".env.example");
  for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "KITCHENMIND_PLATFORM_OWNER_EMAIL", "KITCHENMIND_OWNER_PASSWORD", "KITCHENMIND_PLATFORM_MFA_KEY", "NEXT_PUBLIC_APP_URL"]) assert.match(env, new RegExp(`^${key}=`, "m"));
});

test("company directory uses a bounded, permission-protected server query", async () => {
  const api = await read("app/api/platform/tenancy/route.ts");
  const service = await read("services/tenancy.service.ts");
  const repo = await read("repositories/d1-tenancy.repository.ts");
  const ui = await read("components/platform/organizations-screen.tsx");
  assert.match(api, /organizations_page: "platform.organizations.read"/);
  assert.match(service, /pageSize: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(50\)/);
  assert.match(repo, /LIMIT \? OFFSET \?/);
  assert.match(repo, /COUNT\(\*\) AS total/);
  assert.match(ui, /view: "organizations_page"/);
  assert.doesNotMatch(ui, /useTenancyQuery<OrganizationSummary\[\]>\("view=organizations"\)/);
});

test("company detail fetches one organization without scanning the directory", async () => {
  const repo = await read("repositories/d1-tenancy.repository.ts");
  const start = repo.indexOf("async organization(id: string): Promise<OrganizationDetail | null>");
  const end = repo.indexOf("async platformWorkspace(", start);
  assert.ok(start > 0 && end > start);
  const detail = repo.slice(start, end);
  assert.doesNotMatch(detail, /await this\.organizations\(\)/);
  assert.match(detail, /WHERE o\.id = \? AND o\.deleted_at IS NULL LIMIT 1/);
});

test("suspension and invitation revocation require authorization and deliberate confirmation", async () => {
  const api = await read("app/api/platform/tenancy/route.ts");
  const service = await read("services/tenancy.service.ts");
  const ui = await read("components/platform/organization-detail-screen.tsx");
  assert.match(api, /revoke_invitation: "platform.invitations.revoke"/);
  assert.match(api, /suspend_organization: "platform.organizations.suspend"/);
  assert.match(api, /reactivate_organization: "platform.organizations.suspend"/);
  assert.match(service, /reason: z\.string\(\)\.trim\(\)\.min\(5\)/);
  assert.match(ui, /confirmationName\.trim\(\) !== organization\.commercialName/);
  assert.match(ui, /if \(succeeded\) setConfirmation\(null\)/);
});
