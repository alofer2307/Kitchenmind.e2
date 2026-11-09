"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Search, ShieldCheck } from "lucide-react";
import { useQualityQuery } from "@/hooks/use-quality";
import type { QualitySnapshot } from "@/types";

interface AuditLog {
  id: string;
  branchName: string;
  templateName: string;
  operationalDate: string;
  dueAt: string;
  status: string;
  completedAt: string | null;
  revisionNumber: number;
}

interface AuditResult {
  branchId: string;
  operationalDate: string;
  page: number;
  pageSize: number;
  total: number;
  items: AuditLog[];
}

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function QualityAuditScreen({ organizationId, branchId }: { organizationId?: string; branchId?: string }) {
  const params = new URLSearchParams({ period: "today" });
  if (organizationId) params.set("organizationId", organizationId);
  if (branchId) params.set("branchId", branchId);
  const { data: snapshot, loading, error } = useQualityQuery<QualitySnapshot>(params.toString());
  const [selectedBranch, setSelectedBranch] = useState(branchId ?? "");
  const [date, setDate] = useState(localDate);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeBranch = selectedBranch || snapshot?.selectedBranchId || snapshot?.branches[0]?.id || "";
  const organization = snapshot?.organization.id ?? "";

  async function search(page = 1) {
    if (!organization || !activeBranch || !date) return;
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const query = new URLSearchParams({ organizationId: organization, branchId: activeBranch, date, page: String(page) });
      const response = await fetch(`/api/customer/quality/audit?${query.toString()}`, { credentials: "same-origin", cache: "no-store" });
      const payload: { data?: AuditResult; error?: string } = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "No fue posible consultar el archivo.");
      setResult(payload.data);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "No fue posible buscar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#edf4f7] p-4 text-[#16344c] sm:p-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={organization ? `/app/calidad?organizationId=${encodeURIComponent(organization)}` : "/app/calidad"} className="inline-flex items-center rounded-xl py-2 text-sm font-bold underline">Volver al Centro de Calidad</Link>
      <section className="rounded-3xl bg-[#0b2e4b] p-6 text-white">
        <div className="flex items-center gap-3"><ShieldCheck aria-hidden="true" /><h1 className="text-2xl font-black">Modo auditoría · Bitácoras</h1></div>
        <p className="mt-3 text-sm leading-6 text-[#d1e1eb]">Consulta histórica de solo lectura. Selecciona fecha y sucursal para encontrar registros existentes y descargar su PDF. Cada exportación registra usuario, fecha y documento.</p>
      </section>
      {loading && <p role="status">Verificando acceso y sucursales autorizadas…</p>}
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>}
      {snapshot && !snapshot.capabilities.exportReports && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">Tu cuenta no tiene permiso para consultar el modo auditoría.</p>}
      {snapshot?.capabilities.exportReports && <section className="rounded-2xl border border-[#d5e4eb] bg-white p-5">
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void search(1); }}>
          <label className="grid gap-2 text-sm font-semibold">Sucursal
            <select className="h-12 rounded-xl border border-[#bdcdd8] bg-white px-3" value={activeBranch} onChange={(event) => { setSelectedBranch(event.target.value); setResult(null); }}>
              {snapshot.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Fecha operativa
            <input type="date" required className="h-12 rounded-xl border border-[#bdcdd8] bg-white px-3" value={date} onChange={(event) => { setDate(event.target.value); setResult(null); }}/>
          </label>
          <button type="submit" disabled={busy || !activeBranch || !date} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0b7775] px-5 font-bold text-white disabled:opacity-50"><Search size={18} aria-hidden="true" />{busy ? "Consultando…" : "Buscar"}</button>
        </form>
        {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
      </section>}
      {result && <section className="space-y-3" aria-live="polite">
        <h2 className="text-lg font-black">{result.total} registro(s) para {result.operationalDate}</h2>
        {result.total === 0 && <p className="rounded-xl bg-white p-4">No existen bitácoras guardadas para esta fecha y sucursal. Esto no acredita que se hayan realizado los controles.</p>}
        {result.items.map((item) => <article key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#d5e4eb] bg-white p-4 sm:flex-row sm:items-center">
          <div><h3 className="font-bold">{item.templateName}</h3><p className="mt-1 text-xs text-[#526b7d]">{item.branchName} · Estado: {item.status} · Revisión {item.revisionNumber}</p><p className="mt-1 text-xs text-[#526b7d]">Vencimiento programado: {new Date(item.dueAt).toLocaleString("es-MX")}</p></div>
          <a className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#0b7775] px-4 text-sm font-bold text-[#0b7775]" href={`/api/customer/quality/export?organizationId=${encodeURIComponent(organization)}&logId=${encodeURIComponent(item.id)}&format=pdf`}><Download size={16} aria-hidden="true" />Descargar PDF</a>
        </article>)}
        {result.total > result.pageSize && <div className="flex items-center justify-between gap-3 py-3">
          <button className="rounded-xl border bg-white px-4 py-2 font-semibold disabled:opacity-50" disabled={busy || result.page <= 1} onClick={() => void search(result.page - 1)}>Anterior</button>
          <span className="text-sm">Página {result.page} de {Math.ceil(result.total / result.pageSize)}</span>
          <button className="rounded-xl border bg-white px-4 py-2 font-semibold disabled={busy || result.page * result.pageSize >= result.total} onClick={() => void search(result.page + 1)}>Siguiente</button>
        </div>}
      </section>}
      <p className="text-xs">Este módulo no modifica registros ni certifica el cumplimiento sanitario. El alcance de consulta depende de los permisos y sucursales autorizadas.</p>
    </div>
  </main>;
}
