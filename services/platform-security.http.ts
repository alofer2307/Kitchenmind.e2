import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getKitchenMindUser, type KitchenMindUser } from "@/services/auth-session.service";
import {
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_SECONDS,
  PlatformSecurityError,
  requireActivePlatformSession,
  type PlatformPermissionCode,
  type PlatformUserRow,
} from "./platform-security.service";

export async function requirePlatformRequestIdentity(): Promise<KitchenMindUser> {
  const identity = await getKitchenMindUser();
  if (!identity) throw new PlatformSecurityError("Inicia sesión para continuar.", 401, "authentication_required");
  return identity;
}

export async function requireSecurePlatformRequest(permission: PlatformPermissionCode): Promise<{
  identity: KitchenMindUser;
  platformUser: PlatformUserRow;
}> {
  const identity = await requirePlatformRequestIdentity();
  const sessionToken = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value ?? null;
  const platformUser = await requireActivePlatformSession(identity, sessionToken, permission);
  return { identity, platformUser };
}

export function assertSameOriginRequest(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new PlatformSecurityError("La solicitud no proviene de KitchenMind.", 403, "invalid_origin");
  }
}

export function platformJson(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  });
}

export function platformErrorResponse(error: unknown): NextResponse {
  if (error instanceof PlatformSecurityError) {
    return platformJson({ error: error.message, code: error.code }, error.status);
  }
  console.error("KitchenMind Platform security error", error);
  return platformJson({ error: "No fue posible completar la operación segura.", code: "platform_security_unavailable" }, 503);
}

export function setPlatformSessionCookie(response: NextResponse, token: string, expiresAt: string): void {
  response.cookies.set({
    name: PLATFORM_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: PLATFORM_SESSION_SECONDS,
    expires: new Date(expiresAt),
  });
}

export function clearPlatformSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: PLATFORM_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
