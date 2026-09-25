import { signOutPath, requireKitchenMindUser } from "@/services/auth-session.service";
import { CustomerOrganizationSelector } from "@/components/customer/customer-organization-selector";

export const dynamic = "force-dynamic";

export default async function CustomerOrganizationsPage() {
  const identity = await requireKitchenMindUser("/app/organizaciones");
  return <CustomerOrganizationSelector identityLabel={identity.displayName} signOutHref={signOutPath("/")} />;
}
