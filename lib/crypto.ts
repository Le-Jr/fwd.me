/**
 * End-to-end encryption for a mix's personal fields (subject, note, sender).
 *
 * The browser generates a random 256-bit key, encrypts the fields with
 * AES-256-GCM and sends only the ciphertext. The key travels in the share
 * link's fragment (`/m/<id>#k=<key>`), which browsers never send to the server,
 * so neither the database nor the server can read these fields. Tracks stay in
 * plaintext: the server needs them to look up links.
 *
 * Envelope: `v1.<iv>.<ciphertext+tag>`, base64url, 12-byte IV, AAD "fwd.fm/v1".
 * Uses Web Crypto only, so the same code runs in the browser, Node and tests.
 */

export interface MixSecret {
  title: string;
  note: string;
  author: string;
}

const VERSION = "v1";
const AAD = new TextEncoder().encode("fwd.fm/v1");
const KEY_BYTES = 32;
const IV_BYTES = 12;

/** What the server accepts as a stored envelope (also caps its size). */
export const ENVELOPE_RE = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,6000}$/;
/** A key as it appears in the link fragment. */
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;

export class DecryptError extends Error {}

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(key: string, usage: KeyUsage): Promise<CryptoKey> {
  if (!KEY_RE.test(key)) throw new DecryptError("chave inválida");
  return crypto.subtle.importKey("raw", fromB64url(key), "AES-GCM", false, [usage]);
}

/** New random key, base64url (43 chars). */
export function generateKey(): string {
  return toB64url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

export async function encryptSecret(key: string, secret: MixSecret): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(secret));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD },
    await importKey(key, "encrypt"),
    plain,
  );
  return `${VERSION}.${toB64url(iv)}.${toB64url(new Uint8Array(cipher))}`;
}

/** Throws DecryptError on a wrong key, a tampered envelope or a bad format. */
export async function decryptSecret(key: string, envelope: string): Promise<MixSecret> {
  const [version, iv, data] = envelope.split(".");
  if (version !== VERSION || !iv || !data) throw new DecryptError("formato desconhecido");
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64url(iv), additionalData: AAD },
      await importKey(key, "decrypt"),
      fromB64url(data),
    );
  } catch (err) {
    if (err instanceof DecryptError) throw err;
    throw new DecryptError("não foi possível descriptografar");
  }
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as Partial<MixSecret>;
  return {
    title: String(parsed.title ?? ""),
    note: String(parsed.note ?? ""),
    author: String(parsed.author ?? ""),
  };
}

/** Reads `k` from a location hash like `#k=<key>`. */
export function keyFromHash(hash: string): string | null {
  const k = new URLSearchParams(hash.replace(/^#/, "")).get("k");
  return k && KEY_RE.test(k) ? k : null;
}
