/** Copies a typed byte view into a Response-compatible ArrayBuffer. */
export function toResponseBody(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
