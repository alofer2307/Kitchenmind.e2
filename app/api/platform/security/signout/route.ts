import { cookies } from "next/headers";
import { PLATFORM_SESSION_COOKIE, revokeCurrentPlatformSession } from "@/services/platform-security.service";
import { assertSameOriginRequest, clearPlatformSessionCookie, platformErrorResponse, platformJson, requirePlatformRequestIdentity } from "@/services/platform-security.http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    const identity = await requirePlatformRequestIdentity();
    const sessionToken = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
    if (sessionToken) await revokeCurrentPlatformSession(identity, sessionToken);
    const response = platformJson({ signedOut: true });
    clearPlatformSessionCookie(response);
    return response;
  } catch (error) {
    return platformErrorResponse(error);
  }
}
