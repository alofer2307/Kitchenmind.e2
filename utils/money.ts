export function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMinorMoney(valueMinor: number, currency = "MXN", locale = "es-MX"): string {
  if (!Number.isSafeInteger(valueMinor)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueMinor / 100);
}

export function percentageToBasisPoints(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("El porcentaje debe estar entre 0 y 100.");
  return Math.round(value * 100);
}
