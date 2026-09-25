"use client";

import * as React from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerOnboardingMutation, useTenancyQuery } from "@/hooks/use-tenancy";
import type { InvitationPreview } from "@/types";

export function InvitationScreen({ token, authenticated, signInHref, errorMessage }: { token: string; authenticated: boolean; signInHref: string; errorMessage?: string }) {
  const query = useTenancyQuery<InvitationPreview>(`view=invitation&token=${encodeURIComponent(token)}`, "customer", Boolean(token));
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function accept() {
    setWorking(true); setError(null);
    try {
      const result = await customerOnboardingMutation<{ organizationId: string }>("accept_invitation", { token });
      window.location.assign(`/app/onboarding?organizationId=${encodeURIComponent(result.organizationId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible aceptar la invitación."); setWorking(false); }
  }
  const invitation = query.data;
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-5"><Card className="w-full max-w-lg rounded-[2rem] border-[#d5e5ef] shadow-[0_28px_80px_rgba(24,52,81,.12)]"><CardContent className="p-7 sm:p-10"><BrandMark /><div className="mt-8 flex size-13 items-center justify-center rounded-2xl bg-[#e8f5ff] text-[#1769e0]"><KeyRound className="size-6" /></div>{query.loading ? <div className="mt-6 flex items-center gap-2 text-[#6c8194]"><Loader2 className="size-4 animate-spin" />Validando invitación…</div> : query.error || !invitation ? <State icon={TriangleAlert} title="Invitación no disponible" detail={query.error ?? "Solicita a KitchenMind un enlace nuevo."} /> : <><div className="mt-6 flex flex-wrap items-center gap-2"><Badge className="bg-[#e7faf5] text-[#12765f]">Acceso seguro</Badge><Badge variant="outline">{invitation.roleName}</Badge></div><h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Te invitaron a {invitation.organizationName}</h1><p className="mt-3 leading-7 text-[#657b90]">La invitación está destinada a <strong>{invitation.email}</strong> y vence el {new Date(invitation.expiresAt).toLocaleString("es-MX")}.</p>{invitation.status !== "pending" ? <State icon={TriangleAlert} title={`Invitación ${invitation.status}`} detail="Pide a KitchenMind que genere una nueva invitación si todavía necesitas acceso." /> : <div className="mt-6 rounded-2xl border border-[#cfe4ed] bg-[#f7fbfd] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#1593a5]" /><p className="text-sm leading-6 text-[#536d83]">Al aceptar, tu identidad se vincula a esta organización. El enlace solo puede usarse una vez y no concede acceso a KitchenMind Platform.</p></div></div>}{(error || errorMessage) && <p className="mt-4 rounded-xl bg-[#fff1ec] p-3 text-sm text-[#a2452c]">{error || errorMessage}</p>}{invitation.status === "pending" && (authenticated ? <Button className="mt-6 h-12 w-full rounded-xl text-base" disabled={working} onClick={() => void accept()}>{working ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Aceptar y continuar</Button> : <div className="mt-6"><form action="/api/auth/invitation-register" method="post" className="space-y-4"><input type="hidden" name="token" value={token} /><div className="space-y-2"><Label htmlFor="displayName">Tu nombre</Label><Input id="displayName" name="displayName" required minLength={2} /></div><div className="space-y-2"><Label htmlFor="password">Crea una contraseña</Label><Input id="password" name="password" type="password" required minLength={10} /><p className="text-xs text-[#71869a]">Mínimo 10 caracteres, con al menos una letra y un número.</p></div><Button type="submit" className="h-12 w-full rounded-xl text-base"><CheckCircle2 className="size-4" />Activar cuenta y aceptar invitación</Button></form><div className="mt-4 text-center text-sm text-[#6b8093]">¿Ya tienes cuenta? <a className="font-bold text-[#1769e0] hover:underline" href={signInHref}>Inicia sesión</a></div></div>)}</>}</CardContent></Card></main>;
}

function State({ icon: Icon, title, detail }: { icon: typeof TriangleAlert; title: string; detail: string }) { return <div className="mt-6 rounded-2xl border border-[#efd5ca] bg-[#fff8f5] p-4"><Icon className="size-5 text-[#b65538]" /><p className="mt-2 font-bold text-[#713722]">{title}</p><p className="mt-1 text-sm text-[#8a5c4c]">{detail}</p></div>; }
