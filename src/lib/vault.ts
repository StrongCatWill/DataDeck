import { createCipheriv, randomBytes } from "node:crypto";
import type { EncryptedBatch } from "./types";

// Demo key store: server memory only (risk 6). Production needs a managed KMS,
// per-player key separation and access logging.
interface BatchKey {
  key: Buffer;
  released: boolean;
}

interface VaultState {
  batches: Map<string, EncryptedBatch[]>;
  keys: Map<string, Map<number, BatchKey>>;
}

// Survives Next.js dev hot reloads and is shared across route modules.
const g = globalThis as unknown as { __dataDeckVault?: VaultState };
const state: VaultState = (g.__dataDeckVault ??= { batches: new Map(), keys: new Map() });

/** Encrypts each daily batch with its own AES-256-GCM key. */
export function sealBatches(grantId: string, days: unknown[][]): EncryptedBatch[] {
  const keys = new Map<number, BatchKey>();
  const sealed = days.map((rows, batch) => {
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(rows), "utf8"), cipher.final()]);
    keys.set(batch, { key, released: false });
    return {
      grantId,
      batch,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  });
  state.batches.set(grantId, sealed);
  state.keys.set(grantId, keys);
  return sealed;
}

export const getBatches = (grantId: string) => state.batches.get(grantId) ?? [];

/** Marks a key released and returns it; null if it never existed or was shredded. */
export function releaseKey(grantId: string, batch: number): Buffer | null {
  const k = state.keys.get(grantId)?.get(batch);
  if (!k) return null;
  k.released = true;
  return k.key;
}

/** Crypto-shredding: drop every unreleased key so stored ciphertext is unreadable. */
export function destroyUnreleasedKeys(grantId: string): number {
  const keys = state.keys.get(grantId);
  if (!keys) return 0;
  let n = 0;
  for (const [batch, k] of keys) {
    if (!k.released) {
      k.key.fill(0);
      keys.delete(batch);
      n++;
    }
  }
  return n;
}
