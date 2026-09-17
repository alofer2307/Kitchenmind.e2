import { OrganizationsScreen } from "@/components/platform/organizations-screen";
import { PlatformRoute } from "@/components/platform/platform-route";

export const dynamic = "force-dynamic";

export default function OrganizationsPage() {
  return <PlatformRoute permission="platform.organizations.read" returnTo="/platform/organizaciones"><OrganizationsScreen /></PlatformRoute>;
}
