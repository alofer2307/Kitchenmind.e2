"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { DataTable } from "@/components/shared/data-table";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditEvents, useBranches, useUsers } from "@/hooks/use-kitchenmind-data";
import { filterAuditEvents, getAuditActionLabel } from "@/services/activity.service";
import { formatDateTime } from "@/utils/date";

export function ActivityScreen() {
  const { data: events } = useAuditEvents();
  const { data: branches } = useBranches();
  const { data: users } = useUsers();
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("all");
  const [category, setCategory] = useState("all");
  const filtered = useMemo(() => filterAuditEvents(events, { query, branchId: branchId === "all" ? undefined : branchId, category: category === "all" ? undefined : category }), [events, query, branchId, category]);
  const criticalCount = events.filter((event) => event.action.includes("manual") || event.action.includes("override") || event.action.includes("deactivated")).length;

  return <AdminShell><div className="space-y-6"><PageHeading eyebrow="Trazabilidad" title="Actividad" description="Las acciones críticas conservan quién, qué, dónde, cuándo y por qué." action={<div className="flex items-center gap-2 rounded-xl border border-[#cae9e8] bg-[#effbf9] px-4 py-2 text-sm font-bold text-[#167a72]"><ShieldCheck className="size-4" />{criticalCount} acciones críticas</div>} /><div className="grid gap-3 rounded-[1.3rem] border border-[#dbe7f2] bg-white p-4 md:grid-cols-[minmax(240px,1fr)_220px_220px]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8091a3]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar acción, entidad o motivo" className="h-11 rounded-xl pl-9" /></div><Select value={branchId} onValueChange={setBranchId}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las sucursales</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select><Select value={category} onValueChange={setCategory}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las categorías</SelectItem><SelectItem value="employee">Empleados</SelectItem><SelectItem value="shift">Turnos</SelectItem><SelectItem value="attendance">Asistencia</SelectItem><SelectItem value="service">Servicios</SelectItem><SelectItem value="purchase">Compras</SelectItem></SelectContent></Select></div><DataTable headers={["Fecha y hora", "Acción", "Sucursal", "Actor", "Entidad", "Motivo"]} rows={filtered.map((event) => [formatDateTime(event.timestamp), <Badge key={`${event.id}-action`} variant="secondary" className="whitespace-nowrap">{getAuditActionLabel(event.action)}</Badge>, branches.find((branch) => branch.id === event.branchId)?.name ?? "Organización", users.find((user) => user.id === event.actorId)?.name ?? event.actorId, event.entity, event.reason ?? "—"])} /></div></AdminShell>;
}
