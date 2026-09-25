import "server-only";
import { z } from "zod";
import { D1CommercialDataProvider } from "@/providers/d1-commercial.provider";
import { D1CommercialRepository } from "@/repositories/d1-commercial.repository";
import type { ProspectListFilters } from "@/repositories/commercial.contracts";
import { calculatePricing, type PricingAdjustmentInput } from "@/rules/pricing.rules";
import type {
  PlatformActor,
  PricingSelection,
  ProspectCreateInput,
  ProspectStatus,
  QuoteStatus,
} from "@/types";

export class CommercialApplicationError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "commercial_invalid_request") {
    super(message);
    this.name = "CommercialApplicationError";
  }
}

const optionalTrimmed = z.string().trim().max(2_000).optional();
const prospectSchema = z.object({
  legalName: z.string().trim().max(180).optional(),
  commercialName: z.string().trim().min(2).max(180),
  businessProfileId: z.string().trim().max(100).optional(),
  businessType: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(160),
  contactPosition: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().min(7).max(30),
  contactEmail: z.string().trim().email().max(200),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/),
  estimatedBranches: z.number().int().min(1).max(100_000),
  estimatedEmployees: z.number().int().min(0).max(10_000_000),
  estimatedAdminUsers: z.number().int().min(1).max(100_000),
  estimatedDevices: z.number().int().min(0).max(100_000),
  estimatedDailyServices: z.number().int().min(0).max(100_000_000),
  estimatedWarehouses: z.number().int().min(0).max(100_000),
  operates24Hours: z.boolean(),
  multiBranch: z.boolean(),
  requiresOffline: z.boolean(),
  estimatedMonthlyMovements: z.number().int().min(0).max(1_000_000_000).optional(),
  primaryNeed: z.string().trim().min(3).max(2_000),
  currentProblems: z.string().trim().max(4_000),
  currentSystems: z.string().trim().max(2_000),
  acquisitionSource: z.string().trim().max(160).optional(),
  nextAction: z.string().trim().min(3).max(500),
  nextActionAt: z.string().datetime({ offset: true }).optional(),
  allowPossibleDuplicate: z.boolean().optional(),
}).strict();

const pricingSelectionSchema = z.object({
  profileCode: z.string().trim().min(1).max(80),
  moduleCodes: z.array(z.string().trim().min(1).max(80)).min(1),
  featureCodes: z.array(z.string().trim().min(1).max(120)),
  quantities: z.object({
    branches: z.number().int().min(1), employees: z.number().int().min(0), users: z.number().int().min(1),
    devices: z.number().int().min(0), warehouses: z.number().int().min(0), monthlyMovements: z.number().int().min(0),
  }).strict(),
  implementationCodes: z.array(z.string()),
  supportCode: z.string().nullable(),
  trainingCodes: z.array(z.string()),
  hardware: z.array(z.object({ code: z.string(), quantity: z.number().int().min(1).max(10_000) }).strict()),
  billingCycle: z.enum(["monthly", "annual"]),
  taxRateBasisPoints: z.number().int().min(0).max(10_000),
}).strict();

const adjustmentSchema = z.object({
  type: z.enum(["percentage", "fixed"]),
  scope: z.enum(["subtotal", "recurring", "implementation", "line"]),
  value: z.number().int().min(0),
  reason: z.string().trim().min(3).max(1_000),
  lineCode: z.string().optional(),
}).strict();

const quoteDraftSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  prospectId: z.string().uuid(),
  priceBookId: z.string().min(1),
  priceBookVersionId: z.string().min(1),
  validUntil: z.string().datetime({ offset: true }),
  billingCycle: z.enum(["monthly", "annual"]),
  commercialTerms: z.string().trim().max(4_000),
  internalNotes: z.string().trim().max(4_000),
  customerNotes: z.string().trim().max(4_000),
  scopeAdjustmentReason: z.string().trim().max(1_000).optional(),
  selection: pricingSelectionSchema,
  adjustments: z.array(adjustmentSchema).max(20).default([]),
}).strict();

const prospectStatuses = ["new", "contacted", "discovery", "quoted", "negotiation", "won", "lost", "paused", "archived"] as const satisfies readonly ProspectStatus[];
const quoteStatuses = ["draft", "ready", "sent", "viewed", "accepted", "rejected", "expired", "cancelled"] as const satisfies readonly QuoteStatus[];

function invalid(error: z.ZodError): never {
  const issue = error.issues[0];
  throw new CommercialApplicationError(issue?.message ?? "Revisa los datos enviados.");
}

function parse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) invalid(result.error);
  return result.data;
}

export class CommercialApplicationService {
  private readonly repository = new D1CommercialRepository(new D1CommercialDataProvider());

  constructor(private readonly actor: PlatformActor) {}

  async initialize(): Promise<void> {
    await this.repository.ensureCatalog(this.actor.id);
  }

  async assertMutationRate(): Promise<void> {
    const provider = new D1CommercialDataProvider();
    const since = new Date(Date.now() - 60_000).toISOString();
    const row = await provider.first<{ count: number }>("SELECT COUNT(*) AS count FROM platform_audit_events WHERE platform_user_id = ? AND action LIKE 'commercial.%' AND created_at >= ?", [this.actor.id, since]);
    if ((row?.count ?? 0) >= 120) throw new CommercialApplicationError("Demasiadas operaciones en poco tiempo. Espera un minuto.", 429, "commercial_rate_limited");
  }

  async overview() {
    await this.initialize();
    await this.repository.expireDueQuotes(this.actor.id);
    return this.repository.getOverview();
  }

  async prospects(filters: URLSearchParams) {
    await this.initialize();
    const status = filters.get("status");
    const parsed: ProspectListFilters = {
      query: filters.get("query")?.slice(0, 200) || undefined,
      status: status && prospectStatuses.includes(status as ProspectStatus) ? status as ProspectStatus : undefined,
      businessType: filters.get("businessType")?.slice(0, 80) || undefined,
      ownerPlatformUserId: filters.get("owner")?.slice(0, 100) || undefined,
      followUp: filters.get("followUp") === "overdue" || filters.get("followUp") === "upcoming" ? filters.get("followUp") as "overdue" | "upcoming" : undefined,
      dateFrom: filters.get("dateFrom")?.slice(0, 40) || undefined,
      dateTo: filters.get("dateTo")?.slice(0, 40) || undefined,
      sort: filters.get("sort") === "created" || filters.get("sort") === "follow_up" ? filters.get("sort") as "created" | "follow_up" : "updated",
      page: Math.max(1, Number(filters.get("page")) || 1),
      pageSize: Math.min(100, Math.max(10, Number(filters.get("pageSize")) || 20)),
    };
    return this.repository.listProspects(parsed);
  }

  async prospect(id: string) {
    await this.initialize();
    const detail = await this.repository.getProspect(id);
    if (!detail) throw new CommercialApplicationError("No se encontró el prospecto.", 404, "prospect_not_found");
    return detail;
  }

  async createProspect(value: unknown) {
    await this.initialize();
    await this.assertMutationRate();
    const input = parse(prospectSchema, value) as ProspectCreateInput;
    const duplicates = await this.repository.findProspectDuplicates(input.commercialName, input.contactEmail, input.contactPhone);
    if (duplicates.length && !input.allowPossibleDuplicate) {
      throw new CommercialApplicationError(JSON.stringify({ message: "Encontré posibles duplicados. Revisa antes de continuar.", duplicates }), 409, "possible_duplicate");
    }
    return this.repository.createProspect(input, this.actor.id);
  }

  async updateProspect(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ id: z.string().uuid(), version: z.number().int().positive(), changes: z.record(z.string(), z.unknown()) }).strict(), value);
    await this.repository.updateProspect(input.id, input.version, input.changes, this.actor.id);
    return { updated: true };
  }

  async transitionProspect(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ id: z.string().uuid(), version: z.number().int().positive(), status: z.enum(prospectStatuses), reason: z.string().trim().max(1_000).nullable().optional() }).strict(), value);
    await this.repository.transitionProspect(input.id, input.version, input.status, input.reason ?? null, this.actor.id);
    return { updated: true };
  }

  async addContact(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ prospectId: z.string().uuid(), name: z.string().trim().min(2).max(160), position: z.string().trim().max(120), email: z.string().trim().email(), phone: z.string().trim().min(7).max(30), isPrimary: z.boolean() }).strict(), value);
    await this.repository.addContact(input.prospectId, input, this.actor.id);
    return { created: true };
  }

  async addNote(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ prospectId: z.string().uuid(), content: z.string().trim().min(2).max(4_000) }).strict(), value);
    await this.repository.addNote(input.prospectId, input.content, this.actor.id);
    return { created: true };
  }

  async addFollowUp(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ prospectId: z.string().uuid(), type: z.string().trim().min(2).max(60), scheduledAt: z.string().datetime({ offset: true }), description: z.string().trim().min(3).max(1_000) }).strict(), value);
    await this.repository.addFollowUp(input.prospectId, input, this.actor.id);
    return { created: true };
  }

  async completeFollowUp(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ id: z.string().uuid(), result: z.string().trim().min(2).max(2_000) }).strict(), value);
    await this.repository.completeFollowUp(input.id, input.result, this.actor.id);
    return { updated: true };
  }

  async saveDiagnosis(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ prospectId: z.string().uuid(), answers: z.record(z.string(), z.unknown()) }).strict(), value);
    await this.repository.saveDiagnosis(input.prospectId, input.answers, this.actor.id);
    return { updated: true };
  }

  async completeDiagnosis(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ prospectId: z.string().uuid() }).strict(), value);
    await this.repository.completeDiagnosis(input.prospectId, this.actor.id);
    return { updated: true };
  }

  async reviseDiagnosis(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ prospectId: z.string().uuid() }).strict(), value);
    await this.repository.reviseDiagnosis(input.prospectId, this.actor.id);
    return { created: true };
  }

  async catalog() {
    await this.initialize();
    return this.repository.getCatalog();
  }

  async priceBooks() {
    await this.initialize();
    return this.repository.listPriceBooks();
  }

  async priceBook(id: string, versionId?: string) {
    await this.initialize();
    const result = await this.repository.getPriceBook(id, versionId);
    if (!result) throw new CommercialApplicationError("No se encontró el catálogo de precios.", 404, "price_book_not_found");
    return result;
  }

  async updatePriceRule(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ priceBookId: z.string(), versionId: z.string(), ruleId: z.string(), unitAmountMinor: z.number().int().min(0), internalCostMinor: z.number().int().min(0).nullable() }).strict(), value);
    await this.repository.updatePriceRule(input.priceBookId, input.versionId, input.ruleId, input.unitAmountMinor, input.internalCostMinor, this.actor.id);
    return { updated: true };
  }

  async updatePriceTiers(value: unknown) {
    await this.assertMutationRate();
    const tier = z.object({ minimumQuantity: z.number().int().min(0), maximumQuantity: z.number().int().min(0).nullable(), unitAmountMinor: z.number().int().min(0), flatAmountMinor: z.number().int().min(0) }).strict();
    const input = parse(z.object({ priceBookId: z.string(), versionId: z.string(), ruleId: z.string(), tiers: z.array(tier).min(1).max(100) }).strict(), value);
    await this.repository.updatePriceTiers(input.priceBookId, input.versionId, input.ruleId, input.tiers, this.actor.id);
    return { updated: true };
  }

  async publishPriceBook(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ priceBookId: z.string(), versionId: z.string(), effectiveFrom: z.string().date(), notes: z.string().trim().min(3).max(2_000), confirmation: z.literal("PUBLICAR") }).strict(), value);
    await this.repository.publishPriceBookVersion(input.priceBookId, input.versionId, input.effectiveFrom, input.notes, this.actor.id);
    return { published: true };
  }

  async revisePriceBook(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({ priceBookId: z.string(), notes: z.string().trim().min(3).max(2_000) }).strict(), value);
    return { versionId: await this.repository.createPriceBookRevision(input.priceBookId, input.notes, this.actor.id) };
  }

  async quotes(filters: URLSearchParams) {
    await this.initialize();
    await this.repository.expireDueQuotes(this.actor.id);
    const status = filters.get("status");
    return this.repository.listQuotes({
      query: filters.get("query")?.slice(0, 200) || undefined,
      status: status && quoteStatuses.includes(status as QuoteStatus) ? status as QuoteStatus : undefined,
      ownerPlatformUserId: filters.get("owner")?.slice(0, 100) || undefined,
      currency: filters.get("currency")?.slice(0, 3) || undefined,
      businessType: filters.get("businessType")?.slice(0, 80) || undefined,
      validity: filters.get("validity") === "active" || filters.get("validity") === "expired" ? filters.get("validity") as "active" | "expired" : undefined,
      dateFrom: filters.get("dateFrom")?.slice(0, 40) || undefined,
      dateTo: filters.get("dateTo")?.slice(0, 40) || undefined,
    });
  }

  async quote(id: string) {
    await this.initialize();
    const result = await this.repository.getQuote(id);
    if (!result) throw new CommercialApplicationError("No se encontró la cotización.", 404, "quote_not_found");
    return result;
  }

  async customerQuote(id: string) {
    const quote = await this.quote(id);
    const version = quote.currentVersion;
    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      createdAt: quote.createdAt,
      prospectName: quote.prospectName,
      legalName: quote.legalName,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      status: quote.status,
      version: {
        versionNumber: version.versionNumber,
        currency: version.currency,
        validUntil: version.validUntil,
        billingCycle: version.billingCycle,
        commercialTerms: version.commercialTerms,
        customerNotes: version.customerNotes,
        subtotalOneTimeMinor: version.subtotalOneTimeMinor,
        subtotalRecurringMinor: version.subtotalRecurringMinor,
        discountTotalMinor: version.discountTotalMinor,
        taxTotalMinor: version.taxTotalMinor,
        totalOneTimeMinor: version.totalOneTimeMinor,
        monthlyTotalMinor: version.monthlyTotalMinor,
        annualTotalMinor: version.annualTotalMinor,
        firstPaymentMinor: version.firstPaymentMinor,
        lines: version.lines.map((line) => ({
          code: line.code,
          description: line.description,
          explanation: line.explanation,
          billingPeriod: line.billingPeriod,
          unitType: line.unitType,
          quantity: line.quantity,
          unitAmountMinor: line.unitAmountMinor,
          subtotalMinor: line.subtotalMinor,
          discountMinor: line.discountMinor,
          taxMinor: line.taxMinor,
          totalMinor: line.totalMinor,
          moduleCode: line.moduleCode,
          featureCode: line.featureCode,
        })),
      },
    };
  }

  async previewQuote(value: unknown) {
    await this.initialize();
    const input = parse(quoteDraftSchema, value);
    const calculated = await this.calculatedQuoteInput({ ...input, idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(), adjustments: input.adjustments ?? [] });
    return calculated.pricing;
  }

  async createQuote(value: unknown) {
    await this.initialize();
    await this.assertMutationRate();
    const input = parse(quoteDraftSchema, value);
    return this.persistCalculatedQuote({ ...input, idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(), adjustments: input.adjustments ?? [] });
  }

  async reviseQuote(value: unknown) {
    await this.initialize();
    await this.assertMutationRate();
    const input = parse(quoteDraftSchema.extend({ quoteId: z.string().uuid(), revisionReason: z.string().trim().min(3).max(1_000) }), value);
    const { quoteId, revisionReason, ...draft } = input;
    const persisted = await this.calculatedQuoteInput({ ...draft, idempotencyKey: draft.idempotencyKey ?? crypto.randomUUID(), adjustments: draft.adjustments ?? [] });
    await this.repository.reviseQuote(quoteId, { ...persisted, revisionReason }, this.actor.id);
    return { updated: true };
  }

  private async persistCalculatedQuote(input: z.infer<typeof quoteDraftSchema> & { idempotencyKey: string }) {
    const persisted = await this.calculatedQuoteInput(input);
    return this.repository.createQuote(persisted, this.actor.id);
  }

  private async calculatedQuoteInput(input: z.infer<typeof quoteDraftSchema> & { idempotencyKey: string }) {
    const [prospect, catalog, priceBook] = await Promise.all([
      this.repository.getProspect(input.prospectId),
      this.repository.getCatalog(),
      this.repository.getPriceBook(input.priceBookId, input.priceBookVersionId),
    ]);
    if (!prospect) throw new CommercialApplicationError("No se encontró el prospecto.", 404, "prospect_not_found");
    if (!priceBook?.selectedVersion || priceBook.selectedVersion.id !== input.priceBookVersionId || priceBook.selectedVersion.status !== "published") {
      throw new CommercialApplicationError("Publica el catálogo de precios antes de crear una cotización comercial.", 409, "price_book_not_published");
    }
    if (priceBook.selectedVersion.rules.some((rule) => rule.currency !== priceBook.currency)) {
      throw new CommercialApplicationError("La moneda de una regla no coincide con el catálogo publicado.", 409, "pricing_currency_mismatch");
    }
    if (new Date(input.validUntil).getTime() <= Date.now()) throw new CommercialApplicationError("La vigencia debe terminar en una fecha futura.");
    const moduleCodes = [...new Set(input.selection.moduleCodes)];
    if (!moduleCodes.includes("core")) moduleCodes.unshift("core");
    const recommendedModules = [...new Set(["core", ...prospect.recommendedModuleCodes])].sort();
    const selectedModules = [...moduleCodes].sort();
    const scopeChanged = recommendedModules.length !== selectedModules.length || recommendedModules.some((code, index) => code !== selectedModules[index]);
    if (scopeChanged && !input.scopeAdjustmentReason?.trim()) {
      throw new CommercialApplicationError("Explica por qué el alcance difiere de la recomendación del diagnóstico.", 409, "scope_adjustment_reason_required");
    }
    const missingModules = moduleCodes.filter((code) => !catalog.some((module) => module.code === code && module.status === "active"));
    if (missingModules.length) throw new CommercialApplicationError(`Módulos no disponibles: ${missingModules.join(", ")}.`);
    for (const code of moduleCodes) {
      const moduleEntry = catalog.find((item) => item.code === code);
      const missing = moduleEntry?.dependencies.filter((dependency) => !moduleCodes.includes(dependency)) ?? [];
      if (missing.length) throw new CommercialApplicationError(`${moduleEntry?.name ?? code} requiere ${missing.join(", ")}.`);
    }
    for (const featureCode of input.selection.featureCodes) {
      const owner = catalog.find((module) => module.features.some((feature) => feature.code === featureCode));
      if (!owner || !moduleCodes.includes(owner.code)) throw new CommercialApplicationError(`La característica ${featureCode} requiere su módulo activo.`);
    }
    const selection: PricingSelection = { ...input.selection, moduleCodes };
    const adjustments = input.adjustments as PricingAdjustmentInput[];
    const pricing = calculatePricing({ currency: priceBook.currency, rules: priceBook.selectedVersion.rules, selection, adjustments });
    let previousDiscount = 0;
    const storedAdjustments = adjustments.map((adjustment, index) => {
      const partial = calculatePricing({ currency: priceBook.currency, rules: priceBook.selectedVersion!.rules, selection, adjustments: adjustments.slice(0, index + 1) });
      const currentDiscount = partial.discountOneTimeMinor + partial.discountRecurringMinor;
      const amountMinor = currentDiscount - previousDiscount;
      previousDiscount = currentDiscount;
      return { ...adjustment, amountMinor };
    });
    const primaryContact = prospect.contacts.find((contact) => contact.isPrimary && contact.status === "active") ?? prospect.contacts.find((contact) => contact.status === "active");
    if (!primaryContact) throw new CommercialApplicationError("El prospecto necesita un contacto activo para cotizar.", 409, "quote_contact_required");
    return {
      ...input,
      contactId: primaryContact.id,
      diagnosisId: prospect.diagnosis?.id ?? null,
      commercialNameSnapshot: prospect.commercialName,
      contactSnapshot: {
        id: primaryContact.id,
        name: primaryContact.name,
        position: primaryContact.position,
        email: primaryContact.email,
        phone: primaryContact.phone,
      },
      selection,
      pricing,
      adjustments: storedAdjustments,
    };
  }

  async transitionQuote(value: unknown) {
    await this.assertMutationRate();
    const input = parse(z.object({
      id: z.string().uuid(),
      version: z.number().int().positive(),
      status: z.enum(quoteStatuses),
      reason: optionalTrimmed,
      deliveryMethod: z.enum(["email", "whatsapp", "meeting", "other"]).optional(),
      recipient: z.string().trim().max(300).optional(),
      confirmedBy: z.string().trim().max(300).optional(),
      effectiveAt: z.string().datetime({ offset: true }).optional(),
      markProspectLost: z.boolean().optional(),
    }).strict(), value);
    await this.repository.transitionQuote(input.id, input.version, input.status, input, this.actor.id);
    return { updated: true };
  }
}
