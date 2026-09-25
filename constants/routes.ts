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
  { href: "/", label: "Dashboard", icon: Gauge, module: "core" },
  { href: "/empleados", label: "Empleados", icon: Users, module: "personnel" },
  { href: "/turnos", label: "Turnos", icon: ClipboardCheck, module: "personnel" },
  { href: "/sucursales", label: "Sucursales", icon: Building2, module: "core" },
  { href: "/inventario", label: "Inventario", icon: Boxes, module: "inventory" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, module: "purchasing" },
  { href: "/calidad", label: "Calidad", icon: PackageOpen, module: "quality" },
  { href: "/actividad", label: "Actividad", icon: Activity, module: "core" },
  { href: "/kiro", label: "Kiro", icon: Sparkles, module: "kiro" },
  { href: "/configuracion", label: "Configuración", icon: Settings, module: "core" },
] as const;
