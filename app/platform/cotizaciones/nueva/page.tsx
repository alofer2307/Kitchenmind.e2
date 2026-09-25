import { NewQuoteScreen } from "@/components/platform/new-quote-screen";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";
export default function NuevaCotizacionPage() { return <PlatformRoute permission="platform.quotes.create" returnTo="/platform/cotizaciones/nueva"><NewQuoteScreen /></PlatformRoute>; }
