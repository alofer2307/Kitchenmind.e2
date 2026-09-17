import { OrganizationDetailScreen } from "@/components/platform/organization-detail-screen";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <PlatformRoute permission="platform.organizations.read" returnTo={`/platform/organizaciones/${organizationId}`}><OrganizationDetailScreen organizationId={organizationId} /></PlatformRoute>;
}
