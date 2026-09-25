import type { DashboardSnapshot } from "@/types";

const DATABASE_NAME = "kitchenmind-dashboard-snapshots";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";
const SCHEMA_VERSION = 1;
const OFFLINE_TTL_MS = 15 * 60 * 1000;

interface DashboardOfflineRecord {
  id: string;
  userId: string;
  organizationId: string;
  membershipId: string;
  scopeHash: string;
  presetCode: string;
  filtersKey: string;
  generatedAt: string;
  expiresAt: string;
  schemaVersion: number;
  snapshot: DashboardSnapshot;
}

function supportsIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && Boolean(window.crypto?.subtle);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No fue posible consultar la copia offline."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falló la caché offline del tablero."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló la actualización offline."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No fue posible abrir la caché offline."));
  });
}

function canonicalQuery(query: string): string {
  const params = new URLSearchParams(query);
  return Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function recordId(userId: string, query: string): Promise<string> {
  return digest(`${SCHEMA_VERSION}|${userId}|${canonicalQuery(query)}`);
}

async function scopeHash(snapshot: DashboardSnapshot): Promise<string> {
  return digest(JSON.stringify({
    organizationId: snapshot.organization.id,
    membershipId: snapshot.membership.id,
    roles: [...snapshot.membership.roleCodes].sort(),
    permissions: [...snapshot.membership.permissions].sort(),
    branches: snapshot.branches.map((branch) => branch.id).sort(),
    modules: [...snapshot.moduleCodes].sort(),
    features: [...snapshot.featureCodes].sort(),
  }));
}

function offlineSafeSnapshot(snapshot: DashboardSnapshot, expiresAt: string): DashboardSnapshot {
  return {
    ...snapshot,
    availableOrganizations: snapshot.availableOrganizations.filter((organization) => organization.id === snapshot.organization.id),
    widgets: snapshot.widgets.filter((widget) => !widget.sensitive).map((widget) => ({
      ...widget,
      href: null,
      sourceStatus: widget.sourceStatus === "available" ? "stale" : widget.sourceStatus,
      valueStatus: widget.valueStatus === "ready" || widget.valueStatus === "empty" ? "stale" : widget.valueStatus,
      detail: `${widget.detail} Última copia autorizada; puede estar desactualizada.`,
    })),
    attention: snapshot.attention.map((item) => ({ ...item, href: "#" })),
    branchSummaries: snapshot.branchSummaries.map((branch) => ({ ...branch })),
    capabilities: { configureSelf: false, configureOrganization: false, export: false, crossBranch: false, sensitiveCosts: false },
    freshness: { ...snapshot.freshness, expiresAt, fromCache: true, offlineSnapshot: true, mode: "offline_snapshot" },
  };
}

export async function saveDashboardOfflineSnapshot(userId: string, query: string, snapshot: DashboardSnapshot): Promise<void> {
  if (!supportsIndexedDb() || snapshot.freshness.offlineSnapshot) return;
  const expiresAt = new Date(Date.now() + OFFLINE_TTL_MS).toISOString();
  const record: DashboardOfflineRecord = {
    id: await recordId(userId, query),
    userId,
    organizationId: snapshot.organization.id,
    membershipId: snapshot.membership.id,
    scopeHash: await scopeHash(snapshot),
    presetCode: snapshot.preset.code,
    filtersKey: canonicalQuery(query),
    generatedAt: snapshot.freshness.generatedAt,
    expiresAt,
    schemaVersion: SCHEMA_VERSION,
    snapshot: offlineSafeSnapshot(snapshot, expiresAt),
  };
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(record);
  await transactionDone(transaction);
}

export async function loadDashboardOfflineSnapshot(userId: string, query: string): Promise<DashboardSnapshot | null> {
  if (!supportsIndexedDb()) return null;
  const id = await recordId(userId, query);
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const record = await requestResult(store.get(id) as IDBRequest<DashboardOfflineRecord | undefined>);
  await transactionDone(transaction);
  if (!record || record.userId !== userId || record.schemaVersion !== SCHEMA_VERSION || record.filtersKey !== canonicalQuery(query)) {
    return null;
  }
  if (new Date(record.expiresAt).getTime() <= Date.now() || record.scopeHash !== await scopeHash(record.snapshot)) {
    const deleteTransaction = database.transaction(STORE_NAME, "readwrite");
    deleteTransaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(deleteTransaction);
    return null;
  }
  return offlineSafeSnapshot(record.snapshot, record.expiresAt);
}

export async function clearDashboardOfflineSnapshots(userId: string): Promise<void> {
  if (!supportsIndexedDb()) return;
  const database = await openDatabase();
  const readTransaction = database.transaction(STORE_NAME, "readonly");
  const records = await requestResult(readTransaction.objectStore(STORE_NAME).index("userId").getAll(IDBKeyRange.only(userId)) as IDBRequest<DashboardOfflineRecord[]>);
  await transactionDone(readTransaction);
  if (!records.length) return;
  const writeTransaction = database.transaction(STORE_NAME, "readwrite");
  const store = writeTransaction.objectStore(STORE_NAME);
  for (const record of records) store.delete(record.id);
  await transactionDone(writeTransaction);
}
