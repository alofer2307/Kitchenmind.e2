import type { DashboardSnapshot } from "./dashboard.service";

export interface KiroFinding {
  id: string;
  level: "info" | "attention" | "critical";
  found: string;
  importance: string;
  recommendation: string;
}

export function getKiroFindings(snapshot: DashboardSnapshot): KiroFinding[] {
  const findings: KiroFinding[] = [];

  if (snapshot.metrics.lowStockProducts > 0) {
    findings.push({
      id: "low-stock",
      level: "attention",
      found: `Encontré ${snapshot.metrics.lowStockProducts} producto${snapshot.metrics.lowStockProducts === 1 ? "" : "s"} con stock bajo.`,
      importance: "Una reposición tardía puede afectar el menú o generar compras urgentes.",
      recommendation: "Revisa el pedido sugerido y las compras que todavía están pendientes.",
    });
  }

  if (snapshot.metrics.lateToday > 0) {
    findings.push({
      id: "late-arrivals",
      level: "info",
      found: `Encontré ${snapshot.metrics.lateToday} registro${snapshot.metrics.lateToday === 1 ? "" : "s"} fuera de la tolerancia configurada.`,
      importance: "Puede cambiar la cobertura real al inicio del turno.",
      recommendation: "Confirma la cobertura del área antes de ajustar la operación.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: "stable-operation",
      level: "info",
      found: "No encontré alertas críticas con los datos disponibles.",
      importance: "La operación se mantiene dentro de los parámetros configurados.",
      recommendation: "Mantén el seguimiento de servicios, inventario y calidad durante el turno.",
    });
  }

  return findings;
}
