import { NextResponse } from "next/server";
import { issuePasswordReset, sendResetEmail } from "@/services/native-auth.service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  try {
    const token = await issuePasswordReset(email);
    if (token) {
      const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
      const resetUrl = `${base}/restablecer?token=${encodeURIComponent(token)}`;
      const sent = await sendResetEmail(email, resetUrl);
      if (!sent && process.env.NODE_ENV !== "production") {
        const url = new URL("/recuperar", request.url); url.searchParams.set("devResetUrl", resetUrl); return NextResponse.redirect(url, 303);
      }
    }
  } catch (error) { console.error("KitchenMind reset request failed", error); }
  const url = new URL("/recuperar", request.url); url.searchParams.set("sent", "1"); return NextResponse.redirect(url, 303);
}
