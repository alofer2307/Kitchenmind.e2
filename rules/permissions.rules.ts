import type { Permission, Role } from "@/types";

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  return Boolean(role?.status === "active" && role.permissions.includes(permission));
}
