"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileCheck2, Loader2, Paperclip, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { qualityMutation, uploadQualityEvidence } from "@/hooks/use-quality";
import type { OperationalQualityTemplateField, QualityCorrectiveActionSummary, QualityLogSummary, QualitySnapshot } from "@/types";

type DraftValue = string | boolean;

export function QualityLogCapture({ snapshot, log, backHref, refresh }: { snapshot: QualitySnapshot; log: QualityLogSummary; backHref: string; refresh: () => Promise<QualitySnapshot | undefined> }) {
  const [answers, setAnswers] = useState<Record<string, { value: DraftValue; notes: string }>>(() => answerDrafts(log));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(snapshot.membership.displayName);
  const [confirmed, setConfirmed] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceAnswerId, setEvidenceAnswerId] = useState("");
  const [evidenceType, setEvidenceType] = useState<"general" | "before" | "after" | "document">("general");

  const requiredAnswered = useMemo(() => log.fields.filter((field) => field.required).every((field) => {
    const value = answers[field.id]?.value;
    return typeof value === "boolean" || String(value ?? "").trim().length > 0;
  }), [answers, log.fields]);
  const actions = snapshot.correctiveActions.filter((action) => action.logInstanceId === log.id);
  const mutable = ["pending", "in_progress", "overdue"].includes(log.status) && snapshot.capabilities.capture;

  const perform = async (operation: () => Promise<void>, success: string) => {
    setSaving(true); setError(null); setMessage(null);
    try {
      await operation();
      const latest = await refresh();
      const latestLog = latest?.logs.find((item) => item.id === log.id);
      if (latestLog) setAnswers(answerDrafts(latestLog));
      setMessage(success);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible guardar."); }
    finally { setSaving(false); }
  };

  const saveAnswers = () => perform(async () => {
    await qualityMutation("save_answers", { organizationId: snapshot.organization.id, logId: log.id, expectedVersion: log.version, answers: log.fields.map((field) => ({ fieldId: field.id, value: parseDraftValue(field, answers[field.id]?.value), notes: answers[field.id]?.notes ?? "" })) });
  }, "La captura quedó guardada en el servidor.");

  const complete = () => perform(async () => {
    await qualityMutation("complete_log", { organizationId: snapshot.organization.id, logId: log.id, expectedVersion: log.version, signerName, confirmed });
  }, "La bitácora quedó cerrada e inmutable.");

  const revise = () => perform(async () => {
    const result = await qualityMutation<{ logId: string }>("create_log_revision", { organizationId: snapshot.organization.id, logId: log.id, reason: revisionReason, idempotencyKey: crypto.randomUUID() });
    window.location.assign(`/app/calidad/${encodeURIComponent(result.logId)}?organizationId=${encodeURIComponent(snapshot.organization.id)}`);
  }, "Se creó una corrección sin modificar el original.");

  const uploadEvidence = () => perform(async () => {
    if (!file) throw new Error("Selecciona una imagen o PDF.");
    const data = new FormData();
    data.set("organizationId", snapshot.organization.id); data.set("logId", log.id); data.set("file", file); data.set("note", evidenceNote); data.set("evidenceType", evidenceType);
    if (evidenceAnswerId) data.set("answerId", evidenceAnswerId);
    await uploadQualityEvidence(data);
    setFile(null); setEvidenceNote(""); setEvidenceAnswerId(""); setEvidenceType("general");
  }, "La evidencia quedó almacenada de forma privada.");

  return <main className="min-h-screen bg-[#edf4f7] pb-14 text-[#153650]">
    <header className="sticky top-0 z-30 border-b border-[#d4e3ea] bg-white/95 backdrop-blur"><div className="mx-auto flex min-h-17 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><Button asChild variant="ghost" className="rounded-xl"><Link href={backHref}><ArrowLeft className="size-4" />Calidad</Link></Button><div className="flex items-center gap-2">{snapshot.capabilities.exportReports && <><Button asChild variant="outline" className="hidden rounded-xl sm:inline-flex"><a href={`/api/customer/quality/export?organizationId=${encodeURIComponent(snapshot.organization.id)}&logId=${encodeURIComponent(log.id)}&format=pdf`}><Download className="size-4" />PDF</a></Button><Button asChild variant="outline" className="hidden rounded-xl md:inline-flex"><a href={`/api/customer/quality/export?organizationId=${encodeURIComponent(snapshot.organization.id)}&logId=${encodeURIComponent(log.id)}&format=xlsx`}>XLSX</a></Button><Button asChild variant="outline" className="hidden rounded-xl lg:inline-flex"><a href={`/api/customer/quality/export?organizationId=${encodeURIComponent(snapshot.organization.id)}&logId=${encodeURIComponent(log.id)}&format=csv`}>CSV</a></Button></>}<Button variant="outline" size="icon" className="size-11 rounded-xl" onClick={() => void refresh().then((latest) => { const latestLog = latest?.logs.find((item) => item.id === log.id); if (latestLog) setAnswers(answerDrafts(latestLog)); })} aria-label="Actualizar"><RefreshCw className="size-4" /></Button></div></div></header>
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[1.8rem] bg-[#0b2e4b] p-6 text-white shadow-[0_22px_60px_rgba(14,47,76,.16)] sm:p-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="flex flex-wrap gap-2"><Badge className="bg-[#2ccbc5] text-[#082f47]">{statusLabel(log.status)}</Badge><Badge variant="outline" className="border-white/20 text-white">Rev. {log.revisionNumber}</Badge>{log.deviationCount > 0 && <Badge className="bg-[#ffdb78] text-[#6f4a08]">{log.deviationCount} desviación(es)</Badge>}</div><h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{log.templateName}</h1><p className="mt-2 text-sm text-[#b9ccd8]">{log.branchName} · {log.operationalDate} · Plantilla v{log.templateVersionNumber}</p></div><div className="rounded-2xl bg-white/10 p-4 text-right"><strong className="text-3xl">{log.completionPercentage}%</strong><p className="text-xs text-[#b9ccd8]">capturado</p></div></div></section>
      {snapshot.capabilities.restricted && <Notice icon={ShieldCheck} tone="info" title="Solo lectura" detail="La organización está restringida. Puedes consultar el historial, pero no modificarlo." />}
      {error && <Notice icon={AlertTriangle} tone="error" title="No se guardó" detail={error} />}
      {message && <Notice icon={CheckCircle2} tone="success" title="Operación confirmada" detail={message} />}

      <section className="rounded-[1.6rem] border border-[#d4e3ea] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#168b95]">Captura estructurada</p><h2 className="mt-1 text-2xl font-black">Controles</h2></div>{mutable && <Button className="min-h-11 rounded-xl bg-[#1769df] font-bold" disabled={saving} onClick={() => void saveAnswers()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar avance</Button>}</div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">{log.fields.map((field) => {
          const answer = log.answers.find((item) => item.fieldId === field.id);
          return <div key={field.id} className={`rounded-2xl border p-4 ${answer?.inRange === false ? "border-[#efb39f] bg-[#fff7f3]" : "border-[#d9e6ec] bg-[#f9fbfc]"}`}><div className="flex items-start justify-between gap-3"><div><label htmlFor={`field-${field.id}`} className="font-extrabold text-[#24445e]">{field.label}{field.required && <span className="text-[#cb5738]"> *</span>}</label><p className="mt-1 text-xs leading-5 text-[#718699]">{field.description || criterionLabel(field)}</p></div>{answer?.inRange === false ? <Badge className="bg-[#f8d8cb] text-[#984128]">Fuera de criterio</Badge> : answer?.inRange === true ? <Badge className="bg-[#dff5eb] text-[#14745c]">En criterio</Badge> : null}</div><div className="mt-3">{fieldInput(field, answers[field.id]?.value ?? "", mutable, (value) => setAnswers((current) => ({ ...current, [field.id]: { value, notes: current[field.id]?.notes ?? "" } })))}</div><Input className="mt-3 h-10 rounded-xl bg-white" placeholder="Observación opcional" value={answers[field.id]?.notes ?? ""} disabled={!mutable} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: { value: current[field.id]?.value ?? "", notes: event.target.value } }))} />{field.evidenceRequiredOnDeviation && <p className="mt-2 text-xs font-bold text-[#9a5b22]">Si queda fuera de criterio, esta versión exige evidencia antes del cierre.</p>}</div>;
        })}</div>
      </section>

      {mutable && <section className="rounded-[1.6rem] border border-[#d4e3ea] bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#e8f5f4] text-[#148a93]"><FileCheck2 className="size-5" /></div><div><h2 className="text-xl font-black">Cerrar bitácora</h2><p className="mt-1 text-sm leading-6 text-[#6b8093]">El cierre bloquea esta captura. Cualquier corrección posterior crea una revisión y conserva el original.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><label className="text-sm font-bold">Nombre de quien confirma</label><Input className="mt-2 h-11 rounded-xl" value={signerName} onChange={(event) => setSignerName(event.target.value)} /><label className="mt-4 flex items-start gap-3 rounded-xl bg-[#f4f8fa] p-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Confirmo que capturé o revisé la información y que corresponde a la operación observada. Esta confirmación registra autoría y fecha; no sustituye una firma electrónica certificada.</span></label></div><Button className="min-h-12 rounded-xl bg-[#0b8f87] px-6 font-extrabold" disabled={saving || !confirmed || !requiredAnswered || signerName.trim().length < 2} onClick={() => void complete()}><CheckCircle2 className="size-4" />Cerrar bitácora</Button></div>{!requiredAnswered && <p className="mt-3 text-xs font-bold text-[#a35c35]">Completa todos los campos obligatorios y guarda el avance antes de cerrar.</p>}</section>}

      {snapshot.capabilities.uploadEvidence && log.answers.length > 0 && <section className="rounded-[1.6rem] border border-[#d4e3ea] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><Paperclip className="size-5 text-[#168b95]" /><h2 className="text-xl font-black">Evidencia privada</h2></div><p className="mt-2 text-sm text-[#6b8093]">JPG, PNG, WEBP o PDF, máximo 5 MB. El archivo requiere sesión, membresía y alcance para abrirse.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="h-11 rounded-xl bg-white" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><select className="h-11 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm" value={evidenceAnswerId} onChange={(event) => setEvidenceAnswerId(event.target.value)}><option value="">Evidencia general de la bitácora</option>{log.answers.map((answer) => <option key={answer.id} value={answer.id}>{log.fields.find((field) => field.id === answer.fieldId)?.label ?? "Respuesta"}</option>)}</select><select className="h-11 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as typeof evidenceType)}><option value="general">General</option><option value="before">Antes de corregir</option><option value="after">Después de corregir</option><option value="document">Documento</option></select><Input className="h-11 rounded-xl" placeholder="Describe brevemente qué muestra" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} /></div><Button className="mt-3 min-h-11 rounded-xl" variant="outline" disabled={saving || !file} onClick={() => void uploadEvidence()}><Paperclip className="size-4" />Adjuntar evidencia</Button>{log.evidence.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2">{log.evidence.map((item) => <a key={item.id} target="_blank" rel="noreferrer" href={`/api/customer/quality/evidence/${encodeURIComponent(item.id)}?organizationId=${encodeURIComponent(snapshot.organization.id)}`} className="rounded-xl border border-[#dbe7ed] p-3 text-sm transition hover:border-[#67bfc0]"><div className="flex items-center justify-between gap-2"><strong className="block truncate text-[#24506e]">{item.fileName}</strong><Badge variant="outline">{evidenceTypeLabel(item.evidenceType)}</Badge></div><span className="mt-1 block text-xs text-[#718699]">{formatBytes(item.sizeBytes)} · {new Date(item.capturedAt).toLocaleString("es-MX")}</span>{item.note && <span className="mt-1 block text-xs text-[#536f83]">{item.note}</span>}</a>)}</div>}</section>}

      {actions.length > 0 && <section className="rounded-[1.6rem] border border-[#d4e3ea] bg-white p-5 sm:p-7"><h2 className="text-xl font-black">Acciones correctivas</h2><p className="mt-1 text-sm text-[#6b8093]">Cada desviación conserva su seguimiento, responsable y resolución.</p><div className="mt-4 space-y-3">{actions.map((action) => <CorrectiveEditor key={action.id} action={action} organizationId={snapshot.organization.id} assignees={snapshot.assignees} canManage={snapshot.capabilities.manageCorrectiveActions} saving={saving} perform={perform} />)}</div></section>}

      {snapshot.timeline.length > 0 && <section className="rounded-[1.6rem] border border-[#d4e3ea] bg-white p-5 sm:p-7"><h2 className="text-xl font-black">Historial auditable</h2><p className="mt-1 text-sm text-[#6b8093]">Derivado de eventos persistentes de KitchenMind; no es una bitácora de texto editable.</p><ol className="mt-5 space-y-3">{snapshot.timeline.map((event) => <li key={event.id} className="grid gap-1 rounded-xl border border-[#e0e9ee] bg-[#fbfdfe] p-3 sm:grid-cols-[8rem_1fr]"><time className="text-xs font-bold text-[#6f8394]" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time><div><p className="text-sm font-bold text-[#24445e]">{timelineLabel(event.action)}</p><p className="mt-0.5 text-xs text-[#667f91]">{event.actorName}{event.reason ? ` · ${event.reason}` : ""}</p></div></li>)}</ol></section>}

      {["completed", "corrected"].includes(log.status) && snapshot.capabilities.capture && <section className="rounded-[1.6rem] border border-[#d4e3ea] bg-white p-5 sm:p-7"><h2 className="text-xl font-black">¿Necesitas corregir un dato?</h2><p className="mt-1 text-sm text-[#6b8093]">El original no se edita. KitchenMind copiará la captura a una nueva revisión y registrará el motivo.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input className="h-11 flex-1 rounded-xl" placeholder="Motivo de la corrección" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} /><Button variant="outline" className="min-h-11 rounded-xl" disabled={saving || revisionReason.trim().length < 5} onClick={() => void revise()}>Crear corrección</Button></div></section>}
    </div>
  </main>;
}

function CorrectiveEditor({ action, organizationId, assignees, canManage, saving, perform }: { action: QualityCorrectiveActionSummary; organizationId: string; assignees: Array<{ id: string; displayName: string }>; canManage: boolean; saving: boolean; perform: (operation: () => Promise<void>, success: string) => Promise<void> }) {
  const [status, setStatus] = useState<QualityCorrectiveActionSummary["status"]>(action.status === "overdue" ? (action.assignedToName ? "assigned" : "open") : action.status === "verified" ? "resolved" : action.status);
  const [assignedToMembershipId, setAssignedToMembershipId] = useState(action.assignedToMembershipId ?? "");
  const [rootCause, setRootCause] = useState(action.rootCause ?? "");
  const [immediateCorrection, setImmediateCorrection] = useState(action.immediateCorrection ?? "");
  const [preventiveAction, setPreventiveAction] = useState(action.preventiveAction ?? "");
  const [resolution, setResolution] = useState(action.resolution ?? "");
  const [verificationNotes, setVerificationNotes] = useState(action.verificationNotes ?? "");
  const [dueAt, setDueAt] = useState(datetimeLocalValue(action.dueAt));
  const editable = ["open", "assigned", "in_progress", "overdue"].includes(action.status);
  const pendingVerification = action.status === "resolved";
  return <article className={`rounded-2xl border p-4 ${action.severity === "critical" ? "border-[#efb39f] bg-[#fff8f5]" : "border-[#ead9ac] bg-[#fffdf5]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge className={action.severity === "critical" ? "bg-[#f2c4b5] text-[#8e321a]" : "bg-[#f8e8b9] text-[#73500a]"}>{action.severity === "critical" ? "Crítica" : "Advertencia"}</Badge><Badge variant="outline">{correctiveStatusLabel(action.status)}</Badge></div><h3 className="mt-3 font-black">{action.title}</h3><p className="mt-1 text-sm text-[#6b8093]">{action.description}</p><p className="mt-2 text-xs text-[#718699]">{action.branchName}{action.dueAt ? ` · vence ${new Date(action.dueAt).toLocaleString("es-MX")}` : ""}</p></div></div>{canManage && editable && <div className="mt-4 grid gap-3 sm:grid-cols-2"><select className="h-11 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as QualityCorrectiveActionSummary["status"])}><option value="open">Abierta</option><option value="assigned">Asignada</option><option value="in_progress">En seguimiento</option><option value="resolved">Resuelta</option><option value="cancelled">Cancelada</option></select><select className="h-11 rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm" value={assignedToMembershipId} onChange={(event) => setAssignedToMembershipId(event.target.value)}><option value="">Sin responsable</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select><Input type="datetime-local" className="h-11 rounded-xl bg-white" aria-label="Fecha límite" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><Input className="h-11 rounded-xl bg-white" placeholder="Causa raíz" value={rootCause} onChange={(event) => setRootCause(event.target.value)} /><Textarea className="rounded-xl bg-white" placeholder="Corrección inmediata" value={immediateCorrection} onChange={(event) => setImmediateCorrection(event.target.value)} /><Textarea className="rounded-xl bg-white" placeholder="Acción preventiva" value={preventiveAction} onChange={(event) => setPreventiveAction(event.target.value)} /><Textarea className="rounded-xl bg-white" placeholder="Solución definitiva o motivo de cancelación" value={resolution} onChange={(event) => setResolution(event.target.value)} /><Button className="min-h-11 rounded-xl sm:col-span-2" disabled={saving} onClick={() => void perform(async () => { await qualityMutation("update_corrective", { organizationId, actionId: action.id, expectedVersion: action.version, status, assignedToMembershipId: assignedToMembershipId || null, rootCause, immediateCorrection, preventiveAction, resolution, dueAt: dueAt ? new Date(dueAt).toISOString() : null }); }, "La acción correctiva quedó actualizada.")}>Guardar seguimiento</Button></div>}{pendingVerification && canManage && <div className="mt-4 rounded-xl border border-[#b8d6e8] bg-[#edf7fd] p-4"><p className="text-sm font-bold text-[#255f82]">La acción está resuelta y espera una verificación posterior.</p><Textarea className="mt-3 rounded-xl bg-white" placeholder="Describe cómo verificaste que la corrección fue eficaz" value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} /><Button className="mt-3 min-h-11 rounded-xl" disabled={saving || verificationNotes.trim().length < 3} onClick={() => void perform(async () => { await qualityMutation("verify_corrective", { organizationId, actionId: action.id, expectedVersion: action.version, verificationNotes }); }, "La acción correctiva quedó verificada.")}>Verificar acción</Button></div>}
      {!editable && !pendingVerification && <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><Summary label="Causa raíz" value={action.rootCause ?? "No registrada"} /><Summary label="Corrección inmediata" value={action.immediateCorrection ?? "No registrada"} /><Summary label="Prevención" value={action.preventiveAction ?? "No registrada"} /><Summary label="Resolución" value={action.resolution ?? "No registrada"} /><Summary label="Verificación" value={action.verificationNotes ?? "No registrada"} /><Summary label="Verificada" value={action.verifiedAt ? new Date(action.verifiedAt).toLocaleString("es-MX") : "Pendiente"} /></div>}</article>;
}

function datetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fieldInput(field: OperationalQualityTemplateField, value: DraftValue, mutable: boolean, onChange: (value: DraftValue) => void) {
  if (field.fieldType === "boolean") return <select id={`field-${field.id}`} className="h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm" disabled={!mutable} value={typeof value === "boolean" ? String(value) : ""} onChange={(event) => onChange(event.target.value === "" ? "" : event.target.value === "true")}><option value="">Selecciona</option><option value="true">Sí</option><option value="false">No</option></select>;
  if (field.fieldType === "select") return <select id={`field-${field.id}`} className="h-11 w-full rounded-xl border border-[#ccdbe4] bg-white px-3 text-sm" disabled={!mutable} value={String(value)} onChange={(event) => onChange(event.target.value)}><option value="">Selecciona</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.fieldType === "text") return <Textarea id={`field-${field.id}`} className="rounded-xl bg-white" disabled={!mutable} value={String(value)} onChange={(event) => onChange(event.target.value)} />;
  return <div className="relative"><Input id={`field-${field.id}`} type="number" step="any" className="h-11 rounded-xl bg-white pr-16" disabled={!mutable} value={String(value)} onChange={(event) => onChange(event.target.value)} />{field.unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-bold text-[#6f8394]">{field.unit}</span>}</div>;
}

function parseDraftValue(field: OperationalQualityTemplateField, value: DraftValue | undefined): string | number | boolean | null {
  if (value === undefined || value === "") return null;
  if (field.fieldType === "number") return Number(value);
  return value;
}

function answerDrafts(log: QualityLogSummary): Record<string, { value: DraftValue; notes: string }> {
  return Object.fromEntries(log.fields.map((field) => {
    const answer = log.answers.find((item) => item.fieldId === field.id);
    const value = typeof answer?.value === "boolean" ? answer.value : answer?.value === null || answer?.value === undefined ? "" : String(answer.value);
    return [field.id, { value, notes: answer?.notes ?? "" }];
  }));
}

function criterionLabel(field: OperationalQualityTemplateField): string {
  if (field.fieldType === "number" && (field.minimum !== null || field.maximum !== null)) return `Criterio ${field.minimum ?? "−∞"} a ${field.maximum ?? "+∞"}${field.unit ? ` ${field.unit}` : ""}.`;
  if (field.fieldType === "boolean" && field.expectedBoolean !== null) return `Respuesta esperada: ${field.expectedBoolean ? "Sí" : "No"}.`;
  if (field.fieldType === "select" && field.nonCompliantOptions.length) return `Opciones no conformes: ${field.nonCompliantOptions.join(", ")}.`;
  return "Registro estructurado sin criterio automático.";
}

function Notice({ icon: Icon, tone, title, detail }: { icon: typeof AlertTriangle; tone: "error" | "success" | "info"; title: string; detail: string }) { const styles = tone === "error" ? "border-[#efc6b8] bg-[#fff7f3] text-[#8d422b]" : tone === "success" ? "border-[#b8dfd3] bg-[#f0fbf7] text-[#176c58]" : "border-[#b8d6e8] bg-[#edf7fd] text-[#255f82]"; return <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border p-4 text-sm ${styles}`}><Icon className="mt-0.5 size-5 shrink-0" /><div><strong>{title}</strong><p className="mt-1">{detail}</p></div></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/70 p-3"><span className="text-xs font-bold uppercase text-[#7a8b98]">{label}</span><p className="mt-1 text-[#355269]">{value}</p></div>; }
function statusLabel(status: QualityLogSummary["status"]) { return ({ pending: "Pendiente", upcoming: "Próxima", in_progress: "En captura", overdue: "Vencida", completed: "Cerrada", corrected: "Corregida", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status; }
function correctiveStatusLabel(status: QualityCorrectiveActionSummary["status"]) { return ({ open: "Abierta", assigned: "Asignada", in_progress: "En seguimiento", overdue: "Vencida", resolved: "Resuelta · pendiente de verificar", verified: "Verificada", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status; }
function evidenceTypeLabel(type: string) { return ({ general: "General", before: "Antes", after: "Después", document: "Documento" } as Record<string, string>)[type] ?? type; }
function timelineLabel(action: string) { return ({ "quality.template.created": "Plantilla creada", "quality.template.updated": "Plantilla actualizada", "quality.template.published": "Plantilla publicada", "quality.schedule_rule.generated": "Bitácora generada por recurrencia", "quality.log.scheduled": "Bitácora programada", "quality.log.answers_saved": "Captura guardada", "quality.deviation.detected": "Desviación detectada", "quality.corrective.created": "Acción correctiva creada", "quality.log.completed": "Bitácora cerrada", "quality.log.revision_created": "Corrección vinculada creada", "quality.evidence.uploaded": "Evidencia adjuntada", "quality.corrective.updated": "Acción correctiva actualizada", "quality.corrective.verified": "Acción correctiva verificada", "quality.log.escalated": "Bitácora escalada por vencimiento" } as Record<string, string>)[action] ?? action.replaceAll(".", " · "); }
function formatBytes(bytes: number) { return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1_000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`; }
