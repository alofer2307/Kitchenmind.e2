export type EntityId = string;
export type ISODateTime = string;

export type ModuleKey =
  | "core"
  | "personnel"
  | "services"
  | "quality"
  | "inventory"
  | "purchasing"
  | "production"
  | "finance"
  | "kiro";

export type BusinessProfileKey =
  | "street_food"
  | "cafe"
  | "restaurant"
  | "dark_kitchen"
  | "central_kitchen"
  | "industrial_canteen"
  | "institutional";

export type BillingModel = "per_organization" | "per_branch" | "custom";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "grace_period" | "suspended" | "cancelled";

export type Permission =
  | "dashboard.read"
  | "employees.read"
  | "employees.write"
  | "attendance.read"
  | "attendance.adjust"
  | "services.read"
  | "services.override"
  | "inventory.read"
  | "inventory.write"
  | "purchases.read"
  | "purchases.write"
  | "quality.read"
  | "quality.write"
  | "audit.read"
  | "settings.manage";

export interface BaseEntity {
  id: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy: EntityId;
}

export interface OrganizationScoped {
  organizationId: EntityId;
}

export interface BranchScoped extends OrganizationScoped {
  branchId: EntityId;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  businessProfileId: EntityId;
  planId: EntityId;
  countryCode: string;
  timezone: string;
  currency: string;
  estimatedEmployees: number;
  plannedBranches: number;
  onboardingStatus: "not_started" | "in_progress" | "ready";
  activeModules: ModuleKey[];
  status: "active" | "inactive" | "suspended";
}

export interface BusinessProfile extends BaseEntity {
  key: BusinessProfileKey;
  name: string;
  description: string;
  recommendedModules: ModuleKey[];
  status: "active" | "inactive";
}

export interface PlanLimits {
  branches: number | null;
  users: number | null;
  employees: number | null;
  devices: number | null;
}

export interface Plan extends BaseEntity {
  code: string;
  name: string;
  description: string;
  billingModel: BillingModel;
  monthlyPrice: number | null;
  currency: string;
  includedModules: ModuleKey[];
  limits: PlanLimits;
  status: "active" | "inactive";
}

export interface Subscription extends BaseEntity, OrganizationScoped {
  planId: EntityId;
  status: SubscriptionStatus;
  billingCycle: "monthly" | "annual";
  currentPeriodStart: ISODateTime;
  currentPeriodEnd: ISODateTime;
  trialEndsAt?: ISODateTime;
  graceEndsAt?: ISODateTime;
  provider: "manual" | "stripe" | "mercado_pago";
  externalCustomerId?: string;
  externalSubscriptionId?: string;
}

export interface Branch extends BaseEntity, OrganizationScoped {
  name: string;
  code: string;
  timezone: string;
  address?: string;
  status: "active" | "inactive";
}

export interface Role extends BaseEntity, OrganizationScoped {
  name: string;
  permissions: Permission[];
  status: "active" | "inactive";
}

export interface User extends BaseEntity, OrganizationScoped {
  name: string;
  email: string;
  roleId: EntityId;
  branchIds: EntityId[];
  platformAccess?: "owner" | "operator" | "support";
  status: "active" | "inactive";
}

export interface Shift extends BaseEntity, OrganizationScoped {
  branchId?: EntityId;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  status: "active" | "inactive";
}

export type IdentifierType = "qr" | "barcode" | "manual";

export interface EmployeeIdentifier {
  type: IdentifierType;
  value: string;
  active: boolean;
  assignedAt: ISODateTime;
}

export interface Employee extends BaseEntity, BranchScoped {
  employeeNumber: string;
  name: string;
  photoUrl?: string;
  status: "active" | "inactive";
  shiftId: EntityId;
  clientId?: EntityId;
  employeeIdentifier?: EmployeeIdentifier;
}

export type EventSource = "scanner" | "camera" | "manual" | "offline_sync";
export type SyncStatus = "synced" | "pending" | "failed";
export type AttendanceEventType = "entry" | "exit" | "late" | "manual_adjustment";

export interface AttendanceEvent extends BaseEntity, BranchScoped {
  employeeId: EntityId;
  timestamp: ISODateTime;
  eventType: AttendanceEventType;
  adjustedEventType?: Exclude<AttendanceEventType, "manual_adjustment">;
  deviceId: EntityId;
  idempotencyKey: string;
  source: EventSource;
  syncStatus: SyncStatus;
  reason?: string;
  actorUserId?: EntityId;
}

export interface InternalClient extends BaseEntity, OrganizationScoped {
  name: string;
  code: string;
  status: "active" | "inactive";
}

export interface ServiceType extends BaseEntity, OrganizationScoped {
  branchId?: EntityId;
  name: string;
  startTime: string;
  endTime: string;
  status: "active" | "inactive";
}

export interface ServiceEvent extends BaseEntity, BranchScoped {
  employeeId: EntityId;
  clientId?: EntityId;
  serviceTypeId: EntityId;
  timestamp: ISODateTime;
  deviceId: EntityId;
  idempotencyKey: string;
  source: EventSource;
  syncStatus: SyncStatus;
  override: boolean;
  overrideReason?: string;
  actorUserId?: EntityId;
}

export type Unit = "kg" | "g" | "l" | "ml" | "piece" | "box";

export interface Product extends BaseEntity, OrganizationScoped {
  name: string;
  sku: string;
  baseUnit: Unit;
  category: string;
  minimumStock: number;
  status: "active" | "inactive";
}

export interface InventoryLot extends BaseEntity, BranchScoped {
  productId: EntityId;
  supplierId?: EntityId;
  receivedAt: ISODateTime;
  expiresAt?: ISODateTime;
  quantity: number;
  unit: Unit;
  location: string;
  unitCost: number;
}

export type InventoryMovementType = "entry" | "exit" | "waste" | "adjustment" | "transfer";

export interface InventoryMovement extends BaseEntity, BranchScoped {
  productId: EntityId;
  lotId?: EntityId;
  movementType: InventoryMovementType;
  quantity: number;
  unit: Unit;
  reason?: string;
  destinationBranchId?: EntityId;
  estimatedCost: number;
}

export interface Supplier extends BaseEntity, OrganizationScoped {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  status: "active" | "inactive";
}

export interface PurchaseOrderLine {
  productId: EntityId;
  quantity: number;
  unit: Unit;
  unitCost: number;
  reason: string;
}

export interface PurchaseOrder extends BaseEntity, BranchScoped {
  supplierId: EntityId;
  status: "suggested" | "approved" | "ordered" | "received" | "cancelled";
  expectedAt?: ISODateTime;
  lines: PurchaseOrderLine[];
}

export type QualityFieldType = "number" | "text" | "boolean" | "select" | "date" | "time";

export interface QualityTemplateField {
  id: EntityId;
  label: string;
  type: QualityFieldType;
  unit?: string;
  minimum?: number;
  maximum?: number;
  required: boolean;
  options?: string[];
}

export interface QualityTemplate extends BaseEntity, OrganizationScoped {
  branchId?: EntityId;
  name: string;
  category: "temperature" | "chlorine" | "ph" | "reception" | "sample" | "cleaning" | "hygiene" | "audit";
  frequency: string;
  area: string;
  fields: QualityTemplateField[];
  status: "active" | "inactive";
}

export interface QualityValue {
  fieldId: EntityId;
  value: string | number | boolean;
  withinRange?: boolean;
}

export interface QualitySubmission extends BaseEntity, BranchScoped {
  templateId: EntityId;
  values: QualityValue[];
  submittedAt: ISODateTime;
  status: "compliant" | "incident";
}

export interface CorrectiveAction extends BaseEntity, BranchScoped {
  submissionId: EntityId;
  description: string;
  status: "open" | "closed";
  closedAt?: ISODateTime;
}

export interface AuditEvent extends BaseEntity, OrganizationScoped {
  branchId?: EntityId;
  actorId: EntityId;
  action: string;
  entity: string;
  entityId: EntityId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  timestamp: ISODateTime;
}

export interface DemoState {
  businessProfiles: BusinessProfile[];
  plans: Plan[];
  subscriptions: Subscription[];
  organizations: Organization[];
  branches: Branch[];
  roles: Role[];
  users: User[];
  shifts: Shift[];
  employees: Employee[];
  clients: InternalClient[];
  attendanceEvents: AttendanceEvent[];
  serviceTypes: ServiceType[];
  serviceEvents: ServiceEvent[];
  products: Product[];
  inventoryLots: InventoryLot[];
  inventoryMovements: InventoryMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  qualityTemplates: QualityTemplate[];
  qualitySubmissions: QualitySubmission[];
  correctiveActions: CorrectiveAction[];
  auditEvents: AuditEvent[];
}
