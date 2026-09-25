import type { AttentionSeverity, DashboardPeriod, DashboardWidgetSize } from "@/types";

export const DASHBOARD_PERIODS: DashboardPeriod[] = ["today", "last_7_days", "last_30_days"];
export const DASHBOARD_SIZES: DashboardWidgetSize[] = ["small", "medium", "large", "full"];

export interface RoleDashboardDefault {
  roleCode: string;
  presetCode: string;
  priority: number;
}

export interface BusinessProfileDashboardDefault {
  businessProfileCode: string;
  presetCode: string;
}

export type DashboardLayoutConstraints = Record<string, {
  supportedSizes: DashboardWidgetSize[];
  defaultSize: DashboardWidgetSize;
}>;

export function resolveDefaultPreset(
  roleCodes: string[],
  businessProfileCode: string,
  branchCount: number,
  roleDefaults: RoleDashboardDefault[],
  businessProfileDefaults: BusinessProfileDashboardDefault[],
): { presetCode: string; reason: string } {
  const assignedRoles = new Set(roleCodes);
  const roleMatch = roleDefaults
    .filter((value) => assignedRoles.has(value.roleCode))
    .sort((a, b) => a.priority - b.priority)[0];
  if (roleMatch) {
    const presetCode = roleMatch.presetCode === "direction_general" && branchCount > 1 ? "direction_multibranch" : roleMatch.presetCode;
    return { presetCode, reason: `Vista predeterminada por rol${branchCount > 1 && presetCode === "direction_multibranch" ? " y operación multisucursal" : ""}.` };
  }
  const profileMatch = businessProfileDefaults.find((value) => value.businessProfileCode === businessProfileCode);
  return profileMatch
    ? { presetCode: profileMatch.presetCode, reason: "Vista predeterminada por perfil de negocio." }
    : { presetCode: "operator", reason: "Vista operativa segura predeterminada." };
}

export function normalizeDashboardPeriod(value: string | null | undefined): DashboardPeriod {
  return DASHBOARD_PERIODS.includes(value as DashboardPeriod) ? value as DashboardPeriod : "today";
}

export function normalizeDashboardLayout(
  input: unknown,
  allowedCodes: string[],
  constraints: DashboardLayoutConstraints = {},
): Array<{ code: string; visible: boolean; size: DashboardWidgetSize; position: number }> {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(allowedCodes);
  const used = new Set<string>();
  return input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const code = typeof value.code === "string" ? value.code : "";
      if (!allowed.has(code) || used.has(code)) return null;
      used.add(code);
      const constraint = constraints[code];
      const supportedSizes = (constraint?.supportedSizes ?? DASHBOARD_SIZES).filter((size) => DASHBOARD_SIZES.includes(size));
      const defaultSize = constraint && supportedSizes.includes(constraint.defaultSize) ? constraint.defaultSize : supportedSizes[0] ?? "medium";
      const size = supportedSizes.includes(value.size as DashboardWidgetSize) ? value.size as DashboardWidgetSize : defaultSize;
      return { code, visible: value.visible !== false, size, position: Number.isInteger(value.position) && Number(value.position) >= 0 ? Number(value.position) : index };
    })
    .filter((item): item is { code: string; visible: boolean; size: DashboardWidgetSize; position: number } => item !== null)
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({ ...item, position: index }));
}

export function severityRank(severity: AttentionSeverity): number {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

export function sortAttention<T extends { severity: AttentionSeverity; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.title.localeCompare(b.title, "es"));
}

export function dashboardAuthorizationStamp(
  scopes: Array<{ type: string; id: string | null; accessMode: string }>,
  branches: Array<{ id: string; code: string; name: string; timezone: string; status: string }>,
): string {
  return JSON.stringify({
    scopes: scopes.map((scope) => `${scope.type}:${scope.id ?? "*"}:${scope.accessMode}`).sort(),
    branches: branches.map((branch) => `${branch.id}:${branch.code}:${branch.name}:${branch.timezone}:${branch.status}`).sort(),
  });
}

export function normalizeDashboardTimezone(value: string | null | undefined, fallback = "UTC"): string {
  for (const candidate of [value, fallback, "UTC"]) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat("en", { timeZone: candidate }).format(new Date(0));
      return candidate;
    } catch {
      // Try the next trusted fallback.
    }
  }
  return "UTC";
}

export function periodStartForTimezone(period: DashboardPeriod, timezone: string, now = new Date()): string {
  const timeZone = normalizeDashboardTimezone(timezone);
  const calendarFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const currentParts = Object.fromEntries(calendarFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  const localCalendarDate = new Date(Date.UTC(Number(currentParts.year), Number(currentParts.month) - 1, Number(currentParts.day)));
  if (period !== "today") localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() - (period === "last_7_days" ? 6 : 29));

  const desiredWallTime = Date.UTC(localCalendarDate.getUTCFullYear(), localCalendarDate.getUTCMonth(), localCalendarDate.getUTCDate());
  const wallFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let candidate = desiredWallTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(wallFormatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const correction = desiredWallTime - representedWallTime;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate).toISOString();
}
