import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: "blue" | "teal" | "amber" | "red" }) {
  const tones = {
    blue: "bg-[#eaf3ff] text-[#1769e0]",
    teal: "bg-[#e0faf7] text-[#0a9692]",
    amber: "bg-[#fff6de] text-[#b66b00]",
    red: "bg-[#fff0ef] text-[#c83d33]",
  };
  return (
    <article className="rounded-[1.35rem] border border-[#dbe7f2] bg-white p-5 shadow-[0_12px_35px_rgba(24,52,81,.055)]">
      <div className={`flex size-11 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon className="size-5" aria-hidden="true" /></div>
      <p className="mt-5 text-sm font-semibold text-[#6a7e94]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#102b48]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#7b8da0]">{detail}</p>
    </article>
  );
}
