// Server-only: per-batch AES-256-GCM encryption with keys held in server memory (demo only;
// production needs a managed key store). Never import from client components.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Demo clock: one "day" of a stream is 10 seconds. */
export const DEMO_DAY_MS = 10_000;

/** What a researcher may download. All binary fields are base64. */
export interface SealedBatch {
  /** 0-based batch number. */
  batch: number;
  /** Unix time in ms when this batch becomes available. */
  availableAt: number;
  iv: string;
  ciphertext: string;
  authTag: string;
}

interface GrantBatches {
  batches: SealedBatch[];
  keys: Map<number, Buffer>;
}

export function encrypt(plaintext: string, key: Buffer): Pick<SealedBatch, "iv" | "ciphertext" | "authTag"> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

/** Throws if the key is wrong or the ciphertext was tampered with. */
export function decrypt(sealed: Pick<SealedBatch, "iv" | "ciphertext" | "authTag">, keyBase64: string): string {
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export class Vault {
  private grants = new Map<string, GrantBatches>();

  /** Encrypts each plaintext with its own fresh key. Batch N becomes available at startMs + N days. */
  seal(grantId: string, plaintexts: string[], startMs: number): SealedBatch[] {
    const keys = new Map<number, Buffer>();
    const batches = plaintexts.map((plaintext, batch) => {
      const key = randomBytes(32);
      keys.set(batch, key);
      return { batch, availableAt: startMs + batch * DEMO_DAY_MS, ...encrypt(plaintext, key) };
    });
    this.grants.set(grantId, { batches, keys });
    return batches;
  }

  has(grantId: string): boolean {
    return this.grants.has(grantId);
  }

  /** Batches available by nowMs, or null for an unknown grant. */
  listAvailable(grantId: string, nowMs: number): SealedBatch[] | null {
    const entry = this.grants.get(grantId);
    return entry ? entry.batches.filter((b) => b.availableAt <= nowMs) : null;
  }

  /** Base64 key for an available batch; null if unknown, not yet available or destroyed. */
  getKey(grantId: string, batch: number, nowMs: number): string | null {
    const entry = this.grants.get(grantId);
    const sealed = entry?.batches[batch];
    const key = entry?.keys.get(batch);
    if (!sealed || !key || sealed.availableAt > nowMs) return null;
    return key.toString("base64");
  }

  /** Crypto-shredding: drops every key still held for the grant, so its ciphertext stays unreadable. */
  destroyKeys(grantId: string): void {
    const entry = this.grants.get(grantId);
    if (!entry) return;
    for (const key of entry.keys.values()) key.fill(0);
    entry.keys.clear();
  }
}

// Kept on globalThis so `next dev` hot reloads don't wipe the in-memory keys.
const store = globalThis as unknown as { vault?: Vault };

export function getVault(): Vault {
  store.vault ??= new Vault();
  return store.vault;
}
