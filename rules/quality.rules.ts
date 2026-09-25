import type { OperationalQualityFieldType, QualityDeviationSeverity } from "@/types";

export interface QualityFieldDefinitionInput {
  code?: string;
  label: string;
  description?: string;
  fieldType: OperationalQualityFieldType;
  unit?: string | null;
  required?: boolean;
  minimum?: number | null;
  maximum?: number | null;
  expectedBoolean?: boolean | null;
  options?: string[];
  nonCompliantOptions?: string[];
  deviationSeverity?: QualityDeviationSeverity;
  evidenceRequiredOnDeviation?: boolean;
  displayOrder?: number;
}

export interface QualityRangeField {
  fieldType: OperationalQualityFieldType;
  minimumMilli: number | null;
  maximumMilli: number | null;
  expectedBoolean: boolean | null;
  options: string[];
  nonCompliantOptions: string[];
}

export interface EvaluatedQualityAnswer {
  valueType: OperationalQualityFieldType;
  valueText: string | null;
  numericValueMilli: number | null;
  booleanValue: boolean | null;
  optionValue: string | null;
  inRange: boolean | null;
  hasValue: boolean;
}

export function normalizeQualityCode(value: string): string {
  return value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "CAMPO";
}

export function qualityNumberToMilli(value: number): number {
  if (!Number.isFinite(value)) throw new Error("El valor numérico no es válido.");
  const milli = Math.round(value * 1_000);
  if (!Number.isSafeInteger(milli)) throw new Error("El valor numérico está fuera del rango permitido.");
  return milli;
}

export function qualityMilliToNumber(value: number | null): number | null {
  return value === null ? null : value / 1_000;
}

export function validateQualityFieldDefinitions(input: QualityFieldDefinitionInput[]): Array<Required<Omit<QualityFieldDefinitionInput, "description" | "unit" | "minimum" | "maximum" | "expectedBoolean">> & {
  description: string;
  unit: string | null;
  minimum: number | null;
  maximum: number | null;
  expectedBoolean: boolean | null;
}> {
  if (!input.length) throw new Error("Agrega al menos un campo a la bitácora.");
  if (input.length > 40) throw new Error("Una bitácora puede tener hasta 40 campos.");
  const used = new Set<string>();
  return input.map((field, index) => {
    const label = field.label.trim();
    if (label.length < 2 || label.length > 160) throw new Error(`Revisa el nombre del campo ${index + 1}.`);
    const code = normalizeQualityCode(field.code || label);
    if (used.has(code)) throw new Error(`El código ${code} está repetido.`);
    used.add(code);
    const options = Array.from(new Set((field.options ?? []).map((value) => value.trim()).filter(Boolean))).slice(0, 30);
    const nonCompliantOptions = Array.from(new Set((field.nonCompliantOptions ?? []).map((value) => value.trim()).filter(Boolean)));
    if (field.fieldType === "select" && options.length < 2) throw new Error(`El campo “${label}” necesita al menos dos opciones.`);
    if (nonCompliantOptions.some((value) => !options.includes(value))) throw new Error(`Una opción no conforme de “${label}” no existe en su catálogo.`);
    const minimum = field.fieldType === "number" && field.minimum !== undefined ? field.minimum : null;
    const maximum = field.fieldType === "number" && field.maximum !== undefined ? field.maximum : null;
    if (minimum !== null) qualityNumberToMilli(minimum);
    if (maximum !== null) qualityNumberToMilli(maximum);
    if (minimum !== null && maximum !== null && minimum > maximum) throw new Error(`El rango de “${label}” está invertido.`);
    return {
      code,
      label,
      description: (field.description ?? "").trim().slice(0, 500),
      fieldType: field.fieldType,
      unit: field.fieldType === "number" ? (field.unit ?? "").trim().slice(0, 30) || null : null,
      required: field.required !== false,
      minimum,
      maximum,
      expectedBoolean: field.fieldType === "boolean" ? field.expectedBoolean ?? true : null,
      options: field.fieldType === "select" ? options : [],
      nonCompliantOptions: field.fieldType === "select" ? nonCompliantOptions : [],
      deviationSeverity: field.deviationSeverity === "critical" ? "critical" : "warning",
      evidenceRequiredOnDeviation: field.evidenceRequiredOnDeviation === true,
      displayOrder: index + 1,
    };
  });
}

export function evaluateQualityAnswer(field: QualityRangeField, rawValue: unknown): EvaluatedQualityAnswer {
  if (field.fieldType === "number") {
    if (rawValue === null || rawValue === undefined || rawValue === "") return empty("number");
    const number = typeof rawValue === "number" ? rawValue : Number(String(rawValue).trim());
    const numericValueMilli = qualityNumberToMilli(number);
    const aboveMinimum = field.minimumMilli === null || numericValueMilli >= field.minimumMilli;
    const belowMaximum = field.maximumMilli === null || numericValueMilli <= field.maximumMilli;
    const hasRange = field.minimumMilli !== null || field.maximumMilli !== null;
    return { valueType: "number", valueText: String(number), numericValueMilli, booleanValue: null, optionValue: null, inRange: hasRange ? aboveMinimum && belowMaximum : null, hasValue: true };
  }
  if (field.fieldType === "boolean") {
    if (rawValue === null || rawValue === undefined || rawValue === "") return empty("boolean");
    if (typeof rawValue !== "boolean") throw new Error("La respuesta debe ser Sí o No.");
    return { valueType: "boolean", valueText: rawValue ? "Sí" : "No", numericValueMilli: null, booleanValue: rawValue, optionValue: null, inRange: field.expectedBoolean === null ? null : rawValue === field.expectedBoolean, hasValue: true };
  }
  if (field.fieldType === "select") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) return empty("select");
    if (!field.options.includes(value)) throw new Error("La opción seleccionada no es válida.");
    return { valueType: "select", valueText: value, numericValueMilli: null, booleanValue: null, optionValue: value, inRange: field.nonCompliantOptions.length ? !field.nonCompliantOptions.includes(value) : null, hasValue: true };
  }
  const value = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();
  if (!value) return empty("text");
  if (value.length > 2_000) throw new Error("La respuesta de texto es demasiado larga.");
  return { valueType: "text", valueText: value, numericValueMilli: null, booleanValue: null, optionValue: null, inRange: null, hasValue: true };
}

export function qualityCompletionPercentage(totalFields: number, answeredFields: number): number {
  if (totalFields <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((answeredFields / totalFields) * 100)));
}

export function localOperationalDate(timezone: string, date = new Date()): string {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function empty(valueType: OperationalQualityFieldType): EvaluatedQualityAnswer {
  return { valueType, valueText: null, numericValueMilli: null, booleanValue: null, optionValue: null, inRange: null, hasValue: false };
}
