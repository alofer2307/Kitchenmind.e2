export type QualityRecurrenceType = "daily" | "per_shift" | "days" | "multiple_daily" | "interval" | "adhoc";

export interface QualityScheduleRuleDefinition {
  scheduleType: QualityRecurrenceType;
  daysOfWeek: number[];
  times: string[];
  intervalMinutes: number | null;
  timezone: string;
  startDate: string;
  endDate: string | null;
}

export interface QualityScheduleOccurrence {
  operationalDate: string;
  localTime: string;
  dueAt: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function dateParts(value: string): [number, number, number] {
  if (!DATE.test(value)) throw new Error("La fecha de recurrencia no es válida.");
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.toISOString().slice(0, 10) !== value) throw new Error("La fecha de recurrencia no existe.");
  return [year, month, day];
}

function nextDate(value: string, days = 1): string {
  const [year, month, day] = dateParts(value);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function compareDate(a: string, b: string) { return a.localeCompare(b); }

function weekday(value: string): number {
  const [year, month, day] = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function minutes(value: string): number {
  if (!TIME.test(value)) throw new Error("La hora de recurrencia debe usar HH:MM.");
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function fromMinutes(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function zonedLocalToIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = dateParts(date);
  const [hour, minute] = time.split(":").map(Number);
  if (!TIME.test(time)) throw new Error("La hora de recurrencia debe usar HH:MM.");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date()); } catch { throw new Error("La zona horaria de la recurrencia no es válida."); }
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - observed;
  }
  return new Date(guess).toISOString();
}

export function validateQualityScheduleRule(input: QualityScheduleRuleDefinition): QualityScheduleRuleDefinition {
  dateParts(input.startDate);
  if (input.endDate) { dateParts(input.endDate); if (input.endDate < input.startDate) throw new Error("La fecha final no puede ser anterior al inicio."); }
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(new Date()); } catch { throw new Error("La zona horaria no es válida."); }
  const daysOfWeek = Array.from(new Set(input.daysOfWeek)).sort((a, b) => a - b);
  if (daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Los días de recurrencia deben estar entre 0 y 6.");
  const times = Array.from(new Set(input.times.map((time) => { minutes(time); return time; }))).sort();
  if (input.scheduleType !== "adhoc" && !times.length) throw new Error("La recurrencia necesita al menos una hora.");
  if (input.scheduleType === "days" && !daysOfWeek.length) throw new Error("Selecciona al menos un día de la semana.");
  if (input.scheduleType === "interval") {
    if (!Number.isInteger(input.intervalMinutes) || Number(input.intervalMinutes) < 15 || Number(input.intervalMinutes) > 720) throw new Error("El intervalo debe estar entre 15 y 720 minutos.");
    if (times.length < 1 || times.length > 2) throw new Error("Una recurrencia por intervalo necesita hora inicial y una hora final opcional.");
  }
  if (["daily", "per_shift"].includes(input.scheduleType) && times.length !== 1) throw new Error("Esta recurrencia necesita exactamente una hora límite.");
  if (input.scheduleType === "multiple_daily" && times.length < 2) throw new Error("Varias veces al día requiere al menos dos horas.");
  return { ...input, daysOfWeek, times, intervalMinutes: input.scheduleType === "interval" ? Number(input.intervalMinutes) : null };
}

export function expandQualitySchedule(input: QualityScheduleRuleDefinition, fromDate: string, throughDate: string, limit = 100): QualityScheduleOccurrence[] {
  const rule = validateQualityScheduleRule(input);
  dateParts(fromDate); dateParts(throughDate);
  if (throughDate < fromDate) return [];
  const effectiveStart = fromDate > rule.startDate ? fromDate : rule.startDate;
  const effectiveEnd = rule.endDate && rule.endDate < throughDate ? rule.endDate : throughDate;
  if (effectiveEnd < effectiveStart || rule.scheduleType === "adhoc") return [];
  const results: QualityScheduleOccurrence[] = [];
  let date = effectiveStart;
  while (compareDate(date, effectiveEnd) <= 0) {
    const day = weekday(date);
    const applies = rule.scheduleType !== "days" || rule.daysOfWeek.includes(day);
    if (applies) {
      let times = rule.times;
      if (rule.scheduleType === "interval") {
        const start = minutes(rule.times[0]);
        const end = minutes(rule.times[1] ?? "23:59");
        const interval = rule.intervalMinutes ?? 60;
        const endAdjusted = end >= start ? end : end + 1440;
        const generated: string[] = [];
        for (let cursor = start; cursor <= endAdjusted; cursor += interval) generated.push(fromMinutes(cursor));
        times = generated;
      }
      for (const localTime of times) {
        results.push({ operationalDate: date, localTime, dueAt: zonedLocalToIso(date, localTime, rule.timezone) });
        if (results.length > limit) throw new Error(`La generación excede el límite seguro de ${limit} bitácoras por ejecución.`);
      }
    }
    date = nextDate(date);
  }
  return results;
}

export function qualityScheduleNextDate(value: string): string { return nextDate(value); }
