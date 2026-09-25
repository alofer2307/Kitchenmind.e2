import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = resolve(import.meta.dirname, "..");
const databasePath = resolve(process.argv[2] ?? "kitchenmind-e2-empty.sqlite");
const schemaPath = resolve(process.argv[3] ?? "kitchenmind-e2-schema.json");
const migrationDirectory = resolve(root, "drizzle");

const migrations = (await readdir(migrationDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (!migrations.length) throw new Error("No se encontraron migraciones versionadas.");
await mkdir(dirname(databasePath), { recursive: true });
await mkdir(dirname(schemaPath), { recursive: true });
await rm(databasePath, { force: true });

const database = new DatabaseSync(databasePath);
try {
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) {
    const sql = await readFile(resolve(migrationDirectory, migration), "utf8");
    database.exec("BEGIN");
    try {
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) database.exec(statement);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(`Falló ${migration}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeyViolations.length) throw new Error(`La base portable terminó con ${foreignKeyViolations.length} violación(es) de llaves foráneas.`);
  database.exec(`PRAGMA user_version = ${Number(migrations.at(-1).slice(0, 4))}`);
  database.exec("VACUUM");

  const rows = database.prepare("SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
  const tables = rows.filter((row) => row.type === "table").map((row) => {
    const quoted = String(row.name).replaceAll("'", "''");
    return {
      name: row.name,
      sql: row.sql,
      columns: database.prepare(`PRAGMA table_info('${quoted}')`).all(),
      foreignKeys: database.prepare(`PRAGMA foreign_key_list('${quoted}')`).all(),
      indexes: database.prepare(`PRAGMA index_list('${quoted}')`).all(),
    };
  });
  const report = {
    format: "KitchenMind portable schema",
    generatedAt: new Date().toISOString(),
    dataIncluded: false,
    migrations,
    latestMigration: migrations.at(-1),
    tableCount: tables.length,
    indexCount: rows.filter((row) => row.type === "index").length,
    tables,
    indexes: rows.filter((row) => row.type === "index"),
    triggers: rows.filter((row) => row.type === "trigger"),
    views: rows.filter((row) => row.type === "view"),
  };
  await writeFile(schemaPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Base vacía: ${databasePath}\nEsquema JSON: ${schemaPath}\nMigraciones: ${migrations.length}\nTablas: ${tables.length}\n`);
} finally {
  database.close();
}
