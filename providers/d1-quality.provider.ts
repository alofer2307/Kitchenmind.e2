import "server-only";
import { requirePlatformDatabase } from "@/db/runtime";
import type { SqlCommand } from "@/repositories/commercial.contracts";
import type { QualityDataProvider } from "@/repositories/quality.contracts";

export class D1QualityDataProvider implements QualityDataProvider {
  private database() { return requirePlatformDatabase(); }

  async first<T>(sql: string, values: unknown[] = []): Promise<T | null> {
    return this.database().prepare(sql).bind(...values).first<T>();
  }

  async all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.database().prepare(sql).bind(...values).all<T>();
    if (!result.success) throw new Error(result.error ?? "No fue posible consultar Calidad.");
    return result.results;
  }

  async run(sql: string, values: unknown[] = []): Promise<number> {
    const result = await this.database().prepare(sql).bind(...values).run();
    if (!result.success) throw new Error(result.error ?? "No fue posible guardar la operación de Calidad.");
    return Number(result.meta?.changes ?? 0);
  }

  async batch(commands: SqlCommand[]): Promise<number[]> {
    if (!commands.length) return [];
    const statements = commands.map((command) => this.database().prepare(command.sql).bind(...(command.values ?? [])));
    const results = await this.database().batch(statements);
    const failed = results.find((result) => !result.success);
    if (failed) throw new Error(failed.error ?? "No fue posible completar la operación de Calidad.");
    return results.map((result) => Number(result.meta?.changes ?? 0));
  }
}
