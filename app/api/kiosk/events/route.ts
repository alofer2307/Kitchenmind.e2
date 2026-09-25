import { platformJson } from "@/services/platform-security.http";
import { KioskOperationsService, operationsErrorStatus } from "@/services/tenant-operations.service";

export const dynamic = "force-dynamic";

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("El dispositivo no está autorizado.");
  return header.slice(7).trim();
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 500_000) return platformJson({ error: "El lote del dispositivo es demasiado grande.", code: "request_too_large" }, 413);
    const token = bearer(request);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    const service = new KioskOperationsService();
    if (action === "capture") return platformJson({ data: await service.capture(token, data) }, 201);
    if (action === "sync_batch") return platformJson({ data: await service.synchronize(token, data) });
    if (action === "heartbeat") return platformJson({ data: await service.heartbeat(token, data) });
    return platformJson({ error: "La acción del dispositivo no existe.", code: "kiosk_action_not_found" }, 404);
  } catch (error) {
    const detail = operationsErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
