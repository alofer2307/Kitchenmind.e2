import { PlatformRoute } from "@/components/platform/platform-route";
import { QuoteDetailScreen } from "@/components/platform/quote-detail-screen";

export const dynamic = "force-dynamic";
export default async function CotizacionDetallePage({ params }: { params: Promise<{ quoteId: string }> }) { const { quoteId } = await params; return <PlatformRoute permission="platform.quotes.read" returnTo={`/platform/cotizaciones/${quoteId}`}><QuoteDetailScreen quoteId={quoteId} /></PlatformRoute>; }
