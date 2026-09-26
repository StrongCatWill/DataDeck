import { createDecipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { EncryptedBatch } from "../types";
import { destroyUnreleasedKeys, getBatches, releaseKey, sealBatches } from "../vault";

function decrypt(b: EncryptedBatch, key: Buffer): unknown {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(b.iv, "base64"));
  decipher.setAuthTag(Buffer.from(b.authTag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(b.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

const days = [[{ day: 1, steps: 8120 }], [{ day: 2, steps: 10340 }], [{ day: 3, steps: 7650 }]];

describe("vault", () => {
  it("encrypts each batch and decrypts with the released key", () => {
    const sealed = sealBatches("g-roundtrip", days);
    expect(sealed).toHaveLength(3);
    expect(getBatches("g-roundtrip")).toEqual(sealed);
    sealed.forEach((b, i) => {
      expect(b.ciphertext).not.toContain("steps");
      expect(decrypt(b, releaseKey("g-roundtrip", i)!)).toEqual(days[i]);
    });
  });

  it("uses a different key and IV for every batch", () => {
    const sealed = sealBatches("g-unique", days);
    const keys = sealed.map((_, i) => releaseKey("g-unique", i)!.toString("hex"));
    expect(new Set(keys).size).toBe(3);
    expect(new Set(sealed.map((b) => b.iv)).size).toBe(3);
    expect(() => decrypt(sealed[1], Buffer.from(keys[0], "hex"))).toThrow();
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const [b] = sealBatches("g-tamper", days);
    const bytes = Buffer.from(b.ciphertext, "base64");
    bytes[0] ^= 1;
    const key = releaseKey("g-tamper", 0)!;
    expect(() => decrypt({ ...b, ciphertext: bytes.toString("base64") }, key)).toThrow();
  });

  it("shreds only unreleased keys", () => {
    sealBatches("g-shred", days);
    const kept = releaseKey("g-shred", 0);
    expect(destroyUnreleasedKeys("g-shred")).toBe(2);
    expect(releaseKey("g-shred", 0)).toEqual(kept);
    expect(releaseKey("g-shred", 1)).toBeNull();
    expect(releaseKey("g-shred", 2)).toBeNull();
  });

  it("returns null for unknown grants and batches", () => {
    expect(releaseKey("nope", 0)).toBeNull();
    sealBatches("g-range", days);
    expect(releaseKey("g-range", 99)).toBeNull();
    expect(getBatches("nope")).toEqual([]);
  });
});
