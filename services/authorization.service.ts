import type { KitchenMindDataProvider } from "@/repositories";
import type { Permission } from "@/types";
import { hasPermission } from "@/rules/permissions.rules";

export async function requirePermission(provider: KitchenMindDataProvider, actorId: string, permission: Permission): Promise<void> {
  const actor = await provider.users.getById(actorId);
  if (!actor || actor.status !== "active") throw new Error("El usuario no tiene una sesión administrativa activa.");
  const role = await provider.roles.getById(actor.roleId);
  if (!hasPermission(role ?? undefined, permission)) throw new Error("No tienes permiso para realizar esta acción.");
}
