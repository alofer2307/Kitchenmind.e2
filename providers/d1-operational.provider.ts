import "server-only";
import { requirePlatformDatabase } from "@/db/runtime";
import type { SqlCommand } from "@/repositories/commercial.contracts";
import type { OperationalDataProvider } from "@/repositories/operational.contracts";

export class D1OperationalDataProvider implements OperationalDataProvider {
  private database() { return requirePlatformDatabase(); }

  async first<T>(sql: string, values: unknown[] = []): Promise<T | null> {
    return this.database().prepare(sql).bind(...values).first<T>();
  }

  async all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.database().prepare(sql).bind(...values).all<T>();
    if (!result.success) throw new Error(result.error ?? "No fue posible consultar la operación.");
    return result.results;
  }

  async run(sql: string, values: unknown[] = []): Promise<number> {
    const result = await this.database().prepare(sql).bind(...values).run();
    if (!result.success) throw new Error(result.error ?? "No fue posible guardar la operación.");
    return Number(result.meta?.changes ?? 0);
  }

  async batch(commands: SqlCommand[]): Promise<number[]> {
    if (!commands.length) return [];
    const statements = commands.map((command) => this.database().prepare(command.sql).bind(...(command.values ?? [])));
    const results = await this.database().batch(statements);
    const failed = results.find((result) => !result.success);
    if (failed) throw new Error(failed.error ?? "No fue posible completar la operación.");
    return results.map((result) => Number(result.meta?.changes ?? 0));
  }
}
