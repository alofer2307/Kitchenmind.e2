import { assertSameOriginRequest, platformErrorResponse, platformJson, requireSecurePlatformRequest } from "@/services/platform-security.http";
import { platformUserHasPermission } from "@/services/platform-security.service";
import { DashboardApplicationError, PlatformDashboardService, dashboardErrorStatus } from "@/services/tenant-dashboard.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const { platformUser } = await requireSecurePlatformRequest("platform.dashboard_catalog.read");
    const url = new URL(request.url);
    const [catalog, canManage] = await Promise.all([
      new PlatformDashboardService(platformUser).catalog(url.searchParams.get("organizationId")),
      platformUserHasPermission(platformUser.id, "platform.dashboard_catalog.manage"),
    ]);
    return platformJson({ data: { ...catalog, capabilities: { manage: canManage } } });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 100_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") throw new DashboardApplicationError("Solicitud inválida.");
    const { action, data } = payload as { action?: unknown; data?: unknown };
    const permission = action === "set_widget_status" || action === "save_organization_override" ? "platform.dashboard_catalog.manage" : null;
    if (!permission) return platformJson({ error: "La acción no existe.", code: "dashboard_action_not_found" }, 404);
    const { platformUser } = await requireSecurePlatformRequest(permission);
    const service = new PlatformDashboardService(platformUser);
    if (action === "set_widget_status") return platformJson({ data: await service.setWidgetStatus(data) });
    return platformJson({ data: await service.saveOrganizationOverride(data) });
  } catch (error) {
    return responseFor(error);
  }
}

function responseFor(error: unknown): Response {
  const detail = dashboardErrorStatus(error);
  if (detail.status === 503) return platformErrorResponse(error);
  return platformJson({ error: detail.message, code: detail.code }, detail.status);
}
