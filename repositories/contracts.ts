import type {
  AttendanceEvent,
  AuditEvent,
  BaseEntity,
  BusinessProfile,
  Branch,
  CorrectiveAction,
  Employee,
  InventoryLot,
  InventoryMovement,
  InternalClient,
  Organization,
  Plan,
  Product,
  PurchaseOrder,
  QualitySubmission,
  QualityTemplate,
  Role,
  ServiceEvent,
  ServiceType,
  Shift,
  Supplier,
  Subscription,
  User,
} from "@/types";

export type CreateInput<T extends BaseEntity> = Omit<T, "id" | "createdAt" | "updatedAt">;
export type UpdateInput<T extends BaseEntity> = Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "organizationId">>;

export interface EntityRepository<T extends BaseEntity> {
  list(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(input: CreateInput<T>): Promise<T>;
  update(id: string, input: UpdateInput<T>): Promise<T>;
}

export interface AppendOnlyRepository<T extends BaseEntity> {
  list(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(input: CreateInput<T>): Promise<T>;
}

export interface EmployeeFilters {
  organizationId: string;
  branchId?: string;
  shiftId?: string;
  status?: Employee["status"];
  query?: string;
}

export interface EmployeeRepository extends EntityRepository<Employee> {
  listFiltered(filters: EmployeeFilters): Promise<Employee[]>;
  findByIdentifier(organizationId: string, identifier: string): Promise<Employee | null>;
  deactivate(id: string, actorId: string): Promise<Employee>;
}

export interface AttendanceRepository extends EntityRepository<AttendanceEvent> {
  listByEmployee(employeeId: string): Promise<AttendanceEvent[]>;
  findByIdempotencyKey(key: string): Promise<AttendanceEvent | null>;
}

export interface ServiceRepository {
  serviceTypes: EntityRepository<ServiceType>;
  serviceEvents: EntityRepository<ServiceEvent>;
  clients: EntityRepository<InternalClient>;
  findEventByIdempotencyKey(key: string): Promise<ServiceEvent | null>;
}

export interface InventoryRepository {
  products: EntityRepository<Product>;
  lots: EntityRepository<InventoryLot>;
  movements: EntityRepository<InventoryMovement>;
}

export interface PurchasingRepository {
  suppliers: EntityRepository<Supplier>;
  orders: EntityRepository<PurchaseOrder>;
}

export interface QualityRepository {
  templates: EntityRepository<QualityTemplate>;
  submissions: EntityRepository<QualitySubmission>;
  correctiveActions: EntityRepository<CorrectiveAction>;
}

export interface KitchenMindDataProvider {
  businessProfiles: EntityRepository<BusinessProfile>;
  plans: EntityRepository<Plan>;
  subscriptions: EntityRepository<Subscription>;
  organizations: EntityRepository<Organization>;
  branches: EntityRepository<Branch>;
  roles: EntityRepository<Role>;
  users: EntityRepository<User>;
  shifts: EntityRepository<Shift>;
  employees: EmployeeRepository;
  attendance: AttendanceRepository;
  services: ServiceRepository;
  inventory: InventoryRepository;
  purchasing: PurchasingRepository;
  quality: QualityRepository;
  audit: AppendOnlyRepository<AuditEvent>;
  hydrate(): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
  getRevision(): number;
}
