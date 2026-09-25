import type { InventoryLot } from "@/types";

export type StockRotationPolicy = "fifo" | "fefo";

export function recommendNextLot(lots: InventoryLot[], policy: StockRotationPolicy = "fefo"): InventoryLot | undefined {
  return [...lots]
    .filter((lot) => lot.quantity > 0)
    .sort((a, b) => {
      if (policy === "fefo") {
        const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      }
      return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    })[0];
}
