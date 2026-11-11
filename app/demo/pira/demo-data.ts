import { z } from "zod";
import { QUALITY_TEMPLATE_LIBRARY } from "@/constants/quality-template-library";

export const DEMO_DATE = "2026-11-10";
export const PREVIOUS_DATE = "2026-11-09";
export const BRANCH_NAME = "Maxion Wheels";

export const VIEWS = {
  direction: "Dirección",
  shift: "Jefatura de turno",
  quality: "Supervisión de Calidad",
} as const;

export type DemoView = keyof typeof VIEWS;

export const SHIFTS = [
  { id: "1", name: "1.er turno", staff: "06:00–15:30", service: "10:20–14:00", expected: 14, present: 14, meals: 348 },
  { id: "2", name: "2.º turno", staff: "14:00–22:30", service: "18:00–20:30", expected: 12, present: 11, meals: 255 },
  { id: "3", name: "3.er turno", staff: "22:30–06:00", service: "02:00–04:00", expected: 8, present: 7, meals: 136 },
  { id: "4", name: "4.º turno", staff: "07:00–19:00", service: "10:20–14:00 y 18:00–20:30", expected: 6, present: 6, meals: 82 },
  { id: "5", name: "5.º turno", staff: "18:00–06:00", service: "02:00–04:00", expected: 5, present: 5, meals: 61 },
] as const;

type ShiftId = (typeof SHIFTS)[number]["id"];
type ControlCode = "HIGIENE_PERSONAL" | "TEMP_ALIMENTOS" | "CUARTO_FRIO" | "PEPS" | "LIMPIEZA" | "ENTREGA_TURNO";

const note = z.string().trim().max(480);
const actionNote = note.min(3, "Escribe al menos tres caracteres.");
const timestamp = z.string().datetime();
const followUp = z.object({ note: actionNote, at: timestamp });
const captureInput = z.object({ result: z.enum(["ok", "incident"]), value: z.number().finite().nullable(), note });
const entrySchema = captureInput.extend({
  at: timestamp,
  correction: followUp.optional(),
  verification: followUp.optional(),
});

type Entry = z.infer<typeof entrySchema>;
export type CaptureInput = z.infer<typeof captureInput>;

export type DemoLog = {
  id: string;
  control: ControlCode;
  area: string;
  shift: ShiftId;
  date: string;
  due: string;
  initial?: Entry;
};

export const DEMO_LOGS: readonly DemoLog[] = [
  { id: "KM-101", control: "HIGIENE_PERSONAL", area: "Acceso de personal", shift: "1", date: DEMO_DATE, due: "06:15", initial: { result: "ok", value: null, note: "Se realizó la revisión de inicio de turno.", at: "2026-11-10T13:10:00.000Z" } },
  { id: "KM-102", control: "TEMP_ALIMENTOS", area: "Barra de servicio", shift: "1", date: DEMO_DATE, due: "10:00" },
  { id: "KM-103", control: "CUARTO_FRIO", area: "Cámara fría", shift: "1", date: DEMO_DATE, due: "06:30", initial: { result: "incident", value: 4.2, note: "En el ejercicio se encontró un recipiente sin identificación.", at: "2026-11-10T13:25:00.000Z", correction: { note: "Se identificó el recipiente de prueba y se documentó la revisión.", at: "2026-11-10T13:48:00.000Z" } } },
  { id: "KM-104", control: "PEPS", area: "Almacén", shift: "1", date: DEMO_DATE, due: "09:00", initial: { result: "ok", value: null, note: "Se verificaron etiquetas y orden de rotación en la muestra.", at: "2026-11-10T15:52:00.000Z" } },
  { id: "KM-201", control: "LIMPIEZA", area: "Cocina", shift: "2", date: DEMO_DATE, due: "14:10", initial: { result: "ok", value: null, note: "Revisión de superficies registrada.", at: "2026-11-10T21:06:00.000Z" } },
  { id: "KM-202", control: "TEMP_ALIMENTOS", area: "Barra de servicio", shift: "2", date: DEMO_DATE, due: "18:05" },
  { id: "KM-203", control: "ENTREGA_TURNO", area: "Comedor", shift: "2", date: DEMO_DATE, due: "22:20" },
  { id: "KM-301", control: "LIMPIEZA", area: "Procesos", shift: "3", date: DEMO_DATE, due: "23:00", initial: { result: "incident", value: null, note: "En el ejercicio quedó pendiente la limpieza de una mesa de trabajo.", at: "2026-11-11T05:55:00.000Z" } },
  { id: "KM-302", control: "TEMP_ALIMENTOS", area: "Barra de servicio", shift: "3", date: DEMO_DATE, due: "02:00", initial: { result: "ok", value: 63.5, note: "Lectura ficticia de una preparación de prueba.", at: "2026-11-11T09:03:00.000Z" } },
  { id: "KM-303", control: "ENTREGA_TURNO", area: "Comedor", shift: "3", date: DEMO_DATE, due: "05:50" },
  { id: "KM-401", control: "LIMPIEZA", area: "Comedor", shift: "4", date: DEMO_DATE, due: "07:15", initial: { result: "ok", value: null, note: "Revisión de mesas registrada.", at: "2026-11-10T14:12:00.000Z" } },
  { id: "KM-402", control: "ENTREGA_TURNO", area: "Comedor", shift: "4", date: DEMO_DATE, due: "18:50" },
  { id: "KM-501", control: "HIGIENE_PERSONAL", area: "Acceso de personal", shift: "5", date: DEMO_DATE, due: "18:15", initial: { result: "ok", value: null, note: "Se registró la revisión de inicio.", at: "2026-11-11T01:12:00.000Z" } },
  { id: "KM-502", control: "ENTREGA_TURNO", area: "Comedor", shift: "5", date: DEMO_DATE, due: "05:50" },
  { id: "KM-091", control: "TEMP_ALIMENTOS", area: "Barra de servicio", shift: "1", date: PREVIOUS_DATE, due: "10:00", initial: { result: "ok", value: 65.2, note: "Registro histórico de ejemplo.", at: "2026-11-09T17:00:00.000Z" } },
  { id: "KM-092", control: "ENTREGA_TURNO", area: "Comedor", shift: "2", date: PREVIOUS_DATE, due: "22:20", initial: { result: "ok", value: null, note: "Pendientes comunicados en el recorrido de ejemplo.", at: "2026-11-10T05:18:00.000Z" } },
];

const stateSchema = z.object({ version: z.literal(1), entries: z.record(entrySchema) });
export type DemoState = z.infer<typeof stateSchema>;
export const INITIAL_STATE: DemoState = { version: 1, entries: {} };

export function restoreDemoState(raw: string | null): DemoState {
  if (raw === null) return INITIAL_STATE;
  try {
    const result = stateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
}

export function controlName(log: DemoLog): string {
  return QUALITY_TEMPLATE_LIBRARY.find((preset) => preset.code === log.control)?.name ?? log.control;
}

export function shiftName(id: string): string {
  return SHIFTS.find((shift) => shift.id === id)?.name ?? "Turno";
}

export function needsTemperature(log: DemoLog): boolean {
  return log.control === "TEMP_ALIMENTOS" || log.control === "CUARTO_FRIO";
}

export function entryFor(state: DemoState, log: DemoLog): Entry | undefined {
  return state.entries[log.id] ?? log.initial;
}

export function logStatus(entry: Entry | undefined) {
  if (!entry) return { label: "Por registrar", tone: "neutral" } as const;
  if (entry.result === "ok") return { label: "Registrada", tone: "green" } as const;
  if (entry.verification) return { label: "Verificada", tone: "green" } as const;
  if (entry.correction) return { label: "Por verificar", tone: "blue" } as const;
  return { label: "Por corregir", tone: "amber" } as const;
}

export type DemoAction =
  | { type: "capture"; input: CaptureInput }
  | { type: "correct" | "verify"; note: string };

export function applyDemoAction(state: DemoState, log: DemoLog, view: DemoView, action: DemoAction): DemoState {
  const entry = entryFor(state, log);
  const at = new Date().toISOString();
  let next: Entry;
  if (action.type === "capture") {
    if (view !== "shift" || log.date !== DEMO_DATE || entry) throw new Error("Esta bitácora ya está registrada o no se puede capturar desde esta vista.");
    const input = captureInput.parse(action.input);
    if (needsTemperature(log) && input.value === null) throw new Error("Escribe una temperatura de ejemplo.");
    if (input.result === "incident" && input.note.length < 3) throw new Error("Describe la incidencia de ejemplo.");
    next = { ...input, at };
  } else {
    if (entry?.result !== "incident" || entry.verification) throw new Error("La incidencia no requiere seguimiento.");
    const followUpEntry = { note: actionNote.parse(action.note), at };
    if (action.type === "correct") {
      if (view !== "shift" || entry.correction) throw new Error("La corrección corresponde a Jefatura de turno.");
      next = { ...entry, correction: followUpEntry };
    } else {
      if (view !== "quality" || !entry.correction) throw new Error("Calidad verifica después de que Jefatura documente la corrección.");
      next = { ...entry, verification: followUpEntry };
    }
  }
  return { version: 1, entries: { ...state.entries, [log.id]: next } };
}

const dateLabel = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
export function formatDemoDate(date: string): string {
  return dateLabel.format(new Date(`${date}T12:00:00Z`));
}
