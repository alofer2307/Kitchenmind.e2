import { cookies } from "next/headers";
import Link from "next/link";
import { LockKeyhole, ShieldX } from "lucide-react";
import { getKitchenMindUser, signInPath, signOutPath } from "@/services/auth-session.service";
import { BrandMark } from "@/components/brand/brand-mark";
import { ProductivePlatformScreen } from "@/components/platform/productive-platform-screen";
import { PlatformSecurityGate } from "@/components/platform/platform-security-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPlatformGate, PLATFORM_SESSION_COOKIE } from "@/services/platform-security.service";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const identity = await getKitchenMindUser();
  const sessionToken = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value ?? null;
  let gate: Awaited<ReturnType<typeof getPlatformGate>> | null = null;
  try {
    gate = await getPlatformGate(identity, sessionToken);
  } catch (error) {
    console.error("KitchenMind Platform gate unavailable", error);
  }
  if (!gate) return <PlatformAccessState mode="unavailable" />;
  if (gate.kind === "unauthenticated") return <PlatformAccessState mode="unauthenticated" />;
  if (gate.kind === "unauthorized") return <PlatformAccessState mode="unauthorized" />;
  const signOutHref = signOutPath("/platform");
  if (gate.kind === "enroll" || gate.kind === "challenge") {
    return <PlatformSecurityGate mode={gate.kind} identity={gate.identity} signOutHref={signOutHref} />;
  }
  return <ProductivePlatformScreen identity={gate.identity} security={gate.security} signOutHref={signOutHref} />;
}

function PlatformAccessState({ mode }: { mode: "unauthenticated" | "unauthorized" | "unavailable" }) {
  const content = {
    unauthenticated: { icon: LockKeyhole, title: "Inicia sesión para continuar", description: "KitchenMind Platform requiere una identidad verificada antes de mostrar información interna." },
    unauthorized: { icon: ShieldX, title: "Acceso denegado", description: "Esta cuenta no pertenece al equipo autorizado de KitchenMind." },
    unavailable: { icon: ShieldX, title: "Protección temporalmente no disponible", description: "El panel permanece cerrado porque no fue posible verificar todos los controles de seguridad." },
  }[mode];
  const Icon = content.icon;
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-5"><Card className="w-full max-w-md rounded-[1.75rem] border-[#d5e5ef] shadow-[0_24px_70px_rgba(24,52,81,.1)]"><CardContent className="p-7 text-center sm:p-9"><div className="flex justify-center"><BrandMark /></div><div className="mx-auto mt-8 flex size-12 items-center justify-center rounded-2xl bg-[#e8f2ff] text-[#1769e0]"><Icon className="size-6" /></div><h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-[#102b48]">{content.title}</h1><p className="mt-3 text-sm leading-6 text-[#647a90]">{content.description}</p>{mode === "unauthenticated" ? <Button asChild className="mt-6 h-11 w-full rounded-xl"><a href={signInPath("/platform")} target="_top">Iniciar sesión segura</a></Button> : <Button asChild variant="outline" className="mt-6 h-11 w-full rounded-xl"><Link href="/">Volver a KitchenMind</Link></Button>}</CardContent></Card></main>;
}
