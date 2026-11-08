"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, Loader2, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { PlatformShell } from "@/components/platform/platform-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTenancyQuery } from "@/hooks/use-tenancy";
import type { OrganizationSummary, PlatformIdentitySummary, PlatformSecuritySnapshot, TenantOverview } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  provisioning: "Creando empresa", onboarding: "En preparación", ready_for_review: "Lista para revisar",
  active: "Activa", restricted: "Restringida", suspended: "Suspendida", cancelled: "Cancelada",
};

export function ProductivePlatformScreen({ identity, security, signOutHref }: { identity: PlatformIdentitySummary; security: PlatformSecuritySnapshot; signOutHref: string }) {
  const overview = useTenancyQuery<TenantOverview>("view=overview");
  const organizations = useTenancyQuery<OrganizationSummary[]>("view=organizations");
  const [search, setSearch] = React.useState("");
  const [activeSessions, setActiveSessions] = React.useState(security.activeSessionCount);
  const [revoking, setRevoking] = React.useState(false);
  const [securityMessage, setSecurityMessage] = React.useState<string | null>(null);
  const attention = [
    overview.data?.failedProvisioning ? { count: overview.data.failedProvisioning, label: "Empresas con problemas al crearse", href: "/platform/organizaciones" } : null,
    overview.data?.readyForReview ? { count: overview.data.readyForReview, label: "Empresas listas para revisar", href: "/platform/organizaciones?status=ready_for_review" } : null,
    overview.data?.acceptedQuotesReady ? { count: overview.data.acceptedQuotesReady, label: "Cotizaciones aceptadas por convertir en empresas", href: "/platform/organizaciones" } : null,
    overview.data?.pendingInvitations ? { count: overview.data.pendingInvitations, label: "Invitaciones pendientes", href: "/platform/organizaciones" } : null,
  ].filter((item): item is { count: number; label: string; href: string } => Boolean(item));
  const recent = (organizations.data ?? []).filter((organization) => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    return !query || [organization.commercialName, organization.code, organization.administratorEmail ?? ""].some((value) => value.toLocaleLowerCase("es-MX").includes(query));
  }).slice(0, 4);

  async function revokeOtherSessions() {
    setRevoking(true); setSecurityMessage(null);
    try {
      const response = await fetch("/api/platform/security/revoke-others", { method: "POST", credentials: "same-origin" });
      const body = await response.json() as { revokedCount?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No fue posible cerrar las otras sesiones.");
      setActiveSessions(1);
      setSecurityMessage(body.revokedCount ? `${body.revokedCount} sesión(es) cerrada(s).` : "No había otras sesiones activas.");
    } catch (error) { setSecurityMessage(error instanceof Error ? error.message : "No fue posible completar la acción."); }
    finally { setRevoking(false); }
  }

  return <PlatformShell identity={identity} signOutHref={signOutHref}>
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#168b95]">KitchenMind Platform</p>
        <h1 className="text-3xl font-black tracking-[-0.04em] text-[#102b48] sm:text-4xl">¿Qué necesita mi atención?</h1>
        <p className="text-sm leading-6 text-[#60758b]">Tus empresas y los siguientes pasos, en un solo lugar.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Button asChild className="min-h-14 rounded-2xl bg-[#1769df] text-base font-extrabold shadow-sm hover:bg-[#1056b9]"><Link href="/platform/organizaciones#nueva-empresa"><Plus className="size-5" />Nueva empresa</Link></Button>
        <Button asChild variant="outline" className="min-h-14 rounded-2xl"><Link href="/platform/prospectos/nuevo">Registrar prospecto <ArrowRight className="size-4" /></Link></Button>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-4 size-5 text-[#7a90a3]" />
        <input className="min-h-14 w-full rounded-2xl border border-[#d4e2eb] bg-white pl-12 pr-4 text-base text-[#173653] outline-none focus-visible:ring-2 focus-visible:ring-[#1769df]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar entre las empresas cargadas" aria-label="Buscar entre las empresas cargadas" />
      </label>

      <section aria-label="Resumen de empresas" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Activas" value={overview.data?.active} loading={overview.loading} error={Boolean(overview.error)} />
        <Metric label="En preparación" value={overview.data?.onboarding} loading={overview.loading} error={Boolean(overview.error)} />
        <Metric label="Listas para revisar" value={overview.data?.readyForReview} loading={overview.loading} error={Boolean(overview.error)} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-[#143653]">Por resolver</h2><Button variant="ghost" size="sm" onClick={() => void Promise.all([overview.refresh(), organizations.refresh()])}><RefreshCw className="size-4" />Actualizar</Button></div>
        {overview.error ? <ErrorNotice message={overview.error} /> : overview.loading && !overview.data ? <Loading /> : attention.length ? <div className="grid gap-2">{attention.map((item) => <Link key={item.label} href={item.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#d8e6ef] bg-white p-4 hover:border-[#8dc8d9]"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff3e9] font-black text-[#a35a25]">{item.count}</span><span className="flex-1 text-sm font-bold text-[#24425e]">{item.label}</span><ArrowRight className="size-5 text-[#1769df]" /></Link>)}</div> : <div className="flex items-center gap-3 rounded-2xl border border-[#d8e6ef] bg-white p-4 text-sm text-[#526b80]"><CheckCircle2 className="size-5 text-[#168b95]" />No hay pendientes en los indicadores disponibles.</div>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-[#143653]">Mis empresas</h2><Button asChild variant="ghost" size="sm"><Link href="/platform/organizaciones">Ver todas <ArrowRight className="size-4" /></Link></Button></div>
        {organizations.error ? <ErrorNotice message={organizations.error} /> : organizations.loading && !organizations.data ? <Loading /> : recent.length ? <div className="grid gap-3 md:grid-cols-2">{recent.map((organization) => <Link key={organization.id} href={`/platform/organizaciones/${organization.id}`} className="block rounded-2xl border border-[#d8e6ef] bg-white p-4 transition hover:border-[#8dc8d9] hover:shadow-sm">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-[#173653]">{organization.commercialName}</p><p className="mt-1 text-xs text-[#708599]">{organization.code}</p></div><span className="shrink-0 rounded-full bg-[#edf4ff] px-2 py-1 text-xs font-bold text-[#1769df]">{STATUS_LABELS[organization.status] ?? organization.status}</span></div>
          <div className="mt-4 flex items-center justify-between text-xs text-[#60758b]"><span>Preparación</span><strong className="text-[#173653]">{organization.onboardingPercentage}%</strong></div><Progress value={organization.onboardingPercentage} className="mt-2" />
          <div className="mt-4 flex items-center justify-between gap-2 text-sm font-bold text-[#1769df]"><span>{organization.blockerCount > 0 ? `${organization.blockerCount} pendiente(s) por resolver` : organization.status === "active" ? "Ver empresa" : "Continuar preparación"}</span><ArrowRight className="size-4 shrink-0" /></div>
        </Link>)}</div> : <div className="rounded-2xl border border-dashed border-[#c5d6e2] bg-white p-6 text-sm text-[#60758b]">{search ? "No hay coincidencias entre las empresas cargadas." : "Aún no hay empresas registradas."}</div>}
        <p className="text-xs text-[#71869a]">Esta búsqueda revisa las empresas cargadas. La búsqueda global entre miles de empresas se implementará en una etapa posterior.</p>
      </section>

      <details className="rounded-2xl border border-[#d8e6ef] bg-white p-4">
        <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-bold text-[#284963]"><ShieldCheck className="size-5 text-[#1769df]" />Seguridad y herramientas adicionales</summary>
        <div className="mt-4 space-y-3 border-t border-[#e5edf3] pt-4"><p className="text-sm text-[#60758b]">{activeSessions} sesión(es) activa(s) · {security.failedAttemptsLast24Hours} intento(s) fallido(s) en 24 horas.</p>
          {securityMessage && <p role="status" className="text-sm text-[#526b80]">{securityMessage}</p>}
          <Button variant="outline" className="min-h-11 rounded-xl" disabled={revoking || activeSessions <= 1} onClick={() => void revokeOtherSessions()}>{revoking ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Cerrar otras sesiones</Button>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/platform/cotizaciones">Cotizaciones</Link></Button><Button asChild variant="outline"><Link href="/platform/catalogo">Catálogo</Link></Button></div>
        </div>
      </details>
    </div>
  </PlatformShell>;
}

function Metric({ label, value, loading, error }: { label: string; value?: number; loading: boolean; error: boolean }) {
  return <Card className="rounded-2xl border-[#d8e6ef]"><CardContent className="p-4"><p className="text-xs font-bold text-[#60758b]">{label}</p><p className="mt-2 text-3xl font-black text-[#143653]">{error ? "Error" : loading && value === undefined ? "…" : value === undefined ? "—" : value}</p>{error && <p className="mt-1 text-xs text-[#a34c30]">No se pudo consultar</p>}</CardContent></Card>;
}
function Loading() { return <div className="flex items-center gap-2 rounded-2xl border border-[#d8e6ef] bg-white p-5 text-sm text-[#60758b]"><Loader2 className="size-4 animate-spin" />Consultando información…</div>; }
function ErrorNotice({ message }: { message: string }) { return <div role="alert" className="flex gap-3 rounded-2xl border border-[#edc3b6] bg-[#fff6f2] p-4 text-sm text-[#97442c]"><AlertTriangle className="size-5 shrink-0" />{message}</div>; }
