import type {
  AttendanceRepository,
  AppendOnlyRepository,
  CreateInput,
  EmployeeFilters,
  EmployeeRepository,
  EntityRepository,
  InventoryRepository,
  KitchenMindDataProvider,
  PurchasingRepository,
  QualityRepository,
  ServiceRepository,
  UpdateInput,
} from "@/repositories";
import type {
  AttendanceEvent,
  AuditEvent,
  BaseEntity,
  Branch,
  BusinessProfile,
  CorrectiveAction,
  DemoState,
  Employee,
  InternalClient,
  InventoryLot,
  InventoryMovement,
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
import { createId } from "@/utils/id";
import { createDemoState } from "./demo/demo-seed";

const STORAGE_KEY = "kitchenmind.local-demo.v1";

type CollectionKey = keyof DemoState;

interface StorageEnvelope {
  version: 1 | 2;
  state: Partial<DemoState>;
}

function clone<T>(value: T): T {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
}

function isStorageEnvelope(value: unknown): value is StorageEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (record.version === 1 || record.version === 2) && Boolean(record.state && typeof record.state === "object");
}

function migrateState(state: Partial<DemoState>): DemoState {
  const defaults = createDemoState();
  const defaultOrganization = defaults.organizations[0];
  const organizations = (state.organizations ?? defaults.organizations).map((organization) => Object.assign({
    businessProfileId: defaultOrganization.businessProfileId,
    planId: defaultOrganization.planId,
    countryCode: defaultOrganization.countryCode,
    timezone: defaultOrganization.timezone,
    currency: defaultOrganization.currency,
    estimatedEmployees: defaultOrganization.estimatedEmployees,
    plannedBranches: defaultOrganization.plannedBranches,
    onboardingStatus: defaultOrganization.onboardingStatus,
  }, organization));
  const users = (state.users ?? defaults.users).map((user) =>
    user.id === "user-owner-demo" && !user.platformAccess ? { ...user, platformAccess: "owner" as const } : user,
  );
  return {
    ...defaults,
    ...state,
    businessProfiles: state.businessProfiles ?? defaults.businessProfiles,
    plans: state.plans ?? defaults.plans,
    subscriptions: state.subscriptions ?? defaults.subscriptions,
    organizations,
    users,
  };
}

export class LocalDemoProvider implements KitchenMindDataProvider {
  private state: DemoState = createDemoState();
  private revision = 0;
  private readonly listeners = new Set<() => void>();

  readonly businessProfiles: EntityRepository<BusinessProfile>;
  readonly plans: EntityRepository<Plan>;
  readonly subscriptions: EntityRepository<Subscription>;
  readonly organizations: EntityRepository<Organization>;
  readonly branches: EntityRepository<Branch>;
  readonly roles: EntityRepository<Role>;
  readonly users: EntityRepository<User>;
  readonly shifts: EntityRepository<Shift>;
  readonly employees: EmployeeRepository;
  readonly attendance: AttendanceRepository;
  readonly services: ServiceRepository;
  readonly inventory: InventoryRepository;
  readonly purchasing: PurchasingRepository;
  readonly quality: QualityRepository;
  readonly audit: AppendOnlyRepository<AuditEvent>;

  constructor() {
    this.businessProfiles = this.createRepository<BusinessProfile>("businessProfiles", "profile");
    this.plans = this.createRepository<Plan>("plans", "plan");
    this.subscriptions = this.createRepository<Subscription>("subscriptions", "subscription");
    this.organizations = this.createRepository<Organization>("organizations", "org");
    this.branches = this.createRepository<Branch>("branches", "branch");
    this.roles = this.createRepository<Role>("roles", "role");
    this.users = this.createRepository<User>("users", "user");
    this.shifts = this.createRepository<Shift>("shifts", "shift");

    const employeeRepository = this.createRepository<Employee>("employees", "employee");
    this.employees = {
      ...employeeRepository,
      listFiltered: async (filters: EmployeeFilters) => {
        const query = filters.query?.trim().toLocaleLowerCase("es-MX");
        return (await employeeRepository.list()).filter((employee) => {
          if (employee.organizationId !== filters.organizationId) return false;
          if (filters.branchId && employee.branchId !== filters.branchId) return false;
          if (filters.shiftId && employee.shiftId !== filters.shiftId) return false;
          if (filters.status && employee.status !== filters.status) return false;
          if (!query) return true;
          return employee.name.toLocaleLowerCase("es-MX").includes(query) || employee.employeeNumber.toLocaleLowerCase("es-MX").includes(query);
        });
      },
      findByIdentifier: async (organizationId: string, identifier: string) => {
        const normalized = identifier.trim().toUpperCase();
        return (
          (await employeeRepository.list()).find(
            (employee) =>
              employee.organizationId === organizationId &&
              employee.status === "active" &&
              employee.employeeIdentifier?.active &&
              employee.employeeIdentifier.value.trim().toUpperCase() === normalized,
          ) ?? null
        );
      },
      deactivate: async (id: string) => employeeRepository.update(id, { status: "inactive" }),
    };

    const attendanceRepository = this.createRepository<AttendanceEvent>("attendanceEvents", "attendance");
    this.attendance = {
      ...attendanceRepository,
      listByEmployee: async (employeeId: string) =>
        (await attendanceRepository.list())
          .filter((event) => event.employeeId === employeeId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      findByIdempotencyKey: async (key: string) =>
        (await attendanceRepository.list()).find((event) => event.idempotencyKey === key) ?? null,
    };

    const serviceTypes = this.createRepository<ServiceType>("serviceTypes", "service-type");
    const serviceEvents = this.createRepository<ServiceEvent>("serviceEvents", "service");
    const clients = this.createRepository<InternalClient>("clients", "client");
    this.services = {
      serviceTypes,
      serviceEvents,
      clients,
      findEventByIdempotencyKey: async (key: string) =>
        (await serviceEvents.list()).find((event) => event.idempotencyKey === key) ?? null,
    };

    this.inventory = {
      products: this.createRepository<Product>("products", "product"),
      lots: this.createRepository<InventoryLot>("inventoryLots", "lot"),
      movements: this.createRepository<InventoryMovement>("inventoryMovements", "movement"),
    };
    this.purchasing = {
      suppliers: this.createRepository<Supplier>("suppliers", "supplier"),
      orders: this.createRepository<PurchaseOrder>("purchaseOrders", "purchase"),
    };
    this.quality = {
      templates: this.createRepository<QualityTemplate>("qualityTemplates", "quality-template"),
      submissions: this.createRepository<QualitySubmission>("qualitySubmissions", "quality-submission"),
      correctiveActions: this.createRepository<CorrectiveAction>("correctiveActions", "corrective-action"),
    };
    this.audit = this.createRepository<AuditEvent>("auditEvents", "audit");
  }

  hydrate(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.persist();
        return;
      }
      const parsed: unknown = JSON.parse(stored);
      if (isStorageEnvelope(parsed)) {
        this.state = migrateState(parsed.state);
        this.persist();
        this.publish(false);
      }
    } catch {
      this.state = createDemoState();
      this.persist();
      this.publish(false);
    }
  }

  reset(): void {
    this.state = createDemoState();
    this.publish();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRevision = (): number => this.revision;

  private getCollection<T extends BaseEntity>(key: CollectionKey): T[] {
    return this.state[key] as unknown as T[];
  }

  private createRepository<T extends BaseEntity>(key: CollectionKey, prefix: string): EntityRepository<T> {
    return {
      list: async () => clone(this.getCollection<T>(key)),
      getById: async (id: string) => clone(this.getCollection<T>(key).find((record) => record.id === id) ?? null),
      create: async (input: CreateInput<T>) => {
        const timestamp = new Date().toISOString();
        const record = {
          ...input,
          id: createId(prefix),
          createdAt: timestamp,
          updatedAt: timestamp,
        } as T;
        this.getCollection<T>(key).push(record);
        this.publish();
        return clone(record);
      },
      update: async (id: string, input: UpdateInput<T>) => {
        const collection = this.getCollection<T>(key);
        const index = collection.findIndex((record) => record.id === id);
        if (index < 0) throw new Error(`No se encontró el registro ${id}.`);
        const updated = { ...collection[index], ...input, updatedAt: new Date().toISOString() } as T;
        collection[index] = updated;
        this.publish();
        return clone(updated);
      },
    };
  }

  private publish(persist = true): void {
    this.revision += 1;
    if (persist) this.persist();
    this.listeners.forEach((listener) => listener());
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      const envelope: StorageEnvelope = { version: 2, state: this.state };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // The in-memory provider remains functional when browser storage is unavailable.
    }
  }
}
