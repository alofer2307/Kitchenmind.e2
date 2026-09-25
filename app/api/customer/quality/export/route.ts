import { getKitchenMindUser } from "@/services/auth-session.service";
import { platformJson } from "@/services/platform-security.http";
import { qualityErrorStatus, TenantQualityService } from "@/services/tenant-quality.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const identity = await getKitchenMindUser();
    const service = new TenantQualityService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    if (url.searchParams.get("report") === "monthly") return service.exportReport({ organizationId: url.searchParams.get("organizationId") ?? "", branchId: url.searchParams.get("branchId"), format: url.searchParams.get("format") ?? "pdf" });
    return service.exportLog({ organizationId: url.searchParams.get("organizationId") ?? "", logId: url.searchParams.get("logId") ?? "", format: url.searchParams.get("format") ?? "pdf" });
  } catch (error) {
    const detail = qualityErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
