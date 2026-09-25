"use client";

import { useCallback, useState } from "react";
import { Clock3, MapPin, UserRound } from "lucide-react";
import { ScannerInput, type ScannerFeedback } from "@/components/scanner";
import { KioskShell } from "./kiosk-shell";
import { ConnectionBadge } from "./connection-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataProvider } from "@/contexts/data-provider-context";
import { useBranches, useCurrentOrganization } from "@/hooks/use-kitchenmind-data";
import { processAttendanceScan, type AttendanceScanResult } from "@/services/attendance.service";
import type { ScanAttempt } from "@/rules/scanner.rules";
import { formatTime } from "@/utils/date";
import { useOfflineState } from "@/contexts/offline-context";
import { getOrCreateDeviceId, useDeviceSetting } from "@/hooks/use-device-settings";

export function AttendanceKiosk() {
  const { provider } = useDataProvider();
  const { connected, enqueue } = useOfflineState();
  const { data: branches } = useBranches();
  const { data: organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const [savedBranchId, setBranchId] = useDeviceSetting("attendance.branch", "");
  const branchId = savedBranchId || branches.find((branch) => branch.status === "active")?.id || "";
  const [lastResult, setLastResult] = useState<AttendanceScanResult | null>(null);
  const scan = useCallback(async (attempt: ScanAttempt): Promise<ScannerFeedback> => {
    if (!organizationId || !branchId) throw new Error("Configura la organización y sucursal del dispositivo.");
    const result = await processAttendanceScan(provider, { organizationId, branchId, deviceId: getOrCreateDeviceId("attendance"), attempt, syncStatus: connected ? "synced" : "pending" });
    setLastResult(result);
    if (result.status === "unknown") return { kind: "unknown", title: "IDENTIFICADOR NO RECONOCIDO", message: "Revisa el gafete o solicita apoyo a supervisión." };
    if (result.status === "duplicate") return { kind: "duplicate", title: "ESCANEO REPETIDO", message: `${result.employee.name} ya tiene un registro reciente.` };
    if (!connected) await enqueue({ organizationId, branchId, entityType: "attendance", entityId: result.event.id, idempotencyKey: result.event.idempotencyKey });
    const titles = { entry: "ENTRADA REGISTRADA", exit: "SALIDA REGISTRADA", late: "RETARDO", manual_adjustment: "AJUSTE REGISTRADO" } as const;
    return { kind: connected ? "success" : "offline", title: titles[result.event.eventType], message: connected ? `${result.employee.name} · ${formatTime(result.event.timestamp)}` : `${result.employee.name} · Guardado localmente para sincronizar.` };
  }, [branchId, connected, enqueue, organizationId, provider]);

  return <KioskShell title="REGISTRO DE PERSONAL" instruction="Escanea tu gafete" status={<ConnectionBadge />}><div className="mx-auto mb-5 w-full max-w-sm text-left"><label className="mb-2 block text-sm font-bold text-[#60758b]">Sucursal del dispositivo</label><Select value={branchId} onValueChange={(value) => { setBranchId(value); setLastResult(null); }}><SelectTrigger className="h-12 w-full rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{branches.filter((branch) => branch.status === "active").map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div><ScannerInput onScan={scan} placeholder="Escanea el gafete y presiona Enter" />{lastResult && lastResult.status !== "unknown" && <ResultCard result={lastResult} />}</KioskShell>;
}

function ResultCard({ result }: { result: Exclude<AttendanceScanResult, { status: "unknown" }> }) {
  const label = result.status === "duplicate" ? "REGISTRO YA RECIBIDO" : result.event.eventType === "entry" ? "ENTRADA REGISTRADA" : result.event.eventType === "exit" ? "SALIDA REGISTRADA" : "RETARDO";
  return <div className="mx-auto mt-2 max-w-xl rounded-[1.4rem] border border-[#cfe4ee] bg-white p-5 text-left shadow-[0_18px_45px_rgba(24,52,81,.08)]"><div className="flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#e8f4ff] text-[#1769e0]"><UserRound className="size-7" /></div><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#14928f]">{label}</p><p className="truncate text-xl font-extrabold text-[#183451]">{result.employee.name}</p></div></div><div className="mt-5 grid gap-3 rounded-2xl bg-[#f6f9fc] p-4 sm:grid-cols-3"><Detail icon={MapPin} label="Sucursal" value={result.branch.name} /><Detail icon={Clock3} label="Turno" value={result.shift.name} /><Detail icon={Clock3} label="Hora" value={formatTime(result.event.timestamp)} /></div></div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="flex items-center gap-2"><Icon className="size-4 text-[#6a8298]" /><div><p className="text-xs font-semibold text-[#8293a4]">{label}</p><p className="text-sm font-bold text-[#314b65]">{value}</p></div></div>; }
