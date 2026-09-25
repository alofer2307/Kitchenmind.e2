import type { SqlCommand } from "./commercial.contracts";
import type {
  QualityAnswerInput,
  QualityDataProvider,
  QualityDraftUpdateInput,
  QualityEvidenceAuthorization,
  QualityLogScheduleInput,
  QualityScheduleRuleInput,
  TenantQualityRepository,
  QualityTemplateInput,
} from "./quality.contracts";
import { evaluateQualityAnswer, localOperationalDate, normalizeQualityCode, qualityMilliToNumber, qualityNumberToMilli, validateQualityFieldDefinitions } from "@/rules/quality.rules";
import { expandQualitySchedule, qualityScheduleNextDate, validateQualityScheduleRule, zonedLocalToIso } from "@/rules/quality-schedule.rules";
import { periodStartForTimezone } from "@/rules/dashboard.rules";
import type {
  OrganizationStatus,
  QualityCorrectiveActionSummary,
  QualityEvidenceDownload,
  QualityEvidenceSummary,
  OperationalQualityFieldType,
  QualityLogAnswer,
  QualityLogSummary,
  QualitySnapshot,
  QualityTemplateCategory,
  OperationalQualityTemplateField,
  QualityTemplateRoot,
  QualityTemplateVersion,
  TenantActor,
} from "@/types";

const QUALITY_PERMISSIONS = [
  ["quality.logs.read", "Consultar bitácoras y resultados de calidad."],
  ["quality.logs.capture", "Programar y capturar bitácoras de calidad."],
  ["quality.templates.manage", "Crear, versionar y publicar plantillas de calidad."],
  ["quality.corrective.manage", "Gestionar acciones correctivas de calidad."],
  ["quality.evidence.upload", "Adjuntar evidencia privada a registros de calidad."],
  ["quality.reports.export", "Exportar bitácoras y reportes autorizados de calidad."],
] as const;

const QUALITY_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: QUALITY_PERMISSIONS.map(([code]) => code),
  administrator: QUALITY_PERMISSIONS.map(([code]) => code),
  regional_supervisor: ["quality.logs.read", "quality.logs.capture", "quality.corrective.manage", "quality.evidence.upload", "quality.reports.export"],
  branch_manager: ["quality.logs.read", "quality.logs.capture", "quality.corrective.manage", "quality.evidence.upload", "quality.reports.export"],
  quality_supervisor: QUALITY_PERMISSIONS.map(([code]) => code),
  nutrition: ["quality.logs.read", "quality.logs.capture", "quality.evidence.upload"],
  operator: ["quality.logs.read", "quality.logs.capture", "quality.evidence.upload"],
  auditor: ["quality.logs.read", "quality.reports.export"],
  viewer: ["quality.logs.read"],
};

interface MembershipContext {
  membershipId: string;
  organizationId: string;
  organizationStatus: OrganizationStatus;
  organizationCode: string;
  organizationName: string;
  timezone: string;
  displayName: string;
  permissions: string[];
  roleNames: string[];
  scopes: Array<{ type: string; id: string | null; accessMode: string }>;
}

interface FieldRow {
  id: string;
  templateVersionId: string;
  code: string;
  label: string;
  description: string;
  fieldType: OperationalQualityFieldType;
  unit: string | null;
  required: unknown;
  minimumMilli: number | null;
  maximumMilli: number | null;
  expectedBoolean: unknown | null;
  optionsJson: string;
  nonCompliantOptionsJson: string;
  deviationSeverity: "warning" | "critical";
  evidenceRequiredOnDeviation: unknown;
  displayOrder: number;
}

const nowIso = () => new Date().toISOString();
const bool = (value: unknown) => value === true || value === 1;
const normalizeEmail = (value: string) => value.trim().toLowerCase();

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function audit(organizationId: string, membershipId: string, action: string, entity: string, entityId: string, reason: string, after?: unknown): SqlCommand {
  return {
    sql: `INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, 'customer_membership', ?, ?, ?, ?, 'success', ?, ?, ?)`,
    values: [crypto.randomUUID(), organizationId, membershipId, action, entity, entityId, reason, after === undefined ? null : JSON.stringify(after), nowIso()],
  };
}

function auditWhen(
  organizationId: string,
  membershipId: string,
  action: string,
  entity: string,
  entityId: string,
  reason: string,
  conditionSql: string,
  conditionValues: unknown[],
  after?: unknown,
): SqlCommand {
  return {
    sql: `INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at)
      SELECT ?, ?, 'customer_membership', ?, ?, ?, ?, 'success', ?, ?, ? WHERE ${conditionSql}`,
    values: [crypto.randomUUID(), organizationId, membershipId, action, entity, entityId, reason, after === undefined ? null : JSON.stringify(after), nowIso(), ...conditionValues],
  };
}

function invalidateDashboard(organizationId: string): SqlCommand {
  return { sql: "DELETE FROM dashboard_cache_entries WHERE organization_id = ?", values: [organizationId] };
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(",");
}

export class D1QualityRepository implements TenantQualityRepository {
  constructor(private readonly provider: QualityDataProvider) {}

  async ensureCatalog(): Promise<void> {
    const commands: SqlCommand[] = [];
    for (const [code, description] of QUALITY_PERMISSIONS) {
      commands.push({ sql: "INSERT OR IGNORE INTO organization_permissions (id, code, description) VALUES (?, ?, ?)", values: [`org-permission-${code}`, code, description] });
    }
    for (const [roleCode, permissions] of Object.entries(QUALITY_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        commands.push({
          sql: `INSERT OR IGNORE INTO organization_role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM organization_roles r JOIN organization_permissions p ON p.code = ?
            WHERE r.code = ? AND r.status = 'active'`,
          values: [permission, roleCode],
        });
      }
    }
    await this.provider.batch(commands);
  }

  private async membership(identity: TenantActor, organizationId?: string, permission = "quality.logs.read", write = false): Promise<MembershipContext> {
    const rows = await this.provider.all<Record<string, unknown>>(`SELECT m.id AS membershipId, m.organization_id AS organizationId, m.display_name AS displayName,
      o.status AS organizationStatus, o.code AS organizationCode, o.commercial_name AS organizationName, o.default_timezone AS timezone,
      r.name AS roleName, p.code AS permissionCode
      FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
      LEFT JOIN membership_role_assignments mra ON mra.membership_id = m.id
      LEFT JOIN organization_roles r ON r.id = mra.role_id AND r.organization_id = m.organization_id AND r.status = 'active'
      LEFT JOIN organization_role_permissions rp ON rp.role_id = r.id
      LEFT JOIN organization_permissions p ON p.id = rp.permission_id
      WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' ${organizationId ? "AND m.organization_id = ?" : ""}
      ORDER BY m.joined_at, r.name LIMIT 1000`, organizationId ? [identity.authUserId, normalizeEmail(identity.email), organizationId] : [identity.authUserId, normalizeEmail(identity.email)]);
    if (!rows.length) throw new Error("No existe una membresía activa para esta cuenta.");
    const selectedId = organizationId ?? String(rows[0].organizationId);
    const selected = rows.filter((row) => String(row.organizationId) === selectedId);
    if (!selected.length) throw new Error("No existe una membresía activa para esta organización.");
    const organizationStatus = String(selected[0].organizationStatus) as OrganizationStatus;
    if (!["active", "restricted"].includes(organizationStatus)) throw new Error("La organización todavía no está activa para operar Calidad.");
    if (write && organizationStatus === "restricted") throw new Error("La organización está restringida y permanece en modo de solo lectura.");
    const permissions = Array.from(new Set(selected.map((row) => row.permissionCode ? String(row.permissionCode) : "").filter(Boolean)));
    if (!permissions.includes(permission)) throw new Error("No tienes permiso para realizar esta acción de Calidad.");
    const scopes = await this.provider.all<{ type: string; id: string | null; accessMode: string }>("SELECT scope_type AS type, scope_id AS id, access_mode AS accessMode FROM membership_scopes WHERE membership_id = ?", [String(selected[0].membershipId)]);
    if (!scopes.length) throw new Error("La membresía no tiene un alcance autorizado.");
    await this.provider.run("UPDATE customer_users SET last_access_at = ?, updated_at = ? WHERE auth_user_id = ?", [nowIso(), nowIso(), identity.authUserId]);
    return {
      membershipId: String(selected[0].membershipId), organizationId: selectedId, organizationStatus,
      organizationCode: String(selected[0].organizationCode), organizationName: String(selected[0].organizationName), timezone: String(selected[0].timezone),
      displayName: String(selected[0].displayName), permissions,
      roleNames: Array.from(new Set(selected.map((row) => row.roleName ? String(row.roleName) : "").filter(Boolean))), scopes,
    };
  }

  private async assertQualityModule(organizationId: string): Promise<void> {
    const timestamp = nowIso();
    const override = await this.provider.first<{ enabled: unknown }>(`SELECT enabled FROM organization_feature_overrides WHERE organization_id = ? AND target_type = 'module' AND module_code = 'QUALITY' AND status = 'active' AND effective_from <= ? AND effective_until > ? ORDER BY created_at DESC LIMIT 1`, [organizationId, timestamp, timestamp]);
    if (override) {
      if (!bool(override.enabled)) throw new Error("El módulo Calidad no está habilitado para esta organización.");
      return;
    }
    const entitlement = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM organization_entitlements WHERE organization_id = ? AND module_code = 'QUALITY' AND enabled = 1 AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?)`, [organizationId, timestamp, timestamp]);
    if ((entitlement?.count ?? 0) === 0) throw new Error("El módulo Calidad no está contratado para esta organización.");
  }

  private scopeAllows(member: MembershipContext, branchId: string, write: boolean): boolean {
    const modes = write ? ["manage", "write"] : ["manage", "write", "read"];
    if (member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && modes.includes(scope.accessMode))) return true;
    return member.scopes.some((scope) => scope.type === "branch" && scope.id === branchId && modes.includes(scope.accessMode));
  }

  private hasOrganizationScope(member: MembershipContext, write: boolean): boolean {
    const modes = write ? ["manage", "write"] : ["manage", "write", "read"];
    return member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && modes.includes(scope.accessMode));
  }

  private async assertBranch(member: MembershipContext, branchId: string, write: boolean): Promise<{ id: string; timezone: string }> {
    const branch = await this.provider.first<{ id: string; timezone: string }>("SELECT id, timezone FROM tenant_branches WHERE id = ? AND organization_id = ? AND status = 'active'", [branchId, member.organizationId]);
    if (!branch) throw new Error("No se encontró la sucursal dentro de tu organización.");
    if (!this.scopeAllows(member, branchId, write)) throw new Error("Tu alcance no permite operar esa sucursal.");
    return branch;
  }

  private async authorizedBranches(member: MembershipContext): Promise<Array<{ id: string; code: string; name: string; timezone: string; status: string }>> {
    const organizationWide = member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && ["read", "write", "manage"].includes(scope.accessMode));
    if (organizationWide) return this.provider.all("SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' ORDER BY name", [member.organizationId]);
    const branchIds = Array.from(new Set(member.scopes.filter((scope) => scope.type === "branch" && scope.id && ["read", "write", "manage"].includes(scope.accessMode)).map((scope) => String(scope.id))));
    if (!branchIds.length) return [];
    return this.provider.all(`SELECT id, code, name, timezone, status FROM tenant_branches WHERE organization_id = ? AND status = 'active' AND id IN (${placeholders(branchIds)}) ORDER BY name`, [member.organizationId, ...branchIds]);
  }

  private field(row: FieldRow): OperationalQualityTemplateField {
    return {
      id: row.id, code: row.code, label: row.label, description: row.description, fieldType: row.fieldType, unit: row.unit,
      required: bool(row.required), minimum: qualityMilliToNumber(row.minimumMilli), maximum: qualityMilliToNumber(row.maximumMilli),
      expectedBoolean: row.expectedBoolean === null ? null : bool(row.expectedBoolean), options: parseJson(row.optionsJson, []),
      nonCompliantOptions: parseJson(row.nonCompliantOptionsJson, []), deviationSeverity: row.deviationSeverity,
      evidenceRequiredOnDeviation: bool(row.evidenceRequiredOnDeviation), displayOrder: Number(row.displayOrder),
    };
  }

  async snapshot(identity: TenantActor, filters: { organizationId?: string; branchId?: string | null; period: "today" | "last_7_days" | "last_30_days" | "month"; selectedLogId?: string | null }): Promise<QualitySnapshot> {
    await this.ensureCatalog();
    const member = await this.membership(identity, filters.organizationId);
    const snapshotNow = nowIso();
    const operationalToday = localOperationalDate(member.timezone, new Date(snapshotNow));
    const periodStart = filters.period === "month"
      ? zonedLocalToIso(`${operationalToday.slice(0, 7)}-01`, "00:00", member.timezone)
      : periodStartForTimezone(filters.period, member.timezone);
    await this.assertQualityModule(member.organizationId);
    const branches = await this.authorizedBranches(member);
    if (!branches.length) throw new Error("Tu alcance no contiene sucursales activas.");
    const branchId = filters.branchId && filters.branchId !== "all" ? filters.branchId : null;
    if (branchId && !branches.some((branch) => branch.id === branchId)) throw new Error("La sucursal solicitada está fuera de tu alcance.");
    const branchIds = branchId ? [branchId] : branches.map((branch) => branch.id);
    const branchSql = placeholders(branchIds);
    const shifts = await this.provider.all<{ id: string; branchId: string | null; code: string; name: string }>(`SELECT id, branch_id AS branchId, code, name FROM tenant_shifts WHERE organization_id = ? AND status = 'active' AND (branch_id IS NULL OR branch_id IN (${branchSql})) ORDER BY name`, [member.organizationId, ...branchIds]);
    const assignees = member.permissions.includes("quality.corrective.manage") ? await this.provider.all<{ id: string; displayName: string }>(`SELECT DISTINCT m.id, m.display_name AS displayName FROM organization_memberships m WHERE m.organization_id = ? AND m.status = 'active' AND EXISTS (SELECT 1 FROM membership_scopes s WHERE s.membership_id = m.id AND s.access_mode IN ('read','write','manage') AND ((s.scope_type = 'organization' AND (s.scope_id IS NULL OR s.scope_id = ?)) OR (s.scope_type = 'branch' AND s.scope_id IN (${branchSql})))) ORDER BY m.display_name`, [member.organizationId, member.organizationId, ...branchIds]) : [];
    const canConfigure = member.permissions.includes("quality.templates.manage");
    const roots = await this.provider.all<Record<string, unknown>>(`SELECT id, branch_id AS branchId, code, name, status FROM tenant_quality_templates WHERE organization_id = ? AND status = 'active' AND (branch_id IS NULL OR branch_id IN (${branchSql})) ORDER BY name`, [member.organizationId, ...branchIds]);
    const rootIds = roots.map((root) => String(root.id));
    const versions = rootIds.length ? await this.provider.all<Record<string, unknown>>(`SELECT id, root_template_id AS rootTemplateId, version_number AS versionNumber, version, status, name_snapshot AS name, code_snapshot AS code, category, instructions, schedule_type AS scheduleType, default_due_time AS defaultDueTime, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM quality_template_versions WHERE organization_id = ? AND root_template_id IN (${placeholders(rootIds)}) ${canConfigure ? "" : "AND status IN ('published','archived')"} ORDER BY root_template_id, version_number DESC`, [member.organizationId, ...rootIds]) : [];
    const versionIds = versions.map((version) => String(version.id));
    const fieldRows = versionIds.length ? await this.provider.all<FieldRow>(`SELECT id, template_version_id AS templateVersionId, code, label, description, field_type AS fieldType, unit, required, minimum_milli AS minimumMilli, maximum_milli AS maximumMilli, expected_boolean AS expectedBoolean, options_json AS optionsJson, non_compliant_options_json AS nonCompliantOptionsJson, deviation_severity AS deviationSeverity, evidence_required_on_deviation AS evidenceRequiredOnDeviation, display_order AS displayOrder FROM quality_template_fields WHERE status = 'active' AND template_version_id IN (${placeholders(versionIds)}) ORDER BY display_order`, versionIds) : [];
    const fieldsByVersion = new Map<string, OperationalQualityTemplateField[]>();
    for (const row of fieldRows) fieldsByVersion.set(row.templateVersionId, [...(fieldsByVersion.get(row.templateVersionId) ?? []), this.field(row)]);
    const rootById = new Map(roots.map((root) => [String(root.id), root]));
    const templateVersions = new Map<string, QualityTemplateVersion>();
    for (const row of versions) {
      const root = rootById.get(String(row.rootTemplateId));
      const version: QualityTemplateVersion = {
        id: String(row.id), rootTemplateId: String(row.rootTemplateId), rootBranchId: root?.branchId ? String(root.branchId) : null,
        code: String(row.code), name: String(row.name), versionNumber: Number(row.versionNumber), version: Number(row.version),
        status: String(row.status) as QualityTemplateVersion["status"], category: String(row.category) as QualityTemplateCategory,
        instructions: String(row.instructions), scheduleType: String(row.scheduleType) as QualityTemplateVersion["scheduleType"],
        defaultDueTime: row.defaultDueTime ? String(row.defaultDueTime) : null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
        publishedAt: row.publishedAt ? String(row.publishedAt) : null, fields: fieldsByVersion.get(String(row.id)) ?? [],
      };
      templateVersions.set(version.id, version);
    }
    const templates: QualityTemplateRoot[] = roots.map((root) => ({
      id: String(root.id), branchId: root.branchId ? String(root.branchId) : null, code: String(root.code), name: String(root.name), status: String(root.status),
      versions: versions.filter((version) => String(version.rootTemplateId) === String(root.id)).map((version) => templateVersions.get(String(version.id))).filter((value): value is QualityTemplateVersion => Boolean(value)),
    }));

    const selectedClause = filters.selectedLogId ? "OR l.id = ?" : "";
    const logValues: unknown[] = [member.organizationId, ...branchIds, periodStart];
    if (filters.selectedLogId) logValues.push(filters.selectedLogId);
    const logRows = await this.provider.all<Record<string, unknown>>(`SELECT l.id, l.branch_id AS branchId, b.name AS branchName, l.template_version_id AS templateVersionId,
      tv.name_snapshot AS templateName, tv.category AS templateCategory, tv.version_number AS templateVersionNumber,
      l.operational_date AS operationalDate, l.due_at AS dueAt, l.status, l.completion_percentage AS completionPercentage, l.deviation_count AS deviationCount,
      assignee.display_name AS assignedToName, l.started_at AS startedAt, l.completed_at AS completedAt, l.signer_name_snapshot AS signerName,
      l.revision_of_log_id AS revisionOfLogId, l.revision_number AS revisionNumber, l.revision_reason AS revisionReason,
      l.created_at AS createdAt, l.updated_at AS updatedAt, l.version
      FROM quality_log_instances l JOIN tenant_branches b ON b.id = l.branch_id JOIN quality_template_versions tv ON tv.id = l.template_version_id
      LEFT JOIN organization_memberships assignee ON assignee.id = l.assigned_to_membership_id
      WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND (l.updated_at >= ? OR l.status IN ('pending','in_progress') ${selectedClause})
      ORDER BY CASE l.status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, l.due_at DESC LIMIT 150`, logValues);
    const logIds = logRows.map((log) => String(log.id));
    const answers = logIds.length ? await this.provider.all<Record<string, unknown>>(`SELECT a.id, a.log_instance_id AS logInstanceId, a.field_id AS fieldId, a.value_type AS valueType, a.has_value AS hasValue, a.value_text AS valueText, a.numeric_value_milli AS numericValueMilli, a.boolean_value AS booleanValue, a.option_value AS optionValue, a.in_range AS inRange, a.notes, a.captured_at AS capturedAt, m.display_name AS capturedByName, a.version FROM quality_log_answers a JOIN organization_memberships m ON m.id = a.captured_by WHERE a.log_instance_id IN (${placeholders(logIds)}) ORDER BY a.captured_at`, logIds) : [];
    const evidenceRows = logIds.length ? await this.provider.all<Record<string, unknown>>(`SELECT e.id, e.log_instance_id AS logInstanceId, e.answer_id AS answerId, e.corrective_action_id AS correctiveActionId, e.file_name AS fileName, e.mime_type AS mimeType, e.size_bytes AS sizeBytes, e.note, e.evidence_type AS evidenceType, e.captured_at AS capturedAt, m.display_name AS capturedByName FROM quality_evidence e JOIN organization_memberships m ON m.id = e.captured_by WHERE e.status = 'available' AND e.log_instance_id IN (${placeholders(logIds)}) ORDER BY e.captured_at DESC`, logIds) : [];
    const answerByLog = new Map<string, QualityLogAnswer[]>();
    for (const row of answers) {
      const hasValue = bool(row.hasValue);
      const fieldType = String(row.valueType) as OperationalQualityFieldType;
      let value: QualityLogAnswer["value"] = null;
      if (hasValue && fieldType === "number") value = qualityMilliToNumber(Number(row.numericValueMilli));
      else if (hasValue && fieldType === "boolean") value = bool(row.booleanValue);
      else if (hasValue && fieldType === "select") value = String(row.optionValue);
      else if (hasValue) value = String(row.valueText);
      const answer: QualityLogAnswer = { id: String(row.id), fieldId: String(row.fieldId), valueType: fieldType, value, inRange: row.inRange === null ? null : bool(row.inRange), notes: String(row.notes), capturedAt: String(row.capturedAt), capturedByName: String(row.capturedByName), version: Number(row.version) };
      answerByLog.set(String(row.logInstanceId), [...(answerByLog.get(String(row.logInstanceId)) ?? []), answer]);
    }
    const evidenceByLog = new Map<string, QualityEvidenceSummary[]>();
    for (const row of evidenceRows) {
      const item: QualityEvidenceSummary = { id: String(row.id), logInstanceId: String(row.logInstanceId), answerId: row.answerId ? String(row.answerId) : null, correctiveActionId: row.correctiveActionId ? String(row.correctiveActionId) : null, fileName: String(row.fileName), mimeType: String(row.mimeType), sizeBytes: Number(row.sizeBytes), note: String(row.note), evidenceType: String(row.evidenceType ?? "general") as QualityEvidenceSummary["evidenceType"], capturedAt: String(row.capturedAt), capturedByName: String(row.capturedByName) };
      evidenceByLog.set(item.logInstanceId, [...(evidenceByLog.get(item.logInstanceId) ?? []), item]);
    }
    const logs: QualityLogSummary[] = logRows.map((row) => {
      const version = templateVersions.get(String(row.templateVersionId));
      return {
        id: String(row.id), branchId: String(row.branchId), branchName: String(row.branchName), templateVersionId: String(row.templateVersionId),
        templateName: String(row.templateName), templateCategory: String(row.templateCategory) as QualityTemplateCategory, templateVersionNumber: Number(row.templateVersionNumber),
        operationalDate: String(row.operationalDate), dueAt: String(row.dueAt), status: ((() => { const persisted = String(row.status); if (["pending", "in_progress"].includes(persisted) && String(row.dueAt) < snapshotNow) return "overdue"; if (persisted === "pending" && String(row.operationalDate) > operationalToday) return "upcoming"; if (persisted === "completed" && row.revisionOfLogId) return "corrected"; return persisted; })()) as QualityLogSummary["status"],
        completionPercentage: Number(row.completionPercentage), deviationCount: Number(row.deviationCount), assignedToName: row.assignedToName ? String(row.assignedToName) : null,
        startedAt: row.startedAt ? String(row.startedAt) : null, completedAt: row.completedAt ? String(row.completedAt) : null, signerName: row.signerName ? String(row.signerName) : null,
        revisionOfLogId: row.revisionOfLogId ? String(row.revisionOfLogId) : null, revisionNumber: Number(row.revisionNumber), revisionReason: row.revisionReason ? String(row.revisionReason) : null,
        createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), version: Number(row.version), fields: version?.fields ?? [], answers: answerByLog.get(String(row.id)) ?? [], evidence: evidenceByLog.get(String(row.id)) ?? [],
      };
    });

    const actionRows = await this.provider.all<Record<string, unknown>>(`SELECT a.id, a.branch_id AS branchId, b.name AS branchName, a.log_instance_id AS logInstanceId, a.answer_id AS answerId, a.title, a.description, a.severity, a.status, a.assigned_to_membership_id AS assignedToMembershipId, assignee.display_name AS assignedToName, a.due_at AS dueAt, a.root_cause AS rootCause, a.immediate_correction AS immediateCorrection, a.preventive_action AS preventiveAction, a.resolution, a.verification_notes AS verificationNotes, a.verified_at AS verifiedAt, verifier.display_name AS verifiedByName, a.created_at AS createdAt, a.updated_at AS updatedAt, a.resolved_at AS resolvedAt, a.version FROM quality_corrective_actions a JOIN tenant_branches b ON b.id = a.branch_id LEFT JOIN organization_memberships assignee ON assignee.id = a.assigned_to_membership_id LEFT JOIN organization_memberships verifier ON verifier.id = a.verified_by WHERE a.organization_id = ? AND a.branch_id IN (${branchSql}) AND (a.created_at >= ? OR a.status IN ('open','assigned','in_progress','resolved')) ORDER BY CASE a.severity WHEN 'critical' THEN 0 ELSE 1 END, a.due_at, a.created_at DESC LIMIT 200`, [member.organizationId, ...branchIds, periodStart]);
    const correctiveActions: QualityCorrectiveActionSummary[] = actionRows.map((row) => ({
      id: String(row.id), branchId: String(row.branchId), branchName: String(row.branchName), logInstanceId: String(row.logInstanceId), answerId: row.answerId ? String(row.answerId) : null,
      title: String(row.title), description: String(row.description), severity: String(row.severity) as QualityCorrectiveActionSummary["severity"], status: ((["open", "assigned", "in_progress"].includes(String(row.status)) && row.dueAt && String(row.dueAt) < snapshotNow) ? "overdue" : String(row.status)) as QualityCorrectiveActionSummary["status"],
      assignedToMembershipId: row.assignedToMembershipId ? String(row.assignedToMembershipId) : null, assignedToName: row.assignedToName ? String(row.assignedToName) : null, dueAt: row.dueAt ? String(row.dueAt) : null, rootCause: row.rootCause ? String(row.rootCause) : null, immediateCorrection: row.immediateCorrection ? String(row.immediateCorrection) : null, preventiveAction: row.preventiveAction ? String(row.preventiveAction) : null,
      resolution: row.resolution ? String(row.resolution) : null, verificationNotes: row.verificationNotes ? String(row.verificationNotes) : null, verifiedAt: row.verifiedAt ? String(row.verifiedAt) : null, verifiedByName: row.verifiedByName ? String(row.verifiedByName) : null,
      createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), resolvedAt: row.resolvedAt ? String(row.resolvedAt) : null, version: Number(row.version),
    }));
    const scheduleRows = await this.provider.all<Record<string, unknown>>(`SELECT r.id, r.branch_id AS branchId, b.name AS branchName, r.template_version_id AS templateVersionId, tv.name_snapshot AS templateName, r.shift_id AS shiftId, r.assigned_to_membership_id AS assignedToMembershipId, r.schedule_type AS scheduleType, r.days_of_week_json AS daysOfWeekJson, r.times_json AS timesJson, r.interval_minutes AS intervalMinutes, r.timezone, r.start_date AS startDate, r.end_date AS endDate, r.status, r.last_generated_through AS lastGeneratedThrough, r.version FROM quality_schedule_rules r JOIN tenant_branches b ON b.id = r.branch_id JOIN quality_template_versions tv ON tv.id = r.template_version_id WHERE r.organization_id = ? AND r.branch_id IN (${branchSql}) AND r.status IN ('active','paused') ORDER BY r.status, b.name, tv.name_snapshot LIMIT 200`, [member.organizationId, ...branchIds]);
    const scheduleRules = scheduleRows.map((row) => ({
      id: String(row.id), branchId: String(row.branchId), branchName: String(row.branchName), templateVersionId: String(row.templateVersionId), templateName: String(row.templateName), shiftId: row.shiftId ? String(row.shiftId) : null, assignedToMembershipId: row.assignedToMembershipId ? String(row.assignedToMembershipId) : null,
      scheduleType: String(row.scheduleType) as QualitySnapshot["scheduleRules"][number]["scheduleType"], daysOfWeek: parseJson<number[]>(String(row.daysOfWeekJson ?? "[]"), []), times: parseJson<string[]>(String(row.timesJson ?? "[]"), []), intervalMinutes: row.intervalMinutes === null ? null : Number(row.intervalMinutes), timezone: String(row.timezone), startDate: String(row.startDate), endDate: row.endDate ? String(row.endDate) : null, status: String(row.status) as QualitySnapshot["scheduleRules"][number]["status"], lastGeneratedThrough: row.lastGeneratedThrough ? String(row.lastGeneratedThrough) : null, version: Number(row.version),
    }));
    const selectedLog = filters.selectedLogId ? logs.find((item) => item.id === filters.selectedLogId) ?? null : null;
    const selectedActionIds = selectedLog ? correctiveActions.filter((item) => item.logInstanceId === selectedLog.id).map((item) => item.id) : [];
    const selectedAnswerIds = selectedLog?.answers.map((item) => item.id) ?? [];
    const selectedEvidenceIds = selectedLog?.evidence.map((item) => item.id) ?? [];
    const timelineEntityIds = selectedLog ? [selectedLog.id, ...selectedActionIds, ...selectedAnswerIds, ...selectedEvidenceIds] : [];
    const timelineRows = timelineEntityIds.length ? await this.provider.all<Record<string, unknown>>(`SELECT e.id, e.action, e.entity, e.entity_id AS entityId, e.outcome, e.reason, e.after_json AS afterJson, e.created_at AS createdAt,
      CASE WHEN e.actor_type = 'customer_membership' THEN COALESCE(m.display_name, 'Usuario') WHEN e.actor_type = 'system' THEN 'Sistema KitchenMind' ELSE e.actor_id END AS actorName
      FROM organization_audit_events e LEFT JOIN organization_memberships m ON e.actor_type = 'customer_membership' AND m.id = e.actor_id
      WHERE e.organization_id = ? AND e.entity_id IN (${placeholders(timelineEntityIds)}) ORDER BY e.created_at, e.id LIMIT 500`, [member.organizationId, ...timelineEntityIds]) : [];
    const timeline = timelineRows.map((row) => ({
      id: String(row.id), action: String(row.action), entity: String(row.entity), entityId: row.entityId ? String(row.entityId) : null, outcome: String(row.outcome),
      reason: row.reason ? String(row.reason) : null, actorName: String(row.actorName ?? 'KitchenMind'), createdAt: String(row.createdAt),
      metadata: row.afterJson ? parseJson<Record<string, unknown>>(String(row.afterJson), {}) : null,
    }));

    const metricRow = await this.provider.first<Record<string, number | null>>(`SELECT
      (SELECT COUNT(*) FROM quality_template_versions tv JOIN tenant_quality_templates rt ON rt.id = tv.root_template_id WHERE tv.organization_id = ? AND tv.status = 'published' AND rt.status = 'active' AND (rt.branch_id IS NULL OR rt.branch_id IN (${branchSql}))) AS publishedTemplates,
      (SELECT COUNT(*) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.due_at >= ? AND l.due_at <= ? AND l.status <> 'cancelled') AS scheduledInPeriod,
      (SELECT COUNT(*) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.due_at >= ? AND l.due_at <= ? AND l.status <> 'cancelled') AS eligibleLogs,
      (SELECT COUNT(*) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.status = 'pending') AS pendingLogs,
      (SELECT COUNT(*) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.status = 'in_progress') AS inProgressLogs,
      (SELECT COUNT(*) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.status = 'completed' AND l.completed_at >= ?) AS completedInPeriod,
      (SELECT COALESCE(SUM(l.deviation_count), 0) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.updated_at >= ?) AS deviationsInPeriod,
      (SELECT COUNT(*) FROM quality_log_answers a JOIN quality_log_instances l ON l.id = a.log_instance_id JOIN quality_template_fields f ON f.id = a.field_id WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND a.in_range = 0 AND a.has_value = 1 AND f.deviation_severity = 'critical' AND a.captured_at >= ?) AS criticalDeviationsInPeriod,
      (SELECT COUNT(*) FROM quality_corrective_actions a WHERE a.organization_id = ? AND a.branch_id IN (${branchSql}) AND a.status IN ('open','assigned','in_progress','resolved')) AS openCorrectiveActions,
      (SELECT COUNT(*) FROM quality_corrective_actions a WHERE a.organization_id = ? AND a.branch_id IN (${branchSql}) AND a.status IN ('open','assigned','in_progress') AND a.due_at IS NOT NULL AND a.due_at < ?) AS overdueCorrectiveActions,
      (SELECT COUNT(*) FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.status IN ('pending','in_progress') AND l.due_at < ?) AS overdueLogs,
      (SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * SUM(CASE WHEN l.status = 'completed' AND l.completed_at <= l.due_at THEN 1 ELSE 0 END) / COUNT(*), 1) END FROM quality_log_instances l WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND l.due_at >= ? AND l.due_at <= ? AND l.status <> 'cancelled') AS compliancePercent,
      (SELECT ROUND(AVG((julianday(a.resolved_at) - julianday(a.created_at)) * 1440.0), 1) FROM quality_corrective_actions a WHERE a.organization_id = ? AND a.branch_id IN (${branchSql}) AND a.resolved_at IS NOT NULL AND a.resolved_at >= ?) AS averageResolutionMinutes,
      (SELECT COUNT(*) FROM (SELECT l.branch_id, l.template_version_id, a.field_id FROM quality_log_answers a JOIN quality_log_instances l ON l.id = a.log_instance_id WHERE l.organization_id = ? AND l.branch_id IN (${branchSql}) AND a.in_range = 0 AND a.has_value = 1 AND a.captured_at >= ? GROUP BY l.branch_id, l.template_version_id, a.field_id HAVING COUNT(*) >= 2)) AS recurrentDeviationGroups`, [
      member.organizationId, ...branchIds,
      member.organizationId, ...branchIds, periodStart, snapshotNow,
      member.organizationId, ...branchIds, periodStart, snapshotNow,
      member.organizationId, ...branchIds,
      member.organizationId, ...branchIds,
      member.organizationId, ...branchIds, periodStart,
      member.organizationId, ...branchIds, periodStart,
      member.organizationId, ...branchIds, periodStart,
      member.organizationId, ...branchIds,
      member.organizationId, ...branchIds, snapshotNow,
      member.organizationId, ...branchIds, snapshotNow,
      member.organizationId, ...branchIds, periodStart, snapshotNow,
      member.organizationId, ...branchIds, periodStart,
      member.organizationId, ...branchIds, periodStart,
    ]);
    const availableOrganizations = await this.provider.all<{ id: string; name: string; status: string }>(`SELECT DISTINCT o.id, o.commercial_name AS name, o.status FROM customer_users u JOIN organization_memberships m ON m.user_id = u.id JOIN tenant_organizations o ON o.id = m.organization_id WHERE u.auth_user_id = ? AND u.email = ? AND u.status = 'active' AND m.status = 'active' AND o.status IN ('active','restricted') ORDER BY o.commercial_name`, [identity.authUserId, normalizeEmail(identity.email)]);
    const organizationWide = member.scopes.some((scope) => scope.type === "organization" && (scope.id === null || scope.id === member.organizationId) && ["read", "write", "manage"].includes(scope.accessMode));
    return {
      organization: { id: member.organizationId, code: member.organizationCode, name: member.organizationName, status: member.organizationStatus, timezone: member.timezone },
      membership: { id: member.membershipId, displayName: member.displayName, roleNames: member.roleNames, permissions: member.permissions },
      availableOrganizations, branches, shifts, assignees, selectedBranchId: branchId, templates, logs, correctiveActions, scheduleRules, timeline,
      metrics: {
        publishedTemplates: Number(metricRow?.publishedTemplates ?? 0), scheduledInPeriod: Number(metricRow?.scheduledInPeriod ?? 0), eligibleLogs: Number(metricRow?.eligibleLogs ?? 0),
        pendingLogs: Number(metricRow?.pendingLogs ?? 0), inProgressLogs: Number(metricRow?.inProgressLogs ?? 0), completedInPeriod: Number(metricRow?.completedInPeriod ?? 0),
        deviationsInPeriod: Number(metricRow?.deviationsInPeriod ?? 0), criticalDeviationsInPeriod: Number(metricRow?.criticalDeviationsInPeriod ?? 0),
        openCorrectiveActions: Number(metricRow?.openCorrectiveActions ?? 0), overdueCorrectiveActions: Number(metricRow?.overdueCorrectiveActions ?? 0), overdueLogs: Number(metricRow?.overdueLogs ?? 0),
        compliancePercent: metricRow?.compliancePercent === null || metricRow?.compliancePercent === undefined ? null : Number(metricRow.compliancePercent),
        averageResolutionMinutes: metricRow?.averageResolutionMinutes === null || metricRow?.averageResolutionMinutes === undefined ? null : Number(metricRow.averageResolutionMinutes),
        recurrentDeviationGroups: Number(metricRow?.recurrentDeviationGroups ?? 0),
      },
      capabilities: {
        read: true, configureTemplates: canConfigure && member.organizationStatus !== "restricted", capture: member.permissions.includes("quality.logs.capture") && member.organizationStatus !== "restricted",
        manageCorrectiveActions: member.permissions.includes("quality.corrective.manage") && member.organizationStatus !== "restricted",
        uploadEvidence: member.permissions.includes("quality.evidence.upload") && member.organizationStatus !== "restricted", exportReports: member.permissions.includes("quality.reports.export"), crossBranch: organizationWide && branches.length > 1, restricted: member.organizationStatus === "restricted",
      },
      filters: { branchId, periodStart }, generatedAt: nowIso(), selectedLogId: filters.selectedLogId ?? null,
      regulatoryNote: "Estas bitácoras apoyan la trazabilidad operativa y pueden configurarse con referencia a los controles aplicables de la organización. No constituyen por sí solas una certificación ni una declaración de cumplimiento normativo.",
    };
  }

  async authorizeExport(identity: TenantActor, organizationId: string): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.reports.export");
    await this.assertQualityModule(member.organizationId);
  }

  async createTemplate(identity: TenantActor, input: QualityTemplateInput): Promise<{ templateVersionId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.templates.manage", true);
    await this.assertQualityModule(member.organizationId);
    if (input.branchId) await this.assertBranch(member, input.branchId, true);
    else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para crear una plantilla global.");
    const existingByKey = await this.provider.first<{ id: string }>("SELECT id FROM quality_template_versions WHERE organization_id = ? AND idempotency_key = ?", [member.organizationId, input.idempotencyKey]);
    if (existingByKey) return { templateVersionId: existingByKey.id };
    const fields = validateQualityFieldDefinitions(input.fields);
    const code = normalizeQualityCode(input.code || input.name);
    const name = input.name.trim();
    let rootTemplateId = input.rootTemplateId ?? null;
    let createRoot = false;
    if (rootTemplateId) {
      const root = await this.provider.first<{ branchId: string | null; versionCount: number }>(`SELECT rt.branch_id AS branchId, (SELECT COUNT(*) FROM quality_template_versions tv WHERE tv.root_template_id = rt.id) AS versionCount FROM tenant_quality_templates rt WHERE rt.id = ? AND rt.organization_id = ? AND rt.status = 'active'`, [rootTemplateId, member.organizationId]);
      if (!root) throw new Error("No se encontró la plantilla base.");
      if (root.versionCount > 0) throw new Error("La plantilla ya tiene estructura; crea una nueva versión.");
      if (root.branchId) await this.assertBranch(member, root.branchId, true);
      else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para estructurar una plantilla global.");
      if ((root.branchId ?? null) !== (input.branchId ?? null)) throw new Error("La plantilla base no corresponde al alcance seleccionado.");
    } else {
      const duplicate = await this.provider.first<{ id: string }>("SELECT id FROM tenant_quality_templates WHERE organization_id = ? AND code = ?", [member.organizationId, code]);
      if (duplicate) throw new Error("Ya existe una plantilla con ese código.");
      rootTemplateId = crypto.randomUUID();
      createRoot = true;
    }
    const templateVersionId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    if (createRoot) commands.push({ sql: `INSERT INTO tenant_quality_templates (id, organization_id, branch_id, code, name, status, metadata_json, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', '{}', ?, ?, ?)`, values: [rootTemplateId, member.organizationId, input.branchId ?? null, code, name, timestamp, timestamp, member.membershipId] });
    else commands.push({ sql: "UPDATE tenant_quality_templates SET code = ?, name = ?, updated_at = ? WHERE id = ? AND organization_id = ?", values: [code, name, timestamp, rootTemplateId, member.organizationId] });
    commands.push({ sql: `INSERT INTO quality_template_versions (id, organization_id, root_template_id, version_number, status, name_snapshot, code_snapshot, category, instructions, schedule_type, default_due_time, idempotency_key, created_at, updated_at, created_by, version) VALUES (?, ?, ?, 1, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [templateVersionId, member.organizationId, rootTemplateId, name, code, input.category, input.instructions.trim(), input.scheduleType, input.defaultDueTime ?? null, input.idempotencyKey, timestamp, timestamp, member.membershipId] });
    commands.push(...this.fieldInsertCommands(templateVersionId, fields));
    commands.push({ sql: `UPDATE onboarding_tasks SET status = 'completed', completed_at = COALESCE(completed_at, ?), completed_by = COALESCE(completed_by, ?), updated_at = ? WHERE organization_id = ? AND code = 'quality_templates'`, values: [timestamp, member.membershipId, timestamp, member.organizationId] });
    commands.push(audit(member.organizationId, member.membershipId, "quality.template.created", "quality_template_version", templateVersionId, "Plantilla estructurada creada en borrador.", { code, name, fieldCount: fields.length }));
    commands.push(invalidateDashboard(member.organizationId));
    await this.provider.batch(commands);
    return { templateVersionId };
  }

  private fieldInsertCommands(templateVersionId: string, fields: ReturnType<typeof validateQualityFieldDefinitions>): SqlCommand[] {
    return fields.map((field) => ({
      sql: `INSERT INTO quality_template_fields (id, template_version_id, code, label, description, field_type, unit, required, minimum_milli, maximum_milli, expected_boolean, options_json, non_compliant_options_json, deviation_severity, evidence_required_on_deviation, display_order, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      values: [crypto.randomUUID(), templateVersionId, field.code, field.label, field.description, field.fieldType, field.unit, field.required ? 1 : 0, field.minimum === null ? null : qualityNumberToMilli(field.minimum), field.maximum === null ? null : qualityNumberToMilli(field.maximum), field.expectedBoolean === null ? null : field.expectedBoolean ? 1 : 0, JSON.stringify(field.options), JSON.stringify(field.nonCompliantOptions), field.deviationSeverity, field.evidenceRequiredOnDeviation ? 1 : 0, field.displayOrder, nowIso()],
    }));
  }

  async updateDraftTemplate(identity: TenantActor, input: QualityDraftUpdateInput): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.templates.manage", true);
    await this.assertQualityModule(member.organizationId);
    const current = await this.provider.first<{ rootTemplateId: string; branchId: string | null; status: string; version: number }>(`SELECT tv.root_template_id AS rootTemplateId, rt.branch_id AS branchId, tv.status, tv.version FROM quality_template_versions tv JOIN tenant_quality_templates rt ON rt.id = tv.root_template_id WHERE tv.id = ? AND tv.organization_id = ?`, [input.templateVersionId, member.organizationId]);
    if (!current) throw new Error("No se encontró la versión de la plantilla.");
    if (current.status !== "draft") throw new Error("Una versión publicada es inmutable; crea una nueva versión.");
    if (current.version !== input.expectedVersion) throw new Error("La plantilla cambió en otra sesión. Recarga antes de guardar.");
    if (current.branchId) await this.assertBranch(member, current.branchId, true);
    else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para editar una plantilla global.");
    const fields = validateQualityFieldDefinitions(input.fields);
    const code = normalizeQualityCode(input.code || input.name);
    const name = input.name.trim();
    const duplicate = await this.provider.first<{ id: string }>("SELECT id FROM tenant_quality_templates WHERE organization_id = ? AND code = ? AND id <> ?", [member.organizationId, code, current.rootTemplateId]);
    if (duplicate) throw new Error("Ya existe otra plantilla con ese código.");
    const timestamp = nowIso();
    const guard = `EXISTS (SELECT 1 FROM quality_template_versions tv WHERE tv.id = ? AND tv.organization_id = ? AND tv.status = 'draft' AND tv.version = ?)`;
    const guardValues = [input.templateVersionId, member.organizationId, input.expectedVersion];
    const commands: SqlCommand[] = [
      { sql: `UPDATE tenant_quality_templates SET code = ?, name = ?, updated_at = ? WHERE id = ? AND ${guard}`, values: [code, name, timestamp, current.rootTemplateId, ...guardValues] },
      { sql: `UPDATE quality_template_fields SET status = 'inactive' WHERE template_version_id = ? AND ${guard}`, values: [input.templateVersionId, ...guardValues] },
    ];
    for (const field of fields) {
      commands.push({
        sql: `INSERT INTO quality_template_fields (id, template_version_id, code, label, description, field_type, unit, required, minimum_milli, maximum_milli, expected_boolean, options_json, non_compliant_options_json, deviation_severity, evidence_required_on_deviation, display_order, status, created_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ? WHERE ${guard}
          ON CONFLICT(template_version_id, code) DO UPDATE SET label = excluded.label, description = excluded.description, field_type = excluded.field_type, unit = excluded.unit, required = excluded.required, minimum_milli = excluded.minimum_milli, maximum_milli = excluded.maximum_milli, expected_boolean = excluded.expected_boolean, options_json = excluded.options_json, non_compliant_options_json = excluded.non_compliant_options_json, deviation_severity = excluded.deviation_severity, evidence_required_on_deviation = excluded.evidence_required_on_deviation, display_order = excluded.display_order, status = 'active'`,
        values: [crypto.randomUUID(), input.templateVersionId, field.code, field.label, field.description, field.fieldType, field.unit, field.required ? 1 : 0, field.minimum === null ? null : qualityNumberToMilli(field.minimum), field.maximum === null ? null : qualityNumberToMilli(field.maximum), field.expectedBoolean === null ? null : field.expectedBoolean ? 1 : 0, JSON.stringify(field.options), JSON.stringify(field.nonCompliantOptions), field.deviationSeverity, field.evidenceRequiredOnDeviation ? 1 : 0, field.displayOrder, timestamp, ...guardValues],
      });
    }
    const updateIndex = commands.length;
    commands.push({ sql: `UPDATE quality_template_versions SET name_snapshot = ?, code_snapshot = ?, category = ?, instructions = ?, schedule_type = ?, default_due_time = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'draft' AND version = ?`, values: [name, code, input.category, input.instructions.trim(), input.scheduleType, input.defaultDueTime ?? null, timestamp, input.templateVersionId, member.organizationId, input.expectedVersion] });
    commands.push(auditWhen(member.organizationId, member.membershipId, "quality.template.draft_updated", "quality_template_version", input.templateVersionId, "Borrador de plantilla actualizado.", "EXISTS (SELECT 1 FROM quality_template_versions WHERE id = ? AND organization_id = ? AND status = 'draft' AND version = ? AND updated_at = ?)", [input.templateVersionId, member.organizationId, input.expectedVersion + 1, timestamp], { code, name, fieldCount: fields.length }));
    commands.push(invalidateDashboard(member.organizationId));
    const changes = await this.provider.batch(commands);
    if ((changes[updateIndex] ?? 0) !== 1) throw new Error("La plantilla cambió en otra sesión. Recarga antes de guardar.");
  }

  async publishTemplate(identity: TenantActor, organizationId: string, templateVersionId: string, expectedVersion: number): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.templates.manage", true);
    await this.assertQualityModule(member.organizationId);
    const row = await this.provider.first<{ branchId: string | null; fieldCount: number; status: string; version: number }>(`SELECT rt.branch_id AS branchId, tv.status, tv.version, (SELECT COUNT(*) FROM quality_template_fields f WHERE f.template_version_id = tv.id AND f.status = 'active') AS fieldCount FROM quality_template_versions tv JOIN tenant_quality_templates rt ON rt.id = tv.root_template_id WHERE tv.id = ? AND tv.organization_id = ?`, [templateVersionId, organizationId]);
    if (!row) throw new Error("No se encontró la versión de la plantilla.");
    if (row.branchId) await this.assertBranch(member, row.branchId, true);
    else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para publicar una plantilla global.");
    if (row.status !== "draft") throw new Error("La versión ya no está en borrador.");
    if (row.version !== expectedVersion) throw new Error("La plantilla cambió en otra sesión. Recarga antes de publicar.");
    if (row.fieldCount < 1) throw new Error("La plantilla necesita al menos un campo activo.");
    const timestamp = nowIso();
    const commands: SqlCommand[] = [
      { sql: `UPDATE quality_template_versions SET status = 'archived', updated_at = ? WHERE root_template_id = (SELECT root_template_id FROM quality_template_versions WHERE id = ? AND organization_id = ? AND status = 'draft' AND version = ?) AND id <> ? AND status = 'published'`, values: [timestamp, templateVersionId, organizationId, expectedVersion, templateVersionId] },
      { sql: `UPDATE quality_template_versions SET status = 'published', published_at = ?, published_by = ?, locked_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'draft' AND version = ?`, values: [timestamp, member.membershipId, timestamp, timestamp, templateVersionId, organizationId, expectedVersion] },
      auditWhen(organizationId, member.membershipId, "quality.template.published", "quality_template_version", templateVersionId, "Versión publicada y bloqueada para preservar capturas históricas.", "EXISTS (SELECT 1 FROM quality_template_versions WHERE id = ? AND organization_id = ? AND status = 'published' AND version = ? AND published_at = ?)", [templateVersionId, organizationId, expectedVersion + 1, timestamp], { fieldCount: row.fieldCount }),
      invalidateDashboard(organizationId),
    ];
    const changes = await this.provider.batch(commands);
    if ((changes[1] ?? 0) !== 1) throw new Error("La plantilla cambió en otra sesión. Recarga antes de publicar.");
  }

  async createTemplateRevision(identity: TenantActor, organizationId: string, templateVersionId: string, reason: string, idempotencyKey: string): Promise<{ templateVersionId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.templates.manage", true);
    await this.assertQualityModule(member.organizationId);
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM quality_template_versions WHERE organization_id = ? AND idempotency_key = ?", [organizationId, idempotencyKey]);
    if (existing) return { templateVersionId: existing.id };
    const source = await this.provider.first<Record<string, unknown>>(`SELECT tv.root_template_id AS rootTemplateId, rt.branch_id AS branchId, tv.status, tv.name_snapshot AS name, tv.code_snapshot AS code, tv.category, tv.instructions, tv.schedule_type AS scheduleType, tv.default_due_time AS defaultDueTime FROM quality_template_versions tv JOIN tenant_quality_templates rt ON rt.id = tv.root_template_id WHERE tv.id = ? AND tv.organization_id = ?`, [templateVersionId, organizationId]);
    if (!source) throw new Error("No se encontró la plantilla que deseas versionar.");
    if (String(source.status) !== "published") throw new Error("Solamente una versión publicada puede originar una revisión.");
    if (source.branchId) await this.assertBranch(member, String(source.branchId), true);
    else if (!this.hasOrganizationScope(member, true)) throw new Error("Necesitas alcance de organización para versionar una plantilla global.");
    const next = await this.provider.first<{ nextVersion: number }>("SELECT COALESCE(MAX(version_number), 0) + 1 AS nextVersion FROM quality_template_versions WHERE root_template_id = ?", [source.rootTemplateId]);
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [
      { sql: `INSERT INTO quality_template_versions (id, organization_id, root_template_id, version_number, status, name_snapshot, code_snapshot, category, instructions, schedule_type, default_due_time, idempotency_key, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [id, organizationId, source.rootTemplateId, next?.nextVersion ?? 1, source.name, source.code, source.category, source.instructions, source.scheduleType, source.defaultDueTime ?? null, idempotencyKey, timestamp, timestamp, member.membershipId] },
      { sql: `INSERT INTO quality_template_fields (id, template_version_id, code, label, description, field_type, unit, required, minimum_milli, maximum_milli, expected_boolean, options_json, non_compliant_options_json, deviation_severity, evidence_required_on_deviation, display_order, status, created_at) SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), ?, code, label, description, field_type, unit, required, minimum_milli, maximum_milli, expected_boolean, options_json, non_compliant_options_json, deviation_severity, evidence_required_on_deviation, display_order, 'active', ? FROM quality_template_fields WHERE template_version_id = ? AND status = 'active'`, values: [id, timestamp, templateVersionId] },
      audit(organizationId, member.membershipId, "quality.template.revision_created", "quality_template_version", id, reason, { sourceVersionId: templateVersionId, versionNumber: next?.nextVersion ?? 1 }),
      invalidateDashboard(organizationId),
    ];
    await this.provider.batch(commands);
    return { templateVersionId: id };
  }

  async scheduleLog(identity: TenantActor, input: QualityLogScheduleInput): Promise<{ logId: string; reused: boolean }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.logs.capture", true);
    await this.assertQualityModule(member.organizationId);
    const branch = await this.assertBranch(member, input.branchId, true);
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM quality_log_instances WHERE organization_id = ? AND idempotency_key = ?", [input.organizationId, input.idempotencyKey]);
    if (existing) return { logId: existing.id, reused: true };
    const template = await this.provider.first<{ rootBranchId: string | null; status: string; scheduleType: string }>(`SELECT rt.branch_id AS rootBranchId, tv.status, tv.schedule_type AS scheduleType FROM quality_template_versions tv JOIN tenant_quality_templates rt ON rt.id = tv.root_template_id WHERE tv.id = ? AND tv.organization_id = ? AND rt.status = 'active'`, [input.templateVersionId, input.organizationId]);
    if (!template) throw new Error("No se encontró la plantilla dentro de tu organización.");
    if (template.status !== "published") throw new Error("La bitácora solamente puede usar una versión publicada.");
    if (template.rootBranchId && template.rootBranchId !== input.branchId) throw new Error("La plantilla no aplica a la sucursal seleccionada.");
    if (template.scheduleType === "per_shift" && !input.shiftId) throw new Error("Selecciona el turno para esta bitácora.");
    if (input.shiftId) {
      const shift = await this.provider.first<{ id: string }>("SELECT id FROM tenant_shifts WHERE id = ? AND organization_id = ? AND status = 'active' AND (branch_id IS NULL OR branch_id = ?)", [input.shiftId, input.organizationId, input.branchId]);
      if (!shift) throw new Error("El turno no pertenece a la sucursal seleccionada.");
    }
    if (localOperationalDate(branch.timezone, new Date(input.dueAt)) !== input.operationalDate) throw new Error("La fecha límite no corresponde a la fecha operativa en la zona horaria de la sucursal.");
    const assignee = input.assignedToMembershipId ?? member.membershipId;
    const assignedMembership = await this.provider.first<{ id: string }>(`SELECT m.id FROM organization_memberships m WHERE m.id = ? AND m.organization_id = ? AND m.status = 'active'
      AND EXISTS (SELECT 1 FROM membership_scopes s WHERE s.membership_id = m.id AND s.access_mode IN ('read','write','manage') AND ((s.scope_type = 'organization' AND (s.scope_id IS NULL OR s.scope_id = ?)) OR (s.scope_type = 'branch' AND s.scope_id = ?)))
      AND EXISTS (SELECT 1 FROM membership_role_assignments mra JOIN organization_role_permissions rp ON rp.role_id = mra.role_id JOIN organization_permissions p ON p.id = rp.permission_id WHERE mra.membership_id = m.id AND p.code = 'quality.logs.read')`, [assignee, input.organizationId, input.organizationId, input.branchId]);
    if (!assignedMembership) throw new Error("La persona responsable no tiene acceso activo a Calidad en esta sucursal.");
    const logId = crypto.randomUUID();
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `INSERT INTO quality_log_instances (id, organization_id, branch_id, template_version_id, shift_id, operational_date, due_at, status, completion_percentage, deviation_count, assigned_to_membership_id, revision_number, idempotency_key, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, 1, ?, ?, ?, ?, 1)`, values: [logId, input.organizationId, input.branchId, input.templateVersionId, input.shiftId ?? null, input.operationalDate, input.dueAt, assignee, input.idempotencyKey, timestamp, timestamp, member.membershipId] },
      audit(input.organizationId, member.membershipId, "quality.log.scheduled", "quality_log_instance", logId, "Bitácora programada para captura.", { branchId: input.branchId, operationalDate: input.operationalDate, dueAt: input.dueAt }),
      invalidateDashboard(input.organizationId),
    ]);
    return { logId, reused: false };
  }

  async createScheduleRule(identity: TenantActor, input: QualityScheduleRuleInput): Promise<{ ruleId: string; reused: boolean }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.logs.capture", true);
    await this.assertQualityModule(member.organizationId);
    const branch = await this.assertBranch(member, input.branchId, true);
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM quality_schedule_rules WHERE organization_id = ? AND idempotency_key = ?", [input.organizationId, input.idempotencyKey]);
    if (existing) return { ruleId: existing.id, reused: true };
    const template = await this.provider.first<{ rootBranchId: string | null; status: string; scheduleType: string }>(`SELECT rt.branch_id AS rootBranchId, tv.status, tv.schedule_type AS scheduleType FROM quality_template_versions tv JOIN tenant_quality_templates rt ON rt.id = tv.root_template_id WHERE tv.id = ? AND tv.organization_id = ? AND rt.status = 'active'`, [input.templateVersionId, input.organizationId]);
    if (!template || template.status !== "published") throw new Error("La recurrencia necesita una versión publicada de la plantilla.");
    if (template.rootBranchId && template.rootBranchId !== input.branchId) throw new Error("La plantilla no aplica a la sucursal seleccionada.");
    if (input.timezone !== branch.timezone) throw new Error("La recurrencia debe usar la zona horaria de la sucursal.");
    if (input.shiftId) {
      const shift = await this.provider.first<{ id: string }>("SELECT id FROM tenant_shifts WHERE id = ? AND organization_id = ? AND status = 'active' AND (branch_id IS NULL OR branch_id = ?)", [input.shiftId, input.organizationId, input.branchId]);
      if (!shift) throw new Error("El turno no pertenece a esta sucursal.");
    }
    if (input.scheduleType === "per_shift" && !input.shiftId) throw new Error("La recurrencia por turno necesita un turno.");
    const assignee = input.assignedToMembershipId ?? member.membershipId;
    const assigned = await this.provider.first<{ id: string }>(`SELECT m.id FROM organization_memberships m WHERE m.id = ? AND m.organization_id = ? AND m.status = 'active'
      AND EXISTS (SELECT 1 FROM membership_scopes s WHERE s.membership_id = m.id AND s.access_mode IN ('read','write','manage') AND ((s.scope_type = 'organization' AND (s.scope_id IS NULL OR s.scope_id = ?)) OR (s.scope_type = 'branch' AND s.scope_id = ?)))`, [assignee, input.organizationId, input.organizationId, input.branchId]);
    if (!assigned) throw new Error("La persona responsable no tiene acceso activo a esta sucursal.");
    const rule = validateQualityScheduleRule({ scheduleType: input.scheduleType, daysOfWeek: input.daysOfWeek, times: input.times, intervalMinutes: input.intervalMinutes ?? null, timezone: input.timezone, startDate: input.startDate, endDate: input.endDate ?? null });
    const ruleId = crypto.randomUUID();
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `INSERT INTO quality_schedule_rules (id, organization_id, branch_id, template_version_id, shift_id, assigned_to_membership_id, schedule_type, days_of_week_json, times_json, interval_minutes, timezone, start_date, end_date, status, idempotency_key, created_by, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 1)`, values: [ruleId, input.organizationId, input.branchId, input.templateVersionId, input.shiftId ?? null, assignee, rule.scheduleType, JSON.stringify(rule.daysOfWeek), JSON.stringify(rule.times), rule.intervalMinutes, rule.timezone, rule.startDate, rule.endDate, input.idempotencyKey, member.membershipId, timestamp, timestamp] },
      audit(input.organizationId, member.membershipId, "quality.schedule_rule.created", "quality_schedule_rule", ruleId, "Regla de recurrencia creada para bitácoras productivas.", { branchId: input.branchId, templateVersionId: input.templateVersionId, scheduleType: rule.scheduleType, daysOfWeek: rule.daysOfWeek, times: rule.times, intervalMinutes: rule.intervalMinutes }),
      invalidateDashboard(input.organizationId),
    ]);
    return { ruleId, reused: false };
  }

  async generateScheduleRule(identity: TenantActor, input: { organizationId: string; ruleId: string; throughDate: string; idempotencyKey: string }): Promise<{ runId: string; generated: number; reused: number; occurrenceCount: number }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.logs.capture", true);
    await this.assertQualityModule(member.organizationId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.throughDate)) throw new Error("La fecha final de generación no es válida.");
    const runKey = `schedule:${input.ruleId}:${input.idempotencyKey}`;
    const existingRun = await this.provider.first<{ id: string; generatedCount: number; reusedCount: number }>("SELECT id, generated_count AS generatedCount, reused_count AS reusedCount FROM quality_schedule_runs WHERE organization_id = ? AND idempotency_key = ?", [input.organizationId, runKey]);
    if (existingRun) return { runId: existingRun.id, generated: Number(existingRun.generatedCount), reused: Number(existingRun.reusedCount), occurrenceCount: Number(existingRun.generatedCount) + Number(existingRun.reusedCount) };
    const row = await this.provider.first<Record<string, unknown>>(`SELECT r.id, r.branch_id AS branchId, r.template_version_id AS templateVersionId, r.shift_id AS shiftId, r.assigned_to_membership_id AS assignedToMembershipId, r.schedule_type AS scheduleType, r.days_of_week_json AS daysOfWeekJson, r.times_json AS timesJson, r.interval_minutes AS intervalMinutes, r.timezone, r.start_date AS startDate, r.end_date AS endDate, r.status, r.last_generated_through AS lastGeneratedThrough, tv.status AS templateStatus FROM quality_schedule_rules r JOIN quality_template_versions tv ON tv.id = r.template_version_id AND tv.organization_id = r.organization_id WHERE r.id = ? AND r.organization_id = ?`, [input.ruleId, input.organizationId]);
    if (!row || String(row.status) !== "active") throw new Error("La regla de recurrencia no está activa.");
    if (String(row.templateStatus) !== "published") throw new Error("La versión de plantilla de esta recurrencia ya no está publicada.");
    await this.assertBranch(member, String(row.branchId), true);
    const fromDate = row.lastGeneratedThrough ? qualityScheduleNextDate(String(row.lastGeneratedThrough)) : String(row.startDate);
    const maxThrough = new Date(`${fromDate}T00:00:00.000Z`); maxThrough.setUTCDate(maxThrough.getUTCDate() + 31);
    if (new Date(`${input.throughDate}T00:00:00.000Z`) > maxThrough) throw new Error("Genera como máximo 31 días por ejecución para mantener una carga segura.");
    const rule = validateQualityScheduleRule({ scheduleType: String(row.scheduleType) as QualityScheduleRuleInput["scheduleType"], daysOfWeek: parseJson<number[]>(String(row.daysOfWeekJson ?? "[]"), []), times: parseJson<string[]>(String(row.timesJson ?? "[]"), []), intervalMinutes: row.intervalMinutes === null ? null : Number(row.intervalMinutes), timezone: String(row.timezone), startDate: String(row.startDate), endDate: row.endDate ? String(row.endDate) : null });
    const occurrences = expandQualitySchedule(rule, fromDate, input.throughDate, 100);
    const assignee = row.assignedToMembershipId ? String(row.assignedToMembershipId) : member.membershipId;
    const activeAssignee = await this.provider.first<{ id: string }>("SELECT id FROM organization_memberships WHERE id = ? AND organization_id = ? AND status = 'active'", [assignee, input.organizationId]);
    if (!activeAssignee) throw new Error("La persona responsable de esta recurrencia ya no está activa.");
    const runId = crypto.randomUUID();
    const timestamp = nowIso();
    const commands: SqlCommand[] = [];
    const logIds: string[] = [];
    for (const occurrence of occurrences) {
      const logId = crypto.randomUUID();
      logIds.push(logId);
      const key = `rule:${input.ruleId}:${occurrence.operationalDate}:${occurrence.localTime}:${row.shiftId ?? "none"}`;
      commands.push({ sql: `INSERT OR IGNORE INTO quality_log_instances (id, organization_id, branch_id, template_version_id, shift_id, operational_date, due_at, status, completion_percentage, deviation_count, assigned_to_membership_id, revision_number, idempotency_key, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, 1, ?, ?, ?, ?, 1)`, values: [logId, input.organizationId, String(row.branchId), String(row.templateVersionId), row.shiftId ? String(row.shiftId) : null, occurrence.operationalDate, occurrence.dueAt, assignee, key, timestamp, timestamp, member.membershipId] });
    }
    const changes = commands.length ? await this.provider.batch(commands) : [];
    const generated = changes.reduce((sum, value) => sum + (Number(value) > 0 ? 1 : 0), 0);
    const reused = occurrences.length - generated;
    const completedAt = nowIso();
    const generatedAudits: SqlCommand[] = changes.flatMap((change, index) => Number(change) > 0 ? [audit(input.organizationId, member.membershipId, "quality.log.scheduled", "quality_log_instance", logIds[index], "Bitácora generada por una recurrencia productiva.", { ruleId: input.ruleId, operationalDate: occurrences[index]?.operationalDate, dueAt: occurrences[index]?.dueAt })] : []);
    await this.provider.batch([
      ...generatedAudits,
      { sql: `INSERT INTO quality_schedule_runs (id, organization_id, rule_id, generated_through, generated_count, reused_count, status, idempotency_key, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`, values: [runId, input.organizationId, input.ruleId, input.throughDate, generated, reused, runKey, timestamp, completedAt] },
      { sql: `UPDATE quality_schedule_rules SET last_generated_through = CASE WHEN last_generated_through IS NULL OR last_generated_through < ? THEN ? ELSE last_generated_through END, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, values: [input.throughDate, input.throughDate, completedAt, input.ruleId, input.organizationId] },
      audit(input.organizationId, member.membershipId, "quality.schedule_rule.generated", "quality_schedule_rule", input.ruleId, "La recurrencia generó bitácoras productivas idempotentes.", { throughDate: input.throughDate, occurrenceCount: occurrences.length, generated, reused }),
      invalidateDashboard(input.organizationId),
    ]);
    return { runId, generated, reused, occurrenceCount: occurrences.length };
  }

  async saveAnswers(identity: TenantActor, organizationId: string, logId: string, expectedVersion: number, input: QualityAnswerInput[]): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.logs.capture", true);
    await this.assertQualityModule(member.organizationId);
    const log = await this.provider.first<{ branchId: string; templateVersionId: string; status: string; version: number }>("SELECT branch_id AS branchId, template_version_id AS templateVersionId, status, version FROM quality_log_instances WHERE id = ? AND organization_id = ?", [logId, organizationId]);
    if (!log) throw new Error("No se encontró la bitácora.");
    await this.assertBranch(member, log.branchId, true);
    if (!["pending", "in_progress"].includes(log.status)) throw new Error("Una bitácora cerrada es inmutable; crea una corrección.");
    if (log.version !== expectedVersion) throw new Error("La bitácora cambió en otra sesión. Recarga antes de guardar.");
    if (!input.length) throw new Error("No hay respuestas para guardar.");
    const unique = new Map(input.map((answer) => [answer.fieldId, answer]));
    if (unique.size !== input.length) throw new Error("Hay campos repetidos en la captura.");
    const fieldRows = await this.provider.all<FieldRow>(`SELECT id, template_version_id AS templateVersionId, code, label, description, field_type AS fieldType, unit, required, minimum_milli AS minimumMilli, maximum_milli AS maximumMilli, expected_boolean AS expectedBoolean, options_json AS optionsJson, non_compliant_options_json AS nonCompliantOptionsJson, deviation_severity AS deviationSeverity, evidence_required_on_deviation AS evidenceRequiredOnDeviation, display_order AS displayOrder FROM quality_template_fields WHERE template_version_id = ? AND status = 'active'`, [log.templateVersionId]);
    const byId = new Map(fieldRows.map((field) => [field.id, field]));
    for (const fieldId of unique.keys()) if (!byId.has(fieldId)) throw new Error("Uno de los campos no pertenece a esta versión de la plantilla.");
    const existingAnswers = await this.provider.all<{ id: string; fieldId: string }>("SELECT id, field_id AS fieldId FROM quality_log_answers WHERE log_instance_id = ?", [logId]);
    const answerIds = new Map(existingAnswers.map((answer) => [answer.fieldId, answer.id]));
    const timestamp = nowIso();
    const guard = `EXISTS (SELECT 1 FROM quality_log_instances l WHERE l.id = ? AND l.organization_id = ? AND l.status IN ('pending','in_progress') AND l.version = ?)`;
    const guardValues = [logId, organizationId, expectedVersion];
    const commands: SqlCommand[] = [];
    let deviationCount = 0;
    for (const answer of unique.values()) {
      const field = byId.get(answer.fieldId)!;
      const evaluated = evaluateQualityAnswer({ fieldType: field.fieldType, minimumMilli: field.minimumMilli, maximumMilli: field.maximumMilli, expectedBoolean: field.expectedBoolean === null ? null : bool(field.expectedBoolean), options: parseJson(field.optionsJson, []), nonCompliantOptions: parseJson(field.nonCompliantOptionsJson, []) }, answer.value);
      const answerId = answerIds.get(field.id) ?? crypto.randomUUID();
      answerIds.set(field.id, answerId);
      if (evaluated.inRange === false) deviationCount += 1;
      commands.push({
        sql: `INSERT INTO quality_log_answers (id, log_instance_id, field_id, value_type, has_value, value_text, numeric_value_milli, boolean_value, option_value, in_range, notes, captured_at, captured_by, updated_at, version)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE ${guard}
          ON CONFLICT(log_instance_id, field_id) DO UPDATE SET value_type = excluded.value_type, has_value = excluded.has_value, value_text = excluded.value_text, numeric_value_milli = excluded.numeric_value_milli, boolean_value = excluded.boolean_value, option_value = excluded.option_value, in_range = excluded.in_range, notes = excluded.notes, captured_at = excluded.captured_at, captured_by = excluded.captured_by, updated_at = excluded.updated_at, version = quality_log_answers.version + 1`,
        values: [answerId, logId, field.id, evaluated.valueType, evaluated.hasValue ? 1 : 0, evaluated.valueText, evaluated.numericValueMilli, evaluated.booleanValue === null ? null : evaluated.booleanValue ? 1 : 0, evaluated.optionValue, evaluated.inRange === null ? null : evaluated.inRange ? 1 : 0, (answer.notes ?? "").trim().slice(0, 1_000), timestamp, member.membershipId, timestamp, ...guardValues],
      });
      if (evaluated.inRange === false) {
        const correctiveId = crypto.randomUUID();
        commands.push({
          sql: `INSERT INTO quality_corrective_actions (id, organization_id, branch_id, log_instance_id, answer_id, title, description, severity, status, assigned_to_membership_id, due_at, created_at, updated_at, created_by, version)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, 1 WHERE ${guard}
            ON CONFLICT(answer_id) DO UPDATE SET title = excluded.title, description = excluded.description, severity = excluded.severity, status = CASE WHEN quality_corrective_actions.status = 'cancelled' THEN 'open' ELSE quality_corrective_actions.status END, assigned_to_membership_id = COALESCE(quality_corrective_actions.assigned_to_membership_id, excluded.assigned_to_membership_id), due_at = COALESCE(quality_corrective_actions.due_at, excluded.due_at), updated_at = excluded.updated_at, version = quality_corrective_actions.version + 1`,
          values: [correctiveId, organizationId, log.branchId, logId, answerId, `Desviación: ${field.label}`, `El valor capturado quedó fuera del criterio configurado en la versión publicada de la bitácora.`, field.deviationSeverity, member.membershipId, new Date(Date.now() + (field.deviationSeverity === "critical" ? 4 : 24) * 3_600_000).toISOString(), timestamp, timestamp, member.membershipId, ...guardValues],
        });
        commands.push(auditWhen(organizationId, member.membershipId, "quality.corrective.created", "quality_corrective_action", correctiveId, "Acción correctiva creada automáticamente por una desviación.", "EXISTS (SELECT 1 FROM quality_corrective_actions WHERE id = ? AND answer_id = ? AND created_at = ?)", [correctiveId, answerId, timestamp], { logId, answerId, fieldId: field.id, severity: field.deviationSeverity }));
      } else {
        commands.push({ sql: `UPDATE quality_corrective_actions SET status = 'cancelled', resolution = 'El valor fue corregido antes del cierre de la bitácora.', updated_at = ?, version = version + 1 WHERE answer_id = ? AND status IN ('open','assigned','in_progress') AND ${guard}`, values: [timestamp, answerId, ...guardValues] });
      }
    }
    const updateIndex = commands.length;
    commands.push({ sql: `UPDATE quality_log_instances SET status = 'in_progress', started_at = COALESCE(started_at, ?), completion_percentage = COALESCE((SELECT CAST(ROUND(100.0 * SUM(CASE WHEN a.has_value = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(f.id), 0)) AS INTEGER) FROM quality_template_fields f LEFT JOIN quality_log_answers a ON a.field_id = f.id AND a.log_instance_id = quality_log_instances.id WHERE f.template_version_id = quality_log_instances.template_version_id AND f.status = 'active'), 0), deviation_count = (SELECT COUNT(*) FROM quality_log_answers a WHERE a.log_instance_id = quality_log_instances.id AND a.in_range = 0 AND a.has_value = 1), updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status IN ('pending','in_progress') AND version = ?`, values: [timestamp, timestamp, logId, organizationId, expectedVersion] });
    commands.push(auditWhen(organizationId, member.membershipId, "quality.log.answers_saved", "quality_log_instance", logId, "Captura parcial guardada en servidor.", "EXISTS (SELECT 1 FROM quality_log_instances WHERE id = ? AND organization_id = ? AND status = 'in_progress' AND version = ? AND updated_at = ?)", [logId, organizationId, expectedVersion + 1, timestamp], { answerCount: input.length, deviationsInPayload: deviationCount }));
    if (deviationCount > 0) commands.push(auditWhen(organizationId, member.membershipId, "quality.deviation.detected", "quality_log_instance", logId, "La evaluación de servidor detectó una o más desviaciones.", "EXISTS (SELECT 1 FROM quality_log_instances WHERE id = ? AND organization_id = ? AND status = 'in_progress' AND version = ? AND updated_at = ?)", [logId, organizationId, expectedVersion + 1, timestamp], { deviationsInPayload: deviationCount }));
    commands.push(invalidateDashboard(organizationId));
    const changes = await this.provider.batch(commands);
    if ((changes[updateIndex] ?? 0) !== 1) throw new Error("La bitácora cambió en otra sesión. Recarga antes de guardar.");
  }

  async completeLog(identity: TenantActor, organizationId: string, logId: string, expectedVersion: number, signerName: string, signatureStatement: string): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.logs.capture", true);
    await this.assertQualityModule(member.organizationId);
    const log = await this.provider.first<{ branchId: string; status: string; version: number }>("SELECT branch_id AS branchId, status, version FROM quality_log_instances WHERE id = ? AND organization_id = ?", [logId, organizationId]);
    if (!log) throw new Error("No se encontró la bitácora.");
    await this.assertBranch(member, log.branchId, true);
    if (log.status !== "in_progress") throw new Error("La bitácora debe tener capturas antes de cerrarse.");
    if (log.version !== expectedVersion) throw new Error("La bitácora cambió en otra sesión. Recarga antes de cerrar.");
    const missing = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM quality_template_fields f JOIN quality_log_instances l ON l.template_version_id = f.template_version_id LEFT JOIN quality_log_answers a ON a.log_instance_id = l.id AND a.field_id = f.id AND a.has_value = 1 WHERE l.id = ? AND f.status = 'active' AND f.required = 1 AND a.id IS NULL`, [logId]);
    if ((missing?.count ?? 0) > 0) throw new Error(`Faltan ${missing?.count} respuesta(s) obligatoria(s).`);
    const missingEvidence = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM quality_log_answers a JOIN quality_template_fields f ON f.id = a.field_id LEFT JOIN quality_evidence e ON e.answer_id = a.id AND e.status = 'available' WHERE a.log_instance_id = ? AND a.in_range = 0 AND a.has_value = 1 AND f.evidence_required_on_deviation = 1 AND e.id IS NULL`, [logId]);
    if ((missingEvidence?.count ?? 0) > 0) throw new Error(`Falta evidencia en ${missingEvidence?.count} desviación(es) que la requieren.`);
    const timestamp = nowIso();
    const changes = await this.provider.batch([
      { sql: `UPDATE quality_log_instances SET status = 'completed', completion_percentage = 100, completed_at = ?, signed_at = ?, signed_by_membership_id = ?, signer_name_snapshot = ?, signature_statement = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'in_progress' AND version = ?`, values: [timestamp, timestamp, member.membershipId, signerName.trim(), signatureStatement, timestamp, logId, organizationId, expectedVersion] },
      auditWhen(organizationId, member.membershipId, "quality.log.completed", "quality_log_instance", logId, "Bitácora cerrada con confirmación de autoría.", "EXISTS (SELECT 1 FROM quality_log_instances WHERE id = ? AND organization_id = ? AND status = 'completed' AND version = ? AND completed_at = ?)", [logId, organizationId, expectedVersion + 1, timestamp], { signerName: signerName.trim(), completedAt: timestamp }),
      invalidateDashboard(organizationId),
    ]);
    if ((changes[0] ?? 0) !== 1) throw new Error("La bitácora cambió en otra sesión. Recarga antes de cerrar.");
  }

  async createLogRevision(identity: TenantActor, organizationId: string, logId: string, reason: string, idempotencyKey: string): Promise<{ logId: string }> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.logs.capture", true);
    await this.assertQualityModule(member.organizationId);
    const existing = await this.provider.first<{ id: string }>("SELECT id FROM quality_log_instances WHERE organization_id = ? AND idempotency_key = ?", [organizationId, idempotencyKey]);
    if (existing) return { logId: existing.id };
    const source = await this.provider.first<Record<string, unknown>>("SELECT branch_id AS branchId, template_version_id AS templateVersionId, shift_id AS shiftId, operational_date AS operationalDate, due_at AS dueAt, status, completion_percentage AS completionPercentage, deviation_count AS deviationCount, revision_of_log_id AS revisionOfLogId FROM quality_log_instances WHERE id = ? AND organization_id = ?", [logId, organizationId]);
    if (!source) throw new Error("No se encontró la bitácora original.");
    if (String(source.status) !== "completed") throw new Error("Solamente una bitácora cerrada puede originar una corrección.");
    await this.assertBranch(member, String(source.branchId), true);
    const revisionRoot = source.revisionOfLogId ? String(source.revisionOfLogId) : logId;
    const next = await this.provider.first<{ value: number }>("SELECT COALESCE(MAX(revision_number), 1) + 1 AS value FROM quality_log_instances WHERE id = ? OR revision_of_log_id = ?", [revisionRoot, revisionRoot]);
    const newLogId = crypto.randomUUID();
    const timestamp = nowIso();
    const revisionDueAt = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const sourceAnswers = await this.provider.all<{ id: string; fieldId: string; valueType: string; hasValue: unknown; valueText: string | null; numericValueMilli: number | null; booleanValue: unknown | null; optionValue: string | null; inRange: unknown | null; notes: string }>("SELECT id, field_id AS fieldId, value_type AS valueType, has_value AS hasValue, value_text AS valueText, numeric_value_milli AS numericValueMilli, boolean_value AS booleanValue, option_value AS optionValue, in_range AS inRange, notes FROM quality_log_answers WHERE log_instance_id = ?", [logId]);
    const commands: SqlCommand[] = [
      { sql: `INSERT INTO quality_log_instances (id, organization_id, branch_id, template_version_id, shift_id, operational_date, due_at, status, completion_percentage, deviation_count, assigned_to_membership_id, started_at, revision_of_log_id, revision_number, revision_reason, idempotency_key, created_at, updated_at, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [newLogId, organizationId, source.branchId, source.templateVersionId, source.shiftId ?? null, source.operationalDate, revisionDueAt, source.completionPercentage, source.deviationCount, member.membershipId, timestamp, revisionRoot, next?.value ?? 2, reason, idempotencyKey, timestamp, timestamp, member.membershipId] },
    ];
    for (const sourceAnswer of sourceAnswers) {
      const answerId = crypto.randomUUID();
      commands.push({ sql: `INSERT INTO quality_log_answers (id, log_instance_id, field_id, value_type, has_value, value_text, numeric_value_milli, boolean_value, option_value, in_range, notes, captured_at, captured_by, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values: [answerId, newLogId, sourceAnswer.fieldId, sourceAnswer.valueType, bool(sourceAnswer.hasValue) ? 1 : 0, sourceAnswer.valueText, sourceAnswer.numericValueMilli, sourceAnswer.booleanValue === null ? null : bool(sourceAnswer.booleanValue) ? 1 : 0, sourceAnswer.optionValue, sourceAnswer.inRange === null ? null : bool(sourceAnswer.inRange) ? 1 : 0, sourceAnswer.notes, timestamp, member.membershipId, timestamp] });
      if (sourceAnswer.inRange !== null && !bool(sourceAnswer.inRange) && bool(sourceAnswer.hasValue)) commands.push({ sql: `INSERT INTO quality_corrective_actions (id, organization_id, branch_id, log_instance_id, answer_id, title, description, severity, status, assigned_to_membership_id, due_at, created_at, updated_at, created_by, version) SELECT ?, ?, ?, ?, ?, 'Desviación heredada en corrección', 'Revisa el valor copiado de la bitácora original antes de cerrar esta corrección.', f.deviation_severity, 'open', ?, ?, ?, ?, ?, 1 FROM quality_template_fields f WHERE f.id = ?`, values: [crypto.randomUUID(), organizationId, source.branchId, newLogId, answerId, member.membershipId, new Date(Date.now() + 24 * 3_600_000).toISOString(), timestamp, timestamp, member.membershipId, sourceAnswer.fieldId] });
    }
    commands.push(audit(organizationId, member.membershipId, "quality.log.revision_created", "quality_log_instance", newLogId, reason, { sourceLogId: logId, revisionNumber: next?.value ?? 2 }));
    commands.push(invalidateDashboard(organizationId));
    await this.provider.batch(commands);
    return { logId: newLogId };
  }

  async updateCorrectiveAction(identity: TenantActor, input: { organizationId: string; actionId: string; expectedVersion: number; status: "open" | "assigned" | "in_progress" | "resolved" | "cancelled"; assignedToMembershipId?: string | null; rootCause?: string; immediateCorrection?: string; preventiveAction?: string; resolution?: string; dueAt?: string | null }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.corrective.manage", true);
    await this.assertQualityModule(member.organizationId);
    const action = await this.provider.first<{ branchId: string; status: string; version: number; assignedToMembershipId: string | null }>("SELECT branch_id AS branchId, status, version, assigned_to_membership_id AS assignedToMembershipId FROM quality_corrective_actions WHERE id = ? AND organization_id = ?", [input.actionId, input.organizationId]);
    if (!action) throw new Error("No se encontró la acción correctiva.");
    await this.assertBranch(member, action.branchId, true);
    if (["verified", "cancelled"].includes(action.status)) throw new Error("La acción correctiva ya está cerrada.");
    if (action.version !== input.expectedVersion) throw new Error("La acción cambió en otra sesión. Recarga antes de guardar.");
    if (action.status === "resolved" && input.status !== "resolved") throw new Error("Una acción resuelta solamente puede pasar a verificación o permanecer resuelta.");
    const status = input.status;
    const rootCause = (input.rootCause ?? "").trim();
    const immediateCorrection = (input.immediateCorrection ?? "").trim();
    const preventiveAction = (input.preventiveAction ?? "").trim();
    const resolution = (input.resolution ?? "").trim();
    if (status === "resolved" && (rootCause.length < 3 || immediateCorrection.length < 3 || resolution.length < 3)) throw new Error("Para resolver, registra causa raíz, corrección inmediata y solución definitiva.");
    if (status === "cancelled" && resolution.length < 5) throw new Error("Explica por qué se cancela la acción.");
    const assignee = input.assignedToMembershipId === undefined ? action.assignedToMembershipId : input.assignedToMembershipId;
    if (assignee) {
      const assigned = await this.provider.first<{ id: string }>(`SELECT m.id FROM organization_memberships m WHERE m.id = ? AND m.organization_id = ? AND m.status = 'active'
        AND EXISTS (SELECT 1 FROM membership_scopes s WHERE s.membership_id = m.id AND s.access_mode IN ('read','write','manage') AND ((s.scope_type = 'organization' AND (s.scope_id IS NULL OR s.scope_id = ?)) OR (s.scope_type = 'branch' AND s.scope_id = ?)))`, [assignee, input.organizationId, input.organizationId, action.branchId]);
      if (!assigned) throw new Error("La persona responsable no tiene acceso activo a esta sucursal.");
    }
    if (status === "assigned" && !assignee) throw new Error("Una acción asignada necesita una persona responsable.");
    const timestamp = nowIso();
    const changes = await this.provider.batch([
      { sql: `UPDATE quality_corrective_actions SET status = ?, assigned_to_membership_id = ?, root_cause = ?, immediate_correction = ?, preventive_action = ?, resolution = ?, due_at = ?, resolved_at = CASE WHEN ? = 'resolved' THEN COALESCE(resolved_at, ?) WHEN ? IN ('open','assigned','in_progress') THEN NULL ELSE resolved_at END, resolved_by = CASE WHEN ? = 'resolved' THEN COALESCE(resolved_by, ?) WHEN ? IN ('open','assigned','in_progress') THEN NULL ELSE resolved_by END, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND version = ? AND status NOT IN ('verified','cancelled')`, values: [status, assignee, rootCause || null, immediateCorrection || null, preventiveAction || null, resolution || null, input.dueAt ?? null, status, timestamp, status, status, member.membershipId, status, timestamp, input.actionId, input.organizationId, input.expectedVersion] },
      auditWhen(input.organizationId, member.membershipId, "quality.corrective.updated", "quality_corrective_action", input.actionId, status === "resolved" ? "Acción correctiva resuelta; queda pendiente de verificación." : "Seguimiento de acción correctiva actualizado.", "EXISTS (SELECT 1 FROM quality_corrective_actions WHERE id = ? AND organization_id = ? AND status = ? AND version = ? AND updated_at = ?)", [input.actionId, input.organizationId, status, input.expectedVersion + 1, timestamp], { fromStatus: action.status, toStatus: status, assignedToMembershipId: assignee }),
      invalidateDashboard(input.organizationId),
    ]);
    if ((changes[0] ?? 0) !== 1) throw new Error("La acción cambió en otra sesión. Recarga antes de guardar.");
  }

  async verifyCorrectiveAction(identity: TenantActor, input: { organizationId: string; actionId: string; expectedVersion: number; verificationNotes: string }): Promise<void> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.corrective.manage", true);
    await this.assertQualityModule(member.organizationId);
    const action = await this.provider.first<{ branchId: string; status: string; version: number; answerId: string | null }>("SELECT branch_id AS branchId, status, version, answer_id AS answerId FROM quality_corrective_actions WHERE id = ? AND organization_id = ?", [input.actionId, input.organizationId]);
    if (!action) throw new Error("No se encontró la acción correctiva.");
    await this.assertBranch(member, action.branchId, true);
    if (action.status !== "resolved") throw new Error("Solamente una acción resuelta puede verificarse.");
    if (action.version !== input.expectedVersion) throw new Error("La acción cambió en otra sesión. Recarga antes de verificar.");
    const notes = input.verificationNotes.trim();
    if (notes.length < 3) throw new Error("Registra cómo se verificó la eficacia de la corrección.");
    if (action.answerId) {
      const evidenceRequired = await this.provider.first<{ required: number }>(`SELECT CASE WHEN f.evidence_required_on_deviation = 1 THEN 1 ELSE 0 END AS required
        FROM quality_log_answers a JOIN quality_template_fields f ON f.id = a.field_id WHERE a.id = ?`, [action.answerId]);
      if ((evidenceRequired?.required ?? 0) === 1) {
        const evidence = await this.provider.first<{ count: number }>(`SELECT COUNT(*) AS count FROM quality_evidence WHERE status = 'available' AND (answer_id = ? OR corrective_action_id = ?)`, [action.answerId, input.actionId]);
        if ((evidence?.count ?? 0) < 1) throw new Error("Falta evidencia para verificar esta desviación.");
      }
    }
    const timestamp = nowIso();
    const changes = await this.provider.batch([
      { sql: `UPDATE quality_corrective_actions SET status = 'verified', verification_notes = ?, verified_at = ?, verified_by = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'resolved' AND version = ?`, values: [notes, timestamp, member.membershipId, timestamp, input.actionId, input.organizationId, input.expectedVersion] },
      auditWhen(input.organizationId, member.membershipId, "quality.corrective.verified", "quality_corrective_action", input.actionId, "Supervisor verificó la acción correctiva.", "EXISTS (SELECT 1 FROM quality_corrective_actions WHERE id = ? AND organization_id = ? AND status = 'verified' AND version = ? AND verified_at = ?)", [input.actionId, input.organizationId, input.expectedVersion + 1, timestamp], { verificationNotes: notes }),
      invalidateDashboard(input.organizationId),
    ]);
    if ((changes[0] ?? 0) !== 1) throw new Error("La acción cambió en otra sesión. Recarga antes de verificar.");
  }

  async authorizeEvidenceUpload(identity: TenantActor, input: { organizationId: string; logId: string; answerId?: string | null; correctiveActionId?: string | null }): Promise<QualityEvidenceAuthorization> {
    await this.ensureCatalog();
    const member = await this.membership(identity, input.organizationId, "quality.evidence.upload", true);
    await this.assertQualityModule(member.organizationId);
    const log = await this.provider.first<{ branchId: string; status: string }>("SELECT branch_id AS branchId, status FROM quality_log_instances WHERE id = ? AND organization_id = ?", [input.logId, input.organizationId]);
    if (!log) throw new Error("No se encontró la bitácora para adjuntar evidencia.");
    if (log.status === "cancelled") throw new Error("No se puede adjuntar evidencia a una bitácora cancelada.");
    await this.assertBranch(member, log.branchId, true);
    if (input.answerId) {
      const answer = await this.provider.first<{ id: string }>("SELECT id FROM quality_log_answers WHERE id = ? AND log_instance_id = ?", [input.answerId, input.logId]);
      if (!answer) throw new Error("La respuesta no pertenece a esta bitácora.");
    }
    if (input.correctiveActionId) {
      const action = await this.provider.first<{ id: string }>("SELECT id FROM quality_corrective_actions WHERE id = ? AND log_instance_id = ? AND organization_id = ?", [input.correctiveActionId, input.logId, input.organizationId]);
      if (!action) throw new Error("La acción correctiva no pertenece a esta bitácora.");
    }
    return { membershipId: member.membershipId, organizationId: input.organizationId, branchId: log.branchId, logInstanceId: input.logId, answerId: input.answerId ?? null, correctiveActionId: input.correctiveActionId ?? null };
  }

  async recordEvidence(input: QualityEvidenceAuthorization & { evidenceId: string; objectKey: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string; note: string; evidenceType: "general" | "before" | "after" | "document" }): Promise<void> {
    const timestamp = nowIso();
    await this.provider.batch([
      { sql: `INSERT INTO quality_evidence (id, organization_id, branch_id, log_instance_id, answer_id, corrective_action_id, object_key, file_name, mime_type, size_bytes, sha256, note, evidence_type, status, captured_at, captured_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, 1)`, values: [input.evidenceId, input.organizationId, input.branchId, input.logInstanceId, input.answerId, input.correctiveActionId, input.objectKey, input.fileName, input.mimeType, input.sizeBytes, input.sha256, input.note, input.evidenceType, timestamp, input.membershipId] },
      audit(input.organizationId, input.membershipId, "quality.evidence.uploaded", "quality_evidence", input.evidenceId, "Evidencia privada adjuntada a la bitácora.", { logId: input.logInstanceId, mimeType: input.mimeType, sizeBytes: input.sizeBytes, sha256: input.sha256 }),
      invalidateDashboard(input.organizationId),
    ]);
  }

  async evidence(identity: TenantActor, organizationId: string, evidenceId: string): Promise<QualityEvidenceDownload> {
    await this.ensureCatalog();
    const member = await this.membership(identity, organizationId, "quality.logs.read");
    await this.assertQualityModule(member.organizationId);
    const row = await this.provider.first<{ branchId: string; objectKey: string; fileName: string; mimeType: string; sizeBytes: number }>(`SELECT e.branch_id AS branchId, e.object_key AS objectKey, e.file_name AS fileName, e.mime_type AS mimeType, e.size_bytes AS sizeBytes FROM quality_evidence e JOIN quality_log_instances l ON l.id = e.log_instance_id WHERE e.id = ? AND e.organization_id = ? AND e.status = 'available' AND l.organization_id = e.organization_id`, [evidenceId, organizationId]);
    if (!row) throw new Error("No se encontró la evidencia.");
    await this.assertBranch(member, row.branchId, false);
    return { objectKey: row.objectKey, fileName: row.fileName, mimeType: row.mimeType, sizeBytes: Number(row.sizeBytes) };
  }
}
