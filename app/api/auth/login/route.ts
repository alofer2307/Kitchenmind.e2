import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, authenticate, createSession } from "@/services/native-auth.service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const returnToRaw = String(form.get("returnTo") ?? "/");
  const returnTo = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/";
  try {
    const identity = await authenticate(email, password);
    const session = await createSession(identity);
    const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
    response.cookies.set(AUTH_SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(session.expiresAt) });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible iniciar sesión.";
    const url = new URL("/login", request.url);
    url.searchParams.set("returnTo", returnTo);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  }
}
