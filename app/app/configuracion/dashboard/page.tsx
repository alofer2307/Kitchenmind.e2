import { requireKitchenMindUser } from "@/services/auth-session.service";
import { DashboardConfigurationScreen } from "@/components/customer/dashboard-configuration-screen";

export const dynamic = "force-dynamic";

export default async function DashboardConfigurationPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  await requireKitchenMindUser(`/app/configuracion/dashboard${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`);
  return <DashboardConfigurationScreen organizationId={organizationId} />;
}
