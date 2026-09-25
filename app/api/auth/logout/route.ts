import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE, revokeSession } from "@/services/native-auth.service";
export const runtime = "nodejs";
async function logout(request: Request) {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value ?? null;
  await revokeSession(token).catch(() => undefined);
  const url = new URL(request.url);
  const raw = url.searchParams.get("returnTo") ?? "/";
  const returnTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(AUTH_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
  return response;
}
export async function GET(request: Request) { return logout(request); }
export async function POST(request: Request) { return logout(request); }
