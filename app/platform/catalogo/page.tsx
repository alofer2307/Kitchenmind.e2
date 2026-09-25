import { CatalogScreen } from "@/components/platform/catalog-screen";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";
export default function CatalogoPage() { return <PlatformRoute permission="platform.catalog.read" returnTo="/platform/catalogo"><CatalogScreen /></PlatformRoute>; }
