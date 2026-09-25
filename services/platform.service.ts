import type { KitchenMindDataProvider } from "@/repositories";
import type { Branch, ModuleKey, Organization, Permission, Subscription, User } from "@/types";
import { recordAudit } from "./audit.service";

const OWNER_PERMISSIONS: Permission[] = [
  "dashboard.read",
  "employees.read",
  "employees.write",
  "attendance.read",
  "attendance.adjust",
  "services.read",
  "services.override",
  "inventory.read",
  "inventory.write",
  "purchases.read",
  "purchases.write",
  "quality.read",
  "quality.write",
  "audit.read",
  "settings.manage",
];

export interface OrganizationProvisionDraft {
  name: string;
  businessProfileId: string;
  planId: string;
  countryCode: string;
  timezone: string;
  currency: string;
  estimatedEmployees: number;
  plannedBranches: number;
  activeModules: ModuleKey[];
  branchName: string;
  branchCode: string;
  branchAddress?: string;
  adminName: string;
  adminEmail: string;
  trialDays: number;
}

export interface OrganizationProvisionResult {
  organization: Organization;
  branch: Branch;
  admin: User;
  subscription: Subscription;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString();
}

async function requirePlatformOperator(provider: KitchenMindDataProvider, actorUserId: string): Promise<User> {
  const actor = await provider.users.getById(actorUserId);
  if (!actor || actor.status !== "active" || !actor.platformAccess) {
    throw new Error("Este panel es exclusivo del equipo autorizado de KitchenMind.");
  }
  return actor;
}

export async function provisionOrganization(
  provider: KitchenMindDataProvider,
  actorUserId: string,
  draft: OrganizationProvisionDraft,
): Promise<OrganizationProvisionResult> {
  await requirePlatformOperator(provider, actorUserId);
  const name = draft.name.trim();
  const slug = slugify(name);
  const adminEmail = draft.adminEmail.trim().toLowerCase();
  const branchName = draft.branchName.trim();
  const branchCode = draft.branchCode.trim().toUpperCase();

  if (!name || !slug || !branchName || !branchCode || !draft.adminName.trim()) {
    throw new Error("Completa la empresa, primera sucursal y administrador.");
  }
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error("Escribe un correo administrativo válido.");
  if (!draft.activeModules.includes("core")) throw new Error("El núcleo CORE siempre debe permanecer activo.");
  if (draft.estimatedEmployees < 0 || draft.plannedBranches < 1) throw new Error("Revisa el tamaño estimado de la operación.");

  const [profile, plan, organizations] = await Promise.all([
    provider.businessProfiles.getById(draft.businessProfileId),
    provider.plans.getById(draft.planId),
    provider.organizations.list(),
  ]);
  if (!profile || profile.status !== "active") throw new Error("El perfil de negocio no está disponible.");
  if (!plan || plan.status !== "active") throw new Error("El plan seleccionado no está disponible.");
  if (organizations.some((organization) => organization.slug === slug)) throw new Error("Ya existe una organización con ese identificador.");

  const unavailableModules = draft.activeModules.filter((module) => !plan.includedModules.includes(module));
  if (unavailableModules.length > 0) throw new Error("El plan seleccionado no incluye todos los módulos activos.");
  if (plan.limits.branches !== null && draft.plannedBranches > plan.limits.branches) throw new Error("El número de sucursales supera el límite del plan.");
  if (plan.limits.employees !== null && draft.estimatedEmployees > plan.limits.employees) throw new Error("El número de empleados supera el límite del plan.");

  const organization = await provider.organizations.create({
    name,
    slug,
    businessProfileId: profile.id,
    planId: plan.id,
    countryCode: draft.countryCode,
    timezone: draft.timezone,
    currency: draft.currency,
    estimatedEmployees: draft.estimatedEmployees,
    plannedBranches: draft.plannedBranches,
    onboardingStatus: "in_progress",
    activeModules: [...new Set(draft.activeModules)],
    status: "active",
    createdBy: actorUserId,
  });
  const branch = await provider.branches.create({
    organizationId: organization.id,
    name: branchName,
    code: branchCode,
    timezone: draft.timezone,
    address: draft.branchAddress?.trim() || undefined,
    status: "active",
    createdBy: actorUserId,
  });
  const role = await provider.roles.create({
    organizationId: organization.id,
    name: "Dueño",
    permissions: OWNER_PERMISSIONS,
    status: "active",
    createdBy: actorUserId,
  });
  const admin = await provider.users.create({
    organizationId: organization.id,
    name: draft.adminName.trim(),
    email: adminEmail,
    roleId: role.id,
    branchIds: [branch.id],
    status: "active",
    createdBy: actorUserId,
  });
  const now = new Date();
  const trialEndsAt = addDays(now, Math.max(0, draft.trialDays));
  const currentPeriodEnd = addDays(now, draft.trialDays > 0 ? draft.trialDays : 30);
  const subscription = await provider.subscriptions.create({
    organizationId: organization.id,
    planId: plan.id,
    status: draft.trialDays > 0 ? "trialing" : "active",
    billingCycle: "monthly",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd,
    trialEndsAt: draft.trialDays > 0 ? trialEndsAt : undefined,
    provider: "manual",
    createdBy: actorUserId,
  });
  await recordAudit(provider, {
    organizationId: organization.id,
    branchId: branch.id,
    actorId: actorUserId,
    action: "platform.organization.provisioned",
    entity: "organization",
    entityId: organization.id,
    after: organization,
    reason: `Alta desde el panel KitchenMind con perfil ${profile.name} y plan ${plan.name}.`,
  });

  return { organization, branch, admin, subscription };
}
