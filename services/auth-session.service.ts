import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_SESSION_COOKIE, identityFromSession, type NativeIdentity } from "@/services/native-auth.service";

export type KitchenMindUser = NativeIdentity;

export async function getKitchenMindUser(): Promise<KitchenMindUser | null> {
  try {
    const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value ?? null;
    return await identityFromSession(token);
  } catch (error) {
    console.error("KitchenMind auth unavailable", error);
    return null;
  }
}

export async function requireKitchenMindUser(returnTo: string): Promise<KitchenMindUser> {
  const user = await getKitchenMindUser();
  if (user) return user;
  return redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/"): string {
  return `/logout?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}
