import { NextResponse } from "next/server";
import { resetPassword } from "@/services/native-auth.service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  try {
    await resetPassword(token, password);
    const url = new URL("/login", request.url); url.searchParams.set("reset", "1"); return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL("/restablecer", request.url); url.searchParams.set("token", token); url.searchParams.set("error", error instanceof Error ? error.message : "No fue posible cambiar la contraseña."); return NextResponse.redirect(url, 303);
  }
}
