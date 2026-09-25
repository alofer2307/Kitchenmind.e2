import type {
  CalculatedQuoteLine,
  PriceRule,
  PriceTier,
  PricingResult,
  PricingSelection,
  QuoteAdjustmentScope,
  QuoteAdjustmentType,
} from "@/types";

export interface PricingAdjustmentInput {
  type: QuoteAdjustmentType;
  scope: QuoteAdjustmentScope;
  value: number;
  reason: string;
  lineCode?: string;
}

export interface PricingEngineInput {
  currency: string;
  rules: Array<PriceRule & { tiers: PriceTier[] }>;
  selection: PricingSelection;
  adjustments?: PricingAdjustmentInput[];
}

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} debe ser un entero no negativo.`);
  return value;
}

function quantityFor(unitType: PriceRule["unitType"], selection: PricingSelection): number {
  if (unitType === "branch") return selection.quantities.branches;
  if (unitType === "employee") return selection.quantities.employees;
  if (unitType === "user") return selection.quantities.users;
  if (unitType === "device") return selection.quantities.devices;
  if (unitType === "warehouse") return selection.quantities.warehouses;
  if (unitType === "movement" || unitType === "service") return selection.quantities.monthlyMovements;
  return 1;
}

function optionalQuantity(rule: PriceRule, selection: PricingSelection): number | null {
  if (rule.code.startsWith("implementation.")) return selection.implementationCodes.includes(rule.code) ? 1 : null;
  if (rule.code.startsWith("training.")) return selection.trainingCodes.includes(rule.code) ? 1 : null;
  if (rule.code.startsWith("support.")) return selection.supportCode === rule.code ? 1 : null;
  if (rule.code.startsWith("hardware.")) return selection.hardware.find((item) => item.code === rule.code)?.quantity ?? null;
  return quantityFor(rule.unitType, selection);
}

function ruleApplies(rule: PriceRule, selection: PricingSelection): boolean {
  if (!rule.active) return false;
  if (rule.moduleCode && !selection.moduleCodes.includes(rule.moduleCode)) return false;
  if (rule.featureCode && !selection.featureCodes.includes(rule.featureCode)) return false;
  if (rule.billingPeriod === "annual" && selection.billingCycle !== "annual") return false;
  return optionalQuantity(rule, selection) !== null;
}

function tierFor(quantity: number, tiers: PriceTier[]): PriceTier | null {
  return tiers.find((tier) => quantity >= tier.minimumQuantity && (tier.maximumQuantity === null || quantity <= tier.maximumQuantity)) ?? null;
}

function calculatedLine(rule: PriceRule & { tiers: PriceTier[] }, selection: PricingSelection): CalculatedQuoteLine | null {
  const rawQuantity = optionalQuantity(rule, selection);
  if (rawQuantity === null) return null;
  const measuredQuantity = integer(rawQuantity, `Cantidad de ${rule.name}`);
  if (rule.maximumQuantity !== null && measuredQuantity > rule.maximumQuantity && rule.tiers.length === 0) return null;
  if (measuredQuantity < rule.minimumQuantity && rule.tiers.length === 0) return null;

  const tier = tierFor(measuredQuantity, rule.tiers);
  if (rule.tiers.length > 0 && !tier) throw new Error(`El catálogo no cubre la cantidad ${measuredQuantity} para ${rule.name}.`);
  const chargeQuantity = rule.chargeType.startsWith("per_") && rule.minimumQuantity > 0 && rule.tiers.length === 0
    ? Math.max(0, measuredQuantity - rule.minimumQuantity + 1)
    : rule.unitType === "flat" || rule.unitType === "organization" || rule.tiers.length > 0
      ? 1
      : measuredQuantity;
  const unitAmountMinor = tier ? tier.unitAmountMinor : rule.unitAmountMinor;
  const subtotalMinor = tier ? tier.flatAmountMinor + tier.unitAmountMinor * measuredQuantity : unitAmountMinor * chargeQuantity;
  if (subtotalMinor === 0 && rule.code !== "platform.employees") return null;
  const range = tier
    ? `${tier.minimumQuantity} a ${tier.maximumQuantity ?? "más"}`
    : rule.minimumQuantity > 1
      ? `desde ${rule.minimumQuantity}`
      : null;
  const explanation = tier
    ? `${rule.name}: nivel de ${range} para ${measuredQuantity.toLocaleString("es-MX")} ${rule.unitType}.`
    : rule.chargeType.startsWith("per_")
      ? `${rule.name}: ${chargeQuantity.toLocaleString("es-MX")} unidad${chargeQuantity === 1 ? "" : "es"} facturable${chargeQuantity === 1 ? "" : "s"}${range ? ` (${range})` : ""}.`
      : rule.description;
  return {
    sourceRuleId: rule.id,
    code: rule.code,
    description: rule.name,
    explanation,
    billingPeriod: rule.billingPeriod,
    unitType: rule.unitType,
    quantity: chargeQuantity,
    unitAmountMinor,
    subtotalMinor,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: subtotalMinor,
    internalCostMinor: rule.internalCostMinor === null ? null : rule.internalCostMinor * Math.max(1, chargeQuantity),
    moduleCode: rule.moduleCode,
    featureCode: rule.featureCode,
  };
}

function discountFor(base: number, adjustment: PricingAdjustmentInput): number {
  if (!adjustment.reason.trim()) throw new Error("Cada descuento necesita un motivo.");
  integer(adjustment.value, "Descuento");
  const amount = adjustment.type === "percentage"
    ? Math.round(base * Math.min(adjustment.value, 10_000) / 10_000)
    : adjustment.value;
  if (amount > base) throw new Error("El descuento no puede ser mayor al importe aplicable.");
  return amount;
}

function allocateDiscount(lines: CalculatedQuoteLine[], amount: number): void {
  const eligible = lines.filter((line) => line.subtotalMinor > 0);
  const base = eligible.reduce((sum, line) => sum + line.subtotalMinor, 0);
  if (base === 0 || amount === 0) return;
  let remaining = amount;
  eligible.forEach((line, index) => {
    const allocated = index === eligible.length - 1 ? remaining : Math.round(amount * line.subtotalMinor / base);
    line.discountMinor += allocated;
    remaining -= allocated;
  });
}

export function validatePriceTiers(tiers: Array<Pick<PriceTier, "minimumQuantity" | "maximumQuantity">>, requireContinuity = true): string[] {
  const errors: string[] = [];
  const ordered = [...tiers].sort((a, b) => a.minimumQuantity - b.minimumQuantity);
  if (requireContinuity && ordered.length > 0 && ordered[0]?.minimumQuantity !== 0) errors.push("Los rangos continuos deben iniciar en cero.");
  if (requireContinuity && ordered.length > 0 && ordered.at(-1)?.maximumQuantity !== null) errors.push("El último rango continuo debe quedar sin límite superior.");
  ordered.forEach((tier, index) => {
    if (!Number.isSafeInteger(tier.minimumQuantity) || tier.minimumQuantity < 0) errors.push("Cada rango necesita una cantidad mínima válida.");
    if (tier.maximumQuantity !== null && tier.maximumQuantity < tier.minimumQuantity) errors.push("La cantidad máxima no puede ser menor a la mínima.");
    const previous = ordered[index - 1];
    if (!previous) return;
    if (previous.maximumQuantity === null || tier.minimumQuantity <= previous.maximumQuantity) errors.push("Los rangos de precio no pueden superponerse.");
    if (requireContinuity && previous.maximumQuantity !== null && tier.minimumQuantity !== previous.maximumQuantity + 1) errors.push("Los rangos deben ser continuos.");
  });
  return [...new Set(errors)];
}

export function calculatePricing(input: PricingEngineInput): PricingResult {
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("La moneda debe usar un código ISO de tres letras.");
  const quantities = input.selection.quantities;
  Object.entries(quantities).forEach(([key, value]) => integer(value, `Cantidad ${key}`));
  integer(input.selection.taxRateBasisPoints, "Impuesto");
  if (input.selection.taxRateBasisPoints > 10_000) throw new Error("La tasa de impuesto no puede superar 100%. ");
  if (!input.selection.moduleCodes.includes("core")) throw new Error("CORE es obligatorio en toda solución KitchenMind.");

  const lines = input.rules
    .filter((rule) => rule.currency === currency && ruleApplies(rule, input.selection))
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code))
    .map((rule) => calculatedLine(rule, input.selection))
    .filter((line): line is CalculatedQuoteLine => line !== null);

  const oneTimeLines = lines.filter((line) => line.billingPeriod === "one_time");
  const recurringLines = lines.filter((line) => line.billingPeriod !== "one_time");
  for (const adjustment of input.adjustments ?? []) {
    if (adjustment.scope === "line") {
      const line = lines.find((candidate) => candidate.code === adjustment.lineCode);
      if (!line) throw new Error("La partida seleccionada para el descuento no existe.");
      line.discountMinor += discountFor(line.subtotalMinor - line.discountMinor, adjustment);
      continue;
    }
    const eligible = adjustment.scope === "implementation" ? oneTimeLines : adjustment.scope === "recurring" ? recurringLines : lines;
    const base = eligible.reduce((sum, line) => sum + line.subtotalMinor - line.discountMinor, 0);
    allocateDiscount(eligible, discountFor(base, adjustment));
  }

  for (const line of lines) {
    const taxable = line.subtotalMinor - line.discountMinor;
    line.taxMinor = Math.round(taxable * input.selection.taxRateBasisPoints / 10_000);
    line.totalMinor = taxable + line.taxMinor;
  }
  const subtotalOneTimeMinor = oneTimeLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
  const subtotalRecurringMinor = recurringLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
  const discountOneTimeMinor = oneTimeLines.reduce((sum, line) => sum + line.discountMinor, 0);
  const discountRecurringMinor = recurringLines.reduce((sum, line) => sum + line.discountMinor, 0);
  const taxOneTimeMinor = oneTimeLines.reduce((sum, line) => sum + line.taxMinor, 0);
  const taxRecurringMinor = recurringLines.reduce((sum, line) => sum + line.taxMinor, 0);
  const totalOneTimeMinor = oneTimeLines.reduce((sum, line) => sum + line.totalMinor, 0);
  const monthlyTotalMinor = recurringLines.reduce((sum, line) => sum + (line.billingPeriod === "annual" ? Math.round(line.totalMinor / 12) : line.totalMinor), 0);
  const annualTotalMinor = recurringLines.reduce((sum, line) => sum + (line.billingPeriod === "annual" ? line.totalMinor : line.totalMinor * 12), 0);
  const firstPaymentMinor = totalOneTimeMinor + (input.selection.billingCycle === "annual" ? annualTotalMinor : monthlyTotalMinor);
  const internalCostMinor = lines.reduce((sum, line) => sum + (line.internalCostMinor ?? 0), 0);
  const recurringInternalCost = recurringLines.reduce((sum, line) => sum + (line.internalCostMinor ?? 0), 0);
  const warnings: string[] = [];
  if (!lines.some((line) => line.code === "platform.base")) warnings.push("El catálogo no contiene una cuota base activa.");
  if (input.selection.quantities.employees > 500) warnings.push("El volumen supera 500 empleados; revisar implementación y soporte antes de enviar.");
  if (input.selection.quantities.branches > 10) warnings.push("La operación supera 10 sucursales; validar despliegue y capacitación.");
  return {
    currency,
    lines,
    subtotalOneTimeMinor,
    subtotalRecurringMinor,
    discountOneTimeMinor,
    discountRecurringMinor,
    discountTotalMinor: discountOneTimeMinor + discountRecurringMinor,
    taxOneTimeMinor,
    taxRecurringMinor,
    taxTotalMinor: taxOneTimeMinor + taxRecurringMinor,
    totalOneTimeMinor,
    monthlyTotalMinor,
    totalRecurringMinor: recurringLines.reduce((sum, line) => sum + line.totalMinor, 0),
    annualTotalMinor,
    annualEquivalentMinor: annualTotalMinor,
    firstPaymentMinor,
    internalCostMinor,
    estimatedMonthlyMarginMinor: monthlyTotalMinor - recurringInternalCost,
    warnings,
    appliedRules: lines.map((line) => line.explanation),
  };
}
