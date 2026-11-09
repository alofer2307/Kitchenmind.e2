"use client";

import Link from "next/link";
import { createElement as h, useState, type ChangeEvent, type FormEvent } from "react";
import { useQualityQuery } from "@/hooks/use-quality";
import type { QualitySnapshot } from "@/types";

interface AuditEntry {
  id: string;
  branchName: string;
  templateName: string;
  operationalDate: string;
  dueAt: string;
  status: string;
  revisionNumber: number;
}

interface AuditSearch {
  branchId: string;
  operationalDate: string;
  page: number;
  pageSize: number;
  total: number;
  items: AuditEntry[];
}

function localDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export function QualityAuditScreen({ organizationId, branchId }: { organizationId?: string; branchId?: string }) {
  const params = new URLSearchParams({ period: "today" });
  if (organizationId) params.set("organizationId", organizationId);
  if (branchId) params.set("branchId", branchId);
  const { data: snapshot, error, loading } = useQualityQuery<QualitySnapshot>(params.toString());
  const [selectedBranch, setSelectedBranch] = useState(branchId ?? "");
  const [date, setDate] = useState(localDate);
  const [result, setResult] = useState<AuditSearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeBranch = selectedBranch || snapshot?.selectedBranchId || snapshot?.branches[0]?.id || "";
  const organization = snapshot?.organization.id ?? "";

  async function search(page: number) {
    if (!organization || !activeBranch || !date) return;
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const query = new URLSearchParams({ organizationId: organization, branchId: activeBranch, date, page: String(page) });
      const response = await fetch("/api/customer/quality/audit?" + query.toString(), { credentials: "same-origin", cache: "no-store" });
      const payload: { data?: AuditSearch; error?: string } = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "No fue posible consultar el archivo.");
      setResult(payload.data);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "No fue posible buscar.");
    } finally {
      setBusy(false);
    }
  }

  const button = "rounded-xl bg-[#0b7775] px-4 py-3 text-sm font-bold text-white disabled:opacity-50";
  const field = "h-12 rounded-xl border border-[#bdcdd8] bg-white px-3";
  const card = "rounded-2xl border border-[#d5e4eb] bg-white p-5";

  return h("main", { className: "min-h-screen bg-[#edf4f7] p-4 text-[#16344c] sm:p-8" },
    h("div", { className: "mx-auto max-w-4xl space-y-5" },
      h(Link, { href: organization ? "/app/calidad?organizationId=" + encodeURIComponent(organization) : "/app/calidad", className: "inline-flex py-2 text-sm font-bold underline" }, "Volver al Centro de Calidad"),
      h("header", { className: "rounded-3xl bg-[#0b2e4b] p-6 text-white" },
        h("h1", { className: "text-2xl font-black" }, "Modo auditoría · Bitácoras"),
        h("p", { className: "mt-3 text-sm leading-6" }, "Busca por fecha y sucursal. Consulta de solo lectura con descarga de PDF y registro de exportaciones."),
      ),
      loading ? h("p", { role: "status" }, "Verificando sucursales autorizadas…") : null,
      error ? h("p", { role: "alert", className: card }, error) : null,
      snapshot && !snapshot.capabilities.exportReports ? h("p", { role: "alert", className: card }, "Sin permiso para acceder a modo auditoría.") : null,
      snapshot?.capabilities.exportReports ? h("section", { className: card },
        h("form", { className: "grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end", onSubmit: (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void search(1); } },
          h("label", { className: "grid gap-2 text-sm font-semibold" }, "Sucursal",
            h("select", { className: field, value: activeBranch, onChange: (event: ChangeEvent<HTMLSelectElement>) => { setSelectedBranch(event.target.value); setResult(null); } },
              ...snapshot.branches.map((branch) => h("option", { key: branch.id, value: branch.id }, branch.name)),
            ),
          ),
          h("label", { className: "grid gap-2 text-sm font-semibold" }, "Fecha operativa",
            h("input", { type: "date", required: true, value: date, className: field, onChange: (event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setResult(null); } }),
          ),
          h("button", { type: "submit", className: button, disabled: busy || !activeBranch || !date }, busy ? "Consultando…" : "Buscar"),
        ),
        message ? h("p", { role: "alert", className: "mt-3 text-sm text-red-700" }, message) : null,
      ) : null,
      result ? h("section", { className: "space-y-3", "aria-live": "polite" },
        h("h2", { className: "text-lg font-black" }, result.total + " registro(s) · " + result.operationalDate),
        result.total === 0 ? h("p", { className: card }, "No existen registros para esta fecha y sucursal. Esto no acredita que se haya realizado el control.") : null,
        ...result.items.map((item) => h("article", { key: item.id, className: card + " flex flex-col justify-between gap-3 sm:flex-row sm:items-center" },
          h("div", {},
            h("h3", { className: "font-bold" }, item.templateName),
            h("p", { className: "text-sm" }, item.branchName + " · " + item.status + " · Revisión " + item.revisionNumber),
          ),
          h("a", { className: "inline-flex rounded-xl border px-4 py-3 text-sm font-bold", href: "/api/customer/quality/export?organizationId=" + encodeURIComponent(organization) + "&logId=" + encodeURIComponent(item.id) + "&format=pdf" }, "Descargar PDF"),
        )),
        result.total > result.pageSize ? h("nav", { className: "flex items-center justify-between gap-3" },
          h("button", { className: button, disabled: busy || result.page <= 1, onClick: () => void search(result.page - 1) }, "Anterior"),
          h("span", {}, "Página " + result.page + " de " + Math.ceil(result.total / result.pageSize)),
          h("button", { className: button, disabled: busy || result.page * result.pageSize >= result.total, onClick: () => void search(result.page + 1) }, "Siguiente"),
        ) : null,
      ) : null,
      h("p", { className: "text-xs" }, "Este módulo no modifica registros ni constituye una certificación de cumplimiento sanitario."),
    ),
  );
}
