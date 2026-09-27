import {
  Activity,
  Boxes,
  Building2,
  ClipboardCheck,
  Gauge,
  PackageOpen,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";

export const ADMIN_ROUTES = [
  { href: "/demo", label: "Dashboard", icon: Gauge, module: "core" },
  { href: "/demo/empleados", label: "Empleados", icon: Users, module: "personnel" },
  { href: "/demo/turnos", label: "Turnos", icon: ClipboardCheck, module: "personnel" },
  { href: "/demo/sucursales", label: "Sucursales", icon: Building2, module: "core" },
  { href: "/demo/inventario", label: "Inventario", icon: Boxes, module: "inventory" },
  { href: "/demo/compras", label: "Compras", icon: ShoppingCart, module: "purchasing" },
  { href: "/demo/calidad", label: "Calidad", icon: PackageOpen, module: "quality" },
  { href: "/demo/actividad", label: "Actividad", icon: Activity, module: "core" },
  { href: "/demo/kiro", label: "Kiro", icon: Sparkles, module: "kiro" },
  { href: "/demo/configuracion", label: "Configuración", icon: Settings, module: "core" },
] as const;
