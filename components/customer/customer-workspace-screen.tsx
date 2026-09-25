"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Bell, Boxes, Building2, CalendarDays, CheckCircle2, ChefHat, ClipboardCheck,
  Cloud, Download, Gauge, LayoutDashboard, Loader2, LogOut, MapPin, Menu, Package, RefreshCw, Settings2, ShieldCheck,
  ShoppingCart, SlidersHorizontal, Sparkles, TriangleAlert, UsersRound, Warehouse,
} from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { customerDashboardMutation, useDashboardQuery } from "@/hooks/use-dashboard";
import { clearDashboardOfflineSnapshots } from "@/offline/dashboard-snapshot-cache";
import type { DashboardPeriod, DashboardResolvedWidget, DashboardSnapshot } from "@/types";

const ICONS: Record<string, typeof Gauge> = {
  employees_active: UsersRound, shifts_active: CalendarDays, service_types: ChefHat, quality_templates: ClipboardCheck,
  products_active: Boxes, warehouses_active: Warehouse, devices_active: Cloud, inventory_movements: Package,
  inventory_low_stock: TriangleAlert, pending_imports: AlertTriangle, onboarding_progress: CheckCircle2,
  branch_overview: Building2, attendance_today: UsersRound, services_today: ChefHat, quality_alerts: ClipboardCheck,
  purchases_pending: ShoppingCart, production_pending: Package, sync_pending: Cloud, waste_cost: Gauge,
};

const PERIOD_LABELS: Record<DashboardPeriod, string> = { today: "Hoy", last_7_days: "7 días", last_30_days: "30 días" };

export function CustomerWorkspaceScreen({ organizationId, branchId, period, identityId, identityLabel, signOutHref }: { organizationId?: string; branchId?: string; period?: string; identityId: string; identityLabel: string; signOutHref: string }) {
  const queryString = new URLSearchParams();
  if (organizationId) queryString.set("organizationId", organizationId);
  if (branchId) queryString.set("branchId", branchId);
  if (period) queryString.set("period", period);
  const query = useDashboardQuery<DashboardSnapshot>(queryString.toString(), "customer", true, identityId);
  if (query.loading && !query.data) return <FullState loading title="Preparando tu tablero" detail="Validamos organización, rol, permisos, sucursales, módulos y fuentes disponibles." />;
  if (query.error || !query.data) return <FullState title="No pudimos abrir este tablero" detail={query.error ?? "No existe una operación autorizada para esta cuenta."} />;
  return <CustomerWorkspaceView snapshot={query.data} identityId={identityId} identityLabel={identityLabel} signOutHref={signOutHref} refresh={() => void query.refresh()} refreshing={query.loading} />;
}

export function CustomerWorkspaceView({ snapshot, identityId, identityLabel, signOutHref, refresh, refreshing = false }: { snapshot: DashboardSnapshot; identityId: string; identityLabel: string; signOutHref: string; refresh?: () => void; refreshing?: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const selectedBranch = snapshot.branches.find((branch) => branch.id === snapshot.selectedBranchId) ?? null;
  const organizationId = snapshot.organization.id;
  const baseParams = new URLSearchParams({ organizationId, period: snapshot.filters.period });
  if (snapshot.selectedBranchId) baseParams.set("branchId", snapshot.selectedBranchId);
  const baseQuery = baseParams.toString();
  const date = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: snapshot.filters.timezone }).format(new Date());
  const restricted = snapshot.organization.status === "restricted";
  const qualityAvailable = snapshot.moduleCodes.includes("QUALITY") && snapshot.membership.permissions.includes("dashboard.view_quality_details");

  const navigateWith = (next: { organizationId?: string; branchId?: string | null; period?: DashboardPeriod }) => {
    const params = new URLSearchParams();
    params.set("organizationId", next.organizationId ?? organizationId);
    const nextBranch = next.branchId === undefined ? snapshot.selectedBranchId : next.branchId;
    if (nextBranch === null) params.set("branchId", "all");
    else if (nextBranch) params.set("branchId", nextBranch);
    params.set("period", next.period ?? snapshot.filters.period);
    const destination = `/app?${params.toString()}`;
    if (next.organizationId && next.organizationId !== organizationId) {
      void clearDashboardOfflineSnapshots(identityId).finally(() => window.location.assign(destination));
      return;
    }
    window.location.assign(destination);
  };

  const signOut = () => void clearDashboardOfflineSnapshots(identityId).finally(() => window.location.assign(signOutHref));

  const exportSnapshot = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const authorized = await customerDashboardMutation<DashboardSnapshot>("export_snapshot", {
        organizationId,
        branchId: snapshot.selectedBranchId,
        period: snapshot.filters.period,
      });
      downloadDashboardSnapshot(authorized);
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : "No fue posible exportar este tablero.");
    } finally {
      setExporting(false);
    }
  };

  return <main className="min-h-screen bg-[#edf4f7] text-[#102b48]">
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[272px_1fr]">
      <aside className="hidden border-r border-white/10 bg-[#092b47] text-white lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-5"><BrandMark compact /><p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6ce0d9]">Espacio operativo</p><p className="mt-2 truncate text-lg font-black" title={snapshot.organization.name}>{snapshot.organization.name}</p><p className="mt-1 truncate text-xs text-[#a9bfce]">{selectedBranch?.name ?? "Todas las sucursales"}</p></div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Operación">
          <SideLink href="#inicio" label="Inicio" icon={LayoutDashboard} active />
          {snapshot.capabilities.crossBranch && <SideLink href={`/app/sucursales?organizationId=${encodeURIComponent(organizationId)}`} label="Sucursales" icon={Building2} />}
          <SideLink href="#atencion" label="Centro de atención" icon={TriangleAlert} />
          <SideLink href="#indicadores" label="Indicadores" icon={Gauge} />
          {qualityAvailable && <SideLink href={`/app/calidad?${baseQuery}`} label="Calidad" icon={ClipboardCheck} />}
          {snapshot.capabilities.configureSelf && <SideLink href={`/app/configuracion/dashboard?organizationId=${encodeURIComponent(organizationId)}`} label="Personalizar tablero" icon={SlidersHorizontal} />}
          {!snapshot.freshness.offlineSnapshot && <SideLink href={`/app/onboarding?organizationId=${encodeURIComponent(organizationId)}`} label="Configuración" icon={Settings2} />}
        </nav>
        <div id="account" className="border-t border-white/10 p-4"><p className="truncate text-sm font-bold">{identityLabel}</p><p className="mt-1 truncate text-xs text-[#a8bfce]">{snapshot.membership.roleNames.join(", ") || "Acceso operativo"}</p><Button variant="ghost" className="mt-3 min-h-11 w-full justify-start rounded-xl text-[#dbe8ef] hover:bg-white/10 hover:text-white" onClick={signOut}><LogOut className="size-4" />Cerrar sesión</Button></div>
      </aside>

      <section className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-[#d4e3ea] bg-white/95 backdrop-blur">
          <div className="flex min-h-18 items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-9">
            <div className="flex min-w-0 items-center gap-3 lg:hidden"><BrandMark compact /><div className="min-w-0"><p className="truncate text-sm font-black">{snapshot.organization.name}</p><p className="truncate text-xs text-[#6b8194]">{selectedBranch?.name ?? "Vista general"}</p></div></div>
            <div className="hidden min-w-0 lg:block"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#168b95]">{snapshot.preset.name}</p><p className="mt-1 capitalize text-sm font-semibold text-[#5c7388]">{date}</p></div>
            <div className="flex items-center gap-2">
              {snapshot.availableOrganizations.length > 1 && <select className="hidden h-11 max-w-64 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm font-bold text-[#29475f] disabled:opacity-60 sm:block" value={organizationId} disabled={snapshot.freshness.offlineSnapshot} onChange={(event) => navigateWith({ organizationId: event.target.value })} aria-label="Cambiar organización">{snapshot.availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>}
              {snapshot.branches.length > 1 && <select className="h-11 max-w-44 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm font-bold text-[#29475f] disabled:opacity-60" value={snapshot.selectedBranchId ?? "all"} disabled={snapshot.freshness.offlineSnapshot} onChange={(event) => navigateWith({ branchId: event.target.value === "all" ? null : event.target.value })} aria-label="Cambiar sucursal">{snapshot.capabilities.crossBranch && <option value="all">Todas</option>}{snapshot.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}
              {refresh && <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label="Actualizar datos" disabled={refreshing} onClick={refresh}><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /></Button>}
              <Button variant="ghost" size="icon" className="hidden size-11 rounded-xl sm:inline-flex" aria-label="Pendientes" asChild><a href="#atencion"><Bell className="size-4" /></a></Button>
            </div>
          </div>
        </header>

        <div id="inicio" className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 xl:p-9">
          {restricted && <div className="flex gap-3 rounded-2xl border border-[#efc6b8] bg-[#fff7f3] p-4 text-sm text-[#8d422b]"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><div><strong>Operación restringida</strong><p className="mt-1 text-[#9a5c49]">Puedes consultar este tablero, pero las mutaciones permanecen bloqueadas según la política de la organización.</p></div></div>}
          {snapshot.freshness.offlineSnapshot && <div role="status" className="flex gap-3 rounded-2xl border border-[#b8d6e8] bg-[#edf7fd] p-4 text-sm text-[#255f82]"><Cloud className="mt-0.5 size-5 shrink-0" /><div><strong>Última información disponible · solo lectura</strong><p className="mt-1 text-[#4f7690]">Esta copia fue autorizada {new Date(snapshot.freshness.generatedAt).toLocaleString("es-MX")} y puede estar desactualizada. Reconecta para revalidar sesión, membresía, permisos y alcance.</p></div></div>}

          <section className="relative overflow-hidden rounded-[2rem] bg-[#0b2e4b] p-5 text-white shadow-[0_24px_65px_rgba(14,47,76,.17)] sm:p-8">
            <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-[#1bc9c2]/20 blur-3xl" />
            <div className="relative grid gap-7 xl:grid-cols-[1fr_1.05fr] xl:items-end">
              <div><div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#9ed2d4]"><span className="rounded-full bg-white/10 px-3 py-1">{snapshot.organization.code}</span><span className="flex items-center gap-1"><MapPin className="size-3.5" />{selectedBranch?.name ?? `${snapshot.branches.length} sucursales autorizadas`}</span><span className="flex items-center gap-1"><Sparkles className="size-3.5" />{snapshot.preset.audience}</span></div><h1 className="mt-5 max-w-xl text-3xl font-black leading-tight tracking-[-0.045em] sm:text-4xl">Lo importante de tu operación, según tu responsabilidad.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8ccd8]">{snapshot.preset.description} {snapshot.presetReason}</p><div className="mt-5 flex flex-wrap gap-2"><Button asChild className="min-h-11 rounded-xl bg-[#28c9c2] font-extrabold text-[#082f47] hover:bg-[#54d9d3]"><a href="#atencion"><TriangleAlert className="size-4" />Revisar pendientes</a></Button>{qualityAvailable && !snapshot.freshness.offlineSnapshot && <Button asChild variant="outline" className="min-h-11 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href={`/app/calidad?${baseQuery}`}><ClipboardCheck className="size-4" />Abrir Calidad</Link></Button>}{snapshot.capabilities.configureSelf && <Button asChild variant="outline" className="min-h-11 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href={`/app/configuracion/dashboard?organizationId=${encodeURIComponent(organizationId)}`}><SlidersHorizontal className="size-4" />Personalizar</Link></Button>}</div></div>
              <AttentionPanel snapshot={snapshot} />
            </div>
          </section>

          {exportError && <div role="alert" className="rounded-2xl border border-[#efc6b8] bg-[#fff7f3] p-4 text-sm text-[#8d422b]">{exportError}</div>}

          <section id="indicadores" aria-labelledby="indicator-title">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#168b95]">Información autorizada</p><h2 id="indicator-title" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#12324e]">{snapshot.preset.name}</h2></div><div className="flex flex-wrap items-center gap-2"><select className="min-h-11 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm font-bold text-[#29475f] disabled:opacity-60" value={snapshot.filters.period} disabled={snapshot.freshness.offlineSnapshot} onChange={(event) => navigateWith({ period: event.target.value as DashboardPeriod })} aria-label="Periodo del tablero">{Object.entries(PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{snapshot.capabilities.export && <Button variant="outline" className="min-h-11 rounded-xl bg-white" disabled={exporting} onClick={() => void exportSnapshot()}>{exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Exportar CSV</Button>}</div></div>
            {snapshot.widgets.length ? <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{snapshot.widgets.map((widget) => <WidgetCard key={widget.code} widget={widget} organizationId={organizationId} baseQuery={baseQuery} />)}</div> : <EmptyPanel title="No hay widgets disponibles" detail="El preset no contiene widgets compatibles con tus módulos, permisos y alcance actuales." />}
          </section>

          {!snapshot.freshness.offlineSnapshot && snapshot.capabilities.crossBranch && snapshot.branchSummaries.length > 1 && <BranchPulse snapshot={snapshot} />}

          {snapshot.freshness.unavailableSourceCount > 0 && <section className="rounded-[1.4rem] border border-[#d6e4eb] bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3f7] text-[#587187]"><Cloud className="size-5" /></div><div><h2 className="font-black text-[#183a57]">Fuentes todavía no productivas</h2><p className="mt-1 text-sm leading-6 text-[#6b8093]">{snapshot.freshness.unavailableSourceCount} indicador(es) de este preset muestran “No disponible” porque sus eventos aún pertenecen al proveedor heredado. KitchenMind no los sustituye con ceros ni datos ficticios.</p></div></div></section>}

          <p className="pb-3 text-center text-xs text-[#718699]">Generado {new Date(snapshot.freshness.generatedAt).toLocaleString("es-MX")} · {snapshot.freshness.mode === "offline_snapshot" ? "snapshot offline de solo lectura" : snapshot.freshness.mode === "server_cache" ? "caché segura de servidor" : "consulta durable"} · zona {snapshot.filters.timezone}</p>
        </div>
      </section>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#d2e0e8] bg-white/96 px-1 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(20,50,76,.09)] backdrop-blur lg:hidden" aria-label="Navegación móvil"><MobileLink href="#inicio" icon={LayoutDashboard} label="Inicio" /><MobileLink href="#atencion" icon={TriangleAlert} label="Pendientes" /><MobileLink href={snapshot.freshness.offlineSnapshot ? "#inicio" : qualityAvailable ? `/app/calidad?${baseQuery}` : `/app/onboarding?organizationId=${encodeURIComponent(organizationId)}`} icon={qualityAvailable ? ClipboardCheck : CheckCircle2} label={snapshot.freshness.offlineSnapshot ? "Lectura" : qualityAvailable ? "Calidad" : "Acción"} primary /><MobileLink href="#indicadores" icon={Gauge} label="Métricas" /><MobileLink href={snapshot.capabilities.configureSelf ? `/app/configuracion/dashboard?organizationId=${encodeURIComponent(organizationId)}` : "#account"} icon={Menu} label="Cuenta" /></nav>
  </main>;
}

function AttentionPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return <div id="atencion" className="rounded-2xl border border-white/10 bg-white/[.075] p-4 backdrop-blur"><div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">Centro de atención</p><p className="mt-1 text-xs text-[#a9c0cd]">Ordenado por impacto comprobable</p></div><span className="rounded-full bg-[#1dc4be] px-2.5 py-1 text-xs font-black text-[#08314a]">{snapshot.attention.length}</span></div><div className="mt-3 space-y-2">{snapshot.attention.length ? snapshot.attention.slice(0, 4).map((item) => <Link key={item.id} href={item.href} className="group flex items-center gap-3 rounded-xl bg-white/[.07] p-3 transition hover:bg-white/[.12]"><span className={`size-2.5 shrink-0 rounded-full ${item.severity === "critical" ? "bg-[#ff8a6d]" : item.severity === "warning" ? "bg-[#ffd166]" : "bg-[#71d9d4]"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#e7f0f5]">{item.title}</span><span className="mt-0.5 block text-xs text-[#a9c0cd]">{item.detail}</span></span><ArrowRight className="size-4 text-[#8eacbd] transition group-hover:translate-x-0.5" /></Link>) : <div className="flex items-center gap-3 rounded-xl bg-white/[.07] p-3 text-sm text-[#dce9ef]"><CheckCircle2 className="size-5 text-[#69ded8]" />No hay pendientes calculables con las fuentes disponibles.</div>}</div></div>;
}

function WidgetCard({ widget, organizationId, baseQuery }: { widget: DashboardResolvedWidget; organizationId: string; baseQuery: string }) {
  const Icon = ICONS[widget.code] ?? Gauge;
  const span = widget.size === "full" ? "sm:col-span-2 xl:col-span-4" : widget.size === "large" ? "sm:col-span-2 xl:col-span-3" : widget.size === "medium" ? "xl:col-span-2" : "";
  const card = <article className={`h-full rounded-[1.4rem] border bg-white p-5 shadow-[0_12px_32px_rgba(21,54,81,.045)] ${widget.valueStatus === "unavailable" ? "border-dashed border-[#c8d6dd]" : "border-[#d5e4eb]"}`}>
    <div className="flex items-start justify-between gap-4"><div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${widget.valueStatus === "unavailable" ? "bg-[#f0f3f5] text-[#718394]" : "bg-[#e8f4f5] text-[#148a93]"}`}><Icon className="size-5" /></div><div className="text-right"><span className={`block text-3xl font-black tracking-[-0.05em] ${widget.valueStatus === "unavailable" ? "text-base text-[#6f8292]" : "text-[#143653]"}`}>{widget.valueLabel}</span>{widget.valueStatus === "unavailable" && <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-[#8798a5]">Fuente pendiente</span>}</div></div>
    <h3 className="mt-5 text-sm font-extrabold text-[#29465f]">{widget.name}</h3>
    <p className="mt-1 text-xs leading-5 text-[#718699]">{widget.detail}</p>
    <p className="mt-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#8a9aa6]">{widget.updatedAt ? `Actualizado ${new Date(widget.updatedAt).toLocaleString("es-MX")}` : "Sin actualización productiva"}</p>
    {widget.href && <span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-[#1769df]">Abrir detalle <ArrowRight className="size-3.5" /></span>}
  </article>;
  const href = widget.href ? `${widget.href}${widget.href.includes("?") ? "&" : "?"}${widget.href.startsWith("/app/onboarding") ? `organizationId=${encodeURIComponent(organizationId)}` : baseQuery}` : null;
  return <div className={span}>{href ? <Link href={href} className="block h-full transition hover:-translate-y-0.5">{card}</Link> : card}</div>;
}

function BranchPulse({ snapshot }: { snapshot: DashboardSnapshot }) {
  return <section aria-labelledby="branch-title"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#168b95]">Vista multisucursal</p><h2 id="branch-title" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#12324e]">Pulso por unidad</h2></div><Button asChild variant="outline" className="rounded-xl"><Link href={`/app/sucursales?organizationId=${encodeURIComponent(snapshot.organization.id)}`}>Ver todas <ArrowRight className="size-4" /></Link></Button></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{snapshot.branchSummaries.slice(0, 6).map((branch) => <Link key={branch.id} href={`/app/sucursales/${branch.id}?organizationId=${encodeURIComponent(snapshot.organization.id)}`} className="rounded-[1.4rem] border border-[#d5e4eb] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#8ac9cc] hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#183a57]">{branch.name}</p><p className="mt-1 text-xs text-[#718699]">{branch.code} · {branch.timezone}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${branch.pendingSetup ? "bg-[#fff2d9] text-[#8b5d12]" : "bg-[#e5f8f1] text-[#11745f]"}`}>{branch.pendingSetup ? `${branch.pendingSetup} pendientes` : "Preparada"}</span></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><SmallMetric label="Personal" value={branch.employees} /><SmallMetric label="Fuentes" value={branch.configuredSources} /><SmallMetric label="Movimientos" value={branch.inventoryMovements} /></div></Link>)}</div></section>;
}

function SmallMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#f2f7fa] p-2"><strong className="block text-lg text-[#183a57]">{value}</strong><span className="text-[10px] text-[#718699]">{label}</span></div>; }
function EmptyPanel({ title, detail }: { title: string; detail: string }) { return <div className="mt-4 rounded-[1.4rem] border border-dashed border-[#bcd0da] bg-white/70 p-8 text-center"><Gauge className="mx-auto size-7 text-[#3c9ca2]" /><p className="mt-3 font-black text-[#183a57]">{title}</p><p className="mt-2 text-sm text-[#6a8093]">{detail}</p></div>; }
function SideLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: typeof LayoutDashboard; active?: boolean }) { return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-[#1dc4be] text-[#082c43]" : "text-[#c0d1dc] hover:bg-white/10 hover:text-white"}`}><Icon className="size-4" />{label}</Link>; }
function MobileLink({ href, icon: Icon, label, primary = false }: { href: string; icon: typeof LayoutDashboard; label: string; primary?: boolean }) { return <Link href={href} className={`flex min-w-0 flex-col items-center gap-1 text-[10px] font-bold ${primary ? "text-[#0b706e]" : "text-[#5c7488]"}`}><span className={`flex size-9 items-center justify-center rounded-xl ${primary ? "-mt-5 size-12 bg-[#1dc4be] text-[#08314a] shadow-lg" : ""}`}><Icon className="size-5" /></span><span className="truncate">{label}</span></Link>; }
function FullState({ loading = false, title, detail }: { loading?: boolean; title: string; detail: string }) { return <main className="flex min-h-screen items-center justify-center bg-[#edf4f7] p-5"><div className="w-full max-w-md rounded-[1.8rem] border border-[#d2e2e9] bg-white p-8 text-center shadow-[0_25px_70px_rgba(22,55,84,.1)]"><BrandMark /><div className="mx-auto mt-8 flex size-12 items-center justify-center rounded-2xl bg-[#e8f3ff] text-[#1769df]">{loading ? <Loader2 className="size-6 animate-spin" /> : <AlertTriangle className="size-6" />}</div><h1 className="mt-5 text-2xl font-black text-[#143653]">{title}</h1><p className="mt-2 text-sm leading-6 text-[#6b8093]">{detail}</p><Button asChild variant="outline" className="mt-6 rounded-xl"><Link href="/">Volver al acceso</Link></Button></div></main>; }

function downloadDashboardSnapshot(snapshot: DashboardSnapshot): void {
  const branch = snapshot.branches.find((item) => item.id === snapshot.selectedBranchId)?.name ?? "Todas las sucursales autorizadas";
  const rows = [
    ["Organización", snapshot.organization.name],
    ["Sucursal", branch],
    ["Periodo", PERIOD_LABELS[snapshot.filters.period]],
    ["Preset", snapshot.preset.name],
    ["Generado", snapshot.freshness.generatedAt],
    [],
    ["Indicador", "Valor", "Estado", "Detalle", "Actualizado"],
    ...snapshot.widgets.map((widget) => [widget.name, widget.valueLabel, widget.valueStatus, widget.detail, widget.updatedAt ?? "Sin fuente productiva"]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kitchenmind-${snapshot.organization.code.toLowerCase()}-${snapshot.filters.period}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
