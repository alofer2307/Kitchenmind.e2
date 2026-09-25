import "server-only";
import { z } from "zod";
import { requireEvidenceBucket } from "@/db/runtime";
import { D1QualityDataProvider } from "@/providers/d1-quality.provider";
import { D1QualityRepository } from "@/repositories/d1-quality.repository";
import { buildQualityCsv, buildQualityPdf, buildQualityReportCsv, buildQualityReportPdf, buildQualityReportXlsx, buildQualityXlsx, qualityExportFilename, qualityReportFilename } from "@/services/quality-export";
import { normalizeDashboardPeriod } from "@/rules/dashboard.rules";
import type { TenantActor } from "@/types";
import { toResponseBody } from "@/utils/response-body";

export class QualityApplicationError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "quality_invalid_request") {
    super(message);
    this.name = "QualityApplicationError";
  }
}

function parse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new QualityApplicationError(result.error.issues[0]?.message ?? "Revisa los datos enviados.");
  return result.data;
}

const idSchema = z.string().uuid();
const nullableId = z.union([idSchema, z.null()]).optional();
const idempotencySchema = z.string().trim().min(16).max(200);
const operationalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "La fecha operativa no es válida.");
const fieldSchema = z.object({
  code: z.string().trim().max(50).optional(),
  label: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  fieldType: z.enum(["number", "boolean", "text", "select"]),
  unit: z.union([z.string().trim().max(30), z.null()]).optional(),
  required: z.boolean().optional(),
  minimum: z.union([z.number().finite().min(-1_000_000).max(1_000_000), z.null()]).optional(),
  maximum: z.union([z.number().finite().min(-1_000_000).max(1_000_000), z.null()]).optional(),
  expectedBoolean: z.union([z.boolean(), z.null()]).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  nonCompliantOptions: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  deviationSeverity: z.enum(["warning", "critical"]).optional(),
  evidenceRequiredOnDeviation: z.boolean().optional(),
}).strict();
const templateBody = z.object({
  code: z.string().trim().min(1).max(50), name: z.string().trim().min(2).max(180),
  category: z.enum(["temperature", "water", "receiving", "cleaning", "hygiene", "other"]),
  instructions: z.string().trim().max(2_000), scheduleType: z.enum(["adhoc", "daily", "per_shift", "days", "multiple_daily", "interval"]),
  defaultDueTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.null()]).optional(),
  fields: z.array(fieldSchema).min(1).max(40),
});
const createTemplateSchema = templateBody.extend({ organizationId: idSchema, rootTemplateId: nullableId, branchId: nullableId, idempotencyKey: idempotencySchema }).strict();
const updateTemplateSchema = templateBody.extend({ organizationId: idSchema, templateVersionId: idSchema, expectedVersion: z.number().int().positive() }).strict();
const versionActionSchema = z.object({ organizationId: idSchema, templateVersionId: idSchema, expectedVersion: z.number().int().positive() }).strict();
const revisionSchema = z.object({ organizationId: idSchema, templateVersionId: idSchema, reason: z.string().trim().min(5).max(1_000), idempotencyKey: idempotencySchema }).strict();
const scheduleSchema = z.object({
  organizationId: idSchema, branchId: idSchema, templateVersionId: idSchema, shiftId: nullableId,
  operationalDate: operationalDateSchema, dueAt: z.string().datetime(), assignedToMembershipId: nullableId, idempotencyKey: idempotencySchema,
}).strict();
const scheduleRuleSchema = z.object({
  organizationId: idSchema, branchId: idSchema, templateVersionId: idSchema, shiftId: nullableId, assignedToMembershipId: nullableId,
  scheduleType: z.enum(["daily", "per_shift", "days", "multiple_daily", "interval", "adhoc"]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7), times: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).max(48),
  intervalMinutes: z.union([z.number().int().min(15).max(720), z.null()]).optional(), timezone: z.string().trim().min(1).max(100), startDate: operationalDateSchema, endDate: z.union([operationalDateSchema, z.null()]).optional(), idempotencyKey: idempotencySchema,
}).strict();
const generateScheduleRuleSchema = z.object({ organizationId: idSchema, ruleId: idSchema, throughDate: operationalDateSchema, idempotencyKey: idempotencySchema }).strict();
const answerSchema = z.object({ fieldId: idSchema, value: z.union([z.string().max(2_000), z.number().finite(), z.boolean(), z.null()]), notes: z.string().trim().max(1_000).optional() }).strict();
const saveAnswersSchema = z.object({ organizationId: idSchema, logId: idSchema, expectedVersion: z.number().int().positive(), answers: z.array(answerSchema).min(1).max(40) }).strict();
const completeSchema = z.object({ organizationId: idSchema, logId: idSchema, expectedVersion: z.number().int().positive(), signerName: z.string().trim().min(2).max(160), confirmed: z.literal(true) }).strict();
const logRevisionSchema = z.object({ organizationId: idSchema, logId: idSchema, reason: z.string().trim().min(5).max(1_000), idempotencyKey: idempotencySchema }).strict();
const correctiveSchema = z.object({ organizationId: idSchema, actionId: idSchema, expectedVersion: z.number().int().positive(), status: z.enum(["open", "assigned", "in_progress", "resolved", "cancelled"]), assignedToMembershipId: nullableId, rootCause: z.string().trim().max(2_000).optional(), immediateCorrection: z.string().trim().max(2_000).optional(), preventiveAction: z.string().trim().max(2_000).optional(), resolution: z.string().trim().max(2_000).optional(), dueAt: z.union([z.string().datetime(), z.null()]).optional() }).strict();
const verifyCorrectiveSchema = z.object({ organizationId: idSchema, actionId: idSchema, expectedVersion: z.number().int().positive(), verificationNotes: z.string().trim().min(3).max(2_000) }).strict();

export class TenantQualityService {
  private readonly repository = new D1QualityRepository(new D1QualityDataProvider());
  constructor(private readonly identity: TenantActor | null) {}

  private requireIdentity(): TenantActor {
    if (!this.identity) throw new QualityApplicationError("Inicia sesión para abrir Calidad.", 401, "authentication_required");
    return this.identity;
  }

  private async assertMutationRate(): Promise<void> {
    const identity = this.requireIdentity();
    const since = new Date(Date.now() - 60_000).toISOString();
    const provider = new D1QualityDataProvider();
    const row = await provider.first<{ count: number }>(`SELECT COUNT(*) AS count
      FROM organization_audit_events e
      JOIN organization_memberships m ON m.id = e.actor_id AND e.actor_type = 'customer_membership'
      JOIN customer_users u ON u.id = m.user_id
      WHERE u.auth_user_id = ? AND u.email = ? AND e.action LIKE 'quality.%' AND e.created_at >= ?`, [identity.authUserId, identity.email.trim().toLowerCase(), since]);
    if ((row?.count ?? 0) >= 120) throw new QualityApplicationError("Demasiadas operaciones de Calidad en poco tiempo. Espera un minuto.", 429, "quality_rate_limited");
  }

  async snapshot(params: { organizationId?: string | null; branchId?: string | null; period?: string | null; logId?: string | null }) {
    return this.repository.snapshot(this.requireIdentity(), {
      organizationId: params.organizationId ? parse(idSchema, params.organizationId) : undefined,
      branchId: params.branchId && params.branchId !== "all" ? parse(idSchema, params.branchId) : null,
      period: normalizeDashboardPeriod(params.period),
      selectedLogId: params.logId ? parse(idSchema, params.logId) : null,
    });
  }

  async createTemplate(value: unknown) { await this.assertMutationRate(); return this.repository.createTemplate(this.requireIdentity(), parse(createTemplateSchema, value)); }
  async updateTemplate(value: unknown) { await this.assertMutationRate(); const input = parse(updateTemplateSchema, value); await this.repository.updateDraftTemplate(this.requireIdentity(), input); return { updated: true }; }
  async publishTemplate(value: unknown) { await this.assertMutationRate(); const input = parse(versionActionSchema, value); await this.repository.publishTemplate(this.requireIdentity(), input.organizationId, input.templateVersionId, input.expectedVersion); return { published: true }; }
  async createTemplateRevision(value: unknown) { await this.assertMutationRate(); const input = parse(revisionSchema, value); return this.repository.createTemplateRevision(this.requireIdentity(), input.organizationId, input.templateVersionId, input.reason, input.idempotencyKey); }
  async scheduleLog(value: unknown) { await this.assertMutationRate(); return this.repository.scheduleLog(this.requireIdentity(), parse(scheduleSchema, value)); }
  async createScheduleRule(value: unknown) { await this.assertMutationRate(); return this.repository.createScheduleRule(this.requireIdentity(), parse(scheduleRuleSchema, value)); }
  async generateScheduleRule(value: unknown) { await this.assertMutationRate(); return this.repository.generateScheduleRule(this.requireIdentity(), parse(generateScheduleRuleSchema, value)); }
  async saveAnswers(value: unknown) { await this.assertMutationRate(); const input = parse(saveAnswersSchema, value); await this.repository.saveAnswers(this.requireIdentity(), input.organizationId, input.logId, input.expectedVersion, input.answers); return { saved: true }; }
  async completeLog(value: unknown) { await this.assertMutationRate(); const input = parse(completeSchema, value); await this.repository.completeLog(this.requireIdentity(), input.organizationId, input.logId, input.expectedVersion, input.signerName, "Confirmo que capturé o revisé esta bitácora y que la información registrada corresponde a la operación observada."); return { completed: true }; }
  async createLogRevision(value: unknown) { await this.assertMutationRate(); const input = parse(logRevisionSchema, value); return this.repository.createLogRevision(this.requireIdentity(), input.organizationId, input.logId, input.reason, input.idempotencyKey); }
  async updateCorrective(value: unknown) { await this.assertMutationRate(); const input = parse(correctiveSchema, value); await this.repository.updateCorrectiveAction(this.requireIdentity(), input); return { updated: true }; }
  async verifyCorrective(value: unknown) { await this.assertMutationRate(); const input = parse(verifyCorrectiveSchema, value); await this.repository.verifyCorrectiveAction(this.requireIdentity(), input); return { verified: true }; }

  async uploadEvidence(formData: FormData) {
    await this.assertMutationRate();
    const identity = this.requireIdentity();
    const organizationId = parse(idSchema, formData.get("organizationId"));
    const logId = parse(idSchema, formData.get("logId"));
    const optionalId = (name: string) => {
      const value = formData.get(name);
      return typeof value === "string" && value ? parse(idSchema, value) : null;
    };
    const file = formData.get("file");
    if (!(file instanceof File)) throw new QualityApplicationError("Selecciona un archivo para adjuntar.");
    if (file.size <= 0 || file.size > 5_000_000) throw new QualityApplicationError("La evidencia debe pesar entre 1 byte y 5 MB.", 413, "quality_evidence_too_large");
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(file.type)) throw new QualityApplicationError("Usa una imagen JPG, PNG, WEBP o un PDF.", 415, "quality_evidence_type_not_allowed");
    const authorization = await this.repository.authorizeEvidenceUpload(identity, { organizationId, logId, answerId: optionalId("answerId"), correctiveActionId: optionalId("correctiveActionId") });
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const evidenceId = crypto.randomUUID();
    const extension = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] ?? "bin";
    const objectKey = `quality/${organizationId}/${logId}/${evidenceId}.${extension}`;
    const safeName = file.name.replace(/[\r\n\0/\\]/g, "_").slice(0, 180) || `evidencia.${extension}`;
    const note = String(formData.get("note") ?? "").trim().slice(0, 1_000);
    const requestedEvidenceType = String(formData.get("evidenceType") ?? (file.type === "application/pdf" ? "document" : "general"));
    const evidenceType = (["general", "before", "after", "document"] as const).includes(requestedEvidenceType as "general" | "before" | "after" | "document") ? requestedEvidenceType as "general" | "before" | "after" | "document" : "general";
    const bucket = requireEvidenceBucket();
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { organizationId, logId, sha256 } });
    try {
      await this.repository.recordEvidence({ ...authorization, evidenceId, objectKey, fileName: safeName, mimeType: file.type, sizeBytes: file.size, sha256, note, evidenceType });
    } catch (error) {
      await bucket.delete(objectKey).catch(() => undefined);
      throw error;
    }
    return { evidenceId };
  }


  async exportLog(params: { organizationId: string; logId: string; format: string }): Promise<Response> {
    const organizationId = parse(idSchema, params.organizationId);
    const logId = parse(idSchema, params.logId);
    const format = parse(z.enum(["pdf", "csv", "xlsx"]), params.format);
    const identity = this.requireIdentity();
    await this.repository.authorizeExport(identity, organizationId);
    const snapshot = await this.repository.snapshot(identity, { organizationId, branchId: null, period: "last_30_days", selectedLogId: logId });
    const log = snapshot.logs.find((item) => item.id === logId);
    if (!log) throw new QualityApplicationError("No se encontró la bitácora dentro de tu alcance autorizado.", 404, "quality_not_found");
    const bytes = format === "pdf" ? buildQualityPdf(snapshot, log) : format === "xlsx" ? buildQualityXlsx(snapshot, log) : buildQualityCsv(snapshot, log);
    const contentType = format === "pdf" ? "application/pdf" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8";
    const provider = new D1QualityDataProvider();
    await provider.run(`INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, 'customer_membership', ?, 'quality.export.generated', 'quality_log_instance', ?, 'success', ?, ?, ?)`, [crypto.randomUUID(), snapshot.organization.id, snapshot.membership.id, log.id, `Exportación ${format.toUpperCase()} generada.`, JSON.stringify({ format }), new Date().toISOString()]);
    return new Response(toResponseBody(bytes), { headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${qualityExportFilename(snapshot, log, format)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    } });
  }

  async exportReport(params: { organizationId: string; branchId?: string | null; format: string }): Promise<Response> {
    const organizationId = parse(idSchema, params.organizationId);
    const branchId = params.branchId ? parse(idSchema, params.branchId) : null;
    const format = parse(z.enum(["pdf", "csv", "xlsx"]), params.format);
    const identity = this.requireIdentity();
    await this.repository.authorizeExport(identity, organizationId);
    const snapshot = await this.repository.snapshot(identity, { organizationId, branchId, period: "month", selectedLogId: null });
    const bytes = format === "pdf" ? buildQualityReportPdf(snapshot) : format === "xlsx" ? buildQualityReportXlsx(snapshot) : buildQualityReportCsv(snapshot);
    const contentType = format === "pdf" ? "application/pdf" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8";
    const provider = new D1QualityDataProvider();
    await provider.run(`INSERT INTO organization_audit_events (id, organization_id, actor_type, actor_id, action, entity, entity_id, outcome, reason, after_json, created_at) VALUES (?, ?, 'customer_membership', ?, 'quality.report.generated', 'quality_report', ?, 'success', ?, ?, ?)`, [crypto.randomUUID(), snapshot.organization.id, snapshot.membership.id, `${snapshot.filters.periodStart.slice(0, 7)}:${snapshot.selectedBranchId ?? "all"}`, `Reporte mensual ${format.toUpperCase()} generado.`, JSON.stringify({ format, branchId: snapshot.selectedBranchId, periodStart: snapshot.filters.periodStart }), new Date().toISOString()]);
    return new Response(toResponseBody(bytes), { headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${qualityReportFilename(snapshot, format)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    } });
  }

  async evidenceResponse(organizationIdValue: string, evidenceIdValue: string): Promise<Response> {
    const organizationId = parse(idSchema, organizationIdValue);
    const evidenceId = parse(idSchema, evidenceIdValue);
    const metadata = await this.repository.evidence(this.requireIdentity(), organizationId, evidenceId);
    const object = await requireEvidenceBucket().get(metadata.objectKey);
    if (!object) throw new QualityApplicationError("El archivo de evidencia no está disponible.", 404, "quality_evidence_missing");
    const encodedName = encodeURIComponent(metadata.fileName).replaceAll("'", "%27");
    return new Response(object.body, { headers: {
      "Content-Type": metadata.mimeType,
      "Content-Length": String(object.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  }
}

export function qualityErrorStatus(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof QualityApplicationError) return { message: error.message, status: error.status, code: error.code };
  if (error instanceof Error) {
    if (/permiso|membresía|alcance|restringida|contratado|habilitado|fuera de tu alcance/i.test(error.message)) return { message: error.message, status: 403, code: "quality_access_denied" };
    if (/no se encontró|no existe|no está disponible/i.test(error.message)) return { message: error.message, status: 404, code: "quality_not_found" };
    if (/cambió|inmutable|publicada|cerrada|cerrado|ya |Faltan|Falta evidencia|solamente|debe tener/i.test(error.message)) return { message: error.message, status: 409, code: "quality_rule_conflict" };
    console.error("KitchenMind quality error", error);
  }
  return { message: "No fue posible completar la operación de Calidad.", status: 503, code: "quality_unavailable" };
}
