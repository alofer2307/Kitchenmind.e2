import { PlatformRoute } from "@/components/platform/platform-route";
import { PriceBooksScreen } from "@/components/platform/price-books-screen";

export const dynamic = "force-dynamic";
export default function PreciosPage() { return <PlatformRoute permission="platform.pricing.read" returnTo="/platform/precios"><PriceBooksScreen /></PlatformRoute>; }
