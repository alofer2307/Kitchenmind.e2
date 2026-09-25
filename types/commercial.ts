export type ProspectStatus =
  | "new"
  | "contacted"
  | "discovery"
  | "quoted"
  | "negotiation"
  | "won"
  | "lost"
  | "paused"
  | "archived";

export type FollowUpStatus = "pending" | "completed" | "cancelled";
export type DiagnosisStatus = "draft" | "in_progress" | "completed" | "superseded" | "cancelled";
export type DiagnosisFieldType = "boolean" | "number" | "text" | "textarea" | "select" | "multiselect" | "currency" | "percentage";
export type CatalogStatus = "active" | "inactive";
export type PriceBookVersionStatus = "draft" | "published" | "archived";
export type QuoteStatus = "draft" | "ready" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "cancelled";
export type QuoteDeliveryMethod = "email" | "whatsapp" | "meeting" | "other";
export type QuoteAdjustmentType = "percentage" | "fixed";
export type QuoteAdjustmentScope = "subtotal" | "recurring" | "implementation" | "line";
export type BillingPeriod = "one_time" | "monthly" | "annual";
export type PriceChargeType =
  | "one_time"
  | "monthly"
  | "annual"
  | "per_branch"
  | "per_employee"
  | "per_user"
  | "per_device"
  | "per_warehouse"
  | "per_usage"
  | "custom";
export type CommercialUnitType = "organization" | "branch" | "employee" | "user" | "device" | "warehouse" | "service" | "movement" | "flat" | "custom";

export interface PlatformActor {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
}

export interface ProspectSummary {
  id: string;
  commercialName: string;
  legalName: string | null;
  businessProfileId: string | null;
  businessType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  countryCode: string;
  estimatedBranches: number;
  estimatedEmployees: number;
  estimatedAdminUsers: number;
  estimatedDevices: number;
  estimatedDailyServices: number;
  estimatedWarehouses: number;
  operates24Hours: boolean;
  multiBranch: boolean;
  requiresOffline: boolean;
  status: ProspectStatus;
  lostReason: string | null;
  nextAction: string;
  nextActionAt: string | null;
  ownerPlatformUserId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  archivedAt: string | null;
}

export interface ProspectCreateInput {
  legalName?: string;
  commercialName: string;
  businessProfileId?: string;
  businessType: string;
  contactName: string;
  contactPosition?: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state?: string;
  countryCode: string;
  estimatedBranches: number;
  estimatedEmployees: number;
  estimatedAdminUsers: number;
  estimatedDevices: number;
  estimatedDailyServices: number;
  estimatedWarehouses: number;
  operates24Hours: boolean;
  multiBranch: boolean;
  requiresOffline: boolean;
  estimatedMonthlyMovements?: number;
  primaryNeed: string;
  currentProblems: string;
  currentSystems: string;
  acquisitionSource?: string;
  nextAction: string;
  nextActionAt?: string;
  allowPossibleDuplicate?: boolean;
}

export interface ProspectContact {
  id: string;
  prospectId: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CommercialNote {
  id: string;
  prospectId: string;
  authorPlatformUserId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  editedAt: string | null;
}

export interface FollowUp {
  id: string;
  prospectId: string;
  type: string;
  scheduledAt: string;
  responsiblePlatformUserId: string;
  responsibleName: string;
  description: string;
  status: FollowUpStatus;
  result: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface DiagnosisQuestion {
  id: string;
  templateVersion: number;
  sectionCode: string;
  questionCode: string;
  label: string;
  description: string | null;
  fieldType: DiagnosisFieldType;
  required: boolean;
  options: string[];
  displayOrder: number;
  validationRules: Record<string, unknown> | null;
  visibilityCondition: Record<string, unknown> | null;
  moduleCode: string | null;
  featureCode: string | null;
}

export interface DiagnosisAnswer {
  questionId: string;
  questionCode: string;
  value: string | number | boolean | string[] | null;
  source: "prospect" | "diagnosis" | "recommendation";
  updatedAt: string;
}

export interface Diagnosis {
  id: string;
  prospectId: string;
  versionNumber: number;
  templateVersion: number;
  status: DiagnosisStatus;
  completionPercentage: number;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  answers: DiagnosisAnswer[];
}

export interface CommercialModule {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  status: CatalogStatus;
  displayOrder: number;
  version: number;
  features: CommercialFeature[];
  dependencies: string[];
}

export interface CommercialFeature {
  id: string;
  code: string;
  moduleId: string;
  name: string;
  description: string;
  unitType: CommercialUnitType;
  billable: boolean;
  configurable: boolean;
  status: CatalogStatus;
}

export interface PriceBookSummary {
  id: string;
  name: string;
  currency: string;
  countryCode: string | null;
  status: CatalogStatus;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  activeEffectiveFrom: string | null;
  draftVersionId: string | null;
  draftVersionNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceRule {
  id: string;
  priceBookVersionId: string;
  code: string;
  name: string;
  description: string;
  chargeType: PriceChargeType;
  billingPeriod: BillingPeriod;
  unitType: CommercialUnitType;
  moduleCode: string | null;
  featureCode: string | null;
  unitAmountMinor: number;
  currency: string;
  minimumQuantity: number;
  maximumQuantity: number | null;
  priority: number;
  stackingMode: "add" | "replace";
  active: boolean;
  internalCostMinor: number | null;
}

export interface PriceTier {
  id: string;
  priceRuleId: string;
  minimumQuantity: number;
  maximumQuantity: number | null;
  unitAmountMinor: number;
  flatAmountMinor: number;
}

export interface PriceBookDetail extends PriceBookSummary {
  versions: Array<{
    id: string;
    versionNumber: number;
    status: PriceBookVersionStatus;
    effectiveFrom: string;
    effectiveUntil: string | null;
    notes: string;
    createdAt: string;
    publishedAt: string | null;
  }>;
  selectedVersion: {
    id: string;
    versionNumber: number;
    status: PriceBookVersionStatus;
    effectiveFrom: string;
    effectiveUntil: string | null;
    notes: string;
    rules: Array<PriceRule & { tiers: PriceTier[] }>;
  } | null;
}

export interface PricingSelection {
  profileCode: string;
  moduleCodes: string[];
  featureCodes: string[];
  quantities: {
    branches: number;
    employees: number;
    users: number;
    devices: number;
    warehouses: number;
    monthlyMovements: number;
  };
  implementationCodes: string[];
  supportCode: string | null;
  trainingCodes: string[];
  hardware: Array<{ code: string; quantity: number }>;
  billingCycle: "monthly" | "annual";
  taxRateBasisPoints: number;
}

export interface CalculatedQuoteLine {
  sourceRuleId: string | null;
  code: string;
  description: string;
  explanation: string;
  billingPeriod: BillingPeriod;
  unitType: CommercialUnitType;
  quantity: number;
  unitAmountMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  internalCostMinor: number | null;
  moduleCode: string | null;
  featureCode: string | null;
}

export interface PricingResult {
  currency: string;
  lines: CalculatedQuoteLine[];
  subtotalOneTimeMinor: number;
  subtotalRecurringMinor: number;
  discountOneTimeMinor: number;
  discountRecurringMinor: number;
  discountTotalMinor: number;
  taxOneTimeMinor: number;
  taxRecurringMinor: number;
  taxTotalMinor: number;
  totalOneTimeMinor: number;
  monthlyTotalMinor: number;
  totalRecurringMinor: number;
  annualTotalMinor: number;
  annualEquivalentMinor: number;
  firstPaymentMinor: number;
  internalCostMinor: number;
  estimatedMonthlyMarginMinor: number;
  warnings: string[];
  appliedRules: string[];
}

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  prospectId: string;
  prospectName: string;
  status: QuoteStatus;
  currentVersionNumber: number;
  currency: string;
  monthlyTotalMinor: number;
  oneTimeTotalMinor: number;
  validUntil: string;
  sentAt: string | null;
  acceptedAt: string | null;
  ownerPlatformUserId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface QuoteAdjustment {
  id: string;
  quoteVersionId: string;
  lineId: string | null;
  type: QuoteAdjustmentType;
  scope: QuoteAdjustmentScope;
  value: number;
  amountMinor: number;
  reason: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface QuoteVersionDetail {
  id: string;
  quoteId: string;
  versionNumber: number;
  priceBookVersionId: string;
  priceBookId: string;
  priceBookVersionNumber: number;
  status: "draft" | "finalized";
  diagnosisId: string | null;
  commercialNameSnapshot: string;
  contactSnapshot: {
    id: string | null;
    name: string;
    position: string;
    email: string;
    phone: string;
  };
  currency: string;
  validUntil: string;
  billingCycle: "monthly" | "annual";
  commercialTerms: string;
  internalNotes: string;
  customerNotes: string;
  subtotalOneTimeMinor: number;
  subtotalRecurringMinor: number;
  discountOneTimeMinor: number;
  discountRecurringMinor: number;
  discountTotalMinor: number;
  taxOneTimeMinor: number;
  taxRecurringMinor: number;
  taxTotalMinor: number;
  totalOneTimeMinor: number;
  monthlyTotalMinor: number;
  totalRecurringMinor: number;
  annualTotalMinor: number;
  annualEquivalentMinor: number;
  firstPaymentMinor: number;
  internalCostMinor: number;
  estimatedMonthlyMarginMinor: number;
  selection: PricingSelection;
  lines: CalculatedQuoteLine[];
  adjustments: QuoteAdjustment[];
  createdAt: string;
  createdBy: string;
  lockedAt: string | null;
}

export interface QuoteDetail extends QuoteSummary {
  legalName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  versions: QuoteVersionDetail[];
  currentVersion: QuoteVersionDetail;
  statusHistory: Array<{
    id: string;
    fromStatus: QuoteStatus | null;
    toStatus: QuoteStatus;
    reason: string | null;
    deliveryMethod: QuoteDeliveryMethod | null;
    recipient: string | null;
    confirmedBy: string | null;
    effectiveAt: string | null;
    markProspectLost: boolean;
    createdAt: string;
    actorName: string;
  }>;
}

export interface CustomerQuoteView {
  id: string;
  quoteNumber: string;
  createdAt: string;
  prospectName: string;
  legalName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: QuoteStatus;
  version: {
    versionNumber: number;
    currency: string;
    validUntil: string;
    billingCycle: "monthly" | "annual";
    commercialTerms: string;
    customerNotes: string;
    subtotalOneTimeMinor: number;
    subtotalRecurringMinor: number;
    discountTotalMinor: number;
    taxTotalMinor: number;
    totalOneTimeMinor: number;
    monthlyTotalMinor: number;
    annualTotalMinor: number;
    firstPaymentMinor: number;
    lines: Array<Omit<CalculatedQuoteLine, "sourceRuleId" | "internalCostMinor">>;
  };
}

export interface ProspectDetail extends ProspectSummary {
  contactPosition: string | null;
  state: string | null;
  estimatedMonthlyMovements: number | null;
  primaryNeed: string;
  currentProblems: string;
  currentSystems: string;
  acquisitionSource: string | null;
  contacts: ProspectContact[];
  notes: CommercialNote[];
  followUps: FollowUp[];
  diagnosis: Diagnosis | null;
  diagnosisQuestions: DiagnosisQuestion[];
  recommendedModuleCodes: string[];
  quotes: QuoteSummary[];
  activity: Array<{ id: string; action: string; reason: string | null; createdAt: string; actorName: string }>;
}

export interface CommercialOverview {
  newProspects: number;
  activeOpportunities: number;
  diagnosesInProgress: number;
  draftQuotes: number;
  pendingQuotes: number;
  acceptedQuotes: number;
  expiredQuotes: number;
  overdueFollowUps: number;
  upcomingFollowUps: number;
  quotedMonthlyMinor: number;
  acceptedMonthlyMinor: number;
  quotedImplementationMinor: number;
  acceptedImplementationMinor: number;
  currency: string;
  recentProspects: ProspectSummary[];
  attention: Array<{ id: string; type: "follow_up" | "quote" | "diagnosis"; title: string; detail: string; href: string }>;
}
