import type { ModuleKey } from "@/types";

export const MODULE_KEYS: ModuleKey[] = [
  "core",
  "personnel",
  "services",
  "quality",
  "inventory",
  "purchasing",
  "production",
  "finance",
  "kiro",
];

export const INDUSTRIAL_MODULES: ModuleKey[] = [
  ...MODULE_KEYS,
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  core: "Núcleo",
  personnel: "Personal",
  services: "Servicios",
  quality: "Calidad",
  inventory: "Inventario",
  purchasing: "Compras",
  production: "Producción",
  finance: "Finanzas",
  kiro: "Kiro",
};

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  core: "Organización, sucursales, usuarios, configuración y actividad.",
  personnel: "Empleados, turnos, asistencia, incidencias y gafetes.",
  services: "Comensales, elegibilidad, escaneo y conteos por servicio.",
  quality: "Bitácoras estructuradas, incidencias y acciones correctivas.",
  inventory: "Productos, almacenes, lotes, caducidades y movimientos.",
  purchasing: "Proveedores, solicitudes, órdenes, recepción y precios.",
  production: "Menús, recetas, rendimientos y consumos.",
  finance: "Costos por receta, servicio y operación.",
  kiro: "Hallazgos y recomendaciones explicables.",
};
