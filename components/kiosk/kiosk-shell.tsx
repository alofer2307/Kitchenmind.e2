import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

export function KioskShell({ title, instruction, status, children }: { title: string; instruction: string; status?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e2fbf8_0,#f4f8fc_42%,#edf4fb_100%)] p-4 text-[#102b48] sm:p-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-3">{status}<Link href="/" className="flex size-11 items-center justify-center rounded-xl border border-[#cfe0ef] bg-white text-[#46627c] shadow-sm" aria-label="Volver a administración"><ArrowLeft className="size-5" /></Link></div>
        </header>
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-10 text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#168e8b]">KitchenMind</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">{title}</h1>
          <p className="mt-4 text-lg font-semibold text-[#6b8095] sm:text-xl">{instruction}</p>
          <div className="mt-9">{children}</div>
        </section>
      </div>
    </main>
  );
}
