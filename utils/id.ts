export function createId(prefix: string): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

export function createIdempotencyKey(parts: Array<string | number>): string {
  return parts.map(String).join(":").toLowerCase();
}
