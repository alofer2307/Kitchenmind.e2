import type { OperationalQualityFieldType } from "@/types";

export interface QualityTemplateLibraryField {
  label: string;
  fieldType: OperationalQualityFieldType;
  unit?: string;
  options?: string[];
  expectedBoolean?: boolean;
  severity?: "warning" | "critical";
  evidenceRequired?: boolean;
}

export interface QualityTemplateLibraryPreset {
  code: string;
  name: string;
  category: "temperature" | "water" | "receiving" | "cleaning" | "hygiene" | "other";
  scheduleType: "adhoc" | "daily" | "per_shift" | "days" | "multiple_daily" | "interval";
  defaultDueTime?: string;
  instructions: string;
  fields: QualityTemplateLibraryField[];
}

const measurement = (label: string, unit: string, severity: "warning" | "critical" = "warning"): QualityTemplateLibraryField => ({ label, fieldType: "number", unit, severity });
const check = (label: string, severity: "warning" | "critical" = "warning", evidenceRequired = false): QualityTemplateLibraryField => ({ label, fieldType: "boolean", expectedBoolean: true, severity, evidenceRequired });
const selection = (label: string, options: string[], severity: "warning" | "critical" = "warning"): QualityTemplateLibraryField => ({ label, fieldType: "select", options, severity });

/**
 * Starter library only. Numeric limits are intentionally left unset so every
 * organization can approve its own HACCP / food-safety criteria before publish.
 * Published versions remain immutable in the Quality domain.
 */
export const QUALITY_TEMPLATE_LIBRARY: QualityTemplateLibraryPreset[] = [
  { code: "RECEPCION_MP", name: "Recepción de materia prima", category: "receiving", scheduleType: "adhoc", instructions: "Registra condición, temperatura cuando aplique, lote/fecha y decisión de recepción. Define criterios aprobados antes de publicar.", fields: [selection("Condición del empaque", ["Conforme", "No conforme"]), measurement("Temperatura de recepción", "°C", "critical"), check("Producto dentro de vida útil", "critical"), selection("Decisión", ["Aceptar", "Rechazar", "Retener"], "critical")] },
  { code: "TEMP_REFRIGERACION", name: "Temperatura de refrigeración", category: "temperature", scheduleType: "multiple_daily", instructions: "Mide con instrumento verificado. Configura el rango aprobado de la organización antes de publicar.", fields: [measurement("Temperatura", "°C", "critical"), check("Equipo operando sin anomalías", "warning")] },
  { code: "TEMP_CONGELACION", name: "Temperatura de congelación", category: "temperature", scheduleType: "multiple_daily", instructions: "Registra temperatura y condición del equipo. Configura el criterio interno antes de publicar.", fields: [measurement("Temperatura", "°C", "critical"), check("Sin evidencia de descongelación", "critical", true)] },
  { code: "TEMP_ALIMENTOS", name: "Temperatura de alimentos", category: "temperature", scheduleType: "multiple_daily", instructions: "Captura alimento, medición y etapa. Los límites deben ser aprobados por el responsable de inocuidad.", fields: [{ label: "Alimento / preparación", fieldType: "text" }, selection("Etapa", ["Cocción", "Mantenimiento", "Servicio", "Enfriamiento", "Otra"]), measurement("Temperatura", "°C", "critical")] },
  { code: "MANT_CALIENTE", name: "Mantenimiento caliente", category: "temperature", scheduleType: "multiple_daily", instructions: "Verifica cada preparación en mantenimiento caliente con límites aprobados por la organización.", fields: [{ label: "Preparación", fieldType: "text" }, measurement("Temperatura", "°C", "critical"), check("Protección contra contaminación", "warning")] },
  { code: "COCCION", name: "Control de cocción", category: "temperature", scheduleType: "adhoc", instructions: "Registra preparación, temperatura interna y verificación. Define el criterio por producto/proceso antes de publicar.", fields: [{ label: "Preparación", fieldType: "text" }, measurement("Temperatura interna", "°C", "critical"), check("Criterio de cocción cumplido", "critical", true)] },
  { code: "RECALENTAMIENTO", name: "Recalentamiento", category: "temperature", scheduleType: "adhoc", instructions: "Registra alimento, temperatura final y hora. Configura el límite aprobado antes de publicar.", fields: [{ label: "Preparación", fieldType: "text" }, measurement("Temperatura final", "°C", "critical"), check("Recalentamiento dentro del procedimiento", "critical")] },
  { code: "CLORO_AGUA", name: "Cloro del agua", category: "water", scheduleType: "multiple_daily", instructions: "Mide con el método autorizado. Establece en la plantilla el intervalo de ppm aprobado para esta instalación.", fields: [measurement("Cloro libre residual", "ppm", "critical"), check("Método / reactivo vigente", "warning")] },
  { code: "PH_AGUA", name: "pH del agua", category: "water", scheduleType: "multiple_daily", instructions: "Registra pH y condición del método de medición. Define el rango aplicable antes de publicar.", fields: [measurement("pH", "pH", "warning"), check("Instrumento / tira dentro de vigencia", "warning")] },
  { code: "DESINFECCION_FV", name: "Desinfección de frutas y verduras", category: "water", scheduleType: "adhoc", instructions: "Documenta preparación de solución, concentración/medición, tiempo y lote. Configura criterios según el procedimiento autorizado.", fields: [{ label: "Producto / lote", fieldType: "text" }, measurement("Concentración medida", "ppm", "critical"), measurement("Tiempo de contacto", "min", "critical"), check("Procedimiento completo", "critical")] },
  { code: "PEPS", name: "Verificación PEPS", category: "receiving", scheduleType: "daily", instructions: "Verifica rotación, identificación y acomodo. Adapta campos a la política de la organización.", fields: [check("Producto ordenado por rotación PEPS", "warning", true), check("Etiquetas visibles y legibles", "warning"), check("Sin producto fuera de vida útil", "critical", true)] },
  { code: "CADUCIDADES", name: "Caducidades y vida útil", category: "receiving", scheduleType: "daily", instructions: "Revisa fechas, producto abierto y vida útil interna. Conserva evidencia de cualquier retiro.", fields: [check("Sin producto caducado", "critical", true), check("Producto abierto con identificación vigente", "warning"), { label: "Producto retirado / observación", fieldType: "text", severity: "warning" }] },
  { code: "ALMACEN", name: "Inspección de almacén", category: "cleaning", scheduleType: "daily", instructions: "Verifica orden, limpieza, separación, integridad y rotación.", fields: [check("Área limpia y ordenada"), check("Productos separados del piso"), check("Químicos segregados de alimentos", "critical", true), check("PEPS visible") ] },
  { code: "CUARTO_FRIO", name: "Inspección de cuarto frío", category: "temperature", scheduleType: "daily", instructions: "Combina temperatura, orden, protección e identificación. Ajusta los criterios numéricos antes de publicar.", fields: [measurement("Temperatura", "°C", "critical"), check("Alimentos protegidos"), check("Separación por riesgo"), check("Sin derrames / suciedad") ] },
  { code: "CONGELADOR", name: "Inspección de congelador", category: "temperature", scheduleType: "daily", instructions: "Verifica temperatura, integridad, acomodo y evidencia de descongelación.", fields: [measurement("Temperatura", "°C", "critical"), check("Sin evidencia de descongelación", "critical", true), check("Producto identificado y protegido") ] },
  { code: "LIMPIEZA", name: "Limpieza operativa", category: "cleaning", scheduleType: "per_shift", instructions: "Confirma limpieza del área asignada y documenta desviaciones.", fields: [check("Superficies limpias"), check("Pisos limpios"), check("Residuos retirados"), { label: "Observaciones", fieldType: "text" }] },
  { code: "LIMPIEZA_PROFUNDA", name: "Limpieza profunda", category: "cleaning", scheduleType: "days", instructions: "Usa la recurrencia por días para el programa maestro. Adjunta evidencia antes/después cuando corresponda.", fields: [check("Equipo / área desmontado o accesible según procedimiento"), check("Suciedad acumulada removida", "warning", true), check("Área liberada para operación"), { label: "Área / equipo intervenido", fieldType: "text" }] },
  { code: "HIGIENE_PERSONAL", name: "Higiene personal", category: "hygiene", scheduleType: "per_shift", instructions: "Verifica condiciones de presentación e higiene definidas por la organización.", fields: [check("Uniforme conforme"), check("Manos / uñas conforme"), check("Sin objetos o prácticas no permitidas"), check("Condición apta para manipulación", "critical")] },
  { code: "QUIMICOS", name: "Control de químicos", category: "cleaning", scheduleType: "daily", instructions: "Verifica identificación, almacenamiento, acceso y hojas de seguridad/procedimiento disponibles.", fields: [check("Envases identificados", "critical", true), check("Almacenamiento segregado", "critical"), check("Sin trasvases no identificados", "critical"), check("Instrucciones / hojas disponibles") ] },
  { code: "MUESTRAS_TESTIGO", name: "Muestras testigo", category: "other", scheduleType: "multiple_daily", instructions: "Registra preparación/servicio, identificación, hora y almacenamiento conforme al procedimiento interno.", fields: [{ label: "Preparación / menú", fieldType: "text" }, check("Muestra identificada"), check("Hora / fecha registradas"), check("Almacenamiento conforme", "critical")] },
  { code: "ENTREGA_TURNO", name: "Entrega de turno", category: "other", scheduleType: "per_shift", instructions: "Registra pendientes, condiciones de áreas/equipos y aceptación del turno.", fields: [check("Pendientes comunicados"), check("Áreas críticas revisadas"), check("Equipos críticos reportados"), { label: "Pendientes / observaciones", fieldType: "text" }] },
  { code: "UTENSILIOS", name: "Verificación de utensilios", category: "cleaning", scheduleType: "per_shift", instructions: "Confirma limpieza, integridad y segregación/uso de utensilios de acuerdo con el procedimiento.", fields: [check("Utensilios limpios"), check("Sin daño que comprometa inocuidad", "critical"), check("Uso / segregación conforme") ] },
  { code: "INCIDENTE_INOCUIDAD", name: "Incidencia de inocuidad", category: "other", scheduleType: "adhoc", instructions: "Registro ad hoc para documentar una incidencia, contención, producto afectado y escalamiento.", fields: [selection("Severidad operativa", ["Baja", "Media", "Alta", "Crítica"], "critical"), { label: "Descripción del incidente", fieldType: "text", severity: "critical" }, { label: "Contención inmediata", fieldType: "text", severity: "critical", evidenceRequired: true }, check("Supervisor informado", "critical")] },
  { code: "CONTROL_PLAGAS", name: "Verificación de control de plagas", category: "cleaning", scheduleType: "days", instructions: "Documenta evidencia de actividad, dispositivos/estaciones y acciones de seguimiento sin sustituir al proveedor especializado.", fields: [check("Sin evidencia visible de plaga", "critical", true), check("Dispositivos / estaciones en condición"), { label: "Hallazgo / ubicación", fieldType: "text" }] },
  { code: "RECHAZO_PRODUCTO", name: "Recepción / rechazo de producto", category: "receiving", scheduleType: "adhoc", instructions: "Documenta causa de rechazo o retención, proveedor, lote y evidencia.", fields: [{ label: "Proveedor", fieldType: "text" }, { label: "Producto / lote", fieldType: "text" }, selection("Resultado", ["Aceptado", "Rechazado", "Retenido"], "critical"), { label: "Motivo / desviación", fieldType: "text", severity: "critical", evidenceRequired: true }] },
];
