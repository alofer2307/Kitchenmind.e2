import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";

export interface D1RunResult {
  success: boolean;
  error?: string;
  meta?: { changes?: number };
}

export interface D1AllResult<T> extends D1RunResult { results: T[]; }

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1AllResult<T>>;
  run(): Promise<D1RunResult>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<D1RunResult[]>;
}

export interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
}

export interface R2BucketLike {
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  delete(key: string): Promise<void>;
}

class CloudflareD1PreparedStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  constructor(readonly query: string, private readonly database: CloudflareD1RestDatabase) {}
  bind(...values: unknown[]): D1PreparedStatementLike { this.values = values; return this; }
  params(): unknown[] { return this.values; }
  async first<T>(): Promise<T | null> {
    const result = await this.database.execute<T>(this.query, this.values);
    return result.results[0] ?? null;
  }
  async all<T>(): Promise<D1AllResult<T>> { return this.database.execute<T>(this.query, this.values); }
  async run(): Promise<D1RunResult> {
    const result = await this.database.execute<unknown>(this.query, this.values);
    return { success: result.success, error: result.error, meta: result.meta };
  }
}

class CloudflareD1RestDatabase implements D1DatabaseLike {
  constructor(private readonly accountId: string, private readonly databaseId: string, private readonly apiToken: string) {}
  prepare(query: string): D1PreparedStatementLike { return new CloudflareD1PreparedStatement(query, this); }
  async batch(statements: D1PreparedStatementLike[]): Promise<D1RunResult[]> {
    if (!statements.length) return [];
    const batch = statements.map((statement) => {
      if (!(statement instanceof CloudflareD1PreparedStatement)) throw new Error("Sentencia D1 incompatible.");
      return { sql: statement.query, params: statement.params() };
    });
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/d1/database/${encodeURIComponent(this.databaseId)}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ batch }),
      cache: "no-store",
    });
    const payload = await response.json() as { success?: boolean; errors?: Array<{ message?: string }>; result?: Array<{ success?: boolean; meta?: { changes?: number } }> };
    if (!response.ok || payload.success === false) {
      const error = payload.errors?.map((item) => item.message).filter(Boolean).join("; ") || `D1 respondió HTTP ${response.status}.`;
      return statements.map(() => ({ success: false, error }));
    }
    return (payload.result ?? []).map((item) => ({ success: item.success !== false, meta: item.meta, error: item.success === false ? "Una sentencia del lote D1 falló." : undefined }));
  }
  async execute<T>(sql: string, params: unknown[]): Promise<D1AllResult<T>> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/d1/database/${encodeURIComponent(this.databaseId)}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    });
    const payload = await response.json() as { success?: boolean; errors?: Array<{ message?: string }>; result?: Array<{ success?: boolean; results?: T[]; meta?: { changes?: number } }> };
    const item = payload.result?.[0];
    const success = response.ok && payload.success !== false && item?.success !== false;
    if (!success) return { success: false, error: payload.errors?.map((error) => error.message).filter(Boolean).join("; ") || `D1 respondió HTTP ${response.status}.`, results: [], meta: item?.meta };
    return { success: true, results: item?.results ?? [], meta: item?.meta };
  }
}

class TursoPreparedStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  constructor(readonly query: string, private readonly database: TursoDatabase) {}
  bind(...values: unknown[]): D1PreparedStatementLike { this.values = values; return this; }
  statement() { return { sql: this.query, args: this.values as InValue[] }; }
  async first<T>(): Promise<T | null> {
    const result = await this.database.execute<T>(this.query, this.values);
    if (!result.success) throw new Error(result.error ?? "Error al consultar Turso.");
    return result.results[0] ?? null;
  }
  async all<T>(): Promise<D1AllResult<T>> { return this.database.execute<T>(this.query, this.values); }
  async run(): Promise<D1RunResult> {
    const result = await this.database.execute<unknown>(this.query, this.values);
    return { success: result.success, error: result.error, meta: result.meta };
  }
}

class TursoDatabase implements D1DatabaseLike {
  constructor(private readonly client: Client) {}
  prepare(query: string): D1PreparedStatementLike { return new TursoPreparedStatement(query, this); }
  async batch(statements: D1PreparedStatementLike[]): Promise<D1RunResult[]> {
    if (!statements.length) return [];
    const commands = statements.map((statement) => {
      if (!(statement instanceof TursoPreparedStatement)) throw new Error("Sentencia Turso incompatible.");
      return statement.statement();
    });
    try {
      const results = await this.client.batch(commands, "write");
      return results.map((result) => ({ success: true, meta: { changes: result.rowsAffected } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en el lote Turso.";
      return statements.map(() => ({ success: false, error: message }));
    }
  }
  async execute<T>(sql: string, args: unknown[]): Promise<D1AllResult<T>> {
    try {
      const result = await this.client.execute({ sql, args: args as InValue[] });
      return { success: true, results: result.rows as unknown as T[], meta: { changes: result.rowsAffected } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Error en Turso.", results: [] };
    }
  }
}

let cachedDatabase: D1DatabaseLike | null = null;

export function getRuntimeBindings() {
  return {
    KITCHENMIND_PLATFORM_OWNER_EMAIL: process.env.KITCHENMIND_PLATFORM_OWNER_EMAIL,
    KITCHENMIND_PLATFORM_MFA_KEY: process.env.KITCHENMIND_PLATFORM_MFA_KEY,
  };
}

export function requirePlatformDatabase(): D1DatabaseLike {
  if (cachedDatabase) return cachedDatabase;
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl && tursoToken) {
    cachedDatabase = new TursoDatabase(createClient({ url: tursoUrl, authToken: tursoToken }));
    return cachedDatabase;
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN?.trim();
  if (!accountId || !databaseId || !apiToken) throw new Error("Falta configurar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN, o bien las tres variables de Cloudflare D1, en Vercel.");
  cachedDatabase = new CloudflareD1RestDatabase(accountId, databaseId, apiToken);
  return cachedDatabase;
}

export function requireEvidenceBucket(): R2BucketLike {
  throw new Error("El almacenamiento de evidencias requiere configurar un adaptador de objetos. El resto de KitchenMind puede operar sin esta función.");
}

export function requirePlatformOwnerEmail(): string {
  const email = process.env.KITCHENMIND_PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("KitchenMind Platform todavía no tiene una propietaria configurada.");
  return email;
}

export function requirePlatformMfaKey(): string {
  const key = process.env.KITCHENMIND_PLATFORM_MFA_KEY?.trim();
  if (!key) throw new Error("La protección MFA de KitchenMind Platform no está configurada.");
  return key;
}
