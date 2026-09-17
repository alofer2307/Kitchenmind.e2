import { PlatformRoute } from "@/components/platform/platform-route";
import { QuotePrintScreen } from "@/components/platform/quote-print-screen";

export const dynamic = "force-dynamic";
export default async function CotizacionImprimirPage({ params }: { params: Promise<{ quoteId: string }> }) { const { quoteId } = await params; return <PlatformRoute permission="platform.quotes.read" returnTo={`/platform/cotizaciones/${quoteId}/imprimir`}><QuotePrintScreen quoteId={quoteId} /></PlatformRoute>; }
