import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { CustomerOrganizationSelector } from "@/components/customer/customer-organization-selector";

export const dynamic = "force-dynamic";

export default async function CustomerOrganizationsPage() {
  const identity = await requireChatGPTUser("/app/organizaciones");
  return <CustomerOrganizationSelector identityLabel={identity.displayName} signOutHref={chatGPTSignOutPath("/")} />;
}
