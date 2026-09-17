import { z } from "zod";
import { enrollPlatformMfa } from "@/services/platform-security.service";
import { assertSameOriginRequest, platformErrorResponse, platformJson, requirePlatformRequestIdentity, setPlatformSessionCookie } from "@/services/platform-security.http";

export const dynamic = "force-dynamic";

const enrollmentSchema = z.object({
  enrollmentToken: z.string().min(32).max(2_000),
  code: z.string().regex(/^\d{6}$/),
}).strict();

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    const identity = await requirePlatformRequestIdentity();
    const input = enrollmentSchema.safeParse(await request.json());
    if (!input.success) return platformJson({ error: "Revisa el código de seis dígitos.", code: "invalid_request" }, 400);
    const result = await enrollPlatformMfa(identity, input.data.enrollmentToken, input.data.code);
    const response = platformJson({ recoveryCodes: result.recoveryCodes, expiresAt: result.expiresAt });
    setPlatformSessionCookie(response, result.sessionToken, result.expiresAt);
    return response;
  } catch (error) {
    return platformErrorResponse(error);
  }
}
