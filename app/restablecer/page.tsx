import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const dynamic = "force-dynamic";
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-5"><Card className="w-full max-w-md rounded-[2rem]"><CardContent className="p-8"><BrandMark /><h1 className="mt-7 text-2xl font-black text-[#102b48]">Crea una contraseña nueva</h1><p className="mt-2 text-sm text-[#667d92]">Usa al menos 10 caracteres, una letra y un número.</p>{params.error && <p className="mt-4 rounded-xl bg-[#fff3ef] p-3 text-sm text-[#9d432b]">{params.error}</p>}<form action="/api/auth/reset" method="post" className="mt-6 space-y-4"><input type="hidden" name="token" value={params.token ?? ""} /><div className="space-y-2"><Label htmlFor="password">Nueva contraseña</Label><Input id="password" name="password" type="password" minLength={10} required /></div><Button className="h-11 w-full rounded-xl" disabled={!params.token}>Guardar contraseña</Button></form></CardContent></Card></main>;
}
