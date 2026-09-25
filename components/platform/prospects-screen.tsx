"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Plus, Search, UsersRound } from "lucide-react";
import { CommercialError, CommercialLoading, PROSPECT_STATUS_LABELS, StatusBadge, formatPlatformDate } from "@/components/platform/commercial-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommercialQuery } from "@/hooks/use-commercial";
import type { ProspectStatus, ProspectSummary } from "@/types";

interface Result { items: ProspectSummary[]; total: number; page: number; pageSize: number }

export function ProspectsScreen() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [followUp, setFollowUp] = useState("all");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const requestQuery = useMemo(() => {
    const params = new URLSearchParams({ view: "prospects", page: String(page), pageSize: "20", sort });
    if (query.trim()) params.set("query", query.trim());
    if (status !== "all") params.set("status", status);
    if (followUp !== "all") params.set("followUp", followUp);
    return params.toString();
  }, [followUp, page, query, sort, status]);
  const { data, error, loading, refresh } = useCommercialQuery<Result>(requestQuery);
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">Proceso comercial</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Prospectos y oportunidades</h1><p className="mt-2 max-w-2xl text-[#6a7e94]">Información durable, seguimientos claros y cero recaptura hacia diagnóstico y cotización.</p></div>
      <Button asChild className="h-11 rounded-xl"><Link href="/platform/prospectos/nuevo"><Plus className="size-4" />Nuevo prospecto</Link></Button>
    </div>
    <Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(260px,1fr)_180px_180px_180px]">
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-[#8193a6]" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Empresa, contacto, correo o teléfono" /></div>
      <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{Object.entries(PROSPECT_STATUS_LABELS).filter(([key]) => key !== "archived").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
      <Select value={followUp} onValueChange={(value) => { setFollowUp(value); setPage(1); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Cualquier seguimiento</SelectItem><SelectItem value="overdue">Seguimientos vencidos</SelectItem><SelectItem value="upcoming">Próximos</SelectItem></SelectContent></Select>
      <Select value={sort} onValueChange={(value) => setSort(value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated">Última actualización</SelectItem><SelectItem value="created">Fecha de alta</SelectItem><SelectItem value="follow_up">Próxima acción</SelectItem></SelectContent></Select>
    </CardContent></Card>
    {loading && !data ? <CommercialLoading /> : error ? <CommercialError message={error} onRetry={() => void refresh()} /> : !data?.items.length ? <Card className="rounded-[1.4rem] border-dashed border-[#cbdce9]"><CardContent className="p-10 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#e8f2ff] text-[#1769e0]"><UsersRound className="size-6" /></div><h2 className="mt-4 text-xl font-black text-[#183451]">Aún no hay prospectos con estos filtros</h2><p className="mt-2 text-sm text-[#6a7e94]">Registra la primera oportunidad o ajusta los filtros.</p><Button asChild className="mt-5 rounded-xl"><Link href="/platform/prospectos/nuevo"><Plus className="size-4" />Registrar prospecto</Link></Button></CardContent></Card> : <>
      <div className="grid gap-3">
        {data.items.map((prospect) => <Link key={prospect.id} href={`/platform/prospectos/${prospect.id}`} className="group grid gap-4 rounded-[1.35rem] border border-[#dbe7f2] bg-white p-4 shadow-[0_8px_26px_rgba(24,52,81,.035)] transition hover:border-[#a9caec] sm:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_150px_190px_auto] sm:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-[#203a57]">{prospect.commercialName}</p><StatusBadge status={prospect.status as ProspectStatus} /></div><p className="mt-1 text-sm text-[#74879b]">{prospect.contactName} · {prospect.contactEmail}</p></div>
          <div><p className="text-sm font-bold text-[#314b65]">{prospect.businessType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#7b8da0]">{prospect.estimatedBranches} suc. · {prospect.estimatedEmployees} empleados</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8293a5]">Responsable</p><p className="mt-1 text-sm font-bold text-[#425a72]">{prospect.ownerName}</p></div>
          <div><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#8293a5]"><CalendarClock className="size-3.5" />Siguiente acción</p><p className="mt-1 line-clamp-1 text-sm font-bold text-[#425a72]">{prospect.nextAction}</p><p className="mt-0.5 text-xs text-[#7b8da0]">{formatPlatformDate(prospect.nextActionAt)}</p></div>
          <ArrowRight className="hidden size-5 text-[#8aa0b4] transition group-hover:translate-x-1 group-hover:text-[#1769e0] sm:block" />
        </Link>)}
      </div>
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#dbe7f2] bg-white px-4 py-3 sm:flex-row"><p className="text-sm text-[#6a7e94]"><strong className="text-[#314b65]">{data.total}</strong> oportunidades · página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div></div>
    </>}
    <div className="flex flex-wrap gap-2 text-xs text-[#7b8da0]"><Badge variant="outline">Persistencia D1</Badge><Badge variant="outline">Control de versión</Badge><Badge variant="outline">Sin datos ficticios</Badge></div>
  </div>;
}
