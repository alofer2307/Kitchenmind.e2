"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/contexts/session-context";
import { useUsers } from "@/hooks/use-kitchenmind-data";

export function LoginScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const { data: users } = useUsers();
  const demoUser = users.find((user) => user.status === "active");
  const enter = () => {
    if (!demoUser) return;
    signIn(demoUser.id);
    router.replace("/demo");
  };
  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff2dc_0,#f7f3ed_48%,#edf3f7_100%)] p-5"><Card className="w-full max-w-md overflow-hidden rounded-[1.75rem] border-[#ead9c3] bg-white shadow-[0_28px_80px_rgba(74,55,31,.12)]"><CardContent className="p-7 sm:p-9"><BrandMark /><div className="mt-8 inline-flex rounded-full bg-[#fff0d5] px-3 py-1 text-xs font-black tracking-[0.15em] text-[#9a5d0b]">DEMO AISLADO</div><div className="mt-5"><h1 className="text-3xl font-black tracking-[-0.04em] text-[#102b48]">Explorar datos de prueba</h1><p className="mt-3 text-base leading-6 text-[#6a7e94]">Esta experiencia usa información ficticia guardada en este navegador y no representa una organización productiva.</p></div><div className="mt-8 rounded-2xl border border-[#eadfce] bg-[#fffaf2] p-4"><p className="text-sm font-bold text-[#203a57]">{demoUser?.name ?? "Preparando usuario de prueba…"}</p><p className="mt-1 text-sm text-[#72859a]">Identidad ficticia exclusiva para explorar la interfaz heredada.</p></div><Button className="mt-5 h-12 w-full rounded-xl bg-[#9a681d] text-base font-bold hover:bg-[#805313]" disabled={!demoUser} onClick={enter}>Abrir demostración <ArrowRight className="size-5" /></Button><Button asChild variant="ghost" className="mt-2 w-full rounded-xl"><Link href="/">Volver al acceso productivo</Link></Button><div className="mt-5 flex gap-2 text-xs leading-5 text-[#7a8da1]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#9a681d]" /><p>La demostración no comparte membresías, permisos ni indicadores con el entorno productivo.</p></div></CardContent></Card></main>;
}
