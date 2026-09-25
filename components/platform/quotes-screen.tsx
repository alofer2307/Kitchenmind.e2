"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FilePlus2, NotebookTabs, Search } from "lucide-react";
import { CommercialError, CommercialLoading, StatusBadge, formatPlatformDate } from "@/components/platform/commercial-shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommercialQuery } from "@/hooks/use-commercial";
import type { QuoteSummary } from "@/types";
import { formatMinorMoney } from "@/utils/money";

export function QuotesScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [validity, setValidity] = useState("all");
  const [businessType, setBusinessType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const params = new URLSearchParams({ view: "quotes" });
  if (search.trim()) params.set("query", search.trim());
  if (status !== "all") params.set("status", status);
  if (currencyFilter !== "all") params.set("currency", currencyFilter);
  if (validity !== "all") params.set("validity", validity);
  if (businessType !== "all") params.set("businessType", businessType);
  if (dateFrom) params.set("dateFrom", new Date(`${dateFrom}T00:00:00`).toISOString());
  if (dateTo) params.set("dateTo", new Date(`${dateTo}T23:59:59`).toISOString());
  const { data, error, loading, refresh } = useCommercialQuery<QuoteSummary[]>(params.toString());
  if (loading && !data) return <CommercialLoading label="Cargando cotizaciones…" />;
  if (error || !data) return <CommercialError message={error ?? "Cotizaciones no disponibles."} onRetry={() => void refresh()} />;
  const active = data.filter((quote) => ["ready", "sent", "viewed"].includes(quote.status));
  const accepted = data.filter((quote) => quote.status === "accepted");
  const currency = data[0]?.currency ?? "MXN";
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">Propuestas comerciales</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Cotizaciones</h1><p className="mt-2 max-w-2xl text-[#6a7e94]">Folios únicos, versiones inmutables, cálculos explicables e historial completo.</p></div><Button asChild className="h-11 rounded-xl"><Link href="/platform/cotizaciones/nueva"><FilePlus2 className="size-4" />Nueva cotización</Link></Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Cotizaciones" value={String(data.length)} detail="Todas las revisiones se conservan" /><Metric label="En seguimiento" value={String(active.length)} detail={formatMinorMoney(active.reduce((sum, item) => sum + item.monthlyTotalMinor, 0), currency) + " / mes"} /><Metric label="Aceptadas" value={String(accepted.length)} detail={formatMinorMoney(accepted.reduce((sum, item) => sum + item.monthlyTotalMinor, 0), currency) + " de mensualidad aceptada"} /></div>
    <Card className="rounded-[1.4rem] border-[#dbe7f2]"><CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.6fr_repeat(4,1fr)_140px_140px]"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-[#8497aa]" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Folio, empresa o contacto" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{["draft","ready","sent","viewed","accepted","rejected","expired","cancelled"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select value={validity} onValueChange={setValidity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda vigencia</SelectItem><SelectItem value="active">Vigentes</SelectItem><SelectItem value="expired">Vencidas</SelectItem></SelectContent></Select><Select value={currencyFilter} onValueChange={setCurrencyFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda moneda</SelectItem>{[...new Set(data.map((quote) => quote.currency))].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select value={businessType} onValueChange={setBusinessType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todo perfil</SelectItem><SelectItem value="restaurant">Restaurante</SelectItem><SelectItem value="industrial_canteen">Comedor industrial</SelectItem><SelectItem value="street_food">Puesto o taquería</SelectItem><SelectItem value="cafe">Cafetería</SelectItem><SelectItem value="institutional">Institucional</SelectItem></SelectContent></Select><Input type="date" aria-label="Desde" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input type="date" aria-label="Hasta" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></CardContent></Card>
    {data.length ? <div className="grid gap-3">{data.map((quote) => <Link key={quote.id} href={`/platform/cotizaciones/${quote.id}`} className="group grid gap-4 rounded-[1.4rem] border border-[#dbe7f2] bg-white p-5 transition hover:border-[#a9caec] sm:grid-cols-[180px_1fr_220px_180px_auto] sm:items-center"><div><p className="font-black text-[#183451]">{quote.quoteNumber}</p><p className="mt-1 text-xs text-[#7b8da0]">Versión {quote.currentVersionNumber}</p></div><div><p className="font-extrabold text-[#314b65]">{quote.prospectName}</p><p className="mt-1 text-sm text-[#71869a]">Vigente hasta {formatPlatformDate(quote.validUntil, false)}</p></div><div><p className="text-lg font-black text-[#1769e0]">{formatMinorMoney(quote.monthlyTotalMinor, quote.currency)} / mes</p><p className="text-xs text-[#7b8da0]">Único {formatMinorMoney(quote.oneTimeTotalMinor, quote.currency)}</p></div><StatusBadge status={quote.status} /><ArrowRight className="hidden size-5 text-[#8aa0b4] transition group-hover:translate-x-1 group-hover:text-[#1769e0] sm:block" /></Link>)}</div> : <Card className="rounded-[1.4rem] border-dashed border-[#cbdce9]"><CardContent className="p-10 text-center"><NotebookTabs className="mx-auto size-8 text-[#1769e0]" /><h2 className="mt-4 text-xl font-black text-[#183451]">Aún no hay cotizaciones</h2><p className="mt-2 text-sm text-[#6a7e94]">Primero publica un catálogo de precios y registra un prospecto.</p><Button asChild className="mt-5"><Link href="/platform/cotizaciones/nueva"><FilePlus2 className="size-4" />Crear cotización</Link></Button></CardContent></Card>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <Card className="rounded-[1.3rem] border-[#dbe7f2]"><CardContent className="p-5"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#7a8da3]">{label}</p><p className="mt-2 text-3xl font-black text-[#183451]">{value}</p><p className="mt-1 text-xs text-[#71869a]">{detail}</p></CardContent></Card>; }
