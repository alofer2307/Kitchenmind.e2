import { getChatGPTUser } from "@/app/chatgpt-auth";
import { assertSameOriginRequest, platformJson } from "@/services/platform-security.http";
import { qualityErrorStatus, TenantQualityService } from "@/services/tenant-quality.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return platformJson({ error: "La evidencia supera el límite de 5 MB.", code: "quality_evidence_too_large" }, 413);
    const identity = await getChatGPTUser();
    const service = new TenantQualityService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    return platformJson({ data: await service.uploadEvidence(await request.formData()) }, 201);
  } catch (error) {
    const detail = qualityErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
