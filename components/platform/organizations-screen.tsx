"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, CircleAlert, Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { platformTenancyMutation, useTenancyQuery } from "@/hooks/use-tenancy";
import type { OrganizationSummary, ProvisioningEligibility, ProvisionOrganizationResult, TenantOverview } from "@/types";

const statuses: Record<string, string> = { provisioning: "Creando empresa", onboarding: "En preparación", ready_for_review: "Lista para revisión", active: "Activa", restricted: "Restringida", suspended: "Suspendida", cancelled: "Cancelada" };
type Page = { items: OrganizationSummary[]; total: number; page: number; pageSize: number; pages: number };

export function OrganizationsScreen() {
  const [search, setSearch] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [onlyBlocked, setOnlyBlocked] = React.useState(false);
  const [showWizard, setShowWizard] = React.useState(false);
  const [selectedQuote, setSelectedQuote] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ProvisionOrganizationResult | null>(null);
  const overview = useTenancyQuery<TenantOverview>("view=overview");
  const accepted = useTenancyQuery<ProvisioningEligibility[]>("view=accepted_quotes");
  const params = new URLSearchParams({ view: "organizations_page", search: term, status, page: String(page), pageSize: "20", onlyBlocked: String(onlyBlocked) });
  const companies = useTenancyQuery<Page>(params.toString());
  const selected = accepted.data?.find((quote) => quote.quoteId === selectedQuote);
  React.useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 350); return () => window.clearTimeout(timer); }, [search]);
  React.useEffect(() => { if (window.location.hash === "#nueva-empresa") setShowWizard(true); }, []);

  async function createCompany() {
    if (!selected?.eligible || working) return;
    setWorking(true); setError(null); setResult(null);
    try {
      const created = await platformTenancyMutation<ProvisionOrganizationResult>("provision", { quoteId: selected.quoteId, idempotencyKey: crypto.randomUUID() });
      setResult(created);
      await Promise.all([companies.refresh(), overview.refresh(), accepted.refresh()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible crear la empresa."); }
    finally { setWorking(false); }
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-xs font-extrabold uppercase tracking-widest text-[#168b95]">KitchenMind Platform</p><h1 className="mt-2 text-3xl font-black text-[#143653]">Mis empresas</h1><p className="mt-2 text-sm text-[#60758b]">Busca una empresa o registra una nueva desde una cotización aceptada.</p></header>
    <Button id="nueva-empresa" className="min-h-14 w-full rounded-2xl text-base font-extrabold sm:w-auto" onClick={() => { setShowWizard((value) => !value); setError(null); }}><Plus className="size-5" />{showWizard ? "Cerrar alta guiada" : "Nueva empresa"}</Button>

    {showWizard && <section className="scroll-mt-28 space-y-4 rounded-2xl border border-[#cbdfe9] bg-white p-4 sm:p-6" aria-label="Alta guiada">
      <h2 className="text-xl font-black text-[#143653]">Crear empresa, paso a paso</h2>
      {result ? <div className="space-y-3"><p className="flex items-center gap-2 font-bold text-[#168b75]"><CheckCircle2 className="size-5" />Empresa creada correctamente</p><p className="text-sm text-[#60758b]">El siguiente paso es preparar la empresa y comprobar sus requisitos de activación.</p><Button asChild className="min-h-12 rounded-xl"><Link href={`/platform/organizaciones/${result.organizationId}#preparar-empresa`}>Preparar empresa <ArrowRight className="size-4" /></Link></Button></div> : <>
        <div className="rounded-xl bg-[#eef5ff] p-4 text-sm leading-6 text-[#315775]"><strong>Paso 1 de 2 · Selecciona una cotización aceptada.</strong><p>KitchenMind reutiliza los datos de la cotización: nombre, administrador, módulos y límites. No necesitas volver a capturarlos.</p></div>
        {accepted.loading && !accepted.data ? <Loading /> : accepted.error ? <ErrorNotice message={accepted.error} /> : accepted.data?.length ? <div className="space-y-2">{accepted.data.map((quote) => <label key={quote.quoteId} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selectedQuote === quote.quoteId ? "border-[#1769df] bg-[#f1f6ff]" : "border-[#dce8f1]"}`}><input type="radio" className="mt-1 size-5" name="quote" checked={selectedQuote === quote.quoteId} onChange={() => setSelectedQuote(quote.quoteId)} /><span className="min-w-0"><strong className="block text-[#24415b]">{quote.prospectName}</strong><span className="block text-sm text-[#60758b]">{quote.quoteNumber}</span>{!quote.eligible && <span className="mt-1 block text-sm text-[#a34c30]">{quote.issues.join(" ")}</span>}</span></label>)}</div> : <div className="space-y-3 rounded-xl border border-dashed p-4"><p className="text-sm text-[#60758b]">Todavía no hay cotizaciones aceptadas disponibles para crear una empresa.</p><Button asChild variant="outline"><Link href="/platform/cotizaciones">Ir a cotizaciones <ArrowRight className="size-4" /></Link></Button></div>}
        {selected && <div className="space-y-3 rounded-xl bg-[#f6f9fc] p-4"><p className="font-bold text-[#24415b]">Paso 2 de 2 · Confirma</p><p className="text-sm text-[#60758b]">Empresa: <strong>{selected.prospectName}</strong> · Cotización: <strong>{selected.quoteNumber}</strong></p><p className="text-sm text-[#60758b]">Se utilizarán los datos contratados y las validaciones actuales. Esta acción creará la empresa y su invitación inicial.</p><Button className="min-h-12 w-full rounded-xl" disabled={!selected.eligible || working} onClick={() => void createCompany()}>{working ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}Confirmar y crear empresa</Button></div>}
        {error && <ErrorNotice message={error} />}
      </>}
    </section>}

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Activas", overview.data?.active], ["En preparación", overview.data?.onboarding], ["Listas para revisar", overview.data?.readyForReview]].map(([label, value]) => <Card key={String(label)} className="rounded-2xl border-[#d8e6ef]"><CardContent className="p-4"><p className="text-xs font-semibold text-[#60758b]">{label}</p><p className="mt-2 text-2xl font-black text-[#143653]">{overview.error ? "Error" : value ?? "—"}</p></CardContent></Card>)}</div>

    <section className="space-y-4"><h2 className="text-xl font-black text-[#143653]">Buscar empresas</h2>
      <label className="relative block"><Search className="absolute left-3 top-3.5 size-5 text-[#8194a5]" /><Input className="min-h-12 rounded-xl pl-11" placeholder="Nombre, código, cotización o correo" aria-label="Buscar empresas" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">{[["all", "Todas"], ["active", "Activas"], ["onboarding", "En preparación"], ["ready_for_review", "Listas"], ["suspended", "Suspendidas"]].map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} className="min-h-10 rounded-xl" onClick={() => { setStatus(value); setPage(1); }}>{label}</Button>)}<Button size="sm" variant={onlyBlocked ? "default" : "outline"} className="min-h-10 rounded-xl" onClick={() => { setOnlyBlocked((value) => !value); setPage(1); }}>Con bloqueos</Button></div>
      {companies.error ? <ErrorNotice message={companies.error} /> : companies.loading && !companies.data ? <Loading /> : companies.data?.items.length ? <div className="grid gap-3 sm:grid-cols-2">{companies.data.items.map((company) => <Link key={company.id} href={`/platform/organizaciones/${company.id}`} className="rounded-2xl border border-[#dce8f1] bg-white p-4 hover:border-[#8dd4df]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-extrabold text-[#173653]">{company.commercialName}</p><p className="mt-1 text-xs text-[#60758b]">{company.code}</p></div><Badge className="shrink-0 bg-[#e9f4ff] text-[#1769e0]">{statuses[company.status] ?? company.status}</Badge></div><div className="mt-4 flex justify-between text-xs text-[#60758b]"><span>Preparación</span><strong>{company.onboardingPercentage}%</strong></div><Progress className="mt-2" value={company.onboardingPercentage} /><p className="mt-3 text-sm font-bold text-[#1769df]">{company.blockerCount ? `${company.blockerCount} pendiente(s) · Resolver` : "Ver ficha de empresa"} <ArrowRight className="inline size-4" /></p></Link>)}</div> : <div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-[#60758b]">No hay empresas que coincidan con esta búsqueda.</div>}
      {companies.data && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm text-[#60758b]"><span>{companies.data.total} empresa(s) · Página {companies.data.page} de {companies.data.pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={companies.loading || companies.data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ArrowLeft className="size-4" />Anterior</Button><Button variant="outline" size="sm" disabled={companies.loading || companies.data.page >= companies.data.pages} onClick={() => setPage((p) => p + 1)}>Siguiente <ArrowRight className="size-4" /></Button></div></div>}
      {companies.loading && companies.data && <p role="status" className="text-sm text-[#60758b]">Actualizando resultados…</p>}
    </section>
  </div>;
}
function Loading() { return <div className="flex items-center gap-2 p-4 text-sm text-[#60758b]"><Loader2 className="size-4 animate-spin" />Cargando…</div>; }
function ErrorNotice({ message }: { message: string }) { return <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#efc0b2] bg-[#fff6f2] p-4 text-sm text-[#9b3f27]"><CircleAlert className="size-5 shrink-0" />{message}</p>; }
