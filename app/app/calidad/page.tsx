import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { QualityCenterScreen } from "@/components/quality/quality-center-screen";

export const dynamic = "force-dynamic";

export default async function QualityCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; branchId?: string; period?: string }>;
}) {
  const { organizationId, branchId, period } = await searchParams;
  const query = new URLSearchParams();
  if (organizationId) query.set("organizationId", organizationId);
  if (branchId) query.set("branchId", branchId);
  if (period) query.set("period", period);
  await requireChatGPTUser(`/app/calidad${query.size ? `?${query.toString()}` : ""}`);

  return <QualityCenterScreen organizationId={organizationId} branchId={branchId} period={period} />;
}
