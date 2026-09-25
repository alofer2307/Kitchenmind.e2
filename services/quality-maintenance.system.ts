import { expandQualitySchedule, qualityScheduleNextDate, validateQualityScheduleRule } from "@/rules/quality-schedule.rules";
import { localOperationalDate } from "@/rules/quality.rules";

interface RunResult { success: boolean; error?: string; meta?: { changes?: number } }
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ success: boolean; error?: string; results: T[] }>;
  run(): Promise<RunResult>;
}
export interface QualityMaintenanceDatabase {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<RunResult[]>;
}

interface ScheduleRow {
  id: string;
  organizationId: string;
  branchId: string;
  templateVersionId: string;
  shiftId: string | null;
  assignedToMembershipId: string | null;
  scheduleType: "daily" | "per_shift" | "days" | "multiple_daily" | "interval" | "adhoc";
  daysOfWeekJson: string;
  timesJson: string;
  intervalMinutes: number | null;
  timezone: string;
  startDate: string;
  endDate: string | null;
  lastGeneratedThrough: string | null;
  createdBy: string;
}

const iso = (date: Date) => date.toISOString();
const json = <T>(value: string, fallback: T): T => { try { return JSON.parse(value) as T; } catch { return fallback; } };

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function all<T>(database: QualityMaintenanceDatabase, sql: string, values: unknown[] = []): Promise<T[]> {
  const result = await database.prepare(sql).bind(...values).all<T>();
  if (!result.success) throw new Error(result.error ?? "No fue posible ejecutar mantenimiento de Calidad.");
  return result.results;
}

async function run(database: QualityMaintenanceDatabase, sql: string, values: unknown[] = []): Promise<number> {
  const result = await database.prepare(sql).bind(...values).run();
  if (!result.success) throw new Error(result.error ?? "No fue posible ejecutar mantenimiento de Calidad.");
  return Number(result.meta?.changes ?? 0);
}

async function generateRules(database: QualityMaintenanceDatabase, now: Date, organizationId?: string): Promise<{ generated: number; reused: number; processedRules: number }> {
  const entitlementAt = iso(now);
  const entitlementValues: unknown[] = [entitlementAt, entitlementAt, entitlementAt, entitlementAt, entitlementAt, entitlementAt];
  if (organizationId) entitlementValues.push(organizationId);
  const rules = await all<ScheduleRow>(database, `SELECT r.id, r.organization_id AS organizationId, r.branch_id AS branchId, r.template_version_id AS templateVersionId,
    r.shift_id AS shiftId, r.assigned_to_membership_id AS assignedToMembershipId, r.schedule_type AS scheduleType,
    r.days_of_week_json AS daysOfWeekJson, r.times_json AS timesJson, r.interval_minutes AS intervalMinutes, r.timezone,
    r.start_date AS startDate, r.end_date AS endDate, r.last_generated_through AS lastGeneratedThrough, r.created_by AS createdBy
    FROM quality_schedule_rules r
    JOIN tenant_organizations o ON o.id = r.organization_id AND o.deleted_at IS NULL AND o.status = 'active'
    JOIN tenant_branches b ON b.id = r.branch_id AND b.organization_id = r.organization_id AND b.status = 'active'
    JOIN quality_template_versions tv ON tv.id = r.template_version_id AND tv.organization_id = r.organization_id AND tv.status = 'published'
    WHERE r.status = 'active'
      AND (
        EXISTS (
          SELECT 1 FROM organization_feature_overrides fo
          WHERE fo.organization_id = r.organization_id AND fo.target_type = 'module' AND fo.module_code = 'QUALITY'
            AND fo.status = 'active' AND fo.effective_from <= ? AND fo.effective_until > ? AND fo.enabled = 1
        )
        OR (
          NOT EXISTS (
            SELECT 1 FROM organization_feature_overrides fo
            WHERE fo.organization_id = r.organization_id AND fo.target_type = 'module' AND fo.module_code = 'QUALITY'
              AND fo.status = 'active' AND fo.effective_from <= ? AND fo.effective_until > ?
          )
          AND EXISTS (
            SELECT 1 FROM organization_entitlements e
            WHERE e.organization_id = r.organization_id AND e.module_code = 'QUALITY' AND e.enabled = 1 AND e.status = 'active'
              AND e.effective_from <= ? AND (e.effective_until IS NULL OR e.effective_until > ?)
          )
        )
      )
      ${organizationId ? "AND r.organization_id = ?" : ""}
    ORDER BY r.organization_id, r.id LIMIT 500`, entitlementValues);
  let generated = 0;
  let reused = 0;
  for (const rule of rules) {
    const localThrough = localOperationalDate(rule.timezone, now);
    const fromDate = rule.lastGeneratedThrough ? qualityScheduleNextDate(rule.lastGeneratedThrough) : rule.startDate;
    if (localThrough < fromDate) continue;
    const throughDate = [localThrough, addDays(fromDate, 30), rule.endDate ?? localThrough].sort()[0];
    const definition = validateQualityScheduleRule({
      scheduleType: rule.scheduleType,
      daysOfWeek: json<number[]>(rule.daysOfWeekJson, []),
      times: json<string[]>(rule.timesJson, []),
      intervalMinutes: rule.intervalMinutes,
      timezone: rule.timezone,
      startDate: rule.startDate,
      endDate: rule.endDate,
    });
    const occurrences = expandQualitySchedule(definition, fromDate, throughDate, 200);
    const creator = rule.assignedToMembershipId ?? rule.createdBy;
    const startedAt = iso(now);
    const scheduled = occurrences.map((occurrence) => {
      const key = `rule:${rule.id}:${occurrence.operationalDate}:${occurrence.localTime}:${rule.shiftId ?? "none"}`;
      const logId = crypto.randomUUID();
      return {
        logId,
        occurrence,
        statement: database.prepare(`INSERT OR IGNORE INTO quality_log_instances
          (id, organization_id, branch_id, template_version_id, shift_id, operational_date, due_at, status, completion_percentage, deviation_count,
           assigned_to_membership_id, revision_number, idempotency_key, created_at, updated_at, created_by, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, 1, ?, ?, ?, ?, 1)`).bind(
            logId, rule.organizationId, rule.branchId, rule.templateVersionId, rule.shiftId,
            occurrence.operationalDate, occurrence.dueAt, rule.assignedToMembershipId ?? creator, key, startedAt, startedAt, creator,
          ),
      };
    });
    const results = scheduled.length ? await database.batch(scheduled.map((entry) => entry.statement)) : [];
    const inserted = results.reduce((sum, item) => sum + (Number(item.meta?.changes ?? 0) > 0 ? 1 : 0), 0);
    for (let index = 0; index < results.length; index += 1) {
      if (Number(results[index]?.meta?.changes ?? 0) <= 0) continue;
      const entry = scheduled[index];
      await run(database, `INSERT INTO organization_audit_events
        (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at)
        VALUES (?, ?, 'system', 'quality_scheduler', 'quality.log.scheduled', 'quality_log_instance', ?, 'success', ?, ?, ?)`,
        [crypto.randomUUID(), rule.organizationId, entry.logId, "Bitácora generada automáticamente por recurrencia.", JSON.stringify({ ruleId: rule.id, operationalDate: entry.occurrence.operationalDate, dueAt: entry.occurrence.dueAt }), startedAt]);
    }
    generated += inserted;
    reused += occurrences.length - inserted;
    const completedAt = iso(new Date());
    const runKey = `scheduled:${rule.id}:${throughDate}`;
    await run(database, `INSERT OR IGNORE INTO quality_schedule_runs
      (id, organization_id, rule_id, generated_through, generated_count, reused_count, status, idempotency_key, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`, [crypto.randomUUID(), rule.organizationId, rule.id, throughDate, inserted, occurrences.length - inserted, runKey, startedAt, completedAt]);
    await run(database, `UPDATE quality_schedule_rules SET last_generated_through = CASE WHEN last_generated_through IS NULL OR last_generated_through < ? THEN ? ELSE last_generated_through END,
      updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`, [throughDate, throughDate, completedAt, rule.id, rule.organizationId]);
    await run(database, `INSERT INTO organization_audit_events
      (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at)
      VALUES (?, ?, 'system', 'quality_scheduler', 'quality.schedule_rule.generated', 'quality_schedule_rule', ?, 'success', ?, ?, ?)`,
      [crypto.randomUUID(), rule.organizationId, rule.id, "Scheduler materializó bitácoras recurrentes.", JSON.stringify({ throughDate, generated: inserted, reused: occurrences.length - inserted }), completedAt]);
    await run(database, "DELETE FROM dashboard_cache_entries WHERE organization_id = ?", [rule.organizationId]);
  }
  return { generated, reused, processedRules: rules.length };
}

async function escalateOverdue(database: QualityMaintenanceDatabase, now: Date, organizationId?: string): Promise<number> {
  const nowIso = iso(now);
  const entitlementValues: unknown[] = [nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso];
  if (organizationId) entitlementValues.push(organizationId);
  const rows = await all<{ id: string; organizationId: string; branchId: string; dueAt: string; assignedToMembershipId: string | null }>(database, `SELECT l.id, l.organization_id AS organizationId, l.branch_id AS branchId, l.due_at AS dueAt, l.assigned_to_membership_id AS assignedToMembershipId
    FROM quality_log_instances l JOIN tenant_organizations o ON o.id = l.organization_id AND o.status = 'active' AND o.deleted_at IS NULL
    WHERE l.status IN ('pending','in_progress') AND l.due_at < ?
      AND (
        EXISTS (
          SELECT 1 FROM organization_feature_overrides fo
          WHERE fo.organization_id = l.organization_id AND fo.target_type = 'module' AND fo.module_code = 'QUALITY'
            AND fo.status = 'active' AND fo.effective_from <= ? AND fo.effective_until > ? AND fo.enabled = 1
        )
        OR (
          NOT EXISTS (
            SELECT 1 FROM organization_feature_overrides fo
            WHERE fo.organization_id = l.organization_id AND fo.target_type = 'module' AND fo.module_code = 'QUALITY'
              AND fo.status = 'active' AND fo.effective_from <= ? AND fo.effective_until > ?
          )
          AND EXISTS (
            SELECT 1 FROM organization_entitlements e
            WHERE e.organization_id = l.organization_id AND e.module_code = 'QUALITY' AND e.enabled = 1 AND e.status = 'active'
              AND e.effective_from <= ? AND (e.effective_until IS NULL OR e.effective_until > ?)
          )
        )
      )
      ${organizationId ? "AND l.organization_id = ?" : ""}
    ORDER BY l.due_at LIMIT 1000`, entitlementValues);
  let escalated = 0;
  for (const log of rows) {
    const minutesLate = Math.max(0, Math.floor((now.getTime() - new Date(log.dueAt).getTime()) / 60_000));
    const levels = [
      { level: 1, min: 15, severity: "warning", reason: "Bitácora vencida por 15 minutos." },
      { level: 2, min: 30, severity: "warning", reason: "Bitácora vencida por 30 minutos; requiere seguimiento de supervisión." },
      { level: 3, min: 60, severity: "critical", reason: "Bitácora vencida por 60 minutos; escalamiento crítico." },
    ];
    for (const level of levels) {
      if (minutesLate < level.min) continue;
      const escalationId = crypto.randomUUID();
      const created = await run(database, `INSERT OR IGNORE INTO quality_log_escalations
        (id, organization_id, branch_id, log_instance_id, level, severity, reason, escalated_to_membership_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [escalationId, log.organizationId, log.branchId, log.id, level.level, level.severity, level.reason, log.assignedToMembershipId, nowIso]);
      if (created) {
        escalated += 1;
        await run(database, `INSERT INTO organization_audit_events
          (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at)
          VALUES (?, ?, 'system', 'quality_scheduler', 'quality.log.escalated', 'quality_log_instance', ?, 'success', ?, ?, ?)`,
          [crypto.randomUUID(), log.organizationId, log.id, level.reason, JSON.stringify({ level: level.level, severity: level.severity, minutesLate }), nowIso]);
        await run(database, "DELETE FROM dashboard_cache_entries WHERE organization_id = ?", [log.organizationId]);
      }
    }
  }
  return escalated;
}

export async function runQualityScheduledMaintenance(database: QualityMaintenanceDatabase, options: { now?: Date; organizationId?: string } = {}) {
  const now = options.now ?? new Date();
  const recurrence = await generateRules(database, now, options.organizationId);
  const escalations = await escalateOverdue(database, now, options.organizationId);
  return { ...recurrence, escalations, completedAt: iso(new Date()) };
}
