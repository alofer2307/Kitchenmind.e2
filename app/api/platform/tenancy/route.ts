import { PlatformTenancyService, tenancyErrorStatus } from "@/services/tenancy.service";
import { assertSameOriginRequest, platformErrorResponse, platformJson, requireSecurePlatformRequest } from "@/services/platform-security.http";
import type { PlatformPermissionCode } from "@/services/platform-security.service";

export const dynamic = "force-dynamic";

const readPermissions: Record<string, PlatformPermissionCode> = {
  overview: "platform.organizations.read",
  accepted_quotes: "platform.organizations.provision",
  eligibility: "platform.organizations.provision",
  organizations: "platform.organizations.read",
  organization: "platform.organizations.read",
  workspace: "platform.organizations.read",
};

const actionPermissions: Record<string, PlatformPermissionCode> = {
  provision: "platform.organizations.provision",
  issue_invitation: "platform.invitations.create",
  revoke_invitation: "platform.invitations.revoke",
  create_override: "platform.entitlements.override",
  suspend_organization: "platform.organizations.suspend",
  reactivate_organization: "platform.organizations.suspend",
  evaluate_activation: "platform.organizations.activate",
  activate: "platform.organizations.activate",
};

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "overview";
    const permission = readPermissions[view];
    if (!permission) return platformJson({ error: "La consulta no existe.", code: "tenancy_view_not_found" }, 404);
    const { platformUser } = await requireSecurePlatformRequest(permission);
    const service = new PlatformTenancyService(platformUser);
    if (view === "overview") return platformJson({ data: await service.overview() });
    if (view === "accepted_quotes") return platformJson({ data: await service.acceptedQuotes() });
    if (view === "eligibility") return platformJson({ data: await service.eligibility(url.searchParams.get("quoteId") ?? "") });
    if (view === "organizations") return platformJson({ data: await service.organizations() });
    if (view === "workspace") return platformJson({ data: await service.workspace(url.searchParams.get("id") ?? "", url.searchParams.get("branchId") ?? undefined) });
    return platformJson({ data: await service.organization(url.searchParams.get("id") ?? "") });
  } catch (error) {
    return tenancyResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 100_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    if (typeof action !== "string" || !actionPermissions[action]) return platformJson({ error: "La acción no existe.", code: "tenancy_action_not_found" }, 404);
    const { platformUser } = await requireSecurePlatformRequest(actionPermissions[action]);
    const service = new PlatformTenancyService(platformUser);
    if (action === "provision") return platformJson({ data: await service.provision(data) }, 201);
    if (action === "issue_invitation") return platformJson({ data: await service.issueInvitation(data) }, 201);
    if (action === "revoke_invitation") return platformJson({ data: await service.revokeInvitation(data) });
    if (action === "create_override") return platformJson({ data: await service.createOverride(data) }, 201);
    if (action === "suspend_organization") return platformJson({ data: await service.suspend(data) });
    if (action === "reactivate_organization") return platformJson({ data: await service.reactivate(data) });
    if (action === "evaluate_activation") return platformJson({ data: await service.evaluate(data) });
    return platformJson({ data: await service.activate(data) });
  } catch (error) {
    return tenancyResponse(error);
  }
}

function tenancyResponse(error: unknown): Response {
  const detail = tenancyErrorStatus(error);
  if (detail.status === 503) return platformErrorResponse(error);
  return platformJson({ error: detail.message, code: detail.code }, detail.status);
}
