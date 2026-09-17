import { CommercialApplicationError, CommercialApplicationService } from "@/services/commercial.service";
import {
  assertSameOriginRequest,
  platformErrorResponse,
  platformJson,
  requireSecurePlatformRequest,
} from "@/services/platform-security.http";
import type { PlatformPermissionCode } from "@/services/platform-security.service";

export const dynamic = "force-dynamic";

const readPermissions: Record<string, PlatformPermissionCode> = {
  overview: "platform.prospects.read",
  prospects: "platform.prospects.read",
  prospect: "platform.prospects.read",
  catalog: "platform.catalog.read",
  price_books: "platform.pricing.read",
  price_book: "platform.pricing.read",
  quotes: "platform.quotes.read",
  quote: "platform.quotes.read",
  quote_customer: "platform.quotes.read",
};

const actionPermissions: Record<string, PlatformPermissionCode> = {
  create_prospect: "platform.prospects.create",
  update_prospect: "platform.prospects.update",
  transition_prospect: "platform.prospects.update",
  archive_prospect: "platform.prospects.archive",
  add_contact: "platform.prospects.update",
  add_note: "platform.prospects.update",
  add_follow_up: "platform.prospects.update",
  complete_follow_up: "platform.prospects.update",
  save_diagnosis: "platform.diagnoses.manage",
  complete_diagnosis: "platform.diagnoses.manage",
  revise_diagnosis: "platform.diagnoses.manage",
  update_price_rule: "platform.pricing.manage",
  update_price_tiers: "platform.pricing.manage",
  publish_price_book: "platform.pricing.manage",
  revise_price_book: "platform.pricing.manage",
  create_quote: "platform.quotes.create",
  preview_quote: "platform.quotes.create",
  revise_quote: "platform.quotes.update",
  transition_quote: "platform.quotes.update",
  send_quote: "platform.quotes.send",
  accept_quote: "platform.quotes.accept",
  cancel_quote: "platform.quotes.cancel",
};

function serviceFor(platformUser: { id: string; authUserId: string; email: string; displayName: string }) {
  return new CommercialApplicationService(platformUser);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "overview";
    const permission = readPermissions[view];
    if (!permission) return platformJson({ error: "La consulta comercial no existe.", code: "commercial_view_not_found" }, 404);
    const { platformUser } = await requireSecurePlatformRequest(permission);
    const service = serviceFor(platformUser);
    if (view === "overview") return platformJson({ data: await service.overview() });
    if (view === "prospects") return platformJson({ data: await service.prospects(url.searchParams) });
    if (view === "prospect") return platformJson({ data: await service.prospect(url.searchParams.get("id") ?? "") });
    if (view === "catalog") return platformJson({ data: await service.catalog() });
    if (view === "price_books") return platformJson({ data: await service.priceBooks() });
    if (view === "price_book") return platformJson({ data: await service.priceBook(url.searchParams.get("id") ?? "", url.searchParams.get("versionId") ?? undefined) });
    if (view === "quotes") return platformJson({ data: await service.quotes(url.searchParams) });
    if (view === "quote_customer") return platformJson({ data: await service.customerQuote(url.searchParams.get("id") ?? "") });
    return platformJson({ data: await service.quote(url.searchParams.get("id") ?? "") });
  } catch (error) {
    return commercialErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 250_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    if (typeof action !== "string" || !actionPermissions[action]) return platformJson({ error: "La acción comercial no existe.", code: "commercial_action_not_found" }, 404);
    const effectivePermission = action === "transition_quote" && data && typeof data === "object"
      ? transitionPermission((data as { status?: unknown }).status)
      : actionPermissions[action];
    const { platformUser } = await requireSecurePlatformRequest(effectivePermission);
    if ((action === "create_quote" || action === "preview_quote" || action === "revise_quote") && hasCommercialAdjustments(data)) {
      await requireSecurePlatformRequest("platform.quotes.discount");
    }
    const service = serviceFor(platformUser);
    if (action === "create_prospect") return platformJson({ data: await service.createProspect(data) }, 201);
    if (action === "update_prospect") return platformJson({ data: await service.updateProspect(data) });
    if (action === "transition_prospect" || action === "archive_prospect") return platformJson({ data: await service.transitionProspect(data) });
    if (action === "add_contact") return platformJson({ data: await service.addContact(data) }, 201);
    if (action === "add_note") return platformJson({ data: await service.addNote(data) }, 201);
    if (action === "add_follow_up") return platformJson({ data: await service.addFollowUp(data) }, 201);
    if (action === "complete_follow_up") return platformJson({ data: await service.completeFollowUp(data) });
    if (action === "save_diagnosis") return platformJson({ data: await service.saveDiagnosis(data) });
    if (action === "complete_diagnosis") return platformJson({ data: await service.completeDiagnosis(data) });
    if (action === "revise_diagnosis") return platformJson({ data: await service.reviseDiagnosis(data) }, 201);
    if (action === "update_price_rule") return platformJson({ data: await service.updatePriceRule(data) });
    if (action === "update_price_tiers") return platformJson({ data: await service.updatePriceTiers(data) });
    if (action === "publish_price_book") return platformJson({ data: await service.publishPriceBook(data) });
    if (action === "revise_price_book") return platformJson({ data: await service.revisePriceBook(data) }, 201);
    if (action === "create_quote") return platformJson({ data: await service.createQuote(data) }, 201);
    if (action === "preview_quote") return platformJson({ data: await service.previewQuote(data) });
    if (action === "revise_quote") return platformJson({ data: await service.reviseQuote(data) }, 201);
    return platformJson({ data: await service.transitionQuote(data) });
  } catch (error) {
    return commercialErrorResponse(error);
  }
}

function hasCommercialAdjustments(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const adjustments = (data as { adjustments?: unknown }).adjustments;
  return Array.isArray(adjustments) && adjustments.length > 0;
}

function transitionPermission(status: unknown): PlatformPermissionCode {
  if (status === "sent") return "platform.quotes.send";
  if (status === "accepted" || status === "rejected") return "platform.quotes.accept";
  if (status === "cancelled") return "platform.quotes.cancel";
  return "platform.quotes.update";
}

function commercialErrorResponse(error: unknown): Response {
  if (error instanceof CommercialApplicationError) {
    if (error.code === "possible_duplicate") {
      try {
        const detail = JSON.parse(error.message) as { message: string; duplicates: unknown[] };
        return platformJson({ error: detail.message, code: error.code, duplicates: detail.duplicates }, error.status);
      } catch {
        return platformJson({ error: "Encontré posibles duplicados.", code: error.code }, error.status);
      }
    }
    return platformJson({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof Error && /cambió en otra sesión|inmutable|No se puede|Solamente|Completa|Revisa|requiere|No existe|No se encontró|ya no está|Escribe|Publica/.test(error.message)) {
    return platformJson({ error: error.message, code: "commercial_rule_conflict" }, 409);
  }
  return platformErrorResponse(error);
}
