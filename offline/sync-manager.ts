import type { KitchenMindDataProvider } from "@/repositories";
import type { OfflineQueue, OfflineQueueRecord } from "./offline-queue";

export class SyncManager {
  private syncing = false;

  constructor(private readonly provider: KitchenMindDataProvider, private readonly queue: OfflineQueue) {}

  async syncPending(): Promise<{ synced: number; failed: number }> {
    if (this.syncing || (typeof navigator !== "undefined" && !navigator.onLine)) return { synced: 0, failed: 0 };
    this.syncing = true;
    let synced = 0;
    let failed = 0;
    try {
      const records = (await this.queue.list()).filter((record) => record.syncStatus !== "synced");
      for (const record of records) {
        try {
          await this.syncRecord(record);
          await this.queue.markSynced(record.id);
          await this.queue.remove(record.id);
          synced += 1;
        } catch (error) {
          await this.queue.markFailed(record.id, error instanceof Error ? error.message : "Error de sincronización.");
          failed += 1;
        }
      }
      return { synced, failed };
    } finally {
      this.syncing = false;
    }
  }

  private async syncRecord(record: OfflineQueueRecord): Promise<void> {
    const repository = record.entityType === "attendance" ? this.provider.attendance : this.provider.services.serviceEvents;
    const event = await repository.getById(record.entityId);
    if (!event) throw new Error("El evento local ya no existe.");
    if (event.idempotencyKey !== record.idempotencyKey) throw new Error("La clave idempotente del evento no coincide.");
    if (event.syncStatus !== "synced") await repository.update(event.id, { syncStatus: "synced" });
  }
}
