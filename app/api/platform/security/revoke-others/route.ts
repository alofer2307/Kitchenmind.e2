import { cookies } from "next/headers";
import { PLATFORM_SESSION_COOKIE, PlatformSecurityError, revokeOtherPlatformSessions } from "@/services/platform-security.service";
import { assertSameOriginRequest, platformErrorResponse, platformJson, requirePlatformRequestIdentity } from "@/services/platform-security.http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    const identity = await requirePlatformRequestIdentity();
    const sessionToken = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
    if (!sessionToken) throw new PlatformSecurityError("La sesión segura ya no está activa.", 401, "platform_session_required");
    const revokedCount = await revokeOtherPlatformSessions(identity, sessionToken);
    return platformJson({ revokedCount });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
