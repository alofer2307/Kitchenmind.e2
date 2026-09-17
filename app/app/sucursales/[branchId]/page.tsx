import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { BranchDashboardScreen } from "@/components/customer/branch-dashboard-screen";

export const dynamic = "force-dynamic";

export default async function BranchPage({ params, searchParams }: { params: Promise<{ branchId: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ branchId }, { organizationId }] = await Promise.all([params, searchParams]);
  await requireChatGPTUser(`/app/sucursales/${encodeURIComponent(branchId)}${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`);
  return <BranchDashboardScreen organizationId={organizationId} branchId={branchId} />;
}
