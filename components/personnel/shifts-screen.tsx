"use client";

import { useState } from "react";
import { Clock3, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataProvider } from "@/contexts/data-provider-context";
import { useSession } from "@/contexts/session-context";
import { useBranches, useCurrentOrganization, useShifts } from "@/hooks/use-kitchenmind-data";
import { createShift, updateShift, type ShiftDraft } from "@/services/personnel.service";
import type { Branch, Shift } from "@/types";

export function ShiftsScreen() {
  const { data: shifts } = useShifts();
  const { data: branches } = useBranches();
  const { data: organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const [editing, setEditing] = useState<Shift | null | undefined>(undefined);
  return <AdminShell><div className="space-y-6"><PageHeading eyebrow="Personal" title="Turnos" description="Horarios y tolerancias configurables por organización o sucursal." action={<Button className="rounded-xl" disabled={!organizationId} onClick={() => setEditing(null)}><Plus className="size-4" />Nuevo turno</Button>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shifts.map((shift) => <Card key={shift.id} className="rounded-[1.35rem] border-[#dbe7f2]"><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf3ff] text-[#1769e0]"><Clock3 className="size-5" /></div><Badge className={shift.status === "active" ? "bg-[#e4faf4] text-[#087c65]" : "bg-[#eef1f4] text-[#667789]"}>{shift.status === "active" ? "Activo" : "Inactivo"}</Badge></div><h2 className="mt-5 text-xl font-extrabold text-[#183451]">{shift.name}</h2><p className="mt-2 text-sm text-[#6a7e94]">{shift.startTime}–{shift.endTime} · {shift.toleranceMinutes} min de tolerancia</p><p className="mt-1 text-sm text-[#8292a3]">{shift.branchId ? branches.find((branch) => branch.id === shift.branchId)?.name : "Todas las sucursales"}</p><Button variant="outline" className="mt-5 w-full rounded-xl" onClick={() => setEditing(shift)}><Pencil className="size-4" />Editar configuración</Button></CardContent></Card>)}</div></div>{editing !== undefined && <ShiftDialog organizationId={organizationId} shift={editing} branches={branches} onClose={() => setEditing(undefined)} />}</AdminShell>;
}

function ShiftDialog({ organizationId, shift, branches, onClose }: { organizationId: string; shift: Shift | null; branches: Branch[]; onClose: () => void }) {
  const { provider } = useDataProvider();
  const { userId } = useSession();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ShiftDraft>({ organizationId, branchId: shift?.branchId, name: shift?.name ?? "", startTime: shift?.startTime ?? "06:00", endTime: shift?.endTime ?? "14:00", toleranceMinutes: shift?.toleranceMinutes ?? 10, status: shift?.status ?? "active" });
  const submit = async () => { setSaving(true); try { if (!userId) throw new Error("Inicia sesión para guardar cambios."); if (shift) await updateShift(provider, userId, shift.id, draft); else await createShift(provider, userId, draft); toast.success(shift ? "Turno actualizado." : "Turno creado."); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible guardar."); } finally { setSaving(false); } };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="rounded-2xl sm:max-w-lg"><DialogHeader><DialogTitle>{shift ? "Editar turno" : "Nuevo turno"}</DialogTitle><DialogDescription>El nombre, horario y tolerancia son datos configurables.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nombre</Label><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label>Hora de inicio</Label><Input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} /></div><div className="space-y-2"><Label>Hora de fin</Label><Input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} /></div><div className="space-y-2"><Label>Tolerancia (minutos)</Label><Input type="number" min={0} value={draft.toleranceMinutes} onChange={(event) => setDraft((current) => ({ ...current, toleranceMinutes: Number(event.target.value) }))} /></div><div className="space-y-2"><Label>Estado</Label><Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as Shift["status"] }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Sucursal</Label><Select value={draft.branchId ?? "all"} onValueChange={(value) => setDraft((current) => ({ ...current, branchId: value === "all" ? undefined : value }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las sucursales</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button></DialogFooter></DialogContent></Dialog>;
}
