import { getKitchenMindUser } from "@/services/auth-session.service";
import { platformJson } from "@/services/platform-security.http";
import { qualityErrorStatus, TenantQualityService } from "@/services/tenant-quality.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ evidenceId: string }> }): Promise<Response> {
  try {
    const { evidenceId } = await context.params;
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
    const identity = await getKitchenMindUser();
    const service = new TenantQualityService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    return service.evidenceResponse(organizationId, evidenceId);
  } catch (error) {
    const detail = qualityErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
