import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEMO_DAY_MS, Vault, decrypt, encrypt } from "./vault";

const start = 1_800_000_000_000;

describe("encrypt / decrypt", () => {
  it("round-trips with the right key", () => {
    const key = randomBytes(32);
    expect(decrypt(encrypt("hello", key), key.toString("base64"))).toBe("hello");
  });

  it("fails with the wrong key", () => {
    const sealed = encrypt("hello", randomBytes(32));
    expect(() => decrypt(sealed, randomBytes(32).toString("base64"))).toThrow();
  });

  it("fails when the ciphertext is tampered with", () => {
    const key = randomBytes(32);
    const sealed = encrypt("hello", key);
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] ^= 1;
    expect(() => decrypt({ ...sealed, ciphertext: bytes.toString("base64") }, key.toString("base64"))).toThrow();
  });
});

describe("Vault", () => {
  it("uses a different key for every batch", () => {
    const vault = new Vault();
    vault.seal("g1", ["a", "b"], start);
    const later = start + DEMO_DAY_MS;
    expect(vault.getKey("g1", 0, later)).not.toBe(vault.getKey("g1", 1, later));
  });

  it("releases batches one demo day apart", () => {
    const vault = new Vault();
    vault.seal("g1", ["a", "b", "c"], start);
    expect(vault.listAvailable("g1", start)?.map((b) => b.batch)).toEqual([0]);
    expect(vault.listAvailable("g1", start + DEMO_DAY_MS)?.map((b) => b.batch)).toEqual([0, 1]);
    expect(vault.getKey("g1", 2, start + DEMO_DAY_MS)).toBeNull();
  });

  it("returns keys that decrypt their own batch", () => {
    const vault = new Vault();
    const [, sealed] = vault.seal("g1", ["day 0", "day 1"], start);
    expect(decrypt(sealed, vault.getKey("g1", 1, start + DEMO_DAY_MS)!)).toBe("day 1");
  });

  it("returns null for unknown grants and batches", () => {
    const vault = new Vault();
    vault.seal("g1", ["a"], start);
    expect(vault.listAvailable("nope", start)).toBeNull();
    expect(vault.getKey("nope", 0, start)).toBeNull();
    expect(vault.getKey("g1", 5, start)).toBeNull();
  });

  it("destroyKeys makes every key unavailable but keeps the ciphertext", () => {
    const vault = new Vault();
    vault.seal("g1", ["a", "b"], start);
    vault.destroyKeys("g1");
    expect(vault.getKey("g1", 0, start + DEMO_DAY_MS)).toBeNull();
    expect(vault.listAvailable("g1", start + DEMO_DAY_MS)).toHaveLength(2);
  });
});
