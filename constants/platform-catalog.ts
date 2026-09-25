import type { BusinessProfileKey, ModuleKey } from "@/types";

export interface BusinessProfilePreset {
  id: string;
  key: BusinessProfileKey;
  name: string;
  description: string;
  recommendedModules: ModuleKey[];
}

export const BUSINESS_PROFILE_PRESETS: BusinessProfilePreset[] = [
  {
    id: "profile-street-food",
    key: "street_food",
    name: "Puesto o taquería",
    description: "Operación compacta con compras, existencias, producción y costos.",
    recommendedModules: ["core", "inventory", "purchasing", "production", "finance", "kiro"],
  },
  {
    id: "profile-cafe",
    key: "cafe",
    name: "Cafetería o panadería",
    description: "Control de insumos, producción, mermas y calidad cotidiana.",
    recommendedModules: ["core", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  },
  {
    id: "profile-restaurant",
    key: "restaurant",
    name: "Restaurante",
    description: "Operación integral de personal, calidad, inventario, compras y recetas.",
    recommendedModules: ["core", "personnel", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  },
  {
    id: "profile-dark-kitchen",
    key: "dark_kitchen",
    name: "Dark kitchen",
    description: "Producción enfocada en pedidos, rendimiento y disponibilidad de insumos.",
    recommendedModules: ["core", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  },
  {
    id: "profile-central-kitchen",
    key: "central_kitchen",
    name: "Cocina central o catering",
    description: "Producción por volumen, transferencias, servicios y trazabilidad.",
    recommendedModules: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  },
  {
    id: "profile-industrial-canteen",
    key: "industrial_canteen",
    name: "Comedor industrial",
    description: "Personal, checador, comensales, múltiples clientes, calidad y operación completa.",
    recommendedModules: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  },
  {
    id: "profile-institutional",
    key: "institutional",
    name: "Operación institucional",
    description: "Hospital, residencia o comedor escolar con controles avanzados y auditoría.",
    recommendedModules: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"],
  },
];

export const PLAN_PRESETS = [
  {
    id: "plan-essential",
    code: "essential",
    name: "Esencial",
    description: "Para una operación pequeña que necesita orden sin complejidad innecesaria.",
    billingModel: "per_organization" as const,
    monthlyPrice: 1490,
    currency: "MXN",
    includedModules: ["core", "inventory", "purchasing", "kiro"] satisfies ModuleKey[],
    limits: { branches: 1, users: 5, employees: 80, devices: 2 },
  },
  {
    id: "plan-operation",
    code: "operation",
    name: "Operación",
    description: "Para restaurantes, cocinas y comedores que digitalizan el flujo diario.",
    billingModel: "per_branch" as const,
    monthlyPrice: 4500,
    currency: "MXN",
    includedModules: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "kiro"] satisfies ModuleKey[],
    limits: { branches: 5, users: 25, employees: 1000, devices: 15 },
  },
  {
    id: "plan-industrial",
    code: "industrial",
    name: "Industrial",
    description: "Para organizaciones multisucursal con controles, permisos y soporte avanzados.",
    billingModel: "per_branch" as const,
    monthlyPrice: 7500,
    currency: "MXN",
    includedModules: ["core", "personnel", "services", "quality", "inventory", "purchasing", "production", "finance", "kiro"] satisfies ModuleKey[],
    limits: { branches: null, users: null, employees: null, devices: null },
  },
];
