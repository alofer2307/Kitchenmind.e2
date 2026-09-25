import { createMfaSetup } from "@/services/platform-security.service";
import { platformErrorResponse, platformJson, requirePlatformRequestIdentity } from "@/services/platform-security.http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const identity = await requirePlatformRequestIdentity();
    return platformJson(await createMfaSetup(identity));
  } catch (error) {
    return platformErrorResponse(error);
  }
}
