import type { SyncStatus } from "@/types";
import { createId } from "@/utils/id";

const DATABASE_NAME = "kitchenmind-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "events";

export type OfflineEntityType = "attendance" | "service";

export interface OfflineQueueRecord {
  id: string;
  organizationId: string;
  branchId: string;
  entityType: OfflineEntityType;
  entityId: string;
  idempotencyKey: string;
  createdAt: string;
  syncStatus: SyncStatus;
  attempts: number;
  lastError?: string;
}

export type OfflineQueueInput = Omit<OfflineQueueRecord, "id" | "createdAt" | "syncStatus" | "attempts">;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falló una operación de almacenamiento local."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falló la transacción local."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La transacción local fue cancelada."));
  });
}

export class OfflineQueue {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly memory = new Map<string, OfflineQueueRecord>();
  private readonly listeners = new Set<() => void>();
  private pendingSnapshot = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getPendingSnapshot = (): number => this.pendingSnapshot;

  async initialize(): Promise<void> {
    await this.refreshSnapshot();
  }

  async enqueue(input: OfflineQueueInput): Promise<OfflineQueueRecord> {
    const existing = (await this.list()).find((record) => record.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;
    const record: OfflineQueueRecord = { ...input, id: createId("offline"), createdAt: new Date().toISOString(), syncStatus: "pending", attempts: 0 };
    if (!this.supportsIndexedDb()) {
      this.memory.set(record.id, record);
      await this.refreshSnapshot();
      return record;
    }
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
    await this.refreshSnapshot();
    return record;
  }

  async list(): Promise<OfflineQueueRecord[]> {
    if (!this.supportsIndexedDb()) return [...this.memory.values()].map((record) => ({ ...record }));
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<OfflineQueueRecord[]>);
    await transactionDone(transaction);
    return records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async markFailed(id: string, message: string): Promise<void> {
    await this.update(id, (record) => ({ ...record, syncStatus: "failed", attempts: record.attempts + 1, lastError: message }));
  }

  async markSynced(id: string): Promise<void> {
    await this.update(id, (record) => ({ ...record, syncStatus: "synced", attempts: record.attempts + 1, lastError: undefined }));
  }

  async remove(id: string): Promise<void> {
    if (!this.supportsIndexedDb()) {
      this.memory.delete(id);
      await this.refreshSnapshot();
      return;
    }
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
    await this.refreshSnapshot();
  }

  private async update(id: string, transform: (record: OfflineQueueRecord) => OfflineQueueRecord): Promise<void> {
    const record = (await this.list()).find((item) => item.id === id);
    if (!record) return;
    const updated = transform(record);
    if (!this.supportsIndexedDb()) {
      this.memory.set(id, updated);
      await this.refreshSnapshot();
      return;
    }
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(updated);
    await transactionDone(transaction);
    await this.refreshSnapshot();
  }

  private supportsIndexedDb(): boolean {
    return typeof window !== "undefined" && "indexedDB" in window;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
          store.createIndex("syncStatus", "syncStatus", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("No fue posible abrir IndexedDB."));
    });
    return this.databasePromise;
  }

  private async refreshSnapshot(): Promise<void> {
    const records = await this.listWithoutRefresh();
    this.pendingSnapshot = records.filter((record) => record.syncStatus === "pending" || record.syncStatus === "failed").length;
    this.listeners.forEach((listener) => listener());
  }

  private async listWithoutRefresh(): Promise<OfflineQueueRecord[]> {
    if (!this.supportsIndexedDb()) return [...this.memory.values()];
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<OfflineQueueRecord[]>);
    await transactionDone(transaction);
    return records;
  }
}
