import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { CustomerWorkspaceScreen } from "@/components/customer/customer-workspace-screen";
import { redirect } from "next/navigation";
import { CustomerOnboardingService } from "@/services/tenancy.service";

export const dynamic = "force-dynamic";

export default async function CustomerWorkspacePage({ searchParams }: { searchParams: Promise<{ organizationId?: string; branchId?: string; period?: string }> }) {
  const { organizationId, branchId, period } = await searchParams;
  const returnTo = `/app${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`;
  const identity = await requireChatGPTUser(returnTo);
  const service = new CustomerOnboardingService({ authUserId: identity.id, email: identity.email, displayName: identity.displayName });
  const access = await service.access();
  const memberships = access.organizations.filter((organization) => organization.membershipStatus === "active");
  if (!organizationId && memberships.length > 1) redirect("/app/organizaciones");
  const selected = organizationId ? memberships.find((organization) => organization.id === organizationId) : memberships[0];
  if (!selected) redirect("/");
  if (!["active", "restricted"].includes(selected.status)) {
    if (!["suspended", "cancelled"].includes(selected.status)) redirect(`/app/onboarding?organizationId=${encodeURIComponent(selected.id)}`);
    redirect("/");
  }
  return <CustomerWorkspaceScreen organizationId={selected.id} branchId={branchId} period={period} identityId={identity.id} identityLabel={identity.displayName} signOutHref={chatGPTSignOutPath("/")} />;
}
