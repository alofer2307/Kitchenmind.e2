import { DashboardCatalogScreen } from "@/components/platform/dashboard-catalog-screen";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";

export default async function DashboardCatalogPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  return <PlatformRoute permission="platform.dashboard_catalog.read" returnTo="/platform/catalogo/dashboard"><DashboardCatalogScreen organizationId={organizationId} /></PlatformRoute>;
}
