"use client";

import { CheckCircle2, Clock3, Fingerprint, KeyRound, Loader2, RefreshCw, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrowserBridgeBiometricProvider } from "@/providers/biometric/browser-bridge.provider";
import type { BiometricHealth } from "@/providers/biometric/biometric.provider";
import type { KioskCaptureInput, KioskCaptureResult } from "@/types";
import { KioskShell } from "./kiosk-shell";

interface Envelope<T> { data?: T; error?: string; code?: string }

type AttendanceResult =
  | Extract<KioskCaptureResult, { eventKind: "attendance" }>
  | Extract<KioskCaptureResult, { status: "unknown" }>;

export function OperationalBiometricKiosk() {
  const bridge = useMemo(() => new BrowserBridgeBiometricProvider(), []);
  const [health, setHealth] = useState<BiometricHealth | null>(null);
  const [deviceToken, setDeviceToken] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [clock, setClock] = useState(() => new Date());

  const activeToken = deviceToken || manualToken.trim();

  const api = useCallback(async <T,>(action: "capture" | "sync_batch" | "heartbeat", data: unknown, token = activeToken): Promise<T> => {
    if (!token) throw new Error("Este dispositivo necesita autorización de KitchenMind.");
    const response = await fetch("/api/kiosk/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, data }), cache: "no-store" });
    const body = await response.json() as Envelope<T>;
    if (!response.ok || body.data === undefined) throw new Error(body.error ?? "No fue posible completar la operación del dispositivo.");
    return body.data;
  }, [activeToken]);

  const refreshBridge = useCallback(async () => {
    try {
      const next = await bridge.healthCheck();
      setHealth(next);
      const token = await bridge.getDeviceToken?.();
      if (token) setDeviceToken(token);
      setMessage(next.available ? null : next.detail);
      return { next, token: token ?? activeToken };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No se detectó el bridge biométrico.";
      const next = { available: false, provider: "unavailable", deviceSerial: null, detail } satisfies BiometricHealth;
      setHealth(next); setMessage(detail);
      return { next, token: activeToken };
    }
  }, [activeToken, bridge]);

  const sendHeartbeat = useCallback(async () => {
    const { next, token } = await refreshBridge();
    if (!token) return;
    try {
      await api("heartbeat", { bridgeVersion: null, status: next.available ? "online" : "degraded", health: { available: next.available, provider: next.provider, deviceSerial: next.deviceSerial, detail: next.detail } }, token);
    } catch (error) {
      if (typeof navigator !== "undefined" && navigator.onLine) setMessage(error instanceof Error ? error.message : "No se pudo validar el dispositivo.");
    }
  }, [api, refreshBridge]);

  useEffect(() => {
    const initialHeartbeat = window.setTimeout(() => void sendHeartbeat(), 0);
    const heartbeatTimer = window.setInterval(() => void sendHeartbeat(), 60_000);
    const clockTimer = window.setInterval(() => setClock(new Date()), 1_000);
    const onlineHandler = () => { setOnline(true); void sendHeartbeat(); };
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => { window.clearTimeout(initialHeartbeat); window.clearInterval(heartbeatTimer); window.clearInterval(clockTimer); window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", offlineHandler); };
  }, [sendHeartbeat]);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [result]);

  const capture = async () => {
    setCapturing(true); setMessage(null); setOfflineQueued(false); setResult(null);
    let event: KioskCaptureInput | null = null;
    try {
      const identity = await bridge.identify();
      event = { eventKind: "attendance", externalTemplateId: identity.externalTemplateId, provider: identity.provider, occurredAt: identity.capturedAt || new Date().toISOString(), idempotencyKey: crypto.randomUUID() };
      const next = await api<AttendanceResult>("capture", event);
      setResult(next);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No fue posible leer la huella.";
      const networkFailure = /fetch|network|failed to fetch|offline/i.test(detail) || (typeof navigator !== "undefined" && !navigator.onLine);
      if (networkFailure && event) {
        try {
          const offline = { ...event, offlineEventId: crypto.randomUUID() };
          await bridge.queueEvent?.(offline);
          setOfflineQueued(true);
          setMessage("Modo sin conexión: el bridge guardó el registro y lo sincronizará cuando vuelva Internet.");
        } catch (queueError) {
          setMessage(queueError instanceof Error ? queueError.message : "No fue posible guardar el evento offline.");
        }
      } else setMessage(detail);
    } finally { setCapturing(false); }
  };

  const synchronize = async () => {
    setSyncing(true); setMessage(null);
    try {
      const events = (await bridge.pullEvents()).filter((event) => event.eventKind === "attendance");
      if (!events.length) { setMessage("No hay registros de asistencia pendientes en el bridge."); return; }
      const normalized = events.slice(0, 250).map((event) => ({ ...event, eventKind: "attendance" as const, offlineEventId: event.offlineEventId || crypto.randomUUID() }));
      const response = await api<{ accepted: number; rejected: number }>("sync_batch", { idempotencyKey: crypto.randomUUID(), events: normalized });
      if (response.accepted) await bridge.acknowledgeEvents?.(normalized.slice(0, response.accepted).map((event) => event.offlineEventId!).filter(Boolean));
      setMessage(`${response.accepted} registro(s) sincronizados${response.rejected ? ` · ${response.rejected} requieren revisión` : ""}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible sincronizar."); }
    finally { setSyncing(false); }
  };

  const ready = Boolean(health?.available && activeToken);
  return <KioskShell title="REGISTRO DE PERSONAL" instruction={health?.available ? "Coloque su huella en el lector" : "Conecte el lector biométrico autorizado"} status={<div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${online ? "bg-[#e2f7ef] text-[#16745a]" : "bg-[#fff0e7] text-[#a55137]"}`}>{online ? <Wifi className="size-3.5"/> : <WifiOff className="size-3.5"/>}{online ? "EN LÍNEA" : "OFFLINE"}</div>}>
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-[1.6rem] border border-[#cfe2e9] bg-white p-5 shadow-[0_18px_50px_rgba(20,54,81,.08)]">
        <div className="flex items-center gap-3"><div className={`flex size-12 items-center justify-center rounded-2xl ${health?.available ? "bg-[#e3faf7] text-[#108f8c]" : "bg-[#fff0ea] text-[#c25b3d]"}`}><Fingerprint className="size-6"/></div><div><p className="font-black">{health?.available ? `Lector ${health.provider}` : "Lector no disponible"}</p><p className="text-xs text-[#74899b]">{health?.deviceSerial ?? health?.detail ?? "Buscando bridge…"}</p></div></div>
        <div className="flex items-center justify-end gap-3 text-right"><Clock3 className="size-5 text-[#158f92]"/><div><p className="text-2xl font-black tabular-nums">{clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-xs text-[#74899b]">{clock.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" })}</p></div><Button variant="outline" size="icon" className="rounded-xl" onClick={() => void sendHeartbeat()}><RefreshCw className="size-4"/></Button></div>
        {!deviceToken && <div className="col-span-2 border-t border-[#e5edf1] pt-4"><label className="text-xs font-extrabold uppercase tracking-wide text-[#6c8294]">Credencial temporal de dispositivo</label><div className="mt-2 flex gap-2"><Input type="password" value={manualToken} onChange={(e)=>setManualToken(e.target.value)} placeholder="kmdev_…" className="h-11 rounded-xl"/><Button variant="outline" className="rounded-xl" onClick={()=>setManualToken((value)=>value.trim())}><KeyRound className="mr-2 size-4"/>Usar sesión</Button></div><p className="mt-2 text-[11px] leading-5 text-[#8395a3]">No se persiste en localStorage ni IndexedDB. En producción debe custodiarla el bridge local.</p></div>}
      </div>

      <Button disabled={!ready || capturing} onClick={() => void capture()} className="h-28 w-full rounded-[1.7rem] bg-[#123e5d] text-xl font-black shadow-lg hover:bg-[#0f354f]">{capturing ? <><Loader2 className="mr-3 size-7 animate-spin"/>Leyendo huella…</> : <><Fingerprint className="mr-3 size-9"/>COLOCAR HUELLA</>}</Button>
      <Button variant="outline" disabled={!activeToken || syncing} onClick={() => void synchronize()} className="w-full rounded-xl bg-white">{syncing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <RefreshCw className="mr-2 size-4"/>}Sincronizar registros pendientes</Button>

      {result && <Result result={result}/>} 
      {offlineQueued && <Status tone="offline" text={message ?? "Registro guardado en la cola durable del bridge."}/>} 
      {!offlineQueued && message && <Status tone="error" text={message}/>} 
    </div>
  </KioskShell>;
}

function Result({ result }: { result: AttendanceResult }) {
  if (result.status === "unknown") return <Status tone="error" text="HUELLA NO RECONOCIDA · Intente nuevamente o solicite apoyo a supervisión."/>;
  const eventLabel = labelAttendance(result.eventType);
  const duplicate = result.status === "duplicate";
  const late = result.eventType === "late";
  const title = duplicate ? "REGISTRO YA RECIBIDO" : late ? "ENTRADA REGISTRADA" : `${eventLabel.toUpperCase()} REGISTRADA`;
  const style = duplicate ? "border-[#f1d5a0] bg-[#fff9ed] text-[#7b5a12]" : late ? "border-[#f1d5a0] bg-[#fff9ed] text-[#7b5a12]" : "border-[#b8dfd3] bg-[#f0fbf7] text-[#176c58]";
  return <div className={`rounded-[1.6rem] border p-6 text-center ${style}`}><CheckCircle2 className="mx-auto size-10"/><p className="mt-3 text-xl font-black">{title}</p><p className="mt-2 text-2xl font-black">{result.personName}</p><p className="mt-1 text-sm">#{result.employeeNumber} · {result.shiftName ?? "Sin turno"} · {result.branchName}</p><p className="mt-2 text-lg font-bold">{new Intl.DateTimeFormat("es-MX",{hour:"2-digit",minute:"2-digit"}).format(new Date(result.occurredAt))}{late && result.lateMinutes !== null ? ` · Retardo ${result.lateMinutes} min` : ""}</p>{result.offline && <p className="mt-1 text-xs">Sincronizado desde cola offline.</p>}</div>;
}

function Status({ tone, text }: { tone: "error" | "offline"; text: string }) {
  const style = tone === "offline" ? "border-[#b7d5e6] bg-[#eef8fd] text-[#235f82]" : "border-[#efc6b8] bg-[#fff7f3] text-[#8d422b]";
  const Icon = tone === "offline" ? WifiOff : ShieldAlert;
  return <div className={`rounded-[1.5rem] border p-5 text-center ${style}`}><Icon className="mx-auto size-7"/><p className="mt-2 font-black">{text}</p></div>;
}

function labelAttendance(type: string) { return ({ entry:"Entrada", exit:"Salida", late:"Entrada", incident:"Incidencia", manual_adjustment:"Ajuste" } as Record<string,string>)[type] ?? type; }
