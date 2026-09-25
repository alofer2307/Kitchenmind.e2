import "server-only";
import { z } from "zod";
import { D1TenancyDataProvider } from "@/providers/d1-tenancy.provider";
import { D1TenancyRepository } from "@/repositories/d1-tenancy.repository";
import type { CustomerIdentity } from "@/repositories/tenancy.contracts";
import type { PlatformActor } from "@/types";

export class TenancyApplicationError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "tenancy_invalid_request") {
    super(message);
    this.name = "TenancyApplicationError";
  }
}

function parse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new TenancyApplicationError(result.error.issues[0]?.message ?? "Revisa los datos enviados.");
  return result.data;
}

const idSchema = z.string().uuid();
const provisionSchema = z.object({ quoteId: idSchema, idempotencyKey: z.string().min(16).max(200) }).strict();
const invitationSchema = z.object({ organizationId: idSchema, reason: z.string().trim().min(3).max(1_000) }).strict();
const revokeSchema = invitationSchema.extend({ invitationId: idSchema }).strict();
const activateSchema = z.object({ organizationId: idSchema, version: z.number().int().positive() }).strict();
const suspensionSchema = z.object({
  organizationId: idSchema,
  version: z.number().int().positive(),
  reason: z.string().trim().min(5).max(1_000),
}).strict();
const overrideSchema = z.object({
  organizationId: idSchema,
  targetType: z.enum(["module", "feature_limit"]),
  code: z.string().trim().min(1).max(100),
  enabled: z.boolean().optional(),
  overrideLimit: z.number().int().min(0).optional(),
  effectiveUntil: z.string().datetime(),
  reason: z.string().trim().min(5).max(1_000),
}).strict();
const profileSchema = z.object({
  organizationId: idSchema, version: z.number().int().positive(), commercialName: z.string().trim().min(2).max(180),
  legalName: z.string().trim().max(180).optional(), timezone: z.string().trim().min(3).max(80), locale: z.string().trim().min(2).max(20),
  taxId: z.string().trim().max(80).optional(), contactEmail: z.string().trim().email(), contactPhone: z.string().trim().min(7).max(30),
}).strict();
const resourceSchema = z.object({
  organizationId: idSchema,
  type: z.enum(["branch", "area", "warehouse", "shift", "service_type", "quality_template", "product", "device", "inventory_opening"]),
  code: z.string().trim().max(50).optional(), name: z.string().trim().max(180).optional(), branchId: idSchema.optional(),
  address: z.string().trim().max(500).optional(), timezone: z.string().trim().max(80).optional(), metadata: z.record(z.string(), z.unknown()).optional(),
  warehouseId: idSchema.optional(), productId: idSchema.optional(), quantityMinor: z.number().int().positive().optional(), unit: z.string().trim().max(40).optional(),
}).strict();
const importSchema = z.object({ organizationId: idSchema, idempotencyKey: z.string().min(10).max(200), rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500) }).strict();
const catalogImportSchema = importSchema.extend({ catalogType: z.enum(["warehouses", "products", "shifts", "service_types", "quality_templates"]) }).strict();
const taskSchema = z.object({ organizationId: idSchema, taskId: idSchema, status: z.enum(["pending", "in_progress", "completed", "blocked"]), reason: z.string().trim().max(1_000).optional() }).strict();

export class PlatformTenancyService {
  private readonly repository = new D1TenancyRepository(new D1TenancyDataProvider());
  constructor(private readonly actor: PlatformActor) {}
  private async initialize() { await this.repository.ensureCatalog(this.actor.id); }

  async overview() { await this.initialize(); return this.repository.overview(); }
  async acceptedQuotes() { await this.initialize(); return this.repository.acceptedQuotes(); }
  async eligibility(quoteId: string) { await this.initialize(); return this.repository.eligibility(parse(idSchema, quoteId)); }
  async organizations() { await this.initialize(); return this.repository.organizations(); }
  async organization(id: string) {
    await this.initialize();
    const result = await this.repository.organization(parse(idSchema, id));
    if (!result) throw new TenancyApplicationError("No se encontró la organización.", 404, "organization_not_found");
    return result;
  }
  async workspace(id: string, branchId?: string) {
    await this.initialize();
    const result = await this.repository.platformWorkspace(parse(idSchema, id), branchId ? parse(idSchema, branchId) : undefined);
    if (!result) throw new TenancyApplicationError("No se encontró la organización.", 404, "organization_not_found");
    return result;
  }
  async provision(value: unknown) { await this.initialize(); const input = parse(provisionSchema, value); return this.repository.provision(input.quoteId, input.idempotencyKey, this.actor.id); }
  async issueInvitation(value: unknown) { const input = parse(invitationSchema, value); return this.repository.issueInvitation(input.organizationId, input.reason, this.actor.id); }
  async revokeInvitation(value: unknown) { const input = parse(revokeSchema, value); await this.repository.revokeInvitation(input.organizationId, input.invitationId, input.reason, this.actor.id); return { revoked: true }; }
  async createOverride(value: unknown) { const input = parse(overrideSchema, value); await this.repository.createFeatureOverride(input.organizationId, input, this.actor.id); return { created: true }; }
  async suspend(value: unknown) { const input = parse(suspensionSchema, value); await this.repository.setOrganizationSuspension(input.organizationId, input.version, true, input.reason, this.actor.id); return { suspended: true }; }
  async reactivate(value: unknown) { const input = parse(suspensionSchema, value); await this.repository.setOrganizationSuspension(input.organizationId, input.version, false, input.reason, this.actor.id); return { reactivated: true }; }
  async evaluate(value: unknown) { const input = parse(z.object({ organizationId: idSchema }).strict(), value); return this.repository.evaluateActivation(input.organizationId, this.actor.id); }
  async activate(value: unknown) { const input = parse(activateSchema, value); await this.repository.activate(input.organizationId, input.version, this.actor.id); return { activated: true }; }
}

export class CustomerOnboardingService {
  private readonly repository = new D1TenancyRepository(new D1TenancyDataProvider());
  constructor(private readonly identity: CustomerIdentity | null) {}

  private requireIdentity(): CustomerIdentity {
    if (!this.identity) throw new TenancyApplicationError("Inicia sesión con la cuenta invitada.", 401, "authentication_required");
    return this.identity;
  }
  async invitation(token: string) {
    const result = await this.repository.invitation(parse(z.string().min(40).max(300), token));
    if (!result) throw new TenancyApplicationError("La invitación no existe o ya fue reemplazada.", 404, "invitation_not_found");
    return result;
  }
  async accept(value: unknown) { const input = parse(z.object({ token: z.string().min(40).max(300) }).strict(), value); return this.repository.acceptInvitation(input.token, this.requireIdentity()); }
  async access() { return this.repository.customerAccess(this.requireIdentity()); }
  async workspace(organizationId?: string, branchId?: string) { return this.repository.customerWorkspace(this.requireIdentity(), organizationId ? parse(idSchema, organizationId) : undefined, branchId ? parse(idSchema, branchId) : undefined); }
  async snapshot(organizationId?: string) { return this.repository.customerOnboarding(this.requireIdentity(), organizationId ? parse(idSchema, organizationId) : undefined); }
  async updateProfile(value: unknown) { const input = parse(profileSchema, value); await this.repository.updateProfile(this.requireIdentity(), input.organizationId, input.version, input); return { updated: true }; }
  async createResource(value: unknown) { const input = parse(resourceSchema, value); await this.repository.createResource(this.requireIdentity(), input.organizationId, input); return { created: true }; }
  async importEmployees(value: unknown) { const input = parse(importSchema, value); return this.repository.importEmployees(this.requireIdentity(), input.organizationId, input.idempotencyKey, input.rows); }
  async importCatalog(value: unknown) { const input = parse(catalogImportSchema, value); return this.repository.importCatalog(this.requireIdentity(), input.organizationId, input.catalogType, input.idempotencyKey, input.rows); }
  async updateTask(value: unknown) { const input = parse(taskSchema, value); await this.repository.updateTask(this.requireIdentity(), input.organizationId, input.taskId, input.status, input.reason); return { updated: true }; }
  async requestReview(value: unknown) { const input = parse(z.object({ organizationId: idSchema }).strict(), value); await this.repository.requestReview(this.requireIdentity(), input.organizationId); return { requested: true }; }
}

export function tenancyErrorStatus(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof TenancyApplicationError) return { message: error.message, status: error.status, code: error.code };
  if (error instanceof Error) {
    if (/permiso|membresía|organización no está disponible/i.test(error.message)) return { message: error.message, status: 403, code: "tenant_access_denied" };
    if (/no se encontró|no existe/i.test(error.message)) return { message: error.message, status: 404, code: "tenant_not_found" };
    if (/cambió|alcanzó|excede|ya |Solamente|todavía|Completa|bloquead|venció|disponible|contratado|aceptada/i.test(error.message)) return { message: error.message, status: 409, code: "tenant_rule_conflict" };
    console.error("KitchenMind tenancy error", error);
  }
  return { message: "No fue posible completar la operación multi-tenant.", status: 503, code: "tenancy_unavailable" };
}
