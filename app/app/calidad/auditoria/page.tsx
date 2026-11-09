import { requireKitchenMindUser } from "@/services/auth-session.service";
import { QualityAuditScreen } from "@/components/quality/quality-audit-screen";

export const dynamic = "force-dynamic";

export default async function QualityAuditPage({ searchParams }: {
  searchParams: Promise<{ organizationId?: string; branchId?: string }>;
}) {
  const { organizationId, branchId } = await searchParams;
  const query = new URLSearchParams();
  if (organizationId) query.set("organizationId", organizationId);
  if (branchId) query.set("branchId", branchId);
  await requireKitchenMindUser(`/app/calidad/auditoria${query.size ? `?${query.toString()}` : ""}`);
  return <QualityAuditScreen organizationId={organizationId} branchId={branchId} />;
}
