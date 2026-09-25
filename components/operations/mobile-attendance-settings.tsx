"use client";

import { useCallback, useEffect, useState } from "react";

type Employee = { id: string; name: string; employeeNumber: string; email: string | null; accountStatus: string | null };
type Policy = { latitude: number; longitude: number; radiusMeters: number; maxAccuracyMeters: number; enabled: number };

export function MobileAttendanceSettings({ organizationId, branchId }: { organizationId: string; branchId: string }) {
  const [policy, setPolicy] = useState({ latitude: "", longitude: "", radiusMeters: 200, maxAccuracyMeters: 100, enabled: false });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [invitation, setInvitation] = useState("");
  const load = useCallback(async (query = "") => {
    const params = new URLSearchParams({ organizationId, branchId, search: query });
    const response = await fetch(`/api/customer/mobile-attendance?${params}`, { cache: "no-store" });
    const body = await response.json() as { data?: { policy: Policy | null; employees: Employee[] }; error?: string };
    if (!response.ok || !body.data) throw new Error(body.error ?? "No se pudo consultar el checado móvil.");
    if (body.data.policy) setPolicy({ latitude: String(body.data.policy.latitude), longitude: String(body.data.policy.longitude),
      radiusMeters: body.data.policy.radiusMeters, maxAccuracyMeters: body.data.policy.maxAccuracyMeters, enabled: Boolean(body.data.policy.enabled) });
    setEmployees(body.data.employees);
    setSelected(body.data.employees[0]?.id ?? "");
  }, [organizationId, branchId]);
  useEffect(() => { void load().catch((error) => setNotice(error.message)); }, [load]);

  const locate = () => {
    if (!navigator.geolocation) return setNotice("Este dispositivo no permite consultar ubicación.");
    setBusy(true); setNotice("");
    navigator.geolocation.getCurrentPosition((position) => {
      setPolicy((value) => ({ ...value, latitude: String(position.coords.latitude), longitude: String(position.coords.longitude) }));
      setNotice(`Centro capturado. Precisión reportada: ${Math.round(position.coords.accuracy)} m. Comprueba que estés físicamente en la sucursal.`);
      setBusy(false);
    }, () => { setNotice("No se obtuvo la ubicación. Puedes escribir las coordenadas de la sucursal."); setBusy(false); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };

  const submit = async (action: "configure" | "invite" | "revoke") => {
    setBusy(true); setNotice(""); setInvitation("");
    try {
      const data = action === "configure" ? { action, organizationId, branchId, ...policy, latitude: Number(policy.latitude), longitude: Number(policy.longitude) }
        : { action, organizationId, branchId, employeeId: selected };
      const response = await fetch("/api/customer/mobile-attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await response.json() as { data?: { invitationPath?: string; employeeEmail?: string }; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      if (body.data?.invitationPath) {
        setInvitation(new URL(body.data.invitationPath, window.location.origin).toString());
        setNotice(`Invitación creada para ${body.data.employeeEmail}. Envíala únicamente a esa persona; vence en 7 días y se usa una vez.`);
      } else setNotice(action === "revoke" ? "Acceso móvil revocado." : "Configuración guardada para esta sucursal.");
      await load(search);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-3xl border border-[#d5e4eb] bg-white p-5">
    <div><h3 className="text-lg font-black">Checado desde el celular</h3><p className="text-sm text-[#6f8495]">Configura la sucursal, luego invita a cada empleado con el correo registrado en Personal. No requiere lector de huella.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold">Latitud <input aria-label="Latitud de sucursal" type="number" step="any" value={policy.latitude} onChange={(event) => setPolicy({ ...policy, latitude: event.target.value })} className="mt-1 w-full rounded-xl border p-2"/></label>
      <label className="text-sm font-bold">Longitud <input aria-label="Longitud de sucursal" type="number" step="any" value={policy.longitude} onChange={(event) => setPolicy({ ...policy, longitude: event.target.value })} className="mt-1 w-full rounded-xl border p-2"/></label>
      <label className="text-sm font-bold">Radio permitido (75–1000 m) <input type="number" min="75" max="1000" value={policy.radiusMeters} onChange={(event) => setPolicy({ ...policy, radiusMeters: Number(event.target.value) })} className="mt-1 w-full rounded-xl border p-2"/></label>
      <label className="text-sm font-bold">Precisión máxima (10–200 m) <input type="number" min="10" max="200" value={policy.maxAccuracyMeters} onChange={(event) => setPolicy({ ...policy, maxAccuracyMeters: Number(event.target.value) })} className="mt-1 w-full rounded-xl border p-2"/></label>
    </div>
    <button type="button" disabled={busy} onClick={locate} className="rounded-xl border px-4 py-2 text-sm font-bold">Usar mi ubicación actual como centro</button>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })}/> Activar checado móvil en esta sucursal</label>
    <button type="button" disabled={busy || !policy.latitude || !policy.longitude} onClick={() => void submit("configure")} className="rounded-xl bg-[#123e5d] px-4 py-2 font-bold text-white disabled:opacity-50">Guardar ubicación y reglas</button>
    <div className="border-t pt-4"><h4 className="font-black">Invitar a un empleado</h4><div className="mt-3 flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca nombre, número o correo" className="min-w-0 flex-1 rounded-xl border p-2 text-sm"/><button type="button" disabled={busy} onClick={() => void load(search).catch((error) => setNotice(error.message))} className="rounded-xl border px-3 text-sm font-bold">Buscar</button></div>
      <select aria-label="Empleado para invitar" value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-3 w-full rounded-xl border p-2 text-sm"><option value="">Selecciona empleado</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · #{employee.employeeNumber} · {employee.email ?? "Sin correo"}{employee.accountStatus === "active" ? " · Vinculado" : ""}</option>)}</select>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy || !selected} onClick={() => void submit("invite")} className="rounded-xl bg-[#123e5d] px-4 py-2 font-bold text-white disabled:opacity-50">Crear invitación personal</button>
      {employees.find((employee) => employee.id === selected)?.accountStatus === "active" && <button type="button" disabled={busy} onClick={() => void submit("revoke")} className="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-800">Revocar acceso</button>}</div>
    </div>
    {notice && <p role="status" className="rounded-xl bg-[#edf7f8] p-3 text-sm">{notice}</p>}
    {invitation && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3"><p className="text-sm font-bold">Enlace personal de un solo uso</p><input readOnly aria-label="Enlace de invitación" value={invitation} className="mt-2 w-full rounded-lg border p-2 text-xs"/><button type="button" onClick={() => void navigator.clipboard.writeText(invitation)} className="mt-2 text-sm font-bold underline">Copiar enlace</button></div>}
  </section>;
}
