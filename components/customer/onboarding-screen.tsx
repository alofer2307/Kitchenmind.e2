"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, CheckCircle2, CircleAlert, ClipboardList, Layers3, Loader2, LogOut, MapPin, PackagePlus, Upload, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { customerOnboardingMutation, useTenancyQuery } from "@/hooks/use-tenancy";
import type { CustomerOnboardingSnapshot, OnboardingTaskSummary } from "@/types";

type ResourceType = "branch" | "area" | "warehouse" | "shift" | "service_type" | "quality_template" | "product" | "device" | "inventory_opening";
type CatalogImportType = "warehouses" | "products" | "shifts" | "service_types" | "quality_templates";
const resourceLabels: Record<ResourceType, string> = { branch: "Sucursal", area: "Área", warehouse: "Almacén", shift: "Turno", service_type: "Tipo de servicio", quality_template: "Bitácora de calidad", product: "Producto", device: "Dispositivo", inventory_opening: "Inventario inicial" };
const catalogImportLabels: Record<CatalogImportType, string> = { warehouses: "Almacenes", products: "Productos", shifts: "Turnos", service_types: "Tipos de servicio", quality_templates: "Plantillas de calidad" };

export function CustomerOnboardingScreen({ organizationId, identityLabel, signOutHref, initialSectionCode }: { organizationId?: string; identityLabel: string; signOutHref: string; initialSectionCode?: string }) {
  const query = useTenancyQuery<CustomerOnboardingSnapshot>(`view=snapshot${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ""}`, "customer");
  const [working, setWorking] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  async function mutate<T>(key: string, action: string, data: unknown): Promise<T | null> {
    setWorking(key); setError(null); setMessage(null);
    try { const result = await customerOnboardingMutation<T>(action, data); await query.refresh(); setMessage("Cambio guardado y auditado."); return result; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible guardar el cambio."); return null; }
    finally { setWorking(null); }
  }
  const snapshot = query.data;
  React.useEffect(() => {
    if (!initialSectionCode || !snapshot) return;
    const timer = window.setTimeout(() => document.getElementById(`onboarding-${initialSectionCode}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    return () => window.clearTimeout(timer);
  }, [initialSectionCode, snapshot]);
  if (query.loading && !snapshot) return <FullState loading title="Preparando tu espacio" detail="Estamos recuperando el onboarding guardado." />;
  if (query.error || !snapshot) return <FullState title="No pudimos abrir el onboarding" detail={query.error ?? "Esta cuenta no tiene una membresía activa."} />;
  const pendingTasks = snapshot.sections.flatMap((section) => section.tasks.map((task) => ({ ...task, sectionCode: section.code, sectionTitle: section.title }))).filter((task) => !["completed", "not_applicable"].includes(task.status));
  const nextTask = pendingTasks.find((task) => task.required && task.status !== "blocked") ?? pendingTasks[0];
  const blocked = pendingTasks.filter((task) => task.status === "blocked").length;
  const moduleCodes = Array.from(new Set(snapshot.sections.map((section) => section.tasks.find((task) => task.moduleCode)?.moduleCode).filter((code): code is string => Boolean(code))));
  return <main className="min-h-screen bg-[#edf4f7]">
    <header className="sticky top-0 z-30 border-b border-[#d7e5ec] bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1450px] items-center justify-between gap-3 px-4 py-3 md:px-7"><BrandMark /><div className="flex items-center gap-2">{snapshot.availableOrganizations.length > 1 && <select className="h-11 max-w-48 rounded-xl border border-[#ccd9e3] bg-white px-3 text-sm font-semibold text-[#26445e]" value={snapshot.organization.id} onChange={(event) => { window.location.href = `/app/onboarding?organizationId=${encodeURIComponent(event.target.value)}`; }} aria-label="Seleccionar organización">{snapshot.availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>}{snapshot.organization.status === "active" && <Button asChild variant="outline" className="hidden min-h-11 rounded-xl sm:flex"><Link href={`/app?organizationId=${encodeURIComponent(snapshot.organization.id)}`}>Ir a operación <ArrowRight className="size-4" /></Link></Button>}<div className="hidden text-right lg:block"><p className="text-sm font-bold text-[#26445e]">{identityLabel}</p><p className="text-xs text-[#74889a]">{snapshot.membership.roleNames.join(", ")}</p></div><Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><a href={signOutHref} target="_top" aria-label="Cerrar sesión"><LogOut className="size-4" /></a></Button></div></div></header>
    <div className="mx-auto max-w-[1450px] space-y-6 p-4 md:p-7">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#0b2d4a] p-6 text-white shadow-[0_26px_70px_rgba(14,47,76,.16)] sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#1dc4be]/20 blur-3xl" /><div className="relative grid gap-7 xl:grid-cols-[1.1fr_.9fr] xl:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#70ddd8]">Configuración inicial</p><h1 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Bienvenida a {snapshot.organization.commercialName}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#b9ccd8]">Cada respuesta queda guardada en tu organización. Verás únicamente las secciones derivadas de los módulos contratados.</p><div className="mt-5 flex flex-wrap gap-2"><span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#dce9ef]"><MapPin className="size-3.5" />{snapshot.branches[0]?.name ?? "Sucursal por configurar"}</span>{moduleCodes.map((code) => <span key={code} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#dce9ef]">{code}</span>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.075] p-5 backdrop-blur"><div className="flex items-end justify-between"><div><p className="text-xs font-bold text-[#9eb7c6]">Avance real</p><p className="mt-1 text-4xl font-black tracking-[-0.05em]">{snapshot.progress}%</p></div><Badge className="bg-[#1dc4be] text-[#08314a]">{snapshot.projectStatus.replaceAll("_", " ")}</Badge></div><Progress value={snapshot.progress} className="mt-4" />{nextTask ? <Link href={`/app/onboarding/${encodeURIComponent(nextTask.sectionCode)}?organizationId=${encodeURIComponent(snapshot.organization.id)}`} className="mt-5 flex items-center gap-3 rounded-xl bg-white/[.08] p-3 transition hover:bg-white/[.13]"><Layers3 className="size-5 shrink-0 text-[#69ded8]" /><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#9eb7c6]">Siguiente acción</span><span className="mt-0.5 block text-sm font-extrabold text-white">{nextTask.title}</span></span><ArrowRight className="size-4" /></Link> : <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/[.08] p-3 text-sm font-bold"><CheckCircle2 className="size-5 text-[#69ded8]" />Preparación completa</div>}</div></div></section>
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">{snapshot.sections.map((section) => <Button key={section.code} asChild variant={section.code === initialSectionCode ? "default" : "outline"} size="sm" className="shrink-0 rounded-xl"><Link href={`/app/onboarding/${encodeURIComponent(section.code)}?organizationId=${encodeURIComponent(snapshot.organization.id)}`}>{section.title}<span className="text-xs opacity-70">{section.percentage}%</span></Link></Button>)}</div>
      {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
      {blocked > 0 && <Notice error><strong>{blocked} tarea(s) bloqueada(s).</strong> Revisa el motivo antes de solicitar activación.</Notice>}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_.85fr]">
        <div className="space-y-5">
          <ProfileCard snapshot={snapshot} busy={working === "profile"} onSave={(data) => void mutate("profile", "update_profile", data)} />
          <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-[#168ca0]" />Lista de preparación</CardTitle></CardHeader><CardContent className="space-y-4">{snapshot.sections.map((section) => <section id={`onboarding-${section.code}`} key={section.id} className={`scroll-mt-24 rounded-2xl border p-4 ${section.code === initialSectionCode ? "border-[#5cbec2] bg-[#f4fbfb] ring-2 ring-[#5cbec2]/15" : "border-[#dce8f0]"}`}><div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold text-[#173653]">{section.title}</h2><p className="mt-1 text-sm text-[#71869a]">{section.description}</p></div><Badge variant="outline">{section.percentage}%</Badge></div><div className="mt-4 space-y-2">{section.tasks.map((task) => <TaskRow key={task.id} task={task} busy={working === task.id} onUpdate={(status, reason) => void mutate(task.id, "update_task", { organizationId: snapshot.organization.id, taskId: task.id, status, reason })} />)}</div></section>)}</CardContent></Card>
        </div>
        <div className="space-y-5">
          <ResourceCard snapshot={snapshot} busy={working === "resource"} onCreate={(data) => void mutate("resource", "create_resource", data)} />
          <ImportCard organizationId={snapshot.organization.id} busy={working === "import"} onImport={(data) => mutate<{ validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> }>("import", "import_employees", data)} />
          <CatalogImportCard snapshot={snapshot} busy={working === "catalog-import"} onImport={(data) => mutate<{ validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> }>("catalog-import", "import_catalog", data)} />
          <Card className="rounded-[1.5rem] border-[#b9dedf] bg-[#f1fbfa]"><CardContent className="p-5"><CheckCircle2 className="size-7 text-[#158f83]" /><h2 className="mt-3 text-lg font-black text-[#173653]">Revisión final</h2><p className="mt-2 text-sm leading-6 text-[#5e778b]">Cuando todas las tareas obligatorias estén completas, solicita a KitchenMind la revisión de activación.</p><Button className="mt-4 w-full rounded-xl" disabled={Boolean(working) || snapshot.projectStatus === "ready_for_review" || snapshot.projectStatus === "activated"} onClick={() => void mutate("review", "request_review", { organizationId: snapshot.organization.id })}>{working === "review" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Solicitar revisión</Button></CardContent></Card>
        </div>
      </div>
    </div>
  </main>;
}

function ProfileCard({ snapshot, busy, onSave }: { snapshot: CustomerOnboardingSnapshot; busy: boolean; onSave: (data: Record<string, unknown>) => void }) {
  const [form, setForm] = React.useState({ commercialName: snapshot.organization.commercialName, legalName: snapshot.organization.legalName ?? "", timezone: snapshot.organization.timezone === "UTC" ? "America/Mexico_City" : snapshot.organization.timezone, locale: snapshot.organization.locale, taxId: snapshot.organization.taxId ?? "", contactEmail: snapshot.organization.contactEmail, contactPhone: snapshot.organization.contactPhone });
  return <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-[#1769e0]" />Datos de la empresa</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre comercial"><Input value={form.commercialName} onChange={(event) => setForm({ ...form, commercialName: event.target.value })} /></Field><Field label="Razón social"><Input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></Field><Field label="Zona horaria"><Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="America/Mexico_City" /></Field><Field label="Configuración regional"><Input value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })} /></Field><Field label="Correo de contacto"><Input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} /></Field><Field label="Teléfono"><Input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></Field></div><Button className="mt-4 rounded-xl" disabled={busy} onClick={() => onSave({ organizationId: snapshot.organization.id, version: snapshot.organization.version, ...form })}>{busy && <Loader2 className="size-4 animate-spin" />}Guardar empresa</Button></CardContent></Card>;
}

function TaskRow({ task, busy, onUpdate }: { task: OnboardingTaskSummary; busy: boolean; onUpdate: (status: string, reason?: string) => void }) {
  const [reason, setReason] = React.useState("");
  const complete = task.status === "completed";
  return <div className="rounded-xl bg-[#f5f9fc] p-3"><div className="flex items-start gap-3">{complete ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#159578]" /> : task.status === "blocked" ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#b5632f]" /> : <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-[#aabccb]" />}<div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#24415b]">{task.title}{task.required ? " · Obligatoria" : ""}</p><p className="mt-1 text-xs leading-5 text-[#71869a]">{task.blockedReason ?? task.description}</p>{!complete && task.code !== "final_review" && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" className="rounded-lg" disabled={busy} onClick={() => onUpdate("completed")}>Marcar completa</Button><Input className="h-9 min-w-[180px] flex-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo si está bloqueada" /><Button size="sm" variant="outline" className="rounded-lg" disabled={busy || reason.trim().length < 3} onClick={() => onUpdate("blocked", reason)}>Bloquear</Button></div>}</div></div></div>;
}

function ResourceCard({ snapshot, busy, onCreate }: { snapshot: CustomerOnboardingSnapshot; busy: boolean; onCreate: (data: Record<string, unknown>) => void }) {
  const [type, setType] = React.useState<ResourceType>("area");
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [branchId, setBranchId] = React.useState(snapshot.branches[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const opening = type === "inventory_opening";
  function submit() {
    const data: Record<string, unknown> = { organizationId: snapshot.organization.id, type, code, name, branchId };
    if (opening) Object.assign(data, { warehouseId, productId, quantityMinor: Math.round(Number(quantity) * 1000), unit: "unidad" });
    onCreate(data);
  }
  return <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="size-5 text-[#168ca0]" />Configuración rápida</CardTitle></CardHeader><CardContent className="space-y-3"><Field label="Qué deseas agregar"><select className="h-10 w-full rounded-md border border-[#ccd9e3] bg-white px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as ResourceType)}>{(Object.keys(resourceLabels) as ResourceType[]).map((key) => <option key={key} value={key}>{resourceLabels[key]}</option>)}</select></Field>{!opening && <><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Código"><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Se genera desde el nombre" /></Field></>} {type !== "branch" && <Field label="Sucursal"><select className="h-10 w-full rounded-md border border-[#ccd9e3] bg-white px-3 text-sm" value={branchId} onChange={(event) => setBranchId(event.target.value)}>{snapshot.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>}{opening && <><Field label="Almacén"><select className="h-10 w-full rounded-md border border-[#ccd9e3] bg-white px-3 text-sm" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}><option value="">Selecciona</option>{snapshot.warehouses.filter((item) => item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Producto"><select className="h-10 w-full rounded-md border border-[#ccd9e3] bg-white px-3 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecciona</option>{snapshot.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Cantidad inicial"><Input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field></>}<Button className="w-full rounded-xl" disabled={busy || (!opening && name.trim().length < 2) || (opening && (!warehouseId || !productId || Number(quantity) <= 0))} onClick={submit}>{busy && <Loader2 className="size-4 animate-spin" />}Guardar configuración</Button></CardContent></Card>;
}

function ImportCard({ organizationId, busy, onImport }: { organizationId: string; busy: boolean; onImport: (data: Record<string, unknown>) => Promise<{ validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> } | null> }) {
  const [csv, setCsv] = React.useState("employeeNumber,name,branchCode,shiftCode,email\n");
  const [result, setResult] = React.useState<{ validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> } | null>(null);
  async function submit() { const rows = parseCsv(csv); if (!rows.length) return; const response = await onImport({ organizationId, idempotencyKey: crypto.randomUUID(), rows }); if (response) setResult(response); }
  return <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-5 text-[#1769e0]" />Importar empleados</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-[#667d92]">Pega un CSV con encabezados: employeeNumber, name, branchCode, shiftCode y email. KitchenMind valida antes de insertar.</p><Textarea className="mt-3 min-h-36 font-mono text-xs" value={csv} onChange={(event) => setCsv(event.target.value)} /><Button className="mt-3 w-full rounded-xl" variant="outline" disabled={busy || parseCsv(csv).length === 0} onClick={() => void submit()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <UsersRound className="size-4" />}Validar e importar</Button>{result && <div className="mt-3 rounded-xl bg-[#f5f9fc] p-3 text-sm"><p><strong>{result.validRows}</strong> importadas · <strong>{result.invalidRows}</strong> con error</p>{result.errors.slice(0, 5).map((error) => <p key={error.row} className="mt-1 text-xs text-[#a34c33]">Fila {error.row}: {error.messages.join(" ")}</p>)}</div>}</CardContent></Card>;
}

function CatalogImportCard({ snapshot, busy, onImport }: { snapshot: CustomerOnboardingSnapshot; busy: boolean; onImport: (data: Record<string, unknown>) => Promise<{ validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> } | null> }) {
  const available = React.useMemo(() => {
    const sections = new Set(snapshot.sections.map((section) => section.code));
    const types: CatalogImportType[] = [];
    if (sections.has("inventory")) types.push("warehouses", "products");
    if (sections.has("personnel")) types.push("shifts");
    if (sections.has("services")) types.push("service_types");
    if (sections.has("quality")) types.push("quality_templates");
    return types;
  }, [snapshot.sections]);
  const [catalogType, setCatalogType] = React.useState<CatalogImportType>(available[0] ?? "products");
  const [csv, setCsv] = React.useState("code,name,branchCode\n");
  const [result, setResult] = React.useState<{ validRows: number; invalidRows: number; errors: Array<{ row: number; messages: string[] }> } | null>(null);
  if (!available.length) return null;
  async function submit() {
    const rows = parseCsv(csv);
    if (!rows.length) return;
    const response = await onImport({ organizationId: snapshot.organization.id, catalogType, idempotencyKey: crypto.randomUUID(), rows });
    if (response) setResult(response);
  }
  return <Card className="rounded-[1.5rem] border-[#d8e6ef]"><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-5 text-[#168ca0]" />Importar catálogos</CardTitle></CardHeader><CardContent><Field label="Catálogo"><select className="h-10 w-full rounded-md border border-[#ccd9e3] bg-white px-3 text-sm" value={catalogType} onChange={(event) => { setCatalogType(event.target.value as CatalogImportType); setResult(null); }}>{available.map((type) => <option key={type} value={type}>{catalogImportLabels[type]}</option>)}</select></Field><p className="mt-3 text-sm leading-6 text-[#667d92]">Pega un CSV con code, name y branchCode. Las columnas adicionales se conservan como datos estructurados del catálogo.</p><Textarea className="mt-3 min-h-32 font-mono text-xs" value={csv} onChange={(event) => setCsv(event.target.value)} /><Button className="mt-3 w-full rounded-xl" variant="outline" disabled={busy || parseCsv(csv).length === 0} onClick={() => void submit()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Validar e importar catálogo</Button>{result && <div className="mt-3 rounded-xl bg-[#f5f9fc] p-3 text-sm"><p><strong>{result.validRows}</strong> importadas · <strong>{result.invalidRows}</strong> con error</p>{result.errors.slice(0, 5).map((error) => <p key={error.row} className="mt-1 text-xs text-[#a34c33]">Fila {error.row}: {error.messages.join(" ")}</p>)}</div>}</CardContent></Card>;
}

function parseCsv(value: string): Record<string, unknown>[] {
  const matrix: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < value.length; index += 1) { const char = value[index]; const next = value[index + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if ((char === "," || char === ";") && !quoted) { row.push(cell.trim()); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell.trim()); if (row.some(Boolean)) matrix.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell.trim()); if (row.some(Boolean)) matrix.push(row); const headers = matrix.shift() ?? [];
  return matrix.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index]?.trim() ?? ""]))).filter((item) => Object.values(item).some(Boolean));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`rounded-2xl border p-4 text-sm ${error ? "border-[#efc0b2] bg-[#fff6f2] text-[#9b3f27]" : "border-[#a7dfd1] bg-[#eefaf6] text-[#176b59]"}`}>{children}</div>; }
function FullState({ loading = false, title, detail }: { loading?: boolean; title: string; detail: string }) { return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-5"><Card className="w-full max-w-md rounded-[1.75rem]"><CardContent className="p-8 text-center">{loading ? <Loader2 className="mx-auto size-7 animate-spin text-[#1769e0]" /> : <CircleAlert className="mx-auto size-7 text-[#b6573b]" />}<h1 className="mt-4 text-xl font-black text-[#173653]">{title}</h1><p className="mt-2 text-sm text-[#71869a]">{detail}</p></CardContent></Card></main>; }
