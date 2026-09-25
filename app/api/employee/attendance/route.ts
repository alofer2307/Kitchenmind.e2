import { getKitchenMindUser } from "@/services/auth-session.service";
import { assertSameOriginRequest, platformErrorResponse, platformJson } from "@/services/platform-security.http";
import { PlatformSecurityError } from "@/services/platform-security.service";
import { MobileAttendanceError, mobileAttendanceHome, registerMobileAttendance } from "@/services/mobile-attendance.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failed(error: unknown) {
  if (error instanceof MobileAttendanceError) return platformJson({ error: error.message }, error.status);
  if (error instanceof PlatformSecurityError) return platformErrorResponse(error);
  console.error("Employee attendance", error);
  return platformJson({ error: "No fue posible consultar o guardar la asistencia." }, 503);
}

export async function GET() {
  try {
    const user = await getKitchenMindUser();
    if (!user) return platformJson({ error: "Inicia sesión." }, 401);
    return platformJson({ data: await mobileAttendanceHome(user) });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 5000) return platformJson({ error: "La solicitud es demasiado grande." }, 413);
    const user = await getKitchenMindUser();
    if (!user) return platformJson({ error: "Inicia sesión." }, 401);
    const data = await request.json();
    return platformJson({ data: await registerMobileAttendance(user, data) }, 201);
  } catch (error) { return failed(error); }
}
