import "server-only";
import {
  BUSINESS_PROFILE_MODULES,
  COMMERCIAL_FEATURES,
  COMMERCIAL_MODULES,
  DIAGNOSIS_QUESTIONS,
  INITIAL_PRICE_RULES,
} from "@/constants/commercial-catalog";
import { validatePriceTiers } from "@/rules/pricing.rules";
import type {
  CalculatedQuoteLine,
  CommercialModule,
  CommercialOverview,
  Diagnosis,
  DiagnosisAnswer,
  DiagnosisQuestion,
  PriceBookDetail,
  PriceBookSummary,
  PriceRule,
  PriceTier,
  PricingResult,
  PricingSelection,
  ProspectContact,
  ProspectCreateInput,
  ProspectDetail,
  ProspectStatus,
  ProspectSummary,
  QuoteAdjustment,
  QuoteDetail,
  QuoteStatus,
  QuoteSummary,
  QuoteVersionDetail,
} from "@/types";
import type {
  CommercialDataProvider,
  CommercialRepository,
  ProspectDuplicate,
  ProspectListFilters,
  ProspectListResult,
  QuoteListFilters,
  QuoteTransitionInput,
  SqlCommand,
} from "./commercial.contracts";

interface ProspectRow extends Omit<ProspectSummary, "operates24Hours" | "multiBranch" | "requiresOffline"> {
  operates24Hours: number;
  multiBranch: number;
  requiresOffline: number;
}

interface ProspectDetailRow extends ProspectRow {
  contactPosition: string | null;
  state: string | null;
  estimatedMonthlyMovements: number | null;
  primaryNeed: string;
  currentProblems: string;
  currentSystems: string;
  acquisitionSource: string | null;
}

interface DiagnosisRow extends Omit<Diagnosis, "answers"> {
  templateVersion: number;
}

interface QuestionRow extends Omit<DiagnosisQuestion, "required" | "options" | "validationRules" | "visibilityCondition"> {
  required: number;
  optionsJson: string;
  validationRulesJson: string | null;
  visibilityConditionJson: string | null;
}

interface FeatureRow {
  id: string;
  code: string;
  moduleId: string;
  name: string;
  description: string;
  unitType: CommercialModule["features"][number]["unitType"];
  billable: number;
  configurable: number;
  status: "active" | "inactive";
}

interface ContactRow extends Omit<ProspectContact, "isPrimary"> {
  isPrimary: number;
}

type ModuleRow = Omit<CommercialModule, "features" | "dependencies">;

interface PriceRuleRow extends Omit<PriceRule, "active"> { active: number }

interface QuotePersistenceInput {
  prospectId: string;
  contactId: string | null;
  diagnosisId: string | null;
  commercialNameSnapshot: string;
  contactSnapshot: {
    id: string | null;
    name: string;
    position: string;
    email: string;
    phone: string;
  };
  idempotencyKey: string;
  revisionReason?: string;
  scopeAdjustmentReason?: string;
  priceBookVersionId: string;
  validUntil: string;
  billingCycle: "monthly" | "annual";
  commercialTerms: string;
  internalNotes: string;
  customerNotes: string;
  selection: PricingSelection;
  pricing: PricingResult;
  adjustments: Array<{ type: "percentage" | "fixed"; scope: "subtotal" | "recurring" | "implementation" | "line"; value: number; amountMinor: number; reason: string; lineCode?: string }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function businessTypeLabel(value: string): string {
  return ({
    street_food: "Puesto o taquería", cafe: "Cafetería o panadería", restaurant: "Restaurante",
    dark_kitchen: "Dark kitchen", central_kitchen: "Cocina central o catering", industrial_canteen: "Comedor industrial",
    institutional: "Operación institucional", other: "Otro",
  } as Record<string, string>)[value] ?? value;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function bool(value: number | boolean): boolean {
  return value === true || value === 1;
}

function mapProspect(row: ProspectRow): ProspectSummary {
  return { ...row, operates24Hours: bool(row.operates24Hours), multiBranch: bool(row.multiBranch), requiresOffline: bool(row.requiresOffline) };
}

function auditCommand(
  platformUserId: string,
  action: string,
  entity: string,
  entityId: string | null,
  reason?: string,
  metadata?: Record<string, unknown>,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): SqlCommand {
  return {
    sql: `INSERT INTO platform_audit_events
      (id, platform_user_id, action, entity, entity_id, outcome, reason, before_json, after_json, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?)`,
    values: [crypto.randomUUID(), platformUserId, action, entity, entityId, reason ?? null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, metadata ? JSON.stringify(metadata) : null, nowIso()],
  };
}

function prospectSelect(): string {
  return `SELECT p.id, p.legal_name AS legalName, p.commercial_name AS commercialName,
    p.business_profile_id AS businessProfileId, p.business_type AS businessType,
    p.contact_name AS contactName, p.contact_email AS contactEmail, p.contact_phone AS contactPhone,
    p.city, p.country_code AS countryCode, p.estimated_branches AS estimatedBranches,
    p.estimated_employees AS estimatedEmployees, p.estimated_admin_users AS estimatedAdminUsers,
    p.estimated_devices AS estimatedDevices, p.estimated_daily_services AS estimatedDailyServices,
    p.estimated_warehouses AS estimatedWarehouses, p.operates_24_hours AS operates24Hours,
    p.multi_branch AS multiBranch, p.requires_offline AS requiresOffline, p.status, p.lost_reason AS lostReason,
    p.next_action AS nextAction, p.next_action_at AS nextActionAt, p.owner_platform_user_id AS ownerPlatformUserId,
    owner.display_name AS ownerName, p.created_at AS createdAt, p.updated_at AS updatedAt,
    p.version, p.archived_at AS archivedAt
    FROM prospects p JOIN platform_users owner ON owner.id = p.owner_platform_user_id`;
}

function quoteSummarySelect(): string {
  return `SELECT q.id, q.quote_number AS quoteNumber, q.prospect_id AS prospectId,
    qv.commercial_name_snapshot AS prospectName, q.status, qv.version_number AS currentVersionNumber,
    q.currency, qv.monthly_total_minor AS monthlyTotalMinor, qv.total_one_time_minor AS oneTimeTotalMinor,
    q.valid_until AS validUntil, q.sent_at AS sentAt, q.accepted_at AS acceptedAt,
    q.owner_platform_user_id AS ownerPlatformUserId, owner.display_name AS ownerName,
    q.created_at AS createdAt, q.updated_at AS updatedAt, q.version
    FROM quotes q
    JOIN prospects p ON p.id = q.prospect_id
    JOIN quote_versions qv ON qv.id = q.current_version_id
    JOIN platform_users owner ON owner.id = q.owner_platform_user_id`;
}

async function batched(provider: CommercialDataProvider, commands: SqlCommand[]): Promise<void> {
  for (let index = 0; index < commands.length; index += 75) await provider.batch(commands.slice(index, index + 75));
}

function asQuoteInput(input: Record<string, unknown>): QuotePersistenceInput {
  return input as unknown as QuotePersistenceInput;
}

export class D1CommercialRepository implements CommercialRepository {
  constructor(private readonly provider: CommercialDataProvider) {}

  async ensureCatalog(platformUserId: string): Promise<void> {
    const expectedRecommendations = Object.values(BUSINESS_PROFILE_MODULES).reduce((sum, modules) => sum + modules.length, 0);
    const state = await this.provider.first<{ modules: number; features: number; questions: number; rules: number; books: number; plans: number; planFeatures: number; recommendations: number; pricedItems: number }>(`SELECT
      (SELECT COUNT(*) FROM modules) AS modules,
      (SELECT COUNT(*) FROM features) AS features,
      (SELECT COUNT(*) FROM diagnosis_questions WHERE template_id = 'diagnosis-template-v1') AS questions,
      (SELECT COUNT(*) FROM price_rules WHERE price_book_version_id = 'price-book-mx-default-v1') AS rules,
      (SELECT COUNT(*) FROM price_books WHERE id = 'price-book-mx-default') AS books,
      (SELECT COUNT(*) FROM plans) AS plans,
      (SELECT COUNT(*) FROM plan_features WHERE plan_id = 'commercial-plan-industrial') AS planFeatures,
      (SELECT COUNT(*) FROM business_profile_recommendations) AS recommendations,
      ((SELECT COUNT(*) FROM setup_fees) + (SELECT COUNT(*) FROM support_levels) + (SELECT COUNT(*) FROM hardware_items) + (SELECT COUNT(*) FROM training_items) + (SELECT COUNT(*) FROM import_services)) AS pricedItems`);
    if ((state?.modules ?? 0) >= COMMERCIAL_MODULES.length
      && (state?.features ?? 0) >= COMMERCIAL_FEATURES.length
      && (state?.questions ?? 0) >= DIAGNOSIS_QUESTIONS.length
      && (state?.rules ?? 0) >= INITIAL_PRICE_RULES.length
      && state?.books === 1
      && (state?.plans ?? 0) >= 3
      && (state?.planFeatures ?? 0) >= COMMERCIAL_FEATURES.length
      && (state?.recommendations ?? 0) >= expectedRecommendations
      && (state?.pricedItems ?? 0) >= 5) return;
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    commands.push({ sql: `INSERT OR IGNORE INTO diagnosis_templates (id, code, name, version, status, created_at, created_by) VALUES ('diagnosis-template-v1', 'commercial-discovery', 'Diagnóstico comercial KitchenMind', 1, 'active', ?, ?)`, values: [timestamp, platformUserId] });
    COMMERCIAL_MODULES.forEach((module) => commands.push({
      sql: `INSERT OR IGNORE INTO modules (id, code, name, description, category, status, display_order, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, 1)`,
      values: [`commercial-module-${module.code}`, module.code, module.name, module.description, module.category, module.displayOrder, timestamp, timestamp],
    }));
    COMMERCIAL_FEATURES.forEach((feature) => {
      const featureId = `commercial-feature-${feature.code}`;
      const moduleId = `commercial-module-${feature.moduleCode}`;
      commands.push({
        sql: `INSERT OR IGNORE INTO features (id, code, module_id, name, description, unit_type, billable, configurable, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)`,
        values: [featureId, feature.code, moduleId, feature.name, feature.description, feature.unitType, feature.billable ? 1 : 0, timestamp, timestamp],
      });
      commands.push({ sql: `INSERT OR IGNORE INTO module_features (module_id, feature_id, created_at) VALUES (?, ?, ?)`, values: [moduleId, featureId, timestamp] });
    });
    COMMERCIAL_MODULES.filter((module) => module.code !== "core").forEach((module) => commands.push({
      sql: `INSERT OR IGNORE INTO module_dependencies (module_id, required_module_id, reason, created_at) VALUES (?, 'commercial-module-core', 'CORE contiene organización, seguridad y configuración necesarias.', ?)`,
      values: [`commercial-module-${module.code}`, timestamp],
    }));
    [
      ["commercial-plan-essential", "essential", "Esencial", "Núcleo comercial para una operación pequeña."],
      ["commercial-plan-operation", "operation", "Operación", "Módulos operativos configurables para restaurantes y comedores."],
      ["commercial-plan-industrial", "industrial", "Industrial", "Alcance multisucursal y controles avanzados."],
    ].forEach(([id, code, name, description]) => commands.push({
      sql: `INSERT OR IGNORE INTO plans (id, code, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      values: [id, code, name, description, timestamp, timestamp],
    }));
    COMMERCIAL_FEATURES.forEach((feature) => commands.push({
      sql: `INSERT OR IGNORE INTO plan_features (plan_id, feature_id, included_quantity, created_at) VALUES ('commercial-plan-industrial', ?, NULL, ?)`,
      values: [`commercial-feature-${feature.code}`, timestamp],
    }));
    Object.entries(BUSINESS_PROFILE_MODULES).forEach(([profile, moduleCodes]) => moduleCodes.forEach((moduleCode, priority) => commands.push({
      sql: `INSERT OR IGNORE INTO business_profile_recommendations (id, business_profile_code, module_id, feature_id, priority, reason, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?)`,
      values: [`profile-rec-${profile}-${moduleCode}`, profile, `commercial-module-${moduleCode}`, priority + 1, `Configuración inicial recomendada para ${profile}.`, timestamp],
    })));
    DIAGNOSIS_QUESTIONS.forEach((question, displayOrder) => commands.push({
      sql: `INSERT OR IGNORE INTO diagnosis_questions
        (id, template_id, section_code, question_code, label, field_type, required, options_json, display_order, module_code, feature_code, active, version)
        VALUES (?, 'diagnosis-template-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      values: [`diagnosis-question-v1-${question.questionCode}`, question.sectionCode, question.questionCode, question.label, question.fieldType, question.required ? 1 : 0, JSON.stringify(question.options ?? []), displayOrder + 1, question.moduleCode ?? null, question.featureCode ?? null],
    }));
    commands.push({
      sql: `INSERT OR IGNORE INTO price_books (id, name, currency, country_code, status, active_version_id, created_at, updated_at, created_by) VALUES ('price-book-mx-default', 'KitchenMind México', 'MXN', 'MX', 'active', NULL, ?, ?, ?)`,
      values: [timestamp, timestamp, platformUserId],
    }, {
      sql: `INSERT OR IGNORE INTO price_book_versions (id, price_book_id, version_number, status, effective_from, notes, created_at, created_by) VALUES ('price-book-mx-default-v1', 'price-book-mx-default', 1, 'draft', ?, 'Importado desde presets demostrativos. Requiere revisión y publicación explícita.', ?, ?)`,
      values: [timestamp.slice(0, 10), timestamp, platformUserId],
    });
    INITIAL_PRICE_RULES.forEach((rule) => {
      const ruleId = `price-rule-v1-${rule.code}`;
      commands.push({
        sql: `INSERT OR IGNORE INTO price_rules
          (id, price_book_version_id, code, name, description, charge_type, billing_period, unit_type, module_code, feature_code, unit_amount_minor, currency, minimum_quantity, maximum_quantity, priority, stacking_mode, active, internal_cost_minor, created_at, updated_at)
          VALUES (?, 'price-book-mx-default-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', ?, ?, ?, ?, 1, ?, ?, ?)`,
        values: [ruleId, rule.code, rule.name, rule.description, rule.chargeType, rule.billingPeriod, rule.unitType, rule.moduleCode ?? null, rule.featureCode ?? null, rule.unitAmountMinor, rule.minimumQuantity ?? 0, rule.maximumQuantity ?? null, rule.priority, rule.stackingMode ?? "add", rule.internalCostMinor ?? null, timestamp, timestamp],
      });
      rule.tiers?.forEach((tier, index) => commands.push({
        sql: `INSERT OR IGNORE INTO price_tiers (id, price_rule_id, minimum_quantity, maximum_quantity, unit_amount_minor, flat_amount_minor) VALUES (?, ?, ?, ?, ?, ?)`,
        values: [`price-tier-v1-${rule.code}-${index + 1}`, ruleId, tier.minimumQuantity, tier.maximumQuantity ?? null, tier.unitAmountMinor ?? 0, tier.flatAmountMinor ?? 0],
      }));
    });
    const pricedItems = [
      ["setup_fees", "setup.standard", "Implementación estándar", "Configuración y activación inicial.", 450000, "one_time"],
      ["support_levels", "support.priority", "Soporte prioritario", "Atención prioritaria mensual.", 149000, "monthly"],
      ["hardware_items", "hardware.reader", "Lector HID", "Lector genérico compatible.", 95000, "one_time"],
      ["training_items", "training.remote", "Capacitación remota", "Sesión remota para administradores.", 180000, "one_time"],
      ["import_services", "import.initial", "Importación inicial", "Validación e importación de datos.", 250000, "one_time"],
    ];
    pricedItems.forEach(([table, code, name, description, amount, period]) => commands.push({
      sql: `INSERT OR IGNORE INTO ${table} (id, code, name, description, unit_amount_minor, currency, billing_period, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'MXN', ?, 1, ?, ?)`,
      values: [`${table}-${code}`, code, name, description, amount, period, timestamp, timestamp],
    }));
    await batched(this.provider, commands);
  }

  async getOverview(): Promise<CommercialOverview> {
    const timestamp = nowIso();
    const inSevenDays = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const metrics = await this.provider.first<{
      newProspects: number; activeOpportunities: number; pendingQuotes: number; acceptedQuotes: number;
      diagnosesInProgress: number; draftQuotes: number; expiredQuotes: number;
      overdueFollowUps: number; upcomingFollowUps: number; quotedMonthlyMinor: number; acceptedMonthlyMinor: number;
      quotedImplementationMinor: number; acceptedImplementationMinor: number;
    }>(`SELECT
      (SELECT COUNT(*) FROM prospects WHERE status = 'new' AND archived_at IS NULL) AS newProspects,
      (SELECT COUNT(*) FROM prospects WHERE status IN ('contacted','discovery','quoted','negotiation','paused') AND archived_at IS NULL) AS activeOpportunities,
      (SELECT COUNT(*) FROM diagnoses WHERE status IN ('draft','in_progress')) AS diagnosesInProgress,
      (SELECT COUNT(*) FROM quotes WHERE status = 'draft') AS draftQuotes,
      (SELECT COUNT(*) FROM quotes WHERE status IN ('ready','sent','viewed')) AS pendingQuotes,
      (SELECT COUNT(*) FROM quotes WHERE status = 'accepted') AS acceptedQuotes,
      (SELECT COUNT(*) FROM quotes WHERE status = 'expired') AS expiredQuotes,
      (SELECT COUNT(*) FROM follow_ups WHERE status = 'pending' AND scheduled_at < ?) AS overdueFollowUps,
      (SELECT COUNT(*) FROM follow_ups WHERE status = 'pending' AND scheduled_at >= ? AND scheduled_at <= ?) AS upcomingFollowUps,
      (SELECT COALESCE(SUM(qv.monthly_total_minor), 0) FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id WHERE q.status IN ('ready','sent','viewed')) AS quotedMonthlyMinor,
      (SELECT COALESCE(SUM(qv.monthly_total_minor), 0) FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id WHERE q.status = 'accepted') AS acceptedMonthlyMinor,
      (SELECT COALESCE(SUM(qv.total_one_time_minor), 0) FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id WHERE q.status IN ('ready','sent','viewed')) AS quotedImplementationMinor,
      (SELECT COALESCE(SUM(qv.total_one_time_minor), 0) FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id WHERE q.status = 'accepted') AS acceptedImplementationMinor`, [timestamp, timestamp, inSevenDays]);
    const recent = await this.provider.all<ProspectRow>(`${prospectSelect()} WHERE p.archived_at IS NULL ORDER BY p.updated_at DESC LIMIT 5`);
    const attentionRows = await this.provider.all<{ id: string; type: string; title: string; detail: string; href: string }>(`SELECT id, type, title, detail, href FROM (
      SELECT f.id, 'follow_up' AS type, p.commercial_name AS title,
        'Seguimiento vencido: ' || f.description AS detail, '/platform/prospectos/' || p.id AS href, f.scheduled_at AS sort_at
        FROM follow_ups f JOIN prospects p ON p.id = f.prospect_id
        WHERE f.status = 'pending' AND f.scheduled_at < ?
      UNION ALL
      SELECT q.id, 'quote' AS type, qv.commercial_name_snapshot AS title,
        'La cotización ' || q.quote_number || ' vence pronto.' AS detail, '/platform/cotizaciones/' || q.id AS href, q.valid_until AS sort_at
        FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id
        WHERE q.status IN ('ready','sent','viewed') AND q.valid_until >= ? AND q.valid_until <= ?
      UNION ALL
      SELECT d.id, 'diagnosis' AS type, p.commercial_name AS title,
        'Diagnóstico en proceso: ' || d.completion_percentage || '% completado.' AS detail, '/platform/prospectos/' || p.id AS href, d.updated_at AS sort_at
        FROM diagnoses d JOIN prospects p ON p.id = d.prospect_id
        WHERE d.status IN ('draft','in_progress')
      ) ORDER BY sort_at ASC LIMIT 8`, [timestamp, timestamp, inSevenDays]);
    const currency = (await this.provider.first<{ currency: string }>("SELECT currency FROM price_books WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1"))?.currency ?? "MXN";
    return {
      newProspects: metrics?.newProspects ?? 0,
      activeOpportunities: metrics?.activeOpportunities ?? 0,
      diagnosesInProgress: metrics?.diagnosesInProgress ?? 0,
      draftQuotes: metrics?.draftQuotes ?? 0,
      pendingQuotes: metrics?.pendingQuotes ?? 0,
      acceptedQuotes: metrics?.acceptedQuotes ?? 0,
      expiredQuotes: metrics?.expiredQuotes ?? 0,
      overdueFollowUps: metrics?.overdueFollowUps ?? 0,
      upcomingFollowUps: metrics?.upcomingFollowUps ?? 0,
      quotedMonthlyMinor: metrics?.quotedMonthlyMinor ?? 0,
      acceptedMonthlyMinor: metrics?.acceptedMonthlyMinor ?? 0,
      quotedImplementationMinor: metrics?.quotedImplementationMinor ?? 0,
      acceptedImplementationMinor: metrics?.acceptedImplementationMinor ?? 0,
      currency,
      recentProspects: recent.map(mapProspect),
      attention: attentionRows.map((item) => ({ ...item, type: item.type as "follow_up" | "quote" | "diagnosis" })),
    };
  }

  async listProspects(filters: ProspectListFilters): Promise<ProspectListResult> {
    const clauses = ["p.archived_at IS NULL"];
    const values: unknown[] = [];
    if (filters.query) {
      clauses.push("(p.normalized_commercial_name LIKE ? OR lower(p.contact_name) LIKE ? OR p.normalized_contact_email LIKE ? OR p.normalized_contact_phone LIKE ?)");
      const query = `%${normalizeName(filters.query)}%`;
      const phone = normalizePhone(filters.query);
      values.push(query, query, query, phone ? `%${phone}%` : "__no_phone_match__");
    }
    if (filters.status) { clauses.push("p.status = ?"); values.push(filters.status); }
    if (filters.businessType) { clauses.push("p.business_type = ?"); values.push(filters.businessType); }
    if (filters.ownerPlatformUserId) { clauses.push("p.owner_platform_user_id = ?"); values.push(filters.ownerPlatformUserId); }
    if (filters.dateFrom) { clauses.push("p.created_at >= ?"); values.push(filters.dateFrom); }
    if (filters.dateTo) { clauses.push("p.created_at <= ?"); values.push(filters.dateTo); }
    if (filters.followUp) {
      clauses.push(`EXISTS (SELECT 1 FROM follow_ups f WHERE f.prospect_id = p.id AND f.status = 'pending' AND f.scheduled_at ${filters.followUp === "overdue" ? "<" : ">="} ?)`);
      values.push(nowIso());
    }
    const where = clauses.join(" AND ");
    const order = filters.sort === "created" ? "p.created_at DESC" : filters.sort === "follow_up" ? "COALESCE(p.next_action_at, '9999-12-31') ASC" : "p.updated_at DESC";
    const count = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM prospects p WHERE ${where}`, values);
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.provider.all<ProspectRow>(`${prospectSelect()} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...values, filters.pageSize, offset]);
    return { items: rows.map(mapProspect), total: count?.count ?? 0, page: filters.page, pageSize: filters.pageSize };
  }

  async findProspectDuplicates(name: string, email: string, phone: string): Promise<ProspectDuplicate[]> {
    const rows = await this.provider.all<{ id: string; commercialName: string; contactEmail: string; contactPhone: string; normalizedCommercialName: string; normalizedContactEmail: string; normalizedContactPhone: string }>(
      `SELECT id, commercial_name AS commercialName, contact_email AS contactEmail, contact_phone AS contactPhone,
       normalized_commercial_name AS normalizedCommercialName, normalized_contact_email AS normalizedContactEmail,
       normalized_contact_phone AS normalizedContactPhone FROM prospects
       WHERE archived_at IS NULL AND (normalized_commercial_name = ? OR normalized_contact_email = ? OR normalized_contact_phone = ?) LIMIT 10`,
      [normalizeName(name), normalizeEmail(email), normalizePhone(phone)],
    );
    return rows.map((row) => ({
      id: row.id, commercialName: row.commercialName, contactEmail: row.contactEmail, contactPhone: row.contactPhone,
      matches: [row.normalizedCommercialName === normalizeName(name) ? "empresa" : "", row.normalizedContactEmail === normalizeEmail(email) ? "correo" : "", row.normalizedContactPhone === normalizePhone(phone) ? "teléfono" : ""].filter(Boolean),
    }));
  }

  async createProspect(input: ProspectCreateInput, platformUserId: string): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const contactId = crypto.randomUUID();
    const diagnosisId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [{
      sql: `INSERT INTO prospects
        (id, legal_name, commercial_name, normalized_commercial_name, business_profile_id, business_type, contact_name, contact_position,
         contact_phone, normalized_contact_phone, contact_email, normalized_contact_email, city, state, country_code,
         estimated_branches, estimated_employees, estimated_admin_users, estimated_devices, estimated_daily_services, estimated_warehouses,
         operates_24_hours, multi_branch, requires_offline, estimated_monthly_movements, primary_need, current_problems, current_systems,
         acquisition_source, status, next_action, next_action_at, owner_platform_user_id, created_at, updated_at, created_by, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, 1)`,
      values: [id, input.legalName?.trim() || null, input.commercialName.trim(), normalizeName(input.commercialName), input.businessProfileId ?? null,
        input.businessType, input.contactName.trim(), input.contactPosition?.trim() || null, input.contactPhone.trim(), normalizePhone(input.contactPhone),
        normalizeEmail(input.contactEmail), normalizeEmail(input.contactEmail), input.city.trim(), input.state?.trim() || null, input.countryCode.toUpperCase(),
        input.estimatedBranches, input.estimatedEmployees, input.estimatedAdminUsers, input.estimatedDevices, input.estimatedDailyServices,
        input.estimatedWarehouses, input.operates24Hours ? 1 : 0, input.multiBranch ? 1 : 0, input.requiresOffline ? 1 : 0,
        input.estimatedMonthlyMovements ?? null, input.primaryNeed.trim(), input.currentProblems.trim(), input.currentSystems.trim(), input.acquisitionSource?.trim() || null,
        input.nextAction.trim(), input.nextActionAt ?? null, platformUserId, timestamp, timestamp, platformUserId],
    }, {
      sql: `INSERT INTO prospect_contacts (id, prospect_id, name, position, email, normalized_email, phone, normalized_phone, is_primary, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, ?)`,
      values: [contactId, id, input.contactName.trim(), input.contactPosition?.trim() ?? "", normalizeEmail(input.contactEmail), normalizeEmail(input.contactEmail), input.contactPhone.trim(), normalizePhone(input.contactPhone), timestamp, timestamp, platformUserId],
    }, {
      sql: `INSERT INTO diagnoses (id, prospect_id, template_id, version_number, status, completion_percentage, started_at, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, 'diagnosis-template-v1', 1, 'in_progress', 0, ?, ?, ?, ?, ?)`,
      values: [diagnosisId, id, timestamp, platformUserId, platformUserId, timestamp, timestamp],
    }];
    const prefill: Record<string, unknown> = {
      business_type: businessTypeLabel(input.businessType),
      current_branches: input.estimatedBranches,
      planned_branches: input.estimatedBranches,
      employees: input.estimatedEmployees,
      admin_users: input.estimatedAdminUsers,
      devices: input.estimatedDevices,
      warehouses: input.estimatedWarehouses,
      daily_services: input.estimatedDailyServices,
      operates_24_hours: input.operates24Hours,
      multi_branch: input.multiBranch,
      requires_offline: input.requiresOffline,
      monthly_movements: input.estimatedMonthlyMovements ?? null,
      country: input.countryCode.toUpperCase(),
      currency: input.countryCode.toUpperCase() === "MX" ? "MXN" : "USD",
      timezone: input.countryCode.toUpperCase() === "MX" ? "America/Mexico_City" : "UTC",
    };
    Object.entries(prefill).filter(([, value]) => value !== null).forEach(([questionCode, value]) => commands.push({
      sql: `INSERT INTO diagnosis_answers (id, diagnosis_id, question_id, value_json, source, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, 'prospect', ?, ?, ?)`,
      values: [crypto.randomUUID(), diagnosisId, `diagnosis-question-v1-${questionCode}`, JSON.stringify(value), timestamp, timestamp, platformUserId],
    }));
    commands.push({ sql: `UPDATE diagnoses SET completion_percentage = (SELECT CAST(ROUND(100.0 * SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*)) AS INTEGER) FROM diagnosis_questions q LEFT JOIN diagnosis_answers a ON a.question_id = q.id AND a.diagnosis_id = ? WHERE q.template_id = 'diagnosis-template-v1' AND q.active = 1 AND q.required = 1) WHERE id = ?`, values: [diagnosisId, diagnosisId] });
    commands.push(auditCommand(platformUserId, "commercial.prospect.created", "prospect", id, "Alta de prospecto y diagnóstico inicial sin recaptura."));
    if (input.allowPossibleDuplicate) commands.push(auditCommand(platformUserId, "commercial.prospect.possible_duplicate_ignored", "prospect", id, "La fundadora revisó la advertencia y continuó con el alta."));
    await this.provider.batch(commands);
    return { id };
  }

  async getProspect(id: string): Promise<ProspectDetail | null> {
    const detailSelect = prospectSelect().replace(
      " FROM prospects p",
      ", p.contact_position AS contactPosition, p.state, p.estimated_monthly_movements AS estimatedMonthlyMovements, p.primary_need AS primaryNeed, p.current_problems AS currentProblems, p.current_systems AS currentSystems, p.acquisition_source AS acquisitionSource FROM prospects p",
    );
    const row = await this.provider.first<ProspectDetailRow>(`${detailSelect} WHERE p.id = ? LIMIT 1`, [id]);
    if (!row) return null;
    const [contacts, notes, followUps, diagnosisRow, questions, quotes, activity, profileRecommendations] = await Promise.all([
      this.provider.all<ContactRow>(`SELECT id, prospect_id AS prospectId, name, position, email, phone, is_primary AS isPrimary, status, created_at AS createdAt, updated_at AS updatedAt, created_by AS createdBy FROM prospect_contacts WHERE prospect_id = ? ORDER BY is_primary DESC, created_at ASC`, [id]),
      this.provider.all<{ id: string; prospectId: string; authorPlatformUserId: string; authorName: string; content: string; createdAt: string; updatedAt: string | null; editedAt: string | null }>(`SELECT n.id, n.prospect_id AS prospectId, n.author_platform_user_id AS authorPlatformUserId, u.display_name AS authorName, n.content, n.created_at AS createdAt, n.updated_at AS updatedAt, n.edited_at AS editedAt FROM commercial_notes n JOIN platform_users u ON u.id = n.author_platform_user_id WHERE n.prospect_id = ? ORDER BY n.created_at DESC`, [id]),
      this.provider.all<{ id: string; prospectId: string; type: string; scheduledAt: string; responsiblePlatformUserId: string; responsibleName: string; description: string; status: "pending" | "completed" | "cancelled"; result: string | null; completedAt: string | null; createdAt: string; updatedAt: string; createdBy: string }>(`SELECT f.id, f.prospect_id AS prospectId, f.type, f.scheduled_at AS scheduledAt, f.responsible_platform_user_id AS responsiblePlatformUserId, u.display_name AS responsibleName, f.description, f.status, f.result, f.completed_at AS completedAt, f.created_at AS createdAt, f.updated_at AS updatedAt, f.created_by AS createdBy FROM follow_ups f JOIN platform_users u ON u.id = f.responsible_platform_user_id WHERE f.prospect_id = ? ORDER BY f.scheduled_at DESC`, [id]),
      this.provider.first<DiagnosisRow>(`SELECT d.id, d.prospect_id AS prospectId, d.version_number AS versionNumber, t.version AS templateVersion, d.status, d.completion_percentage AS completionPercentage, d.started_at AS startedAt, d.completed_at AS completedAt, d.created_by AS createdBy, d.updated_by AS updatedBy, d.created_at AS createdAt, d.updated_at AS updatedAt FROM diagnoses d JOIN diagnosis_templates t ON t.id = d.template_id WHERE d.prospect_id = ? AND d.status NOT IN ('superseded','cancelled') ORDER BY d.version_number DESC LIMIT 1`, [id]),
      this.provider.all<QuestionRow>(`SELECT q.id, t.version AS templateVersion, q.section_code AS sectionCode, q.question_code AS questionCode, q.label, q.description, q.field_type AS fieldType, q.required, q.options_json AS optionsJson, q.display_order AS displayOrder, q.validation_rules_json AS validationRulesJson, q.visibility_condition_json AS visibilityConditionJson, q.module_code AS moduleCode, q.feature_code AS featureCode FROM diagnosis_questions q JOIN diagnosis_templates t ON t.id = q.template_id WHERE q.template_id = 'diagnosis-template-v1' AND q.active = 1 ORDER BY q.display_order`, []),
      this.listQuotesForProspect(id),
      this.provider.all<{ id: string; action: string; reason: string | null; createdAt: string; actorName: string }>(`SELECT a.id, a.action, a.reason, a.created_at AS createdAt, COALESCE(u.display_name, 'Sistema') AS actorName FROM platform_audit_events a LEFT JOIN platform_users u ON u.id = a.platform_user_id WHERE (a.entity = 'prospect' AND a.entity_id = ?) OR json_extract(a.metadata_json, '$.prospectId') = ? ORDER BY a.created_at DESC LIMIT 30`, [id, id]),
      this.provider.all<{ moduleCode: string }>(`SELECT m.code AS moduleCode FROM business_profile_recommendations r JOIN modules m ON m.id = r.module_id WHERE r.business_profile_code = ? ORDER BY r.priority`, [row.businessType]),
    ]);
    let diagnosis: Diagnosis | null = null;
    if (diagnosisRow) {
      const answerRows = await this.provider.all<{ questionId: string; questionCode: string; valueJson: string | null; source: DiagnosisAnswer["source"]; updatedAt: string }>(`SELECT a.question_id AS questionId, q.question_code AS questionCode, a.value_json AS valueJson, a.source, a.updated_at AS updatedAt FROM diagnosis_answers a JOIN diagnosis_questions q ON q.id = a.question_id WHERE a.diagnosis_id = ?`, [diagnosisRow.id]);
      diagnosis = { ...diagnosisRow, answers: answerRows.map((answer) => ({ questionId: answer.questionId, questionCode: answer.questionCode, value: parseJson(answer.valueJson, null), source: answer.source, updatedAt: answer.updatedAt })) };
    }
    const mappedQuestions: DiagnosisQuestion[] = questions.map((question) => ({
      id: question.id, templateVersion: question.templateVersion, sectionCode: question.sectionCode, questionCode: question.questionCode,
      label: question.label, description: question.description, fieldType: question.fieldType, required: bool(question.required),
      options: parseJson(question.optionsJson, []), displayOrder: question.displayOrder,
      validationRules: parseJson(question.validationRulesJson, null), visibilityCondition: parseJson(question.visibilityConditionJson, null),
      moduleCode: question.moduleCode, featureCode: question.featureCode,
    }));
    const truthyCodes = new Set((diagnosis?.answers ?? []).filter((answer) => answer.value === true).map((answer) => answer.questionCode));
    const recommended = new Set<string>(["core", ...profileRecommendations.map((item) => item.moduleCode)]);
    mappedQuestions.forEach((question) => { if (question.moduleCode && truthyCodes.has(question.questionCode)) recommended.add(question.moduleCode); });
    return {
      ...mapProspect(row), contactPosition: row.contactPosition, state: row.state, estimatedMonthlyMovements: row.estimatedMonthlyMovements,
      primaryNeed: row.primaryNeed, currentProblems: row.currentProblems, currentSystems: row.currentSystems, acquisitionSource: row.acquisitionSource,
      contacts: contacts.map((contact) => ({ ...contact, isPrimary: bool(contact.isPrimary) })), notes, followUps, diagnosis,
      diagnosisQuestions: mappedQuestions, recommendedModuleCodes: [...recommended], quotes, activity,
    };
  }

  async updateProspect(id: string, version: number, changes: Record<string, unknown>, platformUserId: string): Promise<void> {
    const allowed: Record<string, string> = { nextAction: "next_action", nextActionAt: "next_action_at", primaryNeed: "primary_need", currentProblems: "current_problems", currentSystems: "current_systems", acquisitionSource: "acquisition_source" };
    const entries = Object.entries(changes).filter(([key]) => key in allowed);
    if (entries.length === 0) return;
    const timestamp = nowIso();
    const result = await this.provider.first<{ id: string }>(`UPDATE prospects SET ${entries.map(([key]) => `${allowed[key]} = ?`).join(", ")}, updated_at = ?, version = version + 1 WHERE id = ? AND version = ? AND archived_at IS NULL RETURNING id`, [...entries.map(([, value]) => typeof value === "string" ? value.trim() : value), timestamp, id, version]);
    if (!result) throw new Error("El prospecto cambió en otra sesión. Recarga antes de guardar.");
    await this.provider.batch([auditCommand(platformUserId, "commercial.prospect.updated", "prospect", id, "Actualización comercial con control de versión.", { fields: entries.map(([key]) => key).join(",") })]);
  }

  async transitionProspect(id: string, version: number, status: ProspectStatus, reason: string | null, platformUserId: string): Promise<void> {
    const current = await this.provider.first<{ status: ProspectStatus }>("SELECT status FROM prospects WHERE id = ? AND archived_at IS NULL", [id]);
    if (!current) throw new Error("No se encontró el prospecto.");
    if ((status === "lost" || status === "archived") && !reason?.trim()) throw new Error("Escribe el motivo de esta transición.");
    const timestamp = nowIso();
    const result = await this.provider.first<{ id: string }>(`UPDATE prospects SET status = ?, lost_reason = CASE WHEN ? = 'lost' THEN ? ELSE lost_reason END,
      archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ? RETURNING id`, [status, status, reason?.trim() ?? null, status, timestamp, timestamp, id, version]);
    if (!result) throw new Error("El prospecto cambió en otra sesión. Recarga antes de continuar.");
    await this.provider.batch([auditCommand(platformUserId, "commercial.prospect.status_changed", "prospect", id, reason ?? undefined, { from: current.status, to: status })]);
  }

  async addContact(prospectId: string, input: { name: string; position: string; email: string; phone: string; isPrimary: boolean }, platformUserId: string): Promise<void> {
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    if (input.isPrimary) commands.push({ sql: "UPDATE prospect_contacts SET is_primary = 0, updated_at = ? WHERE prospect_id = ? AND status = 'active'", values: [timestamp, prospectId] });
    commands.push({ sql: `INSERT INTO prospect_contacts (id, prospect_id, name, position, email, normalized_email, phone, normalized_phone, is_primary, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`, values: [crypto.randomUUID(), prospectId, input.name.trim(), input.position.trim(), normalizeEmail(input.email), normalizeEmail(input.email), input.phone.trim(), normalizePhone(input.phone), input.isPrimary ? 1 : 0, timestamp, timestamp, platformUserId] });
    commands.push(auditCommand(platformUserId, "commercial.prospect.contact_added", "prospect", prospectId, input.isPrimary ? "Nuevo contacto principal." : "Nuevo contacto secundario."));
    await this.provider.batch(commands);
  }

  async addNote(prospectId: string, content: string, platformUserId: string): Promise<void> {
    const timestamp = nowIso();
    await this.provider.batch([{ sql: `INSERT INTO commercial_notes (id, prospect_id, author_platform_user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), prospectId, platformUserId, content.trim(), timestamp] }, auditCommand(platformUserId, "commercial.prospect.note_added", "prospect", prospectId, "Nota comercial interna agregada.")]);
  }

  async addFollowUp(prospectId: string, input: { type: string; scheduledAt: string; description: string }, platformUserId: string): Promise<void> {
    const timestamp = nowIso();
    await this.provider.batch([{ sql: `INSERT INTO follow_ups (id, prospect_id, type, scheduled_at, responsible_platform_user_id, description, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`, values: [crypto.randomUUID(), prospectId, input.type, input.scheduledAt, platformUserId, input.description.trim(), timestamp, timestamp, platformUserId] }, { sql: "UPDATE prospects SET next_action = ?, next_action_at = ?, updated_at = ?, version = version + 1 WHERE id = ?", values: [input.description.trim(), input.scheduledAt, timestamp, prospectId] }, auditCommand(platformUserId, "commercial.follow_up.created", "prospect", prospectId, input.description.trim())]);
  }

  async completeFollowUp(id: string, result: string, platformUserId: string): Promise<void> {
    const timestamp = nowIso();
    const followUp = await this.provider.first<{ prospectId: string }>("UPDATE follow_ups SET status = 'completed', result = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending' RETURNING prospect_id AS prospectId", [result.trim(), timestamp, timestamp, id]);
    if (!followUp) throw new Error("El seguimiento ya no está pendiente.");
    await this.provider.batch([auditCommand(platformUserId, "commercial.follow_up.completed", "prospect", followUp.prospectId, result.trim())]);
  }

  async saveDiagnosis(prospectId: string, answers: Record<string, unknown>, platformUserId: string): Promise<void> {
    const diagnosis = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM diagnoses WHERE prospect_id = ? AND status IN ('draft','in_progress') ORDER BY version_number DESC LIMIT 1", [prospectId]);
    if (!diagnosis) throw new Error("El diagnóstico terminado es inmutable. Crea una revisión para cambiarlo.");
    const questions = await this.provider.all<{ id: string; questionCode: string; required: number }>("SELECT id, question_code AS questionCode, required FROM diagnosis_questions WHERE template_id = 'diagnosis-template-v1' AND active = 1");
    const byCode = new Map(questions.map((question) => [question.questionCode, question]));
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    Object.entries(answers).forEach(([code, value]) => {
      const question = byCode.get(code);
      if (!question) return;
      commands.push({ sql: `INSERT INTO diagnosis_answers (id, diagnosis_id, question_id, value_json, source, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, 'diagnosis', ?, ?, ?) ON CONFLICT(diagnosis_id, question_id) DO UPDATE SET value_json = excluded.value_json, source = 'diagnosis', updated_at = excluded.updated_at, created_by = excluded.created_by`, values: [crypto.randomUUID(), diagnosis.id, question.id, JSON.stringify(value), timestamp, timestamp, platformUserId] });
    });
    commands.push({ sql: `UPDATE diagnoses SET status = 'in_progress', completion_percentage = (SELECT CAST(ROUND(100.0 * SUM(CASE WHEN a.id IS NOT NULL AND a.value_json IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*)) AS INTEGER) FROM diagnosis_questions q LEFT JOIN diagnosis_answers a ON a.question_id = q.id AND a.diagnosis_id = ? WHERE q.template_id = 'diagnosis-template-v1' AND q.active = 1 AND q.required = 1), updated_by = ?, updated_at = ? WHERE id = ?`, values: [diagnosis.id, platformUserId, timestamp, diagnosis.id] });
    commands.push(auditCommand(platformUserId, "commercial.diagnosis.saved", "prospect", prospectId, "Respuestas del diagnóstico actualizadas."));
    await this.provider.batch(commands);
  }

  async completeDiagnosis(prospectId: string, platformUserId: string): Promise<void> {
    const diagnosis = await this.provider.first<{ id: string; completion: number }>("SELECT id, completion_percentage AS completion FROM diagnoses WHERE prospect_id = ? AND status IN ('draft','in_progress') ORDER BY version_number DESC LIMIT 1", [prospectId]);
    if (!diagnosis) throw new Error("No existe un diagnóstico editable.");
    if (diagnosis.completion < 100) throw new Error("Completa todas las preguntas obligatorias antes de terminar.");
    const timestamp = nowIso();
    await this.provider.batch([{ sql: "UPDATE diagnoses SET status = 'completed', completed_at = ?, updated_by = ?, updated_at = ? WHERE id = ?", values: [timestamp, platformUserId, timestamp, diagnosis.id] }, { sql: "UPDATE prospects SET status = CASE WHEN status IN ('new','contacted') THEN 'discovery' ELSE status END, updated_at = ?, version = version + 1 WHERE id = ?", values: [timestamp, prospectId] }, auditCommand(platformUserId, "commercial.diagnosis.completed", "prospect", prospectId, "Diagnóstico comercial concluido.")]);
  }

  async reviseDiagnosis(prospectId: string, platformUserId: string): Promise<void> {
    const current = await this.provider.first<{ id: string; versionNumber: number; templateId: string }>("SELECT id, version_number AS versionNumber, template_id AS templateId FROM diagnoses WHERE prospect_id = ? AND status = 'completed' ORDER BY version_number DESC LIMIT 1", [prospectId]);
    if (!current) throw new Error("Termina el diagnóstico actual antes de crear una revisión.");
    const nextId = crypto.randomUUID();
    const timestamp = nowIso();
    await this.provider.batch([{ sql: "UPDATE diagnoses SET status = 'superseded', updated_by = ?, updated_at = ? WHERE id = ?", values: [platformUserId, timestamp, current.id] }, { sql: `INSERT INTO diagnoses (id, prospect_id, template_id, version_number, status, completion_percentage, started_at, created_by, updated_by, created_at, updated_at) SELECT ?, prospect_id, template_id, ?, 'in_progress', completion_percentage, ?, ?, ?, ?, ? FROM diagnoses WHERE id = ?`, values: [nextId, current.versionNumber + 1, timestamp, platformUserId, platformUserId, timestamp, timestamp, current.id] }, { sql: `INSERT INTO diagnosis_answers (id, diagnosis_id, question_id, value_json, source, created_at, updated_at, created_by) SELECT lower(hex(randomblob(16))), ?, question_id, value_json, 'diagnosis', ?, ?, ? FROM diagnosis_answers WHERE diagnosis_id = ?`, values: [nextId, timestamp, timestamp, platformUserId, current.id] }, auditCommand(platformUserId, "commercial.diagnosis.revised", "prospect", prospectId, `Revisión ${current.versionNumber + 1} creada.`)]);
  }

  async getCatalog(): Promise<CommercialModule[]> {
    const [modules, features, dependencies] = await Promise.all([
      this.provider.all<ModuleRow>("SELECT id, code, name, description, category, status, display_order AS displayOrder, version FROM modules ORDER BY display_order"),
      this.provider.all<FeatureRow>("SELECT id, code, module_id AS moduleId, name, description, unit_type AS unitType, billable, configurable, status FROM features ORDER BY name"),
      this.provider.all<{ moduleId: string; requiredCode: string }>("SELECT d.module_id AS moduleId, required.code AS requiredCode FROM module_dependencies d JOIN modules required ON required.id = d.required_module_id"),
    ]);
    return modules.map((module) => ({ ...module, features: features.filter((feature) => feature.moduleId === module.id).map((feature) => ({ ...feature, billable: bool(feature.billable), configurable: bool(feature.configurable) })), dependencies: dependencies.filter((item) => item.moduleId === module.id).map((item) => item.requiredCode) }));
  }

  async listPriceBooks(): Promise<PriceBookSummary[]> {
    return this.provider.all<PriceBookSummary>(`SELECT pb.id, pb.name, pb.currency, pb.country_code AS countryCode, pb.status, pb.active_version_id AS activeVersionId,
      active.version_number AS activeVersionNumber, active.effective_from AS activeEffectiveFrom,
      draft.id AS draftVersionId, draft.version_number AS draftVersionNumber, pb.created_at AS createdAt, pb.updated_at AS updatedAt
      FROM price_books pb
      LEFT JOIN price_book_versions active ON active.id = pb.active_version_id
      LEFT JOIN price_book_versions draft ON draft.id = (SELECT id FROM price_book_versions WHERE price_book_id = pb.id AND status = 'draft' ORDER BY version_number DESC LIMIT 1)
      ORDER BY pb.updated_at DESC`);
  }

  async getPriceBook(id: string, versionId?: string): Promise<PriceBookDetail | null> {
    const book = (await this.listPriceBooks()).find((item) => item.id === id);
    if (!book) return null;
    const versions = await this.provider.all<{ id: string; versionNumber: number; status: "draft" | "published" | "archived"; effectiveFrom: string; effectiveUntil: string | null; notes: string; createdAt: string; publishedAt: string | null }>("SELECT id, version_number AS versionNumber, status, effective_from AS effectiveFrom, effective_until AS effectiveUntil, notes, created_at AS createdAt, published_at AS publishedAt FROM price_book_versions WHERE price_book_id = ? ORDER BY version_number DESC", [id]);
    const selected = versions.find((version) => version.id === versionId) ?? versions.find((version) => version.status === "draft") ?? versions.find((version) => version.id === book.activeVersionId) ?? versions[0];
    if (!selected) return { ...book, versions, selectedVersion: null };
    const [rules, tiers] = await Promise.all([
      this.provider.all<PriceRuleRow>(`SELECT id, price_book_version_id AS priceBookVersionId, code, name, description, charge_type AS chargeType, billing_period AS billingPeriod, unit_type AS unitType, module_code AS moduleCode, feature_code AS featureCode, unit_amount_minor AS unitAmountMinor, currency, minimum_quantity AS minimumQuantity, maximum_quantity AS maximumQuantity, priority, stacking_mode AS stackingMode, active, internal_cost_minor AS internalCostMinor FROM price_rules WHERE price_book_version_id = ? ORDER BY priority, code`, [selected.id]),
      this.provider.all<PriceTier>(`SELECT id, price_rule_id AS priceRuleId, minimum_quantity AS minimumQuantity, maximum_quantity AS maximumQuantity, unit_amount_minor AS unitAmountMinor, flat_amount_minor AS flatAmountMinor FROM price_tiers WHERE price_rule_id IN (SELECT id FROM price_rules WHERE price_book_version_id = ?) ORDER BY minimum_quantity`, [selected.id]),
    ]);
    return { ...book, versions, selectedVersion: { ...selected, rules: rules.map((rule) => ({ ...rule, active: bool(rule.active), tiers: tiers.filter((tier) => tier.priceRuleId === rule.id) })) } };
  }

  async updatePriceRule(priceBookId: string, versionId: string, ruleId: string, unitAmountMinor: number, internalCostMinor: number | null, platformUserId: string): Promise<void> {
    const timestamp = nowIso();
    const before = await this.provider.first<{ unitAmountMinor: number; internalCostMinor: number | null }>("SELECT unit_amount_minor AS unitAmountMinor, internal_cost_minor AS internalCostMinor FROM price_rules WHERE id = ? AND price_book_version_id = ?", [ruleId, versionId]);
    const updated = await this.provider.first<{ id: string }>(`UPDATE price_rules SET unit_amount_minor = ?, internal_cost_minor = ?, updated_at = ? WHERE id = ? AND price_book_version_id = ? AND EXISTS (SELECT 1 FROM price_book_versions v WHERE v.id = ? AND v.price_book_id = ? AND v.status = 'draft') RETURNING id`, [unitAmountMinor, internalCostMinor, timestamp, ruleId, versionId, versionId, priceBookId]);
    if (!updated) throw new Error("Solamente puede editarse una versión en borrador.");
    await this.provider.batch([auditCommand(platformUserId, "commercial.pricing.rule_updated", "price_rule", ruleId, "Precio actualizado en versión borrador.", { priceBookId, versionId }, before ?? undefined, { unitAmountMinor, internalCostMinor })]);
  }

  async updatePriceTiers(priceBookId: string, versionId: string, ruleId: string, tiers: Array<{ minimumQuantity: number; maximumQuantity: number | null; unitAmountMinor: number; flatAmountMinor: number }>, platformUserId: string): Promise<void> {
    const errors = validatePriceTiers(tiers, true);
    if (errors.length) throw new Error(errors.join(" "));
    const editable = await this.provider.first<{ id: string }>(`SELECT r.id FROM price_rules r JOIN price_book_versions v ON v.id = r.price_book_version_id WHERE r.id = ? AND r.price_book_version_id = ? AND v.price_book_id = ? AND v.status = 'draft'`, [ruleId, versionId, priceBookId]);
    if (!editable) throw new Error("Solamente puede editarse una versión en borrador.");
    const before = await this.provider.all<{ minimumQuantity: number; maximumQuantity: number | null; unitAmountMinor: number; flatAmountMinor: number }>("SELECT minimum_quantity AS minimumQuantity, maximum_quantity AS maximumQuantity, unit_amount_minor AS unitAmountMinor, flat_amount_minor AS flatAmountMinor FROM price_tiers WHERE price_rule_id = ? ORDER BY minimum_quantity", [ruleId]);
    const commands: SqlCommand[] = [{ sql: "DELETE FROM price_tiers WHERE price_rule_id = ?", values: [ruleId] }];
    tiers.forEach((tier) => commands.push({ sql: "INSERT INTO price_tiers (id, price_rule_id, minimum_quantity, maximum_quantity, unit_amount_minor, flat_amount_minor) VALUES (?, ?, ?, ?, ?, ?)", values: [crypto.randomUUID(), ruleId, tier.minimumQuantity, tier.maximumQuantity, tier.unitAmountMinor, tier.flatAmountMinor] }));
    commands.push(auditCommand(platformUserId, "commercial.pricing.tiers_updated", "price_rule", ruleId, "Rangos de precio actualizados en borrador.", { priceBookId, versionId, tierCount: tiers.length }, { tiers: before }, { tiers }));
    await this.provider.batch(commands);
  }

  async publishPriceBookVersion(priceBookId: string, versionId: string, effectiveFrom: string, notes: string, platformUserId: string): Promise<void> {
    const detail = await this.getPriceBook(priceBookId, versionId);
    if (!detail?.selectedVersion || detail.selectedVersion.status !== "draft") throw new Error("Solamente una versión borrador puede publicarse.");
    for (const rule of detail.selectedVersion.rules) {
      if (rule.unitAmountMinor < 0 || (rule.internalCostMinor ?? 0) < 0) throw new Error(`Revisa los importes de ${rule.name}.`);
      if (rule.currency !== detail.currency) throw new Error(`${rule.name}: la moneda no coincide con el catálogo ${detail.currency}.`);
      const errors = validatePriceTiers(rule.tiers, true);
      if (errors.length) throw new Error(`${rule.name}: ${errors.join(" ")}`);
    }
    const timestamp = nowIso();
    await this.provider.batch([{ sql: `UPDATE price_book_versions SET status = 'archived', effective_until = ? WHERE price_book_id = ? AND status = 'published' AND id <> ?`, values: [effectiveFrom, priceBookId, versionId] }, { sql: `UPDATE price_book_versions SET status = 'published', effective_from = ?, notes = ?, published_at = ?, published_by = ? WHERE id = ? AND price_book_id = ? AND status = 'draft'`, values: [effectiveFrom, notes.trim(), timestamp, platformUserId, versionId, priceBookId] }, { sql: "UPDATE price_books SET active_version_id = ?, updated_at = ? WHERE id = ?", values: [versionId, timestamp, priceBookId] }, auditCommand(platformUserId, "commercial.pricing.version_published", "price_book_version", versionId, notes.trim() || "Versión comercial publicada.", { priceBookId, effectiveFrom })]);
  }

  async createPriceBookRevision(priceBookId: string, notes: string, platformUserId: string): Promise<string> {
    const source = await this.provider.first<{ id: string; versionNumber: number; effectiveFrom: string }>("SELECT id, version_number AS versionNumber, effective_from AS effectiveFrom FROM price_book_versions WHERE price_book_id = ? ORDER BY version_number DESC LIMIT 1", [priceBookId]);
    if (!source) throw new Error("No se encontró una versión base.");
    const existingDraft = await this.provider.first<{ id: string }>("SELECT id FROM price_book_versions WHERE price_book_id = ? AND status = 'draft' LIMIT 1", [priceBookId]);
    if (existingDraft) return existingDraft.id;
    const nextId = crypto.randomUUID();
    const timestamp = nowIso();
    const rules = await this.provider.all<PriceRuleRow>("SELECT id, price_book_version_id AS priceBookVersionId, code, name, description, charge_type AS chargeType, billing_period AS billingPeriod, unit_type AS unitType, module_code AS moduleCode, feature_code AS featureCode, unit_amount_minor AS unitAmountMinor, currency, minimum_quantity AS minimumQuantity, maximum_quantity AS maximumQuantity, priority, stacking_mode AS stackingMode, active, internal_cost_minor AS internalCostMinor FROM price_rules WHERE price_book_version_id = ?", [source.id]);
    const commands: SqlCommand[] = [{ sql: `INSERT INTO price_book_versions (id, price_book_id, version_number, status, effective_from, notes, created_at, created_by) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`, values: [nextId, priceBookId, source.versionNumber + 1, source.effectiveFrom, notes.trim(), timestamp, platformUserId] }];
    for (const rule of rules) {
      const newRuleId = crypto.randomUUID();
      commands.push({ sql: `INSERT INTO price_rules (id, price_book_version_id, code, name, description, charge_type, billing_period, unit_type, module_code, feature_code, unit_amount_minor, currency, minimum_quantity, maximum_quantity, priority, stacking_mode, active, internal_cost_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values: [newRuleId, nextId, rule.code, rule.name, rule.description, rule.chargeType, rule.billingPeriod, rule.unitType, rule.moduleCode, rule.featureCode, rule.unitAmountMinor, rule.currency, rule.minimumQuantity, rule.maximumQuantity, rule.priority, rule.stackingMode, rule.active ? 1 : 0, rule.internalCostMinor, timestamp, timestamp] });
      const tiers = await this.provider.all<PriceTier>("SELECT id, price_rule_id AS priceRuleId, minimum_quantity AS minimumQuantity, maximum_quantity AS maximumQuantity, unit_amount_minor AS unitAmountMinor, flat_amount_minor AS flatAmountMinor FROM price_tiers WHERE price_rule_id = ?", [rule.id]);
      tiers.forEach((tier) => commands.push({ sql: "INSERT INTO price_tiers (id, price_rule_id, minimum_quantity, maximum_quantity, unit_amount_minor, flat_amount_minor) VALUES (?, ?, ?, ?, ?, ?)", values: [crypto.randomUUID(), newRuleId, tier.minimumQuantity, tier.maximumQuantity, tier.unitAmountMinor, tier.flatAmountMinor] }));
    }
    commands.push(auditCommand(platformUserId, "commercial.pricing.revision_created", "price_book_version", nextId, notes.trim() || `Revisión ${source.versionNumber + 1}.`, { priceBookId }));
    await batched(this.provider, commands);
    return nextId;
  }

  async expireDueQuotes(platformUserId: string): Promise<number> {
    const timestamp = nowIso();
    const due = await this.provider.all<{ id: string; status: QuoteStatus; prospectId: string }>(
      "SELECT id, status, prospect_id AS prospectId FROM quotes WHERE status IN ('ready','sent','viewed') AND valid_until < ?",
      [timestamp],
    );
    if (!due.length) return 0;
    const commands: SqlCommand[] = [];
    for (const quote of due) {
      commands.push(
        { sql: "UPDATE quotes SET status = 'expired', updated_at = ?, version = version + 1 WHERE id = ? AND status = ?", values: [timestamp, quote.id, quote.status] },
        { sql: "INSERT INTO quote_status_history (id, quote_id, from_status, to_status, reason, effective_at, created_by, created_at) VALUES (?, ?, ?, 'expired', 'Vigencia concluida automáticamente.', ?, ?, ?)", values: [crypto.randomUUID(), quote.id, quote.status, timestamp, platformUserId, timestamp] },
        auditCommand(platformUserId, "commercial.quote.expired", "quote", quote.id, "Vigencia concluida automáticamente.", { prospectId: quote.prospectId }, { status: quote.status }, { status: "expired" }),
      );
    }
    await batched(this.provider, commands);
    return due.length;
  }

  async listQuotes(filters: QuoteListFilters = {}): Promise<QuoteSummary[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filters.query) {
      clauses.push("(lower(q.quote_number) LIKE ? OR lower(qv.commercial_name_snapshot) LIKE ? OR lower(qv.contact_snapshot_json) LIKE ?)");
      const query = `%${filters.query.trim().toLowerCase()}%`;
      values.push(query, query, query);
    }
    if (filters.status) { clauses.push("q.status = ?"); values.push(filters.status); }
    if (filters.ownerPlatformUserId) { clauses.push("q.owner_platform_user_id = ?"); values.push(filters.ownerPlatformUserId); }
    if (filters.currency) { clauses.push("q.currency = ?"); values.push(filters.currency.toUpperCase()); }
    if (filters.businessType) { clauses.push("p.business_type = ?"); values.push(filters.businessType); }
    if (filters.validity === "active") { clauses.push("q.valid_until >= ?"); values.push(nowIso()); }
    if (filters.validity === "expired") { clauses.push("q.valid_until < ?"); values.push(nowIso()); }
    if (filters.dateFrom) { clauses.push("q.created_at >= ?"); values.push(filters.dateFrom); }
    if (filters.dateTo) { clauses.push("q.created_at <= ?"); values.push(filters.dateTo); }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return this.provider.all<QuoteSummary>(`${quoteSummarySelect()}${where} ORDER BY q.updated_at DESC LIMIT 250`, values);
  }

  private async listQuotesForProspect(prospectId: string): Promise<QuoteSummary[]> {
    return this.provider.all<QuoteSummary>(`${quoteSummarySelect()} WHERE q.prospect_id = ? ORDER BY q.updated_at DESC`, [prospectId]);
  }

  async getQuote(id: string): Promise<QuoteDetail | null> {
    const detailSelect = quoteSummarySelect().replace(
      " FROM quotes q",
      ", p.legal_name AS legalName FROM quotes q",
    );
    const summary = await this.provider.first<QuoteSummary & { legalName: string | null }>(`${detailSelect} WHERE q.id = ? LIMIT 1`, [id]);
    if (!summary) return null;
    const versionRows = await this.provider.all<Omit<QuoteVersionDetail, "selection" | "lines" | "adjustments" | "contactSnapshot"> & { selectionJson: string; contactSnapshotJson: string }>(`SELECT qv.id, qv.quote_id AS quoteId, qv.version_number AS versionNumber, qv.price_book_version_id AS priceBookVersionId, pbv.price_book_id AS priceBookId, pbv.version_number AS priceBookVersionNumber, qv.status, qv.diagnosis_id AS diagnosisId, qv.commercial_name_snapshot AS commercialNameSnapshot, qv.contact_snapshot_json AS contactSnapshotJson, qv.currency, qv.valid_until AS validUntil, qv.billing_cycle AS billingCycle, qv.commercial_terms AS commercialTerms, qv.internal_notes AS internalNotes, qv.customer_notes AS customerNotes, qv.subtotal_one_time_minor AS subtotalOneTimeMinor, qv.subtotal_recurring_minor AS subtotalRecurringMinor, qv.discount_one_time_minor AS discountOneTimeMinor, qv.discount_recurring_minor AS discountRecurringMinor, qv.discount_total_minor AS discountTotalMinor, qv.tax_one_time_minor AS taxOneTimeMinor, qv.tax_recurring_minor AS taxRecurringMinor, qv.tax_total_minor AS taxTotalMinor, qv.total_one_time_minor AS totalOneTimeMinor, qv.monthly_total_minor AS monthlyTotalMinor, qv.total_recurring_minor AS totalRecurringMinor, qv.annual_total_minor AS annualTotalMinor, qv.annual_equivalent_minor AS annualEquivalentMinor, qv.first_payment_minor AS firstPaymentMinor, qv.internal_cost_minor AS internalCostMinor, qv.estimated_monthly_margin_minor AS estimatedMonthlyMarginMinor, qv.selection_json AS selectionJson, qv.created_at AS createdAt, qv.created_by AS createdBy, qv.locked_at AS lockedAt FROM quote_versions qv JOIN price_book_versions pbv ON pbv.id = qv.price_book_version_id WHERE qv.quote_id = ? ORDER BY qv.version_number DESC`, [id]);
    const versions: QuoteVersionDetail[] = [];
    for (const version of versionRows) {
      const [lines, adjustments] = await Promise.all([
        this.provider.all<CalculatedQuoteLine>(`SELECT source_rule_id AS sourceRuleId, code, description, explanation, billing_period AS billingPeriod, unit_type AS unitType, quantity, unit_amount_minor AS unitAmountMinor, subtotal_minor AS subtotalMinor, discount_minor AS discountMinor, tax_minor AS taxMinor, total_minor AS totalMinor, internal_cost_minor AS internalCostMinor, module_code AS moduleCode, feature_code AS featureCode FROM quote_lines WHERE quote_version_id = ? ORDER BY display_order`, [version.id]),
        this.provider.all<QuoteAdjustment>(`SELECT a.id, a.quote_version_id AS quoteVersionId, a.line_id AS lineId, a.type, a.scope, a.value, a.amount_minor AS amountMinor, a.reason, a.created_by AS createdBy, u.display_name AS createdByName, a.created_at AS createdAt FROM quote_adjustments a JOIN platform_users u ON u.id = a.created_by WHERE a.quote_version_id = ? ORDER BY a.created_at`, [version.id]),
      ]);
      const { selectionJson, contactSnapshotJson, ...rest } = version;
      versions.push({
        ...rest,
        contactSnapshot: parseJson(contactSnapshotJson, { id: null, name: "", position: "", email: "", phone: "" }),
        selection: parseJson(selectionJson, {} as PricingSelection),
        lines,
        adjustments,
      });
    }
    const rawStatusHistory = await this.provider.all<Omit<QuoteDetail["statusHistory"][number], "markProspectLost"> & { markProspectLost: number }>(`SELECT h.id, h.from_status AS fromStatus, h.to_status AS toStatus, h.reason, h.delivery_method AS deliveryMethod, h.recipient, h.confirmed_by AS confirmedBy, h.effective_at AS effectiveAt, h.mark_prospect_lost AS markProspectLost, h.created_at AS createdAt, u.display_name AS actorName FROM quote_status_history h JOIN platform_users u ON u.id = h.created_by WHERE h.quote_id = ? ORDER BY h.created_at DESC`, [id]);
    const statusHistory = rawStatusHistory.map((event) => ({ ...event, markProspectLost: bool(event.markProspectLost) }));
    const currentVersion = versions.find((version) => version.versionNumber === summary.currentVersionNumber);
    if (!currentVersion) throw new Error("La cotización no tiene una versión vigente.");
    return {
      ...summary,
      prospectName: currentVersion.commercialNameSnapshot,
      contactName: currentVersion.contactSnapshot.name,
      contactEmail: currentVersion.contactSnapshot.email,
      contactPhone: currentVersion.contactSnapshot.phone,
      versions,
      currentVersion,
      statusHistory,
    };
  }

  async createQuote(rawInput: Record<string, unknown>, platformUserId: string): Promise<{ id: string; quoteNumber: string }> {
    const input = asQuoteInput(rawInput);
    const existing = await this.provider.first<{ id: string; quoteNumber: string }>("SELECT id, quote_number AS quoteNumber FROM quotes WHERE idempotency_key = ? LIMIT 1", [input.idempotencyKey]);
    if (existing) return existing;
    const year = new Date().getUTCFullYear();
    const sequence = await this.provider.first<{ nextValue: number }>(`INSERT INTO quote_sequences (year, next_value, updated_at) VALUES (?, 2, ?) ON CONFLICT(year) DO UPDATE SET next_value = quote_sequences.next_value + 1, updated_at = excluded.updated_at RETURNING next_value AS nextValue`, [year, nowIso()]);
    if (!sequence) throw new Error("No fue posible asignar el folio de cotización.");
    const assigned = sequence.nextValue - 1;
    const quoteNumber = `KM-COT-${year}-${String(assigned).padStart(5, "0")}`;
    const quoteId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands = this.quoteSnapshotCommands(quoteId, versionId, 1, input, platformUserId, timestamp);
    commands.unshift({ sql: `INSERT INTO quotes (id, quote_number, prospect_id, contact_id, status, current_version_id, currency, valid_until, owner_platform_user_id, internal_owner_id, idempotency_key, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [quoteId, quoteNumber, input.prospectId, input.contactId, versionId, input.pricing.currency, input.validUntil, platformUserId, platformUserId, input.idempotencyKey, timestamp, timestamp, platformUserId] });
    commands.push({ sql: `INSERT INTO quote_status_history (id, quote_id, from_status, to_status, reason, created_by, created_at) VALUES (?, ?, NULL, 'draft', 'Cotización creada desde diagnóstico y catálogo versionado.', ?, ?)`, values: [crypto.randomUUID(), quoteId, platformUserId, timestamp] });
    commands.push(auditCommand(platformUserId, "commercial.quote.created", "quote", quoteId, "Cotización persistente creada.", { prospectId: input.prospectId, quoteNumber, priceBookVersionId: input.priceBookVersionId }));
    if (input.scopeAdjustmentReason?.trim()) commands.push(auditCommand(platformUserId, "commercial.quote.recommendation_adjusted", "quote", quoteId, input.scopeAdjustmentReason.trim(), { prospectId: input.prospectId, moduleCodes: input.selection.moduleCodes }));
    try {
      await this.provider.batch(commands);
      return { id: quoteId, quoteNumber };
    } catch (error) {
      const repeated = await this.provider.first<{ id: string; quoteNumber: string }>("SELECT id, quote_number AS quoteNumber FROM quotes WHERE idempotency_key = ? LIMIT 1", [input.idempotencyKey]);
      if (repeated) return repeated;
      throw error;
    }
  }

  private quoteSnapshotCommands(quoteId: string, versionId: string, versionNumber: number, input: QuotePersistenceInput, platformUserId: string, timestamp: string): SqlCommand[] {
    const pricing = input.pricing;
    const commands: SqlCommand[] = [{ sql: `INSERT INTO quote_versions
      (id, quote_id, version_number, price_book_version_id, diagnosis_id, status, commercial_name_snapshot, contact_snapshot_json,
       currency, valid_until, billing_cycle, commercial_terms, internal_notes, customer_notes, selection_json,
       subtotal_one_time_minor, subtotal_recurring_minor, discount_one_time_minor, discount_recurring_minor, discount_total_minor,
       tax_one_time_minor, tax_recurring_minor, tax_total_minor, total_one_time_minor, monthly_total_minor, total_recurring_minor,
       annual_total_minor, annual_equivalent_minor, first_payment_minor, internal_cost_minor, estimated_monthly_margin_minor, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values: [versionId, quoteId, versionNumber, input.priceBookVersionId, input.diagnosisId, input.commercialNameSnapshot, JSON.stringify(input.contactSnapshot), pricing.currency, input.validUntil, input.billingCycle, input.commercialTerms, input.internalNotes, input.customerNotes, JSON.stringify(input.selection), pricing.subtotalOneTimeMinor, pricing.subtotalRecurringMinor, pricing.discountOneTimeMinor, pricing.discountRecurringMinor, pricing.discountTotalMinor, pricing.taxOneTimeMinor, pricing.taxRecurringMinor, pricing.taxTotalMinor, pricing.totalOneTimeMinor, pricing.monthlyTotalMinor, pricing.totalRecurringMinor, pricing.annualTotalMinor, pricing.annualEquivalentMinor, pricing.firstPaymentMinor, pricing.internalCostMinor, pricing.estimatedMonthlyMarginMinor, timestamp, platformUserId] }];
    const lineIds = new Map<string, string>();
    pricing.lines.forEach((line, index) => {
      const lineId = crypto.randomUUID();
      lineIds.set(line.code, lineId);
      commands.push({ sql: `INSERT INTO quote_lines (id, quote_version_id, source_rule_id, source_type, source_id, code, description, explanation, billing_period, unit_type, quantity, unit_amount_minor, subtotal_minor, discount_minor, tax_minor, total_minor, internal_cost_minor, module_code, feature_code, display_order) VALUES (?, ?, ?, 'price_rule', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values: [lineId, versionId, line.sourceRuleId, line.sourceRuleId, line.code, line.description, line.explanation, line.billingPeriod, line.unitType, line.quantity, line.unitAmountMinor, line.subtotalMinor, line.discountMinor, line.taxMinor, line.totalMinor, line.internalCostMinor, line.moduleCode, line.featureCode, index + 1] });
    });
    input.adjustments.forEach((adjustment) => commands.push(
      { sql: `INSERT INTO quote_adjustments (id, quote_version_id, line_id, type, scope, value, amount_minor, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), versionId, adjustment.lineCode ? lineIds.get(adjustment.lineCode) ?? null : null, adjustment.type, adjustment.scope, adjustment.value, adjustment.amountMinor, adjustment.reason, platformUserId, timestamp] },
      auditCommand(platformUserId, "commercial.quote.discount_applied", "quote_version", versionId, adjustment.reason, { quoteId, type: adjustment.type, scope: adjustment.scope, lineCode: adjustment.lineCode }, { discountMinor: 0 }, { discountMinor: adjustment.amountMinor }),
    ));
    return commands;
  }

  async reviseQuote(id: string, rawInput: Record<string, unknown>, platformUserId: string): Promise<void> {
    const input = asQuoteInput(rawInput);
    const current = await this.provider.first<{ versionNumber: number; status: QuoteStatus }>("SELECT qv.version_number AS versionNumber, q.status FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id WHERE q.id = ?", [id]);
    if (!current) throw new Error("No se encontró la cotización.");
    if (current.status === "accepted" || current.status === "cancelled") throw new Error("Una cotización aceptada o cancelada no puede revisarse.");
    const versionId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands = this.quoteSnapshotCommands(id, versionId, current.versionNumber + 1, input, platformUserId, timestamp);
    commands.push({ sql: `UPDATE quotes SET status = 'draft', contact_id = ?, current_version_id = ?, currency = ?, valid_until = ?, updated_at = ?, version = version + 1 WHERE id = ?`, values: [input.contactId, versionId, input.pricing.currency, input.validUntil, timestamp, id] });
    const revisionReason = input.revisionReason?.trim() || `Revisión ${current.versionNumber + 1} creada.`;
    commands.push({ sql: `INSERT INTO quote_status_history (id, quote_id, from_status, to_status, reason, created_by, created_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)`, values: [crypto.randomUUID(), id, current.status, revisionReason, platformUserId, timestamp] });
    commands.push(auditCommand(platformUserId, "commercial.quote.revised", "quote", id, revisionReason, { prospectId: input.prospectId, revisionNumber: current.versionNumber + 1 }, { status: current.status, revisionNumber: current.versionNumber }, { status: "draft", revisionNumber: current.versionNumber + 1 }));
    if (input.scopeAdjustmentReason?.trim()) commands.push(auditCommand(platformUserId, "commercial.quote.recommendation_adjusted", "quote", id, input.scopeAdjustmentReason.trim(), { prospectId: input.prospectId, revisionNumber: current.versionNumber + 1, moduleCodes: input.selection.moduleCodes }));
    await this.provider.batch(commands);
  }

  async transitionQuote(id: string, expectedVersion: number, status: QuoteStatus, input: QuoteTransitionInput, platformUserId: string): Promise<void> {
    const current = await this.provider.first<{ status: QuoteStatus; versionNumber: number; prospectId: string; currentVersionId: string }>("SELECT q.status, q.version AS versionNumber, q.prospect_id AS prospectId, q.current_version_id AS currentVersionId FROM quotes q WHERE q.id = ?", [id]);
    if (!current) throw new Error("No se encontró la cotización.");
    if (current.status === status) return;
    if (current.versionNumber !== expectedVersion) throw new Error("La cotización cambió en otra sesión. Recarga antes de continuar.");
    const allowed: Record<QuoteStatus, QuoteStatus[]> = { draft: ["ready", "cancelled"], ready: ["draft", "sent", "cancelled"], sent: ["viewed", "accepted", "rejected", "cancelled"], viewed: ["accepted", "rejected", "cancelled"], accepted: [], rejected: [], expired: ["cancelled"], cancelled: [] };
    if (!allowed[current.status].includes(status)) throw new Error(`No se puede cambiar una cotización ${current.status} a ${status}.`);
    if ((status === "rejected" || status === "cancelled") && !input.reason?.trim()) throw new Error("Escribe el motivo de esta transición.");
    if (status === "sent" && (!input.deliveryMethod || !input.recipient?.trim())) throw new Error("Registra el medio y destinatario del envío.");
    if (status === "accepted" && (!input.confirmedBy?.trim() || !input.effectiveAt)) throw new Error("Registra quién confirmó y la fecha efectiva de aceptación.");
    if (status === "ready" || status === "sent") {
      const readiness = await this.provider.first<{ validUntil: string; publishedAt: string | null; lineCount: number; diagnosisStatus: string | null; contactId: string | null; contactSnapshotJson: string; commercialTerms: string; quoteCurrency: string; versionCurrency: string; bookCurrency: string; totalOneTimeMinor: number; monthlyTotalMinor: number }>(`SELECT qv.valid_until AS validUntil, pbv.published_at AS publishedAt,
        (SELECT COUNT(*) FROM quote_lines WHERE quote_version_id = qv.id) AS lineCount,
        d.status AS diagnosisStatus, q.contact_id AS contactId, qv.contact_snapshot_json AS contactSnapshotJson,
        qv.commercial_terms AS commercialTerms, q.currency AS quoteCurrency, qv.currency AS versionCurrency,
        pb.currency AS bookCurrency, qv.total_one_time_minor AS totalOneTimeMinor, qv.monthly_total_minor AS monthlyTotalMinor
        FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id
        JOIN price_book_versions pbv ON pbv.id = qv.price_book_version_id
        JOIN price_books pb ON pb.id = pbv.price_book_id
        LEFT JOIN diagnoses d ON d.id = qv.diagnosis_id
        WHERE q.id = ?`, [id]);
      if (!readiness?.publishedAt) throw new Error("La cotización no usa una versión de precios publicada.");
      if (readiness.lineCount < 1) throw new Error("La cotización no contiene partidas.");
      if (readiness.diagnosisStatus !== "completed") throw new Error("Termina el diagnóstico comercial antes de preparar el envío.");
      if (!readiness.contactId || !readiness.contactSnapshotJson) throw new Error("Selecciona un contacto válido para la cotización.");
      if (!readiness.commercialTerms.trim()) throw new Error("Agrega las condiciones comerciales antes de preparar el envío.");
      if (readiness.quoteCurrency !== readiness.versionCurrency || readiness.versionCurrency !== readiness.bookCurrency) throw new Error("La moneda de la cotización no coincide con el catálogo publicado.");
      if (readiness.totalOneTimeMinor < 0 || readiness.monthlyTotalMinor < 0) throw new Error("Los totales de la cotización no son válidos.");
      if (new Date(readiness.validUntil).getTime() <= Date.now()) throw new Error("La cotización ya venció; crea una revisión con nueva vigencia.");
    }
    const timestamp = nowIso();
    const timestampColumn = status === "sent" ? "sent_at" : status === "viewed" ? "viewed_at" : status === "accepted" ? "accepted_at" : status === "rejected" ? "rejected_at" : status === "cancelled" ? "cancelled_at" : null;
    const setTimestamp = timestampColumn ? `, ${timestampColumn} = ?` : "";
    const values: unknown[] = [status, timestamp, ...(timestampColumn ? [timestamp] : []), id, expectedVersion];
    const updated = await this.provider.first<{ id: string }>(`UPDATE quotes SET status = ?, updated_at = ?, version = version + 1${setTimestamp} WHERE id = ? AND version = ? RETURNING id`, values);
    if (!updated) throw new Error("La cotización cambió en otra sesión. Recarga antes de continuar.");
    const commands: SqlCommand[] = [{ sql: `INSERT INTO quote_status_history (id, quote_id, from_status, to_status, reason, delivery_method, recipient, confirmed_by, effective_at, mark_prospect_lost, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), id, current.status, status, input.reason?.trim() ?? null, input.deliveryMethod ?? null, input.recipient?.trim() ?? null, input.confirmedBy?.trim() ?? null, input.effectiveAt ?? null, input.markProspectLost ? 1 : 0, platformUserId, timestamp] }, auditCommand(platformUserId, "commercial.quote.status_changed", "quote", id, input.reason?.trim(), { prospectId: current.prospectId, confirmedBy: input.confirmedBy, effectiveAt: input.effectiveAt }, { status: current.status }, { status })];
    if (status === "sent" || status === "accepted") commands.push({ sql: "UPDATE quote_versions SET status = 'finalized', locked_at = COALESCE(locked_at, ?) WHERE id = ?", values: [timestamp, current.currentVersionId] });
    if (status === "sent") commands.push({ sql: "UPDATE prospects SET status = 'quoted', updated_at = ?, version = version + 1 WHERE id = ? AND status NOT IN ('won','lost','archived')", values: [timestamp, current.prospectId] });
    if (status === "accepted") commands.push({ sql: "UPDATE prospects SET status = 'won', updated_at = ?, version = version + 1 WHERE id = ?", values: [timestamp, current.prospectId] });
    if (status === "rejected") commands.push({ sql: "UPDATE quotes SET rejection_reason = ? WHERE id = ?", values: [input.reason?.trim() ?? "Cotización rechazada", id] });
    if (status === "rejected" && input.markProspectLost) commands.push({ sql: "UPDATE prospects SET status = 'lost', lost_reason = ?, updated_at = ?, version = version + 1 WHERE id = ?", values: [input.reason?.trim() ?? "Cotización rechazada", timestamp, current.prospectId] });
    await this.provider.batch(commands);
  }
}
