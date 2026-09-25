"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CircleDollarSign, FilePenLine } from "lucide-react";
import { CommercialError, CommercialLoading, formatPlatformDate } from "@/components/platform/commercial-shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCommercialQuery } from "@/hooks/use-commercial";
import type { PriceBookSummary } from "@/types";

export function PriceBooksScreen() {
  const { data, error, loading, refresh } = useCommercialQuery<PriceBookSummary[]>("view=price_books");
  if (loading && !data) return <CommercialLoading label="Cargando catálogos de precios…" />;
  if (error || !data) return <CommercialError message={error ?? "Precios no disponibles."} onRetry={() => void refresh()} />;
  return <div className="space-y-6">
    <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">Pricing SaaS</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Catálogos versionados de precios</h1><p className="mt-2 max-w-3xl text-[#6a7e94]">Cada cotización conserva la versión exacta utilizada. Una versión publicada no puede editarse.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={CircleDollarSign} value={data.length} label="Catálogos" /><Metric icon={BookOpenCheck} value={data.filter((item) => item.activeVersionId).length} label="Con versión vigente" /><Metric icon={FilePenLine} value={data.filter((item) => item.draftVersionId).length} label="Borradores por revisar" /></div>
    <div className="grid gap-4">{data.map((book) => <Link key={book.id} href={`/platform/precios/${book.id}`} className="group grid gap-4 rounded-[1.4rem] border border-[#dbe7f2] bg-white p-5 transition hover:border-[#a9caec] sm:grid-cols-[1fr_180px_220px_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-extrabold text-[#183451]">{book.name}</p><Badge variant="outline">{book.currency}</Badge><Badge variant="outline">{book.countryCode ?? "Global"}</Badge></div><p className="mt-1 text-sm text-[#6a7e94]">Creado {formatPlatformDate(book.createdAt, false)}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.09em] text-[#8193a6]">Versión vigente</p><p className="mt-1 font-extrabold text-[#3d556d]">{book.activeVersionNumber ? `v${book.activeVersionNumber}` : "Sin publicar"}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.09em] text-[#8193a6]">Edición</p><p className="mt-1 font-extrabold text-[#3d556d]">{book.draftVersionNumber ? `Borrador v${book.draftVersionNumber}` : "Crear nueva revisión"}</p></div><ArrowRight className="hidden size-5 text-[#8aa0b4] transition group-hover:translate-x-1 group-hover:text-[#1769e0] sm:block" /></Link>)}</div>
  </div>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof CircleDollarSign; value: number; label: string }) { return <Card className="rounded-[1.3rem] border-[#dbe7f2]"><CardContent className="flex items-center gap-4 p-5"><div className="flex size-11 items-center justify-center rounded-xl bg-[#e8f2ff] text-[#1769e0]"><Icon className="size-5" /></div><div><p className="text-2xl font-black text-[#183451]">{value}</p><p className="text-sm font-bold text-[#63788e]">{label}</p></div></CardContent></Card>; }
