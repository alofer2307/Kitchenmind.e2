import { PlatformOperationPreview } from "@/components/platform/platform-operation-preview";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";

export default async function PlatformOperationPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ branchId?: string }> }) {
  const [{ organizationId }, { branchId }] = await Promise.all([params, searchParams]);
  return <PlatformRoute permission="platform.organizations.read" returnTo={`/platform/organizaciones/${organizationId}/operacion`}><PlatformOperationPreview organizationId={organizationId} branchId={branchId} /></PlatformRoute>;
}
