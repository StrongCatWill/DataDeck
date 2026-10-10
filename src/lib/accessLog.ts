import type { AccessType, OnChainGrant } from "./types";

// Access log: one entry per released batch key, so the player can see who opened which batch and when (Art. 15).
// Holds only IDs, timestamps and the payout signature, never batch contents. In memory, like the key store.

export interface AccessRecord {
  grantId: string;
  batch: number;
  player: string;
  researcher: string;
  accessType: AccessType;
  releasedAt: number; // unix seconds
  /** USDC payout for this batch (devnet signature or "sim-..."); null if the transfer failed and will be retried. */
  payoutSig: string | null;
}

const g = globalThis as unknown as { __dataDeckAccessLog?: AccessRecord[] };
const log = (g.__dataDeckAccessLog ??= []);

export function recordAccess(grant: OnChainGrant, batch: number, payoutSig: string | null): AccessRecord {
  const record: AccessRecord = {
    grantId: grant.grantId,
    batch,
    player: grant.player,
    researcher: grant.researcher,
    accessType: grant.accessType,
    releasedAt: Math.floor(Date.now() / 1000),
    payoutSig,
  };
  log.push(record);
  return record;
}

/** The player's access log, newest first. */
export function listAccess(player: string): AccessRecord[] {
  return log.filter((r) => r.player === player).reverse();
}

/** Devnet Explorer link for a real payout; null for a simulated one. */
export function explorerUrl(signature: string): string | null {
  return signature.startsWith("sim-") ? null : `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
