"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, Clipboard, KeyRound, Loader2, Monitor, PauseCircle, Play, RefreshCw, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { platformTenancyMutation, useTenancyQuery } from "@/hooks/use-tenancy";
import type { OrganizationDetail } from "@/types";

export function OrganizationDetailScreen({ organizationId }: { organizationId: string }) {
  const query = useTenancyQuery<OrganizationDetail>(`view=organization&id=${encodeURIComponent(organizationId)}`);
  const [working, setWorking] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = React.useState<"module" | "feature_limit">("feature_limit");
  const [overrideCode, setOverrideCode] = React.useState("");
  const [overrideValue, setOverrideValue] = React.useState("0");
  const [overrideUntil, setOverrideUntil] = React.useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [overrideReason, setOverrideReason] = React.useState("");
  async function action(name: string, data: unknown) {
    setWorking(name); setError(null); setMessage(null);
    try {
      const result = await platformTenancyMutation<Record<string, unknown>>(name, data);
      if (name === "issue_invitation" && typeof result.invitationUrl === "string") setInviteUrl(result.invitationUrl);
      setMessage(name === "activate" ? "La organización quedó activa." : name === "suspend_organization" ? "La organización quedó suspendida sin eliminar sus datos." : name === "reactivate_organization" ? "La organización quedó nuevamente disponible." : name === "evaluate_activation" ? "La lista de preparación fue recalculada." : "La operación quedó registrada.");
      await query.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible completar la operación."); }
    finally { setWorking(null); }
  }
  const organization = query.data;
  if (query.loading && !organization) return <Loading />;
  if (query.error || !organization) return <State title="No fue posible abrir la organización" detail={query.error ?? "La organización no existe."} />;
  const failed = organization.activationChecks.filter((check) => check.status === "failed");
  const overrideOptions = overrideTarget === "module"
    ? organization.entitlements.filter((item) => item.moduleCode).map((item) => item.moduleCode as string)
    : organization.limits.map((item) => item.featureCode);
  async function submitOverride(event: React.FormEvent) {
    event.preventDefault();
    const code = overrideCode || overrideOptions[0];
    if (!code) { setError("Selecciona un módulo o límite."); return; }
    const effectiveUntil = Date.parse(`${overrideUntil}T23:59:59.000Z`);
    if (!Number.isFinite(effectiveUntil)) { setError("Selecciona una fecha de vigencia válida."); return; }
    await action("create_override", {
      organizationId, targetType: overrideTarget, code,
      ...(overrideTarget === "module" ? { enabled: overrideValue === "1" } : { overrideLimit: Number(overrideValue) }),
      effectiveUntil: new Date(effectiveUntil).toISOString(), reason: overrideReason,
    });
  }
  function issueInvitation() {
    const reason = window.prompt("Motivo para reemplazar o emitir la invitación:");
    if (reason?.trim()) void action("issue_invitation", { organizationId, reason: reason.trim() });
  }
  function revokeInvitation(invitationId: string) {
    const reason = window.prompt("Motivo de la revocación:");
    if (reason?.trim()) void action("revoke_invitation", { organizationId, invitationId, reason: reason.trim() });
  }
  function changeAvailability(suspended: boolean, version: number) {
    const reason = window.prompt(suspended ? "Motivo para suspender la organización:" : "Motivo para reactivar la organización:");
    if (reason?.trim()) void action(suspended ? "suspend_organization" : "reactivate_organization", { organizationId, version, reason: reason.trim() });
  }
  return <div className="space-y-6">
    <Button asChild variant="ghost" size="sm"><Link href="/platform/organizaciones"><ArrowLeft className="size-4" />Organizaciones</Link></Button>
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[#168ca0]">{organization.code}</p><Badge className="bg-[#e8f2ff] text-[#1769e0]">{organization.status.replaceAll("_", " ")}</Badge></div><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#102b48]">{organization.commercialName}</h1><p className="mt-2 text-[#667d92]">Origen {organization.sourceQuoteNumber} · {organization.countryCode} · {organization.defaultCurrency} · {organization.defaultTimezone}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="rounded-xl"><Link href={`/platform/organizaciones/${organizationId}/operacion`}><Monitor className="size-4" />Entrar a la operación</Link></Button><Button variant="outline" className="rounded-xl" disabled={Boolean(working) || organization.status === "suspended"} onClick={() => void action("evaluate_activation", { organizationId })}>{working === "evaluate_activation" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Verificar preparación</Button><Button className="rounded-xl" disabled={Boolean(working) || organization.status !== "ready_for_review" || failed.length > 0} onClick={() => void action("activate", { organizationId, version: organization.version })}>{working === "activate" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}Activar</Button>{organization.status === "suspended" ? <Button variant="outline" className="rounded-xl" disabled={Boolean(working)} onClick={() => changeAvailability(false, organization.version)}>{working === "reactivate_organization" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Reactivar</Button> : <Button variant="outline" className="rounded-xl border-[#e2b4a8] text-[#9b3f27] hover:bg-[#fff6f2]" disabled={Boolean(working) || organization.status === "cancelled"} onClick={() => changeAvailability(true, organization.version)}>{working === "suspend_organization" ? <Loader2 className="size-4 animate-spin" /> : <PauseCircle className="size-4" />}Suspender</Button>}</div></div>
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    {inviteUrl && <Notice><span>Enlace temporal generado. No se enviará automáticamente.</span><Button size="sm" variant="outline" className="ml-3 rounded-lg" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${inviteUrl}`)}><Clipboard className="size-4" />Copiar enlace</Button></Notice>}
    <div className="grid gap-4 md:grid-cols-3"><Metric label="Onboarding" value={`${organization.onboardingPercentage}%`} /><Metric label="Sucursales" value={String(organization.branchCount)} /><Metric label="Módulos activos" value={String(organization.activeModuleCount)} /></div>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.9fr]">
      <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle>Onboarding productivo</CardTitle></CardHeader><CardContent className="space-y-4"><Progress value={organization.onboardingPercentage} />{organization.onboardingSections.map((section) => <div key={section.id} className="rounded-2xl border border-[#dce8f0] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-[#173653]">{section.title}</p><p className="mt-1 text-sm text-[#71869a]">{section.description}</p></div><Badge variant="outline">{section.percentage}%</Badge></div><div className="mt-4 space-y-2">{section.tasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-xl bg-[#f5f9fc] p-3">{task.status === "completed" ? <CheckCircle2 className="size-5 shrink-0 text-[#159578]" /> : task.status === "blocked" ? <CircleAlert className="size-5 shrink-0 text-[#bb652d]" /> : <span className="size-5 shrink-0 rounded-full border-2 border-[#a7b9c8]" />}<div><p className="text-sm font-bold text-[#25435f]">{task.title}{task.required ? " · Obligatoria" : ""}</p><p className="text-xs text-[#71869a]">{task.blockedReason ?? task.description}</p></div></div>)}</div></div>)}</CardContent></Card>
      <div className="space-y-6">
        <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#1769e0]" />Preparación</CardTitle></CardHeader><CardContent className="space-y-2">{organization.activationChecks.length ? organization.activationChecks.map((check) => <div key={check.code} className="flex gap-3 rounded-xl border border-[#e0e9ef] p-3">{check.status === "passed" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#159578]" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-[#c15039]" />}<div><p className="text-sm font-bold text-[#24415b]">{check.label}</p><p className="mt-1 text-xs leading-5 text-[#71869a]">{check.detail}</p></div></div>) : <p className="text-sm text-[#71869a]">Ejecuta “Verificar preparación” para crear la lista de activación.</p>}</CardContent></Card>
        <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-[#16a1b4]" />Acceso inicial</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-[#657b90]">Las invitaciones son de un solo uso, caducan y solo guardan el hash del token.</p><Button className="w-full rounded-xl" variant="outline" disabled={Boolean(working)} onClick={issueInvitation}>Generar nueva invitación</Button>{organization.invitations.map((invite) => <div key={invite.id} className="rounded-xl bg-[#f5f9fc] p-3 text-sm"><div className="flex justify-between gap-2"><strong className="text-[#24415b]">{invite.email}</strong><Badge variant="outline">{invite.status}</Badge></div><p className="mt-1 text-xs text-[#74889a]">Vence {new Date(invite.expiresAt).toLocaleString("es-MX")}</p>{invite.status === "pending" && <Button size="sm" variant="ghost" className="mt-2 h-8 px-2 text-[#a44c35]" disabled={Boolean(working)} onClick={() => revokeInvitation(invite.id)}>Revocar</Button>}</div>)}</CardContent></Card>
        <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle>Módulos y límites</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{organization.entitlements.filter((item) => item.moduleCode).map((item) => <Badge key={item.id} className="bg-[#e9f7f8] text-[#177886]">{item.moduleCode}</Badge>)}</div><div className="mt-4 space-y-2">{organization.limits.map((limit) => <div key={limit.id} className="flex justify-between text-sm"><span className="text-[#657b90]">{limit.featureCode}</span><strong className="text-[#24415b]">{limit.currentUsage} / {limit.includedQuantity}</strong></div>)}</div></CardContent></Card>
        <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle>Override temporal</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-[#657b90]">Excepción con motivo y vencimiento. No cambia el contrato original.</p><form className="space-y-3" onSubmit={(event) => void submitOverride(event)}><select className="h-11 w-full rounded-xl border border-[#ccdae5] bg-white px-3 text-sm" value={overrideTarget} onChange={(event) => { setOverrideTarget(event.target.value as "module" | "feature_limit"); setOverrideCode(""); setOverrideValue(event.target.value === "module" ? "1" : "0"); }}><option value="feature_limit">Límite de uso</option><option value="module">Módulo</option></select><select className="h-11 w-full rounded-xl border border-[#ccdae5] bg-white px-3 text-sm" value={overrideCode || overrideOptions[0] || ""} onChange={(event) => setOverrideCode(event.target.value)}>{overrideOptions.map((code) => <option key={code} value={code}>{code}</option>)}</select>{overrideTarget === "module" ? <select className="h-11 w-full rounded-xl border border-[#ccdae5] bg-white px-3 text-sm" value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)}><option value="1">Habilitar temporalmente</option><option value="0">Deshabilitar temporalmente</option></select> : <input className="h-11 w-full rounded-xl border border-[#ccdae5] px-3 text-sm" type="number" min="0" step="1" value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} aria-label="Límite temporal" required />}<input className="h-11 w-full rounded-xl border border-[#ccdae5] px-3 text-sm" type="date" value={overrideUntil} onChange={(event) => setOverrideUntil(event.target.value)} aria-label="Vigencia del override" required /><textarea className="min-h-20 w-full rounded-xl border border-[#ccdae5] p-3 text-sm" placeholder="Motivo obligatorio" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} required /><Button className="w-full rounded-xl" variant="outline" disabled={Boolean(working) || overrideReason.trim().length < 5}>Registrar override</Button></form>{organization.overrides.length > 0 && <div className="mt-4 space-y-2">{organization.overrides.slice(0, 4).map((item) => <div key={item.id} className="rounded-xl bg-[#f5f9fc] p-3 text-xs text-[#657b90]"><div className="flex justify-between gap-2"><strong className="text-[#24415b]">{item.moduleCode ?? item.featureCode}</strong><Badge variant="outline">{item.status}</Badge></div><p className="mt-1">{item.reason}</p><p className="mt-1">Vence {new Date(item.effectiveUntil).toLocaleString("es-MX")}</p></div>)}</div>}</CardContent></Card>
      </div>
    </div>
  </div>;
}

function Loading() { return <div className="flex min-h-[300px] items-center justify-center gap-2 text-[#6d8195]"><Loader2 className="size-5 animate-spin" />Cargando organización…</div>; }
function State({ title, detail }: { title: string; detail: string }) { return <Card className="rounded-2xl"><CardContent className="p-8 text-center"><CircleAlert className="mx-auto size-7 text-[#c15f42]" /><p className="mt-3 font-bold">{title}</p><p className="mt-2 text-sm text-[#71869a]">{detail}</p></CardContent></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <Card className="rounded-2xl border-[#d8e6ef]"><CardContent className="p-5"><p className="text-sm font-semibold text-[#6d8195]">{label}</p><p className="mt-2 text-3xl font-black text-[#153754]">{value}</p></CardContent></Card>; }
function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`flex flex-wrap items-center rounded-2xl border p-4 text-sm ${error ? "border-[#efc0b2] bg-[#fff6f2] text-[#9b3f27]" : "border-[#a7dfd1] bg-[#eefaf6] text-[#176b59]"}`}>{children}</div>; }
