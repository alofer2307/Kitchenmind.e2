import type { KitchenMindDataProvider } from "@/repositories";
import type { AttendanceEvent, AuditEvent, Branch, CorrectiveAction, Employee, InternalClient, InventoryLot, Product, PurchaseOrder, QualitySubmission, ServiceEvent, ServiceType, Shift } from "@/types";
import { toDateKey } from "@/utils/date";

export interface DashboardSnapshot {
  branches: Branch[];
  employees: Employee[];
  attendanceEvents: AttendanceEvent[];
  serviceEvents: ServiceEvent[];
  serviceTypes: ServiceType[];
  shifts: Shift[];
  clients: InternalClient[];
  products: Product[];
  lots: InventoryLot[];
  purchaseOrders: PurchaseOrder[];
  auditEvents: AuditEvent[];
  qualitySubmissions: QualitySubmission[];
  correctiveActions: CorrectiveAction[];
  metrics: {
    activeBranches: number;
    activeEmployees: number;
    expectedToday: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    servicesToday: number;
    lowStockProducts: number;
    pendingPurchases: number;
  };
  breakdowns: {
    branches: Array<{ id: string; name: string; expected: number; present: number; services: number }>;
    shifts: Array<{ id: string; name: string; expected: number; present: number }>;
    clients: Array<{ id: string; name: string; employees: number; services: number }>;
    serviceTypes: Array<{ id: string; name: string; count: number }>;
  };
  alerts: {
    duplicates: number;
    manualEvents: number;
    incidents: number;
    pending: number;
  };
}

export async function getDashboardSnapshot(provider: KitchenMindDataProvider, organizationId: string): Promise<DashboardSnapshot> {
  const [branches, employees, attendanceEvents, serviceEvents, serviceTypes, shifts, clients, products, lots, purchaseOrders, auditEvents, qualitySubmissions, correctiveActions] = await Promise.all([
    provider.branches.list(),
    provider.employees.list(),
    provider.attendance.list(),
    provider.services.serviceEvents.list(),
    provider.services.serviceTypes.list(),
    provider.shifts.list(),
    provider.services.clients.list(),
    provider.inventory.products.list(),
    provider.inventory.lots.list(),
    provider.purchasing.orders.list(),
    provider.audit.list(),
    provider.quality.submissions.list(),
    provider.quality.correctiveActions.list(),
  ]);
  const today = toDateKey(new Date());
  const scopedBranches = branches.filter((branch) => branch.organizationId === organizationId);
  const scopedEmployees = employees.filter((employee) => employee.organizationId === organizationId);
  const todayAttendance = attendanceEvents.filter((event) => event.organizationId === organizationId && toDateKey(event.timestamp) === today);
  const presentIds = new Set(todayAttendance.filter((event) => event.eventType === "entry" || event.eventType === "late" || (event.eventType === "manual_adjustment" && (event.adjustedEventType === "entry" || event.adjustedEventType === "late"))).map((event) => event.employeeId));
  const todayServices = serviceEvents.filter((event) => event.organizationId === organizationId && toDateKey(event.timestamp) === today);
  const scopedProducts = products.filter((product) => product.organizationId === organizationId);
  const scopedLots = lots.filter((lot) => lot.organizationId === organizationId);
  const stockByProduct = new Map<string, number>();
  scopedLots.forEach((lot) => stockByProduct.set(lot.productId, (stockByProduct.get(lot.productId) ?? 0) + lot.quantity));

  const activeEmployees = scopedEmployees.filter((employee) => employee.status === "active");
  const scopedShifts = shifts.filter((shift) => shift.organizationId === organizationId && shift.status === "active");
  const scopedClients = clients.filter((client) => client.organizationId === organizationId && client.status === "active");
  const scopedServiceTypes = serviceTypes.filter((type) => type.organizationId === organizationId && type.status === "active");
  const scopedAuditEvents = auditEvents.filter((event) => event.organizationId === organizationId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const todayAuditEvents = scopedAuditEvents.filter((event) => toDateKey(event.timestamp) === today);
  const openCorrectiveActions = correctiveActions.filter((action) => action.organizationId === organizationId && action.status === "open");

  return {
    branches: scopedBranches,
    employees: scopedEmployees,
    attendanceEvents: todayAttendance,
    serviceEvents: todayServices,
    serviceTypes: scopedServiceTypes,
    shifts: scopedShifts,
    clients: scopedClients,
    products: scopedProducts,
    lots: scopedLots,
    purchaseOrders: purchaseOrders.filter((order) => order.organizationId === organizationId),
    auditEvents: scopedAuditEvents,
    qualitySubmissions: qualitySubmissions.filter((submission) => submission.organizationId === organizationId),
    correctiveActions: correctiveActions.filter((action) => action.organizationId === organizationId),
    metrics: {
      activeBranches: scopedBranches.filter((branch) => branch.status === "active").length,
      activeEmployees: activeEmployees.length,
      expectedToday: activeEmployees.length,
      presentToday: presentIds.size,
      lateToday: todayAttendance.filter((event) => event.eventType === "late").length,
      absentToday: Math.max(0, activeEmployees.length - presentIds.size),
      servicesToday: todayServices.length,
      lowStockProducts: scopedProducts.filter((product) => (stockByProduct.get(product.id) ?? 0) <= product.minimumStock).length,
      pendingPurchases: purchaseOrders.filter((order) => order.organizationId === organizationId && !["received", "cancelled"].includes(order.status)).length,
    },
    breakdowns: {
      branches: scopedBranches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        expected: activeEmployees.filter((employee) => employee.branchId === branch.id).length,
        present: activeEmployees.filter((employee) => employee.branchId === branch.id && presentIds.has(employee.id)).length,
        services: todayServices.filter((event) => event.branchId === branch.id).length,
      })),
      shifts: scopedShifts.map((shift) => ({
        id: shift.id,
        name: shift.name,
        expected: activeEmployees.filter((employee) => employee.shiftId === shift.id).length,
        present: activeEmployees.filter((employee) => employee.shiftId === shift.id && presentIds.has(employee.id)).length,
      })),
      clients: scopedClients.map((client) => ({
        id: client.id,
        name: client.name,
        employees: activeEmployees.filter((employee) => employee.clientId === client.id).length,
        services: todayServices.filter((event) => event.clientId === client.id).length,
      })),
      serviceTypes: scopedServiceTypes.map((serviceType) => ({
        id: serviceType.id,
        name: serviceType.name,
        count: todayServices.filter((event) => event.serviceTypeId === serviceType.id).length,
      })),
    },
    alerts: {
      duplicates: todayAuditEvents.filter((event) => event.action.endsWith(".duplicate")).length,
      manualEvents: todayAttendance.filter((event) => event.eventType === "manual_adjustment").length + todayServices.filter((event) => event.override).length,
      incidents: qualitySubmissions.filter((submission) => submission.organizationId === organizationId && submission.status === "incident" && toDateKey(submission.submittedAt) === today).length,
      pending: openCorrectiveActions.length + purchaseOrders.filter((order) => order.organizationId === organizationId && !["received", "cancelled"].includes(order.status)).length,
    },
  };
}
