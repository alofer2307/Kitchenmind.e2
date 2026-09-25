import Link from "next/link";
import { getKitchenMindUser, signInPath } from "@/services/auth-session.service";
import { enrollment } from "@/services/mobile-attendance.service";
import { BrandMark } from "@/components/brand/brand-mark";

export const dynamic = "force-dynamic";

export default async function ActivateAttendancePage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const identity = await getKitchenMindUser();
  let preview: { email: string; employeeName: string } | null = null;
  try { preview = await enrollment(token); } catch { /* Enlaces vencidos no revelan datos personales. */ }
  const returnTo = `/checar/activar?token=${encodeURIComponent(token)}`;
  return <main className="flex min-h-screen items-center justify-center bg-[#edf7f8] p-5 text-[#123e5d]">
    <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"><BrandMark />
      <h1 className="mt-7 text-2xl font-black">Activa tu checado móvil</h1>
      {!preview ? <p className="mt-4">El enlace venció o ya fue utilizado. Pide uno nuevo a Recursos Humanos.</p> : <>
        <p className="mt-3 text-sm">Invitación para <strong>{preview.employeeName}</strong> · {preview.email}</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {identity && identity.email.toLowerCase() !== preview.email ? <p className="mt-4 text-sm">Cierra sesión y entra con el correo indicado en la invitación.</p> : <>
          <form action="/api/auth/employee-register" method="post" className="mt-5 space-y-4">
            <input type="hidden" name="token" value={token}/>
            {!identity && <label className="block text-sm font-semibold">Crea tu contraseña
              <input required name="password" type="password" minLength={10} maxLength={200} autoComplete="new-password" className="mt-2 w-full rounded-xl border p-3" placeholder="10 caracteres, letras y números"/>
            </label>}
            <button type="submit" className="w-full rounded-xl bg-[#123e5d] px-4 py-3 font-bold text-white">{identity ? "Activar mi acceso" : "Crear cuenta y activar"}</button>
          </form>
          {!identity && <p className="mt-4 text-sm">¿Ya tienes una cuenta con ese correo? <Link className="font-bold underline" href={signInPath(returnTo)}>Inicia sesión</Link> y vuelve a abrir esta invitación.</p>}
        </>}
      </>}
    </section>
  </main>;
}
