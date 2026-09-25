"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Loader2, RotateCcw, Save, Settings2, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { customerDashboardMutation, useDashboardQuery } from "@/hooks/use-dashboard";
import type { DashboardPeriod, DashboardSnapshot, DashboardWidgetSize } from "@/types";

type LayoutItem = {
  code: string;
  visible: boolean;
  size: DashboardWidgetSize;
  position: number;
  name: string;
  supportedSizes: DashboardWidgetSize[];
};

const ALL_SIZES: DashboardWidgetSize[] = ["small", "medium", "large", "full"];
const SIZE_LABELS: Record<DashboardWidgetSize, string> = { small: "Pequeño", medium: "Mediano", large: "Grande", full: "Completo" };
const PERIOD_LABELS: Record<DashboardPeriod, string> = { today: "Hoy", last_7_days: "Últimos 7 días", last_30_days: "Últimos 30 días" };

export function DashboardConfigurationScreen({ organizationId }: { organizationId?: string }) {
  const params = new URLSearchParams({ period: "today" });
  if (organizationId) params.set("organizationId", organizationId);
  const query = useDashboardQuery<DashboardSnapshot>(params.toString());
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [presetCode, setPresetCode] = useState("");
  const [defaultPeriod, setDefaultPeriod] = useState<DashboardPeriod>("today");
  const [defaultBranchId, setDefaultBranchId] = useState("all");
  const [organizationPresetCode, setOrganizationPresetCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [overrideWidget, setOverrideWidget] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideSize, setOverrideSize] = useState<DashboardWidgetSize>("medium");
  const [effectiveUntil, setEffectiveUntil] = useState("");

  const widgetCatalog = useMemo(() => new Map((query.data?.widgets ?? []).map((widget) => [widget.code, widget])), [query.data]);
  useEffect(() => {
    if (!query.data) return;
    const dashboard = query.data;
    const source = dashboard.preference.layout.length
      ? dashboard.preference.layout
      : dashboard.widgets.map((widget, index) => ({ code: widget.code, visible: true, size: widget.size, position: index }));
    const timer = window.setTimeout(() => {
      setLayout(source.map((item) => {
        const widget = widgetCatalog.get(item.code);
        const supportedSizes = widget?.supportedSizes ?? ALL_SIZES;
        const size = supportedSizes.includes(item.size) ? item.size : widget?.defaultSize ?? supportedSizes[0] ?? "medium";
        return { ...item, size, name: widget?.name ?? item.code.replaceAll("_", " "), supportedSizes };
      }).sort((a, b) => a.position - b.position));
      setPresetCode(dashboard.preset.code);
      setDefaultPeriod(dashboard.preference.defaultFilters.period);
      setDefaultBranchId(dashboard.preference.defaultFilters.branchId ?? "all");
      setOrganizationPresetCode(dashboard.preset.code);
      setOverrideWidget(dashboard.widgets[0]?.code ?? "");
      setOverrideSize(dashboard.widgets[0]?.defaultSize ?? "medium");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [query.data, widgetCatalog]);

  if (query.loading && !query.data) return <ConfigState title="Preparando configuración" loading />;
  if (query.error || !query.data) return <ConfigState title={query.error ?? "No pudimos abrir la configuración."} />;
  const snapshot = query.data;
  if (!snapshot.capabilities.configureSelf) return <ConfigState title="No tienes permiso para personalizar este tablero." />;

  const overrideDefinition = snapshot.widgets.find((widget) => widget.code === overrideWidget);
  const overrideSizes = overrideDefinition?.supportedSizes ?? ALL_SIZES;

  const move = (index: number, direction: -1 | 1) => setLayout((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next.map((item, position) => ({ ...item, position }));
  });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await customerDashboardMutation("save_preference", {
        organizationId: snapshot.organization.id,
        presetCode,
        version: snapshot.preference.version,
        layout: layout.map(({ code, visible, size, position }) => ({ code, visible, size, position })),
        defaultFilters: { period: defaultPeriod, branchId: defaultBranchId === "all" ? null : defaultBranchId },
      });
      setMessage("Tu tablero quedó guardado en el servidor.");
      await query.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar el tablero.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await customerDashboardMutation("reset_preference", { organizationId: snapshot.organization.id });
      setMessage("Restablecimos la vista asignada por rol y organización.");
      await query.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible restablecer el tablero.");
    } finally {
      setSaving(false);
    }
  };

  const saveOverride = async (targetType: "preset" | "widget") => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await customerDashboardMutation("save_organization_override", {
        organizationId: snapshot.organization.id,
        targetType,
        targetCode: targetType === "preset" ? organizationPresetCode : overrideWidget,
        ...(targetType === "widget" ? { enabled: overrideEnabled, size: overrideSize } : {}),
        ...(effectiveUntil ? { effectiveUntil: new Date(`${effectiveUntil}T23:59:59.000Z`).toISOString() } : {}),
        reason,
      });
      setMessage(targetType === "preset" ? "El preset de la organización quedó guardado y auditado." : "La regla del widget quedó guardada y auditada.");
      setReason("");
      await query.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar la configuración de la organización.");
    } finally {
      setSaving(false);
    }
  };

  const chooseOverrideWidget = (code: string) => {
    const widget = snapshot.widgets.find((item) => item.code === code);
    setOverrideWidget(code);
    setOverrideSize(widget?.defaultSize ?? widget?.supportedSizes[0] ?? "medium");
  };

  return (
    <main className="min-h-screen bg-[#edf4f7] p-4 text-[#102b48] sm:p-7">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-[1.6rem] border border-[#d5e4eb] bg-white p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <BrandMark compact />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#168b95]">{snapshot.organization.name}</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-.04em]">Configurar tablero</h1>
            </div>
          </div>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href={`/app?organizationId=${encodeURIComponent(snapshot.organization.id)}`}><ArrowLeft className="size-4" />Volver al tablero</Link>
          </Button>
        </header>

        {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${error ? "border-[#efc6b8] bg-[#fff7f3] text-[#8d422b]" : "border-[#bde4d7] bg-[#effaf6] text-[#116a58]"}`}>{error ?? message}</div>}

        <section className="rounded-[1.5rem] border border-[#d5e4eb] bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-1 size-5 text-[#168b95]" />
            <div>
              <h2 className="text-xl font-black">Mi vista</h2>
              <p className="mt-1 text-sm leading-6 text-[#6b8093]">Elige un preset permitido y ajusta orden, tamaño y visibilidad. Los permisos y módulos siempre prevalecen.</p>
            </div>
          </div>
          <label className="mt-6 block text-sm font-extrabold text-[#29465f]">
            Preset personal
            <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={presetCode} onChange={(event) => setPresetCode(event.target.value)}>
              {snapshot.preference.availablePresets.map((preset) => <option key={preset.code} value={preset.code}>{preset.name} · {preset.audience}</option>)}
            </select>
          </label>
          <div className="mt-4 grid gap-4 rounded-2xl border border-[#dce7ec] bg-[#f8fbfc] p-4 sm:grid-cols-2">
            <label className="text-sm font-extrabold text-[#29465f]">
              Periodo al abrir
              <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={defaultPeriod} onChange={(event) => setDefaultPeriod(event.target.value as DashboardPeriod)}>
                {Object.entries(PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-extrabold text-[#29465f]">
              Sucursal al abrir
              <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={defaultBranchId} onChange={(event) => setDefaultBranchId(event.target.value)}>
                {snapshot.capabilities.crossBranch && <option value="all">Todas las autorizadas</option>}
                {snapshot.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-5 space-y-3">
            {layout.map((item, index) => (
              <div key={item.code} className="grid gap-3 rounded-2xl border border-[#dce7ec] bg-[#f8fbfc] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div><p className="font-black capitalize text-[#29465f]">{item.name}</p><p className="mt-1 text-xs text-[#718699]">{item.code}</p></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#718699]">Visible</span>
                  <Switch checked={item.visible} onCheckedChange={(checked) => setLayout((current) => current.map((value) => value.code === item.code ? { ...value, visible: checked } : value))} aria-label={`Mostrar ${item.name}`} />
                  <select className="h-11 rounded-xl border border-[#ccdbe4] bg-white px-2 text-xs font-bold" value={item.size} onChange={(event) => setLayout((current) => current.map((value) => value.code === item.code ? { ...value, size: event.target.value as DashboardWidgetSize } : value))} aria-label={`Tamaño de ${item.name}`}>
                    {item.supportedSizes.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
                  </select>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="size-11 rounded-xl" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${item.name}`}><ArrowUp className="size-4" /></Button>
                  <Button variant="outline" size="icon" className="size-11 rounded-xl" disabled={index === layout.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar ${item.name}`}><ArrowDown className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 rounded-xl" disabled={saving} onClick={() => void reset()}><RotateCcw className="size-4" />Restablecer</Button>
            <Button className="min-h-11 rounded-xl" disabled={saving || !presetCode} onClick={() => void save()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar mi vista</Button>
          </div>
        </section>

        {snapshot.capabilities.configureOrganization && (
          <section className="rounded-[1.5rem] border border-[#d5e4eb] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-1 size-5 text-[#1769df]" />
              <div>
                <h2 className="text-xl font-black">Predeterminado de la organización</h2>
                <p className="mt-1 text-sm leading-6 text-[#6b8093]">El preset organizacional, los cambios de widgets y su vigencia se guardan por separado de tu vista personal.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#dce7ec] bg-[#f8fbfc] p-4">
              <h3 className="font-black text-[#29465f]">Preset recomendado</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-extrabold text-[#29465f]">
                  Preset predeterminado
                  <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={organizationPresetCode} onChange={(event) => setOrganizationPresetCode(event.target.value)}>
                    {snapshot.preference.availablePresets.map((preset) => <option key={preset.code} value={preset.code}>{preset.name} · {preset.audience}</option>)}
                  </select>
                </label>
                <label className="text-sm font-extrabold text-[#29465f]">
                  Vigencia opcional
                  <input type="date" className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} />
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#dce7ec] bg-[#f8fbfc] p-4">
              <h3 className="font-black text-[#29465f]">Presentación de un widget</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-extrabold text-[#29465f]">
                  Widget
                  <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={overrideWidget} onChange={(event) => chooseOverrideWidget(event.target.value)}>
                    {snapshot.widgets.map((widget) => <option key={widget.code} value={widget.code}>{widget.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-extrabold text-[#29465f]">
                  Tamaño permitido
                  <select className="mt-2 h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3" value={overrideSize} onChange={(event) => setOverrideSize(event.target.value as DashboardWidgetSize)}>
                    {overrideSizes.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
                  </select>
                </label>
                <label className="flex min-h-11 items-center justify-between self-end rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm font-extrabold text-[#29465f]">
                  Visible para la organización
                  <Switch checked={overrideEnabled} onCheckedChange={setOverrideEnabled} />
                </label>
              </div>
            </div>

            <label className="mt-4 block text-sm font-extrabold text-[#29465f]">
              Motivo obligatorio
              <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#ccdbe4] bg-white p-3 font-normal" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe el cambio operativo y quién lo autorizó." />
            </label>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="min-h-11 rounded-xl" disabled={saving || reason.trim().length < 5 || !organizationPresetCode} onClick={() => void saveOverride("preset")}><CheckCircle2 className="size-4" />Guardar preset</Button>
              <Button className="min-h-11 rounded-xl" disabled={saving || reason.trim().length < 5 || !overrideWidget} onClick={() => void saveOverride("widget")}><Save className="size-4" />Guardar widget</Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ConfigState({ title, loading = false }: { title: string; loading?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf4f7] p-5">
      <div className="w-full max-w-md rounded-[1.7rem] border border-[#d5e4eb] bg-white p-8 text-center">
        <BrandMark />
        <div className="mx-auto mt-6 flex size-11 items-center justify-center rounded-xl bg-[#e8f3ff] text-[#1769df]">{loading ? <Loader2 className="size-5 animate-spin" /> : <Settings2 className="size-5" />}</div>
        <h1 className="mt-4 text-xl font-black">{title}</h1>
        {!loading && <Button asChild variant="outline" className="mt-6 min-h-11 rounded-xl"><Link href="/app">Regresar</Link></Button>}
      </div>
    </main>
  );
}
