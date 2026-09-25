import { z } from "zod";
import { completePlatformMfaChallenge } from "@/services/platform-security.service";
import { assertSameOriginRequest, platformErrorResponse, platformJson, requirePlatformRequestIdentity, setPlatformSessionCookie } from "@/services/platform-security.http";

export const dynamic = "force-dynamic";

const challengeSchema = z.object({
  code: z.string().trim().min(6).max(20),
}).strict();

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    const identity = await requirePlatformRequestIdentity();
    const input = challengeSchema.safeParse(await request.json());
    if (!input.success) return platformJson({ error: "Escribe un código válido.", code: "invalid_request" }, 400);
    const result = await completePlatformMfaChallenge(identity, input.data.code);
    const response = platformJson({ expiresAt: result.expiresAt, usedRecoveryCode: result.usedRecoveryCode });
    setPlatformSessionCookie(response, result.sessionToken, result.expiresAt);
    return response;
  } catch (error) {
    return platformErrorResponse(error);
  }
}
