"use client";

import { useCallback, useState } from "react";
import { Building2, Clock3, Soup, UserRound } from "lucide-react";
import { ScannerInput, type ScannerFeedback } from "@/components/scanner";
import { KioskShell } from "./kiosk-shell";
import { ConnectionBadge } from "./connection-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataProvider } from "@/contexts/data-provider-context";
import { useBranches, useCurrentOrganization } from "@/hooks/use-kitchenmind-data";
import type { ScanAttempt } from "@/rules/scanner.rules";
import { processServiceScan, type ServiceScanResult } from "@/services/service-registration.service";
import { formatTime } from "@/utils/date";
import { useOfflineState } from "@/contexts/offline-context";
import { getOrCreateDeviceId, useDeviceSetting } from "@/hooks/use-device-settings";

export function ServicesKiosk() {
  const { provider } = useDataProvider();
  const { connected, enqueue } = useOfflineState();
  const { data: branches } = useBranches();
  const { data: organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const [savedBranchId, setBranchId] = useDeviceSetting("services.branch", "");
  const branchId = savedBranchId || branches.find((branch) => branch.status === "active")?.id || "";
  const [lastResult, setLastResult] = useState<ServiceScanResult | null>(null);
  const scan = useCallback(async (attempt: ScanAttempt): Promise<ScannerFeedback> => {
    if (!organizationId || !branchId) throw new Error("Configura la organización y sucursal del dispositivo.");
    const result = await processServiceScan(provider, { organizationId, branchId, deviceId: getOrCreateDeviceId("services"), attempt, syncStatus: connected ? "synced" : "pending" });
    setLastResult(result);
    if (result.status === "unknown") return { kind: "unknown", title: "IDENTIFICADOR NO RECONOCIDO", message: "Revisa el gafete o solicita apoyo a supervisión." };
    if (result.status === "no_active_service") return { kind: "error", title: "SIN SERVICIO ACTIVO", message: "No existe un tipo de servicio configurado para este horario." };
    if (result.status === "duplicate") return { kind: "duplicate", title: "SERVICIO YA REGISTRADO", message: `${result.employee.name} ya recibió ${result.serviceType.name.toLocaleLowerCase("es-MX")}.` };
    if (!connected) await enqueue({ organizationId, branchId, entityType: "service", entityId: result.event.id, idempotencyKey: result.event.idempotencyKey });
    return { kind: connected ? "success" : "offline", title: "SERVICIO REGISTRADO", message: connected ? `${result.employee.name} · ${result.serviceType.name} · ${formatTime(result.event.timestamp)}` : `${result.employee.name} · Guardado localmente para sincronizar.` };
  }, [branchId, connected, enqueue, organizationId, provider]);

  return <KioskShell title="REGISTRO DE SERVICIO" instruction="Escanea tu gafete" status={<ConnectionBadge />}><div className="mx-auto mb-5 w-full max-w-sm text-left"><label className="mb-2 block text-sm font-bold text-[#60758b]">Sucursal del dispositivo</label><Select value={branchId} onValueChange={(value) => { setBranchId(value); setLastResult(null); }}><SelectTrigger className="h-12 w-full rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{branches.filter((branch) => branch.status === "active").map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div><ScannerInput onScan={scan} placeholder="Escanea el gafete y presiona Enter" />{lastResult && (lastResult.status === "registered" || lastResult.status === "duplicate") && <ServiceResultCard result={lastResult} />}</KioskShell>;
}

function ServiceResultCard({ result }: { result: Extract<ServiceScanResult, { status: "registered" | "duplicate" }> }) {
  return <div className="mx-auto mt-2 max-w-xl rounded-[1.4rem] border border-[#cfe4ee] bg-white p-5 text-left shadow-[0_18px_45px_rgba(24,52,81,.08)]"><div className="flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#e3faf7] text-[#0a9692]"><Soup className="size-7" /></div><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#14928f]">{result.status === "duplicate" ? "SERVICIO YA REGISTRADO" : "SERVICIO REGISTRADO"}</p><p className="truncate text-xl font-extrabold text-[#183451]">{result.employee.name}</p></div></div><div className="mt-5 grid gap-3 rounded-2xl bg-[#f6f9fc] p-4 sm:grid-cols-2"><Detail icon={Soup} label="Servicio" value={result.serviceType.name} /><Detail icon={Building2} label="Cliente" value={result.client?.name ?? "Sin cliente"} /><Detail icon={UserRound} label="Sucursal" value={result.branch.name} /><Detail icon={Clock3} label="Hora" value={formatTime(result.event.timestamp)} /></div></div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof Soup; label: string; value: string }) { return <div className="flex items-center gap-2"><Icon className="size-4 text-[#6a8298]" /><div><p className="text-xs font-semibold text-[#8293a4]">{label}</p><p className="text-sm font-bold text-[#314b65]">{value}</p></div></div>; }
