import type { KitchenMindDataProvider } from "@/repositories";
import type { BaseEntity } from "@/types";

function toRecord(value: BaseEntity | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export async function recordAudit(
  provider: KitchenMindDataProvider,
  input: {
    organizationId: string;
    branchId?: string;
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: BaseEntity;
    after?: BaseEntity;
    reason?: string;
  },
): Promise<void> {
  await provider.audit.create({
    organizationId: input.organizationId,
    branchId: input.branchId,
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: toRecord(input.before),
    after: toRecord(input.after),
    reason: input.reason,
    timestamp: new Date().toISOString(),
    createdBy: input.actorId,
  });
}
