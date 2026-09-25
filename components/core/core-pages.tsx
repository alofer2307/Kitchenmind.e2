"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/layout/admin-shell";
import { DataTable } from "@/components/shared/data-table";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDataProvider } from "@/contexts/data-provider-context";
import { useBranches, useCurrentOrganization, useDashboard, useInventoryLots, useProducts, usePurchaseOrders, useQualityTemplates, useSuppliers } from "@/hooks/use-kitchenmind-data";
import { getKiroFindings } from "@/services/kiro.service";
import { formatDateTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { MODULE_LABELS } from "@/constants/modules";

function PageFrame({ children }: { children: React.ReactNode }) {
  return <AdminShell><div className="space-y-6">{children}</div></AdminShell>;
}

export function BranchesPage() {
  const { data } = useBranches();
  return <PageFrame><PageHeading eyebrow="Configuración operativa" title="Sucursales" description="Cada planta conserva sus propios datos sin perder la vista consolidada de la organización." /><DataTable headers={["Sucursal", "Código", "Zona horaria", "Estado"]} rows={data.map((branch) => [branch.name, branch.code, branch.timezone, <Badge key={branch.id} className="bg-[#e4faf4] text-[#087c65]">Activa</Badge>])} /></PageFrame>;
}

export function InventoryPage() {
  const { data: products } = useProducts();
  const { data: lots } = useInventoryLots();
  const { data: branches } = useBranches();
  return <PageFrame><PageHeading eyebrow="Inventario" title="Existencias por lote" description="Base preparada para entradas, salidas, caducidades y rotación PEPS/FEFO configurable." /><DataTable headers={["Producto", "Sucursal", "Lote", "Cantidad", "Ubicación", "Caducidad"]} rows={lots.map((lot) => [products.find((item) => item.id === lot.productId)?.name ?? "Producto", branches.find((item) => item.id === lot.branchId)?.name ?? "Sucursal", lot.id.replace("lot-", "").toUpperCase(), `${lot.quantity} ${lot.unit}`, lot.location, lot.expiresAt ? formatDateTime(lot.expiresAt) : "Sin caducidad"])} /></PageFrame>;
}

export function PurchasesPage() {
  const { data: orders } = usePurchaseOrders();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  return <PageFrame><PageHeading eyebrow="Abastecimiento" title="Compras" description="Cada sugerencia conserva el motivo para que la decisión pueda revisarse." /><DataTable headers={["Proveedor", "Producto", "Cantidad", "Importe", "Estado", "Motivo"]} rows={orders.flatMap((order) => order.lines.map((line) => [suppliers.find((item) => item.id === order.supplierId)?.name ?? "Proveedor", products.find((item) => item.id === line.productId)?.name ?? "Producto", `${line.quantity} ${line.unit}`, formatMoney(line.quantity * line.unitCost), order.status, line.reason]))} /></PageFrame>;
}

export function QualityPage() {
  const { data } = useQualityTemplates();
  return <PageFrame><PageHeading eyebrow="Inocuidad" title="Plantillas de calidad" description="La arquitectura almacena valores estructurados y puede abrir una incidencia cuando un parámetro queda fuera de rango." /><div className="grid gap-4 lg:grid-cols-2">{data.map((template) => <Card key={template.id} className="rounded-[1.35rem] border-[#dbe7f2]"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg text-[#183451]">{template.name}</CardTitle><p className="mt-1 text-sm text-[#718398]">{template.area} · {template.frequency}</p></div><Badge variant="secondary">{template.category}</Badge></div></CardHeader><CardContent>{template.fields.map((field) => <div key={field.id} className="rounded-2xl bg-[#f6f9fc] p-4"><p className="font-bold text-[#314b65]">{field.label}</p><p className="mt-1 text-sm text-[#718398]">Tipo: {field.type}{field.unit ? ` · ${field.unit}` : ""}{field.minimum !== undefined && field.maximum !== undefined ? ` · Rango ${field.minimum}–${field.maximum}` : ""}</p></div>)}</CardContent></Card>)}</div></PageFrame>;
}

export function KiroPage() {
  const { data } = useDashboard();
  const findings = data ? getKiroFindings(data) : [];
  return <PageFrame><PageHeading eyebrow="Asesor Estratégico de Operación" title="Kiro" description="Mi trabajo es ayudarte a tomar mejores decisiones." /><div className="grid gap-4 lg:grid-cols-2">{findings.map((finding) => <Card key={finding.id} className="rounded-[1.35rem] border-[#cfe9e7]"><CardContent className="space-y-4 p-6"><div><p className="font-extrabold text-[#183451]">Qué encontré.</p><p className="mt-1 text-[#5f758b]">{finding.found}</p></div><div><p className="font-extrabold text-[#183451]">Por qué importa.</p><p className="mt-1 text-[#5f758b]">{finding.importance}</p></div><div><p className="font-extrabold text-[#183451]">Qué recomiendo.</p><p className="mt-1 text-[#5f758b]">{finding.recommendation}</p></div></CardContent></Card>)}</div><p className="text-right text-sm font-bold text-[#168e8b]">Cambio y fuera.</p></PageFrame>;
}

export function SettingsPage() {
  const { data: organization } = useCurrentOrganization();
  const { provider } = useDataProvider();
  const reset = () => { provider.reset(); toast.success("Los datos demo fueron restaurados."); };
  return <PageFrame><PageHeading eyebrow="Administración" title="Configuración" description="Identidad operativa, módulos activos y avance del onboarding." /><div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><Card className="rounded-[1.35rem] border-[#dbe7f2]"><CardHeader><CardTitle className="text-lg text-[#183451]">{organization?.name ?? "Organización"}</CardTitle></CardHeader><CardContent><div className="grid gap-3 rounded-2xl bg-[#f6f9fc] p-4 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase text-[#8292a3]">País</p><p className="mt-1 font-bold text-[#314b65]">{organization?.countryCode ?? "—"}</p></div><div><p className="text-xs font-bold uppercase text-[#8292a3]">Zona horaria</p><p className="mt-1 font-bold text-[#314b65]">{organization?.timezone ?? "—"}</p></div><div><p className="text-xs font-bold uppercase text-[#8292a3]">Onboarding</p><p className="mt-1 font-bold text-[#314b65]">{organization?.onboardingStatus === "ready" ? "Completo" : "En configuración"}</p></div></div><p className="mt-5 text-sm font-bold text-[#60758b]">Módulos activos</p><div className="mt-3 flex flex-wrap gap-2">{organization?.activeModules.map((module) => <Badge key={module} variant="secondary" className="px-3 py-1.5">{MODULE_LABELS[module]}</Badge>)}</div></CardContent></Card><Card className="rounded-[1.35rem] border-[#dbe7f2]"><CardHeader><CardTitle className="text-lg text-[#183451]">Entorno demostrativo</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-[#6a7e94]">Los clientes creados desde KitchenMind Platform se guardan en este navegador durante esta etapa. La migración productiva sustituirá esta capa por Supabase sin cambiar las pantallas.</p><Button variant="outline" className="mt-5 rounded-xl" onClick={reset}><RotateCcw className="size-4" />Restaurar toda la demostración</Button></CardContent></Card></div></PageFrame>;
}
