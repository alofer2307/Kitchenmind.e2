import { ChartNoAxesCombined } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1769e0] to-[#18c8c8] text-white shadow-[0_10px_28px_rgba(23,105,224,.24)]">
        <ChartNoAxesCombined className="size-6" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-[-0.02em] text-[#10243e]">KitchenMind</p>
          <p className="truncate text-xs font-semibold text-[#6c7f94]">Operación industrial</p>
        </div>
      )}
    </div>
  );
}
