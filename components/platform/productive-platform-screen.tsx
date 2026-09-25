"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Building2, CheckCircle2, ClipboardList, KeyRound, Loader2, NotebookTabs, Plus, RefreshCw, ShieldCheck, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import { CommercialOverviewPanel } from "@/components/platform/commercial-overview-panel";
import { PlatformShell } from "@/components/platform/platform-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTenancyQuery } from "@/hooks/use-tenancy";
import type { OrganizationSummary, PlatformIdentitySummary, PlatformSecuritySnapshot, TenantOverview } from "@/types";

export function ProductivePlatformScreen({ identity, security, signOutHref }: { identity: PlatformIdentitySummary; security: PlatformSecuritySnapshot; signOutHref: string }) {
  const overview = useTenancyQuery<TenantOverview>("view=overview");
  const organizations = useTenancyQuery<OrganizationSummary[]>("view=organizations");
  const [activeSessions, setActiveSessions] = React.useState(security.activeSessionCount);
  const [revoking, setRevoking] = React.useState(false);
  const [securityMessage, setSecurityMessage] = React.useState<string | null>(null);
  const attention = [
    overview.data?.acceptedQuotesReady ? { label: `${overview.data.acceptedQuotesReady} cotización(es) lista(s) para aprovisionar`, href: "/platform/organizaciones", tone: "blue" } : null,
    overview.data?.readyForReview ? { label: `${overview.data.readyForReview} onboarding(s) listo(s) para revisar`, href: "/platform/organizaciones?status=ready_for_review", tone: "teal" } : null,
    overview.data?.failedProvisioning ? { label: `${overview.data.failedProvisioning} aprovisionamiento(s) requieren atención`, href: "/platform/organizaciones", tone: "orange" } : null,
    overview.data?.pendingInvitations ? { label: `${overview.data.pendingInvitations} invitación(es) pendiente(s)`, href: "/platform/organizaciones", tone: "gray" } : null,
  ].filter((item): item is { label: string; href: string; tone: string } => Boolean(item));

  async function revokeOtherSessions() {
    setRevoking(true); setSecurityMessage(null);
    try {
      const response = await fetch("/api/platform/security/revoke-others", { method: "POST", credentials: "same-origin" });
      const body = await response.json() as { revokedCount?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No fue posible cerrar las otras sesiones.");
      setActiveSessions(1); setSecurityMessage(body.revokedCount ? `${body.revokedCount} sesión(es) cerrada(s).` : "No había otras sesiones activas.");
    } catch (error) { setSecurityMessage(error instanceof Error ? error.message : "No fue posible completar la acción."); }
    finally { setRevoking(false); }
  }

  return <PlatformShell identity={identity} signOutHref={signOutHref}>
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#0b2d4a] px-5 py-7 text-white shadow-[0_28px_70px_rgba(14,47,76,.17)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full bg-[#20c8c1]/20 blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[1fr_.95fr] xl:items-end">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-[#74ded9]"><Sparkles className="size-3.5" />KitchenMind Platform</div><h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight tracking-[-0.05em] sm:text-4xl">Vende, aprovisiona y acompaña desde un solo centro de control.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#b8ccd8]">Los indicadores provienen de datos persistentes. Ninguna organización demostrativa se mezcla con esta vista.</p><div className="mt-6 flex flex-wrap gap-2"><Button asChild className="h-11 rounded-xl bg-[#1dc4be] font-extrabold text-[#082e46] hover:bg-[#4ad7d1]"><Link href="/platform/prospectos/nuevo"><Plus className="size-4" />Nuevo prospecto</Link></Button><Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/platform/organizaciones"><Building2 className="size-4" />Organizaciones</Link></Button></div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.075] p-4 backdrop-blur"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Prioridades de implementación</p><Badge className="bg-[#1dc4be] text-[#08314a]">{attention.length}</Badge></div>{overview.loading ? <div className="mt-4 flex items-center gap-2 text-sm text-[#bed0da]"><Loader2 className="size-4 animate-spin" />Consultando Platform…</div> : attention.length ? <div className="mt-3 space-y-2">{attention.map((item) => <Link key={item.label} href={item.href} className="flex items-center gap-3 rounded-xl bg-white/[.07] p-3 text-sm font-semibold text-[#e7f0f5] transition hover:bg-white/[.12]"><span className={`size-2 rounded-full ${item.tone === "orange" ? "bg-[#ff9c6b]" : item.tone === "teal" ? "bg-[#58ddd4]" : item.tone === "blue" ? "bg-[#7ab4ff]" : "bg-[#b6c8d3]"}`} /><span className="flex-1">{item.label}</span><ArrowRight className="size-4 text-[#9bb2c1]" /></Link>)}</div> : <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[.07] p-3 text-sm text-[#dce8ee]"><CheckCircle2 className="size-5 text-[#68ddd7]" />No hay bloqueos operativos visibles.</div>}</div>
        </div>
      </section>

      {(overview.error || organizations.error) && <div className="flex gap-3 rounded-2xl border border-[#edc3b6] bg-[#fff6f2] p-4 text-sm text-[#97442c]"><AlertTriangle className="size-5 shrink-0" />{overview.error ?? organizations.error}</div>}

      <section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#168b95]">Ciclo del cliente</p><h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#143653]">Estado de implementación</h2></div><Button variant="ghost" size="sm" onClick={() => void Promise.all([overview.refresh(), organizations.refresh()])}><RefreshCw className="size-4" />Actualizar</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PlatformMetric icon={NotebookTabs} label="Cotizaciones aceptadas" value={overview.data?.acceptedQuotesReady ?? 0} detail="Listas para crear organización" /><PlatformMetric icon={Building2} label="En onboarding" value={overview.data?.onboarding ?? 0} detail="Configuración con cliente" /><PlatformMetric icon={ClipboardList} label="Listas para revisar" value={overview.data?.readyForReview ?? 0} detail="Esperan decisión de Platform" /><PlatformMetric icon={UserRoundCheck} label="Organizaciones activas" value={overview.data?.active ?? 0} detail="Operación habilitada" /></div></section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div><div className="flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#168b95]">Implementaciones recientes</p><h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#143653]">Organizaciones</h2></div><Button asChild variant="outline" className="rounded-xl"><Link href="/platform/organizaciones">Ver todas <ArrowRight className="size-4" /></Link></Button></div><div className="mt-4 space-y-3">{organizations.loading && !organizations.data ? <div className="rounded-2xl border border-[#d7e5ec] bg-white p-8 text-center text-sm text-[#6a8093]"><Loader2 className="mx-auto mb-3 size-5 animate-spin" />Consultando organizaciones…</div> : organizations.data?.length ? organizations.data.slice(0, 4).map((organization) => <Link key={organization.id} href={`/platform/organizaciones/${organization.id}`} className="group block rounded-[1.35rem] border border-[#d6e4eb] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#91cfd2] hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#183a57]">{organization.commercialName}</p><p className="mt-1 text-xs text-[#718598]">{organization.code} · {organization.activeModuleCount} módulos</p></div><Badge className={organization.status === "active" ? "bg-[#e5f8f1] text-[#11745f]" : "bg-[#eaf2ff] text-[#1769df]"}>{organization.status.replaceAll("_", " ")}</Badge></div><div className="mt-4 flex items-center gap-3"><Progress value={organization.onboardingPercentage} className="flex-1" /><strong className="text-sm text-[#29465f]">{organization.onboardingPercentage}%</strong></div></Link>) : <div className="rounded-2xl border border-dashed border-[#bcd0da] bg-white/70 p-8 text-center"><Building2 className="mx-auto size-7 text-[#3c9ca2]" /><p className="mt-3 font-black text-[#183a57]">Aún no hay organizaciones</p><p className="mt-2 text-sm text-[#6a8093]">Una cotización aceptada aparecerá aquí cuando esté lista para aprovisionar.</p></div>}</div></div>
        <div className="space-y-4"><Card id="security" className="rounded-[1.5rem] border-[#d5e4eb]"><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf2ff] text-[#1769df]"><ShieldCheck className="size-5" /></div><Badge className="bg-[#e4f8f1] text-[#11745f]">MFA activo</Badge></div><h2 className="mt-5 text-lg font-black text-[#183a57]">Seguridad de Platform</h2><p className="mt-1 text-sm leading-6 text-[#6b8093]">{activeSessions} sesión(es) activa(s) · {security.failedAttemptsLast24Hours} intento(s) fallido(s) en 24 h.</p>{securityMessage && <p className="mt-3 rounded-xl bg-[#f1f6f9] p-3 text-xs text-[#587185]">{securityMessage}</p>}<Button variant="outline" className="mt-4 w-full rounded-xl" disabled={revoking || activeSessions <= 1} onClick={() => void revokeOtherSessions()}>{revoking ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Cerrar otras sesiones</Button></CardContent></Card><Card className="rounded-[1.5rem] border-[#d5e4eb]"><CardContent className="p-5"><BookOpen className="size-6 text-[#159197]" /><h2 className="mt-4 text-lg font-black text-[#183a57]">Accesos rápidos</h2><div className="mt-3 space-y-1"><QuickLink href="/platform/prospectos" icon={UsersRound} label="Prospectos" /><QuickLink href="/platform/cotizaciones" icon={NotebookTabs} label="Cotizaciones" /><QuickLink href="/platform/organizaciones" icon={Building2} label="Onboardings" /><QuickLink href="/platform/catalogo" icon={BookOpen} label="Catálogo" /></div></CardContent></Card></div>
      </section>

      <CommercialOverviewPanel />
    </div>
  </PlatformShell>;
}

function PlatformMetric({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: number; detail: string }) { return <Card className="rounded-[1.35rem] border-[#d5e4eb]"><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex size-10 items-center justify-center rounded-xl bg-[#e8f4f5] text-[#148a93]"><Icon className="size-5" /></div><span className="text-3xl font-black tracking-[-0.05em] text-[#143653]">{value}</span></div><p className="mt-5 text-sm font-extrabold text-[#29465f]">{label}</p><p className="mt-1 text-xs text-[#718699]">{detail}</p></CardContent></Card>; }
function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Building2; label: string }) { return <Button asChild variant="ghost" className="w-full justify-between rounded-xl px-3 text-[#3b5870]"><Link href={href}><span className="flex items-center gap-2"><Icon className="size-4 text-[#168c96]" />{label}</span><ArrowRight className="size-4" /></Link></Button>; }
