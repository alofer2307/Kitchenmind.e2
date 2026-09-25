"use client";

import { useState } from "react";
import { BadgeCheck, Pencil, Plus, Search, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/layout/admin-shell";
import { DataTable } from "@/components/shared/data-table";
import { PageHeading } from "@/components/shared/page-heading";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataProvider } from "@/contexts/data-provider-context";
import { useSession } from "@/contexts/session-context";
import { useBranches, useClients, useCurrentOrganization, useEmployees, useShifts } from "@/hooks/use-kitchenmind-data";
import { createEmployee, deactivateEmployee, updateEmployee, type EmployeeDraft } from "@/services/personnel.service";
import type { Branch, Employee, IdentifierType, InternalClient, Shift } from "@/types";

export function EmployeesScreen() {
  const { provider } = useDataProvider();
  const { userId } = useSession();
  const { data: branches } = useBranches();
  const { data: shifts } = useShifts();
  const { data: clients } = useClients();
  const { data: organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("all");
  const [shiftId, setShiftId] = useState("all");
  const [status, setStatus] = useState<"all" | Employee["status"]>("active");
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Employee | null>(null);
  const { data: employees, loading } = useEmployees({
    organizationId,
    branchId: branchId === "all" ? undefined : branchId,
    shiftId: shiftId === "all" ? undefined : shiftId,
    status: status === "all" ? undefined : status,
    query,
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeading eyebrow="Personal" title="Empleados" description="Altas, turnos e identificadores sin eliminar el historial operativo." action={<Button className="rounded-xl" disabled={!organizationId} onClick={() => setEditing(null)}><Plus className="size-4" />Nuevo empleado</Button>} />
        <div className="grid gap-3 rounded-[1.3rem] border border-[#dbe7f2] bg-white p-4 md:grid-cols-[minmax(220px,1fr)_220px_220px_170px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8091a3]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o número" className="h-11 rounded-xl pl-9" /></div>
          <Select value={branchId} onValueChange={setBranchId}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Sucursal" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las sucursales</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>
          <Select value={shiftId} onValueChange={setShiftId}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Turno" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los turnos</SelectItem>{shifts.map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
        </div>
        <DataTable
          headers={["Empleado", "Sucursal", "Turno", "Identificador", "Estado", "Acciones"]}
          emptyMessage={loading ? "Cargando empleados…" : "No hay empleados con estos filtros."}
          rows={employees.map((employee) => [
            <div key={`${employee.id}-name`}><p className="font-bold text-[#203a57]">{employee.name}</p><p className="text-xs text-[#7b8da0]">{employee.employeeNumber}</p></div>,
            branches.find((branch) => branch.id === employee.branchId)?.name ?? "Sucursal",
            shifts.find((shift) => shift.id === employee.shiftId)?.name ?? "Sin turno",
            employee.employeeIdentifier ? <div key={`${employee.id}-identifier`}><p className="font-mono text-xs font-bold">{employee.employeeIdentifier.value}</p><p className="text-xs uppercase text-[#7b8da0]">{employee.employeeIdentifier.type}</p></div> : <span key={`${employee.id}-none`} className="text-[#9aa8b6]">Sin asignar</span>,
            <Badge key={`${employee.id}-status`} className={employee.status === "active" ? "bg-[#e4faf4] text-[#087c65]" : "bg-[#eef1f4] text-[#667789]"}>{employee.status === "active" ? "Activo" : "Inactivo"}</Badge>,
            <div key={`${employee.id}-actions`} className="flex gap-2"><Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditing(employee)}><Pencil className="size-4" />Ficha</Button>{employee.status === "active" && <Button variant="ghost" size="icon-sm" className="text-[#b43d35]" onClick={() => setDeactivating(employee)} aria-label={`Desactivar a ${employee.name}`}><UserRoundX className="size-4" /></Button>}</div>,
          ])}
        />
      </div>
      {editing !== undefined && <EmployeeDialog organizationId={organizationId} employee={editing} branches={branches} shifts={shifts} clients={clients} onClose={() => setEditing(undefined)} />}
      {deactivating && <DeactivateEmployeeDialog employee={deactivating} onClose={() => setDeactivating(null)} onConfirm={async (reason) => { try { if (!userId) throw new Error("Inicia sesión para realizar esta acción."); await deactivateEmployee(provider, userId, deactivating.id, reason); toast.success("Empleado desactivado sin borrar su historial."); setDeactivating(null); } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible desactivar."); } }} />}
    </AdminShell>
  );
}

function EmployeeDialog({ organizationId, employee, branches, shifts, clients, onClose }: { organizationId: string; employee: Employee | null; branches: Branch[]; shifts: Shift[]; clients: InternalClient[]; onClose: () => void }) {
  const { provider } = useDataProvider();
  const { userId } = useSession();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EmployeeDraft>({
    organizationId,
    branchId: employee?.branchId ?? branches[0]?.id ?? "",
    employeeNumber: employee?.employeeNumber ?? "",
    name: employee?.name ?? "",
    photoUrl: employee?.photoUrl ?? "",
    shiftId: employee?.shiftId ?? shifts[0]?.id ?? "",
    clientId: employee?.clientId ?? "",
    identifierType: employee?.employeeIdentifier?.type ?? "qr",
    identifierValue: employee?.employeeIdentifier?.value ?? "",
  });
  const update = <K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    setSaving(true);
    try {
      if (!userId) throw new Error("Inicia sesión para guardar cambios.");
      if (employee) await updateEmployee(provider, userId, employee.id, draft);
      else await createEmployee(provider, userId, draft);
      toast.success(employee ? "Ficha actualizada." : "Empleado creado.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar.");
    } finally {
      setSaving(false);
    }
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-2xl"><DialogHeader><DialogTitle>{employee ? "Ficha del empleado" : "Nuevo empleado"}</DialogTitle><DialogDescription>Los campos de sucursal, turno e identificador alimentan los kioscos automáticamente.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Nombre completo"><Input value={draft.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="Número de empleado"><Input value={draft.employeeNumber} onChange={(event) => update("employeeNumber", event.target.value)} /></Field><Field label="Sucursal"><Select value={draft.branchId} onValueChange={(value) => update("branchId", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{branches.filter((branch) => branch.status === "active").map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Turno"><Select value={draft.shiftId} onValueChange={(value) => update("shiftId", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{shifts.filter((shift) => shift.status === "active").map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}</SelectItem>)}</SelectContent></Select></Field><Field label="Cliente"><Select value={draft.clientId || "none"} onValueChange={(value) => update("clientId", value === "none" ? "" : value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin cliente</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Foto (URL opcional)"><Input value={draft.photoUrl} onChange={(event) => update("photoUrl", event.target.value)} placeholder="https://…" /></Field><Field label="Tipo de identificador"><Select value={draft.identifierType} onValueChange={(value) => update("identifierType", value as IdentifierType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="qr">QR</SelectItem><SelectItem value="barcode">Código de barras</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></Field><Field label="Identificador"><Input value={draft.identifierValue} onChange={(event) => update("identifierValue", event.target.value)} placeholder="Ej. KM-N-007" className="font-mono" /></Field></div>{employee && <div className="flex items-center gap-2 rounded-xl bg-[#eef9f8] p-3 text-sm text-[#31706d]"><BadgeCheck className="size-4" />Creado el {new Date(employee.createdAt).toLocaleDateString("es-MX")}; nunca se elimina físicamente.</div>}<DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }

function DeactivateEmployeeDialog({ employee, onClose, onConfirm }: { employee: Employee; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desactivar a {employee.name}</AlertDialogTitle><AlertDialogDescription>Su historial permanecerá disponible. Escribe el motivo para dejar trazabilidad.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label>Motivo</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Baja del cliente" /></div><AlertDialogFooter><AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={!reason.trim()} onClick={(event) => { event.preventDefault(); void onConfirm(reason); }} className="bg-[#c83d33] hover:bg-[#a92f28]">Desactivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
