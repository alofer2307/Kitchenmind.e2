import { PlatformRoute } from "@/components/platform/platform-route";
import { PriceBookDetailScreen } from "@/components/platform/price-book-detail-screen";

export const dynamic = "force-dynamic";
export default async function PrecioDetallePage({ params }: { params: Promise<{ priceBookId: string }> }) { const { priceBookId } = await params; return <PlatformRoute permission="platform.pricing.read" returnTo={`/platform/precios/${priceBookId}`}><PriceBookDetailScreen priceBookId={priceBookId} /></PlatformRoute>; }
