import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";

test("5,000 synthetic companies: paging, filtering, email lookup, direct detail", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE tenant_organizations(id TEXT PRIMARY KEY, commercial_name TEXT, code TEXT, status TEXT, deleted_at TEXT, source_quote_id TEXT, updated_at TEXT);
    CREATE TABLE quotes(id TEXT PRIMARY KEY, quote_number TEXT);
    CREATE TABLE organization_memberships(organization_id TEXT, user_id TEXT, status TEXT);
    CREATE TABLE customer_users(id TEXT PRIMARY KEY, email TEXT);
    CREATE TABLE organization_entitlements(organization_id TEXT, module_code TEXT, enabled INTEGER, status TEXT);
    CREATE TABLE onboarding_tasks(organization_id TEXT, status TEXT);
    CREATE INDEX idx_membership_org ON organization_memberships(organization_id);
    CREATE INDEX idx_entitlement_org ON organization_entitlements(organization_id);
    CREATE INDEX idx_tasks_org ON onboarding_tasks(organization_id);`);
  const q = db.prepare("INSERT INTO quotes VALUES (?, ?)");
  const o = db.prepare("INSERT INTO tenant_organizations VALUES (?, ?, ?, ?, NULL, ?, ?)");
  const u = db.prepare("INSERT INTO customer_users VALUES (?, ?)");
  const m = db.prepare("INSERT INTO organization_memberships VALUES (?, ?, 'active')");
  const e = db.prepare("INSERT INTO organization_entitlements VALUES (?, 'CORE', 1, 'active')");
  db.exec("BEGIN");
  for (let i = 0; i < 5000; i++) {
    const id = String(i);
    q.run(id, `Q-${i}`);
    o.run(id, `Empresa ${String(i).padStart(5, "0")}`, `KM-${i}`, i % 3 === 0 ? "active" : "onboarding", id, "2026-11-07");
    u.run(id, `admin${i}@example.test`);
    m.run(id, id);
    e.run(id);
  }
  db.exec("COMMIT");
  const count = db.prepare("SELECT COUNT(*) AS total FROM tenant_organizations o JOIN quotes q ON q.id=o.source_quote_id WHERE o.deleted_at IS NULL");
  const page = db.prepare("SELECT o.id FROM tenant_organizations o JOIN quotes q ON q.id=o.source_quote_id WHERE o.deleted_at IS NULL ORDER BY o.updated_at DESC, o.id DESC LIMIT ? OFFSET ?");
  const search = db.prepare(`SELECT o.id FROM tenant_organizations o JOIN quotes q ON q.id=o.source_quote_id
    WHERE o.deleted_at IS NULL AND (LOWER(o.commercial_name) LIKE ? ESCAPE '\\' OR LOWER(o.code) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(q.quote_number, '')) LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM organization_memberships m JOIN customer_users u ON u.id=m.user_id WHERE m.organization_id=o.id AND m.status='active' AND LOWER(u.email) LIKE ? ESCAPE '\\'))
    ORDER BY o.updated_at DESC, o.id DESC LIMIT ? OFFSET ?`);
  const detail = db.prepare("SELECT o.id FROM tenant_organizations o JOIN quotes q ON q.id=o.source_quote_id WHERE o.id=? AND o.deleted_at IS NULL LIMIT 1");
  assert.equal(count.get().total, 5000);
  assert.equal(page.all(20, 0).length, 20);
  assert.equal(page.all(20, 4980).length, 20);
  assert.equal(search.all("%empresa 04999%", "%empresa 04999%", "%empresa 04999%", "%empresa 04999%", 20, 0).length, 1);
  assert.equal(search.all("%admin4999@example.test%", "%admin4999@example.test%", "%admin4999@example.test%", "%admin4999@example.test%", 20, 0).length, 1);
  assert.equal(detail.get("4999").id, "4999");
  const start = performance.now();
  for (let i = 0; i < 50; i++) { page.all(20, 0); page.all(20, 4980); detail.get("4999"); }
  const averageMs = (performance.now() - start) / 150;
  console.log(`Synthetic SQLite 5k, average per query: ${averageMs.toFixed(2)} ms (not production latency)`);
  assert.ok(Number.isFinite(averageMs));
  db.close();
});
