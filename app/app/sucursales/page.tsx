import { requireKitchenMindUser } from "@/services/auth-session.service";
import { BranchesDashboardScreen } from "@/components/customer/branch-dashboard-screen";

export const dynamic = "force-dynamic";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  await requireKitchenMindUser(`/app/sucursales${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`);
  return <BranchesDashboardScreen organizationId={organizationId} />;
}
