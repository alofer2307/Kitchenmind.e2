"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommercialRequestError, commercialMutation } from "@/hooks/use-commercial";
import type { ProspectCreateInput } from "@/types";

const BUSINESS_TYPES = [
  ["street_food", "Puesto o taquería"], ["cafe", "Cafetería o panadería"], ["restaurant", "Restaurante"],
  ["dark_kitchen", "Dark kitchen"], ["central_kitchen", "Cocina central o catering"], ["industrial_canteen", "Comedor industrial"],
  ["institutional", "Operación institucional"], ["other", "Otro negocio de alimentos"],
] as const;

const initial: ProspectCreateInput = {
  commercialName: "", businessType: "restaurant", contactName: "", contactPhone: "", contactEmail: "", city: "", countryCode: "MX",
  estimatedBranches: 1, estimatedEmployees: 10, estimatedAdminUsers: 1, estimatedDevices: 1, estimatedDailyServices: 0, estimatedWarehouses: 1,
  operates24Hours: false, multiBranch: false, requiresOffline: false, primaryNeed: "", currentProblems: "", currentSystems: "",
  nextAction: "Realizar llamada de diagnóstico",
};

export function NewProspectScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; commercialName: string; matches: string[] }>>([]);
  const set = <K extends keyof ProspectCreateInput>(key: K, value: ProspectCreateInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (allowPossibleDuplicate = false) => {
    setSaving(true);
    try {
      const result = await commercialMutation<{ id: string }>("create_prospect", { ...draft, businessProfileId: `profile-${draft.businessType.replaceAll("_", "-")}`, allowPossibleDuplicate, nextActionAt: draft.nextActionAt ? new Date(draft.nextActionAt).toISOString() : undefined });
      toast.success("Prospecto guardado con diagnóstico precargado.");
      router.push(`/platform/prospectos/${result.id}`);
    } catch (error) {
      if (error instanceof CommercialRequestError && error.code === "possible_duplicate") {
        setDuplicates((error.detail as typeof duplicates | undefined) ?? []);
      } else toast.error(error instanceof Error ? error.message : "No fue posible crear el prospecto.");
    } finally { setSaving(false); }
  };
  const valid = draft.commercialName.trim().length > 1 && draft.contactName.trim().length > 1 && /^\S+@\S+\.\S+$/.test(draft.contactEmail) && draft.contactPhone.replace(/\D/g, "").length >= 7 && draft.city.trim().length > 1 && draft.primaryNeed.trim().length >= 3 && draft.nextAction.trim().length >= 3;
  return <div className="space-y-6">
    <div><Button asChild variant="ghost" className="-ml-3 rounded-xl text-[#60758b]"><Link href="/platform/prospectos"><ArrowLeft className="size-4" />Volver a prospectos</Link></Button><p className="mt-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">Nueva oportunidad</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Registrar prospecto</h1><p className="mt-2 max-w-2xl text-[#6a7e94]">Estos datos alimentarán automáticamente el diagnóstico y la primera configuración de solución.</p></div>
    {duplicates.length > 0 && <Alert className="rounded-2xl border-[#f1cf75] bg-[#fffaf0]"><AlertTriangle className="size-4 text-[#a66a00]" /><AlertTitle>Encontré posibles duplicados</AlertTitle><AlertDescription><div className="mt-2 space-y-2">{duplicates.map((item) => <div key={item.id} className="rounded-xl border border-[#ead8a6] bg-white p-3"><p className="font-bold text-[#3d5268]">{item.commercialName}</p><p className="text-xs text-[#7b6a45]">Coincide: {item.matches.join(", ")}</p></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setDuplicates([])}>Revisar datos</Button><Button size="sm" onClick={() => void submit(true)} disabled={saving}>Crear de todas formas</Button></div></AlertDescription></Alert>}
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="space-y-5">
        <Section title="Empresa" icon={Building2}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre comercial" wide><Input value={draft.commercialName} onChange={(event) => set("commercialName", event.target.value)} placeholder="Ej. Comedores del Norte" /></Field><Field label="Razón social"><Input value={draft.legalName ?? ""} onChange={(event) => set("legalName", event.target.value)} placeholder="Opcional" /></Field><Field label="Tipo de negocio"><Select value={draft.businessType} onValueChange={(value) => set("businessType", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{BUSINESS_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Ciudad"><Input value={draft.city} onChange={(event) => set("city", event.target.value)} /></Field><Field label="Estado"><Input value={draft.state ?? ""} onChange={(event) => set("state", event.target.value)} /></Field></div></Section>
        <Section title="Contacto principal"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre"><Input value={draft.contactName} onChange={(event) => set("contactName", event.target.value)} /></Field><Field label="Puesto"><Input value={draft.contactPosition ?? ""} onChange={(event) => set("contactPosition", event.target.value)} /></Field><Field label="Correo"><Input type="email" value={draft.contactEmail} onChange={(event) => set("contactEmail", event.target.value)} /></Field><Field label="Teléfono"><Input type="tel" value={draft.contactPhone} onChange={(event) => set("contactPhone", event.target.value)} /></Field></div></Section>
        <Section title="Necesidad"><div className="grid gap-4"><Field label="Necesidad principal"><Textarea value={draft.primaryNeed} onChange={(event) => set("primaryNeed", event.target.value)} placeholder="¿Qué necesita resolver primero?" /></Field><Field label="Problemas actuales"><Textarea value={draft.currentProblems} onChange={(event) => set("currentProblems", event.target.value)} /></Field><Field label="Sistemas actuales"><Input value={draft.currentSystems} onChange={(event) => set("currentSystems", event.target.value)} placeholder="Excel, otro sistema o ninguno" /></Field></div></Section>
      </div>
      <div className="space-y-5">
        <Section title="Tamaño estimado"><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Sucursales" value={draft.estimatedBranches} min={1} onChange={(value) => { set("estimatedBranches", value); set("multiBranch", value > 1); }} /><NumberField label="Empleados" value={draft.estimatedEmployees} onChange={(value) => set("estimatedEmployees", value)} /><NumberField label="Usuarios administrativos" value={draft.estimatedAdminUsers} min={1} onChange={(value) => set("estimatedAdminUsers", value)} /><NumberField label="Dispositivos" value={draft.estimatedDevices} onChange={(value) => set("estimatedDevices", value)} /><NumberField label="Servicios diarios" value={draft.estimatedDailyServices} onChange={(value) => set("estimatedDailyServices", value)} /><NumberField label="Almacenes" value={draft.estimatedWarehouses} onChange={(value) => set("estimatedWarehouses", value)} /><NumberField label="Movimientos mensuales" value={draft.estimatedMonthlyMovements ?? 0} onChange={(value) => set("estimatedMonthlyMovements", value)} /></div><div className="mt-4 grid gap-2"><BooleanField label="Opera 24 horas" checked={draft.operates24Hours} onChange={(value) => set("operates24Hours", value)} /><BooleanField label="Es multisucursal" checked={draft.multiBranch} onChange={(value) => set("multiBranch", value)} /><BooleanField label="Necesita funcionar sin Internet" checked={draft.requiresOffline} onChange={(value) => set("requiresOffline", value)} /></div></Section>
        <Section title="Próximo paso"><div className="grid gap-4"><Field label="Siguiente acción"><Input value={draft.nextAction} onChange={(event) => set("nextAction", event.target.value)} /></Field><Field label="Fecha y hora"><Input type="datetime-local" value={draft.nextActionAt ?? ""} onChange={(event) => set("nextActionAt", event.target.value)} /></Field><Field label="Origen"><Input value={draft.acquisitionSource ?? ""} onChange={(event) => set("acquisitionSource", event.target.value)} placeholder="Recomendación, sitio web, evento…" /></Field></div></Section>
        <Card className="rounded-[1.4rem] border-[#bfe7e2] bg-[#f4fffd]"><CardContent className="p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 text-[#119a91]" /><div><p className="font-extrabold text-[#183451]">Cero recaptura</p><p className="mt-1 text-sm leading-6 text-[#60758b]">Al guardar se crea el diagnóstico vigente y se precargan empresa, tamaños, país, moneda, zona horaria y necesidades operativas.</p></div></div></CardContent></Card>
      </div>
    </div>
    <div className="sticky bottom-4 flex justify-end rounded-2xl border border-[#dbe7f2] bg-white/96 p-3 shadow-[0_18px_45px_rgba(24,52,81,.12)] backdrop-blur"><Button className="h-11 rounded-xl" disabled={!valid || saving} onClick={() => void submit()}>{saving ? "Guardando…" : "Guardar y abrir diagnóstico"}<ArrowRight className="size-4" /></Button></div>
  </div>;
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Building2; children: React.ReactNode }) { return <Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg text-[#183451]">{Icon && <Icon className="size-5 text-[#1769e0]" />}{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>; }
function NumberField({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" min={min} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} /></Field>; }
function BooleanField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-3 rounded-xl border border-[#dbe7f2] bg-white p-3"><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} /><span className="text-sm font-bold text-[#415a72]">{label}</span></label>; }
