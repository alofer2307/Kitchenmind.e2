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
