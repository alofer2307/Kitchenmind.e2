import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const dynamic = "force-dynamic";
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ sent?: string; devResetUrl?: string }> }) {
  const params = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-5"><Card className="w-full max-w-md rounded-[2rem]"><CardContent className="p-8"><BrandMark /><h1 className="mt-7 text-2xl font-black text-[#102b48]">Recuperar acceso</h1><p className="mt-2 text-sm leading-6 text-[#667d92]">Escribe tu correo. Si existe una cuenta activa, enviaremos un enlace de recuperación.</p>{params.sent === "1" && <p className="mt-4 rounded-xl bg-[#effaf7] p-3 text-sm text-[#176e5b]">Revisa tu correo. Por seguridad mostramos el mismo mensaje aunque la cuenta no exista.</p>}{params.devResetUrl && <p className="mt-4 break-all rounded-xl bg-[#fff8e8] p-3 text-xs text-[#7e5d17]">Modo local sin correo: <a className="font-bold underline" href={params.devResetUrl}>abrir enlace de recuperación</a></p>}<form action="/api/auth/request-reset" method="post" className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="email">Correo</Label><Input id="email" name="email" type="email" required /></div><Button className="h-11 w-full rounded-xl">Enviar enlace</Button></form><Button asChild variant="ghost" className="mt-2 w-full"><Link href="/login">Volver a iniciar sesión</Link></Button></CardContent></Card></main>;
}
