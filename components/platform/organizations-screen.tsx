"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, CheckCircle2, CircleAlert, Filter, Loader2, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { platformTenancyMutation, useTenancyQuery } from "@/hooks/use-tenancy";
import type { OrganizationSummary, ProvisioningEligibility, ProvisionOrganizationResult, TenantOverview } from "@/types";

const statusLabels: Record<string, string> = { provisioning: "Aprovisionando", onboarding: "En onboarding", ready_for_review: "Lista para revisión", active: "Activa", restricted: "Restringida", suspended: "Suspendida", cancelled: "Cancelada" };

export function OrganizationsScreen() {
  const overview = useTenancyQuery<TenantOverview>("view=overview");
  const accepted = useTenancyQuery<ProvisioningEligibility[]>("view=accepted_quotes");
  const organizations = useTenancyQuery<OrganizationSummary[]>("view=organizations");
  const [working, setWorking] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ProvisionOrganizationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [moduleCode, setModuleCode] = React.useState("all");
  const [onlyBlocked, setOnlyBlocked] = React.useState(false);

  async function provision(quoteId: string) {
    setWorking(quoteId); setError(null); setResult(null);
    try {
      const created = await platformTenancyMutation<ProvisionOrganizationResult>("provision", { quoteId, idempotencyKey: crypto.randomUUID() });
      setResult(created); await Promise.all([overview.refresh(), accepted.refresh(), organizations.refresh()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible crear la organización."); }
    finally { setWorking(null); }
  }

  const busy = overview.loading || accepted.loading || organizations.loading;
  const loadError = overview.error || accepted.error || organizations.error;
  const moduleOptions = Array.from(new Set((organizations.data ?? []).flatMap((organization) => organization.moduleCodes))).sort();
  const filteredOrganizations = (organizations.data ?? []).filter((organization) => {
    const term = search.trim().toLocaleLowerCase("es-MX");
    const matchesSearch = !term || [organization.commercialName, organization.code, organization.administratorEmail ?? "", organization.sourceQuoteNumber].some((value) => value.toLocaleLowerCase("es-MX").includes(term));
    return matchesSearch && (status === "all" || organization.status === status) && (moduleCode === "all" || organization.moduleCodes.includes(moduleCode)) && (!onlyBlocked || organization.blockerCount > 0);
  });
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><p className="text-sm font-bold text-[#168ca0]">APROVISIONAMIENTO</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Organizaciones cliente</h1><p className="mt-2 max-w-3xl text-[#667d92]">Convierte una cotización aceptada en una organización aislada, con módulos, límites, onboarding e invitación trazables.</p></div>
      <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => void Promise.all([overview.refresh(), accepted.refresh(), organizations.refresh()])}><RefreshCw className="size-4" />Actualizar</Button>
    </div>
    {loadError && <Notice tone="error">{loadError}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {result && <Notice tone="success"><span>Organización creada. {result.invitationUrl ? "Copia el enlace temporal y entrégalo por un canal seguro." : "La solicitud ya había sido procesada."}</span>{result.invitationUrl && <Button size="sm" variant="outline" className="ml-3 rounded-lg" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${result.invitationUrl}`)}>Copiar invitación</Button>}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Cotizaciones listas" value={overview.data?.acceptedQuotesReady ?? 0} /><Metric label="En onboarding" value={overview.data?.onboarding ?? 0} /><Metric label="Listas para revisar" value={overview.data?.readyForReview ?? 0} /><Metric label="Organizaciones activas" value={overview.data?.active ?? 0} />
    </div>
    <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#173653]"><Plus className="size-5 text-[#16a1b4]" />Cotizaciones aceptadas</CardTitle></CardHeader><CardContent className="space-y-3">
      {busy && !accepted.data ? <Loading /> : accepted.data?.length ? accepted.data.map((quote) => <div key={quote.quoteId} className="flex flex-col gap-3 rounded-2xl border border-[#dce9f1] bg-[#f9fcfe] p-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-[#183a58]">{quote.prospectName}</p><Badge variant="outline">{quote.quoteNumber}</Badge></div>{quote.issues.length ? <p className="mt-2 text-sm text-[#a25527]">{quote.issues.join(" ")}</p> : <p className="mt-2 text-sm text-[#5d768c]">Alcance comercial bloqueado y listo para aprovisionar.</p>}</div><Button className="min-h-11 rounded-xl" disabled={!quote.eligible || working === quote.quoteId} onClick={() => void provision(quote.quoteId)}>{working === quote.quoteId ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}Crear organización</Button></div>) : <Empty title="No hay cotizaciones listas" detail="Cuando una cotización aceptada cumpla las validaciones, aparecerá aquí sin volver a capturar sus datos." />}
    </CardContent></Card>
    <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#173653]"><ShieldCheck className="size-5 text-[#1769e0]" />Clientes aprovisionados</CardTitle></CardHeader><CardContent>
      {organizations.data?.length ? <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#7a8fa1]" /><Input className="h-11 rounded-xl pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, código, administrador o cotización" aria-label="Buscar organizaciones" /></label><select className="h-11 rounded-xl border border-[#cad9e3] bg-white px-3 text-sm font-semibold text-[#38536a]" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por estado"><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="h-11 rounded-xl border border-[#cad9e3] bg-white px-3 text-sm font-semibold text-[#38536a]" value={moduleCode} onChange={(event) => setModuleCode(event.target.value)} aria-label="Filtrar por módulo"><option value="all">Todos los módulos</option>{moduleOptions.map((code) => <option key={code} value={code}>{code}</option>)}</select><Button variant={onlyBlocked ? "default" : "outline"} className="min-h-11 rounded-xl" onClick={() => setOnlyBlocked((value) => !value)}><Filter className="size-4" />Con bloqueos</Button></div> : null}
      {busy && !organizations.data ? <Loading /> : organizations.data?.length ? filteredOrganizations.length ? <div className="grid gap-4 lg:grid-cols-2">{filteredOrganizations.map((organization) => <Link key={organization.id} href={`/platform/organizaciones/${organization.id}`} className="group rounded-2xl border border-[#dce8f1] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#8dd4df] hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-[#163653]">{organization.commercialName}</p><p className="mt-1 text-sm text-[#71869a]">{organization.code} · {organization.sourceQuoteNumber}</p></div><Badge className="bg-[#e9f4ff] text-[#1769e0]">{statusLabels[organization.status] ?? organization.status}</Badge></div><div className="mt-4 grid gap-2 text-xs text-[#60778d] sm:grid-cols-2"><span><strong className="text-[#38536a]">Administrador:</strong> {organization.administratorEmail ?? "Invitación pendiente"}</span><span><strong className="text-[#38536a]">Última actividad:</strong> {new Date(organization.updatedAt).toLocaleDateString("es-MX")}</span></div><div className="mt-5 flex items-center justify-between text-sm"><span className="text-[#60778d]">Onboarding</span><strong className="text-[#173653]">{organization.onboardingPercentage}%</strong></div><Progress value={organization.onboardingPercentage} className="mt-2" /><div className="mt-4 flex flex-wrap gap-2 text-xs text-[#60778d]"><span className="rounded-lg bg-[#f1f6f9] px-2 py-1">{organization.branchCount} sucursal(es)</span>{organization.moduleCodes.map((code) => <span key={code} className="rounded-lg bg-[#eef5ff] px-2 py-1 font-bold text-[#35669c]">{code}</span>)}{organization.blockerCount > 0 && <span className="rounded-lg bg-[#fff1eb] px-2 py-1 font-semibold text-[#a45a24]">{organization.blockerCount} bloqueo(s)</span>}{organization.pendingInvitationCount > 0 && <span className="rounded-lg bg-[#fff7df] px-2 py-1 font-semibold text-[#8d6416]">Invitación pendiente</span>}</div><p className="mt-4 text-sm font-bold text-[#1769df]">{organization.status === "ready_for_review" ? "Siguiente: revisar y activar" : organization.status === "active" ? "Siguiente: supervisar operación" : "Siguiente: continuar implementación"}</p></Link>)}</div> : <Empty title="No hay coincidencias" detail="Ajusta la búsqueda o los filtros para ver otras organizaciones." /> : <Empty title="Aún no hay organizaciones" detail="El primer cliente aparecerá aquí después de aprovisionar una cotización aceptada." />}
    </CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card className="rounded-2xl border-[#d8e6ef]"><CardContent className="p-5"><p className="text-sm font-semibold text-[#6d8195]">{label}</p><p className="mt-2 text-3xl font-black text-[#153754]">{value}</p></CardContent></Card>; }
function Loading() { return <div className="flex items-center gap-2 py-10 text-sm text-[#6f8395]"><Loader2 className="size-4 animate-spin" />Consultando datos persistentes…</div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="rounded-2xl border border-dashed border-[#bfd2df] p-8 text-center"><CheckCircle2 className="mx-auto size-7 text-[#43a8b6]" /><p className="mt-3 font-bold text-[#173653]">{title}</p><p className="mx-auto mt-2 max-w-xl text-sm text-[#71869a]">{detail}</p></div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "success" | "error" }) { return <div className={`flex flex-wrap items-center rounded-2xl border p-4 text-sm ${tone === "success" ? "border-[#a7dfd1] bg-[#eefaf6] text-[#176b59]" : "border-[#efc0b2] bg-[#fff6f2] text-[#9b3f27]"}`}>{tone === "error" && <CircleAlert className="mr-2 size-4" />}{children}</div>; }
