import { describe, expect, it } from "vitest";
import {
  DecryptError,
  decryptSecret,
  encryptSecret,
  ENVELOPE_RE,
  generateKey,
  KEY_RE,
  keyFromHash,
} from "@/lib/crypto";

const secret = { title: "daft punk pra viagem 🚗", note: "ouve no talo\nsério", author: "Leandro" };

describe("generateKey", () => {
  it("makes distinct 256-bit base64url keys", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a).toMatch(KEY_RE);
    expect(a).not.toBe(b);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips unicode fields", async () => {
    const key = generateKey();
    const env = await encryptSecret(key, secret);
    expect(env).toMatch(ENVELOPE_RE);
    expect(await decryptSecret(key, env)).toEqual(secret);
  });

  it("never leaks plaintext and uses a fresh IV each time", async () => {
    const key = generateKey();
    const a = await encryptSecret(key, secret);
    const b = await encryptSecret(key, secret);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Leandro");
    expect(atob(a.split(".")[2].replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("Leandro");
  });

  it("rejects the wrong key", async () => {
    const env = await encryptSecret(generateKey(), secret);
    await expect(decryptSecret(generateKey(), env)).rejects.toBeInstanceOf(DecryptError);
  });

  it("rejects a tampered ciphertext", async () => {
    const key = generateKey();
    const env = await encryptSecret(key, secret);
    const [v, iv, data] = env.split(".");
    const flipped = (data[5] === "A" ? "B" : "A") + "";
    const tampered = `${v}.${iv}.${data.slice(0, 5)}${flipped}${data.slice(6)}`;
    await expect(decryptSecret(key, tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("rejects malformed keys and envelopes", async () => {
    const key = generateKey();
    await expect(decryptSecret("short", await encryptSecret(key, secret))).rejects.toBeInstanceOf(DecryptError);
    await expect(decryptSecret(key, "v2.abc.def")).rejects.toBeInstanceOf(DecryptError);
    await expect(decryptSecret(key, "garbage")).rejects.toBeInstanceOf(DecryptError);
  });
});

describe("keyFromHash", () => {
  it("reads a valid k from the fragment", () => {
    const key = generateKey();
    expect(keyFromHash(`#k=${key}`)).toBe(key);
    expect(keyFromHash(`k=${key}`)).toBe(key);
  });

  it("ignores missing or malformed keys", () => {
    expect(keyFromHash("")).toBeNull();
    expect(keyFromHash("#x=1")).toBeNull();
    expect(keyFromHash("#k=tooshort")).toBeNull();
  });
});
