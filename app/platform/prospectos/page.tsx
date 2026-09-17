import { PlatformRoute } from "@/components/platform/platform-route";
import { ProspectsScreen } from "@/components/platform/prospects-screen";

export const dynamic = "force-dynamic";

export default function ProspectosPage() {
  return <PlatformRoute permission="platform.prospects.read" returnTo="/platform/prospectos"><ProspectsScreen /></PlatformRoute>;
}
