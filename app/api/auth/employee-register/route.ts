import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, createCredential, createSession } from "@/services/native-auth.service";
import { getKitchenMindUser } from "@/services/auth-session.service";
import { assertSameOriginRequest } from "@/services/platform-security.http";
import { acceptMobileEnrollment, enrollment } from "@/services/mobile-attendance.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  let created = false;
  try {
    assertSameOriginRequest(request);
    const preview = await enrollment(token);
    let identity = await getKitchenMindUser();
    if (identity && identity.email.toLowerCase() !== preview.email) throw new Error("Usa el correo indicado en la invitación.");
    if (!identity) {
      const password = String(form.get("password") ?? "");
      identity = await createCredential({ email: preview.email, displayName: preview.employeeName, password });
      created = true;
    }
    await acceptMobileEnrollment(token, identity);
    const response = NextResponse.redirect(new URL("/checar", request.url), 303);
    if (created) {
      const session = await createSession(identity);
      response.cookies.set(AUTH_SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(session.expiresAt) });
    }
    return response;
  } catch (error) {
    const url = new URL("/checar/activar", request.url);
    url.searchParams.set("token", token);
    url.searchParams.set("error", error instanceof Error ? error.message : "No se pudo activar la cuenta.");
    return NextResponse.redirect(url, 303);
  }
}
