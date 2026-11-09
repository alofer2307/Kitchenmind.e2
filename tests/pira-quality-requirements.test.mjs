import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { QUALITY_TEMPLATE_LIBRARY } from "../constants/quality-template-library.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PIRA: las muestras testigo se gestionan físicamente, no en una nueva bitácora digital", () => {
  assert.equal(QUALITY_TEMPLATE_LIBRARY.some((entry) => entry.code === "MUESTRAS_TESTIGO"), false);
});

test("PIRA: la incidencia se describe sin gravedad obligatoria ni fotografía", () => {
  const incident = QUALITY_TEMPLATE_LIBRARY.find((entry) => entry.code === "INCIDENTE_INOCUIDAD");
  assert.ok(incident);
  assert.deepEqual(incident.fields.filter((field) => field.required !== false).map((field) => field.label), ["Descripción del incidente"]);
  assert.equal(incident.fields.some((field) => /severidad|gravedad/i.test(field.label)), false);
  assert.equal(incident.fields.some((field) => field.evidenceRequired === true), false);
  assert.ok(incident.fields.some((field) => /corrección realizada/i.test(field.label) && field.required === false));
});

test("PIRA: la biblioteca no inventa valores numéricos sanitarios para publicar", () => {
  for (const template of QUALITY_TEMPLATE_LIBRARY) {
    for (const field of template.fields) {
      assert.equal(Object.hasOwn(field, "minimum"), false, `${template.code}: mínimo no autorizado`);
      assert.equal(Object.hasOwn(field, "maximum"), false, `${template.code}: máximo no autorizado`);
    }
  }
});

test("PIRA: consulta de bitácora histórica solicitada tiene prioridad pese al límite de filas", async () => {
  const repository = await read("repositories/d1-quality.repository.ts");
  assert.match(repository, /if \(filters\.selectedLogId\) logValues\.push\(filters\.selectedLogId, filters\.selectedLogId\)/);
  assert.match(repository, /CASE WHEN l\.id = \? THEN -1 ELSE 0 END/);
  assert.match(repository, /LIMIT 150/);
});

test("PIRA: el catálogo presenta campos opcionales respetando la definición", async () => {
  const screen = await read("components/quality/quality-center-screen.tsx");
  assert.match(screen, /required: field\.required \?\? true/);
});

test("PIRA: la exportación deja trazabilidad del documento", async () => {
  const service = await read("services/tenant-quality.service.ts");
  assert.match(service, /quality\.export\.generated/);
  assert.match(service, /fileName: qualityExportFilename/);
});
