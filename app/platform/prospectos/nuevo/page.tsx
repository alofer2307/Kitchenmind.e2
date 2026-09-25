import { NewProspectScreen } from "@/components/platform/new-prospect-screen";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";

export default function NuevoProspectoPage() {
  return <PlatformRoute permission="platform.prospects.create" returnTo="/platform/prospectos/nuevo"><NewProspectScreen /></PlatformRoute>;
}
