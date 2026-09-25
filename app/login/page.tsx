import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string; reset?: string }> }) {
  const params = await searchParams;
  const returnTo = params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//") ? params.returnTo : "/";
  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e9fbfa_0,#f4f8fb_48%,#eef3f7_100%)] p-5">
    <Card className="w-full max-w-md rounded-[2rem] border-[#cfe2ea] bg-white shadow-[0_30px_90px_rgba(16,43,72,.14)]"><CardContent className="p-7 sm:p-9">
      <BrandMark />
      <div className="mt-8 flex size-12 items-center justify-center rounded-2xl bg-[#e7f8f6] text-[#128c88]"><KeyRound className="size-6" /></div>
      <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Entrar a KitchenMind</h1>
      <p className="mt-3 text-sm leading-6 text-[#667d92]">Usa el correo y contraseña de tu cuenta. Tu organización, rol y módulos se validan de nuevo en el servidor.</p>
      {params.error && <p className="mt-4 rounded-xl border border-[#efc3b7] bg-[#fff6f2] p-3 text-sm text-[#9d432b]">{params.error}</p>}
      {params.reset === "1" && <p className="mt-4 rounded-xl border border-[#afe0d5] bg-[#effaf7] p-3 text-sm text-[#176e5b]">Contraseña actualizada. Ya puedes iniciar sesión.</p>}
      <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="space-y-2"><Label htmlFor="email">Correo</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="space-y-2"><Label htmlFor="password">Contraseña</Label><Input id="password" name="password" type="password" autoComplete="current-password" minLength={10} required /></div>
        <Button type="submit" className="h-12 w-full rounded-xl text-base font-bold">Iniciar sesión</Button>
      </form>
      <div className="mt-5 flex items-center justify-between gap-3 text-sm"><Link className="font-semibold text-[#1769e0] hover:underline" href="/recuperar">Olvidé mi contraseña</Link><Link className="text-[#6c8194] hover:underline" href="/demo/login">Ver demo</Link></div>
      <div className="mt-6 flex gap-2 border-t border-[#e1ebf0] pt-5 text-xs leading-5 text-[#71879a]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#168f9a]" /><p>La sesión se guarda en una cookie segura y no depende de ChatGPT, enlaces privados ni el navegador del equipo fundador.</p></div>
    </CardContent></Card>
  </main>;
}
