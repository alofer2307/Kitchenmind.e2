import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { BranchesDashboardScreen } from "@/components/customer/branch-dashboard-screen";

export const dynamic = "force-dynamic";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  await requireChatGPTUser(`/app/sucursales${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`);
  return <BranchesDashboardScreen organizationId={organizationId} />;
}
