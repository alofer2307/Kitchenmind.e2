"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, Calculator, Gauge, LayoutDashboard, LogOut, NotebookTabs, ShieldCheck, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlatformIdentitySummary } from "@/types";

const NAVIGATION = [
  { href: "/platform", label: "Inicio", icon: LayoutDashboard },
  { href: "/platform/prospectos", label: "Prospectos", icon: UsersRound },
  { href: "/platform/cotizaciones", label: "Cotizaciones", icon: NotebookTabs },
  { href: "/platform/organizaciones", label: "Organizaciones", icon: Building2 },
  { href: "/platform/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/platform/catalogo/dashboard", label: "Tableros", icon: Gauge },
  { href: "/platform/precios", label: "Precios", icon: Calculator },
];

export function PlatformShell({ identity, signOutHref, children }: { identity: PlatformIdentitySummary; signOutHref: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return <main className="min-h-screen bg-[#f4f8fc]">
    <header className="sticky top-0 z-40 border-b border-[#dbe7f2] bg-white/96 backdrop-blur">
      <div className="mx-auto flex min-h-18 max-w-[1500px] items-center justify-between gap-3 px-4 py-3 md:px-7">
        <div className="flex items-center gap-3"><BrandMark /><Badge className="hidden bg-[#e7f7f4] text-[#14745f] lg:inline-flex">Platform · Fundadora</Badge></div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right xl:block"><p className="text-sm font-extrabold text-[#203a57]">{identity.displayName}</p><p className="text-xs text-[#71869a]">{identity.email}</p></div>
          <span className="hidden items-center gap-1.5 rounded-xl bg-[#edf4ff] px-3 py-2 text-xs font-extrabold text-[#1769d9] sm:flex"><ShieldCheck className="size-4" />Acceso verificado</span>
          <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label="Cerrar sesión segura" onClick={() => void securePlatformSignOut(signOutHref)}><LogOut className="size-4" /></Button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 pb-3 md:px-7" aria-label="KitchenMind Platform">
        {NAVIGATION.map(({ href, label, icon: Icon }) => {
          const active = href === "/platform" || href === "/platform/catalogo" ? pathname === href : pathname.startsWith(href);
          return <Button key={href} asChild variant={active ? "default" : "ghost"} size="sm" className={`min-h-10 shrink-0 rounded-xl ${active ? "shadow-sm" : "text-[#5e7389]"}`}><Link href={href}><Icon className="size-4" />{label}</Link></Button>;
        })}
      </nav>
    </header>
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-7">{children}</div>
  </main>;
}

async function securePlatformSignOut(signOutHref: string): Promise<void> {
  try {
    await fetch("/api/platform/security/signout", { method: "POST", credentials: "same-origin" });
  } finally {
    window.location.assign(signOutHref);
  }
}
