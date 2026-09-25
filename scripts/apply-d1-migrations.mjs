import fs from "node:fs/promises";
import path from "node:path";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;
const useTurso = Boolean(tursoUrl && tursoToken);
if (!useTurso && (!accountId || !databaseId || !apiToken)) {
  console.error("Faltan TURSO_DATABASE_URL y TURSO_AUTH_TOKEN, o las tres variables de Cloudflare D1.");
  process.exit(1);
}

const turso = useTurso ? (await import("@libsql/client")).createClient({ url: tursoUrl, authToken: tursoToken }) : null;
const endpoint = useTurso ? "" : `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
async function query(sql, params = []) {
  if (turso) return (await turso.execute({ sql, args: params })).rows;
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ sql, params }) });
  const body = await response.json();
  const item = body?.result?.[0];
  if (!response.ok || body?.success === false || item?.success === false) throw new Error(body?.errors?.map((error) => error.message).filter(Boolean).join("; ") || `D1 HTTP ${response.status}`);
  return item?.results ?? [];
}

async function applyMigration(sql) {
  if (turso) return turso.executeMultiple(sql);
  return query(sql);
}

async function sentinelExists(file) {
  const map = {
    "0000_naive_alex_power.sql": ["table", "platform_audit_events"],
    "0001_romantic_kid_colt.sql": ["table", "business_profile_recommendations"],
    "0002_fine_terrax.sql": ["table", "activation_checks"],
    "0003_clumsy_namorita.sql": ["table", "customer_subscription_items"],
    "0004_overjoyed_chronomancer.sql": ["table", "onboarding_answers"],
    "0005_wonderful_runaways.sql": ["table", "organization_feature_overrides"],
    "0006_volatile_captain_flint.sql": ["table", "business_profile_dashboard_defaults"],
    "0007_confused_wolfpack.sql": ["column", "dashboard_widget_definitions", "widget_type"],
    "0008_amusing_moondragon.sql": ["column", "user_dashboard_preferences", "dashboard_code"],
    "0009_nifty_vin_gonzales.sql": ["index", "idx_import_batches_org_status"],
    "0010_serious_madrox.sql": ["table", "quality_corrective_actions"],
    "0011_quick_ben_parker.sql": ["table", "biometric_credentials"],
    "0012_native_auth_vercel.sql": ["table", "auth_credentials"],
    "0013_mobile_attendance.sql": ["table", "mobile_attendance_evidence"],
  };
  const sentinel = map[file];
  if (!sentinel) return false;
  if (sentinel[0] === "column") {
    const rows = await query(`PRAGMA table_info(${sentinel[1]})`);
    return rows.some((row) => row.name === sentinel[2]);
  }
  const rows = await query("SELECT name FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1", [sentinel[0], sentinel[1]]);
  return rows.length > 0;
}

await query(`CREATE TABLE IF NOT EXISTS _km_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)`);
const appliedRows = await query("SELECT name FROM _km_migrations");
const applied = new Set(appliedRows.map((row) => String(row.name)));
const dir = path.resolve("drizzle");
const files = (await fs.readdir(dir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
for (const file of files) {
  if (applied.has(file)) { console.log(`↷ ${file} ya registrada`); continue; }
  if (await sentinelExists(file)) {
    await query("INSERT OR IGNORE INTO _km_migrations (name, applied_at) VALUES (?, ?)", [file, new Date().toISOString()]);
    console.log(`↷ ${file} ya existía; registrada`);
    continue;
  }
  const sql = await fs.readFile(path.join(dir, file), "utf8");
  await applyMigration(sql);
  await query("INSERT INTO _km_migrations (name, applied_at) VALUES (?, ?)", [file, new Date().toISOString()]);
  console.log(`✓ ${file}`);
}
console.log("Migraciones KitchenMind al día.");
turso?.close();
