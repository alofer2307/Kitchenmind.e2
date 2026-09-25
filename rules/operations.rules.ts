export interface OperationalShiftConfig {
  startTime: string | null;
  endTime: string | null;
  toleranceMinutes: number;
  daysOfWeek: number[];
}

export interface OperationalServiceConfig {
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: number[];
  perPersonLimit: number;
}

export interface RecentAttendanceEvent {
  id: string;
  eventType: string;
  eventTimestamp: string;
  operationalDate: string;
}

export type OperationalAttendanceDecision =
  | { kind: "duplicate"; previousEventId: string; eventType: "entry" | "exit" | "late" | "incident" }
  | { kind: "register"; eventType: "entry" | "exit" | "late"; operationalDate: string };

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function validTime(value: unknown): string | null {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : null;
}

function integerBetween(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function days(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 6))).sort((a, b) => a - b);
}

export function shiftConfig(metadataJson: string | null | undefined): OperationalShiftConfig {
  const metadata = parseMetadata(metadataJson);
  return {
    startTime: validTime(metadata.startTime),
    endTime: validTime(metadata.endTime),
    toleranceMinutes: integerBetween(metadata.toleranceMinutes, 0, 240, 0),
    daysOfWeek: days(metadata.daysOfWeek),
  };
}

export function serviceConfig(metadataJson: string | null | undefined): OperationalServiceConfig {
  const metadata = parseMetadata(metadataJson);
  return {
    startTime: validTime(metadata.startTime),
    endTime: validTime(metadata.endTime),
    daysOfWeek: days(metadata.daysOfWeek),
    perPersonLimit: integerBetween(metadata.perPersonLimit, 1, 20, 1),
  };
}

function localParts(timestamp: string | Date, timezone: string): { year: number; month: number; day: number; weekday: number; minutes: number } {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) throw new Error("La fecha del evento no es válida.");
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday ?? ""] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function dateKey(parts: { year: number; month: number; day: number }): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function previousDateKey(parts: { year: number; month: number; day: number }): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function operationalDateForShift(timestamp: string, timezone: string, config: OperationalShiftConfig | null): string {
  const parts = localParts(timestamp, timezone);
  if (!config?.startTime || !config.endTime) return dateKey(parts);
  const start = minutesFromTime(config.startTime);
  const end = minutesFromTime(config.endTime);
  if (end <= start && parts.minutes <= end) return previousDateKey(parts);
  return dateKey(parts);
}

export function isServiceActive(timestamp: string, timezone: string, config: OperationalServiceConfig): boolean {
  if (!config.startTime || !config.endTime) return false;
  const parts = localParts(timestamp, timezone);
  const start = minutesFromTime(config.startTime);
  const end = minutesFromTime(config.endTime);
  const belongsToPreviousDay = end < start && parts.minutes <= end;
  let weekday = parts.weekday;
  if (belongsToPreviousDay) weekday = (weekday + 6) % 7;
  if (config.daysOfWeek.length && !config.daysOfWeek.includes(weekday)) return false;
  return end >= start ? parts.minutes >= start && parts.minutes <= end : parts.minutes >= start || parts.minutes <= end;
}

export function operationalDateForService(timestamp: string, timezone: string, config: OperationalServiceConfig): string {
  const parts = localParts(timestamp, timezone);
  if (!config.startTime || !config.endTime) return dateKey(parts);
  const start = minutesFromTime(config.startTime);
  const end = minutesFromTime(config.endTime);
  return end < start && parts.minutes <= end ? previousDateKey(parts) : dateKey(parts);
}

export function localOperationalDate(timestamp: string, timezone: string): string {
  return dateKey(localParts(timestamp, timezone));
}

export function decideOperationalAttendance(
  recentEvents: RecentAttendanceEvent[],
  timestamp: string,
  timezone: string,
  config: OperationalShiftConfig | null,
  duplicateWindowSeconds = 90,
): OperationalAttendanceDecision {
  const occurred = new Date(timestamp).getTime();
  if (!Number.isFinite(occurred)) throw new Error("La fecha de asistencia no es válida.");
  const ordered = [...recentEvents].sort((a, b) => new Date(b.eventTimestamp).getTime() - new Date(a.eventTimestamp).getTime());
  const previous = ordered[0];
  if (previous) {
    const elapsed = occurred - new Date(previous.eventTimestamp).getTime();
    if (elapsed >= 0 && elapsed < duplicateWindowSeconds * 1000 && ["entry", "exit", "late", "incident"].includes(previous.eventType)) {
      return { kind: "duplicate", previousEventId: previous.id, eventType: previous.eventType as "entry" | "exit" | "late" | "incident" };
    }
  }
  const operationalDate = operationalDateForShift(timestamp, timezone, config);
  const sameDay = ordered.filter((event) => event.operationalDate === operationalDate && ["entry", "exit", "late"].includes(event.eventType));
  const latest = sameDay[0];
  if (latest && ["entry", "late"].includes(latest.eventType)) return { kind: "register", eventType: "exit", operationalDate };
  if (!config?.startTime) return { kind: "register", eventType: "entry", operationalDate };
  const parts = localParts(timestamp, timezone);
  const start = minutesFromTime(config.startTime);
  const end = config.endTime ? minutesFromTime(config.endTime) : start + 1;
  const effectiveMinutes = end <= start && parts.minutes <= end ? parts.minutes + 1_440 : parts.minutes;
  return { kind: "register", eventType: effectiveMinutes > start + config.toleranceMinutes ? "late" : "entry", operationalDate };
}


export function attendanceLatenessMinutes(timestamp: string, timezone: string, config: OperationalShiftConfig | null): number | null {
  if (!config?.startTime) return null;
  const parts = localParts(timestamp, timezone);
  const start = minutesFromTime(config.startTime);
  const end = config.endTime ? minutesFromTime(config.endTime) : start + 1;
  const effectiveMinutes = end <= start && parts.minutes <= end ? parts.minutes + 1_440 : parts.minutes;
  return Math.max(0, effectiveMinutes - start - config.toleranceMinutes);
}

export function shiftAppliesOnOperationalDate(operationalDate: string, _timezone: string, config: OperationalShiftConfig): boolean {
  if (!config.daysOfWeek.length) return true;
  const date = new Date(`${operationalDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha operacional no es válida.");
  return config.daysOfWeek.includes(date.getUTCDay());
}

export function maskExternalTemplateId(value: string): string {
  const clean = value.trim();
  if (clean.length <= 6) return "••••••";
  return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
}
