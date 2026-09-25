import type {
  CommercialModule,
  CommercialOverview,
  PriceBookDetail,
  PriceBookSummary,
  ProspectCreateInput,
  ProspectDetail,
  ProspectStatus,
  ProspectSummary,
  QuoteDetail,
  QuoteStatus,
  QuoteSummary,
} from "@/types";

export interface SqlCommand {
  sql: string;
  values?: unknown[];
}

export interface CommercialDataProvider {
  first<T>(sql: string, values?: unknown[]): Promise<T | null>;
  all<T>(sql: string, values?: unknown[]): Promise<T[]>;
  run(sql: string, values?: unknown[]): Promise<void>;
  batch(commands: SqlCommand[]): Promise<void>;
}

export interface ProspectListFilters {
  query?: string;
  status?: ProspectStatus;
  businessType?: string;
  ownerPlatformUserId?: string;
  followUp?: "overdue" | "upcoming";
  dateFrom?: string;
  dateTo?: string;
  sort?: "updated" | "created" | "follow_up";
  page: number;
  pageSize: number;
}

export interface ProspectListResult {
  items: ProspectSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProspectDuplicate {
  id: string;
  commercialName: string;
  contactEmail: string;
  contactPhone: string;
  matches: string[];
}

export interface QuoteListFilters {
  query?: string;
  status?: QuoteStatus;
  ownerPlatformUserId?: string;
  currency?: string;
  businessType?: string;
  validity?: "active" | "expired";
  dateFrom?: string;
  dateTo?: string;
}

export interface QuoteTransitionInput {
  reason?: string;
  deliveryMethod?: string;
  recipient?: string;
  confirmedBy?: string;
  effectiveAt?: string;
  markProspectLost?: boolean;
}

export interface CommercialRepository {
  ensureCatalog(platformUserId: string): Promise<void>;
  getOverview(): Promise<CommercialOverview>;
  listProspects(filters: ProspectListFilters): Promise<ProspectListResult>;
  findProspectDuplicates(name: string, email: string, phone: string): Promise<ProspectDuplicate[]>;
  createProspect(input: ProspectCreateInput, platformUserId: string): Promise<{ id: string }>;
  getProspect(id: string): Promise<ProspectDetail | null>;
  updateProspect(id: string, version: number, changes: Record<string, unknown>, platformUserId: string): Promise<void>;
  transitionProspect(id: string, version: number, status: ProspectStatus, reason: string | null, platformUserId: string): Promise<void>;
  addContact(prospectId: string, input: { name: string; position: string; email: string; phone: string; isPrimary: boolean }, platformUserId: string): Promise<void>;
  addNote(prospectId: string, content: string, platformUserId: string): Promise<void>;
  addFollowUp(prospectId: string, input: { type: string; scheduledAt: string; description: string }, platformUserId: string): Promise<void>;
  completeFollowUp(id: string, result: string, platformUserId: string): Promise<void>;
  saveDiagnosis(prospectId: string, answers: Record<string, unknown>, platformUserId: string): Promise<void>;
  completeDiagnosis(prospectId: string, platformUserId: string): Promise<void>;
  reviseDiagnosis(prospectId: string, platformUserId: string): Promise<void>;
  getCatalog(): Promise<CommercialModule[]>;
  listPriceBooks(): Promise<PriceBookSummary[]>;
  getPriceBook(id: string, versionId?: string): Promise<PriceBookDetail | null>;
  updatePriceRule(priceBookId: string, versionId: string, ruleId: string, unitAmountMinor: number, internalCostMinor: number | null, platformUserId: string): Promise<void>;
  updatePriceTiers(priceBookId: string, versionId: string, ruleId: string, tiers: Array<{ minimumQuantity: number; maximumQuantity: number | null; unitAmountMinor: number; flatAmountMinor: number }>, platformUserId: string): Promise<void>;
  publishPriceBookVersion(priceBookId: string, versionId: string, effectiveFrom: string, notes: string, platformUserId: string): Promise<void>;
  createPriceBookRevision(priceBookId: string, notes: string, platformUserId: string): Promise<string>;
  expireDueQuotes(platformUserId: string): Promise<number>;
  listQuotes(filters?: QuoteListFilters): Promise<QuoteSummary[]>;
  getQuote(id: string): Promise<QuoteDetail | null>;
  createQuote(input: Record<string, unknown>, platformUserId: string): Promise<{ id: string; quoteNumber: string }>;
  reviseQuote(id: string, input: Record<string, unknown>, platformUserId: string): Promise<void>;
  transitionQuote(id: string, expectedVersion: number, status: QuoteStatus, input: QuoteTransitionInput, platformUserId: string): Promise<void>;
}
