import { getKitchenMindUser } from "@/services/auth-session.service";
import { assertSameOriginRequest, platformJson } from "@/services/platform-security.http";
import { CustomerDashboardService, dashboardErrorStatus } from "@/services/tenant-dashboard.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const identity = await getKitchenMindUser();
    const service = new CustomerDashboardService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    return platformJson({ data: await service.snapshot({ organizationId: url.searchParams.get("organizationId"), branchId: url.searchParams.get("branchId"), period: url.searchParams.get("period") }) });
  } catch (error) {
    const detail = dashboardErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 100_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const identity = await getKitchenMindUser();
    const service = new CustomerDashboardService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    if (action === "save_preference") return platformJson({ data: await service.savePreference(data) });
    if (action === "reset_preference") return platformJson({ data: await service.resetPreference(data) });
    if (action === "save_organization_override") return platformJson({ data: await service.saveOrganizationOverride(data) });
    if (action === "export_snapshot") return platformJson({ data: await service.exportSnapshot(data) });
    return platformJson({ error: "La acción no existe.", code: "dashboard_action_not_found" }, 404);
  } catch (error) {
    const detail = dashboardErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
