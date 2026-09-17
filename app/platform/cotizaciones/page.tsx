import { PlatformRoute } from "@/components/platform/platform-route";
import { QuotesScreen } from "@/components/platform/quotes-screen";

export const dynamic = "force-dynamic";
export default function CotizacionesPage() { return <PlatformRoute permission="platform.quotes.read" returnTo="/platform/cotizaciones"><QuotesScreen /></PlatformRoute>; }
