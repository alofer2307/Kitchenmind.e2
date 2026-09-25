"use client";

import { ArrowRight, Building2, CheckCircle2, CircleAlert, Loader2, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTenancyQuery } from "@/hooks/use-tenancy";
import type { CustomerAccessSnapshot, CustomerOrganizationAccess } from "@/types";

const statusLabel: Record<string, string> = {
  provisioning: "Preparando espacio", onboarding: "Configuración inicial", ready_for_review: "En revisión", active: "Operación activa",
  restricted: "Acceso restringido", suspended: "Suspendida", cancelled: "Cancelada",
};

export function CustomerOrganizationSelector({ identityLabel, signOutHref }: { identityLabel: string; signOutHref: string }) {
  const query = useTenancyQuery<CustomerAccessSnapshot>("view=access", "customer");
  return <main className="min-h-screen bg-[#eef5f8]">
    <header className="border-b border-[#d7e5ec] bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-7"><BrandMark /><div className="flex items-center gap-3"><p className="hidden text-sm font-bold text-[#38516a] sm:block">{identityLabel}</p><Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><a href={signOutHref} target="_top" aria-label="Cerrar sesión"><LogOut className="size-4" /></a></Button></div></div></header>
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-7 sm:py-14">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#168c96]">Espacios autorizados</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-[-0.05em] text-[#0d2c49] sm:text-5xl">¿Dónde vas a trabajar hoy?</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[#647b8f]">Elige una organización. La selección se validará nuevamente en el servidor antes de mostrar cualquier dato.</p>
      {query.loading && !query.data ? <State loading title="Consultando tus membresías" detail="Solo mostraremos organizaciones autorizadas." /> : query.error || !query.data ? <State title="No pudimos cargar tus organizaciones" detail={query.error ?? "Intenta nuevamente."} /> : query.data.organizations.length ? <div className="mt-9 grid gap-4 md:grid-cols-2">{query.data.organizations.map((organization) => <OrganizationCard key={organization.id} organization={organization} />)}</div> : <State title="No hay organizaciones disponibles" detail="Tu cuenta no tiene una membresía activa. Pide al administrador que revise tu invitación." />}
    </section>
  </main>;
}

function OrganizationCard({ organization }: { organization: CustomerOrganizationAccess }) {
  const available = organization.membershipStatus === "active" && !["suspended", "cancelled"].includes(organization.status);
  const destination = ["active", "restricted"].includes(organization.status) ? `/app?organizationId=${encodeURIComponent(organization.id)}` : `/app/onboarding?organizationId=${encodeURIComponent(organization.id)}`;
  return <article className={`group rounded-[1.65rem] border bg-white p-5 shadow-[0_18px_45px_rgba(22,55,84,.06)] sm:p-6 ${available ? "border-[#d4e5ec]" : "border-[#ead9d3] opacity-80"}`}>
    <div className="flex items-start justify-between gap-4"><div className="flex size-12 items-center justify-center rounded-2xl bg-[#e7f5f6] text-[#148b93]"><Building2 className="size-6" /></div><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${organization.status === "active" ? "bg-[#e4f8f1] text-[#107761]" : organization.status === "suspended" ? "bg-[#fff0eb] text-[#a64c31]" : "bg-[#eaf2ff] text-[#1769d9]"}`}>{statusLabel[organization.status] ?? organization.status}</span></div>
    <h2 className="mt-5 text-xl font-black text-[#173653]">{organization.name}</h2>
    <p className="mt-1 text-sm text-[#6a8094]">{organization.primaryBranchName ?? "Sucursal pendiente"} · {organization.roleNames.join(", ") || "Sin rol"}</p>
    {organization.status !== "active" && !["suspended", "cancelled"].includes(organization.status) && <div className="mt-5"><div className="flex justify-between text-xs font-bold text-[#60788c]"><span>Preparación</span><span>{organization.onboardingProgress}%</span></div><Progress className="mt-2" value={organization.onboardingProgress} /></div>}
    <div className="mt-5 flex flex-wrap gap-2">{organization.moduleCodes.slice(0, 5).map((code) => <span key={code} className="rounded-lg bg-[#f1f6f9] px-2.5 py-1 text-xs font-bold text-[#4e687e]">{code}</span>)}</div>
    {available ? <Button asChild className="mt-6 h-11 w-full rounded-xl"><a href={destination}>Abrir espacio <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></a></Button> : <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#fff5f1] p-3 text-sm font-semibold text-[#955039]"><CircleAlert className="size-4" />Contacta al administrador</div>}
  </article>;
}

function State({ loading = false, title, detail }: { loading?: boolean; title: string; detail: string }) {
  return <div className="mt-9 rounded-[1.6rem] border border-dashed border-[#bad0dc] bg-white/70 p-10 text-center">{loading ? <Loader2 className="mx-auto size-7 animate-spin text-[#1769df]" /> : <CheckCircle2 className="mx-auto size-7 text-[#16969c]" />}<h2 className="mt-4 text-lg font-black text-[#173653]">{title}</h2><p className="mt-2 text-sm text-[#698094]">{detail}</p></div>;
}
