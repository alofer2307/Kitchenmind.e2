import { PlatformRoute } from "@/components/platform/platform-route";
import { ProspectDetailScreen } from "@/components/platform/prospect-detail-screen";

export const dynamic = "force-dynamic";

export default async function ProspectoDetallePage({ params }: { params: Promise<{ prospectId: string }> }) {
  const { prospectId } = await params;
  return <PlatformRoute permission="platform.prospects.read" returnTo={`/platform/prospectos/${prospectId}`}><ProspectDetailScreen prospectId={prospectId} /></PlatformRoute>;
}
