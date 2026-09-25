import { getKitchenMindUser } from "@/services/auth-session.service";
import { assertSameOriginRequest, platformErrorResponse, platformJson } from "@/services/platform-security.http";
import { PlatformSecurityError } from "@/services/platform-security.service";
import { configureMobilePolicy, inviteMobileEmployee, mobileEmployeesForAdmin, MobileAttendanceError, policyForAdmin, revokeMobileEmployee } from "@/services/mobile-attendance.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failed(error: unknown) {
  if (error instanceof MobileAttendanceError) return platformJson({ error: error.message }, error.status);
  if (error instanceof PlatformSecurityError) return platformErrorResponse(error);
  console.error("Mobile attendance administration", error);
  return platformJson({ error: "No fue posible completar la operación." }, 503);
}

export async function GET(request: Request) {
  try {
    const user = await getKitchenMindUser();
    if (!user) return platformJson({ error: "Inicia sesión." }, 401);
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const branchId = url.searchParams.get("branchId") ?? "";
    const [policy, employees] = await Promise.all([
      policyForAdmin(user, organizationId, branchId),
      mobileEmployeesForAdmin(user, organizationId, branchId, url.searchParams.get("search") ?? ""),
    ]);
    return platformJson({ data: { policy, employees } });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 10000) return platformJson({ error: "La solicitud es demasiado grande." }, 413);
    const user = await getKitchenMindUser();
    if (!user) return platformJson({ error: "Inicia sesión." }, 401);
    const data = await request.json() as Record<string, unknown>;
    if (data.action === "configure") {
      const result = await configureMobilePolicy(user, {
        organizationId: String(data.organizationId ?? ""), branchId: String(data.branchId ?? ""),
        latitude: Number(data.latitude), longitude: Number(data.longitude), radiusMeters: Number(data.radiusMeters),
        maxAccuracyMeters: Number(data.maxAccuracyMeters), enabled: data.enabled === true,
      });
      return platformJson({ data: result });
    }
    if (data.action === "invite") return platformJson({ data: await inviteMobileEmployee(user, {
      organizationId: String(data.organizationId ?? ""), branchId: String(data.branchId ?? ""), employeeId: String(data.employeeId ?? ""),
    }) });
    if (data.action === "revoke") return platformJson({ data: await revokeMobileEmployee(user, {
      organizationId: String(data.organizationId ?? ""), branchId: String(data.branchId ?? ""), employeeId: String(data.employeeId ?? ""),
    }) });
    return platformJson({ error: "Acción no válida." }, 400);
  } catch (error) { return failed(error); }
}
