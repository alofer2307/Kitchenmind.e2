"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { CommercialError, CommercialLoading, formatPlatformDate } from "@/components/platform/commercial-shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCommercialQuery } from "@/hooks/use-commercial";
import type { CustomerQuoteView } from "@/types";
import { formatMinorMoney } from "@/utils/money";

export function QuotePrintScreen({ quoteId }: { quoteId: string }) {
  const { data, error, loading, refresh } = useCommercialQuery<CustomerQuoteView>(`view=quote_customer&id=${encodeURIComponent(quoteId)}`);
  if (loading && !data) return <CommercialLoading label="Preparando cotización para imprimir…" />;
  if (error || !data) return <CommercialError message={error ?? "Cotización no disponible."} onRetry={() => void refresh()} />;
  const version = data.version;
  return <div className="quote-print mx-auto max-w-5xl space-y-5">
    <div className="no-print flex items-center justify-between gap-3"><Button asChild variant="ghost"><Link href={`/platform/cotizaciones/${data.id}`}><ArrowLeft className="size-4" />Volver</Link></Button><Button onClick={() => window.print()}><Printer className="size-4" />Imprimir o guardar PDF</Button></div>
    <Card className="rounded-[1.4rem] border-[#dbe7f2] shadow-none"><CardContent className="p-7 sm:p-10">
      <div className="flex flex-col justify-between gap-6 border-b border-[#dbe7f2] pb-7 sm:flex-row sm:items-start"><div><BrandMark /><p className="mt-4 max-w-md text-sm leading-6 text-[#6a7e94]">Sistema operativo digital configurable para operaciones de alimentos.</p></div><div className="text-left sm:text-right"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#169b99]">Cotización</p><p className="mt-1 text-2xl font-black text-[#183451]">{data.quoteNumber}</p><p className="mt-2 text-sm text-[#6a7e94]">Fecha {formatPlatformDate(data.createdAt, false)} · Revisión {version.versionNumber}<br />Vigente hasta {formatPlatformDate(version.validUntil, false)}</p></div></div>
      <div className="grid gap-6 py-7 sm:grid-cols-2"><div><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#8193a6]">Preparada para</p><h1 className="mt-2 text-2xl font-black text-[#183451]">{data.legalName || data.prospectName}</h1><p className="mt-2 text-sm text-[#546d84]">{data.contactName}<br />{data.contactEmail}<br />{data.contactPhone}</p></div><div className="rounded-2xl bg-[#edf6ff] p-5 sm:text-right"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#5e7893]">Inversión recurrente</p><p className="mt-2 text-3xl font-black text-[#1769e0]">{formatMinorMoney(version.billingCycle === "annual" ? version.annualTotalMinor : version.monthlyTotalMinor, version.currency)}</p><p className="mt-1 text-sm font-bold text-[#56718c]">por {version.billingCycle === "annual" ? "año" : "mes"} · impuestos incluidos</p>{version.billingCycle === "annual" && <p className="mt-2 text-xs text-[#60758b]">Equivalente mensual: {formatMinorMoney(version.monthlyTotalMinor, version.currency)}</p>}{version.totalOneTimeMinor > 0 && <p className="mt-3 text-sm text-[#546d84]">Implementación: <strong>{formatMinorMoney(version.totalOneTimeMinor, version.currency)}</strong></p>}</div></div>
      <div className="space-y-3"><h2 className="text-lg font-black text-[#183451]">Solución propuesta</h2>{version.lines.map((line) => <div key={line.code} className="grid gap-2 border-b border-[#e4ecf3] py-3 sm:grid-cols-[1fr_170px]"><div><p className="font-bold text-[#314b65]">{line.description}</p><p className="mt-1 text-xs leading-5 text-[#71869a]">{line.explanation}</p></div><p className="text-left font-black text-[#314b65] sm:text-right">{formatMinorMoney(line.totalMinor, version.currency)}{line.billingPeriod === "monthly" ? " / mes" : line.billingPeriod === "annual" ? " / año" : ""}</p></div>)}</div>
      <div className="mt-7 grid gap-3 rounded-2xl bg-[#f7fafc] p-5 sm:grid-cols-2 lg:grid-cols-4"><QuoteAmount label="Subtotal único" value={formatMinorMoney(version.subtotalOneTimeMinor, version.currency)} /><QuoteAmount label="Subtotal recurrente" value={formatMinorMoney(version.subtotalRecurringMinor, version.currency)} /><QuoteAmount label="Descuentos" value={`− ${formatMinorMoney(version.discountTotalMinor, version.currency)}`} /><QuoteAmount label="Impuestos" value={formatMinorMoney(version.taxTotalMinor, version.currency)} /></div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2"><div><h2 className="text-sm font-black text-[#183451]">Notas</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#60758b]">{version.customerNotes || "KitchenMind configurará la solución según el alcance descrito."}</p></div><div><h2 className="text-sm font-black text-[#183451]">Condiciones comerciales</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#60758b]">{version.commercialTerms}</p></div></div>
      <div className="mt-8 rounded-2xl border border-[#bfe7e2] bg-[#f4fffd] p-5"><p className="font-extrabold text-[#183451]">Resumen de primer pago estimado</p><p className="mt-1 text-2xl font-black text-[#0b8c83]">{formatMinorMoney(version.firstPaymentMinor, version.currency)}</p><p className="mt-1 text-xs leading-5 text-[#60758b]">El importe final depende de aceptación, vigencia, alcance confirmado y condiciones fiscales aplicables.</p></div>
      <div className="mt-6 rounded-2xl border border-[#dbe7f2] p-5"><h2 className="text-sm font-black text-[#183451]">Próximos pasos</h2><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#60758b]"><li>Confirmar alcance, cantidades y responsables.</li><li>Registrar la aceptación dentro de la vigencia.</li><li>Acordar fecha de implementación y carga inicial de datos.</li></ol></div>
      <p className="mt-8 text-center text-xs text-[#8193a6]">KitchenMind · Mi trabajo es ayudarte a tomar mejores decisiones.</p>
    </CardContent></Card>
  </div>;
}

function QuoteAmount({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-[#7a8da3]">{label}</p><p className="mt-1 font-black text-[#314b65]">{value}</p></div>; }
