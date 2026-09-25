import type { QualityLogSummary, QualitySnapshot } from "@/types";

const encoder = new TextEncoder();
const escXml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
const escCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const safe = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "calidad";
const fmt = (value: string | null | undefined) => value ? new Date(value).toLocaleString("es-MX") : "";

function criterion(field: QualityLogSummary["fields"][number]): string {
  if (field.fieldType === "number" && (field.minimum !== null || field.maximum !== null)) return `${field.minimum ?? "-inf"} a ${field.maximum ?? "+inf"}${field.unit ? ` ${field.unit}` : ""}`;
  if (field.fieldType === "boolean" && field.expectedBoolean !== null) return field.expectedBoolean ? "Sí" : "No";
  if (field.fieldType === "select" && field.nonCompliantOptions.length) return `No conformes: ${field.nonCompliantOptions.join(", ")}`;
  return "Sin criterio automático";
}

function displayValue(value: string | number | boolean | null, unit?: string | null): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function qualityExportFilename(snapshot: QualitySnapshot, log: QualityLogSummary, extension: string): string {
  return `${safe(snapshot.organization.code)}-${safe(log.templateName)}-${log.operationalDate}.${extension}`;
}

export function buildQualityCsv(snapshot: QualitySnapshot, log: QualityLogSummary): Uint8Array {
  const rows: string[][] = [
    ["Organización", snapshot.organization.name], ["Sucursal", log.branchName], ["Plantilla", log.templateName], ["Versión", String(log.templateVersionNumber)],
    ["Fecha operativa", log.operationalDate], ["Vencimiento", fmt(log.dueAt)], ["Estado", log.status], ["Responsable", log.assignedToName ?? ""], ["Confirmó", log.signerName ?? ""],
    [], ["Campo", "Valor", "Criterio", "Cumple", "Notas", "Capturado por", "Fecha"],
  ];
  for (const field of log.fields) {
    const answer = log.answers.find((item) => item.fieldId === field.id);
    rows.push([field.label, displayValue(answer?.value ?? null, field.unit), criterion(field), answer?.inRange === null || answer?.inRange === undefined ? "" : answer.inRange ? "Sí" : "No", answer?.notes ?? "", answer?.capturedByName ?? "", fmt(answer?.capturedAt)]);
  }
  rows.push([], ["Acciones correctivas"], ["Severidad", "Estado", "Título", "Causa raíz", "Corrección inmediata", "Prevención", "Resolución", "Verificación", "Creada", "Resuelta", "Verificada"]);
  for (const action of snapshot.correctiveActions.filter((item) => item.logInstanceId === log.id)) {
    rows.push([action.severity, action.status, action.title, action.rootCause ?? "", action.immediateCorrection ?? "", action.preventiveAction ?? "", action.resolution ?? "", action.verificationNotes ?? "", fmt(action.createdAt), fmt(action.resolvedAt), fmt(action.verifiedAt)]);
  }
  rows.push([], ["Evidencias"], ["Tipo", "Archivo", "Tamaño bytes", "Nota", "Capturada por", "Fecha"]);
  for (const evidence of log.evidence) rows.push([evidence.evidenceType, evidence.fileName, String(evidence.sizeBytes), evidence.note, evidence.capturedByName, fmt(evidence.capturedAt)]);
  const text = "\uFEFF" + rows.map((row) => row.map(escCsv).join(",")).join("\r\n");
  return encoder.encode(text);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();
function crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function u16(value: number): Uint8Array { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, value, true); return b; }
function u32(value: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value >>> 0, true); return b; }
function concat(parts: Uint8Array[]): Uint8Array { const size = parts.reduce((s, p) => s + p.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function zip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name); const crc = crc32(entry.data); const local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name, entry.data]);
    locals.push(local);
    centrals.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length;
  }
  const central = concat(centrals); const body = concat(locals);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(body.length), u16(0)]);
  return concat([body, central, end]);
}
function cell(value: unknown): string { return `<c t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`; }
function row(values: unknown[]): string { return `<row>${values.map(cell).join("")}</row>`; }
export function buildQualityXlsx(snapshot: QualitySnapshot, log: QualityLogSummary): Uint8Array {
  const rows: unknown[][] = [["KitchenMind — Bitácora de Calidad"], ["Organización", snapshot.organization.name], ["Sucursal", log.branchName], ["Plantilla", log.templateName], ["Versión", log.templateVersionNumber], ["Fecha operativa", log.operationalDate], ["Estado", log.status], [], ["Campo", "Valor", "Criterio", "Cumple", "Notas", "Capturado por", "Fecha"]];
  for (const field of log.fields) { const answer = log.answers.find((item) => item.fieldId === field.id); rows.push([field.label, displayValue(answer?.value ?? null, field.unit), criterion(field), answer?.inRange === null || answer?.inRange === undefined ? "" : answer.inRange ? "Sí" : "No", answer?.notes ?? "", answer?.capturedByName ?? "", fmt(answer?.capturedAt)]); }
  rows.push([], ["Acciones correctivas"], ["Severidad", "Estado", "Título", "Causa raíz", "Corrección inmediata", "Prevención", "Resolución", "Verificación"]);
  for (const action of snapshot.correctiveActions.filter((item) => item.logInstanceId === log.id)) rows.push([action.severity, action.status, action.title, action.rootCause ?? "", action.immediateCorrection ?? "", action.preventiveAction ?? "", action.resolution ?? "", action.verificationNotes ?? ""]);
  rows.push([], ["Evidencias"], ["Tipo", "Archivo", "Nota", "Capturada por", "Fecha"]); for (const evidence of log.evidence) rows.push([evidence.evidenceType, evidence.fileName, evidence.note, evidence.capturedByName, fmt(evidence.capturedAt)]);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map(row).join("")}</sheetData></worksheet>`;
  return zip([
    { name: "[Content_Types].xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`) },
    { name: "_rels/.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Calidad" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) },
  ]);
}

function latin1(value: string): Uint8Array { const out = new Uint8Array(value.length); for (let i = 0; i < value.length; i += 1) { const code = value.charCodeAt(i); out[i] = code <= 255 ? code : 63; } return out; }
function pdfEscape(value: string): string { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrap(value: string, width = 92): string[] { const words = value.replace(/\s+/g, " ").trim().split(" "); const lines: string[] = []; let line = ""; for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > width && line) { lines.push(line); line = word; } else line = next; } if (line) lines.push(line); return lines.length ? lines : [""]; }
export function buildQualityPdf(snapshot: QualitySnapshot, log: QualityLogSummary): Uint8Array {
  const lines: string[] = ["KITCHENMIND — BITÁCORA DE CALIDAD", `${snapshot.organization.name} · ${log.branchName}`, `${log.templateName} · v${log.templateVersionNumber} · ${log.operationalDate}`, `Estado: ${log.status} · Cumplimiento de captura: ${log.completionPercentage}% · Desviaciones: ${log.deviationCount}`, "", "CONTROLES"];
  for (const field of log.fields) { const answer = log.answers.find((item) => item.fieldId === field.id); lines.push(...wrap(`${field.label}: ${displayValue(answer?.value ?? null, field.unit) || "Sin captura"} | Criterio: ${criterion(field)} | ${answer?.inRange === false ? "FUERA DE CRITERIO" : answer?.inRange === true ? "En criterio" : "Sin evaluación"}`)); if (answer?.notes) lines.push(...wrap(`  Nota: ${answer.notes}`)); }
  const actions = snapshot.correctiveActions.filter((item) => item.logInstanceId === log.id); if (actions.length) { lines.push("", "ACCIONES CORRECTIVAS"); for (const action of actions) lines.push(...wrap(`${action.severity.toUpperCase()} · ${action.status} · ${action.title} | Causa: ${action.rootCause ?? "—"} | Corrección: ${action.immediateCorrection ?? "—"} | Resolución: ${action.resolution ?? "—"} | Verificación: ${action.verificationNotes ?? "—"}`)); }
  if (log.evidence.length) { lines.push("", "EVIDENCIA REFERENCIADA"); for (const item of log.evidence) lines.push(...wrap(`${item.evidenceType}: ${item.fileName} · ${fmt(item.capturedAt)} · ${item.capturedByName}${item.note ? ` · ${item.note}` : ""}`)); }
  if (snapshot.timeline.length) { lines.push("", "TRAZABILIDAD"); for (const event of snapshot.timeline) lines.push(...wrap(`${fmt(event.createdAt)} · ${event.actorName} · ${event.reason ?? event.action}`)); }
  lines.push("", "Confirmación operativa: este documento refleja datos persistentes de KitchenMind y no constituye por sí solo una certificación regulatoria ni firma electrónica certificada.");
  const pages: string[][] = []; for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objects: Uint8Array[] = []; const pageRefs: number[] = []; let objectNo = 4;
  for (const pageLines of pages) { const pageNo = objectNo++; const contentNo = objectNo++; pageRefs.push(pageNo); const stream = `BT /F1 10 Tf 40 805 Td 14 TL ${pageLines.map((line) => `(${pdfEscape(line)}) Tj T*`).join(" ")} ET`; const streamBytes = latin1(stream); objects[pageNo] = latin1(`${pageNo} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNo} 0 R >>\nendobj\n`); objects[contentNo] = concat([latin1(`${contentNo} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`), streamBytes, latin1(`\nendstream\nendobj\n`)]); }
  objects[1] = latin1(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`); objects[2] = latin1(`2 0 obj\n<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((n) => `${n} 0 R`).join(" ")}] >>\nendobj\n`); objects[3] = latin1(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  const header = latin1("%PDF-1.4\n%KM\n"); const ordered: Uint8Array[] = [header]; const offsets = new Array(objects.length).fill(0); let offset = header.length; for (let n = 1; n < objects.length; n += 1) { offsets[n] = offset; ordered.push(objects[n]); offset += objects[n].length; }
  const xrefOffset = offset; let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`; for (let n = 1; n < objects.length; n += 1) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`; xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  ordered.push(latin1(xref)); return concat(ordered);
}

function reportRows(snapshot: QualitySnapshot): unknown[][] {
  const month = snapshot.filters.periodStart.slice(0, 7);
  const metrics = snapshot.metrics;
  const rows: unknown[][] = [
    ["KitchenMind — Reporte mensual de Calidad"],
    ["Organización", snapshot.organization.name],
    ["Periodo", month],
    ["Sucursal", snapshot.selectedBranchId ? (snapshot.branches.find((branch) => branch.id === snapshot.selectedBranchId)?.name ?? snapshot.selectedBranchId) : "Todas las sucursales autorizadas"],
    ["Generado", fmt(snapshot.generatedAt)],
    [],
    ["Indicador", "Valor"],
    ["Cumplimiento a tiempo", metrics.compliancePercent === null ? "Sin exigibles" : `${metrics.compliancePercent.toFixed(1)}%`],
    ["Bitácoras exigibles", metrics.eligibleLogs],
    ["Bitácoras completadas", metrics.completedInPeriod],
    ["Bitácoras vencidas", metrics.overdueLogs],
    ["Desviaciones", metrics.deviationsInPeriod],
    ["Desviaciones críticas", metrics.criticalDeviationsInPeriod],
    ["Acciones abiertas", metrics.openCorrectiveActions],
    ["Acciones vencidas", metrics.overdueCorrectiveActions],
    ["Resolución promedio (min)", metrics.averageResolutionMinutes === null ? "Sin datos" : Math.round(metrics.averageResolutionMinutes)],
    ["Grupos reincidentes", metrics.recurrentDeviationGroups],
    [],
    ["Resumen por sucursal"],
    ["Sucursal", "Exigibles", "Completadas a tiempo", "Vencidas", "Desviaciones"],
  ];
  for (const branch of snapshot.branches) {
    const logs = snapshot.logs.filter((log) => log.branchId === branch.id);
    const eligible = logs.filter((log) => log.status !== "cancelled" && new Date(log.dueAt).getTime() <= new Date(snapshot.generatedAt).getTime());
    const completedOnTime = eligible.filter((log) => Boolean(log.completedAt) && new Date(log.completedAt as string).getTime() <= new Date(log.dueAt).getTime()).length;
    rows.push([branch.name, eligible.length, completedOnTime, logs.filter((log) => log.status === "overdue").length, logs.reduce((sum, log) => sum + log.deviationCount, 0)]);
  }
  rows.push([], ["Acciones correctivas"], ["Sucursal", "Severidad", "Estado", "Título", "Responsable", "Vence", "Resuelta", "Verificada"]);
  for (const action of snapshot.correctiveActions) rows.push([action.branchName, action.severity, action.status, action.title, action.assignedToName ?? "", fmt(action.dueAt), fmt(action.resolvedAt), fmt(action.verifiedAt)]);
  rows.push([], ["Bitácoras"], ["Sucursal", "Plantilla", "Fecha", "Estado", "Avance %", "Desviaciones", "Responsable", "Vencimiento"]);
  for (const log of snapshot.logs) rows.push([log.branchName, log.templateName, log.operationalDate, log.status, log.completionPercentage, log.deviationCount, log.assignedToName ?? "", fmt(log.dueAt)]);
  return rows;
}

export function qualityReportFilename(snapshot: QualitySnapshot, extension: string): string {
  return `${safe(snapshot.organization.code)}-reporte-calidad-${snapshot.filters.periodStart.slice(0, 7)}.${extension}`;
}

export function buildQualityReportCsv(snapshot: QualitySnapshot): Uint8Array {
  const text = "\uFEFF" + reportRows(snapshot).map((values) => values.map(escCsv).join(",")).join("\r\n");
  return encoder.encode(text);
}

export function buildQualityReportXlsx(snapshot: QualitySnapshot): Uint8Array {
  const rows = reportRows(snapshot);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map(row).join("")}</sheetData></worksheet>`;
  return zip([
    { name: "[Content_Types].xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`) },
    { name: "_rels/.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reporte Calidad" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) },
  ]);
}

function reportPdf(snapshot: QualitySnapshot): Uint8Array {
  const lines: string[] = [
    "KITCHENMIND — REPORTE MENSUAL DE CALIDAD",
    `${snapshot.organization.name} · ${snapshot.filters.periodStart.slice(0, 7)}`,
    snapshot.selectedBranchId ? `Sucursal: ${snapshot.branches.find((branch) => branch.id === snapshot.selectedBranchId)?.name ?? snapshot.selectedBranchId}` : "Todas las sucursales autorizadas",
    "",
    `Cumplimiento a tiempo: ${snapshot.metrics.compliancePercent === null ? "Sin exigibles" : `${snapshot.metrics.compliancePercent.toFixed(1)}%`}`,
    `Exigibles: ${snapshot.metrics.eligibleLogs} · Completadas: ${snapshot.metrics.completedInPeriod} · Vencidas: ${snapshot.metrics.overdueLogs}`,
    `Desviaciones: ${snapshot.metrics.deviationsInPeriod} · Críticas: ${snapshot.metrics.criticalDeviationsInPeriod}`,
    `Acciones abiertas: ${snapshot.metrics.openCorrectiveActions} · Vencidas: ${snapshot.metrics.overdueCorrectiveActions}`,
    `Resolución promedio: ${snapshot.metrics.averageResolutionMinutes === null ? "Sin datos" : `${Math.round(snapshot.metrics.averageResolutionMinutes)} min`} · Grupos reincidentes: ${snapshot.metrics.recurrentDeviationGroups}`,
    "",
    "RESUMEN POR SUCURSAL",
  ];
  for (const branch of snapshot.branches) {
    const logs = snapshot.logs.filter((log) => log.branchId === branch.id);
    const eligible = logs.filter((log) => log.status !== "cancelled" && new Date(log.dueAt).getTime() <= new Date(snapshot.generatedAt).getTime());
    const onTime = eligible.filter((log) => Boolean(log.completedAt) && new Date(log.completedAt as string).getTime() <= new Date(log.dueAt).getTime()).length;
    lines.push(...wrap(`${branch.name}: exigibles ${eligible.length}, completadas a tiempo ${onTime}, vencidas ${logs.filter((log) => log.status === "overdue").length}, desviaciones ${logs.reduce((sum, log) => sum + log.deviationCount, 0)}.`));
  }
  if (snapshot.correctiveActions.length) {
    lines.push("", "ACCIONES CORRECTIVAS");
    for (const action of snapshot.correctiveActions) lines.push(...wrap(`${action.branchName} · ${action.severity.toUpperCase()} · ${action.status} · ${action.title} · ${action.assignedToName ?? "Sin responsable"}`));
  }
  lines.push("", "BITÁCORAS DEL PERIODO");
  for (const log of snapshot.logs) lines.push(...wrap(`${log.operationalDate} · ${log.branchName} · ${log.templateName} · ${log.status} · ${log.deviationCount} desviación(es)`));
  lines.push("", "Reporte generado con datos persistentes dentro del alcance autorizado. No constituye por sí solo certificación regulatoria ni firma electrónica certificada.");
  const pages: string[][] = []; for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objects: Uint8Array[] = []; const pageRefs: number[] = []; let objectNo = 4;
  for (const pageLines of pages) { const pageNo = objectNo++; const contentNo = objectNo++; pageRefs.push(pageNo); const stream = `BT /F1 10 Tf 40 805 Td 14 TL ${pageLines.map((line) => `(${pdfEscape(line)}) Tj T*`).join(" ")} ET`; const streamBytes = latin1(stream); objects[pageNo] = latin1(`${pageNo} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNo} 0 R >>\nendobj\n`); objects[contentNo] = concat([latin1(`${contentNo} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`), streamBytes, latin1(`\nendstream\nendobj\n`)]); }
  objects[1] = latin1(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`); objects[2] = latin1(`2 0 obj\n<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((n) => `${n} 0 R`).join(" ")}] >>\nendobj\n`); objects[3] = latin1(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  const header = latin1("%PDF-1.4\n%KM\n"); const ordered: Uint8Array[] = [header]; const offsets = new Array(objects.length).fill(0); let offset = header.length; for (let n = 1; n < objects.length; n += 1) { offsets[n] = offset; ordered.push(objects[n]); offset += objects[n].length; }
  const xrefOffset = offset; let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`; for (let n = 1; n < objects.length; n += 1) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`; xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  ordered.push(latin1(xref)); return concat(ordered);
}

export function buildQualityReportPdf(snapshot: QualitySnapshot): Uint8Array { return reportPdf(snapshot); }
