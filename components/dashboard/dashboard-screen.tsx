"use client";

import { AlertTriangle, CalendarCheck2, Clock3, PackageSearch, Soup, UserCheck, UserRoundX, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeading } from "@/components/shared/page-heading";
import { useDashboard } from "@/hooks/use-kitchenmind-data";
import { getKiroFindings } from "@/services/kiro.service";
import { formatDateTime } from "@/utils/date";

export function DashboardScreen() {
  const { data: snapshot, loading, error } = useDashboard();
  if (loading || !snapshot) return <DashboardSkeleton />;
  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-red-700">{error}</p>;
  const findings = getKiroFindings(snapshot);
  const activity = [
    ...snapshot.attendanceEvents.map((event) => ({ id: event.id, timestamp: event.timestamp, title: snapshot.employees.find((employee) => employee.id === event.employeeId)?.name ?? "Empleado", description: event.eventType === "entry" ? "Entrada registrada" : event.eventType === "exit" ? "Salida registrada" : event.eventType === "late" ? "Retardo registrado" : "Ajuste manual" })),
    ...snapshot.serviceEvents.map((event) => ({ id: event.id, timestamp: event.timestamp, title: snapshot.employees.find((employee) => employee.id === event.employeeId)?.name ?? "Comensal", description: `${snapshot.serviceTypes.find((type) => type.id === event.serviceTypeId)?.name ?? "Servicio"} registrado` })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 7);

  return (
    <div className="space-y-7">
      <PageHeading eyebrow="Vista consolidada" title="Operación de hoy" description="Los conteos cambian en cuanto ocurre un registro, sin capturas adicionales." />

      <SectionTitle title="Personal" detail="Cobertura calculada con los registros del día" />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Personal esperado" value={snapshot.metrics.expectedToday} detail="Empleados activos programados" icon={Users} />
        <MetricCard label="Presentes" value={snapshot.metrics.presentToday} detail="Entradas únicas confirmadas" icon={UserCheck} tone="teal" />
        <MetricCard label="Retardos" value={snapshot.metrics.lateToday} detail="Fuera de tolerancia configurada" icon={Clock3} tone={snapshot.metrics.lateToday ? "amber" : "teal"} />
        <MetricCard label="Ausencias" value={snapshot.metrics.absentToday} detail="Esperados sin registro de entrada" icon={UserRoundX} tone={snapshot.metrics.absentToday ? "red" : "teal"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <Card className="rounded-[1.4rem] border-[#dbe7f2] shadow-[0_12px_35px_rgba(24,52,81,.05)]">
          <CardHeader><div className="flex items-start justify-between"><div><CardTitle className="text-lg text-[#183451]">Servicios</CardTitle><p className="mt-1 text-sm text-[#718398]">Consumos registrados hoy</p></div><div className="text-right"><p className="text-4xl font-black tracking-[-0.05em] text-[#1769e0]">{snapshot.metrics.servicesToday}</p><p className="text-xs font-bold text-[#7c8ea1]">TOTAL</p></div></div></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">{snapshot.breakdowns.serviceTypes.map((type) => <div key={type.id} className="flex items-center justify-between rounded-2xl bg-[#f5f9fc] p-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-white text-[#0a9692]"><Soup className="size-4" /></div><p className="font-bold text-[#314b65]">{type.name}</p></div><p className="text-xl font-black text-[#183451]">{type.count}</p></div>)}</CardContent>
        </Card>

        <Card className="rounded-[1.4rem] border-[#dbe7f2] shadow-[0_12px_35px_rgba(24,52,81,.05)]">
          <CardHeader><CardTitle className="text-lg text-[#183451]">Desglose operativo</CardTitle></CardHeader>
          <CardContent><Tabs defaultValue="branch"><TabsList className="grid w-full grid-cols-4 rounded-xl"><TabsTrigger value="branch">Sucursal</TabsTrigger><TabsTrigger value="shift">Turno</TabsTrigger><TabsTrigger value="client">Cliente</TabsTrigger><TabsTrigger value="service">Servicio</TabsTrigger></TabsList><TabsContent value="branch" className="mt-4"><DataTable headers={["Sucursal", "Esperados", "Presentes", "Servicios"]} rows={snapshot.breakdowns.branches.map((item) => [item.name, item.expected, item.present, item.services])} /></TabsContent><TabsContent value="shift" className="mt-4"><DataTable headers={["Turno", "Esperados", "Presentes"]} rows={snapshot.breakdowns.shifts.map((item) => [item.name, item.expected, item.present])} /></TabsContent><TabsContent value="client" className="mt-4"><DataTable headers={["Cliente", "Empleados", "Servicios"]} rows={snapshot.breakdowns.clients.map((item) => [item.name, item.employees, item.services])} /></TabsContent><TabsContent value="service" className="mt-4"><DataTable headers={["Tipo", "Registros"]} rows={snapshot.breakdowns.serviceTypes.map((item) => [item.name, item.count])} /></TabsContent></Tabs></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.9fr]">
        <Card className="rounded-[1.4rem] border-[#dbe7f2] shadow-[0_12px_35px_rgba(24,52,81,.05)]">
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-lg text-[#183451]">Actividad reciente</CardTitle><p className="mt-1 text-sm text-[#718398]">Asistencia y servicios en orden cronológico.</p></div><Badge variant="secondary" className="bg-[#e3faf7] text-[#087f7d]">En vivo</Badge></CardHeader>
          <CardContent className="space-y-3">{activity.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[#f6f9fc] p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1769e0] shadow-sm"><CalendarCheck2 className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#203a57]">{item.title}</p><p className="text-sm text-[#72859a]">{item.description}</p></div><time className="hidden text-xs font-semibold text-[#8797a8] sm:block">{formatDateTime(item.timestamp)}</time></div>)}</CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[1.4rem] border-[#eadfbf] bg-[#fffdf7]"><CardHeader><CardTitle className="flex items-center gap-2 text-lg text-[#183451]"><AlertTriangle className="size-5 text-[#b9780b]" />Alertas</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3"><AlertCount label="Duplicados" value={snapshot.alerts.duplicates} /><AlertCount label="Eventos manuales" value={snapshot.alerts.manualEvents} /><AlertCount label="Incidencias" value={snapshot.alerts.incidents} /><AlertCount label="Pendientes" value={snapshot.alerts.pending} /></CardContent></Card>
          <Card className="overflow-hidden rounded-[1.4rem] border-[#cae9e8] bg-gradient-to-br from-white to-[#effcfb]"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-lg text-[#183451]">Kiro</CardTitle><p className="text-sm text-[#718398]">Encontré algo que vale la pena revisar.</p></div><PackageSearch className="size-6 text-[#088e8a]" /></div></CardHeader><CardContent><p className="text-sm font-bold text-[#1e405e]">Qué encontré.</p><p className="mt-1 text-sm leading-5 text-[#5f758b]">{findings[0]?.found}</p><p className="mt-3 text-sm font-bold text-[#1e405e]">Qué recomiendo.</p><p className="mt-1 text-sm leading-5 text-[#5f758b]">{findings[0]?.recommendation}</p></CardContent></Card>
        </div>
      </section>

      <SectionTitle title="Inventario y abastecimiento" detail="Señales preventivas del núcleo operativo" />
      <section className="grid gap-4 sm:grid-cols-2"><MetricCard label="Productos bajo mínimo" value={snapshot.metrics.lowStockProducts} detail="Calculado con existencias de lote" icon={PackageSearch} tone={snapshot.metrics.lowStockProducts ? "red" : "teal"} /><MetricCard label="Compras pendientes" value={snapshot.metrics.pendingPurchases} detail="Sugeridas, aprobadas o en tránsito" icon={AlertTriangle} tone={snapshot.metrics.pendingPurchases ? "amber" : "teal"} /></section>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) { return <div><h2 className="text-lg font-extrabold text-[#183451]">{title}</h2><p className="mt-1 text-sm text-[#718398]">{detail}</p></div>; }
function AlertCount({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-[#eee5ca] bg-white p-4"><p className="text-2xl font-black text-[#183451]">{value}</p><p className="mt-1 text-xs font-bold text-[#74869a]">{label}</p></div>; }
function DashboardSkeleton() { return <div className="space-y-7"><Skeleton className="h-20 w-full rounded-2xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-48 rounded-[1.35rem]" />)}</div><Skeleton className="h-96 rounded-[1.4rem]" /></div>; }
