import { AlertCircle, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProspectStatus, QuoteStatus } from "@/types";

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Nuevo", contacted: "Contactado", discovery: "Diagnóstico", quoted: "Cotizado", negotiation: "Negociación",
  won: "Ganado", lost: "Perdido", paused: "Pausado", archived: "Archivado",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador", ready: "Lista", sent: "Enviada", viewed: "Vista", accepted: "Aceptada", rejected: "Rechazada", expired: "Vencida", cancelled: "Cancelada",
};

export function StatusBadge({ status }: { status: ProspectStatus | QuoteStatus }) {
  const label = status in PROSPECT_STATUS_LABELS ? PROSPECT_STATUS_LABELS[status as ProspectStatus] : QUOTE_STATUS_LABELS[status as QuoteStatus];
  const tone = status === "won" || status === "accepted" ? "bg-[#e4faf4] text-[#087c65]" : status === "lost" || status === "rejected" || status === "cancelled" ? "bg-[#fff0ed] text-[#ac3f2b]" : status === "quoted" || status === "sent" || status === "viewed" ? "bg-[#e8f2ff] text-[#1769e0]" : "bg-[#f0f3f6] text-[#61758a]";
  return <Badge className={tone}>{label}</Badge>;
}

export function CommercialLoading({ label = "Cargando información comercial…" }: { label?: string }) {
  return <div className="flex min-h-56 items-center justify-center gap-3 rounded-3xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#6a7e94]"><LoaderCircle className="size-5 animate-spin text-[#1769e0]" />{label}</div>;
}

export function CommercialError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Alert variant="destructive" className="rounded-2xl bg-white"><AlertCircle className="size-4" /><AlertTitle>No fue posible cargar esta sección</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><span>{message}</span><Button variant="outline" size="sm" onClick={onRetry}>Volver a intentar</Button></AlertDescription></Alert>;
}

export function formatPlatformDate(value: string | null, includeTime = true): string {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
