import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const platformUsers = sqliteTable("platform_users", {
  id: text("id").primaryKey(),
  authUserId: text("auth_user_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastAccessAt: text("last_access_at"),
}, (table) => [
  uniqueIndex("platform_users_auth_user_id_unique").on(table.authUserId),
  uniqueIndex("platform_users_email_unique").on(table.email),
]);

export const platformRoles = sqliteTable("platform_roles", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("platform_roles_code_unique").on(table.code)]);

export const platformPermissions = sqliteTable("platform_permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("platform_permissions_code_unique").on(table.code)]);

export const platformRolePermissions = sqliteTable("platform_role_permissions", {
  roleId: text("role_id").notNull().references(() => platformRoles.id, { onDelete: "cascade" }),
  permissionId: text("permission_id").notNull().references(() => platformPermissions.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const platformUserRoles = sqliteTable("platform_user_roles", {
  platformUserId: text("platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull().references(() => platformRoles.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.platformUserId, table.roleId] })]);

export const platformMfaCredentials = sqliteTable("platform_mfa_credentials", {
  id: text("id").primaryKey(),
  platformUserId: text("platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["totp"] }).notNull().default("totp"),
  encryptedSecret: text("encrypted_secret").notNull(),
  verifiedAt: text("verified_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("platform_mfa_user_unique").on(table.platformUserId)]);

export const platformRecoveryCodes = sqliteTable("platform_recovery_codes", {
  id: text("id").primaryKey(),
  platformUserId: text("platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("platform_recovery_code_hash_unique").on(table.codeHash),
  index("platform_recovery_codes_user_idx").on(table.platformUserId),
]);

export const platformSessions = sqliteTable("platform_sessions", {
  id: text("id").primaryKey(),
  platformUserId: text("platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  mfaVerifiedAt: text("mfa_verified_at").notNull(),
  revokedAt: text("revoked_at"),
}, (table) => [
  uniqueIndex("platform_sessions_token_hash_unique").on(table.tokenHash),
  index("platform_sessions_user_status_idx").on(table.platformUserId, table.expiresAt, table.revokedAt),
]);

export const platformAuditEvents = sqliteTable("platform_audit_events", {
  id: text("id").primaryKey(),
  platformUserId: text("platform_user_id").references(() => platformUsers.id, { onDelete: "set null" }),
  authUserId: text("auth_user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  outcome: text("outcome", { enum: ["success", "denied", "failed"] }).notNull(),
  reason: text("reason"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("platform_audit_events_user_time_idx").on(table.platformUserId, table.createdAt),
  index("platform_audit_events_auth_action_idx").on(table.authUserId, table.action, table.createdAt),
]);

export const prospects = sqliteTable("prospects", {
  id: text("id").primaryKey(),
  legalName: text("legal_name"),
  commercialName: text("commercial_name").notNull(),
  normalizedCommercialName: text("normalized_commercial_name").notNull(),
  businessProfileId: text("business_profile_id"),
  businessType: text("business_type").notNull(),
  contactName: text("contact_name").notNull(),
  contactPosition: text("contact_position"),
  contactPhone: text("contact_phone").notNull(),
  normalizedContactPhone: text("normalized_contact_phone").notNull(),
  contactEmail: text("contact_email").notNull(),
  normalizedContactEmail: text("normalized_contact_email").notNull(),
  city: text("city").notNull(),
  state: text("state"),
  countryCode: text("country_code").notNull(),
  estimatedBranches: integer("estimated_branches").notNull().default(1),
  estimatedEmployees: integer("estimated_employees").notNull().default(0),
  estimatedAdminUsers: integer("estimated_admin_users").notNull().default(1),
  estimatedDevices: integer("estimated_devices").notNull().default(0),
  estimatedDailyServices: integer("estimated_daily_services").notNull().default(0),
  estimatedWarehouses: integer("estimated_warehouses").notNull().default(0),
  operates24Hours: integer("operates_24_hours", { mode: "boolean" }).notNull().default(false),
  multiBranch: integer("multi_branch", { mode: "boolean" }).notNull().default(false),
  requiresOffline: integer("requires_offline", { mode: "boolean" }).notNull().default(false),
  estimatedMonthlyMovements: integer("estimated_monthly_movements"),
  primaryNeed: text("primary_need").notNull(),
  currentProblems: text("current_problems").notNull().default(""),
  currentSystems: text("current_systems").notNull().default(""),
  acquisitionSource: text("acquisition_source"),
  status: text("status").notNull().default("new"),
  lostReason: text("lost_reason"),
  nextAction: text("next_action").notNull(),
  nextActionAt: text("next_action_at"),
  ownerPlatformUserId: text("owner_platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
  archivedAt: text("archived_at"),
}, (table) => [
  index("idx_prospects_status_updated").on(table.status, table.updatedAt),
  index("idx_prospects_owner_next_action").on(table.ownerPlatformUserId, table.nextActionAt),
  index("idx_prospects_normalized_email").on(table.normalizedContactEmail),
  index("idx_prospects_normalized_phone").on(table.normalizedContactPhone),
  index("idx_prospects_normalized_name").on(table.normalizedCommercialName),
]);

export const prospectContacts = sqliteTable("prospect_contacts", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  position: text("position").notNull().default(""),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  phone: text("phone").notNull(),
  normalizedPhone: text("normalized_phone").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [
  index("idx_prospect_contacts_prospect_status").on(table.prospectId, table.status),
  uniqueIndex("idx_prospect_contacts_one_primary").on(table.prospectId).where(sql`${table.isPrimary} = 1 AND ${table.status} = 'active'`),
]);

export const commercialNotes = sqliteTable("commercial_notes", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  authorPlatformUserId: text("author_platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at"),
  editedAt: text("edited_at"),
}, (table) => [index("idx_commercial_notes_prospect_time").on(table.prospectId, table.createdAt)]);

export const followUps = sqliteTable("follow_ups", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  scheduledAt: text("scheduled_at").notNull(),
  responsiblePlatformUserId: text("responsible_platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [
  index("idx_follow_ups_status_date").on(table.status, table.scheduledAt),
  index("idx_follow_ups_prospect_date").on(table.prospectId, table.scheduledAt),
]);

export const diagnosisTemplates = sqliteTable("diagnosis_templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [uniqueIndex("idx_diagnosis_templates_code_version").on(table.code, table.version)]);

export const diagnosisQuestions = sqliteTable("diagnosis_questions", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => diagnosisTemplates.id, { onDelete: "restrict" }),
  sectionCode: text("section_code").notNull(),
  questionCode: text("question_code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  fieldType: text("field_type").notNull(),
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  optionsJson: text("options_json").notNull().default("[]"),
  displayOrder: integer("display_order").notNull(),
  validationRulesJson: text("validation_rules_json"),
  visibilityConditionJson: text("visibility_condition_json"),
  moduleCode: text("module_code"),
  featureCode: text("feature_code"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_diagnosis_questions_template_code").on(table.templateId, table.questionCode),
  index("idx_diagnosis_questions_template_order").on(table.templateId, table.sectionCode, table.displayOrder),
]);

export const diagnoses = sqliteTable("diagnoses", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  templateId: text("template_id").notNull().references(() => diagnosisTemplates.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull().default("draft"),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  updatedBy: text("updated_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_diagnoses_prospect_version").on(table.prospectId, table.versionNumber),
  index("idx_diagnoses_prospect_status").on(table.prospectId, table.status),
]);

export const diagnosisAnswers = sqliteTable("diagnosis_answers", {
  id: text("id").primaryKey(),
  diagnosisId: text("diagnosis_id").notNull().references(() => diagnoses.id, { onDelete: "restrict" }),
  questionId: text("question_id").notNull().references(() => diagnosisQuestions.id, { onDelete: "restrict" }),
  valueJson: text("value_json"),
  source: text("source").notNull().default("diagnosis"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [uniqueIndex("idx_diagnosis_answers_diagnosis_question").on(table.diagnosisId, table.questionId)]);

export const modules = sqliteTable("modules", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("active"),
  displayOrder: integer("display_order").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [uniqueIndex("idx_modules_code").on(table.code)]);

export const features = sqliteTable("features", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  unitType: text("unit_type").notNull().default("flat"),
  billable: integer("billable", { mode: "boolean" }).notNull().default(false),
  configurable: integer("configurable", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_features_code").on(table.code),
  index("idx_features_module_status").on(table.moduleId, table.status),
]);

export const moduleFeatures = sqliteTable("module_features", {
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "restrict" }),
  featureId: text("feature_id").notNull().references(() => features.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.moduleId, table.featureId] })]);

export const moduleDependencies = sqliteTable("module_dependencies", {
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "restrict" }),
  requiredModuleId: text("required_module_id").notNull().references(() => modules.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.moduleId, table.requiredModuleId] })]);

export const businessProfileRecommendations = sqliteTable("business_profile_recommendations", {
  id: text("id").primaryKey(),
  businessProfileCode: text("business_profile_code").notNull(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "restrict" }),
  featureId: text("feature_id").references(() => features.id, { onDelete: "restrict" }),
  priority: integer("priority").notNull().default(100),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_profile_recommendation_unique").on(table.businessProfileCode, table.moduleId, table.featureId)]);

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_commercial_plans_code").on(table.code)]);

export const planFeatures = sqliteTable("plan_features", {
  planId: text("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
  featureId: text("feature_id").notNull().references(() => features.id, { onDelete: "restrict" }),
  includedQuantity: integer("included_quantity"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.planId, table.featureId] })]);

export const priceBooks = sqliteTable("price_books", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  countryCode: text("country_code"),
  status: text("status").notNull().default("active"),
  activeVersionId: text("active_version_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [index("idx_price_books_market").on(table.currency, table.countryCode, table.status)]);

export const priceBookVersions = sqliteTable("price_book_versions", {
  id: text("id").primaryKey(),
  priceBookId: text("price_book_id").notNull().references(() => priceBooks.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull().default("draft"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveUntil: text("effective_until"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  publishedAt: text("published_at"),
  publishedBy: text("published_by").references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [
  uniqueIndex("idx_price_book_versions_number").on(table.priceBookId, table.versionNumber),
  index("idx_price_book_versions_status_effective").on(table.status, table.effectiveFrom, table.effectiveUntil),
]);

export const priceRules = sqliteTable("price_rules", {
  id: text("id").primaryKey(),
  priceBookVersionId: text("price_book_version_id").notNull().references(() => priceBookVersions.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  chargeType: text("charge_type").notNull(),
  billingPeriod: text("billing_period").notNull(),
  unitType: text("unit_type").notNull(),
  moduleCode: text("module_code"),
  featureCode: text("feature_code"),
  unitAmountMinor: integer("unit_amount_minor").notNull(),
  currency: text("currency").notNull(),
  minimumQuantity: integer("minimum_quantity").notNull().default(0),
  maximumQuantity: integer("maximum_quantity"),
  priority: integer("priority").notNull().default(100),
  stackingMode: text("stacking_mode").notNull().default("add"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  internalCostMinor: integer("internal_cost_minor"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_price_rules_version_code").on(table.priceBookVersionId, table.code),
  index("idx_price_rules_version_priority").on(table.priceBookVersionId, table.active, table.priority),
]);

export const priceTiers = sqliteTable("price_tiers", {
  id: text("id").primaryKey(),
  priceRuleId: text("price_rule_id").notNull().references(() => priceRules.id, { onDelete: "restrict" }),
  minimumQuantity: integer("minimum_quantity").notNull(),
  maximumQuantity: integer("maximum_quantity"),
  unitAmountMinor: integer("unit_amount_minor").notNull().default(0),
  flatAmountMinor: integer("flat_amount_minor").notNull().default(0),
}, (table) => [
  uniqueIndex("idx_price_tiers_rule_min").on(table.priceRuleId, table.minimumQuantity),
  index("idx_price_tiers_rule_range").on(table.priceRuleId, table.minimumQuantity, table.maximumQuantity),
]);

function pricedCatalogTable(name: string) {
  return sqliteTable(name, {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    unitAmountMinor: integer("unit_amount_minor").notNull(),
    currency: text("currency").notNull(),
    billingPeriod: text("billing_period").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  }, (table) => [uniqueIndex(`idx_${name}_code`).on(table.code)]);
}

export const setupFees = pricedCatalogTable("setup_fees");
export const supportLevels = pricedCatalogTable("support_levels");
export const hardwareItems = pricedCatalogTable("hardware_items");
export const trainingItems = pricedCatalogTable("training_items");
export const importServices = pricedCatalogTable("import_services");

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  quoteNumber: text("quote_number").notNull(),
  prospectId: text("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  contactId: text("contact_id").references(() => prospectContacts.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("draft"),
  currentVersionId: text("current_version_id"),
  currency: text("currency").notNull(),
  validUntil: text("valid_until").notNull(),
  ownerPlatformUserId: text("owner_platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  internalOwnerId: text("internal_owner_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull(),
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  acceptedAt: text("accepted_at"),
  rejectedAt: text("rejected_at"),
  rejectionReason: text("rejection_reason"),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quotes_number").on(table.quoteNumber),
  uniqueIndex("idx_quotes_idempotency_key").on(table.idempotencyKey),
  index("idx_quotes_prospect_status").on(table.prospectId, table.status),
  index("idx_quotes_status_updated").on(table.status, table.updatedAt),
  index("idx_quotes_status_valid_until").on(table.status, table.validUntil),
]);

export const quoteVersions = sqliteTable("quote_versions", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  priceBookVersionId: text("price_book_version_id").notNull().references(() => priceBookVersions.id, { onDelete: "restrict" }),
  diagnosisId: text("diagnosis_id").references(() => diagnoses.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("draft"),
  commercialNameSnapshot: text("commercial_name_snapshot").notNull(),
  contactSnapshotJson: text("contact_snapshot_json").notNull(),
  currency: text("currency").notNull(),
  validUntil: text("valid_until").notNull(),
  billingCycle: text("billing_cycle").notNull(),
  commercialTerms: text("commercial_terms").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  customerNotes: text("customer_notes").notNull().default(""),
  selectionJson: text("selection_json").notNull(),
  subtotalOneTimeMinor: integer("subtotal_one_time_minor").notNull(),
  subtotalRecurringMinor: integer("subtotal_recurring_minor").notNull(),
  discountOneTimeMinor: integer("discount_one_time_minor").notNull().default(0),
  discountRecurringMinor: integer("discount_recurring_minor").notNull().default(0),
  discountTotalMinor: integer("discount_total_minor").notNull().default(0),
  taxOneTimeMinor: integer("tax_one_time_minor").notNull().default(0),
  taxRecurringMinor: integer("tax_recurring_minor").notNull().default(0),
  taxTotalMinor: integer("tax_total_minor").notNull().default(0),
  totalOneTimeMinor: integer("total_one_time_minor").notNull(),
  monthlyTotalMinor: integer("monthly_total_minor").notNull(),
  totalRecurringMinor: integer("total_recurring_minor").notNull(),
  annualTotalMinor: integer("annual_total_minor").notNull(),
  annualEquivalentMinor: integer("annual_equivalent_minor").notNull(),
  firstPaymentMinor: integer("first_payment_minor").notNull(),
  internalCostMinor: integer("internal_cost_minor").notNull().default(0),
  estimatedMonthlyMarginMinor: integer("estimated_monthly_margin_minor").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  lockedAt: text("locked_at"),
}, (table) => [uniqueIndex("idx_quote_versions_quote_number").on(table.quoteId, table.versionNumber)]);

export const quoteLines = sqliteTable("quote_lines", {
  id: text("id").primaryKey(),
  quoteVersionId: text("quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "restrict" }),
  sourceRuleId: text("source_rule_id").references(() => priceRules.id, { onDelete: "restrict" }),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  code: text("code").notNull(),
  description: text("description").notNull(),
  explanation: text("explanation").notNull(),
  billingPeriod: text("billing_period").notNull(),
  unitType: text("unit_type").notNull(),
  quantity: integer("quantity").notNull(),
  unitAmountMinor: integer("unit_amount_minor").notNull(),
  subtotalMinor: integer("subtotal_minor").notNull(),
  discountMinor: integer("discount_minor").notNull().default(0),
  taxMinor: integer("tax_minor").notNull().default(0),
  totalMinor: integer("total_minor").notNull(),
  internalCostMinor: integer("internal_cost_minor"),
  moduleCode: text("module_code"),
  featureCode: text("feature_code"),
  displayOrder: integer("display_order").notNull(),
}, (table) => [index("idx_quote_lines_version_order").on(table.quoteVersionId, table.displayOrder)]);

export const quoteAdjustments = sqliteTable("quote_adjustments", {
  id: text("id").primaryKey(),
  quoteVersionId: text("quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "restrict" }),
  lineId: text("line_id").references(() => quoteLines.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  scope: text("scope").notNull(),
  value: integer("value").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_quote_adjustments_version").on(table.quoteVersionId, table.createdAt)]);

export const quoteStatusHistory = sqliteTable("quote_status_history", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "restrict" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  deliveryMethod: text("delivery_method"),
  recipient: text("recipient"),
  confirmedBy: text("confirmed_by"),
  effectiveAt: text("effective_at"),
  markProspectLost: integer("mark_prospect_lost", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_quote_status_history_quote_time").on(table.quoteId, table.createdAt)]);

export const quoteSequences = sqliteTable("quote_sequences", {
  year: integer("year").primaryKey(),
  nextValue: integer("next_value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Sprint C: durable tenant provisioning and customer onboarding.
export const tenantOrganizations = sqliteTable("tenant_organizations", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  slug: text("slug").notNull(),
  commercialName: text("commercial_name").notNull(),
  legalName: text("legal_name"),
  businessProfileId: text("business_profile_id").notNull(),
  countryCode: text("country_code").notNull(),
  defaultCurrency: text("default_currency").notNull(),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("es-MX"),
  taxId: text("tax_id"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  status: text("status").notNull().default("provisioning"),
  onboardingStatus: text("onboarding_status").notNull().default("not_started"),
  sourceProspectId: text("source_prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  sourceQuoteId: text("source_quote_id").notNull().references(() => quotes.id, { onDelete: "restrict" }),
  sourceQuoteVersionId: text("source_quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "restrict" }),
  activatedAt: text("activated_at"),
  suspendedAt: text("suspended_at"),
  suspensionReason: text("suspension_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByPlatformUserId: text("created_by_platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at"),
}, (table) => [
  uniqueIndex("idx_tenant_organizations_code").on(table.code),
  uniqueIndex("idx_tenant_organizations_slug").on(table.slug),
  uniqueIndex("idx_tenant_organizations_source_quote").on(table.sourceQuoteId),
  index("idx_tenant_organizations_status_updated").on(table.status, table.updatedAt),
]);

export const tenantBranches = sqliteTable("tenant_branches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  timezone: text("timezone").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_tenant_branches_org_code").on(table.organizationId, table.code),
  index("idx_tenant_branches_org_status").on(table.organizationId, table.status),
]);

export const tenantAreas = sqliteTable("tenant_areas", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
}, (table) => [uniqueIndex("idx_tenant_areas_org_branch_code").on(table.organizationId, table.branchId, table.code)]);

export const tenantWarehouses = sqliteTable("tenant_warehouses", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("idx_tenant_warehouses_org_branch_code").on(table.organizationId, table.branchId, table.code),
  index("idx_tenant_warehouses_org_branch_status").on(table.organizationId, table.branchId, table.status),
]);

export const customerUsers = sqliteTable("customer_users", {
  id: text("id").primaryKey(),
  authUserId: text("auth_user_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastAccessAt: text("last_access_at"),
}, (table) => [
  uniqueIndex("idx_customer_users_auth").on(table.authUserId),
  uniqueIndex("idx_customer_users_email").on(table.email),
]);

export const organizationPermissions = sqliteTable("organization_permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  description: text("description").notNull(),
}, (table) => [uniqueIndex("idx_organization_permissions_code").on(table.code)]);

export const organizationRoles = sqliteTable("organization_roles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemTemplate: integer("system_template", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_organization_roles_org_code").on(table.organizationId, table.code)]);

export const organizationRolePermissions = sqliteTable("organization_role_permissions", {
  roleId: text("role_id").notNull().references(() => organizationRoles.id, { onDelete: "cascade" }),
  permissionId: text("permission_id").notNull().references(() => organizationPermissions.id, { onDelete: "restrict" }),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const organizationMemberships = sqliteTable("organization_memberships", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => customerUsers.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("invited"),
  displayName: text("display_name").notNull(),
  joinedAt: text("joined_at"),
  invitedBy: text("invited_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
  revokedAt: text("revoked_at"),
}, (table) => [
  uniqueIndex("idx_organization_memberships_org_user").on(table.organizationId, table.userId),
  index("idx_organization_memberships_user_status").on(table.userId, table.status),
]);

export const membershipRoleAssignments = sqliteTable("membership_role_assignments", {
  membershipId: text("membership_id").notNull().references(() => organizationMemberships.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull().references(() => organizationRoles.id, { onDelete: "restrict" }),
}, (table) => [primaryKey({ columns: [table.membershipId, table.roleId] })]);

export const membershipScopes = sqliteTable("membership_scopes", {
  id: text("id").primaryKey(),
  membershipId: text("membership_id").notNull().references(() => organizationMemberships.id, { onDelete: "cascade" }),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id"),
  accessMode: text("access_mode").notNull().default("manage"),
}, (table) => [uniqueIndex("idx_membership_scopes_unique").on(table.membershipId, table.scopeType, table.scopeId)]);

export const organizationInvitations = sqliteTable("organization_invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  emailNormalized: text("email_normalized").notNull(),
  intendedRoleId: text("intended_role_id").notNull().references(() => organizationRoles.id, { onDelete: "restrict" }),
  intendedScopeJson: text("intended_scope_json").notNull().default("{\"type\":\"organization\"}"),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  revokedAt: text("revoked_at"),
  createdByPlatformUserId: text("created_by_platform_user_id").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSentAt: text("last_sent_at"),
  sendCount: integer("send_count").notNull().default(1),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_organization_invitations_token").on(table.tokenHash),
  index("idx_organization_invitations_org_status").on(table.organizationId, table.status),
]);

export const organizationEntitlements = sqliteTable("organization_entitlements", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  moduleCode: text("module_code"),
  featureCode: text("feature_code"),
  sourceType: text("source_type").notNull().default("quote"),
  sourceQuoteVersionId: text("source_quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "restrict" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  effectiveFrom: text("effective_from").notNull(),
  effectiveUntil: text("effective_until"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("idx_organization_entitlements_module").on(table.organizationId, table.moduleCode),
  uniqueIndex("idx_organization_entitlements_feature").on(table.organizationId, table.featureCode),
  index("idx_organization_entitlements_org_status").on(table.organizationId, table.status),
]);

export const organizationFeatureLimits = sqliteTable("organization_feature_limits", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  featureCode: text("feature_code").notNull(),
  includedQuantity: integer("included_quantity").notNull(),
  hardLimit: integer("hard_limit"),
  warningThreshold: integer("warning_threshold"),
  unit: text("unit").notNull(),
  currentUsage: integer("current_usage").notNull().default(0),
  resetPeriod: text("reset_period"),
  sourceQuoteLineId: text("source_quote_line_id").references(() => quoteLines.id, { onDelete: "restrict" }),
  effectiveFrom: text("effective_from").notNull(),
  effectiveUntil: text("effective_until"),
}, (table) => [uniqueIndex("idx_organization_feature_limits_org_feature").on(table.organizationId, table.featureCode)]);

export const organizationFeatureOverrides = sqliteTable("organization_feature_overrides", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  targetType: text("target_type").notNull(),
  moduleCode: text("module_code"),
  featureCode: text("feature_code"),
  enabled: integer("enabled", { mode: "boolean" }),
  overrideLimit: integer("override_limit"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveUntil: text("effective_until").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  revokedAt: text("revoked_at"),
  revokedBy: text("revoked_by").references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [
  index("idx_organization_feature_overrides_module").on(table.organizationId, table.moduleCode, table.status, table.effectiveUntil),
  index("idx_organization_feature_overrides_feature").on(table.organizationId, table.featureCode, table.status, table.effectiveUntil),
]);

export const entitlementHistory = sqliteTable("entitlement_history", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json").notNull(),
  reason: text("reason").notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_entitlement_history_org_time").on(table.organizationId, table.createdAt)]);

export const provisioningRequests = sqliteTable("provisioning_requests", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "restrict" }),
  quoteVersionId: text("quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "restrict" }),
  organizationId: text("organization_id").references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  failedAt: text("failed_at"),
  retryCount: integer("retry_count").notNull().default(0),
  lastErrorCode: text("last_error_code"),
  lastErrorSummary: text("last_error_summary"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_provisioning_requests_idempotency").on(table.idempotencyKey),
  uniqueIndex("idx_provisioning_requests_quote").on(table.quoteId),
  index("idx_provisioning_requests_status_updated").on(table.status, table.updatedAt),
]);

export const provisioningSteps = sqliteTable("provisioning_steps", {
  id: text("id").primaryKey(),
  provisioningRequestId: text("provisioning_request_id").notNull().references(() => provisioningRequests.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  lastError: text("last_error"),
}, (table) => [uniqueIndex("idx_provisioning_steps_request_code").on(table.provisioningRequestId, table.code)]);

export const onboardingTemplateVersions = sqliteTable("onboarding_template_versions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes").notNull().default(""),
  effectiveFrom: text("effective_from").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => platformUsers.id, { onDelete: "restrict" }),
}, (table) => [
  uniqueIndex("idx_onboarding_template_versions_code_version").on(table.code, table.versionNumber),
  index("idx_onboarding_template_versions_status").on(table.status, table.effectiveFrom),
]);

export const onboardingTemplateSections = sqliteTable("onboarding_template_sections", {
  id: text("id").primaryKey(),
  templateVersionId: text("template_version_id").notNull().references(() => onboardingTemplateVersions.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").notNull(),
  moduleCode: text("module_code"),
}, (table) => [uniqueIndex("idx_onboarding_template_sections_version_code").on(table.templateVersionId, table.code)]);

export const onboardingTemplateTasks = sqliteTable("onboarding_template_tasks", {
  id: text("id").primaryKey(),
  templateSectionId: text("template_section_id").notNull().references(() => onboardingTemplateSections.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  moduleCode: text("module_code"),
  displayOrder: integer("display_order").notNull(),
}, (table) => [uniqueIndex("idx_onboarding_template_tasks_section_code").on(table.templateSectionId, table.code)]);

export const onboardingProjects = sqliteTable("onboarding_projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  templateVersion: integer("template_version").notNull().default(1),
  status: text("status").notNull().default("not_started"),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  targetDate: text("target_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
  activatedAt: text("activated_at"),
}, (table) => [uniqueIndex("idx_onboarding_projects_org").on(table.organizationId)]);

export const onboardingStatusHistory = sqliteTable("onboarding_status_history", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  projectId: text("project_id").notNull().references(() => onboardingProjects.id, { onDelete: "restrict" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_onboarding_status_history_org_time").on(table.organizationId, table.createdAt)]);

export const onboardingSections = sqliteTable("onboarding_sections", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => onboardingProjects.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").notNull(),
  moduleCode: text("module_code"),
  status: text("status").notNull().default("pending"),
  completionPercentage: integer("completion_percentage").notNull().default(0),
}, (table) => [uniqueIndex("idx_onboarding_sections_project_code").on(table.projectId, table.code)]);

export const onboardingTasks = sqliteTable("onboarding_tasks", {
  id: text("id").primaryKey(),
  sectionId: text("section_id").notNull().references(() => onboardingSections.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  moduleCode: text("module_code"),
  status: text("status").notNull().default("pending"),
  blockedReason: text("blocked_reason"),
  completedAt: text("completed_at"),
  completedBy: text("completed_by"),
  displayOrder: integer("display_order").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_onboarding_tasks_org_code").on(table.organizationId, table.code),
  index("idx_onboarding_tasks_org_status").on(table.organizationId, table.status),
]);

export const onboardingDependencies = sqliteTable("onboarding_dependencies", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => onboardingProjects.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  taskId: text("task_id").notNull().references(() => onboardingTasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: text("depends_on_task_id").notNull().references(() => onboardingTasks.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_onboarding_dependencies_pair").on(table.taskId, table.dependsOnTaskId),
  index("idx_onboarding_dependencies_org_project").on(table.organizationId, table.projectId),
]);

export const onboardingAnswers = sqliteTable("onboarding_answers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  projectId: text("project_id").notNull().references(() => onboardingProjects.id, { onDelete: "restrict" }),
  taskId: text("task_id").notNull().references(() => onboardingTasks.id, { onDelete: "restrict" }),
  answerJson: text("answer_json").notNull(),
  answeredByType: text("answered_by_type").notNull(),
  answeredBy: text("answered_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_onboarding_answers_org_task").on(table.organizationId, table.taskId),
  index("idx_onboarding_answers_project").on(table.projectId, table.updatedAt),
]);

export const activationChecks = sqliteTable("activation_checks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  critical: integer("critical", { mode: "boolean" }).notNull().default(true),
  checkedAt: text("checked_at").notNull(),
}, (table) => [uniqueIndex("idx_activation_checks_org_code").on(table.organizationId, table.code)]);

export const customerSubscriptions = sqliteTable("customer_subscriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("pending_activation"),
  billingCycle: text("billing_cycle").notNull(),
  currency: text("currency").notNull(),
  recurringAmountMinor: integer("recurring_amount_minor").notNull(),
  implementationAmountMinor: integer("implementation_amount_minor").notNull(),
  sourceQuoteVersionId: text("source_quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "restrict" }),
  startsAt: text("starts_at"),
  renewsAt: text("renews_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_customer_subscriptions_org").on(table.organizationId)]);

export const customerSubscriptionItems = sqliteTable("customer_subscription_items", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  subscriptionId: text("subscription_id").notNull().references(() => customerSubscriptions.id, { onDelete: "restrict" }),
  sourceQuoteLineId: text("source_quote_line_id").references(() => quoteLines.id, { onDelete: "restrict" }),
  itemType: text("item_type").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit").notNull(),
  billingPeriod: text("billing_period").notNull(),
  amountMinor: integer("amount_minor").notNull().default(0),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_customer_subscription_items_identity").on(table.subscriptionId, table.itemType, table.code),
  index("idx_customer_subscription_items_org").on(table.organizationId, table.subscriptionId),
]);

export const subscriptionStatusHistory = sqliteTable("subscription_status_history", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  subscriptionId: text("subscription_id").notNull().references(() => customerSubscriptions.id, { onDelete: "restrict" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_subscription_status_history_org_time").on(table.organizationId, table.createdAt)]);

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull(),
  totalRows: integer("total_rows").notNull(),
  validRows: integer("valid_rows").notNull(),
  invalidRows: integer("invalid_rows").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("idx_import_batches_org_key").on(table.organizationId, table.idempotencyKey),
  index("idx_import_batches_org_status").on(table.organizationId, table.status),
]);

export const importRows = sqliteTable("import_rows", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => importBatches.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  status: text("status").notNull(),
  rawJson: text("raw_json").notNull(),
  errorJson: text("error_json"),
  entityId: text("entity_id"),
}, (table) => [uniqueIndex("idx_import_rows_batch_row").on(table.batchId, table.rowNumber)]);

function tenantCatalogTable(name: string) {
  return sqliteTable(name, {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
    branchId: text("branch_id").references(() => tenantBranches.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
  }, (table) => [
    uniqueIndex(`idx_${name}_org_code`).on(table.organizationId, table.code),
    index(`idx_${name}_org_branch_status`).on(table.organizationId, table.branchId, table.status),
  ]);
}

export const tenantShifts = tenantCatalogTable("tenant_shifts");
export const tenantServiceTypes = tenantCatalogTable("tenant_service_types");
export const tenantQualityTemplates = tenantCatalogTable("tenant_quality_templates");
export const tenantProducts = tenantCatalogTable("tenant_products");
export const tenantDevices = sqliteTable("tenant_devices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").references(() => tenantBranches.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  deviceType: text("device_type").notNull().default("kiosk"),
  provider: text("provider").notNull().default("generic"),
  serialNumber: text("serial_number"),
  capabilitiesJson: text("capabilities_json").notNull().default("[]"),
  configurationJson: text("configuration_json").notNull().default("{}"),
  healthJson: text("health_json").notNull().default("{}"),
  bridgeVersion: text("bridge_version"),
  lastHealthAt: text("last_health_at"),
  lastSeenAt: text("last_seen_at"),
  lastSyncAt: text("last_sync_at"),
  registeredAt: text("registered_at").notNull().default("1970-01-01T00:00:00.000Z"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_tenant_devices_org_code").on(table.organizationId, table.code),
  index("idx_tenant_devices_org_branch_status").on(table.organizationId, table.branchId, table.status),
  uniqueIndex("idx_tenant_devices_org_serial").on(table.organizationId, table.serialNumber),
  index("idx_tenant_devices_org_seen").on(table.organizationId, table.lastSeenAt),
  index("idx_tenant_devices_org_health").on(table.organizationId, table.branchId, table.lastHealthAt),
]);

export const tenantEmployees = sqliteTable("tenant_employees", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  employeeNumber: text("employee_number").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  shiftId: text("shift_id").references(() => tenantShifts.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("active"),
  hiredAt: text("hired_at"),
  terminatedAt: text("terminated_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_tenant_employees_org_number").on(table.organizationId, table.employeeNumber),
  index("idx_tenant_employees_org_branch_status").on(table.organizationId, table.branchId, table.status),
]);

export const tenantClients = sqliteTable("tenant_clients", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  billingReference: text("billing_reference"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_tenant_clients_org_code").on(table.organizationId, table.code),
  index("idx_tenant_clients_org_status").on(table.organizationId, table.status),
]);

export const tenantCostCenters = sqliteTable("tenant_cost_centers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  clientId: text("client_id").references(() => tenantClients.id, { onDelete: "restrict" }),
  branchId: text("branch_id").references(() => tenantBranches.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_tenant_cost_centers_org_code").on(table.organizationId, table.code),
  index("idx_tenant_cost_centers_client_status").on(table.clientId, table.status),
]);

export const tenantPeople = sqliteTable("tenant_people", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  employeeId: text("employee_id").references(() => tenantEmployees.id, { onDelete: "restrict" }),
  clientId: text("client_id").references(() => tenantClients.id, { onDelete: "restrict" }),
  costCenterId: text("cost_center_id").references(() => tenantCostCenters.id, { onDelete: "restrict" }),
  externalNumber: text("external_number"),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  secondLastName: text("second_last_name"),
  photoReference: text("photo_reference"),
  personType: text("person_type").notNull().default("employee"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_tenant_people_employee").on(table.employeeId),
  uniqueIndex("idx_tenant_people_org_external").on(table.organizationId, table.externalNumber),
  index("idx_tenant_people_org_branch_status").on(table.organizationId, table.branchId, table.status),
  index("idx_tenant_people_client_status").on(table.clientId, table.status),
]);

export const biometricCredentials = sqliteTable("biometric_credentials", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  personId: text("person_id").notNull().references(() => tenantPeople.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  externalTemplateId: text("external_template_id").notNull(),
  deviceId: text("device_id").references(() => tenantDevices.id, { onDelete: "restrict" }),
  method: text("method").notNull().default("fingerprint"),
  status: text("status").notNull().default("active"),
  enrolledAt: text("enrolled_at").notNull(),
  enrolledBy: text("enrolled_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  revokedAt: text("revoked_at"),
  revokedBy: text("revoked_by").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  reason: text("reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_biometric_credentials_org_provider_external").on(table.organizationId, table.provider, table.externalTemplateId),
  index("idx_biometric_credentials_person_status").on(table.personId, table.status),
  index("idx_biometric_credentials_device_status").on(table.deviceId, table.status),
]);

export const tenantDeviceCredentials = sqliteTable("tenant_device_credentials", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  deviceId: text("device_id").notNull().references(() => tenantDevices.id, { onDelete: "restrict" }),
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  status: text("status").notNull().default("active"),
  issuedAt: text("issued_at").notNull(),
  issuedBy: text("issued_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
  revokedBy: text("revoked_by").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_tenant_device_credentials_hash").on(table.tokenHash),
  index("idx_tenant_device_credentials_device_status").on(table.deviceId, table.status, table.expiresAt),
]);

export const employeeShiftAssignments = sqliteTable("employee_shift_assignments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  employeeId: text("employee_id").notNull().references(() => tenantEmployees.id, { onDelete: "restrict" }),
  shiftId: text("shift_id").notNull().references(() => tenantShifts.id, { onDelete: "restrict" }),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  reason: text("reason").notNull().default(""),
  assignedBy: text("assigned_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_employee_shift_assignment_start").on(table.organizationId, table.employeeId, table.startsOn),
  index("idx_employee_shift_assignment_effective").on(table.organizationId, table.employeeId, table.startsOn, table.endsOn),
  index("idx_employee_shift_assignment_shift_dates").on(table.organizationId, table.shiftId, table.startsOn, table.endsOn),
]);

export const employeeBranchAssignments = sqliteTable("employee_branch_assignments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  employeeId: text("employee_id").notNull().references(() => tenantEmployees.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  reason: text("reason").notNull().default(""),
  assignedBy: text("assigned_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_employee_branch_assignment_start").on(table.organizationId, table.employeeId, table.branchId, table.startsOn),
  index("idx_employee_branch_assignment_effective").on(table.organizationId, table.employeeId, table.startsOn, table.endsOn),
  index("idx_employee_branch_assignment_branch_dates").on(table.organizationId, table.branchId, table.startsOn, table.endsOn),
]);

export const operationalAttendanceEvents = sqliteTable("operational_attendance_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  employeeId: text("employee_id").notNull().references(() => tenantEmployees.id, { onDelete: "restrict" }),
  personId: text("person_id").references(() => tenantPeople.id, { onDelete: "restrict" }),
  shiftId: text("shift_id").references(() => tenantShifts.id, { onDelete: "restrict" }),
  deviceId: text("device_id").references(() => tenantDevices.id, { onDelete: "restrict" }),
  biometricCredentialId: text("biometric_credential_id").references(() => biometricCredentials.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  lateMinutes: integer("late_minutes"),
  adjustedEventType: text("adjusted_event_type"),
  originalEventId: text("original_event_id"),
  eventTimestamp: text("event_timestamp").notNull(),
  operationalDate: text("operational_date").notNull(),
  source: text("source").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  synchronizationStatus: text("synchronization_status").notNull().default("synced"),
  offlineEventId: text("offline_event_id"),
  reason: text("reason"),
  recordedByMembershipId: text("recorded_by_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  serverReceivedAt: text("server_received_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_operational_attendance_org_idempotency").on(table.organizationId, table.idempotencyKey),
  uniqueIndex("idx_operational_attendance_device_offline").on(table.deviceId, table.offlineEventId),
  index("idx_operational_attendance_org_branch_date").on(table.organizationId, table.branchId, table.operationalDate),
  index("idx_operational_attendance_org_employee_time").on(table.organizationId, table.employeeId, table.eventTimestamp),
  index("idx_operational_attendance_org_person_time").on(table.organizationId, table.personId, table.eventTimestamp),
  index("idx_operational_attendance_branch_date_type").on(table.organizationId, table.branchId, table.operationalDate, table.eventType),
  index("idx_operational_attendance_employee_date_type").on(table.organizationId, table.employeeId, table.operationalDate, table.eventType),
  index("idx_operational_attendance_sync_time").on(table.organizationId, table.synchronizationStatus, table.serverReceivedAt),
]);

export const operationalServiceEvents = sqliteTable("operational_service_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  personId: text("person_id").notNull().references(() => tenantPeople.id, { onDelete: "restrict" }),
  employeeId: text("employee_id").references(() => tenantEmployees.id, { onDelete: "restrict" }),
  clientId: text("client_id").references(() => tenantClients.id, { onDelete: "restrict" }),
  costCenterId: text("cost_center_id").references(() => tenantCostCenters.id, { onDelete: "restrict" }),
  serviceTypeId: text("service_type_id").notNull().references(() => tenantServiceTypes.id, { onDelete: "restrict" }),
  deviceId: text("device_id").references(() => tenantDevices.id, { onDelete: "restrict" }),
  biometricCredentialId: text("biometric_credential_id").references(() => biometricCredentials.id, { onDelete: "restrict" }),
  eventTimestamp: text("event_timestamp").notNull(),
  operationalDate: text("operational_date").notNull(),
  source: text("source").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  synchronizationStatus: text("synchronization_status").notNull().default("synced"),
  offlineEventId: text("offline_event_id"),
  override: integer("override", { mode: "boolean" }).notNull().default(false),
  overrideReason: text("override_reason"),
  authorizedByMembershipId: text("authorized_by_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  serverReceivedAt: text("server_received_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_operational_service_org_idempotency").on(table.organizationId, table.idempotencyKey),
  uniqueIndex("idx_operational_service_device_offline").on(table.deviceId, table.offlineEventId),
  index("idx_operational_service_org_branch_date").on(table.organizationId, table.branchId, table.operationalDate),
  index("idx_operational_service_person_type_date").on(table.organizationId, table.personId, table.serviceTypeId, table.operationalDate),
  index("idx_operational_service_client_date").on(table.organizationId, table.clientId, table.operationalDate),
  index("idx_operational_service_sync_time").on(table.organizationId, table.synchronizationStatus, table.serverReceivedAt),
]);

export const operationalServiceAttempts = sqliteTable("operational_service_attempts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  personId: text("person_id").references(() => tenantPeople.id, { onDelete: "restrict" }),
  serviceTypeId: text("service_type_id").references(() => tenantServiceTypes.id, { onDelete: "restrict" }),
  deviceId: text("device_id").references(() => tenantDevices.id, { onDelete: "restrict" }),
  eventId: text("event_id").references(() => operationalServiceEvents.id, { onDelete: "restrict" }),
  result: text("result").notNull(),
  reason: text("reason"),
  attemptedAt: text("attempted_at").notNull(),
  operationalDate: text("operational_date").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_operational_service_attempt_org_key").on(table.organizationId, table.idempotencyKey),
  index("idx_operational_service_attempt_org_date_result").on(table.organizationId, table.operationalDate, table.result),
  index("idx_operational_service_attempt_device_time").on(table.deviceId, table.attemptedAt),
]);

export const operationalSyncBatches = sqliteTable("operational_sync_batches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  deviceId: text("device_id").notNull().references(() => tenantDevices.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("pending"),
  eventCount: integer("event_count").notNull().default(0),
  acceptedCount: integer("accepted_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  lastAttemptAt: text("last_attempt_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_operational_sync_batch_org_key").on(table.organizationId, table.idempotencyKey),
  index("idx_operational_sync_batch_org_status_time").on(table.organizationId, table.status, table.createdAt),
  index("idx_operational_sync_batch_device_status").on(table.deviceId, table.status, table.createdAt),
]);

export const operationalSyncItems = sqliteTable("operational_sync_items", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => operationalSyncBatches.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  offlineEventId: text("offline_event_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("pending"),
  serverEntityId: text("server_entity_id"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: text("last_attempt_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_operational_sync_item_batch_offline").on(table.batchId, table.offlineEventId),
  index("idx_operational_sync_item_batch_status").on(table.batchId, table.status),
]);

export const tenantInventoryMovements = sqliteTable("tenant_inventory_movements", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  warehouseId: text("warehouse_id").notNull().references(() => tenantWarehouses.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull().references(() => tenantProducts.id, { onDelete: "restrict" }),
  movementType: text("movement_type").notNull(),
  quantityMinor: integer("quantity_minor").notNull(),
  unit: text("unit").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
}, (table) => [
  index("idx_tenant_inventory_movements_org_time").on(table.organizationId, table.createdAt),
  index("idx_tenant_inventory_movements_org_branch_time").on(table.organizationId, table.branchId, table.createdAt),
]);

// Sprint E: persistent, tenant-scoped food-safety and quality operations.
export const qualityTemplateVersions = sqliteTable("quality_template_versions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  rootTemplateId: text("root_template_id").notNull().references(() => tenantQualityTemplates.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull().default("draft"),
  nameSnapshot: text("name_snapshot").notNull(),
  codeSnapshot: text("code_snapshot").notNull(),
  category: text("category").notNull(),
  instructions: text("instructions").notNull().default(""),
  scheduleType: text("schedule_type").notNull().default("adhoc"),
  defaultDueTime: text("default_due_time"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  publishedAt: text("published_at"),
  publishedBy: text("published_by").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  lockedAt: text("locked_at"),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quality_template_versions_root_version").on(table.rootTemplateId, table.versionNumber),
  uniqueIndex("idx_quality_template_versions_org_idempotency").on(table.organizationId, table.idempotencyKey),
  index("idx_quality_template_versions_org_status").on(table.organizationId, table.status, table.updatedAt),
]);

export const qualityTemplateFields = sqliteTable("quality_template_fields", {
  id: text("id").primaryKey(),
  templateVersionId: text("template_version_id").notNull().references(() => qualityTemplateVersions.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  fieldType: text("field_type").notNull(),
  unit: text("unit"),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  minimumMilli: integer("minimum_milli"),
  maximumMilli: integer("maximum_milli"),
  expectedBoolean: integer("expected_boolean", { mode: "boolean" }),
  optionsJson: text("options_json").notNull().default("[]"),
  nonCompliantOptionsJson: text("non_compliant_options_json").notNull().default("[]"),
  deviationSeverity: text("deviation_severity").notNull().default("warning"),
  evidenceRequiredOnDeviation: integer("evidence_required_on_deviation", { mode: "boolean" }).notNull().default(false),
  displayOrder: integer("display_order").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_quality_template_fields_version_code").on(table.templateVersionId, table.code),
  index("idx_quality_template_fields_version_order").on(table.templateVersionId, table.displayOrder),
]);

export const qualityLogInstances = sqliteTable("quality_log_instances", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  templateVersionId: text("template_version_id").notNull().references(() => qualityTemplateVersions.id, { onDelete: "restrict" }),
  shiftId: text("shift_id").references(() => tenantShifts.id, { onDelete: "restrict" }),
  operationalDate: text("operational_date").notNull(),
  dueAt: text("due_at").notNull(),
  status: text("status").notNull().default("pending"),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  deviationCount: integer("deviation_count").notNull().default(0),
  assignedToMembershipId: text("assigned_to_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  signedAt: text("signed_at"),
  signedByMembershipId: text("signed_by_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  signerNameSnapshot: text("signer_name_snapshot"),
  signatureStatement: text("signature_statement"),
  revisionOfLogId: text("revision_of_log_id"),
  revisionNumber: integer("revision_number").notNull().default(1),
  revisionReason: text("revision_reason"),
  cancellationReason: text("cancellation_reason"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quality_logs_org_idempotency").on(table.organizationId, table.idempotencyKey),
  index("idx_quality_logs_org_branch_date").on(table.organizationId, table.branchId, table.operationalDate),
  index("idx_quality_logs_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_quality_logs_status_due_org").on(table.status, table.dueAt, table.organizationId),
  index("idx_quality_logs_template_date").on(table.templateVersionId, table.operationalDate),
  index("idx_quality_logs_revision_root").on(table.revisionOfLogId, table.revisionNumber),
]);

export const qualityLogAnswers = sqliteTable("quality_log_answers", {
  id: text("id").primaryKey(),
  logInstanceId: text("log_instance_id").notNull().references(() => qualityLogInstances.id, { onDelete: "restrict" }),
  fieldId: text("field_id").notNull().references(() => qualityTemplateFields.id, { onDelete: "restrict" }),
  valueType: text("value_type").notNull(),
  hasValue: integer("has_value", { mode: "boolean" }).notNull().default(true),
  valueText: text("value_text"),
  numericValueMilli: integer("numeric_value_milli"),
  booleanValue: integer("boolean_value", { mode: "boolean" }),
  optionValue: text("option_value"),
  inRange: integer("in_range", { mode: "boolean" }),
  notes: text("notes").notNull().default(""),
  capturedAt: text("captured_at").notNull(),
  capturedBy: text("captured_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quality_answers_log_field").on(table.logInstanceId, table.fieldId),
  index("idx_quality_answers_log_range").on(table.logInstanceId, table.inRange),
  index("idx_quality_answers_range_time").on(table.inRange, table.capturedAt, table.logInstanceId, table.fieldId),
]);

export const qualityCorrectiveActions = sqliteTable("quality_corrective_actions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  logInstanceId: text("log_instance_id").notNull().references(() => qualityLogInstances.id, { onDelete: "restrict" }),
  answerId: text("answer_id").references(() => qualityLogAnswers.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("warning"),
  status: text("status").notNull().default("open"),
  assignedToMembershipId: text("assigned_to_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  dueAt: text("due_at"),
  rootCause: text("root_cause"),
  immediateCorrection: text("immediate_correction"),
  preventiveAction: text("preventive_action"),
  resolution: text("resolution"),
  verificationNotes: text("verification_notes"),
  verifiedAt: text("verified_at"),
  verifiedBy: text("verified_by").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quality_corrective_answer").on(table.answerId),
  index("idx_quality_corrective_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_quality_corrective_branch_status").on(table.branchId, table.status),
]);

export const qualityEvidence = sqliteTable("quality_evidence", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  logInstanceId: text("log_instance_id").notNull().references(() => qualityLogInstances.id, { onDelete: "restrict" }),
  answerId: text("answer_id").references(() => qualityLogAnswers.id, { onDelete: "restrict" }),
  correctiveActionId: text("corrective_action_id").references(() => qualityCorrectiveActions.id, { onDelete: "restrict" }),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  note: text("note").notNull().default(""),
  evidenceType: text("evidence_type").notNull().default("general"),
  status: text("status").notNull().default("available"),
  capturedAt: text("captured_at").notNull(),
  capturedBy: text("captured_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quality_evidence_object_key").on(table.objectKey),
  index("idx_quality_evidence_org_log").on(table.organizationId, table.logInstanceId, table.capturedAt),
  index("idx_quality_evidence_action").on(table.correctiveActionId, table.capturedAt),
]);

export const qualityScheduleRules = sqliteTable("quality_schedule_rules", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  templateVersionId: text("template_version_id").notNull().references(() => qualityTemplateVersions.id, { onDelete: "restrict" }),
  shiftId: text("shift_id").references(() => tenantShifts.id, { onDelete: "restrict" }),
  assignedToMembershipId: text("assigned_to_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  scheduleType: text("schedule_type").notNull(),
  daysOfWeekJson: text("days_of_week_json").notNull().default("[]"),
  timesJson: text("times_json").notNull().default("[]"),
  intervalMinutes: integer("interval_minutes"),
  timezone: text("timezone").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status").notNull().default("active"),
  idempotencyKey: text("idempotency_key").notNull(),
  lastGeneratedThrough: text("last_generated_through"),
  createdBy: text("created_by").notNull().references(() => organizationMemberships.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_quality_schedule_org_key").on(table.organizationId, table.idempotencyKey),
  index("idx_quality_schedule_org_branch_status").on(table.organizationId, table.branchId, table.status),
  index("idx_quality_schedule_template_status").on(table.templateVersionId, table.status),
  index("idx_quality_schedule_status_org").on(table.status, table.organizationId, table.lastGeneratedThrough),
]);

export const qualityScheduleRuns = sqliteTable("quality_schedule_runs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  ruleId: text("rule_id").notNull().references(() => qualityScheduleRules.id, { onDelete: "restrict" }),
  generatedThrough: text("generated_through").notNull(),
  generatedCount: integer("generated_count").notNull().default(0),
  reusedCount: integer("reused_count").notNull().default(0),
  status: text("status").notNull(),
  errorSummary: text("error_summary"),
  idempotencyKey: text("idempotency_key").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("idx_quality_schedule_runs_org_key").on(table.organizationId, table.idempotencyKey),
  index("idx_quality_schedule_runs_rule_time").on(table.ruleId, table.startedAt),
]);

export const qualityLogEscalations = sqliteTable("quality_log_escalations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  branchId: text("branch_id").notNull().references(() => tenantBranches.id, { onDelete: "restrict" }),
  logInstanceId: text("log_instance_id").notNull().references(() => qualityLogInstances.id, { onDelete: "restrict" }),
  level: integer("level").notNull().default(1),
  severity: text("severity").notNull().default("warning"),
  reason: text("reason").notNull(),
  escalatedToMembershipId: text("escalated_to_membership_id").references(() => organizationMemberships.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_quality_log_escalation_level").on(table.logInstanceId, table.level),
  index("idx_quality_log_escalation_org_time").on(table.organizationId, table.createdAt),
]);

export const organizationAuditEvents = sqliteTable("organization_audit_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  outcome: text("outcome").notNull(),
  reason: text("reason"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_organization_audit_org_time").on(table.organizationId, table.createdAt),
  index("idx_organization_audit_actor_time").on(table.actorId, table.createdAt),
  index("idx_organization_audit_org_entity_time").on(table.organizationId, table.entityId, table.createdAt),
]);

export const dashboardMetricDefinitions = sqliteTable("dashboard_metric_definitions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  dataSource: text("data_source").notNull(),
  computation: text("computation").notNull(),
  freshnessSeconds: integer("freshness_seconds").notNull().default(300),
  sourceStatus: text("source_status").notNull().default("available"),
  missingBehavior: text("missing_behavior").notNull().default("unavailable"),
  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_dashboard_metric_definitions_code").on(table.code)]);

export const dashboardWidgetDefinitions = sqliteTable("dashboard_widget_definitions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  widgetType: text("widget_type").notNull().default("metric"),
  supportedSizesJson: text("supported_sizes_json").notNull().default('["small","medium","large","full"]'),
  metricCode: text("metric_code").references(() => dashboardMetricDefinitions.code, { onDelete: "restrict" }),
  sourceModuleCode: text("source_module_code"),
  requiredFeatureCode: text("required_feature_code"),
  requiredPermission: text("required_permission"),
  requiredScopeType: text("required_scope_type").notNull().default("branch"),
  dataSourceCode: text("data_source_code").notNull().default("dashboard_metric"),
  supportedFiltersJson: text("supported_filters_json").notNull().default('["branch","period"]'),
  refreshPolicy: text("refresh_policy").notNull().default("cache_then_revalidate"),
  staleAfterSeconds: integer("stale_after_seconds").notNull().default(60),
  emptyStateType: text("empty_state_type").notNull().default("zero"),
  sensitivityLevel: text("sensitivity_level").notNull().default("standard"),
  displayOrder: integer("display_order").notNull().default(0),
  sourceStatus: text("source_status").notNull().default("available"),
  availabilityReason: text("availability_reason"),
  supportsBranch: integer("supports_branch", { mode: "boolean" }).notNull().default(true),
  supportsPeriod: integer("supports_period", { mode: "boolean" }).notNull().default(false),
  defaultSize: text("default_size").notNull().default("medium"),
  sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_dashboard_widget_definitions_code").on(table.code),
  index("idx_dashboard_widget_definitions_status").on(table.status, table.category),
]);

export const dashboardPresets = sqliteTable("dashboard_presets", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  audience: text("audience").notNull(),
  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_dashboard_presets_code").on(table.code)]);

export const dashboardPresetWidgets = sqliteTable("dashboard_preset_widgets", {
  presetId: text("preset_id").notNull().references(() => dashboardPresets.id, { onDelete: "cascade" }),
  widgetId: text("widget_id").notNull().references(() => dashboardWidgetDefinitions.id, { onDelete: "restrict" }),
  displayOrder: integer("display_order").notNull(),
  size: text("size").notNull().default("medium"),
  required: integer("required", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  primaryKey({ columns: [table.presetId, table.widgetId] }),
  uniqueIndex("idx_dashboard_preset_widgets_order").on(table.presetId, table.displayOrder),
]);

export const roleDashboardDefaults = sqliteTable("role_dashboard_defaults", {
  roleCode: text("role_code").primaryKey(),
  presetId: text("preset_id").notNull().references(() => dashboardPresets.id, { onDelete: "restrict" }),
  priority: integer("priority").notNull().default(100),
});

export const businessProfileDashboardDefaults = sqliteTable("business_profile_dashboard_defaults", {
  businessProfileCode: text("business_profile_code").primaryKey(),
  presetId: text("preset_id").notNull().references(() => dashboardPresets.id, { onDelete: "restrict" }),
});

export const organizationDashboardOverrides = sqliteTable("organization_dashboard_overrides", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  targetType: text("target_type").notNull(),
  targetCode: text("target_code").notNull(),
  enabled: integer("enabled", { mode: "boolean" }),
  size: text("size"),
  displayOrder: integer("display_order"),
  valueJson: text("value_json").notNull().default("{}"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveUntil: text("effective_until"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("active"),
  createdByType: text("created_by_type").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_org_dashboard_overrides_effective").on(table.organizationId, table.targetType, table.targetCode, table.status, table.effectiveUntil),
]);

export const userDashboardPreferences = sqliteTable("user_dashboard_preferences", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "restrict" }),
  membershipId: text("membership_id").notNull().references(() => organizationMemberships.id, { onDelete: "cascade" }),
  dashboardCode: text("dashboard_code").notNull().default("operations"),
  presetCode: text("preset_code").notNull(),
  layoutJson: text("layout_json").notNull().default("[]"),
  filterJson: text("filter_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
}, (table) => [uniqueIndex("idx_user_dashboard_preferences_scope").on(table.organizationId, table.membershipId)]);

export const dashboardCacheEntries = sqliteTable("dashboard_cache_entries", {
  id: text("id").primaryKey(),
  cacheKey: text("cache_key").notNull(),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id, { onDelete: "cascade" }),
  membershipId: text("membership_id").notNull().references(() => organizationMemberships.id, { onDelete: "cascade" }),
  branchId: text("branch_id").references(() => tenantBranches.id, { onDelete: "cascade" }),
  filtersJson: text("filters_json").notNull(),
  payloadJson: text("payload_json").notNull(),
  configurationVersion: text("configuration_version").notNull(),
  generatedAt: text("generated_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  uniqueIndex("idx_dashboard_cache_key").on(table.cacheKey),
  index("idx_dashboard_cache_scope_expiry").on(table.organizationId, table.membershipId, table.expiresAt),
]);

// Autenticación nativa para despliegues públicos de KitchenMind.
export const authCredentials = sqliteTable("auth_credentials", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  emailNormalized: text("email_normalized").notNull(),
  displayName: text("display_name").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  passwordUpdatedAt: text("password_updated_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("auth_credentials_subject_unique").on(table.subjectId),
  uniqueIndex("auth_credentials_email_unique").on(table.emailNormalized),
]);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  emailNormalized: text("email_normalized").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
}, (table) => [
  uniqueIndex("auth_sessions_token_unique").on(table.tokenHash),
  index("auth_sessions_subject_status_idx").on(table.subjectId, table.expiresAt, table.revokedAt),
]);

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  emailNormalized: text("email_normalized").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
  index("password_reset_tokens_subject_idx").on(table.subjectId, table.expiresAt, table.usedAt),
]);

export const mobileAttendancePolicies = sqliteTable("mobile_attendance_policies", {
  branchId: text("branch_id").primaryKey().references(() => tenantBranches.id),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id),
  latitude: real("latitude").notNull(), longitude: real("longitude").notNull(),
  radiusMeters: integer("radius_meters").notNull(), maxAccuracyMeters: integer("max_accuracy_meters").notNull(),
  enabled: integer("enabled").notNull().default(0),
  updatedByMembershipId: text("updated_by_membership_id").notNull().references(() => organizationMemberships.id),
  updatedAt: text("updated_at").notNull(),
});

export const mobileAttendanceEnrollments = sqliteTable("mobile_attendance_enrollments", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id),
  employeeId: text("employee_id").notNull().references(() => tenantEmployees.id),
  emailNormalized: text("email_normalized").notNull(), tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(), usedAt: text("used_at"),
  createdByMembershipId: text("created_by_membership_id").notNull().references(() => organizationMemberships.id),
  createdAt: text("created_at").notNull(),
}, (table) => [index("mobile_attendance_enrollments_employee_idx").on(table.organizationId, table.employeeId, table.createdAt)]);

export const mobileAttendanceAccounts = sqliteTable("mobile_attendance_accounts", {
  employeeId: text("employee_id").primaryKey().references(() => tenantEmployees.id),
  organizationId: text("organization_id").notNull().references(() => tenantOrganizations.id),
  authUserId: text("auth_user_id").notNull(), emailNormalized: text("email_normalized").notNull(),
  status: text("status").notNull().default("active"), enrolledAt: text("enrolled_at").notNull(), revokedAt: text("revoked_at"),
}, (table) => [uniqueIndex("mobile_attendance_accounts_org_auth_unique").on(table.organizationId, table.authUserId)]);

export const mobileAttendanceEvidence = sqliteTable("mobile_attendance_evidence", {
  eventId: text("event_id").primaryKey().references(() => operationalAttendanceEvents.id),
  distanceMeters: integer("distance_meters").notNull(), accuracyMeters: integer("accuracy_meters").notNull(),
  locationCheckedAt: text("location_checked_at").notNull(), policyRadiusMeters: integer("policy_radius_meters").notNull(),
});
