import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, createCredential, createSession } from "@/services/native-auth.service";
import { CustomerOnboardingService } from "@/services/tenancy.service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const displayName = String(form.get("displayName") ?? "").trim();
  const password = String(form.get("password") ?? "");
  try {
    const anonymous = new CustomerOnboardingService(null);
    const invitation = await anonymous.invitation(token);
    if (invitation.status !== "pending") throw new Error("La invitación ya no está disponible.");
    const identity = await createCredential({ email: invitation.email, displayName: displayName || invitation.email, password });
    const service = new CustomerOnboardingService({ authUserId: identity.id, email: identity.email, displayName: identity.displayName });
    const accepted = await service.accept({ token });
    const session = await createSession(identity);
    const response = NextResponse.redirect(new URL(`/app/onboarding?organizationId=${encodeURIComponent(accepted.organizationId)}`, request.url), 303);
    response.cookies.set(AUTH_SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(session.expiresAt) });
    return response;
  } catch (error) {
    const url = new URL("/aceptar-invitacion", request.url); url.searchParams.set("token", token); url.searchParams.set("error", error instanceof Error ? error.message : "No fue posible activar la cuenta."); return NextResponse.redirect(url, 303);
  }
}
