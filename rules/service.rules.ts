import type { ServiceType } from "@/types";
import { minutesFromTime } from "@/utils/date";

function localMinutes(timestamp: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp));
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hours * 60 + minutes;
}

export function isWithinServiceWindow(timestamp: string, serviceType: ServiceType, timezone: string): boolean {
  const current = localMinutes(timestamp, timezone);
  const start = minutesFromTime(serviceType.startTime);
  const end = minutesFromTime(serviceType.endTime);
  return end >= start ? current >= start && current <= end : current >= start || current <= end;
}

export function resolveCurrentServiceType(serviceTypes: ServiceType[], input: { organizationId: string; branchId: string; timestamp: string; timezone: string }): ServiceType | null {
  const candidates = serviceTypes.filter(
    (serviceType) => serviceType.organizationId === input.organizationId && serviceType.status === "active" && (!serviceType.branchId || serviceType.branchId === input.branchId),
  );
  const branchSpecific = candidates.filter((serviceType) => serviceType.branchId === input.branchId);
  return branchSpecific.find((serviceType) => isWithinServiceWindow(input.timestamp, serviceType, input.timezone)) ?? candidates.find((serviceType) => isWithinServiceWindow(input.timestamp, serviceType, input.timezone)) ?? null;
}
