const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

export function decodeBase32(value: string): Uint8Array {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("La clave del autenticador no es válida.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export async function generateTotp(secret: string, timestamp = Date.now()): Promise<string> {
  const counter = Math.floor(timestamp / 30_000);
  const message = new Uint8Array(8);
  let remaining = counter;
  for (let index = 7; index >= 0; index -= 1) {
    message[index] = remaining & 255;
    remaining = Math.floor(remaining / 256);
  }

  const keyBytes = decodeBase32(secret);
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, toArrayBuffer(message)));
  const offset = signature[signature.length - 1] & 15;
  const code = (
    ((signature[offset] & 127) << 24) |
    ((signature[offset + 1] & 255) << 16) |
    ((signature[offset + 2] & 255) << 8) |
    (signature[offset + 3] & 255)
  ) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export async function verifyTotp(code: string, secret: string, timestamp = Date.now()): Promise<boolean> {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  for (const offset of [-30_000, 0, 30_000]) {
    if (constantTimeEqual(normalized, await generateTotp(secret, timestamp + offset))) return true;
  }
  return false;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function sealText(value: string, encodedKey: string): Promise<string> {
  const keyBytes = base64UrlToBytes(encodedKey);
  if (keyBytes.length !== 32) throw new Error("La clave MFA configurada no tiene el tamaño requerido.");
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), "AES-GCM", false, ["encrypt"]);
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, new TextEncoder().encode(value));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function openSealedText(value: string, encodedKey: string): Promise<string> {
  const [encodedIv, encodedPayload] = value.split(".");
  if (!encodedIv || !encodedPayload) throw new Error("La configuración MFA no es válida.");
  const keyBytes = base64UrlToBytes(encodedKey);
  if (keyBytes.length !== 32) throw new Error("La clave MFA configurada no tiene el tamaño requerido.");
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64UrlToBytes(encodedIv)) },
    key,
    toArrayBuffer(base64UrlToBytes(encodedPayload)),
  );
  return new TextDecoder().decode(decrypted);
}

export function generateSessionToken(): string {
  return bytesToBase64Url(randomBytes(32));
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const characters = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join("");
    return `KM-${characters.slice(0, 4)}-${characters.slice(4)}`;
  });
}

export function normalizeRecoveryCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s/g, "");
}

export function createAuthenticatorUri(secret: string, email: string): string {
  const issuer = "KitchenMind";
  const label = `${issuer}:${email}`;
  const query = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}
