"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, CreditCard, KeyRound, LogOut, Plus, Settings2, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/brand-mark";
import { CommercialOverviewPanel } from "@/components/platform/commercial-overview-panel";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODULE_DESCRIPTIONS, MODULE_KEYS, MODULE_LABELS } from "@/constants/modules";
import { useDataProvider } from "@/contexts/data-provider-context";
import { useOrganizationSelection } from "@/contexts/organization-context";
import { useAllBranches, useBusinessProfiles, useOrganizations, usePlans, useSubscriptions, useUsers } from "@/hooks/use-kitchenmind-data";
import { provisionOrganization, type OrganizationProvisionDraft } from "@/services/platform.service";
import type { BusinessProfile, ModuleKey, Plan, PlatformIdentitySummary, PlatformSecuritySnapshot, SubscriptionStatus } from "@/types";
import { formatMoney } from "@/utils/money";

const STEP_LABELS = ["Perfil", "Empresa", "Plan y módulos", "Activación"];

function blankDraft(profiles: BusinessProfile[], plans: Plan[]): OrganizationProvisionDraft {
  const profile = profiles.find((item) => item.key === "industrial_canteen") ?? profiles[0];
  const plan = plans.find((item) => item.code === "operation") ?? plans[0];
  const activeModules = profile && plan
    ? profile.recommendedModules.filter((module) => plan.includedModules.includes(module))
    : (["core"] satisfies ModuleKey[]);
  return {
    name: "",
    businessProfileId: profile?.id ?? "",
    planId: plan?.id ?? "",
    countryCode: "MX",
    timezone: "America/Chihuahua",
    currency: "MXN",
    estimatedEmployees: 50,
    plannedBranches: 1,
    activeModules: activeModules.includes("core") ? activeModules : ["core", ...activeModules],
    branchName: "Sucursal principal",
    branchCode: "PRINCIPAL",
    branchAddress: "",
    adminName: "",
    adminEmail: "",
    trialDays: 30,
  };
}

export function PlatformScreen({ identity, security, signOutHref }: { identity: PlatformIdentitySummary; security: PlatformSecuritySnapshot; signOutHref: string }) {
  const router = useRouter();
  const { provider } = useDataProvider();
  const { selectOrganization } = useOrganizationSelection();
  const { data: users } = useUsers();
  const { data: organizations } = useOrganizations();
  const { data: branches } = useAllBranches();
  const { data: profiles } = useBusinessProfiles();
  const { data: plans } = usePlans();
  const { data: subscriptions } = useSubscriptions();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [draft, setDraft] = useState<OrganizationProvisionDraft>(() => blankDraft([], []));
  const localPlatformActor = users.find((user) => user.platformAccess === "owner" && user.status === "active");

  const startWizard = () => {
    setDraft(blankDraft(profiles, plans));
    setStep(0);
    setWizardOpen(true);
  };

  const activeOrganizations = organizations.filter((organization) => organization.status === "active");
  const trialCount = subscriptions.filter((subscription) => subscription.status === "trialing").length;
  const provisionedModules = activeOrganizations.reduce((total, organization) => total + organization.activeModules.length, 0);

  return (
    <main className="min-h-screen bg-[#f4f8fc]">
      <header className="sticky top-0 z-30 border-b border-[#dbe7f2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1500px] items-center justify-between px-4 md:px-7">
          <div className="flex items-center gap-4"><BrandMark /><Badge className="hidden bg-[#e8f2ff] text-[#1769e0] sm:inline-flex">Control interno</Badge></div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right lg:block"><p className="text-sm font-extrabold text-[#203a57]">{identity.displayName}</p><p className="text-xs text-[#71869a]">{identity.email}</p></div>
            <Button variant="outline" className="rounded-xl" onClick={() => setSecurityOpen(true)}><ShieldCheck className="size-4" /><span className="hidden sm:inline">Seguridad</span></Button>
            <Button asChild variant="outline" className="rounded-xl"><Link href="/"><ArrowLeft className="size-4" />Administración</Link></Button>
            <Button variant="ghost" size="icon" aria-label="Cerrar sesión segura" onClick={() => void securePlatformSignOut(signOutHref)}><LogOut className="size-4" /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-7 p-4 md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">KitchenMind Platform</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Centro de control de la fundadora</h1><p className="mt-2 max-w-2xl text-base text-[#6a7e94]">Vende KitchenMind con un proceso repetible y conserva la operación existente para los siguientes sprints.</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild className="h-11 rounded-xl"><Link href="/platform/prospectos/nuevo"><Plus className="size-4" />Nuevo prospecto</Link></Button><Button asChild variant="outline" className="h-11 rounded-xl"><Link href="/platform/organizaciones"><Building2 className="size-4" />Aprovisionamiento</Link></Button><Button variant="outline" className="h-11 rounded-xl" onClick={startWizard} disabled={!profiles.length || !plans.length || !localPlatformActor}><Building2 className="size-4" />Laboratorio demo</Button></div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-[#dbe7f2] bg-white p-2"><Button asChild variant="ghost" size="sm"><Link href="/platform/prospectos">Prospectos</Link></Button><Button asChild variant="ghost" size="sm"><Link href="/platform/cotizaciones">Cotizaciones</Link></Button><Button asChild variant="ghost" size="sm"><Link href="/platform/organizaciones">Organizaciones</Link></Button><Button asChild variant="ghost" size="sm"><Link href="/platform/catalogo">Catálogo</Link></Button><Button asChild variant="ghost" size="sm"><Link href="/platform/precios">Precios</Link></Button></div>

        <CommercialOverviewPanel />

        <div className="pt-2"><div className="mb-4"><h2 className="text-xl font-black text-[#183451]">Laboratorio de organizaciones</h2><p className="mt-1 text-sm text-[#6a7e94]">Función demostrativa heredada del Sprint A. La provisión productiva desde cotización pertenece al Sprint C.</p></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PlatformMetric icon={Building2} label="Organizaciones activas" value={activeOrganizations.length} detail="Un solo núcleo multiempresa" />
          <PlatformMetric icon={Store} label="Sucursales" value={branches.filter((branch) => branch.status === "active").length} detail="Plantas y unidades registradas" />
          <PlatformMetric icon={CreditCard} label="En prueba" value={trialCount} detail="Suscripciones en periodo inicial" />
          <PlatformMetric icon={Settings2} label="Módulos habilitados" value={provisionedModules} detail="Configurados por organización" />
        </section></div>

        <Card className="rounded-[1.4rem] border-[#dbe7f2] shadow-[0_12px_35px_rgba(24,52,81,.05)]">
          <CardContent className="p-0">
            <DataTable
              headers={["Organización", "Perfil", "Plan", "Sucursales", "Módulos", "Suscripción", "Acción"]}
              emptyMessage="Aún no existen organizaciones."
              rows={organizations.map((organization) => {
                const profile = profiles.find((item) => item.id === organization.businessProfileId);
                const plan = plans.find((item) => item.id === organization.planId);
                const subscription = subscriptions.find((item) => item.organizationId === organization.id);
                return [
                  <div key={`${organization.id}-name`}><p className="font-bold text-[#203a57]">{organization.name}</p><p className="text-xs text-[#7b8da0]">{organization.onboardingStatus === "ready" ? "Configuración completa" : "Onboarding pendiente"}</p></div>,
                  profile?.name ?? "Sin perfil",
                  <div key={`${organization.id}-plan`}><p className="font-bold text-[#314b65]">{plan?.name ?? "Sin plan"}</p><p className="text-xs text-[#7b8da0]">{plan?.monthlyPrice ? `${formatMoney(plan.monthlyPrice)} / mes` : "Precio personalizado"}</p></div>,
                  branches.filter((branch) => branch.organizationId === organization.id).length,
                  organization.activeModules.length,
                  <SubscriptionBadge key={`${organization.id}-subscription`} status={subscription?.status ?? "cancelled"} />,
                  <Button key={`${organization.id}-open`} variant="outline" size="sm" className="rounded-lg" onClick={() => { selectOrganization(organization.id); router.push("/"); }}>Entrar <ArrowRight className="size-4" /></Button>,
                ];
              })}
            />
          </CardContent>
        </Card>
      </div>

      <OrganizationWizard open={wizardOpen} step={step} draft={draft} profiles={profiles} plans={plans} saving={saving} onOpenChange={setWizardOpen} onStepChange={setStep} onDraftChange={setDraft} onSubmit={async () => {
        try {
          if (!localPlatformActor) throw new Error("El catálogo demostrativo todavía no está disponible.");
          setSaving(true);
          const result = await provisionOrganization(provider, localPlatformActor.id, draft);
          selectOrganization(result.organization.id);
          setWizardOpen(false);
          toast.success(`${result.organization.name} quedó creada y lista para continuar su configuración.`);
          router.push("/configuracion");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No fue posible crear la organización.");
        } finally {
          setSaving(false);
        }
      }} />
      <PlatformSecurityDialog open={securityOpen} onOpenChange={setSecurityOpen} identity={identity} initialSecurity={security} signOutHref={signOutHref} />
    </main>
  );
}

function OrganizationWizard({ open, step, draft, profiles, plans, saving, onOpenChange, onStepChange, onDraftChange, onSubmit }: { open: boolean; step: number; draft: OrganizationProvisionDraft; profiles: BusinessProfile[]; plans: Plan[]; saving: boolean; onOpenChange: (open: boolean) => void; onStepChange: (step: number) => void; onDraftChange: (draft: OrganizationProvisionDraft) => void; onSubmit: () => Promise<void> }) {
  const selectedProfile = profiles.find((profile) => profile.id === draft.businessProfileId);
  const selectedPlan = plans.find((plan) => plan.id === draft.planId);
  const set = <K extends keyof OrganizationProvisionDraft>(key: K, value: OrganizationProvisionDraft[K]) => onDraftChange({ ...draft, [key]: value });
  const chooseProfile = (profile: BusinessProfile) => {
    const permitted = selectedPlan ? profile.recommendedModules.filter((module) => selectedPlan.includedModules.includes(module)) : profile.recommendedModules;
    onDraftChange({ ...draft, businessProfileId: profile.id, activeModules: permitted.includes("core") ? permitted : ["core", ...permitted] });
  };
  const choosePlan = (plan: Plan) => {
    const recommended = selectedProfile?.recommendedModules ?? ["core"];
    const permitted = recommended.filter((module) => plan.includedModules.includes(module));
    onDraftChange({ ...draft, planId: plan.id, activeModules: permitted.includes("core") ? permitted : ["core", ...permitted] });
  };
  const canContinue = step === 0
    ? Boolean(draft.businessProfileId)
    : step === 1
      ? Boolean(draft.name.trim()) && draft.plannedBranches > 0 && draft.estimatedEmployees >= 0
      : step === 2
        ? Boolean(draft.planId) && draft.activeModules.includes("core")
        : Boolean(draft.branchName.trim() && draft.branchCode.trim() && draft.adminName.trim() && /^\S+@\S+\.\S+$/.test(draft.adminEmail));

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[94vh] overflow-y-auto rounded-2xl sm:max-w-3xl"><DialogHeader><div className="flex items-center justify-between gap-4 pr-7"><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#169b99]">Paso {step + 1} de {STEP_LABELS.length}</p><DialogTitle className="mt-1">{STEP_LABELS[step]}</DialogTitle></div><span className="text-sm font-bold text-[#6a7e94]">{Math.round(((step + 1) / STEP_LABELS.length) * 100)}%</span></div><Progress value={((step + 1) / STEP_LABELS.length) * 100} className="mt-3" /><DialogDescription>La configuración es editable; el perfil sólo prepara un punto de partida.</DialogDescription></DialogHeader>
    <div className="py-2">
      {step === 0 && <div className="grid gap-3 sm:grid-cols-2">{profiles.filter((profile) => profile.status === "active").map((profile) => <button type="button" key={profile.id} onClick={() => chooseProfile(profile)} className={`rounded-2xl border p-4 text-left transition ${draft.businessProfileId === profile.id ? "border-[#1769e0] bg-[#edf5ff] ring-2 ring-[#1769e0]/15" : "border-[#dbe7f2] bg-white hover:border-[#9fc4ec]"}`}><div className="flex items-start justify-between gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-white text-[#1769e0]"><Store className="size-5" /></div>{draft.businessProfileId === profile.id && <span className="flex size-6 items-center justify-center rounded-full bg-[#1769e0] text-white"><Check className="size-4" /></span>}</div><p className="mt-3 font-extrabold text-[#183451]">{profile.name}</p><p className="mt-1 text-sm leading-5 text-[#6a7e94]">{profile.description}</p></button>)}</div>}
      {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre comercial" wide><Input value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="Ej. Comedores del Norte" /></Field><Field label="País"><Select value={draft.countryCode} onValueChange={(value) => set("countryCode", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MX">México</SelectItem></SelectContent></Select></Field><Field label="Zona horaria"><Select value={draft.timezone} onValueChange={(value) => set("timezone", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="America/Chihuahua">Chihuahua</SelectItem><SelectItem value="America/Mexico_City">Centro de México</SelectItem><SelectItem value="America/Tijuana">Tijuana</SelectItem><SelectItem value="America/Cancun">Cancún</SelectItem></SelectContent></Select></Field><Field label="Sucursales previstas"><Input type="number" min={1} value={draft.plannedBranches} onChange={(event) => set("plannedBranches", Number(event.target.value))} /></Field><Field label="Empleados estimados"><Input type="number" min={0} value={draft.estimatedEmployees} onChange={(event) => set("estimatedEmployees", Number(event.target.value))} /></Field></div>}
      {step === 2 && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3">{plans.filter((plan) => plan.status === "active").map((plan) => <button type="button" key={plan.id} onClick={() => choosePlan(plan)} className={`rounded-2xl border p-4 text-left ${draft.planId === plan.id ? "border-[#1769e0] bg-[#edf5ff] ring-2 ring-[#1769e0]/15" : "border-[#dbe7f2] bg-white"}`}><p className="font-extrabold text-[#183451]">{plan.name}</p><p className="mt-1 text-xl font-black text-[#1769e0]">{plan.monthlyPrice ? formatMoney(plan.monthlyPrice) : "A medida"}</p><p className="mt-2 text-xs leading-5 text-[#6a7e94]">{plan.description}</p></button>)}</div><div><p className="font-extrabold text-[#183451]">Módulos incluidos</p><p className="mt-1 text-sm text-[#6a7e94]">Activa solamente lo que esta empresa necesita ahora.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{MODULE_KEYS.map((module) => { const included = selectedPlan?.includedModules.includes(module) ?? false; const checked = draft.activeModules.includes(module); return <label key={module} className={`flex gap-3 rounded-2xl border p-3 ${included ? "border-[#dbe7f2] bg-white" : "border-[#edf0f3] bg-[#f7f8fa] opacity-55"}`}><Checkbox checked={checked} disabled={!included || module === "core"} onCheckedChange={(next) => set("activeModules", next ? [...draft.activeModules, module] : draft.activeModules.filter((item) => item !== module))} className="mt-1" /><span><span className="block text-sm font-bold text-[#314b65]">{MODULE_LABELS[module]}</span><span className="mt-0.5 block text-xs leading-4 text-[#75879a]">{MODULE_DESCRIPTIONS[module]}</span></span></label>; })}</div></div></div>}
      {step === 3 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Primera sucursal"><Input value={draft.branchName} onChange={(event) => set("branchName", event.target.value)} /></Field><Field label="Código"><Input value={draft.branchCode} onChange={(event) => set("branchCode", event.target.value.toUpperCase())} /></Field><Field label="Dirección" wide><Input value={draft.branchAddress} onChange={(event) => set("branchAddress", event.target.value)} placeholder="Opcional" /></Field><Field label="Administrador"><Input value={draft.adminName} onChange={(event) => set("adminName", event.target.value)} placeholder="Nombre completo" /></Field><Field label="Correo administrativo"><Input type="email" value={draft.adminEmail} onChange={(event) => set("adminEmail", event.target.value)} placeholder="administracion@empresa.mx" /></Field><Field label="Periodo de prueba"><Select value={String(draft.trialDays)} onValueChange={(value) => set("trialDays", Number(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Sin periodo de prueba</SelectItem><SelectItem value="15">15 días</SelectItem><SelectItem value="30">30 días</SelectItem><SelectItem value="60">60 días</SelectItem></SelectContent></Select></Field><div className="rounded-2xl border border-[#cfe7e6] bg-[#f0fbfa] p-4 sm:col-span-2"><p className="font-extrabold text-[#183451]">Lista para provisionar</p><p className="mt-1 text-sm leading-5 text-[#60758b]">{draft.name || "La organización"} iniciará con {selectedProfile?.name ?? "el perfil elegido"}, plan {selectedPlan?.name ?? "seleccionado"}, {draft.activeModules.length} módulos y una primera sucursal. El cliente continuará cargando turnos, personal y catálogos.</p></div></div>}
    </div>
    <DialogFooter className="gap-2 sm:justify-between"><Button variant="outline" onClick={() => step === 0 ? onOpenChange(false) : onStepChange(step - 1)}>{step === 0 ? "Cancelar" : "Anterior"}</Button>{step < STEP_LABELS.length - 1 ? <Button disabled={!canContinue} onClick={() => onStepChange(step + 1)}>Continuar <ArrowRight className="size-4" /></Button> : <Button disabled={!canContinue || saving} onClick={() => void onSubmit()}>{saving ? "Creando organización…" : "Crear y activar"}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}

function PlatformMetric({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: number; detail: string }) { return <Card className="rounded-[1.3rem] border-[#dbe7f2]"><CardContent className="p-5"><div className="flex size-10 items-center justify-center rounded-xl bg-[#e8f3ff] text-[#1769e0]"><Icon className="size-5" /></div><p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#183451]">{value}</p><p className="mt-1 text-sm font-bold text-[#314b65]">{label}</p><p className="mt-1 text-xs text-[#7b8da0]">{detail}</p></CardContent></Card>; }

function SubscriptionBadge({ status }: { status: SubscriptionStatus }) { const labels: Record<SubscriptionStatus, string> = { trialing: "Prueba", active: "Activa", past_due: "Pago pendiente", grace_period: "Periodo de gracia", suspended: "Suspendida", cancelled: "Cancelada" }; const tone = status === "active" ? "bg-[#e4faf4] text-[#087c65]" : status === "trialing" ? "bg-[#e8f2ff] text-[#1769e0]" : status === "past_due" || status === "grace_period" ? "bg-[#fff4d9] text-[#9a6300]" : "bg-[#eef1f4] text-[#667789]"; return <Badge className={tone}>{labels[status]}</Badge>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>; }

function PlatformSecurityDialog({ open, onOpenChange, identity, initialSecurity, signOutHref }: { open: boolean; onOpenChange: (open: boolean) => void; identity: PlatformIdentitySummary; initialSecurity: PlatformSecuritySnapshot; signOutHref: string }) {
  const [activeSessions, setActiveSessions] = useState(initialSecurity.activeSessionCount);
  const [revoking, setRevoking] = useState(false);
  const revokeOthers = async () => {
    setRevoking(true);
    try {
      const response = await fetch("/api/platform/security/revoke-others", { method: "POST", credentials: "same-origin" });
      const body = await response.json() as { revokedCount?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No fue posible cerrar las otras sesiones.");
      setActiveSessions(1);
      toast.success(body.revokedCount ? `${body.revokedCount} sesión${body.revokedCount === 1 ? "" : "es"} cerrada${body.revokedCount === 1 ? "" : "s"}.` : "No había otras sesiones activas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible cerrar las sesiones.");
    } finally {
      setRevoking(false);
    }
  };
  const actionLabels: Record<string, string> = {
    "platform.owner.bootstrapped": "Cuenta propietaria activada",
    "platform.mfa.enrolled": "Autenticador vinculado",
    "platform.mfa.verified": "Acceso verificado",
    "platform.mfa.failed": "Intento de verificación fallido",
    "platform.recovery_code.used": "Código de recuperación utilizado",
    "platform.sessions.others_revoked": "Otras sesiones cerradas",
    "platform.session.revoked": "Sesión cerrada",
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-2xl"><DialogHeader><DialogTitle>Seguridad de KitchenMind Platform</DialogTitle><DialogDescription>Controles exclusivos de la cuenta fundadora; las organizaciones cliente no comparten estas sesiones.</DialogDescription></DialogHeader><div className="grid gap-3 py-2 sm:grid-cols-3"><SecurityFact icon={ShieldCheck} label="Segundo factor" value={initialSecurity.mfaEnabled ? "Activo" : "Pendiente"} /><SecurityFact icon={KeyRound} label="Sesiones activas" value={String(activeSessions)} /><SecurityFact icon={LogOut} label="Esta sesión vence" value={new Date(initialSecurity.currentSessionExpiresAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} /></div><div className="rounded-2xl border border-[#dbe7f2] bg-[#f6f9fc] p-4"><p className="text-sm font-extrabold text-[#203a57]">Cuenta protegida</p><p className="mt-1 text-sm text-[#687d92]">{identity.displayName} · {identity.email}</p><p className="mt-2 text-xs leading-5 text-[#71869a]">La recuperación de la identidad principal se gestiona con tu cuenta de OpenAI. Los códigos de recuperación de KitchenMind sustituyen únicamente el segundo factor.</p><Button variant="outline" className="mt-4 rounded-xl" disabled={revoking || activeSessions <= 1} onClick={() => void revokeOthers()}>{revoking ? "Cerrando…" : "Cerrar otras sesiones"}</Button></div><div><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[#203a57]">Actividad de seguridad reciente</p><Badge className={initialSecurity.failedAttemptsLast24Hours ? "bg-[#fff0ea] text-[#a34424]" : "bg-[#e4faf4] text-[#087c65]"}>{initialSecurity.failedAttemptsLast24Hours} intentos fallidos · 24 h</Badge></div><div className="mt-3 divide-y divide-[#e6edf4] rounded-2xl border border-[#dbe7f2] bg-white">{initialSecurity.recentEvents.length ? initialSecurity.recentEvents.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 p-3"><div><p className="text-sm font-bold text-[#314b65]">{actionLabels[event.action] ?? event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-[#71869a]">{event.reason}</p>}</div><time className="shrink-0 text-xs text-[#7b8da0]">{new Date(event.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>) : <p className="p-4 text-sm text-[#71869a]">La actividad aparecerá después de los primeros accesos.</p>}</div></div><DialogFooter className="gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button><Button variant="destructive" onClick={() => void securePlatformSignOut(signOutHref)}><LogOut className="size-4" />Cerrar sesión segura</Button></DialogFooter></DialogContent></Dialog>;
}

function SecurityFact({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) { return <div className="rounded-2xl border border-[#dbe7f2] bg-white p-4"><Icon className="size-5 text-[#1769e0]" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-[#7a8da3]">{label}</p><p className="mt-1 text-base font-extrabold text-[#183451]">{value}</p></div>; }

async function securePlatformSignOut(signOutHref: string): Promise<void> {
  try {
    await fetch("/api/platform/security/signout", { method: "POST", credentials: "same-origin" });
  } finally {
    window.location.assign(signOutHref);
  }
}
