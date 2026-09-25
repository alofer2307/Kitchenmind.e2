import { NextResponse } from "next/server";
import { requirePlatformDatabase } from "@/db/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    database: Boolean((process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) || (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_D1_DATABASE_ID && process.env.CLOUDFLARE_D1_API_TOKEN)),
    owner: Boolean(process.env.KITCHENMIND_PLATFORM_OWNER_EMAIL && process.env.KITCHENMIND_OWNER_PASSWORD),
    mfa: Boolean(process.env.KITCHENMIND_PLATFORM_MFA_KEY),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    recoveryEmail: Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM),
  };
  let databaseReachable = false;
  let nativeAuthSchema = false;
  if (env.database) {
    try {
      const db = requirePlatformDatabase();
      databaseReachable = Boolean(await db.prepare("SELECT 1 AS ok").first<{ ok: number }>());
      const auth = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_credentials' LIMIT 1").first<{ name: string }>();
      nativeAuthSchema = auth?.name === "auth_credentials";
    } catch {
      databaseReachable = false;
    }
  }
  const ready = env.database && env.owner && env.mfa && env.appUrl && databaseReachable && nativeAuthSchema;
  return NextResponse.json({ service: "KitchenMind", ready, databaseReachable, nativeAuthSchema, configured: env }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
