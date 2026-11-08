"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, Calculator, Gauge, LayoutDashboard, LogOut, Menu, NotebookTabs, ShieldCheck, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlatformIdentitySummary } from "@/types";

const PRIMARY_NAV = [
  { href: "/platform", label: "Inicio", icon: LayoutDashboard },
  { href: "/platform/organizaciones", label: "Mis empresas", icon: Building2 },
  { href: "/platform/prospectos", label: "Clientes", icon: UsersRound },
] as const;

const MORE_NAV = [
  { href: "/platform/cotizaciones", label: "Cotizaciones", icon: NotebookTabs },
  { href: "/platform/catalogo", label: "Módulos", icon: BookOpen },
  { href: "/platform/catalogo/dashboard", label: "Tableros", icon: Gauge },
  { href: "/platform/precios", label: "Precios", icon: Calculator },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/platform" || href === "/platform/catalogo" ? pathname === href : pathname.startsWith(href);
}

export function PlatformShell({ identity, signOutHref, children }: { identity: PlatformIdentitySummary; signOutHref: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const moreActive = MORE_NAV.some(({ href }) => isActive(pathname, href));
  return <main className="min-h-screen bg-[#f4f8fc] pb-20 md:pb-0">
    <header className="sticky top-0 z-40 border-b border-[#dbe7f2] bg-white/96 backdrop-blur">
      <div className="mx-auto flex min-h-18 max-w-[1500px] items-center justify-between gap-3 px-4 py-3 md:px-7">
        <div className="flex items-center gap-3"><BrandMark /><Badge className="hidden bg-[#e7f7f4] text-[#14745f] lg:inline-flex">Platform · Fundadora</Badge></div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right xl:block"><p className="text-sm font-extrabold text-[#203a57]">{identity.displayName}</p><p className="text-xs text-[#71869a]">{identity.email}</p></div>
          <span className="hidden items-center gap-1.5 rounded-xl bg-[#edf4ff] px-3 py-2 text-xs font-extrabold text-[#1769d9] sm:flex"><ShieldCheck className="size-4" />Acceso verificado</span>
          <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label="Cerrar sesión segura" onClick={() => void securePlatformSignOut(signOutHref)}><LogOut className="size-4" /></Button>
        </div>
      </div>
      <nav className="mx-auto hidden max-w-[1500px] items-center gap-2 px-7 pb-3 md:flex" aria-label="Administración KitchenMind">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => <Button key={href} asChild variant={isActive(pathname, href) ? "default" : "ghost"} size="sm" className="min-h-11 rounded-xl"><Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined}><Icon className="size-4" />{label}</Link></Button>)}
        <details className="group relative ml-auto">
          <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 text-sm font-bold hover:bg-[#edf4ff] [&::-webkit-details-marker]:hidden ${moreActive ? "bg-[#eaf2ff] text-[#1769df]" : "text-[#526a80]"}`}><Menu className="size-4" />Más opciones</summary>
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#dbe7f2] bg-white p-2 shadow-xl">
            {MORE_NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#304b65] hover:bg-[#edf4ff]" aria-current={isActive(pathname, href) ? "page" : undefined}><Icon className="size-4" />{label}</Link>)}
          </div>
        </details>
      </nav>
    </header>
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-7">{children}</div>
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#dbe7f2] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(16,43,72,.08)] md:hidden" aria-label="Navegación principal">
      {PRIMARY_NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-bold ${isActive(pathname, href) ? "text-[#1769df]" : "text-[#60758b]"}`}><Icon className="size-5" aria-hidden="true" />{label}</Link>)}
      <details className="group relative">
        <summary className={`flex min-h-16 cursor-pointer list-none flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-bold [&::-webkit-details-marker]:hidden ${moreActive ? "text-[#1769df]" : "text-[#60758b]"}`} aria-label="Abrir más opciones"><Menu className="size-5" />Más</summary>
        <div className="absolute bottom-full right-2 z-50 mb-2 w-56 rounded-2xl border border-[#dbe7f2] bg-white p-2 shadow-xl">
          {MORE_NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#304b65] hover:bg-[#edf4ff]" aria-current={isActive(pathname, href) ? "page" : undefined}><Icon className="size-4" />{label}</Link>)}
        </div>
      </details>
    </nav>
  </main>;
}

async function securePlatformSignOut(signOutHref: string): Promise<void> {
  try {
    await fetch("/api/platform/security/signout", { method: "POST", credentials: "same-origin" });
  } finally {
    window.location.assign(signOutHref);
  }
}
