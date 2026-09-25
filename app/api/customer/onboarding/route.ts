import { getKitchenMindUser } from "@/services/auth-session.service";
import { assertSameOriginRequest, platformJson } from "@/services/platform-security.http";
import { CustomerOnboardingService, tenancyErrorStatus } from "@/services/tenancy.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "snapshot";
    const identity = await getKitchenMindUser();
    const service = new CustomerOnboardingService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    if (view === "invitation") return platformJson({ data: await service.invitation(url.searchParams.get("token") ?? "") });
    if (view === "access") return platformJson({ data: await service.access() });
    if (view === "workspace") return platformJson({ data: await service.workspace(url.searchParams.get("organizationId") ?? undefined, url.searchParams.get("branchId") ?? undefined) });
    if (view === "snapshot") return platformJson({ data: await service.snapshot(url.searchParams.get("organizationId") ?? undefined) });
    return platformJson({ error: "La consulta no existe.", code: "customer_view_not_found" }, 404);
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const identity = await getKitchenMindUser();
    const service = new CustomerOnboardingService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    if (action === "accept_invitation") return platformJson({ data: await service.accept(data) });
    if (action === "update_profile") return platformJson({ data: await service.updateProfile(data) });
    if (action === "create_resource") return platformJson({ data: await service.createResource(data) }, 201);
    if (action === "import_employees") return platformJson({ data: await service.importEmployees(data) }, 201);
    if (action === "import_catalog") return platformJson({ data: await service.importCatalog(data) }, 201);
    if (action === "update_task") return platformJson({ data: await service.updateTask(data) });
    if (action === "request_review") return platformJson({ data: await service.requestReview(data) });
    return platformJson({ error: "La acción no existe.", code: "customer_action_not_found" }, 404);
  } catch (error) {
    return responseFor(error);
  }
}

function responseFor(error: unknown): Response {
  const detail = tenancyErrorStatus(error);
  return platformJson({ error: detail.message, code: detail.code }, detail.status);
}
