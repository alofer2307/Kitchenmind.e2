import "server-only";
import { z } from "zod";
import { D1TenancyDataProvider } from "@/providers/d1-tenancy.provider";
import { D1DashboardRepository } from "@/repositories/d1-dashboard.repository";
import { normalizeDashboardPeriod } from "@/rules/dashboard.rules";
import type { PlatformActor, TenantActor } from "@/types";

export class DashboardApplicationError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "dashboard_invalid_request") {
    super(message);
    this.name = "DashboardApplicationError";
  }
}

function parse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new DashboardApplicationError(result.error.issues[0]?.message ?? "Revisa los datos enviados.");
  return result.data;
}

const idSchema = z.string().uuid();
const widgetCodeSchema = z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/);
const sizeSchema = z.enum(["small", "medium", "large", "full"]);
const layoutSchema = z.array(z.object({ code: widgetCodeSchema, visible: z.boolean(), size: sizeSchema, position: z.number().int().min(0).max(100) }).strict()).max(24);
const preferenceSchema = z.object({
  organizationId: idSchema,
  presetCode: widgetCodeSchema,
  version: z.number().int().min(0),
  layout: layoutSchema,
  defaultFilters: z.object({ period: z.enum(["today", "last_7_days", "last_30_days"]), branchId: z.union([idSchema, z.null()]) }).strict(),
}).strict();
const overrideSchema = z.object({
  organizationId: idSchema,
  targetType: z.enum(["preset", "widget"]),
  targetCode: widgetCodeSchema,
  enabled: z.boolean().optional(),
  size: sizeSchema.optional(),
  displayOrder: z.number().int().min(0).max(100).optional(),
  effectiveUntil: z.string().datetime().optional(),
  reason: z.string().trim().min(5).max(1_000),
}).strict();

export class CustomerDashboardService {
  private readonly repository = new D1DashboardRepository(new D1TenancyDataProvider());
  constructor(private readonly identity: TenantActor | null) {}

  private requireIdentity(): TenantActor {
    if (!this.identity) throw new DashboardApplicationError("Inicia sesión para abrir el tablero.", 401, "authentication_required");
    return this.identity;
  }

  async snapshot(params: { organizationId?: string | null; branchId?: string | null; period?: string | null }) {
    const organizationId = params.organizationId ? parse(idSchema, params.organizationId) : undefined;
    const branchId = params.branchId ? parse(z.union([idSchema, z.literal("all")]), params.branchId) : undefined;
    return this.repository.customerSnapshot(this.requireIdentity(), { organizationId, branchId, period: params.period ? normalizeDashboardPeriod(params.period) : undefined });
  }

  async exportSnapshot(value: unknown) {
    const input = parse(z.object({ organizationId: idSchema, branchId: z.union([idSchema, z.literal("all"), z.null()]).optional(), period: z.string().optional() }).strict(), value);
    return this.repository.exportCustomerSnapshot(this.requireIdentity(), {
      organizationId: input.organizationId,
      branchId: input.branchId,
      period: normalizeDashboardPeriod(input.period),
    });
  }

  async savePreference(value: unknown) {
    const input = parse(preferenceSchema, value);
    await this.repository.savePreference(this.requireIdentity(), input.organizationId, input);
    return { saved: true };
  }

  async resetPreference(value: unknown) {
    const input = parse(z.object({ organizationId: idSchema }).strict(), value);
    await this.repository.resetPreference(this.requireIdentity(), input.organizationId);
    return { reset: true };
  }

  async saveOrganizationOverride(value: unknown) {
    const input = parse(overrideSchema, value);
    await this.repository.saveOrganizationOverride(this.requireIdentity(), input.organizationId, input);
    return { saved: true };
  }
}

export class PlatformDashboardService {
  private readonly repository = new D1DashboardRepository(new D1TenancyDataProvider());
  constructor(private readonly actor: PlatformActor) {}

  async catalog(organizationId?: string | null) {
    return this.repository.catalog(organizationId ? parse(idSchema, organizationId) : undefined);
  }

  async setWidgetStatus(value: unknown) {
    const input = parse(z.object({ code: widgetCodeSchema, active: z.boolean(), version: z.number().int().positive(), reason: z.string().trim().min(5).max(1_000) }).strict(), value);
    await this.repository.setWidgetStatus(this.actor, input);
    return { saved: true };
  }

  async saveOrganizationOverride(value: unknown) {
    const input = parse(overrideSchema, value);
    await this.repository.savePlatformOrganizationOverride(this.actor, input.organizationId, input);
    return { saved: true };
  }
}

export function dashboardErrorStatus(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof DashboardApplicationError) return { message: error.message, status: error.status, code: error.code };
  if (error instanceof Error) {
    if (/permiso|membresía|alcance|no está activa/i.test(error.message)) return { message: error.message, status: 403, code: "dashboard_access_denied" };
    if (/no se encontró|no existe/i.test(error.message)) return { message: error.message, status: 404, code: "dashboard_not_found" };
    if (/cambió|vigencia|disponible|configuración/i.test(error.message)) return { message: error.message, status: 409, code: "dashboard_rule_conflict" };
    console.error("KitchenMind dashboard error", error);
  }
  return { message: "No fue posible preparar el tablero operativo.", status: 503, code: "dashboard_unavailable" };
}
