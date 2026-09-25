"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, LogOut, Menu, PanelsTopLeft } from "lucide-react";
import { ADMIN_ROUTES } from "@/constants/routes";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSession } from "@/contexts/session-context";
import { useOrganizationSelection } from "@/contexts/organization-context";
import { useCurrentOrganization, useOrganizations, usePlans, useUsers } from "@/hooks/use-kitchenmind-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, signOut } = useSession();
  const { selectOrganization } = useOrganizationSelection();
  const { data: users } = useUsers();
  const { data: organizations } = useOrganizations();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: plans } = usePlans();
  const currentUser = users.find((user) => user.id === userId);
  const currentPlan = plans.find((plan) => plan.id === currentOrganization?.planId);

  useEffect(() => {
    if (!userId) router.replace("/demo/login");
  }, [router, userId]);

  if (!userId) return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-6 text-center text-sm font-bold text-[#6a7e94]">Abriendo inicio de sesión…</main>;

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r border-[#dbe7f2]">
        <SidebarHeader className="px-4 py-5">
          <BrandMark />
          <span className="mt-3 w-fit rounded-full bg-[#fff0d5] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#955b0d]">DEMO AISLADO</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_ROUTES.filter(({ module }) => currentOrganization?.activeModules.includes(module) ?? module === "core").map(({ href, label, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={pathname === href} tooltip={label} className="h-11 rounded-xl text-[0.95rem] font-semibold">
                      <Link href={href}>
                        <Icon className="size-5" aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <div className="rounded-2xl border border-[#dbe7f2] bg-[#f4f9ff] p-3">
            <p className="truncate text-sm font-bold text-[#203a57]">{currentOrganization?.name ?? "Datos de prueba"}</p>
            <p className="mt-1 text-xs text-[#6b7e92]">{currentPlan?.name ?? "Plan sin asignar"} · {currentOrganization?.activeModules.length ?? 0} módulos</p>
          </div>
          {currentUser?.platformAccess && <Button asChild variant="outline" className="mt-2 w-full rounded-xl"><Link href="/platform"><PanelsTopLeft className="size-4" />Panel KitchenMind</Link></Button>}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#f4f8fc]">
        <header className="sticky top-0 z-30 flex h-17 items-center justify-between border-b border-[#dbe7f2] bg-white/92 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" aria-label="Abrir menú">
              <Menu className="size-5" />
            </SidebarTrigger>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a8da3]">Organización</p>
              <Select value={currentOrganization?.id ?? ""} onValueChange={selectOrganization}>
                <SelectTrigger className="mt-0.5 h-8 min-w-48 border-0 bg-transparent px-0 text-sm font-bold text-[#183451] shadow-none focus-visible:ring-0">
                  <SelectValue placeholder="Seleccionar organización" />
                </SelectTrigger>
                <SelectContent>{organizations.filter((organization) => organization.status === "active").map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {currentUser?.platformAccess && <Button asChild variant="ghost" className="rounded-xl text-[#1769e0]"><Link href="/platform"><PanelsTopLeft className="size-4" />Panel KitchenMind</Link></Button>}
            {currentOrganization?.activeModules.includes("personnel") && <Button asChild variant="outline" className="rounded-xl border-[#cfe0ef] bg-white"><Link href="/kiosk/asistencia">Asistencia <ExternalLink className="size-4" /></Link></Button>}
            <Button variant="ghost" className="rounded-xl text-[#60758b]" onClick={() => { signOut(); router.replace("/demo/login"); }} title={`Cerrar sesión de ${currentUser?.name ?? "usuario"}`}><LogOut className="size-4" /><span className="hidden xl:inline">Salir</span></Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
