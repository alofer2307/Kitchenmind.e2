"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";

type Event = { id: string; eventType: string; occurredAt: string; operationalDate: string; lateMinutes: number | null };
type Account = { employeeId: string; organizationId: string; employeeName: string; employeeNumber: string; branchName: string; enabled: boolean; events: Event[] };

export function MobileAttendanceScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/employee/attendance", { cache: "no-store" });
    const body = await response.json() as { data?: Account[]; error?: string };
    if (!response.ok || !body.data) throw new Error(body.error ?? "No se pudo consultar tu asistencia.");
    setAccounts(body.data);
  }, []);
  useEffect(() => { void refresh().catch((reason) => setError(String(reason.message ?? reason))).finally(() => setLoading(false)); }, [refresh]);

  const mark = async (account: Account, action: "entry" | "exit") => {
    setBusy(account.employeeId); setError(null); setMessage(null);
    try {
      const location = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Este navegador no permite consultar la ubicación."));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      });
      const response = await fetch("/api/employee/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: account.employeeId, action, latitude: location.coords.latitude, longitude: location.coords.longitude,
          accuracy: location.coords.accuracy, capturedAt: new Date(location.timestamp).toISOString(), idempotencyKey: crypto.randomUUID() }),
      });
      const body = await response.json() as { data?: { eventType: string; occurredAt: string }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? "No se pudo registrar. Consulta a supervisión.");
      setMessage(`${body.data.eventType === "exit" ? "Salida" : body.data.eventType === "late" ? "Entrada con retardo" : "Entrada"} registrada a las ${new Date(body.data.occurredAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`);
      await refresh();
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "No se pudo registrar.";
      setError(/permission|denied/i.test(detail) ? "Permite el acceso a la ubicación en tu celular o solicita un ajuste a supervisión." : detail);
    } finally { setBusy(null); }
  };

  return <main className="min-h-screen bg-[#edf7f8] p-4 text-[#123e5d] sm:p-8"><div className="mx-auto max-w-xl space-y-5">
    <header className="flex items-center justify-between rounded-3xl bg-white p-5 shadow-sm"><BrandMark compact/><Link href="/logout" className="text-sm font-bold underline">Salir</Link></header>
    <section className="rounded-3xl bg-[#123e5d] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-[#8ce3d9]">Personal</p><h1 className="mt-2 text-3xl font-black">Mi asistencia</h1><p className="mt-2 text-sm text-[#c6dce7]">Registra tu entrada o salida desde tu sucursal. La hora la determina KitchenMind.</p></section>
    {loading && <p className="rounded-2xl bg-white p-5">Consultando tu cuenta…</p>}
    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">{message}</p>}
    {!loading && !accounts.length && <p className="rounded-2xl bg-white p-5">Aún no hay un empleado vinculado a tu cuenta. Solicita a Recursos Humanos tu invitación personal de checado.</p>}
    {accounts.map((account) => {
      return <section key={account.employeeId} className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#52788a]">{account.branchName} · #{account.employeeNumber}</p><h2 className="mt-1 text-xl font-black">{account.employeeName}</h2>
        {!account.enabled ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">Recursos Humanos debe activar el checado móvil para esta sucursal.</p> : <>
          <p className="mt-4 text-sm">Selecciona lo que estás registrando. KitchenMind comprueba el orden y evita duplicados.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy !== null} onClick={() => void mark(account, "entry")}
              className="rounded-2xl bg-[#123e5d] px-3 py-5 font-black text-white disabled:opacity-60">REGISTRAR ENTRADA</button>
            <button type="button" disabled={busy !== null} onClick={() => void mark(account, "exit")}
              className="rounded-2xl border border-[#123e5d] px-3 py-5 font-black text-[#123e5d] disabled:opacity-60">REGISTRAR SALIDA</button>
          </div>
        </>}
        <h3 className="mt-6 text-sm font-black">Últimos registros</h3>
        <ul className="mt-2 divide-y text-sm">{account.events.map((event) => <li key={event.id} className="flex justify-between gap-3 py-2"><span>{event.eventType === "exit" ? "Salida" : event.eventType === "late" ? "Entrada con retardo" : event.eventType === "entry" ? "Entrada" : "Ajuste"}</span><time>{new Date(event.occurredAt).toLocaleString("es-MX")}</time></li>)}</ul>
      </section>;
    })}
    <p className="text-center text-xs text-[#647f90]">La ubicación se consulta al registrar; KitchenMind conserva la distancia y precisión usadas para validar el registro, sin guardar tus coordenadas.</p>
  </div></main>;
}
