import type { BillingPeriod, CommercialUnitType, DiagnosisFieldType, PriceChargeType } from "@/types";

export interface CommercialModuleSeed {
  code: string;
  name: string;
  description: string;
  category: string;
  displayOrder: number;
}

export interface CommercialFeatureSeed {
  code: string;
  moduleCode: string;
  name: string;
  description: string;
  unitType: CommercialUnitType;
  billable: boolean;
}

export interface DiagnosisQuestionSeed {
  sectionCode: string;
  questionCode: string;
  label: string;
  fieldType: DiagnosisFieldType;
  required: boolean;
  options?: string[];
  moduleCode?: string;
  featureCode?: string;
}

export interface InitialPriceRuleSeed {
  code: string;
  name: string;
  description: string;
  chargeType: PriceChargeType;
  billingPeriod: BillingPeriod;
  unitType: CommercialUnitType;
  moduleCode?: string;
  featureCode?: string;
  unitAmountMinor: number;
  internalCostMinor?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  priority: number;
  stackingMode?: "add" | "replace";
  tiers?: Array<{ minimumQuantity: number; maximumQuantity?: number; unitAmountMinor?: number; flatAmountMinor?: number }>;
}

export const COMMERCIAL_MODULES: CommercialModuleSeed[] = [
  { code: "core", name: "Core", description: "Organización, sucursales, usuarios, configuración, actividad y archivos.", category: "CORE", displayOrder: 10 },
  { code: "personnel", name: "Personal", description: "Empleados, turnos, checador, asistencia e incidencias.", category: "PERSONAL", displayOrder: 20 },
  { code: "services", name: "Servicios", description: "Comensales, tipos de servicio, elegibilidad y conteos facturables.", category: "SERVICES", displayOrder: 30 },
  { code: "quality", name: "Calidad", description: "Bitácoras, rangos, incidencias, evidencias y acciones correctivas.", category: "QUALITY", displayOrder: 40 },
  { code: "inventory", name: "Inventario", description: "Productos, almacenes, lotes, caducidades, movimientos y mermas.", category: "INVENTORY", displayOrder: 50 },
  { code: "purchasing", name: "Compras", description: "Proveedores, solicitudes, órdenes, recepción e historial de precios.", category: "PURCHASING", displayOrder: 60 },
  { code: "production", name: "Producción", description: "Menús, recetas, escandallos, rendimientos y consumos.", category: "PRODUCTION", displayOrder: 70 },
  { code: "finance", name: "Finanzas", description: "Costos por receta o servicio, presupuestos y rentabilidad operativa.", category: "FINANCE", displayOrder: 80 },
  { code: "kiro", name: "Kiro", description: "Hallazgos, recomendaciones, alertas y reportes explicables.", category: "KIRO", displayOrder: 90 },
];

export const COMMERCIAL_FEATURES: CommercialFeatureSeed[] = [
  { code: "core.multibranch", moduleCode: "core", name: "Operación multisucursal", description: "Gestiona varias unidades desde una sola organización.", unitType: "branch", billable: true },
  { code: "core.offline", moduleCode: "core", name: "Operación offline", description: "Mantiene kioscos críticos disponibles sin Internet.", unitType: "device", billable: true },
  { code: "personnel.attendance", moduleCode: "personnel", name: "Checador y asistencia", description: "Entradas, salidas, retardos y excepciones auditadas.", unitType: "employee", billable: true },
  { code: "personnel.payroll_export", moduleCode: "personnel", name: "Exportación para nómina", description: "Resumen normalizado para integración futura.", unitType: "organization", billable: false },
  { code: "services.diners", moduleCode: "services", name: "Comensales", description: "Registro por servicio, persona, cliente y sucursal.", unitType: "service", billable: true },
  { code: "services.billable_counts", moduleCode: "services", name: "Conteos facturables", description: "Consolida consumos con trazabilidad y duplicados controlados.", unitType: "movement", billable: true },
  { code: "quality.logs", moduleCode: "quality", name: "Bitácoras configurables", description: "Plantillas, frecuencias, rangos y responsables.", unitType: "branch", billable: true },
  { code: "quality.regional", moduleCode: "quality", name: "Supervisión regional", description: "Comparación y seguimiento entre unidades autorizadas.", unitType: "branch", billable: true },
  { code: "inventory.lots", moduleCode: "inventory", name: "Lotes y caducidades", description: "Trazabilidad PEPS/FEFO por producto y ubicación.", unitType: "warehouse", billable: true },
  { code: "inventory.transfers", moduleCode: "inventory", name: "Transferencias", description: "Movimientos auditados entre sucursales y almacenes.", unitType: "movement", billable: false },
  { code: "purchasing.approvals", moduleCode: "purchasing", name: "Aprobaciones de compra", description: "Solicitudes y órdenes con responsables y estados.", unitType: "user", billable: false },
  { code: "purchasing.price_history", moduleCode: "purchasing", name: "Historial de precios", description: "Compara costos y cambios de proveedor.", unitType: "organization", billable: false },
  { code: "production.recipes", moduleCode: "production", name: "Recetas y escandallos", description: "Rendimientos, porciones y consumo teórico.", unitType: "organization", billable: true },
  { code: "production.forecast", moduleCode: "production", name: "Pronóstico de producción", description: "Planifica volúmenes y necesidades de insumo.", unitType: "service", billable: true },
  { code: "finance.costing", moduleCode: "finance", name: "Costos operativos", description: "Costo por receta, por servicio y diferencias.", unitType: "organization", billable: true },
  { code: "kiro.insights", moduleCode: "kiro", name: "Asesor estratégico", description: "Explica hallazgos y recomendaciones sin lenguaje acusatorio.", unitType: "organization", billable: true },
];

const sectionFeatures: Record<string, Array<[string, string, string?, string?]>> = {
  personal: [
    ["employees", "Gestión de empleados", "personnel", "personnel.attendance"], ["human_resources", "Recursos Humanos", "personnel"], ["shifts", "Turnos", "personnel"],
    ["rotating_shifts", "Turnos rotativos", "personnel"], ["night_shifts", "Horarios nocturnos", "personnel"], ["calendars", "Calendarios", "personnel"],
    ["time_clock", "Checador", "personnel", "personnel.attendance"], ["badges", "Gafetes", "personnel", "personnel.attendance"], ["lateness", "Retardos", "personnel"],
    ["absences", "Ausencias", "personnel"], ["incidents", "Incidencias", "personnel"], ["missing_events", "Registros faltantes", "personnel"],
    ["payroll_export", "Exportación para nómina", "personnel", "personnel.payroll_export"],
  ],
  services: [
    ["diners", "Comensales", "services", "services.diners"], ["service_types", "Tipos de servicio", "services"], ["breakfast", "Desayunos", "services"],
    ["lunch", "Comidas", "services"], ["dinner", "Cenas", "services"], ["snacks", "Colaciones", "services"], ["special", "Servicios especiales", "services"],
    ["internal_clients", "Clientes internos", "services"], ["external_clients", "Clientes externos", "services"], ["visitors", "Visitantes", "services"],
    ["eligibility", "Elegibilidad", "services"], ["limits", "Límites por persona", "services"], ["duplicates", "Detección de duplicados", "services"],
    ["billable_counts", "Conteos facturables", "services", "services.billable_counts"],
  ],
  quality: [
    ["logs", "Bitácoras", "quality", "quality.logs"], ["temperatures", "Temperaturas", "quality"], ["chlorine", "Cloro", "quality"], ["ph", "pH", "quality"],
    ["reception", "Recepción", "quality"], ["rejected_product", "Producto rechazado", "quality"], ["samples", "Muestras", "quality"], ["hygiene", "Higiene", "quality"],
    ["cleaning", "Limpieza", "quality"], ["corrective_actions", "Acciones correctivas", "quality"], ["evidence", "Evidencias", "quality"], ["signatures", "Firmas", "quality"],
    ["audits", "Auditorías", "quality"], ["regional", "Supervisión regional", "quality", "quality.regional"], ["branch_comparison", "Comparación entre sucursales", "quality", "quality.regional"],
  ],
  inventory: [
    ["products", "Productos", "inventory"], ["warehouses", "Almacenes", "inventory", "inventory.lots"], ["minimum_stock", "Stock mínimo", "inventory"],
    ["lots", "Lotes", "inventory", "inventory.lots"], ["expirations", "Caducidades", "inventory", "inventory.lots"], ["fifo", "PEPS", "inventory"], ["fefo", "FEFO", "inventory"],
    ["entries", "Entradas", "inventory"], ["exits", "Salidas", "inventory"], ["transfers", "Transferencias", "inventory", "inventory.transfers"],
    ["counts", "Conteos físicos", "inventory"], ["adjustments", "Ajustes", "inventory"], ["waste", "Mermas", "inventory"],
  ],
  purchasing: [
    ["suppliers", "Proveedores", "purchasing"], ["requests", "Solicitudes", "purchasing"], ["orders", "Órdenes de compra", "purchasing"],
    ["approvals", "Aprobaciones", "purchasing", "purchasing.approvals"], ["reception", "Recepción", "purchasing"], ["returns", "Devoluciones", "purchasing"],
    ["price_history", "Historial de precios", "purchasing", "purchasing.price_history"], ["pending", "Compras pendientes", "purchasing"],
  ],
  production: [
    ["menus", "Menús", "production"], ["recipes", "Recetas", "production", "production.recipes"], ["cost_sheets", "Escandallos", "production", "production.recipes"],
    ["yields", "Rendimientos", "production"], ["portions", "Porciones", "production"], ["daily", "Producción diaria", "production"],
    ["theoretical", "Consumo teórico", "production"], ["actual", "Consumo real", "production"], ["differences", "Diferencias", "production"],
    ["forecast", "Pronósticos", "production", "production.forecast"],
  ],
  finance: [
    ["recipe_cost", "Costo por receta", "finance", "finance.costing"], ["service_cost", "Costo por servicio", "finance", "finance.costing"],
    ["profitability", "Rentabilidad", "finance"], ["budgets", "Presupuestos", "finance"], ["operating_costs", "Costos operativos", "finance"],
    ["estimated_billing", "Facturación estimada", "finance"],
  ],
  implementation: [
    ["manual_capture", "Captura manual"], ["csv_import", "Importación de Excel/CSV"], ["data_cleaning", "Limpieza de datos"], ["training", "Capacitación"],
    ["initial_setup", "Configuración inicial"], ["onsite_visit", "Visita presencial"], ["remote_support", "Soporte remoto"],
    ["priority_support", "Soporte prioritario"], ["hardware", "Hardware"], ["readers", "Lectores"], ["tablets", "Tablets"], ["badges_labels", "Etiquetas o gafetes"],
  ],
};

const generalQuestions: DiagnosisQuestionSeed[] = [
  { sectionCode: "general", questionCode: "business_type", label: "Tipo de negocio", fieldType: "select", required: true, options: ["Puesto o taquería", "Cafetería o panadería", "Restaurante", "Dark kitchen", "Cocina central o catering", "Comedor industrial", "Operación institucional", "Otro"] },
  { sectionCode: "general", questionCode: "current_branches", label: "Número de sucursales actuales", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "planned_branches", label: "Sucursales previstas", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "employees", label: "Empleados", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "admin_users", label: "Usuarios administrativos", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "devices", label: "Dispositivos", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "warehouses", label: "Almacenes", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "kitchens", label: "Cocinas", fieldType: "number", required: false },
  { sectionCode: "general", questionCode: "daily_services", label: "Servicios diarios", fieldType: "number", required: true },
  { sectionCode: "general", questionCode: "operates_24_hours", label: "Operación 24 horas", fieldType: "boolean", required: true },
  { sectionCode: "general", questionCode: "multi_branch", label: "Operación multisucursal", fieldType: "boolean", required: true, moduleCode: "core", featureCode: "core.multibranch" },
  { sectionCode: "general", questionCode: "requires_offline", label: "Necesidad de funcionamiento offline", fieldType: "boolean", required: true, moduleCode: "core", featureCode: "core.offline" },
  { sectionCode: "general", questionCode: "monthly_movements", label: "Movimientos mensuales estimados", fieldType: "number", required: false },
  { sectionCode: "general", questionCode: "country", label: "País", fieldType: "text", required: true },
  { sectionCode: "general", questionCode: "currency", label: "Moneda", fieldType: "text", required: true },
  { sectionCode: "general", questionCode: "timezone", label: "Zona horaria", fieldType: "text", required: true },
];

export const DIAGNOSIS_QUESTIONS: DiagnosisQuestionSeed[] = [
  ...generalQuestions,
  ...Object.entries(sectionFeatures).flatMap(([sectionCode, questions]) => questions.map(([code, label, moduleCode, featureCode]) => ({
    sectionCode,
    questionCode: `${sectionCode}.${code}`,
    label,
    fieldType: "boolean" as const,
    required: false,
    moduleCode,
    featureCode,
  }))),
];

export const BUSINESS_PROFILE_MODULES: Record<string, string[]> = {
  street_food: ["core", "inventory", "purchasing", "production", "finance", "kiro"],
  cafe: ["core", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  restaurant: ["core", "personnel", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  dark_kitchen: ["core", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  central_kitchen: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  industrial_canteen: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  institutional: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
};

export const INITIAL_PRICE_RULES: InitialPriceRuleSeed[] = [
  { code: "platform.base", name: "Cuota base de plataforma", description: "Núcleo KitchenMind para una organización.", chargeType: "monthly", billingPeriod: "monthly", unitType: "organization", unitAmountMinor: 149000, internalCostMinor: 38000, priority: 10 },
  { code: "platform.branch", name: "Sucursal adicional", description: "Precio por sucursal a partir de la segunda.", chargeType: "per_branch", billingPeriod: "monthly", unitType: "branch", unitAmountMinor: 85000, internalCostMinor: 12000, minimumQuantity: 2, priority: 20 },
  { code: "platform.employees", name: "Nivel de empleados", description: "Capacidad operativa según empleados registrados.", chargeType: "per_employee", billingPeriod: "monthly", unitType: "employee", unitAmountMinor: 0, priority: 30, stackingMode: "replace", tiers: [
    { minimumQuantity: 0, maximumQuantity: 50, flatAmountMinor: 0 },
    { minimumQuantity: 51, maximumQuantity: 200, flatAmountMinor: 90000 },
    { minimumQuantity: 201, maximumQuantity: 500, flatAmountMinor: 190000 },
    { minimumQuantity: 501, flatAmountMinor: 350000 },
  ] },
  { code: "module.personnel", name: "Módulo Personal", description: "Empleados, turnos y asistencia.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "personnel", unitAmountMinor: 119000, internalCostMinor: 25000, priority: 100 },
  { code: "module.services", name: "Módulo Servicios", description: "Comensales y conteos de servicio.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "services", unitAmountMinor: 129000, internalCostMinor: 27000, priority: 110 },
  { code: "module.quality", name: "Módulo Calidad", description: "Bitácoras e incidencias configurables.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "quality", unitAmountMinor: 149000, internalCostMinor: 35000, priority: 120 },
  { code: "module.inventory", name: "Módulo Inventario", description: "Existencias, lotes y movimientos.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "inventory", unitAmountMinor: 99000, internalCostMinor: 22000, priority: 130 },
  { code: "module.purchasing", name: "Módulo Compras", description: "Proveedores y órdenes de compra.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "purchasing", unitAmountMinor: 79000, internalCostMinor: 18000, priority: 140 },
  { code: "module.production", name: "Módulo Producción", description: "Recetas, menús y rendimientos.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "production", unitAmountMinor: 129000, internalCostMinor: 28000, priority: 150 },
  { code: "module.finance", name: "Módulo Finanzas", description: "Costos y rentabilidad operativa.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "finance", unitAmountMinor: 89000, internalCostMinor: 19000, priority: 160 },
  { code: "module.kiro", name: "Módulo Kiro", description: "Asesor estratégico de operación.", chargeType: "monthly", billingPeriod: "monthly", unitType: "flat", moduleCode: "kiro", unitAmountMinor: 59000, internalCostMinor: 16000, priority: 170 },
  { code: "implementation.standard", name: "Implementación inicial", description: "Configuración, acompañamiento y activación inicial.", chargeType: "one_time", billingPeriod: "one_time", unitType: "organization", unitAmountMinor: 450000, internalCostMinor: 180000, priority: 300 },
  { code: "implementation.import", name: "Importación asistida", description: "Validación e importación inicial de catálogos.", chargeType: "one_time", billingPeriod: "one_time", unitType: "custom", unitAmountMinor: 250000, internalCostMinor: 100000, priority: 310 },
  { code: "training.remote", name: "Capacitación remota", description: "Sesión de capacitación para administradores.", chargeType: "one_time", billingPeriod: "one_time", unitType: "custom", unitAmountMinor: 180000, internalCostMinor: 70000, priority: 320 },
  { code: "support.priority", name: "Soporte prioritario", description: "Atención prioritaria para responsables autorizados.", chargeType: "monthly", billingPeriod: "monthly", unitType: "organization", unitAmountMinor: 149000, internalCostMinor: 50000, priority: 330 },
  { code: "hardware.reader", name: "Lector HID", description: "Lector compatible; no incluye instalación física.", chargeType: "one_time", billingPeriod: "one_time", unitType: "device", unitAmountMinor: 95000, internalCostMinor: 65000, priority: 400 },
  { code: "hardware.tablet", name: "Tablet operativa", description: "Equipo opcional sujeto a disponibilidad.", chargeType: "one_time", billingPeriod: "one_time", unitType: "device", unitAmountMinor: 420000, internalCostMinor: 340000, priority: 410 },
];

export const DIAGNOSIS_SECTION_LABELS: Record<string, string> = {
  general: "Datos generales",
  personal: "Personal",
  services: "Servicios",
  quality: "Calidad",
  inventory: "Inventario",
  purchasing: "Compras",
  production: "Producción",
  finance: "Finanzas",
  implementation: "Implementación",
};
