"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { platformDashboardMutation, useDashboardQuery } from "@/hooks/use-dashboard";
import type { DashboardWidgetSize, PlatformDashboardCatalogSnapshot } from "@/types";

export function DashboardCatalogScreen({ organizationId }: { organizationId?: string }) {
  const params = new URLSearchParams();
  if (organizationId) params.set("organizationId", organizationId);
  const query = useDashboardQuery<PlatformDashboardCatalogSnapshot>(params.toString(), "platform");
  const [reason, setReason] = useState("");
  const [presetCode, setPresetCode] = useState("");
  const [widgetCode, setWidgetCode] = useState("");
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [widgetSize, setWidgetSize] = useState<DashboardWidgetSize>("medium");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (query.loading && !query.data) {
    return <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-[#6b8093]"><Loader2 className="size-5 animate-spin" />Consultando catálogo de tableros…</div>;
  }
  if (query.error || !query.data) {
    return <div className="rounded-2xl border border-[#efc6b8] bg-[#fff7f3] p-8 text-center text-[#8d422b]"><AlertTriangle className="mx-auto size-6" /><p className="mt-3 font-black">No fue posible abrir el catálogo</p><p className="mt-2 text-sm">{query.error}</p></div>;
  }

  const snapshot = query.data;
  const canManage = snapshot.capabilities.manage;
  const chosenPreset = presetCode || snapshot.selectedOrganization?.presetCode || snapshot.presets[0]?.code || "";
  const chosenWidget = widgetCode || snapshot.widgets[0]?.code || "";
  const chosenWidgetDefinition = snapshot.widgets.find((widget) => widget.code === chosenWidget);
  const chosenWidgetSizes = chosenWidgetDefinition?.supportedSizes ?? ["small", "medium", "large", "full"];

  const mutate = async (action: string, data: unknown, success: string) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await platformDashboardMutation(action, data);
      setMessage(success);
      setReason("");
      await query.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar el cambio.");
    } finally {
      setSaving(false);
    }
  };

  const overrideData = (targetType: "preset" | "widget") => ({
    organizationId: snapshot.selectedOrganization?.id,
    targetType,
    targetCode: targetType === "preset" ? chosenPreset : chosenWidget,
    ...(targetType === "widget" ? { enabled: widgetEnabled, size: widgetSize } : {}),
    ...(effectiveUntil ? { effectiveUntil: new Date(`${effectiveUntil}T23:59:59.000Z`).toISOString() } : {}),
    reason,
  });

  return <div className="space-y-7">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-bold text-[#168ca0]">SPRINT D · RESOLUCIÓN DINÁMICA</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Catálogo de tableros</h1>
        <p className="mt-2 max-w-3xl text-[#667d92]">Inspecciona widgets, fuentes, presets y overrides. Un widget sin fuente productiva permanece visible como no disponible y nunca recibe datos inventados.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!canManage && <Badge variant="outline" className="h-9 rounded-xl px-3 text-[#60778a]">Solo lectura</Badge>}
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => void query.refresh()}><RefreshCw className={`size-4 ${query.loading ? "animate-spin" : ""}`} />Actualizar</Button>
      </div>
    </header>

    {(message || error) && <div role="status" className={`rounded-2xl border p-4 text-sm ${error ? "border-[#efc6b8] bg-[#fff7f3] text-[#8d422b]" : "border-[#bde4d7] bg-[#effaf6] text-[#116a58]"}`}>{error ?? message}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Gauge} label="Widgets" value={snapshot.widgets.length} />
      <Metric icon={Settings2} label="Presets" value={snapshot.presets.length} />
      <Metric icon={Database} label="Fuentes productivas" value={snapshot.widgets.filter((widget) => widget.sourceStatus === "available").length} />
      <Metric icon={AlertTriangle} label="Fuentes pendientes" value={snapshot.widgets.filter((widget) => widget.sourceStatus !== "available").length} />
    </div>

    <section>
      <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#168b95]">Gobierno global</p><h2 className="mt-1 text-2xl font-black text-[#183a57]">Widgets y fuentes</h2></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.widgets.map((widget) => <article key={widget.code} className={`rounded-[1.4rem] border bg-white p-5 ${widget.sourceStatus === "available" ? "border-[#d5e4eb]" : "border-dashed border-[#c7d5dc]"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className={`flex size-10 items-center justify-center rounded-xl ${widget.sourceStatus === "available" ? "bg-[#e7f7f4] text-[#14745f]" : "bg-[#f0f3f5] text-[#718394]"}`}>{widget.sourceStatus === "available" ? <Database className="size-5" /> : <AlertTriangle className="size-5" />}</div>
            <div className="flex gap-2"><Badge className={widget.status === "active" ? "bg-[#e5f8f1] text-[#11745f]" : "bg-[#eef1f3] text-[#657786]"}>{widget.status}</Badge><Badge variant="outline">v{widget.version}</Badge></div>
          </div>
          <h3 className="mt-4 font-black text-[#29465f]">{widget.name}</h3>
          <p className="mt-1 text-xs text-[#718699]">{widget.code} · {widget.category}</p>
          <p className="mt-3 min-h-12 text-sm leading-6 text-[#667d92]">{widget.sourceStatus === "available" ? widget.description : widget.availabilityReason}</p>
          <div className="mt-4 flex min-h-7 items-center justify-between border-t border-[#e2eaee] pt-4"><span className="text-xs font-bold text-[#718699]">Activo globalmente</span>{canManage ? <Switch checked={widget.status === "active"} disabled={saving || reason.trim().length < 5} onCheckedChange={(active) => void mutate("set_widget_status", { code: widget.code, active, version: widget.version, reason }, `El widget ${widget.name} quedó ${active ? "activo" : "inactivo"}.`)} aria-label={`Cambiar estado de ${widget.name}`} /> : <span className="text-xs font-extrabold text-[#50687b]">{widget.status === "active" ? "Sí" : "No"}</span>}</div>
        </article>)}
      </div>
    </section>

    {canManage && <section className="rounded-[1.5rem] border border-[#d5e4eb] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-1 size-5 text-[#1769df]" /><div><h2 className="text-xl font-black text-[#183a57]">Motivo de administración</h2><p className="mt-1 text-sm text-[#667d92]">Se exige para cualquier cambio global u override y se guarda en auditoría.</p></div></div>
      <textarea className="mt-4 min-h-24 w-full rounded-xl border border-[#ccdbe4] p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe por qué se necesita el cambio y quién lo autorizó." />
    </section>}

    <section className="rounded-[1.5rem] border border-[#d5e4eb] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3"><Building2 className="mt-1 size-5 text-[#168b95]" /><div><h2 className="text-xl font-black text-[#183a57]">Override por organización</h2><p className="mt-1 text-sm text-[#667d92]">El contrato, los permisos y las fuentes disponibles siguen prevaleciendo.</p></div></div>
      <label className="mt-5 block text-sm font-extrabold text-[#29465f]">Organización
        <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={snapshot.selectedOrganization?.id ?? ""} onChange={(event) => window.location.assign(event.target.value ? `/platform/catalogo/dashboard?organizationId=${encodeURIComponent(event.target.value)}` : "/platform/catalogo/dashboard")}>
          <option value="">Selecciona una organización</option>
          {snapshot.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.status}</option>)}
        </select>
      </label>

      {snapshot.selectedOrganization && <>
        <div className="mt-4 rounded-2xl border border-[#cfe3e8] bg-[#f1f8f9] p-4">
          <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#168b95]">Resolución organizacional actual</p>
          <p className="mt-2 text-lg font-black text-[#183a57]">{snapshot.selectedOrganization.presetName}</p>
          <p className="mt-1 text-sm leading-6 text-[#667d92]">{snapshot.selectedOrganization.presetReason}</p>
        </div>
        {canManage && <><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-extrabold text-[#29465f]">Preset predeterminado
            <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={chosenPreset} onChange={(event) => setPresetCode(event.target.value)}>{snapshot.presets.map((preset) => <option key={preset.code} value={preset.code}>{preset.name}</option>)}</select>
          </label>
          <label className="text-sm font-extrabold text-[#29465f]">Vigencia opcional<input className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex justify-end"><Button className="rounded-xl" disabled={saving || reason.trim().length < 5} onClick={() => void mutate("save_organization_override", overrideData("preset"), "El preset de la organización quedó guardado y auditado.")}><Save className="size-4" />Asignar preset</Button></div>
        <div className="my-6 border-t border-[#e0e9ee]" />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-extrabold text-[#29465f]">Widget<select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={chosenWidget} onChange={(event) => { const widget = snapshot.widgets.find((item) => item.code === event.target.value); setWidgetCode(event.target.value); setWidgetSize(widget?.defaultSize ?? widget?.supportedSizes[0] ?? "medium"); }}>{snapshot.widgets.map((widget) => <option key={widget.code} value={widget.code}>{widget.name}</option>)}</select></label>
          <label className="text-sm font-extrabold text-[#29465f]">Tamaño permitido<select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={chosenWidgetSizes.includes(widgetSize) ? widgetSize : chosenWidgetDefinition?.defaultSize ?? chosenWidgetSizes[0]} onChange={(event) => setWidgetSize(event.target.value as DashboardWidgetSize)}>{chosenWidgetSizes.map((size) => <option key={size} value={size}>{size === "small" ? "Pequeño" : size === "medium" ? "Mediano" : size === "large" ? "Grande" : "Completo"}</option>)}</select></label>
          <label className="flex min-h-11 items-center justify-between self-end rounded-xl border border-[#ccdbe4] px-3 text-sm font-extrabold text-[#29465f]">Visible<Switch checked={widgetEnabled} onCheckedChange={setWidgetEnabled} /></label>
        </div>
        <div className="mt-4 flex justify-end"><Button className="rounded-xl" disabled={saving || reason.trim().length < 5} onClick={() => void mutate("save_organization_override", overrideData("widget"), "El override del widget quedó guardado y auditado.")}><Save className="size-4" />Guardar override</Button></div>
        </>}
        {snapshot.selectedOrganization.overrides.length > 0 && <div className="mt-6"><h3 className="font-black text-[#29465f]">Historial reciente</h3><div className="mt-3 space-y-2">{snapshot.selectedOrganization.overrides.slice(0, 8).map((override) => <div key={override.id} className="flex flex-col justify-between gap-2 rounded-xl bg-[#f4f8fa] p-3 text-sm sm:flex-row"><span><strong>{override.targetType}</strong> · {override.targetCode} · {override.status}</span><span className="text-xs text-[#718699]">{override.reason}</span></div>)}</div></div>}
      </>}
    </section>

    <section><h2 className="text-2xl font-black text-[#183a57]">Presets activos</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{snapshot.presets.map((preset) => <article key={preset.code} className="rounded-[1.35rem] border border-[#d5e4eb] bg-white p-5"><div className="flex items-center justify-between"><CheckCircle2 className="size-5 text-[#1b9c78]" /><Badge variant="outline">{preset.widgets.length} widgets</Badge></div><h3 className="mt-4 font-black text-[#29465f]">{preset.name}</h3><p className="mt-1 text-xs font-bold text-[#168b95]">{preset.audience}</p><p className="mt-3 text-sm leading-6 text-[#667d92]">{preset.description}</p></article>)}</div></section>
    <div className="flex justify-end"><Button asChild variant="outline" className="rounded-xl"><Link href="/platform/catalogo"><Boxes className="size-4" />Volver al catálogo comercial</Link></Button></div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: number }) {
  return <article className="rounded-[1.3rem] border border-[#d5e4eb] bg-white p-5"><div className="flex items-start justify-between"><div className="flex size-10 items-center justify-center rounded-xl bg-[#e8f4f5] text-[#148a93]"><Icon className="size-5" /></div><strong className="text-3xl font-black text-[#143653]">{value}</strong></div><p className="mt-4 text-sm font-black text-[#29465f]">{label}</p></article>;
}
