import { ArrowRight, Building2, CheckCircle2, LockKeyhole, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";

type AccessMode = "signed_out" | "no_membership" | "suspended" | "restricted" | "unavailable";

const stateCopy: Record<Exclude<AccessMode, "signed_out">, { eyebrow: string; title: string; detail: string }> = {
  no_membership: {
    eyebrow: "Cuenta verificada",
    title: "Todavía no tienes una organización asignada",
    detail: "Tu identidad es válida, pero KitchenMind no encontró una membresía activa. Pide al administrador que revise o reemplace tu invitación.",
  },
  suspended: {
    eyebrow: "Membresía suspendida",
    title: "Tu acceso está temporalmente suspendido",
    detail: "Los datos de la organización permanecen protegidos. Pide al administrador que revise el estado de tu membresía antes de volver a intentar.",
  },
  restricted: {
    eyebrow: "Acceso restringido",
    title: "Esta organización no puede operar ahora",
    detail: "Los datos permanecen protegidos. Contacta a KitchenMind o al administrador de tu empresa para conocer el estado del acceso.",
  },
  unavailable: {
    eyebrow: "Verificación pendiente",
    title: "No pudimos preparar tu espacio",
    detail: "KitchenMind mantuvo el acceso cerrado porque no fue posible validar todos los controles. Intenta nuevamente en unos minutos.",
  },
};

export function ProductAccessScreen({ mode, signInHref, signOutHref, identityLabel, organizationName }: { mode: AccessMode; signInHref?: string; signOutHref?: string; identityLabel?: string; organizationName?: string }) {
  const signedOut = mode === "signed_out";
  const copy = signedOut ? null : stateCopy[mode];
  return <main className="relative min-h-screen overflow-hidden bg-[#eef5f8] text-[#102b48]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(27,194,190,.2),transparent_32%),radial-gradient(circle_at_90%_8%,rgba(23,105,224,.18),transparent_30%)]" />
    <div className="relative mx-auto grid min-h-screen max-w-[1480px] lg:grid-cols-[1.05fr_.95fr]">
      <section className="flex flex-col justify-between px-5 py-5 sm:px-9 sm:py-8 lg:px-14 lg:py-12">
        <BrandMark />
        <div className="my-5 max-w-2xl sm:my-14 lg:my-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#b8dddf] bg-white/70 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#147e87] backdrop-blur">
            <Sparkles className="size-3.5" /> Operación con contexto
          </div>
          <h1 className="mt-4 text-[clamp(2.7rem,7vw,5.8rem)] font-black leading-[.92] tracking-[-0.065em] text-[#0b2947] sm:mt-6">Cada turno,<br /><span className="text-[#1672df]">bajo control.</span></h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#5d748a] sm:mt-6 sm:text-lg">KitchenMind reúne personal, servicio, calidad e inventario en un espacio seguro para cada organización.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#637c90]">
          <span className="flex items-center gap-2"><LockKeyhole className="size-4 text-[#168f9a]" />Acceso privado</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#168f9a]" />Datos aislados por empresa</span>
        </div>
      </section>

      <section className="flex items-center bg-[#0c2b48] px-5 py-8 sm:px-10 sm:py-10 lg:px-14">
        <div className="w-full rounded-[2rem] border border-white/10 bg-white/[.075] p-6 shadow-[0_35px_90px_rgba(0,0,0,.25)] backdrop-blur sm:p-9">
          {signedOut ? <>
            <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#69ded8]">Tu espacio KitchenMind</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Entra y continúa donde te quedaste.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#b9cbd8]">Usaremos tu identidad verificada para llevarte a Platform, al selector de empresas o al onboarding que corresponda.</p>
            <Button asChild className="mt-8 h-13 w-full rounded-2xl bg-[#1dc4be] text-base font-extrabold text-[#082c43] hover:bg-[#4ad7d1]">
              <a href={signInHref} target="_top">Entrar a KitchenMind <ArrowRight className="size-5" /></a>
            </Button>
            <div className="mt-7 grid grid-cols-[auto_1fr] gap-x-4 gap-y-5 border-t border-white/10 pt-7">
              <Step number="01" title="Validamos tu identidad" /><Step number="02" title="Elegimos el espacio autorizado" /><Step number="03" title="Mostramos tu siguiente acción" />
            </div>
          </> : <>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#153c5c] text-[#6be1dc]">{mode === "no_membership" ? <Building2 className="size-6" /> : <ShieldAlert className="size-6" />}</div>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-[#69ded8]">{copy?.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{copy?.title}</h2>
            {organizationName && <p className="mt-3 font-bold text-[#d9e9f2]">{organizationName}</p>}
            <p className="mt-4 text-sm leading-6 text-[#b9cbd8]">{copy?.detail}</p>
            {identityLabel && <p className="mt-7 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#d9e6ee]">Sesión: <strong>{identityLabel}</strong></p>}
            <div className="mt-5 flex gap-3">
              <Button asChild className="h-11 flex-1 rounded-xl bg-[#1dc4be] text-[#082c43] hover:bg-[#4ad7d1]"><Link href="/">Reintentar</Link></Button>
              {signOutHref && <Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><a href={signOutHref} target="_top">Salir</a></Button>}
            </div>
          </>}
        </div>
      </section>
    </div>
  </main>;
}

function Step({ number, title }: { number: string; title: string }) {
  return <><span className="font-mono text-xs font-bold text-[#69ded8]">{number}</span><span className="text-sm font-semibold text-[#dbe8ef]">{title}</span></>;
}
