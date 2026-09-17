import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { QualityCenterScreen } from "@/components/quality/quality-center-screen";

export const dynamic = "force-dynamic";

export default async function QualityLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ logId: string }>;
  searchParams: Promise<{ organizationId?: string; branchId?: string; period?: string }>;
}) {
  const [{ logId }, { organizationId, branchId, period }] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();
  if (organizationId) query.set("organizationId", organizationId);
  if (branchId) query.set("branchId", branchId);
  if (period) query.set("period", period);
  await requireChatGPTUser(`/app/calidad/${encodeURIComponent(logId)}${query.size ? `?${query.toString()}` : ""}`);

  return <QualityCenterScreen organizationId={organizationId} branchId={branchId} period={period} initialLogId={logId} />;
}
