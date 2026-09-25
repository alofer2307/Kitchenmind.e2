import type { SqlCommand } from "./commercial.contracts";
import type {
  CustomerAccessSnapshot,
  CustomerOnboardingSnapshot,
  CustomerOrganizationAccess,
  CustomerWorkspaceSnapshot,
  InvitationPreview,
  InvitationStatus,
  MembershipStatus,
  OnboardingProjectStatus,
  OnboardingSectionSummary,
  OnboardingTaskStatus,
  OrganizationDetail,
  OrganizationStatus,
  OrganizationSummary,
  ProvisioningEligibility,
  ProvisionOrganizationResult,
  TenantOverview,
} from "@/types";
import type { CustomerIdentity, TenancyDataProvider, TenancyRepository } from "./tenancy.contracts";

const CUSTOMER_PERMISSIONS = [
  ["organization.read", "Consultar la organización."],
  ["organization.configure", "Configurar datos generales."],
  ["branches.read", "Consultar sucursales."],
  ["branches.manage", "Crear y editar sucursales."],
  ["areas.manage", "Configurar áreas."],
  ["warehouses.manage", "Configurar almacenes."],
  ["users.read", "Consultar usuarios."],
  ["users.invite", "Invitar usuarios."],
  ["users.manage_roles", "Administrar roles."],
  ["employees.read", "Consultar empleados."],
  ["employees.import", "Importar empleados."],
  ["employees.manage", "Administrar empleados."],
  ["shifts.manage", "Configurar turnos."],
  ["services.configure", "Configurar servicios."],
  ["quality.configure", "Configurar calidad."],
  ["quality.logs.read", "Consultar bitácoras y resultados de calidad."],
  ["quality.logs.capture", "Programar y capturar bitácoras de calidad."],
  ["quality.templates.manage", "Crear, versionar y publicar plantillas de calidad."],
  ["quality.corrective.manage", "Gestionar acciones correctivas de calidad."],
  ["quality.evidence.upload", "Adjuntar evidencia privada a registros de calidad."],
  ["inventory.configure", "Configurar inventario."],
  ["devices.manage", "Registrar dispositivos."],
  ["onboarding.read", "Consultar onboarding."],
  ["onboarding.complete", "Completar tareas de onboarding."],
  ["organization.request_activation", "Solicitar revisión de activación."],
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

const ROLE_TEMPLATES = [
  ["owner", "Dueño"], ["administrator", "Administrador"], ["human_resources", "Recursos Humanos"],
  ["regional_supervisor", "Supervisor regional"], ["branch_manager", "Gerente de sucursal"],
  ["quality_supervisor", "Supervisor de calidad"], ["warehouse", "Almacén"], ["purchasing", "Compras"],
  ["production", "Producción"], ["nutrition", "Nutrición"], ["operator", "Operador"],
  ["auditor", "Auditor"], ["viewer", "Consulta"], ["employee", "Empleado"],
] as const;

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  owner: CUSTOMER_PERMISSIONS.map(([code]) => code),
  administrator: CUSTOMER_PERMISSIONS.map(([code]) => code),
  human_resources: ["organization.read", "branches.read", "employees.read", "employees.import", "employees.manage", "shifts.manage", "onboarding.read", "onboarding.complete", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_employee_details"],
  regional_supervisor: ["organization.read", "branches.read", "employees.read", "quality.configure", "quality.logs.read", "quality.logs.capture", "quality.corrective.manage", "quality.evidence.upload", "onboarding.read", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_employee_details", "dashboard.view_quality_details", "dashboard.view_inventory_details", "dashboard.view_purchase_details", "dashboard.view_sync_health"],
  branch_manager: ["organization.read", "branches.read", "employees.read", "services.configure", "inventory.configure", "quality.logs.read", "quality.logs.capture", "quality.corrective.manage", "quality.evidence.upload", "onboarding.read", "onboarding.complete", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_employee_details", "dashboard.view_quality_details", "dashboard.view_inventory_details", "dashboard.view_purchase_details", "dashboard.view_sync_health"],
  quality_supervisor: ["organization.read", "branches.read", "quality.configure", "quality.logs.read", "quality.logs.capture", "quality.templates.manage", "quality.corrective.manage", "quality.evidence.upload", "onboarding.read", "onboarding.complete", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_quality_details"],
  warehouse: ["organization.read", "branches.read", "warehouses.manage", "inventory.configure", "onboarding.read", "onboarding.complete", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_inventory_details"],
  purchasing: ["organization.read", "branches.read", "inventory.configure", "onboarding.read", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_inventory_details", "dashboard.view_purchase_details"],
  production: ["organization.read", "branches.read", "inventory.configure", "onboarding.read", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_inventory_details", "dashboard.view_sensitive_costs"],
  nutrition: ["organization.read", "branches.read", "quality.configure", "quality.logs.read", "quality.logs.capture", "quality.evidence.upload", "onboarding.read", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_quality_details"],
  operator: ["organization.read", "branches.read", "quality.logs.read", "quality.logs.capture", "quality.evidence.upload", "onboarding.read", "dashboard.read", "dashboard.configure_self"],
  auditor: ["organization.read", "branches.read", "employees.read", "quality.logs.read", "onboarding.read", "dashboard.read", "dashboard.configure_self", "dashboard.export", "dashboard.view_cross_branch", "dashboard.view_employee_details", "dashboard.view_quality_details", "dashboard.view_inventory_details", "dashboard.view_purchase_details", "dashboard.view_service_billing", "dashboard.view_sync_health"],
  viewer: ["organization.read", "branches.read", "quality.logs.read", "onboarding.read", "dashboard.read", "dashboard.configure_self"],
  employee: [],
};

const PROVISIONING_STEPS = [
  ["validate_quote", "Validar cotización aceptada"], ["reserve_identifiers", "Reservar identificadores"],
  ["create_organization", "Crear organización"], ["copy_commercial_snapshot", "Copiar alcance comercial"],
  ["create_entitlements", "Crear módulos y límites"], ["create_branch", "Crear primera sucursal"],
  ["create_roles", "Crear roles y permisos"], ["create_onboarding", "Crear onboarding"],
  ["create_invitation", "Crear invitación del administrador"], ["audit", "Registrar trazabilidad"],
] as const;

interface OnboardingTaskDefinition {
  code: string;
  title: string;
  description: string;
  moduleCode: string | null;
  required: boolean;
}

interface OnboardingSectionDefinition {
  code: string;
  title: string;
  description: string;
  moduleCode: string | null;
  tasks: OnboardingTaskDefinition[];
}

const ONBOARDING_SECTIONS: OnboardingSectionDefinition[] = [
  { code: "company", title: "Empresa", description: "Identidad, moneda y zona horaria.", moduleCode: null, tasks: [
    { code: "company_profile", title: "Completar empresa", description: "Revisa razón social, contacto y configuración regional.", moduleCode: null, required: true },
    { code: "company_timezone", title: "Confirmar zona horaria", description: "Define la zona horaria real de la operación.", moduleCode: null, required: true },
  ] },
  { code: "branches", title: "Sucursales", description: "Unidades, áreas y responsables.", moduleCode: null, tasks: [
    { code: "first_branch", title: "Confirmar primera sucursal", description: "Revisa el nombre, código, dirección y horario.", moduleCode: null, required: true },
    { code: "areas", title: "Configurar áreas", description: "Registra las áreas que necesita la operación.", moduleCode: null, required: false },
  ] },
  { code: "users", title: "Acceso", description: "Administrador y permisos iniciales.", moduleCode: null, tasks: [
    { code: "first_admin", title: "Aceptar acceso administrador", description: "El primer administrador debe aceptar su invitación.", moduleCode: null, required: true },
  ] },
  { code: "personnel", title: "Personal", description: "Turnos y empleados iniciales.", moduleCode: "PERSONNEL", tasks: [
    { code: "shifts", title: "Configurar turnos", description: "Crea al menos un turno operativo.", moduleCode: "PERSONNEL", required: true },
    { code: "employees", title: "Cargar empleados", description: "Captura o importa la plantilla inicial.", moduleCode: "PERSONNEL", required: true },
  ] },
  { code: "services", title: "Servicios", description: "Tipos, horarios y elegibilidad.", moduleCode: "SERVICES", tasks: [
    { code: "service_types", title: "Configurar servicios", description: "Crea los servicios que realmente ofrece la sucursal.", moduleCode: "SERVICES", required: true },
  ] },
  { code: "quality", title: "Calidad", description: "Bitácoras, rangos y responsables.", moduleCode: "QUALITY", tasks: [
    { code: "quality_templates", title: "Configurar bitácoras", description: "Crea al menos una plantilla estructurada de calidad.", moduleCode: "QUALITY", required: true },
  ] },
  { code: "inventory", title: "Inventario", description: "Almacenes, productos y saldo inicial.", moduleCode: "INVENTORY", tasks: [
    { code: "warehouses", title: "Crear almacenes", description: "Registra al menos un almacén.", moduleCode: "INVENTORY", required: true },
    { code: "products", title: "Cargar productos", description: "Captura el catálogo inicial de productos.", moduleCode: "INVENTORY", required: true },
    { code: "opening_stock", title: "Registrar inventario inicial", description: "Crea movimientos de apertura trazables.", moduleCode: "INVENTORY", required: true },
  ] },
  { code: "devices", title: "Dispositivos", description: "Tablets, computadoras y kioscos.", moduleCode: "DEVICES", tasks: [
    { code: "devices", title: "Registrar dispositivos", description: "Vincula los equipos contratados a una sucursal.", moduleCode: "DEVICES", required: true },
  ] },
  { code: "review", title: "Revisión", description: "Comprobaciones previas al arranque.", moduleCode: null, tasks: [
    { code: "final_review", title: "Solicitar revisión", description: "Envía la configuración a KitchenMind para activación.", moduleCode: null, required: true },
  ] },
];

const ONBOARDING_TEMPLATE_ID = "onboarding-template-kitchenmind-v1";
const ONBOARDING_TEMPLATE_CODE = "kitchenmind-default";
const ONBOARDING_TEMPLATE_EFFECTIVE_FROM = "2026-09-05T00:00:00.000Z";

interface QuoteProvisioningRow {
  quoteId: string;
  quoteNumber: string;
  quoteStatus: string;
  quoteVersionId: string;
  versionLockedAt: string | null;
  prospectId: string;
  prospectStatus: string;
  commercialName: string;
  legalName: string | null;
  businessProfileId: string | null;
  businessType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  countryCode: string;
  city: string;
  state: string | null;
  currency: string;
  billingCycle: string;
  totalOneTimeMinor: number;
  monthlyTotalMinor: number;
  selectionJson: string;
}

interface MembershipContext {
  membershipId: string;
  organizationId: string;
  organizationStatus: OrganizationStatus;
  organizationVersion: number;
  displayName: string;
  permissions: string[];
  roleNames: string[];
  scopes: Array<{ type: string; id: string | null; accessMode: string }>;
}

const nowIso = () => new Date().toISOString();
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ITEM";
const slugify = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || "organizacion";
const randomToken = () => `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
const bool = (value: unknown) => value === true || value === 1;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function platformAudit(platformUserId: string, action: string, entity: string, entityId: string | null, reason: string, after?: unknown): SqlCommand {
  return {
    sql: `INSERT INTO platform_audit_events (id, platform_user_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?)`,
    values: [crypto.randomUUID(), platformUserId, action, entity, entityId, reason, after === undefined ? null : JSON.stringify(after), nowIso()],
  };
}

function organizationAudit(organizationId: string, actorType: string, actorId: string, action: string, entity: string, entityId: string | null, reason: string, after?: unknown): SqlCommand {
  return {
    sql: `INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)`,
    values: [crypto.randomUUID(), organizationId, actorType, actorId, action, entity, entityId, reason, after === undefined ? null : JSON.stringify(after), nowIso()],
  };
}

function onboardingAnswer(organizationId: string, taskCode: string, actorType: string, actorId: string, answer: unknown, timestamp: string): SqlCommand {
  return {
    sql: `INSERT INTO onboarding_answers (id, organization_id, project_id, task_id, answer_json, answered_by_type, answered_by, created_at, updated_at, version)
      SELECT ?, t.organization_id, p.id, t.id, ?, ?, ?, ?, ?, 1
      FROM onboarding_tasks t JOIN onboarding_projects p ON p.organization_id = t.organization_id
      WHERE t.organization_id = ? AND t.code = ?
      ON CONFLICT(organization_id, task_id) DO UPDATE SET answer_json = excluded.answer_json, answered_by_type = excluded.answered_by_type, answered_by = excluded.answered_by, updated_at = excluded.updated_at, version = onboarding_answers.version + 1`,
    values: [crypto.randomUUID(), JSON.stringify(answer), actorType, actorId, timestamp, timestamp, organizationId, taskCode],
  };
}

export class D1TenancyRepository implements TenancyRepository {
  constructor(private readonly provider: TenancyDataProvider) {}

  async ensureCatalog(platformUserId: string): Promise<void> {
    const commands: SqlCommand[] = [];
    for (const [code, description] of CUSTOMER_PERMISSIONS) {
      commands.push({ sql: "INSERT OR IGNORE INTO organization_permissions (id, code, description) VALUES (?, ?, ?)", values: [`org-permission-${code}`, code, description] });
    }
    for (const [roleCode] of ROLE_TEMPLATES) {
      for (const permissionCode of ROLE_PERMISSION_MAP[roleCode] ?? []) {
        commands.push({
          sql: `INSERT OR IGNORE INTO organization_role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM organization_roles r JOIN organization_permissions p ON p.code = ?
            WHERE r.code = ? AND r.status = 'active'`,
          values: [permissionCode, roleCode],
        });
      }
    }
    commands.push({
      sql: `INSERT OR IGNORE INTO onboarding_template_versions (id, code, version_number, status, notes, effective_from, created_by) VALUES (?, ?, 1, 'published', 'Plantilla inicial versionada del onboarding productivo.', ?, ?)`,
      values: [ONBOARDING_TEMPLATE_ID, ONBOARDING_TEMPLATE_CODE, ONBOARDING_TEMPLATE_EFFECTIVE_FROM, platformUserId],
    });
    ONBOARDING_SECTIONS.forEach((section, sectionIndex) => {
      const sectionId = `${ONBOARDING_TEMPLATE_ID}:section:${section.code}`;
      commands.push({
        sql: `INSERT OR IGNORE INTO onboarding_template_sections (id, template_version_id, code, title, description, display_order, module_code) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values: [sectionId, ONBOARDING_TEMPLATE_ID, section.code, section.title, section.description, sectionIndex + 1, section.moduleCode],
      });
      section.tasks.forEach((task, taskIndex) => {
        commands.push({
          sql: `INSERT OR IGNORE INTO onboarding_template_tasks (id, template_section_id, code, title, description, required, module_code, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [`${sectionId}:task:${task.code}`, sectionId, task.code, task.title, task.description, task.required ? 1 : 0, task.moduleCode, taskIndex + 1],
        });
      });
    });
    await this.provider.batch(commands);
  }

  private async onboardingTemplate(moduleCodes: string[], quantities: Record<string, number>): Promise<{ versionNumber: number; sections: OnboardingSectionDefinition[] }> {
    const version = await this.provider.first<{ id: string; versionNumber: number }>(`SELECT id, version_number AS versionNumber FROM onboarding_template_versions WHERE code = ? AND status = 'published' AND effective_from <= ? ORDER BY version_number DESC LIMIT 1`, [ONBOARDING_TEMPLATE_CODE, nowIso()]);
    if (!version) throw new Error("No existe una plantilla de onboarding publicada.");
    const sections = await this.provider.all<Record<string, unknown>>(`SELECT id, code, title, description, module_code AS moduleCode FROM onboarding_template_sections WHERE template_version_id = ? ORDER BY display_order`, [version.id]);
    const tasks = await this.provider.all<Record<string, unknown>>(`SELECT t.template_section_id AS sectionId, t.code, t.title, t.description, t.required, t.module_code AS moduleCode FROM onboarding_template_tasks t JOIN onboarding_template_sections s ON s.id = t.template_section_id WHERE s.template_version_id = ? ORDER BY s.display_order, t.display_order`, [version.id]);
    const enabledSections = sections
      .filter((section) => {
        const moduleCode = section.moduleCode ? String(section.moduleCode) : null;
        return !moduleCode || moduleCodes.includes(moduleCode) || (moduleCode === "DEVICES" && (quantities.devices ?? 0) > 0);
      })
      .map((section) => ({
        code: String(section.code),
        title: String(section.title),
        description: String(section.description),
        moduleCode: section.moduleCode ? String(section.moduleCode) : null,
        tasks: tasks.filter((task) => task.sectionId === section.id).map((task) => ({
          code: String(task.code),
          title: String(task.title),
          description: String(task.description),
          moduleCode: task.moduleCode ? String(task.moduleCode) : null,
          required: bool(task.required),
        })),
      }));
    if (!enabledSections.length) throw new Error("La plantilla de onboarding publicada no contiene secciones aplicables.");
    return { versionNumber: version.versionNumber, sections: enabledSections };
  }

  async overview(): Promise<TenantOverview> {
    const row = await this.provider.first<Record<string, number>>(`SELECT
      (SELECT COUNT(*) FROM quotes q LEFT JOIN provisioning_requests pr ON pr.quote_id = q.id WHERE q.status = 'accepted' AND pr.id IS NULL) AS acceptedQuotesReady,
      (SELECT COUNT(*) FROM tenant_organizations WHERE status = 'provisioning') AS provisioning,
      (SELECT COUNT(*) FROM tenant_organizations WHERE status = 'onboarding') AS onboarding,
      (SELECT COUNT(*) FROM tenant_organizations WHERE status = 'ready_for_review') AS readyForReview,
      (SELECT COUNT(*) FROM tenant_organizations WHERE status = 'active') AS active,
      (SELECT COUNT(*) FROM provisioning_requests WHERE status = 'failed') AS failedProvisioning,
      (SELECT COUNT(*) FROM organization_invitations WHERE status = 'pending' AND expires_at > ?) AS pendingInvitations`, [nowIso()]);
    return {
      acceptedQuotesReady: row?.acceptedQuotesReady ?? 0,
      provisioning: row?.provisioning ?? 0,
      onboarding: row?.onboarding ?? 0,
      readyForReview: row?.readyForReview ?? 0,
      active: row?.active ?? 0,
      failedProvisioning: row?.failedProvisioning ?? 0,
      pendingInvitations: row?.pendingInvitations ?? 0,
    };
  }

  private async quoteRow(quoteId: string): Promise<QuoteProvisioningRow | null> {
    return this.provider.first<QuoteProvisioningRow>(`SELECT
      q.id AS quoteId, q.quote_number AS quoteNumber, q.status AS quoteStatus,
      qv.id AS quoteVersionId, qv.locked_at AS versionLockedAt,
      p.id AS prospectId, p.status AS prospectStatus, p.commercial_name AS commercialName,
      p.legal_name AS legalName, p.business_profile_id AS businessProfileId, p.business_type AS businessType,
      p.contact_name AS contactName, p.contact_email AS contactEmail, p.contact_phone AS contactPhone,
      p.country_code AS countryCode, p.city, p.state, qv.currency, qv.billing_cycle AS billingCycle,
      qv.total_one_time_minor AS totalOneTimeMinor, qv.monthly_total_minor AS monthlyTotalMinor,
      qv.selection_json AS selectionJson
      FROM quotes q JOIN quote_versions qv ON qv.id = q.current_version_id JOIN prospects p ON p.id = q.prospect_id
      WHERE q.id = ? LIMIT 1`, [quoteId]);
  }

  async acceptedQuotes(): Promise<ProvisioningEligibility[]> {
    const rows = await this.provider.all<{ id: string }>("SELECT q.id FROM quotes q LEFT JOIN provisioning_requests pr ON pr.quote_id = q.id WHERE q.status = 'accepted' AND pr.id IS NULL ORDER BY q.accepted_at DESC, q.updated_at DESC LIMIT 100");
    return Promise.all(rows.map((row) => this.eligibility(row.id)));
  }

  async eligibility(quoteId: string): Promise<ProvisioningEligibility> {
    const row = await this.quoteRow(quoteId);
    if (!row) return { eligible: false, quoteId, quoteNumber: "", prospectName: "", issues: ["No se encontró la cotización."] };
    const selection = parseJson<{ moduleCodes?: string[]; quantities?: Record<string, number> }>(row.selectionJson, {});
    const modules = selection.moduleCodes ?? [];
    const quantities = selection.quantities ?? {};
    const issues: string[] = [];
    if (row.quoteStatus !== "accepted") issues.push("La cotización no está aceptada.");
    if (!row.versionLockedAt) issues.push("La revisión aceptada no está bloqueada.");
    if (row.prospectStatus !== "won") issues.push("El prospecto no está marcado como ganado.");
    if (!row.commercialName.trim()) issues.push("Falta el nombre comercial.");
    if (!normalizeEmail(row.contactEmail).includes("@")) issues.push("Falta un correo válido para el administrador.");
    if (!row.countryCode || !row.currency) issues.push("Falta país o moneda.");
    if (!modules.some((code) => code.toUpperCase() === "CORE")) issues.push("La solución aceptada no incluye CORE.");
    if ((quantities.branches ?? 0) < 1) issues.push("La cotización debe incluir al menos una sucursal.");
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM tenant_organizations WHERE source_quote_id = ? LIMIT 1", [quoteId]);
    if (existing) issues.push("La cotización ya tiene una organización aprovisionada.");
    return { eligible: issues.length === 0, quoteId, quoteNumber: row.quoteNumber, prospectName: row.commercialName, issues };
  }

  async provision(quoteId: string, idempotencyKey: string, platformUserId: string): Promise<ProvisionOrganizationResult> {
    const previous = await this.provider.first<{ id: string; organizationId: string | null; status: string }>(
      "SELECT id, organization_id AS organizationId, status FROM provisioning_requests WHERE idempotency_key = ? OR quote_id = ? LIMIT 1",
      [idempotencyKey, quoteId],
    );
    if (previous?.organizationId) {
      const invitation = await this.provider.first<{ id: string }>("SELECT id FROM organization_invitations WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1", [previous.organizationId]);
      return { organizationId: previous.organizationId, provisioningRequestId: previous.id, invitationId: invitation?.id ?? "", invitationUrl: null, reused: true };
    }
    if (previous?.status === "processing") throw new Error("El aprovisionamiento ya se está procesando. Espera antes de reintentar.");

    const eligibility = await this.eligibility(quoteId);
    if (!eligibility.eligible) throw new Error(eligibility.issues.join(" "));
    const quote = await this.quoteRow(quoteId);
    if (!quote) throw new Error("No se encontró la cotización aceptada.");
    const selection = parseJson<{ moduleCodes?: string[]; featureCodes?: string[]; quantities?: Record<string, number> }>(quote.selectionJson, {});
    const moduleCodes = Array.from(new Set(["CORE", ...(selection.moduleCodes ?? []).map((code) => code.toUpperCase())]));
    const featureCodes = Array.from(new Set(selection.featureCodes ?? []));
    const quantities = selection.quantities ?? {};
    const onboardingTemplate = await this.onboardingTemplate(moduleCodes, quantities);
    const timestamp = nowIso();
    const requestId = previous?.id ?? crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const branchId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const subscriptionId = crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    const invitationToken = randomToken();
    const invitationTokenHash = await sha256(invitationToken);
    const organizationCode = `KM-${organizationId.slice(0, 8).toUpperCase()}`;
    const organizationSlug = `${slugify(quote.commercialName)}-${organizationId.slice(0, 6)}`;
    const ownerRoleId = `${organizationId}:role:owner`;
    const commands: SqlCommand[] = [];

    if (previous) {
      commands.push({ sql: `UPDATE provisioning_requests SET status = 'processing', requested_by = ?, started_at = ?, completed_at = NULL, failed_at = NULL, last_error_code = NULL, last_error_summary = NULL, retry_count = retry_count + 1, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id IS NULL`, values: [platformUserId, timestamp, timestamp, requestId] });
    } else {
      commands.push({ sql: `INSERT INTO provisioning_requests (id, quote_id, quote_version_id, organization_id, idempotency_key, status, requested_by, started_at, created_at, updated_at, version) VALUES (?, ?, ?, NULL, ?, 'processing', ?, ?, ?, ?, 1)`, values: [requestId, quoteId, quote.quoteVersionId, idempotencyKey, platformUserId, timestamp, timestamp, timestamp] });
    }
    for (const [code, name] of PROVISIONING_STEPS) {
      commands.push({ sql: `INSERT INTO provisioning_steps (id, provisioning_request_id, code, name, status, attempt_count, started_at, completed_at) VALUES (?, ?, ?, ?, 'completed', 1, ?, ?) ON CONFLICT(provisioning_request_id, code) DO UPDATE SET status = 'completed', attempt_count = provisioning_steps.attempt_count + 1, started_at = excluded.started_at, completed_at = excluded.completed_at, last_error = NULL`, values: [crypto.randomUUID(), requestId, code, name, timestamp, timestamp] });
    }
    commands.push({
      sql: `INSERT INTO tenant_organizations (id, code, slug, commercial_name, legal_name, business_profile_id, country_code, default_currency, default_timezone, locale, contact_email, contact_phone, status, onboarding_status, source_prospect_id, source_quote_id, source_quote_version_id, created_at, updated_at, created_by_platform_user_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UTC', 'es-MX', ?, ?, 'onboarding', 'not_started', ?, ?, ?, ?, ?, ?, 1)`,
      values: [organizationId, organizationCode, organizationSlug, quote.commercialName, quote.legalName, quote.businessProfileId ?? quote.businessType, quote.countryCode, quote.currency, normalizeEmail(quote.contactEmail), quote.contactPhone, quote.prospectId, quoteId, quote.quoteVersionId, timestamp, timestamp, platformUserId],
    });
    commands.push({ sql: "UPDATE provisioning_requests SET organization_id = ? WHERE id = ?", values: [organizationId, requestId] });
    commands.push({ sql: `INSERT INTO tenant_branches (id, organization_id, code, name, address, timezone, status, created_at, updated_at, created_by, version) VALUES (?, ?, 'PRINCIPAL', 'Unidad principal', ?, 'UTC', 'active', ?, ?, ?, 1)`, values: [branchId, organizationId, [quote.city, quote.state, quote.countryCode].filter(Boolean).join(", "), timestamp, timestamp, platformUserId] });

    for (const [code, name] of ROLE_TEMPLATES) {
      const roleId = `${organizationId}:role:${code}`;
      commands.push({ sql: `INSERT INTO organization_roles (id, organization_id, code, name, description, system_template, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 'active', ?, ?)`, values: [roleId, organizationId, code, name, `Rol inicial ${name}; puede editarse sin perder su código estable.`, timestamp, timestamp] });
      for (const permissionCode of ROLE_PERMISSION_MAP[code] ?? []) {
        commands.push({ sql: `INSERT INTO organization_role_permissions (role_id, permission_id) SELECT ?, id FROM organization_permissions WHERE code = ?`, values: [roleId, permissionCode] });
      }
    }

    for (const moduleCode of moduleCodes) {
      const entitlementId = crypto.randomUUID();
      commands.push({ sql: `INSERT INTO organization_entitlements (id, organization_id, module_code, feature_code, source_type, source_quote_version_id, enabled, effective_from, status, created_at, created_by) VALUES (?, ?, ?, NULL, 'quote', ?, 1, ?, 'active', ?, ?)`, values: [entitlementId, organizationId, moduleCode, quote.quoteVersionId, timestamp, timestamp, platformUserId] });
    }
    for (const featureCode of featureCodes) {
      commands.push({ sql: `INSERT INTO organization_entitlements (id, organization_id, module_code, feature_code, source_type, source_quote_version_id, enabled, effective_from, status, created_at, created_by) VALUES (?, ?, NULL, ?, 'quote', ?, 1, ?, 'active', ?, ?)`, values: [crypto.randomUUID(), organizationId, featureCode, quote.quoteVersionId, timestamp, timestamp, platformUserId] });
    }
    const limitDefinitions = [
      ["branches", "branch", Math.max(1, quantities.branches ?? 1)], ["employees", "employee", Math.max(0, quantities.employees ?? 0)],
      ["users", "user", Math.max(1, quantities.users ?? 1)], ["devices", "device", Math.max(0, quantities.devices ?? 0)],
      ["warehouses", "warehouse", Math.max(0, quantities.warehouses ?? 0)], ["monthlyMovements", "movement", Math.max(0, quantities.monthlyMovements ?? 0)],
    ] as const;
    for (const [featureCode, unit, amount] of limitDefinitions) {
      commands.push({ sql: `INSERT INTO organization_feature_limits (id, organization_id, feature_code, included_quantity, hard_limit, warning_threshold, unit, current_usage, effective_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), organizationId, featureCode, amount, amount, amount > 0 ? Math.max(1, Math.floor(amount * 0.8)) : null, unit, featureCode === "branches" ? 1 : 0, timestamp] });
    }
    commands.push({ sql: `INSERT INTO entitlement_history (id, organization_id, action, after_json, reason, actor_id, created_at) VALUES (?, ?, 'provisioned_from_quote', ?, 'Alcance congelado de la cotización aceptada.', ?, ?)`, values: [crypto.randomUUID(), organizationId, JSON.stringify({ moduleCodes, featureCodes, quantities }), platformUserId, timestamp] });
    commands.push({ sql: `INSERT INTO customer_subscriptions (id, organization_id, status, billing_cycle, currency, recurring_amount_minor, implementation_amount_minor, source_quote_version_id, created_at, updated_at) VALUES (?, ?, 'pending_activation', ?, ?, ?, ?, ?, ?, ?)`, values: [subscriptionId, organizationId, quote.billingCycle, quote.currency, quote.monthlyTotalMinor, quote.totalOneTimeMinor, quote.quoteVersionId, timestamp, timestamp] });
    commands.push({ sql: `INSERT INTO subscription_status_history (id, organization_id, subscription_id, from_status, to_status, reason, actor_id, created_at) VALUES (?, ?, ?, NULL, 'pending_activation', 'Suscripción manual creada desde la cotización aceptada.', ?, ?)`, values: [crypto.randomUUID(), organizationId, subscriptionId, platformUserId, timestamp] });
    for (const moduleCode of moduleCodes) {
      commands.push({ sql: `INSERT INTO customer_subscription_items (id, organization_id, subscription_id, item_type, code, description, quantity, unit, billing_period, amount_minor, currency, created_at) VALUES (?, ?, ?, 'module', ?, ?, 1, 'module', 'entitlement', 0, ?, ?)`, values: [crypto.randomUUID(), organizationId, subscriptionId, moduleCode, `Módulo ${moduleCode}`, quote.currency, timestamp] });
    }
    for (const featureCode of featureCodes) {
      commands.push({ sql: `INSERT INTO customer_subscription_items (id, organization_id, subscription_id, item_type, code, description, quantity, unit, billing_period, amount_minor, currency, created_at) VALUES (?, ?, ?, 'feature', ?, ?, 1, 'feature', 'entitlement', 0, ?, ?)`, values: [crypto.randomUUID(), organizationId, subscriptionId, featureCode, `Característica ${featureCode}`, quote.currency, timestamp] });
    }
    for (const [quantityCode, quantity] of Object.entries(quantities)) {
      commands.push({ sql: `INSERT INTO customer_subscription_items (id, organization_id, subscription_id, item_type, code, description, quantity, unit, billing_period, amount_minor, currency, created_at) VALUES (?, ?, ?, 'limit', ?, ?, ?, ?, 'contract', 0, ?, ?)`, values: [crypto.randomUUID(), organizationId, subscriptionId, quantityCode, `Cantidad contratada: ${quantityCode}`, Math.max(0, Math.trunc(quantity)), quantityCode, quote.currency, timestamp] });
    }
    commands.push({ sql: `INSERT INTO customer_subscription_items (id, organization_id, subscription_id, item_type, code, description, quantity, unit, billing_period, amount_minor, currency, created_at) VALUES (?, ?, ?, 'charge', 'recurring_total', 'Importe recurrente aceptado', 1, 'organization', ?, ?, ?, ?)`, values: [crypto.randomUUID(), organizationId, subscriptionId, quote.billingCycle, quote.monthlyTotalMinor, quote.currency, timestamp] });
    commands.push({ sql: `INSERT INTO customer_subscription_items (id, organization_id, subscription_id, item_type, code, description, quantity, unit, billing_period, amount_minor, currency, created_at) VALUES (?, ?, ?, 'charge', 'implementation_total', 'Implementación aceptada', 1, 'organization', 'one_time', ?, ?, ?)`, values: [crypto.randomUUID(), organizationId, subscriptionId, quote.totalOneTimeMinor, quote.currency, timestamp] });

    commands.push({ sql: `INSERT INTO onboarding_projects (id, organization_id, template_version, status, completion_percentage, target_date, created_at, updated_at, version) VALUES (?, ?, ?, 'not_started', 0, ?, ?, ?, 1)`, values: [projectId, organizationId, onboardingTemplate.versionNumber, addDays(30), timestamp, timestamp] });
    commands.push({ sql: `INSERT INTO onboarding_status_history (id, organization_id, project_id, from_status, to_status, reason, actor_type, actor_id, created_at) VALUES (?, ?, ?, NULL, 'not_started', 'Proyecto creado desde la plantilla publicada.', 'platform_user', ?, ?)`, values: [crypto.randomUUID(), organizationId, projectId, platformUserId, timestamp] });
    const onboardingTaskIds = new Map<string, { id: string; required: boolean }>();
    onboardingTemplate.sections.forEach((section, sectionIndex) => {
      const sectionId = crypto.randomUUID();
      commands.push({ sql: `INSERT INTO onboarding_sections (id, project_id, organization_id, code, title, description, display_order, module_code, status, completion_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`, values: [sectionId, projectId, organizationId, section.code, section.title, section.description, sectionIndex + 1, section.moduleCode] });
      section.tasks.forEach((task, taskIndex) => {
        const taskId = crypto.randomUUID();
        onboardingTaskIds.set(task.code, { id: taskId, required: task.required });
        commands.push({ sql: `INSERT INTO onboarding_tasks (id, section_id, organization_id, code, title, description, required, module_code, status, display_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, values: [taskId, sectionId, organizationId, task.code, task.title, task.description, task.required ? 1 : 0, task.moduleCode, taskIndex + 1, timestamp] });
      });
    });
    const finalReviewTask = onboardingTaskIds.get("final_review");
    if (!finalReviewTask) throw new Error("La plantilla publicada no contiene la tarea final de revisión.");
    for (const [taskCode, task] of onboardingTaskIds) {
      if (task.required && taskCode !== "final_review") {
        commands.push({ sql: `INSERT INTO onboarding_dependencies (id, project_id, organization_id, task_id, depends_on_task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), projectId, organizationId, finalReviewTask.id, task.id, timestamp] });
      }
    }

    commands.push({ sql: `INSERT INTO organization_invitations (id, organization_id, email_normalized, intended_role_id, intended_scope_json, token_hash, status, expires_at, created_by_platform_user_id, created_at, last_sent_at, send_count, version) VALUES (?, ?, ?, ?, '{"type":"organization"}', ?, 'pending', ?, ?, ?, ?, 1, 1)`, values: [invitationId, organizationId, normalizeEmail(quote.contactEmail), ownerRoleId, invitationTokenHash, addDays(7), platformUserId, timestamp, timestamp] });
    commands.push({ sql: `UPDATE provisioning_requests SET status = 'completed', completed_at = ?, updated_at = ?, version = version + 1 WHERE id = ?`, values: [timestamp, timestamp, requestId] });
    commands.push(platformAudit(platformUserId, "tenancy.organization.provisioned", "tenant_organization", organizationId, `Organización creada desde ${quote.quoteNumber}.`, { quoteId, moduleCodes, featureCodes, quantities }));
    commands.push(organizationAudit(organizationId, "platform_user", platformUserId, "organization.provisioned", "organization", organizationId, "Creación idempotente desde una cotización aceptada.", { sourceQuoteId: quoteId }));
    try {
      await this.provider.batch(commands);
    } catch (error) {
      const concurrent = await this.provider.first<{ id: string; organizationId: string | null }>("SELECT id, organization_id AS organizationId FROM provisioning_requests WHERE quote_id = ? LIMIT 1", [quoteId]).catch(() => null);
      if (concurrent?.organizationId) {
        const invitation = await this.provider.first<{ id: string }>("SELECT id FROM organization_invitations WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1", [concurrent.organizationId]);
        return { organizationId: concurrent.organizationId, provisioningRequestId: concurrent.id, invitationId: invitation?.id ?? "", invitationUrl: null, reused: true };
      }
      const summary = error instanceof Error ? error.message.slice(0, 500) : "Fallo no identificado durante el aprovisionamiento.";
      try {
        await this.provider.batch([
          { sql: `INSERT INTO provisioning_requests (id, quote_id, quote_version_id, organization_id, idempotency_key, status, requested_by, started_at, failed_at, retry_count, last_error_code, last_error_summary, created_at, updated_at, version) VALUES (?, ?, ?, NULL, ?, 'failed', ?, ?, ?, ?, 'provisioning_failed', ?, ?, ?, 1) ON CONFLICT(quote_id) DO UPDATE SET status = 'failed', failed_at = excluded.failed_at, retry_count = provisioning_requests.retry_count + 1, last_error_code = excluded.last_error_code, last_error_summary = excluded.last_error_summary, updated_at = excluded.updated_at, version = provisioning_requests.version + 1`, values: [requestId, quoteId, quote.quoteVersionId, idempotencyKey, platformUserId, timestamp, timestamp, previous ? 1 : 0, summary, timestamp, timestamp] },
          ...PROVISIONING_STEPS.map(([code, name]) => ({ sql: `INSERT OR IGNORE INTO provisioning_steps (id, provisioning_request_id, code, name, status, attempt_count, last_error) VALUES (?, ?, ?, ?, 'pending', 0, ?)`, values: [crypto.randomUUID(), requestId, code, name, summary] })),
        ]);
      } catch {
        // The original error remains authoritative when even the durable failure record cannot be written.
      }
      throw error;
    }
    return { organizationId, provisioningRequestId: requestId, invitationId, invitationUrl: `/aceptar-invitacion?token=${encodeURIComponent(invitationToken)}`, reused: false };
  }

  async organizations(): Promise<OrganizationSummary[]> {
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT o.id, o.code, o.slug, o.commercial_name AS commercialName, o.status, o.onboarding_status AS onboardingStatus,
      COALESCE(op.completion_percentage, 0) AS onboardingPercentage, o.source_quote_id AS sourceQuoteId, q.quote_number AS sourceQuoteNumber,
      (SELECT COUNT(*) FROM tenant_branches b WHERE b.organization_id = o.id AND b.status = 'active') AS branchCount,
      (SELECT COUNT(*) FROM organization_entitlements e WHERE e.organization_id = o.id AND e.module_code IS NOT NULL AND e.enabled = 1 AND e.status = 'active') AS activeModuleCount,
      (SELECT COUNT(*) FROM organization_invitations i WHERE i.organization_id = o.id AND i.status = 'pending' AND i.expires_at > ?) AS pendingInvitationCount,
      (SELECT cu.email FROM organization_memberships m JOIN customer_users cu ON cu.id = m.user_id WHERE m.organization_id = o.id AND m.status = 'active' ORDER BY m.joined_at LIMIT 1) AS administratorEmail,
      (SELECT GROUP_CONCAT(e.module_code, ',') FROM organization_entitlements e WHERE e.organization_id = o.id AND e.module_code IS NOT NULL AND e.enabled = 1 AND e.status = 'active') AS moduleCodes,
      (SELECT COUNT(*) FROM onboarding_tasks ot WHERE ot.organization_id = o.id AND ot.status = 'blocked') AS blockerCount,
      o.business_profile_id AS businessProfileId, o.created_at AS createdAt, o.updated_at AS updatedAt, o.activated_at AS activatedAt, o.version
      FROM tenant_organizations o JOIN quotes q ON q.id = o.source_quote_id LEFT JOIN onboarding_projects op ON op.organization_id = o.id
      WHERE o.deleted_at IS NULL ORDER BY o.updated_at DESC`, [nowIso()]);
    return rows.map((row) => ({
      id: String(row.id), code: String(row.code), slug: String(row.slug), commercialName: String(row.commercialName),
      status: String(row.status) as OrganizationStatus, onboardingStatus: String(row.onboardingStatus) as OnboardingProjectStatus,
      onboardingPercentage: Number(row.onboardingPercentage), sourceQuoteId: String(row.sourceQuoteId), sourceQuoteNumber: String(row.sourceQuoteNumber),
      branchCount: Number(row.branchCount), activeModuleCount: Number(row.activeModuleCount), pendingInvitationCount: Number(row.pendingInvitationCount),
      businessProfileId: String(row.businessProfileId), administratorEmail: row.administratorEmail ? String(row.administratorEmail) : null,
      moduleCodes: row.moduleCodes ? String(row.moduleCodes).split(",").filter(Boolean) : [], blockerCount: Number(row.blockerCount),
      createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), activatedAt: row.activatedAt ? String(row.activatedAt) : null, version: Number(row.version),
    }));
  }

  private async sectionSummaries(organizationId: string): Promise<OnboardingSectionSummary[]> {
    const sections = await this.provider.all<Record<string, unknown>>(`SELECT id, code, title, description, display_order AS displayOrder, completion_percentage AS percentage FROM onboarding_sections WHERE organization_id = ? ORDER BY display_order`, [organizationId]);
    const tasks = await this.provider.all<Record<string, unknown>>(`SELECT id, section_id AS sectionId, code, title, description, status, required, module_code AS moduleCode, completed_at AS completedAt, blocked_reason AS blockedReason FROM onboarding_tasks WHERE organization_id = ? ORDER BY display_order`, [organizationId]);
    return sections.map((section) => ({
      id: String(section.id), code: String(section.code), title: String(section.title), description: String(section.description),
      displayOrder: Number(section.displayOrder), percentage: Number(section.percentage),
      tasks: tasks.filter((task) => task.sectionId === section.id).map((task) => ({
        id: String(task.id), code: String(task.code), title: String(task.title), description: String(task.description),
        status: String(task.status) as OnboardingTaskStatus, required: bool(task.required), moduleCode: task.moduleCode ? String(task.moduleCode) : null,
        completedAt: task.completedAt ? String(task.completedAt) : null, blockedReason: task.blockedReason ? String(task.blockedReason) : null,
      })),
    }));
  }

  async organization(id: string): Promise<OrganizationDetail | null> {
    const summary = (await this.organizations()).find((item) => item.id === id);
    if (!summary) return null;
    const row = await this.provider.first<Record<string, unknown>>(`SELECT legal_name AS legalName, country_code AS countryCode, default_currency AS defaultCurrency,
      default_timezone AS defaultTimezone, locale, contact_email AS contactEmail, contact_phone AS contactPhone, business_profile_id AS businessProfileId
      FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!row) return null;
    const entitlements = await this.provider.all<Record<string, unknown>>(`SELECT id, module_code AS moduleCode, feature_code AS featureCode, enabled, status, effective_from AS effectiveFrom, effective_until AS effectiveUntil FROM organization_entitlements WHERE organization_id = ? ORDER BY module_code, feature_code`, [id]);
    const limits = await this.provider.all<Record<string, unknown>>(`SELECT id, feature_code AS featureCode, included_quantity AS includedQuantity, hard_limit AS hardLimit, warning_threshold AS warningThreshold, unit, current_usage AS currentUsage FROM organization_feature_limits WHERE organization_id = ? ORDER BY feature_code`, [id]);
    const overrides = await this.provider.all<Record<string, unknown>>(`SELECT id, target_type AS targetType, module_code AS moduleCode, feature_code AS featureCode, enabled, override_limit AS overrideLimit, effective_from AS effectiveFrom, effective_until AS effectiveUntil, reason, status FROM organization_feature_overrides WHERE organization_id = ? ORDER BY created_at DESC`, [id]);
    const invitations = await this.provider.all<Record<string, unknown>>(`SELECT i.id, i.email_normalized AS email, r.name AS roleName, i.status, i.expires_at AS expiresAt, i.created_at AS createdAt, i.accepted_at AS acceptedAt FROM organization_invitations i JOIN organization_roles r ON r.id = i.intended_role_id WHERE i.organization_id = ? ORDER BY i.created_at DESC`, [id]);
    const checks = await this.provider.all<Record<string, unknown>>(`SELECT code, label, status, detail, critical FROM activation_checks WHERE organization_id = ? ORDER BY critical DESC, code`, [id]);
    const subscription = await this.provider.first<Record<string, unknown>>(`SELECT status, billing_cycle AS billingCycle, recurring_amount_minor AS recurringAmountMinor, currency FROM customer_subscriptions WHERE organization_id = ?`, [id]);
    return {
      ...summary,
      legalName: row.legalName ? String(row.legalName) : null,
      countryCode: String(row.countryCode), defaultCurrency: String(row.defaultCurrency), defaultTimezone: String(row.defaultTimezone),
      locale: String(row.locale), contactEmail: String(row.contactEmail), contactPhone: String(row.contactPhone), businessProfileId: String(row.businessProfileId),
      entitlements: entitlements.map((item) => ({ id: String(item.id), moduleCode: item.moduleCode ? String(item.moduleCode) : null, featureCode: item.featureCode ? String(item.featureCode) : null, enabled: bool(item.enabled), status: String(item.status), effectiveFrom: String(item.effectiveFrom), effectiveUntil: item.effectiveUntil ? String(item.effectiveUntil) : null })),
      limits: limits.map((item) => ({ id: String(item.id), featureCode: String(item.featureCode), includedQuantity: Number(item.includedQuantity), hardLimit: item.hardLimit === null ? null : Number(item.hardLimit), warningThreshold: item.warningThreshold === null ? null : Number(item.warningThreshold), unit: String(item.unit), currentUsage: Number(item.currentUsage) })),
      overrides: overrides.map((item) => ({ id: String(item.id), targetType: String(item.targetType) as "module" | "feature_limit", moduleCode: item.moduleCode ? String(item.moduleCode) : null, featureCode: item.featureCode ? String(item.featureCode) : null, enabled: item.enabled === null ? null : bool(item.enabled), overrideLimit: item.overrideLimit === null ? null : Number(item.overrideLimit), effectiveFrom: String(item.effectiveFrom), effectiveUntil: String(item.effectiveUntil), reason: String(item.reason), status: String(item.status) })),
      invitations: invitations.map((item) => ({ id: String(item.id), email: String(item.email), roleName: String(item.roleName), status: String(item.status) as InvitationStatus, expiresAt: String(item.expiresAt), createdAt: String(item.createdAt), acceptedAt: item.acceptedAt ? String(item.acceptedAt) : null })),
      onboardingSections: await this.sectionSummaries(id),
      activationChecks: checks.map((item) => ({ code: String(item.code), label: String(item.label), status: String(item.status) as "passed" | "failed" | "warning", detail: String(item.detail), critical: bool(item.critical) })),
      subscription: subscription ? { status: String(subscription.status), billingCycle: String(subscription.billingCycle), recurringAmountMinor: Number(subscription.recurringAmountMinor), currency: String(subscription.currency) } : null,
    };
  }

  async platformWorkspace(organizationId: string, branchId?: string): Promise<CustomerWorkspaceSnapshot | null> {
    const organization = await this.provider.first<Record<string, unknown>>(`SELECT id, code, commercial_name AS commercialName, status, default_timezone AS timezone, updated_at AS lastUpdatedAt FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL`, [organizationId]);
    if (!organization) return null;
    const onboarding = await this.provider.first<Record<string, unknown>>(`SELECT status, completion_percentage AS progress FROM onboarding_projects WHERE organization_id = ?`, [organizationId]);
    if (!onboarding) return null;
    const branches = await this.provider.all<Record<string, unknown>>(`SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' ORDER BY name`, [organizationId]);
    if (!branches.length) throw new Error("La organización no tiene una sucursal activa.");
    const selectedBranchId = branchId ?? String(branches[0].id);
    if (!branches.some((branch) => String(branch.id) === selectedBranchId)) throw new Error("No se encontró la sucursal dentro de esta organización.");
    const count = async (table: string, active = true) => {
      const row = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE organization_id = ? AND branch_id = ?${active ? " AND status = 'active'" : ""}`, [organizationId, selectedBranchId]);
      return row?.count ?? 0;
    };
    const [employees, shifts, serviceTypes, qualityTemplates, products, warehouses, devices, inventoryMovements, pendingImports, summaries, moduleCodes] = await Promise.all([
      count("tenant_employees"), count("tenant_shifts"), count("tenant_service_types"), count("tenant_quality_templates"), count("tenant_products"), count("tenant_warehouses"), count("tenant_devices"), count("tenant_inventory_movements", false),
      this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM import_batches WHERE organization_id = ? AND status IN ('pending','validating','processing')`, [organizationId]).then((row) => row?.count ?? 0),
      this.organizations(), this.effectiveModuleCodes(organizationId),
    ]);
    return {
      organization: { id: String(organization.id), code: String(organization.code), commercialName: String(organization.commercialName), status: String(organization.status) as OrganizationStatus, timezone: String(organization.timezone), lastUpdatedAt: String(organization.lastUpdatedAt) },
      membership: { id: "platform-supervision", displayName: "KitchenMind Platform", roleNames: ["Supervisión de Platform"], permissions: ["organization.read"] },
      availableOrganizations: summaries.map((item) => ({ id: item.id, code: item.code, name: item.commercialName, status: item.status, membershipStatus: "active", roleNames: ["Supervisión de Platform"], onboardingStatus: item.onboardingStatus, onboardingProgress: item.onboardingPercentage, primaryBranchName: null, moduleCodes: item.moduleCodes, lastActivityAt: item.updatedAt })),
      branches: branches.map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), timezone: String(row.timezone), status: String(row.status) })),
      currentBranchId: selectedBranchId,
      moduleCodes,
      onboarding: { status: String(onboarding.status) as OnboardingProjectStatus, progress: Number(onboarding.progress) },
      metrics: { employees, shifts, serviceTypes, qualityTemplates, products, warehouses, devices, inventoryMovements, pendingImports },
    };
  }

  async issueInvitation(organizationId: string, reason: string, platformUserId: string): Promise<{ invitationId: string; invitationUrl: string }> {
    if (reason.trim().length < 3) throw new Error("Escribe el motivo para emitir una nueva invitación.");
    const organization = await this.provider.first<{ contactEmail: string; status: OrganizationStatus }>("SELECT contact_email AS contactEmail, status FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL", [organizationId]);
    if (!organization) throw new Error("No se encontró la organización.");
    if (["suspended", "cancelled"].includes(organization.status)) throw new Error("La organización no está disponible para emitir invitaciones.");
    const role = await this.provider.first<{ id: string }>("SELECT id FROM organization_roles WHERE organization_id = ? AND code = 'owner' AND status = 'active'", [organizationId]);
    if (!role) throw new Error("La organización no tiene el rol propietario inicial.");
    const rateWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await this.provider.first<{ count: number }>("SELECT COUNT(*) AS count FROM organization_invitations WHERE organization_id = ? AND created_at >= ?", [organizationId, rateWindow]);
    if ((recent?.count ?? 0) >= 5) throw new Error("Se alcanzó el límite temporal de invitaciones. Espera antes de emitir otra.");
    const token = randomToken();
    const tokenHash = await sha256(token);
    const invitationId = crypto.randomUUID();
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE organization_invitations SET status = 'replaced', revoked_at = ?, version = version + 1 WHERE organization_id = ? AND status = 'pending'`, values: [timestamp, organizationId] },
      { sql: `INSERT INTO organization_invitations (id, organization_id, email_normalized, intended_role_id, intended_scope_json, token_hash, status, expires_at, created_by_platform_user_id, created_at, last_sent_at, send_count, version) VALUES (?, ?, ?, ?, '{"type":"organization"}', ?, 'pending', ?, ?, ?, ?, 1, 1)`, values: [invitationId, organizationId, normalizeEmail(organization.contactEmail), role.id, tokenHash, addDays(7), platformUserId, timestamp, timestamp] },
      platformAudit(platformUserId, "tenancy.invitation.issued", "organization_invitation", invitationId, reason, { organizationId }),
      organizationAudit(organizationId, "platform_user", platformUserId, "invitation.issued", "organization_invitation", invitationId, reason),
    ]);
    return { invitationId, invitationUrl: `/aceptar-invitacion?token=${encodeURIComponent(token)}` };
  }

  async revokeInvitation(organizationId: string, invitationId: string, reason: string, platformUserId: string): Promise<void> {
    if (reason.trim().length < 3) throw new Error("Escribe el motivo de la revocación.");
    const invitation = await this.provider.first<{ status: string }>("SELECT status FROM organization_invitations WHERE id = ? AND organization_id = ?", [invitationId, organizationId]);
    if (!invitation) throw new Error("No se encontró la invitación.");
    if (invitation.status !== "pending") throw new Error("Solamente puede revocarse una invitación pendiente.");
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE organization_invitations SET status = 'revoked', revoked_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'pending'`, values: [timestamp, invitationId, organizationId] },
      platformAudit(platformUserId, "tenancy.invitation.revoked", "organization_invitation", invitationId, reason, { organizationId }),
      organizationAudit(organizationId, "platform_user", platformUserId, "invitation.revoked", "organization_invitation", invitationId, reason),
    ]);
  }

  async createFeatureOverride(organizationId: string, input: { targetType: "module" | "feature_limit"; code: string; enabled?: boolean; overrideLimit?: number; effectiveUntil: string; reason: string }, platformUserId: string): Promise<void> {
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Explica el motivo del override temporal.");
    const until = new Date(input.effectiveUntil);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) throw new Error("La vigencia del override debe terminar en una fecha futura.");
    const organization = await this.provider.first<{ id: string }>("SELECT id FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL", [organizationId]);
    if (!organization) throw new Error("No se encontró la organización.");
    const timestamp = nowIso();
    const overrideId = crypto.randomUUID();
    let code: string;
    let before: unknown;
    let revokeSql: string;
    let revokeValues: unknown[];
    let moduleCode: string | null = null;
    let featureCode: string | null = null;
    let enabled: number | null = null;
    let overrideLimit: number | null = null;
    if (input.targetType === "module") {
      code = normalizeCode(input.code);
      const entitlement = await this.provider.first<Record<string, unknown>>("SELECT enabled, status FROM organization_entitlements WHERE organization_id = ? AND module_code = ?", [organizationId, code]);
      if (!entitlement) throw new Error("El módulo no forma parte del alcance contractual de la organización.");
      if (typeof input.enabled !== "boolean") throw new Error("Indica si el módulo quedará habilitado o deshabilitado.");
      if (code === "CORE" && !input.enabled) throw new Error("CORE no puede deshabilitarse mediante un override.");
      moduleCode = code;
      enabled = input.enabled ? 1 : 0;
      before = { contractual: bool(entitlement.enabled), status: String(entitlement.status) };
      revokeSql = "UPDATE organization_feature_overrides SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE organization_id = ? AND target_type = 'module' AND module_code = ? AND status = 'active'";
      revokeValues = [timestamp, platformUserId, organizationId, code];
    } else {
      code = input.code.trim();
      const limit = await this.provider.first<Record<string, unknown>>("SELECT hard_limit AS hardLimit, included_quantity AS includedQuantity FROM organization_feature_limits WHERE organization_id = ? AND feature_code = ?", [organizationId, code]);
      if (!limit) throw new Error("El límite no forma parte del alcance contractual de la organización.");
      if (!Number.isInteger(input.overrideLimit) || (input.overrideLimit ?? -1) < 0) throw new Error("El límite temporal debe ser un entero igual o mayor que cero.");
      featureCode = code;
      overrideLimit = input.overrideLimit ?? null;
      before = { hardLimit: limit.hardLimit === null ? null : Number(limit.hardLimit), includedQuantity: Number(limit.includedQuantity) };
      revokeSql = "UPDATE organization_feature_overrides SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE organization_id = ? AND target_type = 'feature_limit' AND feature_code = ? AND status = 'active'";
      revokeValues = [timestamp, platformUserId, organizationId, code];
    }
    const after = { targetType: input.targetType, code, enabled: enabled === null ? null : enabled === 1, overrideLimit, effectiveUntil: until.toISOString() };
    await this.provider.batch([
      { sql: revokeSql, values: revokeValues },
      { sql: `INSERT INTO organization_feature_overrides (id, organization_id, target_type, module_code, feature_code, enabled, override_limit, effective_from, effective_until, reason, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`, values: [overrideId, organizationId, input.targetType, moduleCode, featureCode, enabled, overrideLimit, timestamp, until.toISOString(), reason, timestamp, platformUserId] },
      { sql: `INSERT INTO entitlement_history (id, organization_id, action, before_json, after_json, reason, actor_id, created_at) VALUES (?, ?, 'temporary_override_created', ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), organizationId, JSON.stringify(before), JSON.stringify(after), reason, platformUserId, timestamp] },
      platformAudit(platformUserId, "tenancy.entitlement.override.created", "organization_feature_override", overrideId, reason, { organizationId, ...after }),
      organizationAudit(organizationId, "platform_user", platformUserId, "entitlement.override.created", "organization_feature_override", overrideId, reason, after),
    ]);
  }

  async setOrganizationSuspension(organizationId: string, version: number, suspended: boolean, reason: string, platformUserId: string): Promise<void> {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5) throw new Error("Escribe el motivo del cambio de disponibilidad.");
    const organization = await this.provider.first<{ status: OrganizationStatus; onboardingStatus: OnboardingProjectStatus; version: number }>("SELECT status, onboarding_status AS onboardingStatus, version FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL", [organizationId]);
    if (!organization) throw new Error("No se encontró la organización.");
    if ((suspended && organization.status === "suspended") || (!suspended && organization.status !== "suspended")) return;
    if (organization.version !== version) throw new Error("La organización cambió en otra sesión. Recarga antes de continuar.");
    if (organization.status === "cancelled") throw new Error("Una organización cancelada no puede cambiar de disponibilidad.");
    const subscription = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM customer_subscriptions WHERE organization_id = ?", [organizationId]);
    if (!subscription) throw new Error("No se encontró la suscripción manual de la organización.");
    const timestamp = nowIso();
    const nextOrganizationStatus: OrganizationStatus = suspended ? "suspended" : organization.onboardingStatus === "activated" ? "active" : organization.onboardingStatus === "ready_for_review" ? "ready_for_review" : "onboarding";
    const nextSubscriptionStatus = suspended ? "suspended" : nextOrganizationStatus === "active" ? "active_manual" : "pending_activation";
    await this.provider.batch([
      { sql: `UPDATE tenant_organizations SET status = ?, suspended_at = ?, suspension_reason = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`, values: [nextOrganizationStatus, suspended ? timestamp : null, suspended ? normalizedReason : null, timestamp, organizationId, version] },
      { sql: `UPDATE customer_subscriptions SET status = ?, updated_at = ? WHERE id = ?`, values: [nextSubscriptionStatus, timestamp, subscription.id] },
      { sql: `INSERT INTO subscription_status_history (id, organization_id, subscription_id, from_status, to_status, reason, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), organizationId, subscription.id, subscription.status, nextSubscriptionStatus, normalizedReason, platformUserId, timestamp] },
      platformAudit(platformUserId, suspended ? "tenancy.organization.suspended" : "tenancy.organization.reactivated", "tenant_organization", organizationId, normalizedReason, { fromStatus: organization.status, toStatus: nextOrganizationStatus }),
      organizationAudit(organizationId, "platform_user", platformUserId, suspended ? "organization.suspended" : "organization.reactivated", "organization", organizationId, normalizedReason, { fromStatus: organization.status, toStatus: nextOrganizationStatus }),
    ]);
  }

  async invitation(token: string): Promise<InvitationPreview | null> {
    if (token.length < 40) return null;
    const tokenHash = await sha256(token);
    const row = await this.provider.first<Record<string, unknown>>(`SELECT i.id AS invitationId, o.commercial_name AS organizationName, r.name AS roleName, i.email_normalized AS email, i.expires_at AS expiresAt, i.status FROM organization_invitations i JOIN tenant_organizations o ON o.id = i.organization_id JOIN organization_roles r ON r.id = i.intended_role_id WHERE i.token_hash = ? LIMIT 1`, [tokenHash]);
    if (!row) return null;
    let status = String(row.status) as InvitationStatus;
    if (status === "pending" && String(row.expiresAt) <= nowIso()) status = "expired";
    return { invitationId: String(row.invitationId), organizationName: String(row.organizationName), roleName: String(row.roleName), email: String(row.email), expiresAt: String(row.expiresAt), status };
  }

  async acceptInvitation(token: string, identity: CustomerIdentity): Promise<{ organizationId: string }> {
    const tokenHash = await sha256(token);
    const invitation = await this.provider.first<{ id: string; organizationId: string; email: string; roleId: string; status: string; expiresAt: string; organizationStatus: OrganizationStatus }>(`SELECT i.id, i.organization_id AS organizationId, i.email_normalized AS email, i.intended_role_id AS roleId, i.status, i.expires_at AS expiresAt, o.status AS organizationStatus FROM organization_invitations i JOIN tenant_organizations o ON o.id = i.organization_id AND o.deleted_at IS NULL WHERE i.token_hash = ? LIMIT 1`, [tokenHash]);
    if (!invitation) throw new Error("La invitación no existe o ya fue reemplazada.");
    if (["suspended", "cancelled"].includes(invitation.organizationStatus)) throw new Error("La organización no está disponible. Contacta a KitchenMind.");
    if (invitation.status === "accepted") {
      const existing = await this.provider.first<{ organizationId: string }>(`SELECT m.organization_id AS organizationId FROM organization_memberships m JOIN customer_users u ON u.id = m.user_id WHERE m.organization_id = ? AND u.auth_user_id = ? AND m.status = 'active'`, [invitation.organizationId, identity.authUserId]);
      if (existing) return existing;
      throw new Error("La invitación ya fue utilizada por otra identidad.");
    }
    if (invitation.status !== "pending") throw new Error("La invitación ya no está disponible.");
    if (invitation.expiresAt <= nowIso()) throw new Error("La invitación venció. Solicita una nueva a KitchenMind.");
    if (normalizeEmail(identity.email) !== invitation.email) throw new Error("Inicia sesión con el correo al que se dirigió la invitación.");
    const emailOwner = await this.provider.first<{ authUserId: string }>("SELECT auth_user_id AS authUserId FROM customer_users WHERE email = ?", [invitation.email]);
    if (emailOwner && emailOwner.authUserId !== identity.authUserId) throw new Error("Ese correo ya está vinculado a otra identidad. Contacta a KitchenMind.");
    const existingUser = await this.provider.first<{ id: string }>("SELECT id FROM customer_users WHERE auth_user_id = ?", [identity.authUserId]);
    const userId = existingUser?.id ?? crypto.randomUUID();
    const existingMembership = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM organization_memberships WHERE organization_id = ? AND user_id = ?", [invitation.organizationId, userId]);
    const onboardingProject = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM onboarding_projects WHERE organization_id = ?", [invitation.organizationId]);
    if (!onboardingProject) throw new Error("No se encontró el onboarding de la organización.");
    const membershipId = existingMembership?.id ?? crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    if (!existingUser) commands.push({ sql: `INSERT INTO customer_users (id, auth_user_id, email, display_name, status, created_at, updated_at, last_access_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`, values: [userId, identity.authUserId, invitation.email, identity.displayName, timestamp, timestamp, timestamp] });
    else commands.push({ sql: `UPDATE customer_users SET email = ?, display_name = ?, status = 'active', updated_at = ?, last_access_at = ? WHERE id = ?`, values: [invitation.email, identity.displayName, timestamp, timestamp, userId] });
    if (!existingMembership) commands.push({ sql: `INSERT INTO organization_memberships (id, organization_id, user_id, status, display_name, joined_at, invited_by, created_at, updated_at, version) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, 1)`, values: [membershipId, invitation.organizationId, userId, identity.displayName, timestamp, invitation.id, timestamp, timestamp] });
    else commands.push({ sql: `UPDATE organization_memberships SET status = 'active', display_name = ?, joined_at = COALESCE(joined_at, ?), updated_at = ?, version = version + 1, revoked_at = NULL WHERE id = ?`, values: [identity.displayName, timestamp, timestamp, membershipId] });
    commands.push({ sql: "INSERT OR IGNORE INTO membership_role_assignments (membership_id, role_id) VALUES (?, ?)", values: [membershipId, invitation.roleId] });
    commands.push({ sql: "INSERT OR IGNORE INTO membership_scopes (id, membership_id, scope_type, scope_id, access_mode) VALUES (?, ?, 'organization', NULL, 'manage')", values: [crypto.randomUUID(), membershipId] });
    commands.push({ sql: `UPDATE organization_invitations SET status = 'accepted', accepted_at = ?, version = version + 1 WHERE id = ? AND status = 'pending'`, values: [timestamp, invitation.id] });
    commands.push({ sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code = 'first_admin'`, values: [timestamp, userId, timestamp, invitation.organizationId] });
    commands.push(onboardingAnswer(invitation.organizationId, "first_admin", "customer_user", userId, { invitationId: invitation.id, membershipId }, timestamp));
    commands.push({ sql: `UPDATE onboarding_projects SET status = 'in_progress', updated_at = ?, version = version + 1 WHERE organization_id = ? AND status = 'not_started'`, values: [timestamp, invitation.organizationId] });
    commands.push({ sql: `UPDATE tenant_organizations SET onboarding_status = 'in_progress', updated_at = ?, version = version + 1 WHERE id = ? AND onboarding_status = 'not_started'`, values: [timestamp, invitation.organizationId] });
    if (onboardingProject.status === "not_started") {
      commands.push({ sql: `INSERT INTO onboarding_status_history (id, organization_id, project_id, from_status, to_status, reason, actor_type, actor_id, created_at) VALUES (?, ?, ?, 'not_started', 'in_progress', 'El primer administrador aceptó su invitación.', 'customer_user', ?, ?)`, values: [crypto.randomUUID(), invitation.organizationId, onboardingProject.id, userId, timestamp] });
    }
    commands.push(organizationAudit(invitation.organizationId, "customer_user", userId, "invitation.accepted", "organization_invitation", invitation.id, "El administrador aceptó una invitación de uso único."));
    await this.provider.batch(commands);
    await this.recalculateOnboarding(invitation.organizationId);
    return { organizationId: invitation.organizationId };
  }

  private async membership(identity: CustomerIdentity, organizationId?: string, permission?: string): Promise<MembershipContext> {
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT m.id AS membershipId, m.organization_id AS organizationId, m.display_name AS displayName,
      o.status AS organizationStatus, o.version AS organizationVersion, r.name AS roleName, p.code AS permissionCode
      FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id
      LEFT JOIN membership_role_assignments mra ON mra.membership_id = m.id LEFT JOIN organization_roles r ON r.id = mra.role_id AND r.organization_id = m.organization_id AND r.status = 'active'
      LEFT JOIN organization_role_permissions rp ON rp.role_id = r.id LEFT JOIN organization_permissions p ON p.id = rp.permission_id
      WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' ${organizationId ? "AND m.organization_id = ?" : ""}
      ORDER BY m.joined_at LIMIT 500`, organizationId ? [identity.authUserId, normalizeEmail(identity.email), organizationId] : [identity.authUserId, normalizeEmail(identity.email)]);
    if (!rows.length) throw new Error("No existe una membresía activa para esta cuenta.");
    const selectedId = organizationId ?? String(rows[0].organizationId);
    const selected = rows.filter((row) => row.organizationId === selectedId);
    if (!selected.length) throw new Error("No existe una membresía activa para esta organización.");
    const organizationStatus = String(selected[0].organizationStatus) as OrganizationStatus;
    if (["suspended", "cancelled"].includes(organizationStatus)) throw new Error("La organización no está disponible. Contacta a KitchenMind.");
    const permissions = Array.from(new Set(selected.map((row) => row.permissionCode ? String(row.permissionCode) : "").filter(Boolean)));
    if (permission && !permissions.includes(permission)) throw new Error("No tienes permiso para realizar esta acción.");
    const scopes = await this.provider.all<{ type: string; id: string | null; accessMode: string }>("SELECT scope_type AS type, scope_id AS id, access_mode AS accessMode FROM membership_scopes WHERE membership_id = ?", [String(selected[0].membershipId)]);
    if (!scopes.length) throw new Error("La membresía no tiene un alcance autorizado.");
    await this.provider.run("UPDATE customer_users SET last_access_at = ?, updated_at = ? WHERE auth_user_id = ?", [nowIso(), nowIso(), identity.authUserId]);
    return {
      membershipId: String(selected[0].membershipId), organizationId: selectedId, organizationStatus,
      organizationVersion: Number(selected[0].organizationVersion), displayName: String(selected[0].displayName), permissions,
      roleNames: Array.from(new Set(selected.map((row) => row.roleName ? String(row.roleName) : "").filter(Boolean))), scopes,
    };
  }

  private assertScope(member: MembershipContext, scopeType: "organization" | "branch", scopeId: string, access: "read" | "write" = "write"): void {
    const acceptedModes = access === "read" ? ["manage", "write", "read"] : ["manage", "write"];
    const organizationWide = member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && acceptedModes.includes(scope.accessMode));
    if (organizationWide) return;
    const allowed = member.scopes.some((scope) => scope.type === scopeType && scope.id === scopeId && acceptedModes.includes(scope.accessMode));
    if (!allowed) throw new Error("Tu alcance no permite modificar ese recurso.");
  }

  private async hasModule(organizationId: string, moduleCode: string): Promise<boolean> {
    const override = await this.provider.first<{ enabled: unknown }>(`SELECT enabled FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'module' AND module_code = ? AND status = 'active' AND effective_from <= ? AND effective_until > ? ORDER BY created_at DESC LIMIT 1`, [organizationId, moduleCode, nowIso(), nowIso()]);
    if (override) return bool(override.enabled);
    const row = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM organization_entitlements WHERE organization_id = ? AND module_code = ? AND enabled = 1 AND status = 'active' AND (effective_until IS NULL OR effective_until > ?)`, [organizationId, moduleCode, nowIso()]);
    return (row?.count ?? 0) > 0;
  }

  private async effectiveModuleCodes(organizationId: string): Promise<string[]> {
    const timestamp = nowIso();
    const entitlements = await this.provider.all<{ moduleCode: string }>(`SELECT module_code AS moduleCode FROM organization_entitlements WHERE organization_id = ? AND module_code IS NOT NULL AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?) ORDER BY module_code`, [organizationId, timestamp, timestamp]);
    const overrides = await this.provider.all<{ moduleCode: string; enabled: unknown }>(`SELECT module_code AS moduleCode, enabled FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'module' AND module_code IS NOT NULL AND status = 'active' AND effective_from <= ? AND effective_until > ? ORDER BY created_at`, [organizationId, timestamp, timestamp]);
    const enabled = new Set(entitlements.map((item) => item.moduleCode));
    for (const override of overrides) {
      if (bool(override.enabled)) enabled.add(override.moduleCode);
      else enabled.delete(override.moduleCode);
    }
    return Array.from(enabled).sort();
  }

  async customerAccess(identity: CustomerIdentity): Promise<CustomerAccessSnapshot> {
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT
      o.id, o.code, o.commercial_name AS name, o.status, m.status AS membershipStatus,
      r.name AS roleName, COALESCE(op.status, 'not_started') AS onboardingStatus,
      COALESCE(op.completion_percentage, 0) AS onboardingProgress,
      (SELECT b.name FROM tenant_branches b WHERE b.organization_id = o.id AND b.status = 'active' ORDER BY b.created_at LIMIT 1) AS primaryBranchName,
      o.updated_at AS lastActivityAt
      FROM customer_users u
      JOIN organization_memberships m ON m.user_id = u.id
      JOIN tenant_organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
      LEFT JOIN membership_role_assignments mra ON mra.membership_id = m.id
      LEFT JOIN organization_roles r ON r.id = mra.role_id AND r.organization_id = o.id AND r.status = 'active'
      LEFT JOIN onboarding_projects op ON op.organization_id = o.id
      WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status IN ('active','suspended')
      ORDER BY o.commercial_name, r.name`, [identity.authUserId, normalizeEmail(identity.email)]);
    const organizations: CustomerOrganizationAccess[] = [];
    for (const row of rows) {
      const id = String(row.id);
      let organization = organizations.find((item) => item.id === id);
      if (!organization) {
        organization = {
          id,
          code: String(row.code),
          name: String(row.name),
          status: String(row.status) as OrganizationStatus,
          membershipStatus: String(row.membershipStatus) as MembershipStatus,
          roleNames: [],
          onboardingStatus: String(row.onboardingStatus) as OnboardingProjectStatus,
          onboardingProgress: Number(row.onboardingProgress),
          primaryBranchName: row.primaryBranchName ? String(row.primaryBranchName) : null,
          moduleCodes: await this.effectiveModuleCodes(id),
          lastActivityAt: String(row.lastActivityAt),
        };
        organizations.push(organization);
      }
      if (row.roleName && !organization.roleNames.includes(String(row.roleName))) organization.roleNames.push(String(row.roleName));
    }
    return { displayName: identity.displayName, organizations };
  }

  async customerWorkspace(identity: CustomerIdentity, organizationId?: string, branchId?: string): Promise<CustomerWorkspaceSnapshot> {
    const member = await this.membership(identity, organizationId, "organization.read");
    if (!(["active", "restricted"] as OrganizationStatus[]).includes(member.organizationStatus)) throw new Error("La organización continúa en onboarding y todavía no puede operar.");
    const organization = await this.provider.first<Record<string, unknown>>(`SELECT id, code, commercial_name AS commercialName, status, default_timezone AS timezone, updated_at AS lastUpdatedAt FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL`, [member.organizationId]);
    const onboarding = await this.provider.first<Record<string, unknown>>(`SELECT status, completion_percentage AS progress FROM onboarding_projects WHERE organization_id = ?`, [member.organizationId]);
    if (!organization || !onboarding) throw new Error("No se encontró el espacio de trabajo de la organización.");

    const allBranches = await this.provider.all<Record<string, unknown>>(`SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' ORDER BY name`, [member.organizationId]);
    const organizationWide = member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && ["manage", "write", "read"].includes(scope.accessMode));
    const allowedBranchIds = new Set(member.scopes.filter((scope) => scope.type === "branch" && scope.id && ["manage", "write", "read"].includes(scope.accessMode)).map((scope) => scope.id as string));
    const branchRows = organizationWide ? allBranches : allBranches.filter((branch) => allowedBranchIds.has(String(branch.id)));
    if (!branchRows.length) throw new Error("La membresía no tiene una sucursal autorizada.");
    const selectedBranchId = branchId ?? String(branchRows[0].id);
    if (!branchRows.some((branch) => String(branch.id) === selectedBranchId)) throw new Error("No se encontró la sucursal dentro de tu alcance autorizado.");
    const branchFilter = { sql: " AND branch_id = ?", values: [selectedBranchId] as unknown[] };
    const count = async (table: string, options: { active?: boolean; scoped?: boolean } = { active: true, scoped: true }) => {
      const active = options.active === false ? "" : " AND status = 'active'";
      const scope = options.scoped === false ? { sql: "", values: [] as unknown[] } : branchFilter;
      const row = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE organization_id = ?${active}${scope.sql}`, [member.organizationId, ...scope.values]);
      return row?.count ?? 0;
    };
    const [employees, shifts, serviceTypes, qualityTemplates, products, warehouses, devices, inventoryMovements, pendingImports] = await Promise.all([
      count("tenant_employees"), count("tenant_shifts"), count("tenant_service_types"), count("tenant_quality_templates"),
      count("tenant_products"), count("tenant_warehouses"), count("tenant_devices"), count("tenant_inventory_movements", { active: false, scoped: true }),
      organizationWide ? this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM import_batches WHERE organization_id = ? AND status IN ('pending','validating','processing')`, [member.organizationId]).then((row) => row?.count ?? 0) : Promise.resolve(0),
    ]);
    return {
      organization: { id: String(organization.id), code: String(organization.code), commercialName: String(organization.commercialName), status: String(organization.status) as OrganizationStatus, timezone: String(organization.timezone), lastUpdatedAt: String(organization.lastUpdatedAt) },
      membership: { id: member.membershipId, displayName: member.displayName, roleNames: member.roleNames, permissions: member.permissions },
      availableOrganizations: (await this.customerAccess(identity)).organizations.filter((item) => item.membershipStatus === "active" && !["suspended", "cancelled"].includes(item.status)),
      branches: branchRows.map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), timezone: String(row.timezone), status: String(row.status) })),
      currentBranchId: selectedBranchId,
      moduleCodes: await this.effectiveModuleCodes(member.organizationId),
      onboarding: { status: String(onboarding.status) as OnboardingProjectStatus, progress: Number(onboarding.progress) },
      metrics: { employees, shifts, serviceTypes, qualityTemplates, products, warehouses, devices, inventoryMovements, pendingImports },
    };
  }

  private async recalculateOnboarding(organizationId: string): Promise<void> {
    const sections = await this.provider.all<{ id: string }>("SELECT id FROM onboarding_sections WHERE organization_id = ?", [organizationId]);
    const commands: SqlCommand[] = [];
    for (const section of sections) {
      const counts = await this.provider.first<{ total: number; complete: number }>(`SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('completed','not_applicable') THEN 1 ELSE 0 END) AS complete FROM onboarding_tasks WHERE section_id = ?`, [section.id]);
      const total = counts?.total ?? 0;
      const complete = counts?.complete ?? 0;
      const percentage = total === 0 ? 100 : Math.round((complete / total) * 100);
      commands.push({ sql: `UPDATE onboarding_sections SET completion_percentage = ?, status = ? WHERE id = ?`, values: [percentage, percentage === 100 ? "completed" : percentage > 0 ? "in_progress" : "pending", section.id] });
    }
    const totals = await this.provider.first<{ total: number; complete: number }>(`SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('completed','not_applicable') THEN 1 ELSE 0 END) AS complete FROM onboarding_tasks WHERE organization_id = ? AND required = 1`, [organizationId]);
    const total = totals?.total ?? 0;
    const complete = totals?.complete ?? 0;
    const percentage = total === 0 ? 0 : Math.round((complete / total) * 100);
    commands.push({ sql: `UPDATE onboarding_projects SET completion_percentage = ?, updated_at = ?, version = version + 1 WHERE organization_id = ?`, values: [percentage, nowIso(), organizationId] });
    await this.provider.batch(commands);
  }

  async customerOnboarding(identity: CustomerIdentity, organizationId?: string): Promise<CustomerOnboardingSnapshot> {
    const member = await this.membership(identity, organizationId, "onboarding.read");
    this.assertScope(member, "organization", member.organizationId, "read");
    const availableOrganizations = await this.provider.all<{ id: string; name: string; status: OrganizationStatus }>(`SELECT o.id, o.commercial_name AS name, o.status FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' AND o.status NOT IN ('suspended','cancelled') ORDER BY o.commercial_name`, [identity.authUserId, normalizeEmail(identity.email)]);
    const organization = await this.provider.first<Record<string, unknown>>(`SELECT id, commercial_name AS commercialName, legal_name AS legalName, status, default_timezone AS timezone, locale, tax_id AS taxId, contact_email AS contactEmail, contact_phone AS contactPhone, version FROM tenant_organizations WHERE id = ? AND deleted_at IS NULL`, [member.organizationId]);
    const project = await this.provider.first<Record<string, unknown>>(`SELECT status, completion_percentage AS percentage FROM onboarding_projects WHERE organization_id = ?`, [member.organizationId]);
    if (!organization || !project) throw new Error("No se encontró el onboarding de la organización.");
    const branches = await this.provider.all<Record<string, unknown>>(`SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? ORDER BY name`, [member.organizationId]);
    const areas = await this.provider.all<Record<string, unknown>>(`SELECT id, branch_id AS branchId, code, name FROM tenant_areas WHERE organization_id = ? AND status = 'active' ORDER BY name`, [member.organizationId]);
    const warehouses = await this.provider.all<Record<string, unknown>>(`SELECT id, branch_id AS branchId, code, name FROM tenant_warehouses WHERE organization_id = ? AND status = 'active' ORDER BY name`, [member.organizationId]);
    const catalog = async (table: string) => this.provider.all<Record<string, unknown>>(`SELECT id, branch_id AS branchId, code, name FROM ${table} WHERE organization_id = ? AND status = 'active' ORDER BY name`, [member.organizationId]);
    const [shifts, serviceTypes, qualityTemplates, products, devices] = await Promise.all([catalog("tenant_shifts"), catalog("tenant_service_types"), catalog("tenant_quality_templates"), catalog("tenant_products"), catalog("tenant_devices")]);
    const imports = await this.provider.all<Record<string, unknown>>(`SELECT id, type, status, total_rows AS totalRows, valid_rows AS validRows, invalid_rows AS invalidRows, created_at AS createdAt FROM import_batches WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`, [member.organizationId]);
    return {
      organization: { id: String(organization.id), commercialName: String(organization.commercialName), legalName: organization.legalName ? String(organization.legalName) : null, status: String(organization.status) as OrganizationStatus, timezone: String(organization.timezone), locale: String(organization.locale), taxId: organization.taxId ? String(organization.taxId) : null, contactEmail: String(organization.contactEmail), contactPhone: String(organization.contactPhone), version: Number(organization.version) },
      membership: { id: member.membershipId, displayName: member.displayName, roleNames: member.roleNames, permissions: member.permissions },
      availableOrganizations,
      branches: branches.map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), timezone: String(row.timezone), status: String(row.status) })),
      areas: areas.map((row) => ({ id: String(row.id), branchId: String(row.branchId), code: String(row.code), name: String(row.name) })),
      warehouses: warehouses.map((row) => ({ id: String(row.id), branchId: String(row.branchId), code: String(row.code), name: String(row.name) })),
      shifts: shifts.map((row) => ({ id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name) })),
      serviceTypes: serviceTypes.map((row) => ({ id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name) })),
      qualityTemplates: qualityTemplates.map((row) => ({ id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name) })),
      products: products.map((row) => ({ id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name) })),
      devices: devices.map((row) => ({ id: String(row.id), branchId: row.branchId ? String(row.branchId) : null, code: String(row.code), name: String(row.name) })),
      sections: await this.sectionSummaries(member.organizationId), progress: Number(project.percentage), projectStatus: String(project.status) as OnboardingProjectStatus,
      imports: imports.map((row) => ({ id: String(row.id), type: String(row.type), status: String(row.status), totalRows: Number(row.totalRows), validRows: Number(row.validRows), invalidRows: Number(row.invalidRows), createdAt: String(row.createdAt) })),
    };
  }

  async updateProfile(identity: CustomerIdentity, organizationId: string, version: number, input: Record<string, unknown>): Promise<void> {
    const member = await this.membership(identity, organizationId, "organization.configure");
    this.assertScope(member, "organization", organizationId);
    if (member.organizationVersion !== version) throw new Error("La organización cambió en otra sesión. Recarga antes de guardar.");
    const commercialName = typeof input.commercialName === "string" ? input.commercialName.trim() : "";
    const legalName = typeof input.legalName === "string" ? input.legalName.trim() : "";
    const timezone = typeof input.timezone === "string" ? input.timezone.trim() : "";
    const locale = typeof input.locale === "string" ? input.locale.trim() : "es-MX";
    const taxId = typeof input.taxId === "string" ? input.taxId.trim() : "";
    const contactEmail = typeof input.contactEmail === "string" ? normalizeEmail(input.contactEmail) : "";
    const contactPhone = typeof input.contactPhone === "string" ? input.contactPhone.trim() : "";
    if (commercialName.length < 2 || !contactEmail.includes("@") || contactPhone.length < 7) throw new Error("Completa nombre, correo y teléfono válidos.");
    if (!timezone || timezone.length > 80) throw new Error("Selecciona una zona horaria válida.");
    try { new Intl.DateTimeFormat("es-MX", { timeZone: timezone }).format(new Date()); } catch { throw new Error("La zona horaria no es válida."); }
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE tenant_organizations SET commercial_name = ?, legal_name = ?, default_timezone = ?, locale = ?, tax_id = ?, contact_email = ?, contact_phone = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`, values: [commercialName, legalName || null, timezone, locale, taxId || null, contactEmail, contactPhone, timestamp, organizationId, version] },
      { sql: `UPDATE tenant_branches SET timezone = ?, updated_at = ?, version = version + 1 WHERE organization_id = ? AND code = 'PRINCIPAL' AND timezone = 'UTC'`, values: [timezone, timestamp, organizationId] },
      { sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code IN ('company_profile','company_timezone')`, values: [timestamp, member.membershipId, timestamp, organizationId] },
      onboardingAnswer(organizationId, "company_profile", "customer_membership", member.membershipId, { commercialName, legalName: legalName || null, locale, taxId: taxId || null, contactEmail, contactPhone }, timestamp),
      onboardingAnswer(organizationId, "company_timezone", "customer_membership", member.membershipId, { timezone }, timestamp),
      organizationAudit(organizationId, "customer_membership", member.membershipId, "organization.profile.updated", "organization", organizationId, "Configuración general confirmada durante onboarding.", { commercialName, timezone, locale }),
    ]);
    await this.recalculateOnboarding(organizationId);
  }

  private async effectiveLimit(organizationId: string, featureCode: string): Promise<number | null | undefined> {
    const timestamp = nowIso();
    const override = await this.provider.first<{ overrideLimit: number | null }>(`SELECT override_limit AS overrideLimit FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'feature_limit' AND feature_code = ? AND status = 'active' AND effective_from <= ? AND effective_until > ? ORDER BY created_at DESC LIMIT 1`, [organizationId, featureCode, timestamp, timestamp]);
    if (override) return override.overrideLimit;
    return (await this.provider.first<{ hardLimit: number | null }>("SELECT hard_limit AS hardLimit FROM organization_feature_limits WHERE organization_id = ? AND feature_code = ?", [organizationId, featureCode]))?.hardLimit;
  }

  private async assertLimit(organizationId: string, featureCode: string, current: number): Promise<void> {
    const hardLimit = await this.effectiveLimit(organizationId, featureCode);
    if (hardLimit !== null && hardLimit !== undefined && current >= hardLimit) throw new Error(`La organización alcanzó el límite contratado de ${featureCode}.`);
  }

  private async assertBranch(organizationId: string, branchId: string): Promise<void> {
    const row = await this.provider.first<{ id: string }>("SELECT id FROM tenant_branches WHERE id = ? AND organization_id = ? AND status = 'active'", [branchId, organizationId]);
    if (!row) throw new Error("No se encontró la sucursal dentro de tu organización.");
  }

  async createResource(identity: CustomerIdentity, organizationId: string, input: Record<string, unknown>): Promise<void> {
    const type = typeof input.type === "string" ? input.type : "";
    if (type === "inventory_opening") {
      const member = await this.membership(identity, organizationId, "inventory.configure");
      if (!(await this.hasModule(organizationId, "INVENTORY"))) throw new Error("El módulo INVENTORY no está contratado.");
      const branchId = typeof input.branchId === "string" ? input.branchId : "";
      const warehouseId = typeof input.warehouseId === "string" ? input.warehouseId : "";
      const productId = typeof input.productId === "string" ? input.productId : "";
      const quantityMinor = typeof input.quantityMinor === "number" && Number.isInteger(input.quantityMinor) ? input.quantityMinor : 0;
      const unit = typeof input.unit === "string" ? input.unit.trim() : "unidad";
      if (quantityMinor <= 0) throw new Error("La cantidad inicial debe ser mayor que cero.");
      await this.assertBranch(organizationId, branchId);
      this.assertScope(member, "branch", branchId);
      const linked = await this.provider.first<{ warehouseId: string; productId: string }>(`SELECT w.id AS warehouseId, p.id AS productId FROM tenant_warehouses w JOIN tenant_products p ON p.organization_id = w.organization_id WHERE w.id = ? AND p.id = ? AND w.organization_id = ? AND w.branch_id = ?`, [warehouseId, productId, organizationId, branchId]);
      if (!linked) throw new Error("El almacén o producto no pertenece a esta organización.");
      const entityId = crypto.randomUUID();
      const timestamp = nowIso();
      await this.provider.batch([
        { sql: `INSERT INTO tenant_inventory_movements (id, organization_id, branch_id, warehouse_id, product_id, movement_type, quantity_minor, unit, reason, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'opening', ?, ?, 'Inventario inicial de onboarding', ?, ?)`, values: [entityId, organizationId, branchId, warehouseId, productId, quantityMinor, unit, timestamp, member.membershipId] },
        { sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code = 'opening_stock'`, values: [timestamp, member.membershipId, timestamp, organizationId] },
        onboardingAnswer(organizationId, "opening_stock", "customer_membership", member.membershipId, { movementId: entityId, branchId, warehouseId, productId, quantityMinor, unit }, timestamp),
        organizationAudit(organizationId, "customer_membership", member.membershipId, "inventory.opening.created", "inventory_movement", entityId, "Saldo inicial registrado como movimiento trazable.", { quantityMinor, unit }),
      ]);
      await this.recalculateOnboarding(organizationId);
      return;
    }
    const definitions: Record<string, { permission: string; module: string | null; table: string; task: string; limit?: string }> = {
      branch: { permission: "branches.manage", module: null, table: "tenant_branches", task: "first_branch", limit: "branches" },
      area: { permission: "areas.manage", module: null, table: "tenant_areas", task: "areas" },
      warehouse: { permission: "warehouses.manage", module: "INVENTORY", table: "tenant_warehouses", task: "warehouses", limit: "warehouses" },
      shift: { permission: "shifts.manage", module: "PERSONNEL", table: "tenant_shifts", task: "shifts" },
      service_type: { permission: "services.configure", module: "SERVICES", table: "tenant_service_types", task: "service_types" },
      quality_template: { permission: "quality.configure", module: "QUALITY", table: "tenant_quality_templates", task: "quality_templates" },
      product: { permission: "inventory.configure", module: "INVENTORY", table: "tenant_products", task: "products" },
      device: { permission: "devices.manage", module: null, table: "tenant_devices", task: "devices", limit: "devices" },
    };
    const definition = definitions[type];
    if (!definition) throw new Error("El tipo de configuración no existe.");
    const member = await this.membership(identity, organizationId, definition.permission);
    if (definition.module && !(await this.hasModule(organizationId, definition.module))) throw new Error(`El módulo ${definition.module} no está contratado.`);
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const code = normalizeCode(typeof input.code === "string" ? input.code : name);
    if (name.length < 2) throw new Error("Escribe un nombre válido.");
    const branchId = typeof input.branchId === "string" ? input.branchId : null;
    if (type === "branch") {
      this.assertScope(member, "organization", organizationId);
    } else {
      if (!branchId) throw new Error("Selecciona una sucursal.");
      await this.assertBranch(organizationId, branchId);
      this.assertScope(member, "branch", branchId);
    }
    if (definition.limit) {
      const countRow = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM ${definition.table} WHERE organization_id = ? AND status = 'active'`, [organizationId]);
      await this.assertLimit(organizationId, definition.limit, countRow?.count ?? 0);
    }
    const timestamp = nowIso();
    const entityId = crypto.randomUUID();
    const commands: SqlCommand[] = [];
    if (type === "branch") {
      const timezone = typeof input.timezone === "string" && input.timezone.trim() ? input.timezone.trim() : "UTC";
      commands.push({ sql: `INSERT INTO tenant_branches (id, organization_id, code, name, address, timezone, status, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, 1)`, values: [entityId, organizationId, code, name, typeof input.address === "string" ? input.address.trim() : "", timezone, timestamp, timestamp, member.membershipId] });
    } else if (type === "area" || type === "warehouse") {
      commands.push({ sql: `INSERT INTO ${definition.table} (id, organization_id, branch_id, code, name, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`, values: [entityId, organizationId, branchId, code, name, timestamp, timestamp, member.membershipId] });
    } else {
      const metadata = typeof input.metadata === "object" && input.metadata !== null ? input.metadata : {};
      commands.push({ sql: `INSERT INTO ${definition.table} (id, organization_id, branch_id, code, name, status, metadata_json, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, values: [entityId, organizationId, branchId, code, name, JSON.stringify(metadata), timestamp, timestamp, member.membershipId] });
    }
    commands.push({ sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code = ?`, values: [timestamp, member.membershipId, timestamp, organizationId, definition.task] });
    commands.push(onboardingAnswer(organizationId, definition.task, "customer_membership", member.membershipId, { resourceType: type, entityId, code, name, branchId }, timestamp));
    if (definition.limit) commands.push({ sql: `UPDATE organization_feature_limits SET current_usage = current_usage + 1 WHERE organization_id = ? AND feature_code = ?`, values: [organizationId, definition.limit] });
    commands.push(organizationAudit(organizationId, "customer_membership", member.membershipId, `onboarding.${type}.created`, definition.table, entityId, "Configuración inicial creada durante onboarding.", { code, name, branchId }));
    await this.provider.batch(commands);
    await this.recalculateOnboarding(organizationId);
  }

  async importEmployees(identity: CustomerIdentity, organizationId: string, idempotencyKey: string, rows: unknown[]): Promise<{ batchId: string; validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> }> {
    const member = await this.membership(identity, organizationId, "employees.import");
    if (!(await this.hasModule(organizationId, "PERSONNEL"))) throw new Error("El módulo de Personal no está contratado.");
    if (!idempotencyKey || idempotencyKey.length < 10) throw new Error("Falta la clave idempotente de la importación.");
    if (!rows.length || rows.length > 500) throw new Error("La importación debe contener entre 1 y 500 filas.");
    const existing = await this.provider.first<{ id: string; validRows: number; invalidRows: number }>(`SELECT id, valid_rows AS validRows, invalid_rows AS invalidRows FROM import_batches WHERE organization_id = ? AND idempotency_key = ?`, [organizationId, idempotencyKey]);
    if (existing) return { batchId: existing.id, validRows: existing.validRows, invalidRows: existing.invalidRows, errors: [] };
    const branches = await this.provider.all<{ id: string; code: string }>("SELECT id, code FROM tenant_branches WHERE organization_id = ? AND status = 'active'", [organizationId]);
    const shifts = await this.provider.all<{ id: string; code: string }>("SELECT id, code FROM tenant_shifts WHERE organization_id = ? AND status = 'active'", [organizationId]);
    const branchMap = new Map(branches.map((row) => [row.code.toUpperCase(), row.id]));
    const shiftMap = new Map(shifts.map((row) => [row.code.toUpperCase(), row.id]));
    const existingNumbers = new Set((await this.provider.all<{ employeeNumber: string }>("SELECT employee_number AS employeeNumber FROM tenant_employees WHERE organization_id = ?", [organizationId])).map((row) => row.employeeNumber.toUpperCase()));
    const seen = new Set<string>();
    const parsed: Array<{ row: number; raw: Record<string, unknown>; employeeNumber: string; name: string; email: string | null; branchId: string | null; shiftId: string | null; messages: string[] }> = [];
    rows.forEach((value, index) => {
      const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const employeeNumber = String(raw.employeeNumber ?? raw.numeroEmpleado ?? "").trim();
      const name = String(raw.name ?? raw.nombre ?? "").trim();
      const branchCode = normalizeCode(String(raw.branchCode ?? raw.sucursal ?? "PRINCIPAL"));
      const shiftCodeRaw = String(raw.shiftCode ?? raw.turno ?? "").trim();
      const shiftCode = shiftCodeRaw ? normalizeCode(shiftCodeRaw) : null;
      const email = String(raw.email ?? raw.correo ?? "").trim().toLowerCase() || null;
      const messages: string[] = [];
      const normalizedNumber = employeeNumber.toUpperCase();
      if (!employeeNumber) messages.push("Falta el número de empleado.");
      if (name.length < 2) messages.push("Falta el nombre.");
      if (seen.has(normalizedNumber) || existingNumbers.has(normalizedNumber)) messages.push("Número de empleado duplicado.");
      if (!branchMap.has(branchCode)) messages.push(`La sucursal ${branchCode} no existe.`);
      if (shiftCode && !shiftMap.has(shiftCode)) messages.push(`El turno ${shiftCode} no existe.`);
      if (email && !email.includes("@")) messages.push("El correo no es válido.");
      if (employeeNumber) seen.add(normalizedNumber);
      parsed.push({ row: index + 2, raw, employeeNumber, name, email, branchId: branchMap.get(branchCode) ?? null, shiftId: shiftCode ? shiftMap.get(shiftCode) ?? null : null, messages });
    });
    const valid = parsed.filter((row) => row.messages.length === 0);
    for (const branchId of new Set(valid.map((row) => row.branchId).filter((value): value is string => Boolean(value)))) {
      this.assertScope(member, "branch", branchId);
    }
    const current = await this.provider.first<{ count: number }>("SELECT COUNT(*) AS count FROM tenant_employees WHERE organization_id = ? AND status = 'active'", [organizationId]);
    const hardLimit = await this.effectiveLimit(organizationId, "employees");
    if (hardLimit !== null && hardLimit !== undefined && (current?.count ?? 0) + valid.length > hardLimit) throw new Error("La importación excede el límite contratado de empleados.");
    const batchId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [{ sql: `INSERT INTO import_batches (id, organization_id, type, idempotency_key, status, total_rows, valid_rows, invalid_rows, created_by, created_at, completed_at) VALUES (?, ?, 'employees_csv', ?, 'completed', ?, ?, ?, ?, ?, ?)`, values: [batchId, organizationId, idempotencyKey, rows.length, valid.length, rows.length - valid.length, member.membershipId, timestamp, timestamp] }];
    for (const row of parsed) {
      const entityId = row.messages.length ? null : crypto.randomUUID();
      commands.push({ sql: `INSERT INTO import_rows (id, batch_id, row_number, status, raw_json, error_json, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), batchId, row.row, row.messages.length ? "invalid" : "imported", JSON.stringify(row.raw), row.messages.length ? JSON.stringify(row.messages) : null, entityId] });
      if (entityId && row.branchId) commands.push({ sql: `INSERT INTO tenant_employees (id, organization_id, branch_id, employee_number, name, email, shift_id, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`, values: [entityId, organizationId, row.branchId, row.employeeNumber, row.name, row.email, row.shiftId, timestamp, timestamp, member.membershipId] });
    }
    if (valid.length) {
      commands.push({ sql: `UPDATE organization_feature_limits SET current_usage = current_usage + ? WHERE organization_id = ? AND feature_code = 'employees'`, values: [valid.length, organizationId] });
      commands.push({ sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code = 'employees'`, values: [timestamp, member.membershipId, timestamp, organizationId] });
      commands.push(onboardingAnswer(organizationId, "employees", "customer_membership", member.membershipId, { batchId, totalRows: rows.length, validRows: valid.length, invalidRows: rows.length - valid.length }, timestamp));
    }
    commands.push(organizationAudit(organizationId, "customer_membership", member.membershipId, "employees.imported", "import_batch", batchId, "Importación validada de empleados.", { total: rows.length, valid: valid.length, invalid: rows.length - valid.length }));
    await this.provider.batch(commands);
    await this.recalculateOnboarding(organizationId);
    return { batchId, validRows: valid.length, invalidRows: rows.length - valid.length, errors: parsed.filter((row) => row.messages.length).map((row) => ({ row: row.row, messages: row.messages })) };
  }

  async importCatalog(identity: CustomerIdentity, organizationId: string, catalogType: string, idempotencyKey: string, rows: unknown[]): Promise<{ batchId: string; validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> }> {
    const definitions: Record<string, { permission: string; module: string; table: string; task: string; limit?: string; metadata: boolean }> = {
      warehouses: { permission: "warehouses.manage", module: "INVENTORY", table: "tenant_warehouses", task: "warehouses", limit: "warehouses", metadata: false },
      products: { permission: "inventory.configure", module: "INVENTORY", table: "tenant_products", task: "products", metadata: true },
      shifts: { permission: "shifts.manage", module: "PERSONNEL", table: "tenant_shifts", task: "shifts", metadata: true },
      service_types: { permission: "services.configure", module: "SERVICES", table: "tenant_service_types", task: "service_types", metadata: true },
      quality_templates: { permission: "quality.configure", module: "QUALITY", table: "tenant_quality_templates", task: "quality_templates", metadata: true },
    };
    const definition = definitions[catalogType];
    if (!definition) throw new Error("El catálogo solicitado no admite importación.");
    const member = await this.membership(identity, organizationId, definition.permission);
    if (!(await this.hasModule(organizationId, definition.module))) throw new Error(`El módulo ${definition.module} no está contratado.`);
    if (!idempotencyKey || idempotencyKey.length < 10) throw new Error("Falta la clave idempotente de la importación.");
    if (!rows.length || rows.length > 500) throw new Error("La importación debe contener entre 1 y 500 filas.");
    const existingBatch = await this.provider.first<{ id: string; validRows: number; invalidRows: number }>(`SELECT id, valid_rows AS validRows, invalid_rows AS invalidRows FROM import_batches WHERE organization_id = ? AND idempotency_key = ?`, [organizationId, idempotencyKey]);
    if (existingBatch) return { batchId: existingBatch.id, validRows: existingBatch.validRows, invalidRows: existingBatch.invalidRows, errors: [] };
    const branches = await this.provider.all<{ id: string; code: string }>("SELECT id, code FROM tenant_branches WHERE organization_id = ? AND status = 'active'", [organizationId]);
    const branchMap = new Map(branches.map((row) => [row.code.toUpperCase(), row.id]));
    const existingCodes = new Set((await this.provider.all<{ code: string }>(`SELECT code FROM ${definition.table} WHERE organization_id = ?`, [organizationId])).map((row) => row.code.toUpperCase()));
    const seen = new Set<string>();
    const parsed: Array<{ row: number; raw: Record<string, unknown>; code: string; name: string; branchId: string | null; metadata: Record<string, unknown>; messages: string[] }> = [];
    rows.forEach((value, index) => {
      const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const name = String(raw.name ?? raw.nombre ?? "").trim();
      const code = normalizeCode(String(raw.code ?? raw.codigo ?? name));
      const branchCode = normalizeCode(String(raw.branchCode ?? raw.sucursal ?? "PRINCIPAL"));
      const messages: string[] = [];
      if (name.length < 2) messages.push("Falta el nombre.");
      if (seen.has(code) || existingCodes.has(code)) messages.push("Código duplicado.");
      if (!branchMap.has(branchCode)) messages.push(`La sucursal ${branchCode} no existe.`);
      seen.add(code);
      const metadata = Object.fromEntries(Object.entries(raw).filter(([key]) => !["name", "nombre", "code", "codigo", "branchCode", "sucursal"].includes(key)));
      parsed.push({ row: index + 2, raw, code, name, branchId: branchMap.get(branchCode) ?? null, metadata, messages });
    });
    const valid = parsed.filter((row) => row.messages.length === 0);
    for (const branchId of new Set(valid.map((row) => row.branchId).filter((value): value is string => Boolean(value)))) this.assertScope(member, "branch", branchId);
    if (definition.limit) {
      const current = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM ${definition.table} WHERE organization_id = ? AND status = 'active'`, [organizationId]);
      const hardLimit = await this.effectiveLimit(organizationId, definition.limit);
      if (hardLimit !== null && hardLimit !== undefined && (current?.count ?? 0) + valid.length > hardLimit) throw new Error(`La importación excede el límite contratado de ${definition.limit}.`);
    }
    const batchId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [{ sql: `INSERT INTO import_batches (id, organization_id, type, idempotency_key, status, total_rows, valid_rows, invalid_rows, created_by, created_at, completed_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)`, values: [batchId, organizationId, `${catalogType}_csv`, idempotencyKey, rows.length, valid.length, rows.length - valid.length, member.membershipId, timestamp, timestamp] }];
    for (const row of parsed) {
      const entityId = row.messages.length ? null : crypto.randomUUID();
      commands.push({ sql: `INSERT INTO import_rows (id, batch_id, row_number, status, raw_json, error_json, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, values: [crypto.randomUUID(), batchId, row.row, row.messages.length ? "invalid" : "imported", JSON.stringify(row.raw), row.messages.length ? JSON.stringify(row.messages) : null, entityId] });
      if (entityId && row.branchId) {
        if (definition.metadata) commands.push({ sql: `INSERT INTO ${definition.table} (id, organization_id, branch_id, code, name, status, metadata_json, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, values: [entityId, organizationId, row.branchId, row.code, row.name, JSON.stringify(row.metadata), timestamp, timestamp, member.membershipId] });
        else commands.push({ sql: `INSERT INTO ${definition.table} (id, organization_id, branch_id, code, name, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`, values: [entityId, organizationId, row.branchId, row.code, row.name, timestamp, timestamp, member.membershipId] });
      }
    }
    if (valid.length) {
      commands.push({ sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code = ?`, values: [timestamp, member.membershipId, timestamp, organizationId, definition.task] });
      commands.push(onboardingAnswer(organizationId, definition.task, "customer_membership", member.membershipId, { batchId, catalogType, totalRows: rows.length, validRows: valid.length, invalidRows: rows.length - valid.length }, timestamp));
      if (definition.limit) commands.push({ sql: `UPDATE organization_feature_limits SET current_usage = current_usage + ? WHERE organization_id = ? AND feature_code = ?`, values: [valid.length, organizationId, definition.limit] });
    }
    commands.push(organizationAudit(organizationId, "customer_membership", member.membershipId, "catalog.imported", "import_batch", batchId, `Importación validada del catálogo ${catalogType}.`, { catalogType, total: rows.length, valid: valid.length, invalid: rows.length - valid.length }));
    await this.provider.batch(commands);
    await this.recalculateOnboarding(organizationId);
    return { batchId, validRows: valid.length, invalidRows: rows.length - valid.length, errors: parsed.filter((row) => row.messages.length).map((row) => ({ row: row.row, messages: row.messages })) };
  }

  async updateTask(identity: CustomerIdentity, organizationId: string, taskId: string, status: string, reason?: string): Promise<void> {
    const member = await this.membership(identity, organizationId, "onboarding.complete");
    this.assertScope(member, "organization", organizationId);
    if (!["pending", "in_progress", "completed", "blocked"].includes(status)) throw new Error("El estado de la tarea no es válido.");
    if (status === "blocked" && (!reason || reason.trim().length < 3)) throw new Error("Explica por qué la tarea está bloqueada.");
    const task = await this.provider.first<{ code: string }>("SELECT code FROM onboarding_tasks WHERE id = ? AND organization_id = ?", [taskId, organizationId]);
    if (!task) throw new Error("No se encontró la tarea en tu organización.");
    if (task.code === "final_review") throw new Error("Usa la acción Solicitar revisión para completar esta tarea.");
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE onboarding_tasks SET status = ?, blocked_reason = ?, completed_at = ?, completed_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?`, values: [status, status === "blocked" ? reason : null, status === "completed" ? timestamp : null, status === "completed" ? member.membershipId : null, timestamp, taskId, organizationId] },
      onboardingAnswer(organizationId, task.code, "customer_membership", member.membershipId, { status, reason: reason ?? null }, timestamp),
      organizationAudit(organizationId, "customer_membership", member.membershipId, "onboarding.task.updated", "onboarding_task", taskId, reason ?? "Estado actualizado durante onboarding.", { status }),
    ]);
    await this.recalculateOnboarding(organizationId);
  }

  async requestReview(identity: CustomerIdentity, organizationId: string): Promise<void> {
    const member = await this.membership(identity, organizationId, "organization.request_activation");
    this.assertScope(member, "organization", organizationId);
    const project = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM onboarding_projects WHERE organization_id = ?", [organizationId]);
    if (!project) throw new Error("No se encontró el onboarding de la organización.");
    if (project.status === "ready_for_review" || project.status === "activated") return;
    if (!["not_started", "in_progress", "changes_requested"].includes(project.status)) throw new Error("El onboarding no puede enviarse a revisión desde su estado actual.");
    const pending = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM onboarding_dependencies d JOIN onboarding_tasks target ON target.id = d.task_id JOIN onboarding_tasks dependency ON dependency.id = d.depends_on_task_id WHERE d.organization_id = ? AND target.code = 'final_review' AND dependency.status NOT IN ('completed','not_applicable')`, [organizationId]);
    if ((pending?.count ?? 0) > 0) throw new Error(`Completa ${pending?.count ?? 0} tareas obligatorias antes de solicitar revisión.`);
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = ? WHERE organization_id = ? AND code = 'final_review'`, values: [timestamp, member.membershipId, timestamp, organizationId] },
      onboardingAnswer(organizationId, "final_review", "customer_membership", member.membershipId, { requestedAt: timestamp }, timestamp),
      { sql: `UPDATE onboarding_projects SET status = 'ready_for_review', updated_at = ?, version = version + 1 WHERE organization_id = ?`, values: [timestamp, organizationId] },
      { sql: `UPDATE tenant_organizations SET status = 'ready_for_review', onboarding_status = 'ready_for_review', updated_at = ?, version = version + 1 WHERE id = ?`, values: [timestamp, organizationId] },
      { sql: `INSERT INTO onboarding_status_history (id, organization_id, project_id, from_status, to_status, reason, actor_type, actor_id, created_at) VALUES (?, ?, ?, ?, 'ready_for_review', 'El cliente completó las tareas obligatorias y solicitó revisión.', 'customer_membership', ?, ?)`, values: [crypto.randomUUID(), organizationId, project.id, project.status, member.membershipId, timestamp] },
      organizationAudit(organizationId, "customer_membership", member.membershipId, "onboarding.review.requested", "onboarding_project", organizationId, "El cliente completó las tareas obligatorias y solicitó revisión."),
    ]);
    await this.recalculateOnboarding(organizationId);
  }

  async evaluateActivation(organizationId: string, platformUserId: string): Promise<OrganizationDetail> {
    const organization = await this.organization(organizationId);
    if (!organization) throw new Error("No se encontró la organización.");
    const count = async (sql: string, values: unknown[] = [organizationId]) => (await this.provider.first<{ count: number }>(sql, values))?.count ?? 0;
    const moduleCodes = new Set(organization.entitlements.filter((item) => item.enabled && item.moduleCode).map((item) => item.moduleCode as string));
    const requiredPending = await count(`SELECT COUNT(*) AS count FROM onboarding_tasks WHERE organization_id = ? AND required = 1 AND status NOT IN ('completed','not_applicable')`);
    const activeAdmins = await count(`SELECT COUNT(*) AS count FROM organization_memberships m JOIN membership_role_assignments mra ON mra.membership_id = m.id JOIN organization_roles r ON r.id = mra.role_id WHERE m.organization_id = ? AND m.status = 'active' AND r.code IN ('owner','administrator')`);
    const checks: Array<{ code: string; label: string; passed: boolean; detail: string; critical: boolean }> = [
      { code: "core_entitlement", label: "Núcleo contratado", passed: moduleCodes.has("CORE"), detail: moduleCodes.has("CORE") ? "CORE está activo." : "Falta el entitlement CORE.", critical: true },
      { code: "timezone", label: "Zona horaria", passed: organization.defaultTimezone !== "UTC", detail: organization.defaultTimezone !== "UTC" ? `Configurada como ${organization.defaultTimezone}.` : "Confirma una zona horaria local; UTC permanece como valor provisional.", critical: true },
      { code: "branch", label: "Sucursal operativa", passed: organization.branchCount > 0, detail: `${organization.branchCount} sucursal(es) activa(s).`, critical: true },
      { code: "administrator", label: "Administrador activo", passed: activeAdmins > 0, detail: activeAdmins > 0 ? "Existe un administrador con membresía activa." : "La invitación del administrador sigue pendiente.", critical: true },
      { code: "required_tasks", label: "Tareas obligatorias", passed: requiredPending === 0, detail: requiredPending === 0 ? "Todas las tareas obligatorias están completas." : `${requiredPending} tarea(s) obligatoria(s) pendiente(s).`, critical: true },
      { code: "subscription", label: "Suscripción manual", passed: Boolean(organization.subscription), detail: organization.subscription ? "El snapshot comercial está asociado a la suscripción." : "Falta el registro inicial de suscripción.", critical: true },
    ];
    if (moduleCodes.has("PERSONNEL")) {
      const shifts = await count("SELECT COUNT(*) AS count FROM tenant_shifts WHERE organization_id = ? AND status = 'active'");
      const employees = await count("SELECT COUNT(*) AS count FROM tenant_employees WHERE organization_id = ? AND status = 'active'");
      checks.push({ code: "personnel", label: "Personal", passed: shifts > 0 && employees > 0, detail: `${shifts} turno(s) y ${employees} empleado(s).`, critical: true });
    }
    if (moduleCodes.has("SERVICES")) {
      const services = await count("SELECT COUNT(*) AS count FROM tenant_service_types WHERE organization_id = ? AND status = 'active'");
      checks.push({ code: "services", label: "Servicios", passed: services > 0, detail: `${services} tipo(s) de servicio configurado(s).`, critical: true });
    }
    if (moduleCodes.has("QUALITY")) {
      const templates = await count("SELECT COUNT(*) AS count FROM tenant_quality_templates WHERE organization_id = ? AND status = 'active'");
      checks.push({ code: "quality", label: "Calidad", passed: templates > 0, detail: `${templates} plantilla(s) de calidad configurada(s).`, critical: true });
    }
    if (moduleCodes.has("INVENTORY")) {
      const warehouses = await count("SELECT COUNT(*) AS count FROM tenant_warehouses WHERE organization_id = ? AND status = 'active'");
      const products = await count("SELECT COUNT(*) AS count FROM tenant_products WHERE organization_id = ? AND status = 'active'");
      const movements = await count("SELECT COUNT(*) AS count FROM tenant_inventory_movements WHERE organization_id = ? AND movement_type = 'opening'");
      checks.push({ code: "inventory", label: "Inventario", passed: warehouses > 0 && products > 0 && movements > 0, detail: `${warehouses} almacén(es), ${products} producto(s), ${movements} movimiento(s) inicial(es).`, critical: true });
    }
    const deviceLimit = organization.limits.find((item) => item.featureCode === "devices")?.includedQuantity ?? 0;
    if (deviceLimit > 0) {
      const devices = await count("SELECT COUNT(*) AS count FROM tenant_devices WHERE organization_id = ? AND status = 'active'");
      checks.push({ code: "devices", label: "Dispositivos", passed: devices > 0, detail: `${devices} de ${deviceLimit} dispositivo(s) contratado(s) registrado(s).`, critical: true });
    }
    const timestamp = nowIso();
    const commands = checks.map<SqlCommand>((check) => ({
      sql: `INSERT INTO activation_checks (id, organization_id, code, label, status, detail, critical, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(organization_id, code) DO UPDATE SET label = excluded.label, status = excluded.status, detail = excluded.detail, critical = excluded.critical, checked_at = excluded.checked_at`,
      values: [crypto.randomUUID(), organizationId, check.code, check.label, check.passed ? "passed" : "failed", check.detail, check.critical ? 1 : 0, timestamp],
    }));
    commands.push(platformAudit(platformUserId, "tenancy.activation.evaluated", "tenant_organization", organizationId, "Lista de preparación recalculada.", { failed: checks.filter((check) => !check.passed).map((check) => check.code) }));
    await this.provider.batch(commands);
    const refreshed = await this.organization(organizationId);
    if (!refreshed) throw new Error("No fue posible recuperar la organización evaluada.");
    return refreshed;
  }

  async activate(organizationId: string, version: number, platformUserId: string): Promise<void> {
    const evaluated = await this.evaluateActivation(organizationId, platformUserId);
    if (evaluated.status === "active") return;
    if (evaluated.status !== "ready_for_review") throw new Error("La organización todavía no fue enviada a revisión.");
    if (evaluated.version !== version) throw new Error("La organización cambió en otra sesión. Recarga antes de activar.");
    const failed = evaluated.activationChecks.filter((check) => check.critical && check.status !== "passed");
    if (failed.length) throw new Error(`No puede activarse: ${failed.map((check) => check.label).join(", ")}.`);
    const project = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM onboarding_projects WHERE organization_id = ?", [organizationId]);
    const subscription = await this.provider.first<{ id: string; status: string }>("SELECT id, status FROM customer_subscriptions WHERE organization_id = ?", [organizationId]);
    if (!project || !subscription) throw new Error("Falta el proyecto de onboarding o la suscripción inicial.");
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `UPDATE tenant_organizations SET status = 'active', onboarding_status = 'activated', activated_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'ready_for_review'`, values: [timestamp, timestamp, organizationId, version] },
      { sql: `UPDATE onboarding_projects SET status = 'activated', completion_percentage = 100, activated_at = ?, updated_at = ?, version = version + 1 WHERE organization_id = ?`, values: [timestamp, timestamp, organizationId] },
      { sql: `UPDATE customer_subscriptions SET status = 'active_manual', starts_at = COALESCE(starts_at, ?), updated_at = ? WHERE organization_id = ? AND status = 'pending_activation'`, values: [timestamp, timestamp, organizationId] },
      { sql: `INSERT INTO onboarding_status_history (id, organization_id, project_id, from_status, to_status, reason, actor_type, actor_id, created_at) VALUES (?, ?, ?, ?, 'activated', 'La fundadora aprobó la lista crítica de preparación.', 'platform_user', ?, ?)`, values: [crypto.randomUUID(), organizationId, project.id, project.status, platformUserId, timestamp] },
      { sql: `INSERT INTO subscription_status_history (id, organization_id, subscription_id, from_status, to_status, reason, actor_id, created_at) VALUES (?, ?, ?, ?, 'active_manual', 'Organización activada con suscripción manual; no implica pago cobrado.', ?, ?)`, values: [crypto.randomUUID(), organizationId, subscription.id, subscription.status, platformUserId, timestamp] },
      platformAudit(platformUserId, "tenancy.organization.activated", "tenant_organization", organizationId, "La lista crítica de preparación fue aprobada."),
      organizationAudit(organizationId, "platform_user", platformUserId, "organization.activated", "organization", organizationId, "Activación controlada tras superar todas las verificaciones."),
    ]);
  }
}
