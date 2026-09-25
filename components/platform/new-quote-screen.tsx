"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, FileText, LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CommercialError, CommercialLoading } from "@/components/platform/commercial-shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { commercialMutation, useCommercialQuery } from "@/hooks/use-commercial";
import type { CommercialModule, PriceBookSummary, PricingResult, PricingSelection, ProspectDetail, ProspectSummary, QuoteDetail } from "@/types";
import { formatMinorMoney } from "@/utils/money";

interface ProspectList { items: ProspectSummary[]; total: number; page: number; pageSize: number }

export function NewQuoteScreen() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId") ?? "";
  const [prospectId, setProspectId] = useState(searchParams.get("prospectId") ?? "");
  const prospects = useCommercialQuery<ProspectList>("view=prospects&page=1&pageSize=100&sort=updated");
  const priceBooks = useCommercialQuery<PriceBookSummary[]>("view=price_books");
  const catalog = useCommercialQuery<CommercialModule[]>("view=catalog");
  const existingQuote = useCommercialQuery<QuoteDetail>(`view=quote&id=${encodeURIComponent(quoteId)}`, Boolean(quoteId));
  if ((prospects.loading || priceBooks.loading || catalog.loading || existingQuote.loading) && (!prospects.data || !priceBooks.data || !catalog.data || (quoteId && !existingQuote.data))) return <CommercialLoading label="Preparando configurador de solución…" />;
  const error = prospects.error || priceBooks.error || catalog.error || existingQuote.error;
  if (error || !prospects.data || !priceBooks.data || !catalog.data) return <CommercialError message={error ?? "No fue posible preparar la cotización."} onRetry={() => { void prospects.refresh(); void priceBooks.refresh(); void catalog.refresh(); }} />;
  const publishedBooks = priceBooks.data.filter((book) => book.activeVersionId);
  const revising = existingQuote.data ?? null;
  const effectiveProspectId = revising?.prospectId ?? prospectId;
  return <div className="space-y-6"><div><Button asChild variant="ghost" className="-ml-3 rounded-xl text-[#60758b]"><Link href={revising ? `/platform/cotizaciones/${revising.id}` : "/platform/cotizaciones"}><ArrowLeft className="size-4" />{revising ? revising.quoteNumber : "Cotizaciones"}</Link></Button><p className="mt-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">Configurador comercial</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">{revising ? `Nueva revisión de ${revising.quoteNumber}` : "Nueva cotización"}</h1><p className="mt-2 max-w-3xl text-[#6a7e94]">KitchenMind precarga cantidades y módulos; el servidor calcula el precio y conserva cada alcance como un snapshot inmutable.</p></div>{publishedBooks.length === 0 ? <Alert className="rounded-2xl border-[#efcf78] bg-[#fffaf0]"><LockKeyhole className="size-4" /><AlertTitle>Primero publica un catálogo de precios</AlertTitle><AlertDescription>Los precios importados son un borrador y no se consideran aprobados. <Button asChild variant="link" className="h-auto px-1"><Link href="/platform/precios">Revisar precios</Link></Button></AlertDescription></Alert> : !revising && <Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader><CardTitle>Prospecto</CardTitle></CardHeader><CardContent><Select value={prospectId} onValueChange={setProspectId}><SelectTrigger className="w-full max-w-xl"><SelectValue placeholder="Selecciona una oportunidad" /></SelectTrigger><SelectContent>{prospects.data.items.map((prospect) => <SelectItem key={prospect.id} value={prospect.id}>{prospect.commercialName} · {prospect.estimatedEmployees} empleados</SelectItem>)}</SelectContent></Select></CardContent></Card>}{effectiveProspectId && publishedBooks.length > 0 && <QuoteBuilder prospectId={effectiveProspectId} modules={catalog.data} priceBooks={publishedBooks} existingQuote={revising} />}</div>;
}

function QuoteBuilder({ prospectId, modules, priceBooks, existingQuote }: { prospectId: string; modules: CommercialModule[]; priceBooks: PriceBookSummary[]; existingQuote: QuoteDetail | null }) {
  const router = useRouter();
  const prospectQuery = useCommercialQuery<ProspectDetail>(`view=prospect&id=${encodeURIComponent(prospectId)}`);
  const [selectedModules, setSelectedModules] = useState<string[]>(["core"]);
  const [priceBookId, setPriceBookId] = useState(existingQuote?.currentVersion.priceBookId ?? priceBooks[0]?.id ?? "");
  const [branches, setBranches] = useState(1);
  const [employees, setEmployees] = useState(0);
  const [users, setUsers] = useState(1);
  const [devices, setDevices] = useState(0);
  const [warehouses, setWarehouses] = useState(0);
  const [monthlyMovements, setMonthlyMovements] = useState(0);
  const [implementation, setImplementation] = useState(true);
  const [training, setTraining] = useState(false);
  const [support, setSupport] = useState(false);
  const [readers, setReaders] = useState(0);
  const [tablets, setTablets] = useState(0);
  const [taxRate, setTaxRate] = useState(16);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const [customerNotes, setCustomerNotes] = useState("Gracias por considerar KitchenMind para digitalizar su operación de alimentos.");
  const [internalNotes, setInternalNotes] = useState("");
  const [terms, setTerms] = useState("Precios expresados antes de cambios de alcance. La implementación inicia después de la aceptación y condiciones comerciales acordadas.");
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [scopeAdjustmentReason, setScopeAdjustmentReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PricingResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const prospect = prospectQuery.data;
  useEffect(() => {
    if (!prospect) return;
    const timeout = window.setTimeout(() => {
      if (existingQuote) {
        const current = existingQuote.currentVersion;
        setSelectedModules(current.selection.moduleCodes);
        setPriceBookId(priceBooks.find((book) => book.id === current.priceBookId)?.id ?? priceBooks[0]?.id ?? "");
        setBranches(current.selection.quantities.branches);
        setEmployees(current.selection.quantities.employees);
        setUsers(current.selection.quantities.users);
        setDevices(current.selection.quantities.devices);
        setWarehouses(current.selection.quantities.warehouses);
        setMonthlyMovements(current.selection.quantities.monthlyMovements);
        setImplementation(current.selection.implementationCodes.length > 0);
        setTraining(current.selection.trainingCodes.length > 0);
        setSupport(Boolean(current.selection.supportCode));
        setReaders(current.selection.hardware.find((item) => item.code === "hardware.reader")?.quantity ?? 0);
        setTablets(current.selection.hardware.find((item) => item.code === "hardware.tablet")?.quantity ?? 0);
        setTaxRate(Math.round((current.taxTotalMinor / Math.max(1, current.subtotalOneTimeMinor + current.subtotalRecurringMinor - current.discountTotalMinor)) * 10_000) / 100);
        setBillingCycle(current.billingCycle);
        setCustomerNotes(current.customerNotes);
        setInternalNotes(current.internalNotes);
        setTerms(current.commercialTerms);
      } else {
        setSelectedModules([...new Set(["core", ...prospect.recommendedModuleCodes])]);
        setBranches(prospect.estimatedBranches);
        setEmployees(prospect.estimatedEmployees);
        setUsers(prospect.estimatedAdminUsers);
        setDevices(prospect.estimatedDevices);
        setWarehouses(prospect.estimatedWarehouses);
        setMonthlyMovements(prospect.estimatedMonthlyMovements ?? 0);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [existingQuote, priceBooks, prospect]);
  const selectedBook = priceBooks.find((book) => book.id === priceBookId);
  const featureCodes = useMemo(() => modules.filter((module) => selectedModules.includes(module.code)).flatMap((module) => module.features.filter((feature) => feature.status === "active").map((feature) => feature.code)), [modules, selectedModules]);
  const selection: PricingSelection = useMemo(() => ({ profileCode: prospect?.businessType ?? "", moduleCodes: selectedModules, featureCodes, quantities: { branches, employees, users, devices, warehouses, monthlyMovements }, implementationCodes: implementation ? ["implementation.standard", "implementation.import"] : [], supportCode: support ? "support.priority" : null, trainingCodes: training ? ["training.remote"] : [], hardware: [{ code: "hardware.reader", quantity: readers }, { code: "hardware.tablet", quantity: tablets }].filter((item) => item.quantity > 0), billingCycle, taxRateBasisPoints: Math.round(taxRate * 100) }), [billingCycle, branches, devices, employees, featureCodes, implementation, monthlyMovements, prospect?.businessType, readers, selectedModules, support, tablets, taxRate, training, users, warehouses]);
  const recommendedModules = useMemo(() => [...new Set(["core", ...(prospect?.recommendedModuleCodes ?? [])])].sort(), [prospect?.recommendedModuleCodes]);
  const scopeChanged = useMemo(() => { const selected = [...selectedModules].sort(); return selected.length !== recommendedModules.length || selected.some((code, index) => code !== recommendedModules[index]); }, [recommendedModules, selectedModules]);
  const quoteRequest = useMemo(() => {
    if (!prospect || !selectedBook?.activeVersionId || !validUntil) return null;
    const adjustments = discount > 0 ? [{ type: "percentage" as const, scope: "recurring" as const, value: Math.round(discount * 100), reason: discountReason }] : [];
    return { idempotencyKey, prospectId: prospect.id, priceBookId: selectedBook.id, priceBookVersionId: selectedBook.activeVersionId, validUntil: new Date(`${validUntil}T23:59:59`).toISOString(), billingCycle, commercialTerms: terms, internalNotes, customerNotes, scopeAdjustmentReason: scopeChanged ? scopeAdjustmentReason : undefined, selection, adjustments };
  }, [billingCycle, customerNotes, discount, discountReason, idempotencyKey, internalNotes, prospect, scopeAdjustmentReason, scopeChanged, selectedBook, selection, terms, validUntil]);
  useEffect(() => {
    if (!quoteRequest || (discount > 0 && discountReason.trim().length < 3)) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setPreviewing(true);
      setPreviewError(null);
      void commercialMutation<PricingResult>("preview_quote", quoteRequest)
        .then((result) => { if (active) setPreview(result); })
        .catch((error: unknown) => { if (active) { setPreview(null); setPreviewError(error instanceof Error ? error.message : "No fue posible calcular la vista previa."); } })
        .finally(() => { if (active) setPreviewing(false); });
    }, 450);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [discount, discountReason, quoteRequest]);
  if (prospectQuery.loading && !prospect) return <CommercialLoading label="Precargando diagnóstico y cantidades…" />;
  if (prospectQuery.error || !prospect) return <CommercialError message={prospectQuery.error ?? "Prospecto no disponible."} onRetry={() => void prospectQuery.refresh()} />;
  const create = async () => {
    if (!quoteRequest) return;
    setSaving(true);
    try {
      if (existingQuote) {
        await commercialMutation("revise_quote", { ...quoteRequest, quoteId: existingQuote.id, revisionReason });
        toast.success(`Revisión ${existingQuote.currentVersionNumber + 1} guardada sin modificar la anterior.`);
        router.push(`/platform/cotizaciones/${existingQuote.id}`);
      } else {
        const result = await commercialMutation<{ id: string; quoteNumber: string }>("create_quote", quoteRequest);
        toast.success(`${result.quoteNumber} guardada con cálculo del servidor.`);
        router.push(`/platform/cotizaciones/${result.id}`);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible crear la cotización."); }
    finally { setSaving(false); }
  };
  return <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
    <div className="space-y-5"><Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader><CardTitle>Solución para {prospect.commercialName}</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{modules.map((module) => { const checked = selectedModules.includes(module.code); const missing = module.dependencies.filter((dependency) => !selectedModules.includes(dependency)); return <label key={module.id} className={`flex gap-3 rounded-2xl border p-4 ${checked ? "border-[#a7d9d4] bg-[#f3fffd]" : "border-[#dbe7f2] bg-white"}`}><Checkbox checked={checked} disabled={module.code === "core"} onCheckedChange={(value) => setSelectedModules(value ? [...new Set([...selectedModules, module.code, ...module.dependencies])] : selectedModules.filter((item) => item !== module.code))} /><span><span className="block font-extrabold text-[#314b65]">{module.name}</span><span className="mt-1 block text-xs leading-5 text-[#71869a]">{module.description}</span>{missing.length > 0 && <span className="mt-1 block text-xs font-bold text-[#a26c08]">Al activar, también se añadirá {missing.join(", ")}</span>}</span></label>; })}</div></CardContent></Card>
      <Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader><CardTitle>Cantidades contratadas</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><NumberField label="Sucursales" value={branches} minimum={1} onChange={setBranches} /><NumberField label="Empleados" value={employees} onChange={setEmployees} /><NumberField label="Usuarios administrativos" value={users} minimum={1} onChange={setUsers} /><NumberField label="Dispositivos" value={devices} onChange={setDevices} /><NumberField label="Almacenes" value={warehouses} onChange={setWarehouses} /><NumberField label="Movimientos mensuales" value={monthlyMovements} onChange={setMonthlyMovements} /></CardContent></Card>
      <Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader><CardTitle>Implementación y adicionales</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Option checked={implementation} onChange={setImplementation} label="Implementación e importación inicial" /><Option checked={training} onChange={setTraining} label="Capacitación remota" /><Option checked={support} onChange={setSupport} label="Soporte prioritario" /><div /><NumberField label="Lectores HID" value={readers} onChange={setReaders} /><NumberField label="Tablets" value={tablets} onChange={setTablets} /></CardContent></Card>
    </div>
    <div className="space-y-5"><Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader><CardTitle>Condiciones y cálculo</CardTitle></CardHeader><CardContent className="space-y-4"><Field label="Catálogo publicado"><Select value={priceBookId} onValueChange={setPriceBookId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priceBooks.map((book) => <SelectItem key={book.id} value={book.id}>{book.name} · v{book.activeVersionNumber}</SelectItem>)}</SelectContent></Select></Field><div className="grid grid-cols-2 gap-3"><Field label="Periodicidad"><Select value={billingCycle} onValueChange={(value) => setBillingCycle(value as "monthly" | "annual")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensual</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select></Field><Field label="Impuesto %"><Input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))} /></Field></div><Field label="Vigencia"><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></Field><div className="grid grid-cols-[130px_1fr] gap-3"><Field label="Descuento %"><Input type="number" min="0" max="100" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></Field><Field label="Motivo del descuento"><Input disabled={discount <= 0} value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Obligatorio si aplica" /></Field></div>{scopeChanged && <Field label="Motivo del ajuste a la recomendación"><Textarea value={scopeAdjustmentReason} onChange={(event) => setScopeAdjustmentReason(event.target.value)} placeholder="Explica por qué agregaste o retiraste módulos sugeridos" /></Field>}{existingQuote && <Field label="Motivo de la nueva revisión"><Textarea value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="Qué cambió y por qué" /></Field>}<Field label="Nota visible para cliente"><Textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} /></Field><Field label="Términos comerciales"><Textarea value={terms} onChange={(event) => setTerms(event.target.value)} /></Field><Field label="Nota interna"><Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Nunca aparece en la vista del cliente" /></Field></CardContent></Card>
      <Card className="rounded-[1.4rem] border-[#a8d8d3] bg-[#f4fffd]"><CardHeader className="flex-row items-center justify-between"><CardTitle>Resumen en servidor</CardTitle>{previewing && <RefreshCw className="size-4 animate-spin text-[#169b99]" />}</CardHeader><CardContent>{previewError ? <p className="text-sm font-bold text-[#a24a3f]">{previewError}</p> : preview ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><SummaryAmount label="Implementación" value={formatMinorMoney(preview.totalOneTimeMinor, preview.currency)} /><SummaryAmount label="Mensualidad" value={formatMinorMoney(preview.monthlyTotalMinor, preview.currency)} /><SummaryAmount label="Descuento" value={formatMinorMoney(preview.discountTotalMinor, preview.currency)} /><SummaryAmount label="Impuestos" value={formatMinorMoney(preview.taxTotalMinor, preview.currency)} /><SummaryAmount label="Anual equivalente" value={formatMinorMoney(preview.annualEquivalentMinor, preview.currency)} /><SummaryAmount label="Primer pago" value={formatMinorMoney(preview.firstPaymentMinor, preview.currency)} /></div><div className="border-t border-[#cce9e5] pt-3"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#5d7f7c]">Partidas explicables</p>{preview.lines.slice(0, 5).map((line) => <p key={line.code} className="mt-2 text-xs text-[#56716f]">{line.explanation}</p>)}{preview.lines.length > 5 && <p className="mt-2 text-xs font-bold text-[#169b99]">+ {preview.lines.length - 5} partidas adicionales</p>}</div></div> : <p className="text-sm text-[#637c7a]">Completa el alcance para calcular la propuesta.</p>}</CardContent></Card>
      <Alert className="rounded-2xl border-[#bfe7e2] bg-[#f4fffd]"><Check className="size-4" /><AlertTitle>Cálculo autoritativo en servidor</AlertTitle><AlertDescription>Los importes se guardan en centavos, con partidas y reglas explicables. La cotización conservará esta versión exacta del catálogo.</AlertDescription></Alert>
      <Button className="h-12 w-full rounded-xl" disabled={saving || !quoteRequest || selectedModules.length === 0 || !validUntil || (discount > 0 && discountReason.trim().length < 3) || (scopeChanged && scopeAdjustmentReason.trim().length < 3) || (Boolean(existingQuote) && revisionReason.trim().length < 3)} onClick={() => void create()}><FileText className="size-5" />{saving ? "Calculando y guardando…" : existingQuote ? "Guardar nueva revisión" : "Crear borrador persistente"}</Button>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function NumberField({ label, value, onChange, minimum = 0 }: { label: string; value: number; onChange: (value: number) => void; minimum?: number }) { return <Field label={label}><Input type="number" min={minimum} value={value} onChange={(event) => onChange(Math.max(minimum, Number(event.target.value) || minimum))} /></Field>; }
function Option({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? "border-[#a7d9d4] bg-[#f3fffd]" : "border-[#dbe7f2]"}`}><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} /><span className="text-sm font-bold text-[#415a72]">{label}</span></label>; }
function SummaryAmount({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-[#6a8582]">{label}</p><p className="mt-1 text-lg font-black text-[#154e57]">{value}</p></div>; }
