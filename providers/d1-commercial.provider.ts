import "server-only";
import { requirePlatformDatabase } from "@/db/runtime";
import type { CommercialDataProvider, SqlCommand } from "@/repositories/commercial.contracts";

export class D1CommercialDataProvider implements CommercialDataProvider {
  async first<T>(sql: string, values: unknown[] = []): Promise<T | null> {
    return requirePlatformDatabase().prepare(sql).bind(...values).first<T>();
  }

  async all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await requirePlatformDatabase().prepare(sql).bind(...values).all<T>();
    if (!result.success) throw new Error(result.error ?? "No fue posible consultar la información comercial.");
    return result.results;
  }

  async run(sql: string, values: unknown[] = []): Promise<void> {
    const result = await requirePlatformDatabase().prepare(sql).bind(...values).run();
    if (!result.success) throw new Error(result.error ?? "No fue posible guardar la información comercial.");
  }

  async batch(commands: SqlCommand[]): Promise<void> {
    if (commands.length === 0) return;
    const database = requirePlatformDatabase();
    const results = await database.batch(commands.map((command) => database.prepare(command.sql).bind(...(command.values ?? []))));
    const failed = results.find((result) => !result.success);
    if (failed) throw new Error(failed.error ?? "No fue posible completar la operación comercial.");
  }
}
