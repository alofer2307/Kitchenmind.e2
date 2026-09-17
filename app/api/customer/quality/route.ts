import { getChatGPTUser } from "@/app/chatgpt-auth";
import { assertSameOriginRequest, platformJson } from "@/services/platform-security.http";
import { qualityErrorStatus, TenantQualityService } from "@/services/tenant-quality.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const identity = await getChatGPTUser();
    const service = new TenantQualityService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    return platformJson({ data: await service.snapshot({ organizationId: url.searchParams.get("organizationId"), branchId: url.searchParams.get("branchId"), period: url.searchParams.get("period"), logId: url.searchParams.get("logId") }) });
  } catch (error) {
    const detail = qualityErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 250_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const identity = await getChatGPTUser();
    const service = new TenantQualityService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    if (action === "create_template") return platformJson({ data: await service.createTemplate(data) }, 201);
    if (action === "update_template") return platformJson({ data: await service.updateTemplate(data) });
    if (action === "publish_template") return platformJson({ data: await service.publishTemplate(data) });
    if (action === "create_template_revision") return platformJson({ data: await service.createTemplateRevision(data) }, 201);
    if (action === "schedule_log") return platformJson({ data: await service.scheduleLog(data) }, 201);
    if (action === "create_schedule_rule") return platformJson({ data: await service.createScheduleRule(data) }, 201);
    if (action === "generate_schedule_rule") return platformJson({ data: await service.generateScheduleRule(data) });
    if (action === "save_answers") return platformJson({ data: await service.saveAnswers(data) });
    if (action === "complete_log") return platformJson({ data: await service.completeLog(data) });
    if (action === "create_log_revision") return platformJson({ data: await service.createLogRevision(data) }, 201);
    if (action === "update_corrective") return platformJson({ data: await service.updateCorrective(data) });
    if (action === "verify_corrective") return platformJson({ data: await service.verifyCorrective(data) });
    return platformJson({ error: "La acción no existe.", code: "quality_action_not_found" }, 404);
  } catch (error) {
    const detail = qualityErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
