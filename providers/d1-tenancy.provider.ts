import "server-only";
import { requirePlatformDatabase } from "@/db/runtime";
import type { TenancyDataProvider } from "@/repositories/tenancy.contracts";
import type { SqlCommand } from "@/repositories/commercial.contracts";

export class D1TenancyDataProvider implements TenancyDataProvider {
  private database() { return requirePlatformDatabase(); }

  async first<T>(sql: string, values: unknown[] = []): Promise<T | null> {
    return this.database().prepare(sql).bind(...values).first<T>();
  }

  async all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.database().prepare(sql).bind(...values).all<T>();
    if (!result.success) throw new Error(result.error ?? "No fue posible consultar la configuración del cliente.");
    return result.results;
  }

  async run(sql: string, values: unknown[] = []): Promise<void> {
    const result = await this.database().prepare(sql).bind(...values).run();
    if (!result.success) throw new Error(result.error ?? "No fue posible guardar la configuración del cliente.");
  }

  async batch(commands: SqlCommand[]): Promise<void> {
    if (!commands.length) return;
    const statements = commands.map((command) => this.database().prepare(command.sql).bind(...(command.values ?? [])));
    const results = await this.database().batch(statements);
    const failed = results.find((result) => !result.success);
    if (failed) throw new Error(failed.error ?? "No fue posible completar la operación multi-tenant.");
  }
}
