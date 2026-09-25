import type { SqlCommand } from "./commercial.contracts";
import type { DashboardDataProvider, DashboardFilters, DashboardRepository } from "./dashboard.contracts";
import { dashboardAuthorizationStamp, normalizeDashboardLayout, normalizeDashboardPeriod, normalizeDashboardTimezone, periodStartForTimezone, resolveDefaultPreset, sortAttention } from "@/rules/dashboard.rules";
import type {
  DashboardAttentionItem,
  DashboardBranchSummary,
  DashboardCatalogSnapshot,
  DashboardPeriod,
  DashboardResolvedWidget,
  DashboardSnapshot,
  DashboardWidgetCatalogItem,
  DashboardWidgetSize,
  PlatformActor,
  TenantActor,
} from "@/types";

const DASHBOARD_PERMISSIONS = [
  ["dashboard.read", "Consultar el tablero operativo autorizado."],
  ["dashboard.configure_self", "Personalizar la vista propia del tablero."],
  ["dashboard.configure_organization", "Configurar el tablero predeterminado de la organización."],
  ["dashboard.export", "Exportar información autorizada del tablero."],
  ["dashboard.view_cross_branch", "Comparar sucursales dentro del alcance asignado."],
  ["dashboard.view_sensitive_costs", "Consultar indicadores de costos sensibles."],
  ["dashboard.view_employee_details", "Consultar indicadores detallados de personal."],
  ["dashboard.view_quality_details", "Consultar indicadores detallados de calidad."],
  ["dashboard.view_inventory_details", "Consultar indicadores detallados de inventario."],
  ["dashboard.view_purchase_details", "Consultar indicadores detallados de compras."],
  ["dashboard.view_service_billing", "Consultar indicadores facturables de servicios."],
  ["dashboard.view_sync_health", "Consultar el estado de sincronización de dispositivos."],
  ["dashboard.manage_presets", "Administrar presets autorizados de la organización."],
] as const;

const DASHBOARD_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: DASHBOARD_PERMISSIONS.map(([code]) => code),
  administrator: DASHBOARD_PERMISSIONS.map(([code]) => code),
  regional_supervisor: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_employee_details", "dashboard.view_quality_details", "dashboard.view_inventory_details", "dashboard.view_purchase_details", "dashboard.view_sync_health"],
  human_resources: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_employee_details"],
  branch_manager: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_employee_details", "dashboard.view_quality_details", "dashboard.view_inventory_details", "dashboard.view_purchase_details", "dashboard.view_sync_health"],
  quality_supervisor: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_quality_details"],
  warehouse: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_inventory_details"],
  purchasing: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_inventory_details", "dashboard.view_purchase_details"],
  production: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_inventory_details", "dashboard.view_sensitive_costs"],
  nutrition: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_quality_details"],
  operator: ["dashboard.read", "dashboard.configure_self"],
  auditor: ["dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_employee_details", "dashboard.view_quality_details", "dashboard.view_inventory_details", "dashboard.view_purchase_details", "dashboard.view_service_billing", "dashboard.view_sync_health"],
  viewer: ["dashboard.read", "dashboard.configure_self"],
};

const METRICS = [
  ["employees_active", "Personal activo", "Personas activas cargadas en D1.", "count", "tenant_employees", "COUNT de empleados activos dentro del alcance.", 300, "available", "zero"],
  ["shifts_active", "Turnos configurados", "Turnos activos guardados en D1.", "count", "tenant_shifts", "COUNT de turnos activos aplicables a la sucursal.", 300, "available", "zero"],
  ["service_types", "Servicios configurados", "Módulo diferido por decisión de producto en E.2.", "count", "tenant_service_types", "Sin lectura productiva mientras Comensales esté diferido.", 300, "unavailable", "unavailable"],
  ["quality_templates", "Controles configurados", "Versiones publicadas de plantillas de calidad guardadas en D1.", "count", "quality_template_versions", "COUNT de versiones publicadas dentro del alcance.", 300, "available", "zero"],
  ["products_active", "Productos activos", "Productos activos guardados en D1.", "count", "tenant_products", "COUNT de productos activos.", 300, "available", "zero"],
  ["warehouses_active", "Almacenes activos", "Almacenes activos guardados en D1.", "count", "tenant_warehouses", "COUNT de almacenes activos.", 300, "available", "zero"],
  ["devices_active", "Dispositivos vinculados", "Dispositivos activos guardados en D1.", "count", "tenant_devices", "COUNT de dispositivos activos.", 300, "available", "zero"],
  ["inventory_movements", "Movimientos de inventario", "Movimientos persistentes en el periodo.", "count", "tenant_inventory_movements", "COUNT de movimientos dentro del periodo y alcance.", 60, "available", "zero"],
  ["inventory_low_stock", "Productos bajo mínimo", "Productos cuyo saldo está debajo de un mínimo configurado.", "count", "tenant_products + tenant_inventory_movements", "Saldo persistente comparado con metadata.minimumStockMinor.", 60, "available", "unavailable"],
  ["pending_imports", "Importaciones pendientes", "Lotes de importación todavía no finalizados.", "count", "import_batches", "COUNT de lotes pendientes o en proceso.", 60, "available", "zero"],
  ["onboarding_progress", "Preparación", "Porcentaje persistente del onboarding.", "percentage", "onboarding_projects", "completion_percentage del proyecto activo.", 60, "available", "zero"],
  ["branch_count", "Sucursales autorizadas", "Sucursales activas dentro del alcance.", "count", "tenant_branches", "COUNT de sucursales autorizadas.", 300, "available", "zero"],
  ["attendance_today", "Asistencia de hoy", "Entradas y retardos productivos de la fecha operativa.", "count", "operational_attendance_events", "COUNT de entradas y retardos durables dentro del alcance y fecha operativa.", 60, "available", "zero"],
  ["services_today", "Servicios de hoy", "Comensales está diferido por decisión de producto en E.2.", "count", "operational_service_events", "No se expone lectura productiva de servicios en este release.", 60, "unavailable", "unavailable"],
  ["quality_alerts", "Alertas de calidad", "Acciones correctivas abiertas por desviaciones persistentes.", "count", "quality_corrective_actions", "COUNT de acciones abiertas o en seguimiento dentro del alcance.", 60, "available", "zero"],
  ["purchases_pending", "Compras pendientes", "Solicitudes y órdenes por atender.", "count", "operational_purchase_orders", "Fuente operativa aún no migrada a D1.", 60, "unavailable", "unavailable"],
  ["production_pending", "Producción pendiente", "Preparaciones y rendimientos del turno.", "count", "operational_production_runs", "Fuente operativa aún no migrada a D1.", 60, "unavailable", "unavailable"],
  ["sync_pending", "Sincronización pendiente", "Eventos offline todavía no confirmados por servidor.", "count", "operational_sync_items", "COUNT de eventos de sincronización pendientes o fallidos en lotes durables.", 60, "available", "zero"],
  ["waste_cost", "Costo de merma", "Costo persistente de mermas del periodo.", "money", "operational_waste_events", "Fuente operativa y costos unitarios aún no migrados a D1.", 300, "unavailable", "unavailable"],
] as const;

const WIDGETS = [
  ["employees_active", "Personal activo", "Equipo cargado en la sucursal.", "people", "employees_active", "PERSONNEL", "dashboard.view_employee_details", "available", null, true, false, "small", false],
  ["shifts_active", "Turnos configurados", "Turnos disponibles para la operación.", "people", "shifts_active", "PERSONNEL", "dashboard.view_employee_details", "available", null, true, false, "small", false],
  ["service_types", "Catálogo de servicios", "Comensales diferido por decisión de producto.", "services", "service_types", "SERVICES", null, "unavailable", "Diferido por decisión de producto en E.2.", true, false, "small", false],
  ["quality_templates", "Controles de calidad", "Bitácoras estructuradas disponibles.", "quality", "quality_templates", "QUALITY", "dashboard.view_quality_details", "available", null, true, false, "small", false],
  ["products_active", "Productos activos", "Catálogo de inventario habilitado.", "inventory", "products_active", "INVENTORY", "dashboard.view_inventory_details", "available", null, true, false, "small", false],
  ["warehouses_active", "Almacenes", "Almacenes habilitados en el alcance.", "inventory", "warehouses_active", "INVENTORY", "dashboard.view_inventory_details", "available", null, true, false, "small", false],
  ["devices_active", "Dispositivos", "Equipos vinculados a la operación.", "operations", "devices_active", "DEVICES", "dashboard.view_sync_health", "available", null, true, false, "small", false],
  ["inventory_movements", "Movimientos de inventario", "Movimientos persistentes del periodo seleccionado.", "inventory", "inventory_movements", "INVENTORY", "dashboard.view_inventory_details", "available", null, true, true, "medium", false],
  ["inventory_low_stock", "Inventario bajo", "Productos debajo del mínimo configurado.", "inventory", "inventory_low_stock", "INVENTORY", "dashboard.view_inventory_details", "available", "Requiere minimumStockMinor en el producto.", true, false, "medium", false],
  ["pending_imports", "Importaciones pendientes", "Carga inicial que todavía requiere atención.", "setup", "pending_imports", null, null, "available", null, false, false, "small", false],
  ["onboarding_progress", "Preparación de la organización", "Avance real del proyecto de onboarding.", "setup", "onboarding_progress", null, null, "available", null, false, false, "small", false],
  ["branch_overview", "Pulso por sucursal", "Resumen comparativo de sucursales autorizadas.", "direction", null, null, "dashboard.view_cross_branch", "available", null, false, false, "full", false],
  ["attendance_today", "Asistencia de hoy", "Entradas y retardos registrados en la fecha operativa.", "people", "attendance_today", "PERSONNEL", "dashboard.view_employee_details", "available", null, true, false, "medium", false],
  ["services_today", "Servicios de hoy", "Comensales diferido por decisión de producto.", "services", "services_today", "SERVICES", null, "unavailable", "Diferido por decisión de producto en E.2.", true, false, "medium", false],
  ["quality_alerts", "Alertas de calidad", "Desviaciones que requieren seguimiento verificable.", "quality", "quality_alerts", "QUALITY", "dashboard.view_quality_details", "available", null, true, true, "medium", false],
  ["purchases_pending", "Compras pendientes", "Solicitudes y órdenes por atender.", "purchasing", "purchases_pending", "PURCHASING", "dashboard.view_purchase_details", "unavailable", "Compras continúa en el proveedor operativo heredado.", true, true, "medium", false],
  ["production_pending", "Producción pendiente", "Preparaciones y rendimientos por completar.", "production", "production_pending", "PRODUCTION", null, "unavailable", "Producción aún no tiene eventos persistentes multi-tenant.", true, true, "medium", false],
  ["sync_pending", "Estado de sincronización", "Operaciones offline pendientes de confirmación.", "operations", "sync_pending", null, "dashboard.view_sync_health", "available", null, true, false, "medium", false],
  ["waste_cost", "Costo de merma", "Impacto económico de la merma registrada.", "costs", "waste_cost", "PRODUCTION", "dashboard.view_sensitive_costs", "unavailable", "Faltan eventos productivos y costos persistentes autorizados.", true, true, "medium", true],
] as const;

const PRESETS = [
  ["direction_general", "Dirección general", "Configuración, atención y actividad disponible para dirección.", "Dueño o administración", ["onboarding_progress", "employees_active", "quality_templates", "products_active", "inventory_movements", "quality_alerts"]],
  ["direction_multibranch", "Dirección multisucursal", "Comparación de unidades y señales prioritarias.", "Dirección multisucursal", ["branch_overview", "onboarding_progress", "employees_active", "inventory_movements", "quality_alerts"]],
  ["small_restaurant", "Restaurante pequeño", "Vista compacta para operación diaria de una unidad.", "Restaurante pequeño", ["employees_active", "products_active", "inventory_movements"]],
  ["human_resources", "Recursos Humanos", "Dotación, turnos y estado de asistencia.", "Recursos Humanos", ["employees_active", "shifts_active", "attendance_today", "onboarding_progress"]],
  ["branch_manager", "Gerencia de sucursal", "Estado operativo de una sucursal y sus pendientes.", "Gerencia", ["employees_active", "quality_templates", "products_active", "quality_alerts"]],
  ["quality", "Calidad", "Controles configurados, desviaciones y seguimiento.", "Calidad", ["quality_templates", "quality_alerts", "onboarding_progress"]],
  ["warehouse", "Almacén", "Existencias, movimientos y productos por atender.", "Almacén", ["warehouses_active", "products_active", "inventory_low_stock", "inventory_movements"]],
  ["purchasing", "Compras", "Necesidades de abastecimiento y órdenes pendientes.", "Compras", ["products_active", "inventory_low_stock", "purchases_pending", "inventory_movements"]],
  ["production", "Producción", "Preparación, consumos y costos autorizados.", "Producción", ["products_active", "inventory_movements", "production_pending", "waste_cost"]],
  ["nutrition", "Nutrición", "Servicios, controles y actividad alimentaria.", "Nutrición", ["quality_templates", "quality_alerts"]],
  ["operator", "Operación", "Acciones directas y estado del turno.", "Operador", ["onboarding_progress", "sync_pending"]],
  ["auditor", "Auditoría", "Resumen de alcance y actividad persistente sin acciones operativas.", "Auditor", ["branch_overview", "employees_active", "quality_templates", "inventory_movements"]],
] as const;

const ROLE_DEFAULTS = [
  ["owner", "direction_general", 10], ["administrator", "direction_general", 20], ["regional_supervisor", "direction_multibranch", 25],
  ["human_resources", "human_resources", 30], ["branch_manager", "branch_manager", 40], ["quality_supervisor", "quality", 50],
  ["warehouse", "warehouse", 60], ["purchasing", "purchasing", 70], ["production", "production", 80], ["nutrition", "nutrition", 85],
  ["operator", "operator", 90], ["auditor", "auditor", 95], ["viewer", "auditor", 100],
] as const;

const PROFILE_DEFAULTS = [
  ["industrial_canteen", "direction_general"], ["institutional_cafeteria", "direction_general"],
  ["restaurant", "small_restaurant"], ["small_restaurant", "small_restaurant"], ["cafe", "small_restaurant"], ["central_kitchen", "production"],
] as const;

interface MembershipContext {
  membershipId: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  organizationStatus: string;
  organizationTimezone: string;
  businessProfileCode: string;
  organizationVersion: number;
  organizationUpdatedAt: string;
  membershipVersion: number;
  displayName: string;
  roleCodes: string[];
  roleNames: string[];
  permissions: string[];
  scopes: Array<{ type: string; id: string | null; accessMode: string }>;
}

interface WidgetRow extends DashboardWidgetCatalogItem {
  position: number;
  size: DashboardWidgetSize;
  required: boolean;
}

function asCatalogWidget(widget: WidgetRow): DashboardWidgetCatalogItem {
  return {
    code: widget.code,
    name: widget.name,
    description: widget.description,
    category: widget.category,
    widgetType: widget.widgetType,
    supportedSizes: widget.supportedSizes,
    metricCode: widget.metricCode,
    sourceModuleCode: widget.sourceModuleCode,
    requiredFeatureCode: widget.requiredFeatureCode,
    requiredPermission: widget.requiredPermission,
    requiredScopeType: widget.requiredScopeType,
    dataSourceCode: widget.dataSourceCode,
    supportedFilters: widget.supportedFilters,
    refreshPolicy: widget.refreshPolicy,
    staleAfterSeconds: widget.staleAfterSeconds,
    emptyStateType: widget.emptyStateType,
    sensitivityLevel: widget.sensitivityLevel,
    displayOrder: widget.displayOrder,
    sourceStatus: widget.sourceStatus,
    availabilityReason: widget.availabilityReason,
    supportsBranch: widget.supportsBranch,
    supportsPeriod: widget.supportsPeriod,
    defaultSize: widget.defaultSize,
    sensitive: widget.sensitive,
    status: widget.status,
    version: widget.version,
  };
}

const nowIso = () => new Date().toISOString();
const bool = (value: unknown) => value === true || value === 1;
function operationalDateForTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function dashboardAudit(organizationId: string, actorType: string, actorId: string, action: string, entity: string, entityId: string | null, reason: string, after?: unknown): SqlCommand {
  return {
    sql: `INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)`,
    values: [crypto.randomUUID(), organizationId, actorType, actorId, action, entity, entityId, reason, after === undefined ? null : JSON.stringify(after), nowIso()],
  };
}

function platformAudit(actor: PlatformActor, action: string, entity: string, entityId: string | null, reason: string, after?: unknown): SqlCommand {
  return {
    sql: `INSERT INTO platform_audit_events (id, platform_user_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?)`,
    values: [crypto.randomUUID(), actor.id, action, entity, entityId, reason, after === undefined ? null : JSON.stringify(after), nowIso()],
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class D1DashboardRepository implements DashboardRepository {
  constructor(private readonly provider: DashboardDataProvider) {}

  async ensureCatalog(): Promise<void> {
    const commands: SqlCommand[] = [];
    for (const [code, description] of DASHBOARD_PERMISSIONS) {
      commands.push({ sql: "INSERT OR IGNORE INTO organization_permissions (id, code, description) VALUES (?, ?, ?)", values: [`org-permission-${code}`, code, description] });
    }
    for (const [roleCode, permissions] of Object.entries(DASHBOARD_ROLE_PERMISSIONS)) {
      for (const permissionCode of permissions) {
        commands.push({
          sql: `INSERT OR IGNORE INTO organization_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM organization_roles r JOIN organization_permissions p ON p.code = ? WHERE r.code = ? AND r.status = 'active'`,
          values: [permissionCode, roleCode],
        });
      }
    }
    for (const metric of METRICS) {
      commands.push({
        sql: `INSERT OR IGNORE INTO dashboard_metric_definitions (id, code, label, description, unit, data_source, computation, freshness_seconds, source_status, missing_behavior, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)`,
        values: [`dashboard-metric-${metric[0]}`, ...metric],
      });
    }
    for (const [widgetIndex, widget] of WIDGETS.entries()) {
      const widgetType = widget[0] === "branch_overview" ? "branch_card_grid" : widget[0] === "onboarding_progress" ? "progress" : "metric";
      const supportedFilters = [widget[9] ? "branch" : null, widget[10] ? "period" : null].filter(Boolean);
      commands.push({
        sql: `INSERT OR IGNORE INTO dashboard_widget_definitions (id, code, name, description, category, metric_code, source_module_code, required_permission, source_status, availability_reason, supports_branch, supports_period, default_size, sensitive, widget_type, supported_sizes_json, required_feature_code, required_scope_type, data_source_code, supported_filters_json, refresh_policy, stale_after_seconds, empty_state_type, sensitivity_level, display_order, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'cache_then_revalidate', 60, ?, ?, ?, 'active', 1)`,
        values: [
          `dashboard-widget-${widget[0]}`,
          ...widget.map((value) => typeof value === "boolean" ? (value ? 1 : 0) : value),
          widgetType,
          JSON.stringify(["small", "medium", "large", "full"]),
          widget[0] === "branch_overview" || widget[9] ? "branch" : "organization",
          widget[4] ?? "branch_summaries",
          JSON.stringify(supportedFilters),
          widget[7] === "available" ? "zero" : "unavailable",
          widget[12] ? "sensitive" : "standard",
          widgetIndex,
        ],
      });
    }
    for (const [code, name, description, audience, widgetCodes] of PRESETS) {
      const presetId = `dashboard-preset-${code}`;
      commands.push({ sql: `INSERT OR IGNORE INTO dashboard_presets (id, code, name, description, audience, status, version) VALUES (?, ?, ?, ?, ?, 'active', 1)`, values: [presetId, code, name, description, audience] });
      widgetCodes.forEach((widgetCode, index) => commands.push({
        sql: `INSERT OR IGNORE INTO dashboard_preset_widgets (preset_id, widget_id, display_order, size, required) VALUES (?, ?, ?, ?, ?)`,
        values: [presetId, `dashboard-widget-${widgetCode}`, index, widgetCode === "branch_overview" ? "full" : "medium", index < 2 ? 1 : 0],
      }));
    }
    for (const [roleCode, presetCode, priority] of ROLE_DEFAULTS) commands.push({ sql: `INSERT OR IGNORE INTO role_dashboard_defaults (role_code, preset_id, priority) VALUES (?, ?, ?)`, values: [roleCode, `dashboard-preset-${presetCode}`, priority] });
    for (const [profileCode, presetCode] of PROFILE_DEFAULTS) commands.push({ sql: `INSERT OR IGNORE INTO business_profile_dashboard_defaults (business_profile_code, preset_id) VALUES (?, ?)`, values: [profileCode, `dashboard-preset-${presetCode}`] });
    for (const code of ["attendance_today", "sync_pending"]) {
      commands.push({ sql: `UPDATE dashboard_metric_definitions SET source_status = 'available', missing_behavior = 'zero', updated_at = CASE WHEN source_status = 'available' AND missing_behavior = 'zero' THEN updated_at ELSE ? END, version = version + CASE WHEN source_status = 'available' AND missing_behavior = 'zero' THEN 0 ELSE 1 END WHERE code = ?`, values: [nowIso(), code] });
      commands.push({ sql: `UPDATE dashboard_widget_definitions SET source_status = 'available', availability_reason = NULL, updated_at = CASE WHEN source_status = 'available' AND availability_reason IS NULL THEN updated_at ELSE ? END, version = version + CASE WHEN source_status = 'available' AND availability_reason IS NULL THEN 0 ELSE 1 END WHERE code = ?`, values: [nowIso(), code] });
    }
    for (const code of ["service_types", "services_today"]) {
      commands.push({ sql: `UPDATE dashboard_metric_definitions SET source_status = 'unavailable', missing_behavior = 'unavailable', updated_at = CASE WHEN source_status = 'unavailable' AND missing_behavior = 'unavailable' THEN updated_at ELSE ? END, version = version + CASE WHEN source_status = 'unavailable' AND missing_behavior = 'unavailable' THEN 0 ELSE 1 END WHERE code = ?`, values: [nowIso(), code] });
      commands.push({ sql: `UPDATE dashboard_widget_definitions SET source_status = 'unavailable', availability_reason = 'Comensales diferido por decisión de producto en E.2.', updated_at = CASE WHEN source_status = 'unavailable' AND availability_reason = 'Comensales diferido por decisión de producto en E.2.' THEN updated_at ELSE ? END, version = version + CASE WHEN source_status = 'unavailable' AND availability_reason = 'Comensales diferido por decisión de producto en E.2.' THEN 0 ELSE 1 END WHERE code = ?`, values: [nowIso(), code] });
    }
    await this.provider.batch(commands);
  }

  private async membership(identity: TenantActor, organizationId?: string): Promise<MembershipContext> {
    const values = organizationId ? [identity.authUserId, identity.email.trim().toLowerCase(), organizationId] : [identity.authUserId, identity.email.trim().toLowerCase()];
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT m.id AS membershipId, m.organization_id AS organizationId, m.display_name AS displayName, m.version AS membershipVersion,
      o.code AS organizationCode, o.commercial_name AS organizationName, o.status AS organizationStatus, o.default_timezone AS organizationTimezone,
      o.business_profile_id AS businessProfileCode, o.version AS organizationVersion, o.updated_at AS organizationUpdatedAt,
      r.code AS roleCode, r.name AS roleName, p.code AS permissionCode
      FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
      LEFT JOIN membership_role_assignments mra ON mra.membership_id = m.id LEFT JOIN organization_roles r ON r.id = mra.role_id AND r.organization_id = m.organization_id AND r.status = 'active'
      LEFT JOIN organization_role_permissions rp ON rp.role_id = r.id LEFT JOIN organization_permissions p ON p.id = rp.permission_id
      WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' ${organizationId ? "AND m.organization_id = ?" : ""}
      ORDER BY m.joined_at, r.code, p.code LIMIT 1000`, values);
    if (!rows.length) throw new Error("No existe una membresía activa para esta cuenta.");
    const selectedId = organizationId ?? String(rows[0].organizationId);
    const selected = rows.filter((row) => row.organizationId === selectedId);
    if (!selected.length) throw new Error("No existe una membresía activa para esta organización.");
    const status = String(selected[0].organizationStatus);
    if (!(["active", "restricted"] as string[]).includes(status)) throw new Error("La organización todavía no está activa para operar.");
    const permissions = Array.from(new Set(selected.map((row) => row.permissionCode ? String(row.permissionCode) : "").filter(Boolean)));
    if (!permissions.includes("dashboard.read")) throw new Error("No tienes permiso para consultar el tablero.");
    const scopes = await this.provider.all<{ type: string; id: string | null; accessMode: string }>("SELECT scope_type AS type, scope_id AS id, access_mode AS accessMode FROM membership_scopes WHERE membership_id = ?", [String(selected[0].membershipId)]);
    if (!scopes.length) throw new Error("La membresía no tiene un alcance autorizado.");
    return {
      membershipId: String(selected[0].membershipId), organizationId: selectedId, organizationCode: String(selected[0].organizationCode),
      organizationName: String(selected[0].organizationName), organizationStatus: status, organizationTimezone: String(selected[0].organizationTimezone),
      businessProfileCode: String(selected[0].businessProfileCode ?? ""), organizationVersion: Number(selected[0].organizationVersion),
      organizationUpdatedAt: String(selected[0].organizationUpdatedAt), membershipVersion: Number(selected[0].membershipVersion), displayName: String(selected[0].displayName),
      roleCodes: Array.from(new Set(selected.map((row) => row.roleCode ? String(row.roleCode) : "").filter(Boolean))),
      roleNames: Array.from(new Set(selected.map((row) => row.roleName ? String(row.roleName) : "").filter(Boolean))), permissions, scopes,
    };
  }

  private async availableOrganizations(identity: TenantActor): Promise<Array<{ id: string; name: string; status: string }>> {
    return this.provider.all<{ id: string; name: string; status: string }>(`SELECT DISTINCT o.id, o.commercial_name AS name, o.status FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' AND o.status IN ('active', 'restricted') ORDER BY o.commercial_name LIMIT 100`, [identity.authUserId, identity.email.trim().toLowerCase()]);
  }

  private async authorizedBranches(member: MembershipContext): Promise<Array<{ id: string; code: string; name: string; timezone: string; status: string }>> {
    const organizationWide = member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && ["read", "write", "manage"].includes(scope.accessMode));
    const branchIds = member.scopes.filter((scope) => scope.type === "branch" && scope.id && ["read", "write", "manage"].includes(scope.accessMode)).map((scope) => scope.id as string);
    if (!organizationWide && !branchIds.length) throw new Error("Tu alcance no incluye una sucursal autorizada.");
    const clause = organizationWide ? "" : `AND id IN (${branchIds.map(() => "?").join(",")})`;
    const branches = await this.provider.all<{ id: string; code: string; name: string; timezone: string; status: string }>(`SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' ${clause} ORDER BY name LIMIT 100`, [member.organizationId, ...branchIds]);
    if (!branches.length) throw new Error("Tu alcance no incluye una sucursal activa.");
    return branches;
  }

  private async effectiveModules(organizationId: string): Promise<string[]> {
    const timestamp = nowIso();
    const entitlements = await this.provider.all<{ moduleCode: string }>(`SELECT module_code AS moduleCode FROM organization_entitlements WHERE organization_id = ? AND module_code IS NOT NULL AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?)`, [organizationId, timestamp, timestamp]);
    const overrides = await this.provider.all<{ moduleCode: string; enabled: unknown }>(`SELECT module_code AS moduleCode, enabled FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'module' AND module_code IS NOT NULL AND status = 'active' AND effective_from <= ? AND effective_until > ? ORDER BY created_at`, [organizationId, timestamp, timestamp]);
    const enabled = new Set(entitlements.map((item) => item.moduleCode));
    for (const override of overrides) {
      if (override.enabled) enabled.add(override.moduleCode);
      else enabled.delete(override.moduleCode);
    }
    return Array.from(enabled).sort();
  }

  private async effectiveFeatures(organizationId: string): Promise<string[]> {
    const timestamp = nowIso();
    const entitlements = await this.provider.all<{ featureCode: string }>(`SELECT feature_code AS featureCode FROM organization_entitlements WHERE organization_id = ? AND feature_code IS NOT NULL AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?)`, [organizationId, timestamp, timestamp]);
    const overrides = await this.provider.all<{ featureCode: string; enabled: unknown }>(`SELECT feature_code AS featureCode, enabled FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'feature' AND feature_code IS NOT NULL AND status = 'active' AND effective_from <= ? AND effective_until > ? ORDER BY created_at`, [organizationId, timestamp, timestamp]);
    const enabled = new Set(entitlements.map((item) => item.featureCode));
    for (const override of overrides) {
      if (override.enabled) enabled.add(override.featureCode);
      else enabled.delete(override.featureCode);
    }
    return Array.from(enabled).sort();
  }

  private async catalogDefaultPreset(roleCodes: string[], businessProfileCode: string, branchCount: number): Promise<{ presetCode: string; reason: string }> {
    const [roleDefaults, businessProfileDefaults] = await Promise.all([
      this.provider.all<{ roleCode: string; presetCode: string; priority: number }>(`SELECT d.role_code AS roleCode, p.code AS presetCode, d.priority FROM role_dashboard_defaults d JOIN dashboard_presets p ON p.id = d.preset_id WHERE p.status = 'active' ORDER BY d.priority`),
      this.provider.all<{ businessProfileCode: string; presetCode: string }>(`SELECT d.business_profile_code AS businessProfileCode, p.code AS presetCode FROM business_profile_dashboard_defaults d JOIN dashboard_presets p ON p.id = d.preset_id WHERE p.status = 'active' ORDER BY d.business_profile_code`),
    ]);
    return resolveDefaultPreset(roleCodes, businessProfileCode, branchCount, roleDefaults, businessProfileDefaults);
  }

  private async resolvedPreset(member: MembershipContext, branchCount: number): Promise<{ code: string; name: string; description: string; audience: string; version: number; reason: string }> {
    const override = await this.provider.first<{ targetCode: string }>(`SELECT target_code AS targetCode FROM organization_dashboard_overrides WHERE organization_id = ? AND target_type = 'preset' AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?) ORDER BY created_at DESC LIMIT 1`, [member.organizationId, nowIso(), nowIso()]);
    const fallback = await this.catalogDefaultPreset(member.roleCodes, member.businessProfileCode, branchCount);
    const code = override?.targetCode ?? fallback.presetCode;
    const preset = await this.provider.first<{ code: string; name: string; description: string; audience: string; version: number }>(`SELECT code, name, description, audience, version FROM dashboard_presets WHERE code = ? AND status = 'active'`, [code])
      ?? await this.provider.first<{ code: string; name: string; description: string; audience: string; version: number }>(`SELECT code, name, description, audience, version FROM dashboard_presets WHERE code = 'operator' AND status = 'active'`);
    if (!preset) throw new Error("No existe un preset de tablero activo.");
    return { ...preset, reason: override ? "Vista predeterminada configurada para la organización." : fallback.reason };
  }

  private async widgetsFor(member: MembershipContext, presetCode: string, moduleCodes: string[], featureCodes: string[]): Promise<WidgetRow[]> {
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT w.code, w.name, w.description, w.category, w.widget_type AS widgetType, w.supported_sizes_json AS supportedSizesJson,
      w.metric_code AS metricCode, w.source_module_code AS sourceModuleCode, w.required_feature_code AS requiredFeatureCode, w.required_permission AS requiredPermission,
      w.required_scope_type AS requiredScopeType, w.data_source_code AS dataSourceCode, w.supported_filters_json AS supportedFiltersJson, w.refresh_policy AS refreshPolicy,
      w.stale_after_seconds AS staleAfterSeconds, w.empty_state_type AS emptyStateType, w.sensitivity_level AS sensitivityLevel, w.display_order AS displayOrder,
      w.source_status AS sourceStatus, w.availability_reason AS availabilityReason, w.supports_branch AS supportsBranch,
      w.supports_period AS supportsPeriod, w.default_size AS defaultSize, w.sensitive, w.status, w.version, pw.display_order AS position, pw.size, pw.required
      FROM dashboard_presets p JOIN dashboard_preset_widgets pw ON pw.preset_id = p.id JOIN dashboard_widget_definitions w ON w.id = pw.widget_id
      WHERE p.code = ? AND p.status = 'active' AND w.status = 'active' ORDER BY pw.display_order LIMIT 50`, [presetCode]);
    const overrides = await this.provider.all<Record<string, unknown>>(`SELECT target_code AS code, enabled, size, display_order AS displayOrder FROM organization_dashboard_overrides WHERE organization_id = ? AND target_type = 'widget' AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?) ORDER BY created_at`, [member.organizationId, nowIso(), nowIso()]);
    const byCode = new Map(rows.map((row) => [String(row.code), this.widgetRow(row)]));
    for (const row of overrides) {
      const code = String(row.code);
      if (!bool(row.enabled)) { byCode.delete(code); continue; }
      let widget = byCode.get(code);
      if (!widget) {
        const catalogRow = await this.provider.first<Record<string, unknown>>(`SELECT code, name, description, category, widget_type AS widgetType, supported_sizes_json AS supportedSizesJson, metric_code AS metricCode, source_module_code AS sourceModuleCode, required_feature_code AS requiredFeatureCode, required_permission AS requiredPermission, required_scope_type AS requiredScopeType, data_source_code AS dataSourceCode, supported_filters_json AS supportedFiltersJson, refresh_policy AS refreshPolicy, stale_after_seconds AS staleAfterSeconds, empty_state_type AS emptyStateType, sensitivity_level AS sensitivityLevel, display_order AS displayOrder, source_status AS sourceStatus, availability_reason AS availabilityReason, supports_branch AS supportsBranch, supports_period AS supportsPeriod, default_size AS defaultSize, sensitive, status, version FROM dashboard_widget_definitions WHERE code = ? AND status = 'active'`, [code]);
        if (catalogRow) widget = this.widgetRow({ ...catalogRow, position: 999, size: catalogRow.defaultSize, required: 0 });
      }
      if (widget) byCode.set(code, { ...widget, size: (row.size ? String(row.size) : widget.size) as DashboardWidgetSize, position: row.displayOrder === null || row.displayOrder === undefined ? widget.position : Number(row.displayOrder) });
    }
    const allowed = Array.from(byCode.values()).filter((widget) => {
      if (widget.sourceModuleCode && !moduleCodes.includes(widget.sourceModuleCode)) return false;
      if (widget.requiredFeatureCode && !featureCodes.includes(widget.requiredFeatureCode)) return false;
      if (widget.requiredPermission && !member.permissions.includes(widget.requiredPermission)) return false;
      if (widget.sensitive && !member.permissions.includes("dashboard.view_sensitive_costs")) return false;
      const hasOrganizationScope = member.scopes.some((scope) => scope.type === "organization" && ["read", "write", "manage"].includes(scope.accessMode));
      const hasBranchScope = hasOrganizationScope || member.scopes.some((scope) => scope.type === "branch" && scope.id && ["read", "write", "manage"].includes(scope.accessMode));
      if (widget.requiredScopeType === "organization" ? !hasOrganizationScope : !hasBranchScope) return false;
      return true;
    });
    return allowed.sort((a, b) => a.position - b.position).slice(0, 24);
  }

  private widgetRow(row: Record<string, unknown>): WidgetRow {
    return {
      code: String(row.code), name: String(row.name), description: String(row.description), category: String(row.category),
      widgetType: String(row.widgetType ?? "metric"), supportedSizes: parseJson<DashboardWidgetSize[]>(String(row.supportedSizesJson ?? ""), ["small", "medium", "large", "full"]),
      metricCode: row.metricCode ? String(row.metricCode) : null, sourceModuleCode: row.sourceModuleCode ? String(row.sourceModuleCode) : null,
      requiredFeatureCode: row.requiredFeatureCode ? String(row.requiredFeatureCode) : null,
      requiredPermission: row.requiredPermission ? String(row.requiredPermission) : null, sourceStatus: String(row.sourceStatus) as WidgetRow["sourceStatus"],
      requiredScopeType: String(row.requiredScopeType ?? "branch"), dataSourceCode: String(row.dataSourceCode ?? row.metricCode ?? "dashboard_metric"),
      supportedFilters: parseJson<string[]>(String(row.supportedFiltersJson ?? ""), []), refreshPolicy: String(row.refreshPolicy ?? "cache_then_revalidate"),
      staleAfterSeconds: Number(row.staleAfterSeconds ?? 60), emptyStateType: String(row.emptyStateType ?? "zero"), sensitivityLevel: String(row.sensitivityLevel ?? "standard"),
      displayOrder: Number(row.displayOrder ?? row.position ?? 0),
      availabilityReason: row.availabilityReason ? String(row.availabilityReason) : null, supportsBranch: bool(row.supportsBranch), supportsPeriod: bool(row.supportsPeriod),
      defaultSize: String(row.defaultSize) as DashboardWidgetSize, sensitive: bool(row.sensitive), status: String(row.status) as "active" | "inactive", version: Number(row.version),
      position: Number(row.position ?? 0), size: String(row.size ?? row.defaultSize ?? "medium") as DashboardWidgetSize, required: bool(row.required),
    };
  }

  private async currentPreference(member: MembershipContext): Promise<{ exists: boolean; version: number; presetCode: string; layout: Array<{ code: string; visible: boolean; size: DashboardWidgetSize; position: number }>; defaultFilters: { period: DashboardPeriod; branchId: string | null }; updatedAt: string }> {
    const row = await this.provider.first<{ presetCode: string; layoutJson: string; filterJson: string; version: number; updatedAt: string }>(`SELECT preset_code AS presetCode, layout_json AS layoutJson, filter_json AS filterJson, version, updated_at AS updatedAt FROM user_dashboard_preferences WHERE organization_id = ? AND membership_id = ? AND dashboard_code = 'operations'`, [member.organizationId, member.membershipId]);
    if (!row) return { exists: false, version: 0, presetCode: "", layout: [], defaultFilters: { period: "today", branchId: null }, updatedAt: "" };
    const storedFilters = parseJson<{ period?: unknown; branchId?: unknown }>(row.filterJson, {});
    const defaultFilters = {
      period: normalizeDashboardPeriod(typeof storedFilters.period === "string" ? storedFilters.period : null),
      branchId: typeof storedFilters.branchId === "string" ? storedFilters.branchId : null,
    };
    return { exists: true, version: row.version, presetCode: row.presetCode, layout: parseJson(row.layoutJson, []), defaultFilters, updatedAt: row.updatedAt };
  }

  private applyPreference(widgets: WidgetRow[], preference: Awaited<ReturnType<D1DashboardRepository["currentPreference"]>>): WidgetRow[] {
    if (!preference.exists || !preference.layout.length) return widgets;
    const constraints = Object.fromEntries(widgets.map((widget) => [widget.code, { supportedSizes: widget.supportedSizes, defaultSize: widget.defaultSize }]));
    const normalized = normalizeDashboardLayout(preference.layout, widgets.map((widget) => widget.code), constraints);
    const settings = new Map(normalized.map((item) => [item.code, item]));
    return widgets
      .filter((widget) => settings.get(widget.code)?.visible !== false || widget.required)
      .map((widget) => {
        const setting = settings.get(widget.code);
        return setting ? { ...widget, size: setting.size, position: setting.position } : widget;
      })
      .sort((a, b) => a.position - b.position);
  }

  private async metricValues(organizationId: string, branchId: string | null, authorizedBranchIds: string[], periodStart: string, operationalDate: string): Promise<Record<string, number | null>> {
    const scopedBranchIds = branchId ? [branchId] : authorizedBranchIds;
    if (!scopedBranchIds.length) throw new Error("El alcance no contiene sucursales autorizadas.");
    const scope = (alias: string, includeOrganizationCatalog: boolean) => {
      const branchPlaceholders = scopedBranchIds.map(() => "?").join(",");
      return {
        sql: `${alias}.organization_id = ? AND ${includeOrganizationCatalog ? `(${alias}.branch_id IS NULL OR ${alias}.branch_id IN (${branchPlaceholders}))` : `${alias}.branch_id IN (${branchPlaceholders})`}`,
        values: [organizationId, ...scopedBranchIds] as unknown[],
      };
    };
    const employees = scope("e", false);
    const shifts = scope("s", true);
    const qualityTemplates = scope("qt", true);
    const products = scope("p", true);
    const warehouses = scope("w", false);
    const devices = scope("d", true);
    const attendance = scope("oa", false);
    const qualityActions = scope("qa", false);
    const movements = scope("m", false);
    const sync = scope("sb", false);
    const values: unknown[] = [
      ...employees.values,
      ...shifts.values,
      ...qualityTemplates.values,
      ...products.values,
      ...warehouses.values,
      ...devices.values,
      ...attendance.values, operationalDate,
      ...qualityActions.values,
      ...movements.values, periodStart,
      organizationId,
      organizationId,
      ...sync.values,
    ];
    const row = await this.provider.first<Record<string, number | null>>(`SELECT
      (SELECT COUNT(*) FROM tenant_employees e WHERE ${employees.sql} AND e.status = 'active') AS employeesActive,
      (SELECT COUNT(*) FROM tenant_shifts s WHERE ${shifts.sql} AND s.status = 'active') AS shiftsActive,
      (SELECT COUNT(DISTINCT qv.root_template_id) FROM quality_template_versions qv JOIN tenant_quality_templates qt ON qt.id = qv.root_template_id AND qt.organization_id = qv.organization_id WHERE ${qualityTemplates.sql} AND qv.status = 'published' AND qt.status = 'active') AS qualityTemplates,
      (SELECT COUNT(*) FROM tenant_products p WHERE ${products.sql} AND p.status = 'active') AS productsActive,
      (SELECT COUNT(*) FROM tenant_warehouses w WHERE ${warehouses.sql} AND w.status = 'active') AS warehousesActive,
      (SELECT COUNT(*) FROM tenant_devices d WHERE ${devices.sql} AND d.status = 'active') AS devicesActive,
      (SELECT COUNT(*) FROM operational_attendance_events oa WHERE ${attendance.sql} AND oa.operational_date = ? AND oa.event_type IN ('entry', 'late')) AS attendanceToday,
      (SELECT COUNT(*) FROM quality_corrective_actions qa WHERE ${qualityActions.sql} AND qa.status IN ('open', 'assigned', 'in_progress', 'resolved')) AS qualityAlerts,
      (SELECT COUNT(*) FROM tenant_inventory_movements m WHERE ${movements.sql} AND m.created_at >= ?) AS inventoryMovements,
      (SELECT COUNT(*) FROM import_batches WHERE organization_id = ? AND status IN ('pending', 'validating', 'processing')) AS pendingImports,
      (SELECT completion_percentage FROM onboarding_projects WHERE organization_id = ? LIMIT 1) AS onboardingProgress,
      (SELECT COUNT(*) FROM operational_sync_items si JOIN operational_sync_batches sb ON sb.id = si.batch_id WHERE ${sync.sql} AND si.status IN ('pending', 'failed')) AS syncPending`, values);
    return {
      employees_active: row?.employeesActive ?? 0, shifts_active: row?.shiftsActive ?? 0, service_types: null,
      quality_templates: row?.qualityTemplates ?? 0, products_active: row?.productsActive ?? 0, warehouses_active: row?.warehousesActive ?? 0,
      devices_active: row?.devicesActive ?? 0, attendance_today: row?.attendanceToday ?? 0, services_today: null, quality_alerts: row?.qualityAlerts ?? 0, inventory_movements: row?.inventoryMovements ?? 0, pending_imports: row?.pendingImports ?? 0,
      onboarding_progress: row?.onboardingProgress ?? 0, sync_pending: row?.syncPending ?? 0,
    };
  }

  private async lowStock(organizationId: string, branchId: string | null, authorizedBranchIds: string[]): Promise<{ count: number | null; configured: number; items: Array<{ id: string; name: string; branchId: string | null; stock: number; minimum: number }> }> {
    const scopedBranchIds = branchId ? [branchId] : authorizedBranchIds;
    if (!scopedBranchIds.length) throw new Error("El alcance no contiene sucursales autorizadas.");
    const placeholders = scopedBranchIds.map(() => "?").join(",");
    const rows = await this.provider.all<{ id: string; name: string; branchId: string | null; metadataJson: string; stock: number | null }>(`SELECT p.id, p.name, p.branch_id AS branchId, p.metadata_json AS metadataJson, COALESCE(SUM(m.quantity_minor), 0) AS stock FROM tenant_products p LEFT JOIN tenant_inventory_movements m ON m.product_id = p.id AND m.organization_id = p.organization_id AND m.branch_id IN (${placeholders}) WHERE p.organization_id = ? AND p.status = 'active' AND (p.branch_id IS NULL OR p.branch_id IN (${placeholders})) GROUP BY p.id, p.name, p.branch_id, p.metadata_json LIMIT 500`, [...scopedBranchIds, organizationId, ...scopedBranchIds]);
    const configured = rows.flatMap((row) => {
      const metadata = parseJson<Record<string, unknown>>(row.metadataJson, {});
      const minimum = metadata.minimumStockMinor;
      if (!Number.isInteger(minimum) || Number(minimum) < 0) return [];
      return [{ id: row.id, name: row.name, branchId: row.branchId, stock: Number(row.stock ?? 0), minimum: Number(minimum) }];
    });
    return { count: configured.length ? configured.filter((item) => item.stock < item.minimum).length : null, configured: configured.length, items: configured.filter((item) => item.stock < item.minimum) };
  }

  private async branchSummaries(organizationId: string, branches: Array<{ id: string; code: string; name: string; timezone: string; status: string }>): Promise<DashboardBranchSummary[]> {
    if (!branches.length) return [];
    const placeholders = branches.map(() => "?").join(",");
    return this.provider.all<DashboardBranchSummary>(`SELECT b.id, b.code, b.name, b.timezone,
      (SELECT COUNT(*) FROM tenant_employees e WHERE e.organization_id = b.organization_id AND e.branch_id = b.id AND e.status = 'active') AS employees,
      ((SELECT COUNT(*) FROM tenant_shifts s WHERE s.organization_id = b.organization_id AND (s.branch_id IS NULL OR s.branch_id = b.id) AND s.status = 'active') +
       (SELECT COUNT(*) FROM tenant_service_types s WHERE s.organization_id = b.organization_id AND (s.branch_id IS NULL OR s.branch_id = b.id) AND s.status = 'active') +
       (SELECT COUNT(DISTINCT qv.root_template_id) FROM quality_template_versions qv JOIN tenant_quality_templates qt ON qt.id = qv.root_template_id AND qt.organization_id = qv.organization_id WHERE qv.organization_id = b.organization_id AND (qt.branch_id IS NULL OR qt.branch_id = b.id) AND qv.status = 'published' AND qt.status = 'active')) AS configuredSources,
      (CASE WHEN (SELECT COUNT(*) FROM tenant_employees e WHERE e.organization_id = b.organization_id AND e.branch_id = b.id AND e.status = 'active') = 0 THEN 1 ELSE 0 END +
       CASE WHEN (SELECT COUNT(*) FROM tenant_shifts s WHERE s.organization_id = b.organization_id AND (s.branch_id IS NULL OR s.branch_id = b.id) AND s.status = 'active') = 0 THEN 1 ELSE 0 END) AS pendingSetup,
      (SELECT COUNT(*) FROM tenant_inventory_movements m WHERE m.organization_id = b.organization_id AND m.branch_id = b.id) AS inventoryMovements,
      (SELECT MAX(m.created_at) FROM tenant_inventory_movements m WHERE m.organization_id = b.organization_id AND m.branch_id = b.id) AS lastActivityAt
      FROM tenant_branches b WHERE b.organization_id = ? AND b.id IN (${placeholders}) AND b.status = 'active' ORDER BY b.name`, [organizationId, ...branches.map((branch) => branch.id)]);
  }

  private resolvedWidget(widget: WidgetRow, values: Record<string, number | null>, generatedAt: string, branchSummaries: DashboardBranchSummary[]): DashboardResolvedWidget {
    if (widget.sourceStatus !== "available") return { ...widget, value: null, valueLabel: "No disponible", detail: widget.availabilityReason ?? "Sin fuente productiva disponible.", valueStatus: "unavailable", href: null, updatedAt: null };
    if (widget.code === "branch_overview") return { ...widget, value: branchSummaries.length, valueLabel: `${branchSummaries.length}`, detail: `${branchSummaries.length} sucursal${branchSummaries.length === 1 ? "" : "es"} dentro del alcance.`, valueStatus: branchSummaries.length ? "ready" : "empty", href: "/app/sucursales", updatedAt: generatedAt };
    const value = widget.metricCode ? values[widget.metricCode] : null;
    if (value === null || value === undefined) return { ...widget, value: null, valueLabel: "Sin umbral", detail: widget.availabilityReason ?? "La métrica necesita configuración adicional.", valueStatus: "unavailable", href: null, updatedAt: generatedAt };
    const suffix = widget.metricCode === "onboarding_progress" ? "%" : "";
    const hrefByCode: Record<string, string> = { onboarding_progress: "/app/onboarding", pending_imports: "/app/onboarding", employees_active: "/app/personal", shifts_active: "/app/personal", attendance_today: "/app/personal/asistencia", service_types: "/app", services_today: "/app", sync_pending: "/app/dispositivos", devices_active: "/app/dispositivos", quality_templates: "/app/calidad", quality_alerts: "/app/calidad", products_active: "/app/onboarding/inventory", warehouses_active: "/app/onboarding/inventory", inventory_movements: "/app/onboarding/inventory", inventory_low_stock: "/app/sucursales" };
    return { ...widget, value, valueLabel: `${Number(value).toLocaleString("es-MX")}${suffix}`, detail: widget.description, valueStatus: Number(value) === 0 ? "empty" : "ready", href: hrefByCode[widget.code] ?? null, updatedAt: generatedAt };
  }

  private attentionFor(member: MembershipContext, moduleCodes: string[], values: Record<string, number | null>, lowStock: Awaited<ReturnType<D1DashboardRepository["lowStock"]>>, branchId: string | null): DashboardAttentionItem[] {
    const query = `organizationId=${encodeURIComponent(member.organizationId)}${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`;
    const items: DashboardAttentionItem[] = [];
    const hasOrganizationScope = member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && ["read", "write", "manage"].includes(scope.accessMode));
    if (hasOrganizationScope && (values.onboarding_progress ?? 0) < 100) items.push({ id: "onboarding", severity: "warning", title: "Completar preparación", detail: `El onboarding está en ${values.onboarding_progress ?? 0}%.`, reason: "La organización aún conserva tareas de preparación pendientes.", href: `/app/onboarding?${query}`, branchId, moduleCode: null });
    if (hasOrganizationScope && (values.pending_imports ?? 0) > 0) items.push({ id: "pending-imports", severity: "warning", title: "Revisar importaciones", detail: `${values.pending_imports} lote(s) aún no finalizado(s).`, reason: "Los registros pendientes todavía no forman parte de la operación confirmada.", href: `/app/onboarding?${query}`, branchId, moduleCode: null });
    if (moduleCodes.includes("PERSONNEL") && member.permissions.includes("dashboard.view_employee_details") && (values.employees_active ?? 0) === 0) items.push({ id: "employees-empty", severity: "warning", title: "Cargar personal", detail: "No hay empleados activos en este alcance.", reason: "El módulo Personal está contratado, pero no tiene una plantilla activa.", href: `/app/onboarding/personnel?${query}`, branchId, moduleCode: "PERSONNEL" });
    if (moduleCodes.includes("QUALITY") && member.permissions.includes("dashboard.view_quality_details") && (values.quality_templates ?? 0) === 0) items.push({ id: "quality-empty", severity: "warning", title: "Definir controles de calidad", detail: "No hay plantillas publicadas en este alcance.", reason: "Calidad está contratado y necesita al menos una plantilla versionada publicada.", href: `/app/calidad?${query}`, branchId, moduleCode: "QUALITY" });
    if (moduleCodes.includes("QUALITY") && member.permissions.includes("dashboard.view_quality_details") && (values.quality_alerts ?? 0) > 0) items.push({ id: "quality-alerts", severity: "critical", title: "Atender desviaciones de calidad", detail: `${values.quality_alerts} acción(es) correctiva(s) siguen abiertas.`, reason: "Hay desviaciones persistentes que requieren responsable, seguimiento y resolución.", href: `/app/calidad?${query}`, branchId, moduleCode: "QUALITY" });
    if (moduleCodes.includes("INVENTORY") && member.permissions.includes("dashboard.view_inventory_details") && (values.products_active ?? 0) === 0) items.push({ id: "inventory-empty", severity: "warning", title: "Preparar inventario", detail: "No hay productos activos en este alcance.", reason: "Inventario está contratado y necesita catálogo antes de registrar existencias.", href: `/app/onboarding/inventory?${query}`, branchId, moduleCode: "INVENTORY" });
    if (member.permissions.includes("dashboard.view_inventory_details")) for (const item of lowStock.items.slice(0, 10)) {
      const detailBranchId = item.branchId ?? branchId;
      items.push({
        id: `low-stock-${item.id}`,
        severity: item.stock <= 0 ? "critical" : "warning",
        title: `${item.name} bajo mínimo`,
        detail: `Saldo ${item.stock.toLocaleString("es-MX")} · mínimo ${item.minimum.toLocaleString("es-MX")}.`,
        reason: "El saldo persistente está debajo del umbral configurado para el producto.",
        href: detailBranchId ? `/app/sucursales/${encodeURIComponent(detailBranchId)}?${query}` : `/app/sucursales?${query}`,
        branchId: detailBranchId,
        moduleCode: "INVENTORY",
      });
    }
    return sortAttention(items).slice(0, 20);
  }

  async customerSnapshot(identity: TenantActor, filters: DashboardFilters): Promise<DashboardSnapshot> {
    await this.ensureCatalog();
    const member = await this.membership(identity, filters.organizationId);
    const [availableOrganizations, branches, moduleCodes, featureCodes] = await Promise.all([this.availableOrganizations(identity), this.authorizedBranches(member), this.effectiveModules(member.organizationId), this.effectiveFeatures(member.organizationId)]);
    const crossBranch = member.permissions.includes("dashboard.view_cross_branch") && branches.length > 1;
    const preference = await this.currentPreference(member);
    const fallbackBranchId = crossBranch ? null : branches[0].id;
    const storedBranchId = preference.defaultFilters.branchId;
    const authorizedStoredBranchId = storedBranchId && branches.some((branch) => branch.id === storedBranchId) ? storedBranchId : fallbackBranchId;
    const defaultFilters = { period: preference.defaultFilters.period, branchId: authorizedStoredBranchId };
    const explicitBranchFilter = filters.branchId !== undefined;
    let branchId = explicitBranchFilter ? filters.branchId ?? null : preference.exists ? defaultFilters.branchId : fallbackBranchId;
    if (branchId === "all") branchId = null;
    if (branchId && !branches.some((branch) => branch.id === branchId)) {
      if (explicitBranchFilter) {
        await this.provider.batch([dashboardAudit(member.organizationId, "customer_identity", identity.authUserId, "dashboard.access.denied", "tenant_branch", branchId, "La sucursal solicitada está fuera del alcance autorizado.")]);
        throw new Error("La sucursal solicitada no pertenece a tu alcance autorizado.");
      }
      branchId = fallbackBranchId;
    }
    if (!crossBranch && branchId === null) branchId = branches[0].id;
    const period = filters.period ?? (preference.exists ? defaultFilters.period : "today");
    const selectedBranch = branchId ? branches.find((branch) => branch.id === branchId) : null;
    const timezone = normalizeDashboardTimezone(selectedBranch?.timezone, member.organizationTimezone);
    let preset = await this.resolvedPreset(member, branches.length);
    if (preference.exists && preference.presetCode && preference.presetCode !== preset.code) {
      const personalPreset = await this.provider.first<{ code: string; name: string; description: string; audience: string; version: number }>(`SELECT code, name, description, audience, version FROM dashboard_presets WHERE code = ? AND status = 'active'`, [preference.presetCode]);
      if (personalPreset) preset = { ...personalPreset, reason: "Vista personal guardada sobre la configuración autorizada." };
    }
    const availablePresets = await this.provider.all<{ code: string; name: string; description: string; audience: string; version: number }>(`SELECT code, name, description, audience, version FROM dashboard_presets WHERE status = 'active' ORDER BY name LIMIT 30`);
    let widgetRows = await this.widgetsFor(member, preset.code, moduleCodes, featureCodes);
    widgetRows = this.applyPreference(widgetRows, preference);
    const overrideStamp = await this.provider.first<{ stamp: string | null }>(`SELECT MAX(updated_at || ':' || version) AS stamp FROM organization_dashboard_overrides WHERE organization_id = ?`, [member.organizationId]);
    const catalogStamp = await this.provider.first<{ stamp: string | null }>(`SELECT MAX(updated_at || ':' || version) AS stamp FROM dashboard_widget_definitions`);
    const authorizationStamp = dashboardAuthorizationStamp(member.scopes, branches);
    const configVersion = [member.organizationVersion, member.membershipVersion, member.roleCodes.join(","), member.permissions.join(","), authorizationStamp, moduleCodes.join(","), featureCodes.join(","), preset.code, preset.version, preference.version, preference.updatedAt, overrideStamp?.stamp ?? "", catalogStamp?.stamp ?? ""].join("|");
    const cacheKey = await sha256([member.organizationId, member.membershipId, branchId ?? "all", period, configVersion].join("|"));
    const cached = await this.provider.first<{ payloadJson: string }>(`SELECT payload_json AS payloadJson FROM dashboard_cache_entries WHERE cache_key = ? AND organization_id = ? AND membership_id = ? AND expires_at > ?`, [cacheKey, member.organizationId, member.membershipId, nowIso()]);
    if (cached) {
      const snapshot = parseJson<DashboardSnapshot | null>(cached.payloadJson, null);
      if (snapshot?.organization.id === member.organizationId && snapshot.membership.id === member.membershipId) {
        return { ...snapshot, availableOrganizations, branches, membership: { id: member.membershipId, displayName: member.displayName, roleCodes: member.roleCodes, roleNames: member.roleNames, permissions: member.permissions }, capabilities: { configureSelf: member.permissions.includes("dashboard.configure_self"), configureOrganization: member.permissions.includes("dashboard.configure_organization"), export: member.permissions.includes("dashboard.export"), crossBranch, sensitiveCosts: member.permissions.includes("dashboard.view_sensitive_costs") }, freshness: { ...snapshot.freshness, fromCache: true, offlineSnapshot: false, mode: "server_cache" } };
      }
    }
    const generatedAt = nowIso();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const [values, lowStock, branchSummaries] = await Promise.all([
      this.metricValues(member.organizationId, branchId, branches.map((branch) => branch.id), periodStartForTimezone(period, timezone), operationalDateForTimezone(timezone)),
      this.lowStock(member.organizationId, branchId, branches.map((branch) => branch.id)),
      this.branchSummaries(member.organizationId, crossBranch ? branches : branches.filter((branch) => !branchId || branch.id === branchId)),
    ]);
    values.inventory_low_stock = lowStock.count;
    values.branch_count = branches.length;
    const widgets = widgetRows.map((widget) => this.resolvedWidget(widget, values, generatedAt, branchSummaries));
    const snapshot: DashboardSnapshot = {
      organization: { id: member.organizationId, code: member.organizationCode, name: member.organizationName, status: member.organizationStatus, businessProfileCode: member.businessProfileCode, timezone: member.organizationTimezone },
      membership: { id: member.membershipId, displayName: member.displayName, roleCodes: member.roleCodes, roleNames: member.roleNames, permissions: member.permissions },
      availableOrganizations, branches, selectedBranchId: branchId, filters: { period, branchId, timezone }, moduleCodes, featureCodes,
      preset: { code: preset.code, name: preset.name, description: preset.description, audience: preset.audience, version: preset.version }, presetReason: preset.reason,
      widgets, attention: this.attentionFor(member, moduleCodes, values, lowStock, branchId), branchSummaries,
      preference: { exists: preference.exists, version: preference.version, layout: preference.layout, defaultFilters, availablePresets },
      capabilities: { configureSelf: member.permissions.includes("dashboard.configure_self"), configureOrganization: member.permissions.includes("dashboard.configure_organization"), export: member.permissions.includes("dashboard.export"), crossBranch, sensitiveCosts: member.permissions.includes("dashboard.view_sensitive_costs") },
      freshness: { generatedAt, expiresAt, fromCache: false, offlineSnapshot: false, mode: "live", unavailableSourceCount: widgets.filter((widget) => widget.valueStatus === "unavailable").length },
    };
    await this.provider.run(`INSERT INTO dashboard_cache_entries (id, cache_key, organization_id, membership_id, branch_id, filters_json, payload_json, configuration_version, generated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, configuration_version = excluded.configuration_version, generated_at = excluded.generated_at, expires_at = excluded.expires_at`, [crypto.randomUUID(), cacheKey, member.organizationId, member.membershipId, branchId, JSON.stringify({ period, branchId }), JSON.stringify(snapshot), configVersion, generatedAt, expiresAt]);
    return snapshot;
  }

  async exportCustomerSnapshot(identity: TenantActor, filters: DashboardFilters): Promise<DashboardSnapshot> {
    const snapshot = await this.customerSnapshot(identity, filters);
    if (!snapshot.capabilities.export) throw new Error("No tienes permiso para exportar este tablero.");
    await this.provider.batch([
      dashboardAudit(
        snapshot.organization.id,
        "customer_membership",
        snapshot.membership.id,
        "dashboard.exported",
        "dashboard_snapshot",
        null,
        "La persona exportó los indicadores autorizados de su tablero.",
        { branchId: snapshot.selectedBranchId, period: snapshot.filters.period, widgetCount: snapshot.widgets.length },
      ),
    ]);
    return snapshot;
  }

  async savePreference(identity: TenantActor, organizationId: string, input: { presetCode: string; version: number; layout: Array<{ code: string; visible: boolean; size: DashboardWidgetSize; position: number }>; defaultFilters: { period: DashboardPeriod; branchId: string | null } }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId);
    if (!member.permissions.includes("dashboard.configure_self")) throw new Error("No tienes permiso para personalizar el tablero.");
    const preset = await this.provider.first<{ code: string }>("SELECT code FROM dashboard_presets WHERE code = ? AND status = 'active'", [input.presetCode]);
    if (!preset) throw new Error("El preset seleccionado no está disponible.");
    const [moduleCodes, featureCodes] = await Promise.all([this.effectiveModules(organizationId), this.effectiveFeatures(organizationId)]);
    const allowedRows = await this.widgetsFor(member, input.presetCode, moduleCodes, featureCodes);
    const constraints = Object.fromEntries(allowedRows.map((row) => [row.code, { supportedSizes: row.supportedSizes, defaultSize: row.defaultSize }]));
    const layout = normalizeDashboardLayout(input.layout, allowedRows.map((row) => row.code), constraints);
    const branches = await this.authorizedBranches(member);
    const crossBranch = member.permissions.includes("dashboard.view_cross_branch") && branches.length > 1;
    const defaultBranchId = input.defaultFilters.branchId;
    if (defaultBranchId && !branches.some((branch) => branch.id === defaultBranchId)) throw new Error("La sucursal predeterminada no pertenece a tu alcance autorizado.");
    const defaultFilters = { period: normalizeDashboardPeriod(input.defaultFilters.period), branchId: crossBranch ? defaultBranchId : branches[0].id };
    const layoutJson = JSON.stringify(layout);
    const filterJson = JSON.stringify(defaultFilters);
    const existing = await this.provider.first<{ id: string; version: number; presetCode: string; layoutJson: string; filterJson: string }>(`SELECT id, version, preset_code AS presetCode, layout_json AS layoutJson, filter_json AS filterJson FROM user_dashboard_preferences WHERE organization_id = ? AND membership_id = ? AND dashboard_code = 'operations'`, [organizationId, member.membershipId]);
    const expectedVersion = existing?.version ?? 0;
    if (expectedVersion !== input.version) {
      const repeatedSubmission = existing?.version === input.version + 1 && existing.presetCode === input.presetCode && existing.layoutJson === layoutJson && existing.filterJson === filterJson;
      if (repeatedSubmission) return;
      throw new Error("La configuración cambió en otra sesión. Recarga antes de guardar.");
    }
    const timestamp = nowIso();
    const preferenceId = existing?.id ?? crypto.randomUUID();
    try {
      await this.provider.batch([
        existing
          ? { sql: `UPDATE user_dashboard_preferences SET preset_code = ?, layout_json = ?, filter_json = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`, values: [input.presetCode, layoutJson, filterJson, timestamp, existing.id, input.version] }
          : { sql: `INSERT INTO user_dashboard_preferences (id, organization_id, membership_id, dashboard_code, preset_code, layout_json, filter_json, created_at, updated_at, version) VALUES (?, ?, ?, 'operations', ?, ?, ?, ?, ?, 1)`, values: [preferenceId, organizationId, member.membershipId, input.presetCode, layoutJson, filterJson, timestamp, timestamp] },
        { sql: `DELETE FROM dashboard_cache_entries WHERE organization_id = ? AND membership_id = ?`, values: [organizationId, member.membershipId] },
        dashboardAudit(organizationId, "customer_membership", member.membershipId, "dashboard.preference.saved", "user_dashboard_preference", preferenceId, "La persona actualizó su vista autorizada.", { presetCode: input.presetCode, widgetCount: layout.length, defaultFilters }),
      ]);
    } catch (error) {
      const repeated = await this.provider.first<{ version: number; presetCode: string; layoutJson: string; filterJson: string }>(`SELECT version, preset_code AS presetCode, layout_json AS layoutJson, filter_json AS filterJson FROM user_dashboard_preferences WHERE organization_id = ? AND membership_id = ? AND dashboard_code = 'operations'`, [organizationId, member.membershipId]);
      if (repeated?.version === input.version + 1 && repeated.presetCode === input.presetCode && repeated.layoutJson === layoutJson && repeated.filterJson === filterJson) return;
      throw error;
    }
    const saved = await this.provider.first<{ version: number; presetCode: string; layoutJson: string; filterJson: string }>(`SELECT version, preset_code AS presetCode, layout_json AS layoutJson, filter_json AS filterJson FROM user_dashboard_preferences WHERE id = ?`, [preferenceId]);
    if (saved?.version !== input.version + 1 || saved.presetCode !== input.presetCode || saved.layoutJson !== layoutJson || saved.filterJson !== filterJson) throw new Error("La configuración cambió en otra sesión. Recarga antes de guardar.");
  }

  async resetPreference(identity: TenantActor, organizationId: string): Promise<void> {
    const member = await this.membership(identity, organizationId);
    if (!member.permissions.includes("dashboard.configure_self")) throw new Error("No tienes permiso para restablecer el tablero.");
    await this.provider.batch([
      { sql: `DELETE FROM user_dashboard_preferences WHERE organization_id = ? AND membership_id = ?`, values: [organizationId, member.membershipId] },
      { sql: `DELETE FROM dashboard_cache_entries WHERE organization_id = ? AND membership_id = ?`, values: [organizationId, member.membershipId] },
      dashboardAudit(organizationId, "customer_membership", member.membershipId, "dashboard.preference.reset", "user_dashboard_preference", null, "La persona restableció su vista al preset resuelto."),
    ]);
  }

  private async saveOverride(organizationId: string, input: { targetType: "preset" | "widget"; targetCode: string; enabled?: boolean; size?: DashboardWidgetSize; displayOrder?: number; effectiveUntil?: string; reason: string }, actorType: "customer_membership" | "platform_user", actorId: string): Promise<string> {
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Explica el motivo del cambio de tablero.");
    if (input.effectiveUntil && (Number.isNaN(new Date(input.effectiveUntil).getTime()) || new Date(input.effectiveUntil).getTime() <= Date.now())) throw new Error("La vigencia debe terminar en una fecha futura.");
    const table = input.targetType === "preset" ? "dashboard_presets" : "dashboard_widget_definitions";
    const target = await this.provider.first<{ code: string }>(`SELECT code FROM ${table} WHERE code = ? AND status = 'active'`, [input.targetCode]);
    if (!target) throw new Error("El elemento de tablero seleccionado no está disponible.");
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const enabled = input.targetType === "preset" ? 1 : input.enabled === false ? 0 : 1;
    const supersede: SqlCommand = input.targetType === "preset"
      ? { sql: `UPDATE organization_dashboard_overrides SET status = 'superseded', updated_at = ?, version = version + 1 WHERE organization_id = ? AND target_type = 'preset' AND status = 'active'`, values: [timestamp, organizationId] }
      : { sql: `UPDATE organization_dashboard_overrides SET status = 'superseded', updated_at = ?, version = version + 1 WHERE organization_id = ? AND target_type = 'widget' AND target_code = ? AND status = 'active'`, values: [timestamp, organizationId, input.targetCode] };
    await this.provider.batch([
      supersede,
      { sql: `INSERT INTO organization_dashboard_overrides (id, organization_id, target_type, target_code, enabled, size, display_order, value_json, effective_from, effective_until, reason, status, created_by_type, created_by, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, 'active', ?, ?, ?, ?, 1)`, values: [id, organizationId, input.targetType, input.targetCode, enabled, input.size ?? null, input.displayOrder ?? null, timestamp, input.effectiveUntil ?? null, reason, actorType, actorId, timestamp, timestamp] },
      { sql: `DELETE FROM dashboard_cache_entries WHERE organization_id = ?`, values: [organizationId] },
      dashboardAudit(organizationId, actorType, actorId, "dashboard.organization_override.saved", "organization_dashboard_override", id, reason, input),
    ]);
    return id;
  }

  private async assertWidgetEntitlement(organizationId: string, widgetCode: string, requestedSize?: DashboardWidgetSize): Promise<void> {
    const widget = await this.provider.first<{ sourceModuleCode: string | null; requiredFeatureCode: string | null; supportedSizesJson: string }>(`SELECT source_module_code AS sourceModuleCode, required_feature_code AS requiredFeatureCode, supported_sizes_json AS supportedSizesJson FROM dashboard_widget_definitions WHERE code = ? AND status = 'active'`, [widgetCode]);
    if (!widget) throw new Error("El widget seleccionado no está disponible.");
    const [moduleCodes, featureCodes] = await Promise.all([this.effectiveModules(organizationId), this.effectiveFeatures(organizationId)]);
    if (widget.sourceModuleCode && !moduleCodes.includes(widget.sourceModuleCode)) throw new Error("El widget requiere un módulo no contratado.");
    if (widget.requiredFeatureCode && !featureCodes.includes(widget.requiredFeatureCode)) throw new Error("El widget requiere una característica no contratada.");
    if (requestedSize && !parseJson<DashboardWidgetSize[]>(widget.supportedSizesJson, []).includes(requestedSize)) throw new Error("El tamaño seleccionado no está permitido para este widget.");
  }

  async saveOrganizationOverride(identity: TenantActor, organizationId: string, input: { targetType: "preset" | "widget"; targetCode: string; enabled?: boolean; size?: DashboardWidgetSize; displayOrder?: number; effectiveUntil?: string; reason: string }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId);
    if (!member.permissions.includes("dashboard.configure_organization")) throw new Error("No tienes permiso para configurar el tablero de la organización.");
    const organizationWide = member.scopes.some((scope) => scope.type === "organization" && ["write", "manage"].includes(scope.accessMode));
    if (!organizationWide) throw new Error("Tu alcance no permite cambiar la configuración general.");
    if (input.targetType === "widget") await this.assertWidgetEntitlement(organizationId, input.targetCode, input.size);
    await this.saveOverride(organizationId, input, "customer_membership", member.membershipId);
  }

  async catalog(organizationId?: string): Promise<DashboardCatalogSnapshot> {
    await this.ensureCatalog();
    const widgetRows = await this.provider.all<Record<string, unknown>>(`SELECT code, name, description, category, widget_type AS widgetType, supported_sizes_json AS supportedSizesJson, metric_code AS metricCode, source_module_code AS sourceModuleCode, required_feature_code AS requiredFeatureCode, required_permission AS requiredPermission, required_scope_type AS requiredScopeType, data_source_code AS dataSourceCode, supported_filters_json AS supportedFiltersJson, refresh_policy AS refreshPolicy, stale_after_seconds AS staleAfterSeconds, empty_state_type AS emptyStateType, sensitivity_level AS sensitivityLevel, display_order AS displayOrder, source_status AS sourceStatus, availability_reason AS availabilityReason, supports_branch AS supportsBranch, supports_period AS supportsPeriod, default_size AS defaultSize, sensitive, status, version FROM dashboard_widget_definitions ORDER BY display_order, category, name`);
    const presetRows = await this.provider.all<{ code: string; name: string; description: string; audience: string; version: number }>(`SELECT code, name, description, audience, version FROM dashboard_presets WHERE status = 'active' ORDER BY name`);
    const presetWidgets = await this.provider.all<{ presetCode: string; code: string; position: number; size: DashboardWidgetSize; required: unknown }>(`SELECT p.code AS presetCode, w.code, pw.display_order AS position, pw.size, pw.required FROM dashboard_preset_widgets pw JOIN dashboard_presets p ON p.id = pw.preset_id JOIN dashboard_widget_definitions w ON w.id = pw.widget_id ORDER BY p.code, pw.display_order`);
    const roleDefaults = await this.provider.all<{ roleCode: string; presetCode: string; priority: number }>(`SELECT d.role_code AS roleCode, p.code AS presetCode, d.priority FROM role_dashboard_defaults d JOIN dashboard_presets p ON p.id = d.preset_id ORDER BY d.priority`);
    const businessProfileDefaults = await this.provider.all<{ businessProfileCode: string; presetCode: string }>(`SELECT d.business_profile_code AS businessProfileCode, p.code AS presetCode FROM business_profile_dashboard_defaults d JOIN dashboard_presets p ON p.id = d.preset_id ORDER BY d.business_profile_code`);
    const organizations = await this.provider.all<{ id: string; code: string; name: string; status: string; businessProfileCode: string }>(`SELECT id, code, commercial_name AS name, status, business_profile_id AS businessProfileCode FROM tenant_organizations WHERE deleted_at IS NULL ORDER BY commercial_name LIMIT 200`);
    let selectedOrganization: DashboardCatalogSnapshot["selectedOrganization"] = null;
    if (organizationId) {
      const organization = organizations.find((item) => item.id === organizationId);
      if (!organization) throw new Error("No se encontró la organización.");
      const overrides = await this.provider.all<Record<string, unknown>>(`SELECT id, target_type AS targetType, target_code AS targetCode, enabled, size, display_order AS displayOrder, effective_until AS effectiveUntil, reason, status, version FROM organization_dashboard_overrides WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100`, [organizationId]);
      const activePreset = await this.provider.first<{ targetCode: string }>(`SELECT target_code AS targetCode FROM organization_dashboard_overrides WHERE organization_id = ? AND target_type = 'preset' AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?) ORDER BY created_at DESC LIMIT 1`, [organizationId, nowIso(), nowIso()]);
      const branchCount = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM tenant_branches WHERE organization_id = ? AND status = 'active'`, [organizationId]);
      const fallback = await this.catalogDefaultPreset([], organization.businessProfileCode, Number(branchCount?.count ?? 0));
      const presetCode = activePreset?.targetCode ?? fallback.presetCode;
      const presetName = presetRows.find((preset) => preset.code === presetCode)?.name ?? presetCode;
      selectedOrganization = {
        id: organizationId,
        presetCode,
        presetName,
        presetReason: activePreset ? "Override organizacional vigente; los permisos y el rol todavía filtran el resultado final." : `${fallback.reason} El rol de cada membresía puede elegir una vista más específica.`,
        overrides: overrides.map((row) => ({ id: String(row.id), targetType: String(row.targetType), targetCode: String(row.targetCode), enabled: row.enabled === null ? null : bool(row.enabled), size: row.size ? String(row.size) as DashboardWidgetSize : null, displayOrder: row.displayOrder === null ? null : Number(row.displayOrder), effectiveUntil: row.effectiveUntil ? String(row.effectiveUntil) : null, reason: String(row.reason), status: String(row.status), version: Number(row.version) })),
      };
    }
    return {
      widgets: widgetRows.map((row) => asCatalogWidget(this.widgetRow({ ...row, position: 0, size: row.defaultSize, required: 0 }))),
      presets: presetRows.map((preset) => ({ ...preset, widgets: presetWidgets.filter((widget) => widget.presetCode === preset.code).map((widget) => ({ code: widget.code, position: widget.position, size: widget.size, required: bool(widget.required) })) })),
      roleDefaults, businessProfileDefaults, organizations, selectedOrganization,
    };
  }

  async setWidgetStatus(actor: PlatformActor, input: { code: string; active: boolean; version: number; reason: string }): Promise<void> {
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Explica el motivo del cambio global.");
    const widget = await this.provider.first<{ id: string; status: string; version: number }>(`SELECT id, status, version FROM dashboard_widget_definitions WHERE code = ?`, [input.code]);
    if (!widget) throw new Error("No se encontró el widget.");
    const status = input.active ? "active" : "inactive";
    if (widget.version !== input.version) {
      if (widget.version === input.version + 1 && widget.status === status) return;
      throw new Error("El catálogo cambió en otra sesión. Recarga antes de guardar.");
    }
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE dashboard_widget_definitions SET status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`, values: [status, timestamp, widget.id, input.version] },
      { sql: `DELETE FROM dashboard_cache_entries`, values: [] },
      platformAudit(actor, "dashboard.widget.status.changed", "dashboard_widget_definition", widget.id, reason, { code: input.code, fromStatus: widget.status, toStatus: status }),
    ]);
    const saved = await this.provider.first<{ status: string; version: number }>(`SELECT status, version FROM dashboard_widget_definitions WHERE id = ?`, [widget.id]);
    if (saved?.status !== status || saved.version !== input.version + 1) throw new Error("El catálogo cambió en otra sesión. Recarga antes de guardar.");
  }

  async savePlatformOrganizationOverride(actor: PlatformActor, organizationId: string, input: { targetType: "preset" | "widget"; targetCode: string; enabled?: boolean; size?: DashboardWidgetSize; displayOrder?: number; effectiveUntil?: string; reason: string }): Promise<void> {
    await this.ensureCatalog();
    const organization = await this.provider.first<{ id: string }>(`SELECT id FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL`, [organizationId]);
    if (!organization) throw new Error("No se encontró la organización.");
    if (input.targetType === "widget") await this.assertWidgetEntitlement(organizationId, input.targetCode, input.size);
    const id = await this.saveOverride(organizationId, input, "platform_user", actor.id);
    await this.provider.batch([platformAudit(actor, "dashboard.organization_override.saved", "organization_dashboard_override", id, input.reason, { organizationId, ...input })]);
  }
}
