"use client";

import Link from "next/link";
import { ArrowRight, Boxes, CheckCircle2, Link2, Settings2 } from "lucide-react";
import { CommercialError, CommercialLoading } from "@/components/platform/commercial-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommercialQuery } from "@/hooks/use-commercial";
import type { CommercialModule } from "@/types";

export function CatalogScreen() {
  const { data, error, loading, refresh } = useCommercialQuery<CommercialModule[]>("view=catalog");
  if (loading && !data) return <CommercialLoading label="Cargando catálogo comercial…" />;
  if (error || !data) return <CommercialError message={error ?? "Catálogo no disponible."} onRetry={() => void refresh()} />;
  const activeFeatures = data.flatMap((module) => module.features).filter((feature) => feature.status === "active").length;
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">Configuración comercial</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Módulos y características</h1><p className="mt-2 max-w-2xl text-[#6a7e94]">Una sola plataforma: los perfiles recomiendan y los módulos contratados determinan la solución.</p></div><Button asChild className="rounded-xl"><Link href="/platform/precios">Abrir precios <ArrowRight className="size-4" /></Link></Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={Boxes} label="Módulos activos" value={data.filter((module) => module.status === "active").length} /><Metric icon={Settings2} label="Características" value={activeFeatures} /><Metric icon={Link2} label="Dependencias" value={data.reduce((sum, module) => sum + module.dependencies.length, 0)} /></div>
    <div className="grid gap-4 lg:grid-cols-2">{data.map((module) => <Card key={module.id} className="rounded-[1.4rem] border-[#dbe7f2]"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge className="bg-[#e8f2ff] text-[#1769e0]">{module.category}</Badge>{module.code === "core" && <Badge className="bg-[#e4faf4] text-[#087c65]">Obligatorio</Badge>}</div><CardTitle className="mt-3">{module.name}</CardTitle></div><span className="text-xs font-bold text-[#8193a6]">v{module.version}</span></div><p className="text-sm leading-6 text-[#6a7e94]">{module.description}</p></CardHeader><CardContent><div className="space-y-2">{module.features.map((feature) => <div key={feature.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#e1eaf2] bg-[#f9fbfd] p-3"><div><p className="flex items-center gap-2 text-sm font-bold text-[#3a536b]"><CheckCircle2 className="size-4 text-[#12a099]" />{feature.name}</p><p className="mt-1 text-xs leading-5 text-[#71869a]">{feature.description}</p></div>{feature.billable && <Badge variant="outline" className="shrink-0">{feature.unitType}</Badge>}</div>)}</div>{module.dependencies.length > 0 && <p className="mt-4 text-xs font-bold text-[#6f8295]">Requiere: {module.dependencies.map((item) => item.toUpperCase()).join(", ")}</p>}</CardContent></Card>)}</div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: number }) { return <Card className="rounded-[1.3rem] border-[#dbe7f2]"><CardContent className="flex items-center gap-4 p-5"><div className="flex size-11 items-center justify-center rounded-xl bg-[#e8f2ff] text-[#1769e0]"><Icon className="size-5" /></div><div><p className="text-2xl font-black text-[#183451]">{value}</p><p className="text-sm font-bold text-[#63788e]">{label}</p></div></CardContent></Card>; }
