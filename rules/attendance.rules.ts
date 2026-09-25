import type { AttendanceEvent, AttendanceEventType, Shift } from "@/types";
import { minutesFromTime, toDateKey } from "@/utils/date";

export interface AttendancePolicy {
  duplicateWindowSeconds: number;
  timezone: string;
}

export type AttendanceDecision =
  | { kind: "register"; eventType: Exclude<AttendanceEventType, "manual_adjustment"> }
  | { kind: "duplicate"; previousEvent: AttendanceEvent };

function localMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isLateForShift(timestamp: string, shift: Shift, timezone: string): boolean {
  const current = localMinutes(new Date(timestamp), timezone);
  const start = minutesFromTime(shift.startTime);
  const end = minutesFromTime(shift.endTime);
  const effectiveCurrent = end <= start && current <= end ? current + 1_440 : current;
  return effectiveCurrent > start + shift.toleranceMinutes;
}

export function decideAttendanceEvent(events: AttendanceEvent[], shift: Shift, timestamp: string, policy: AttendancePolicy): AttendanceDecision {
  const ordered = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const previous = ordered[0];
  if (previous) {
    const elapsed = new Date(timestamp).getTime() - new Date(previous.timestamp).getTime();
    if (elapsed >= 0 && elapsed < policy.duplicateWindowSeconds * 1_000) return { kind: "duplicate", previousEvent: previous };
  }

  const today = toDateKey(timestamp);
  const todayEvents = ordered.filter((event) => toDateKey(event.timestamp) === today);
  const latestOperational = todayEvents.find((event) => event.eventType !== "manual_adjustment");
  if (latestOperational && (latestOperational.eventType === "entry" || latestOperational.eventType === "late")) {
    return { kind: "register", eventType: "exit" };
  }
  return { kind: "register", eventType: isLateForShift(timestamp, shift, policy.timezone) ? "late" : "entry" };
}
