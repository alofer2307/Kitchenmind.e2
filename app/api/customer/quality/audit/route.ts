import { getKitchenMindUser } from "@/services/auth-session.service";
import { platformJson } from "@/services/platform-security.http";
import { qualityErrorStatus, TenantQualityService } from "@/services/tenant-quality.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const identity = await getKitchenMindUser();
    const service = new TenantQualityService(identity ? {
      authUserId: identity.id, email: identity.email, displayName: identity.displayName,
    } : null);
    const data = await service.auditLookup({
      organizationId: url.searchParams.get("organizationId") ?? "",
      branchId: url.searchParams.get("branchId") ?? "",
      date: url.searchParams.get("date") ?? "",
      page: url.searchParams.get("page"),
    });
    return platformJson({ data });
  } catch (error) {
    const detail = qualityErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
