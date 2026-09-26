import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { OnChainGrant } from "../types";
import { connection, keypairFromEnv } from "./anchorGrants";

// Per-batch USDC payout, researcher -> player (FR-7). The key API calls payoutBatch after it releases a key:
//   stream_30d            pays pricePerDay for every released batch
//   snapshot_24h, single_query pay pricePerDay once, on the first released key
// PAYOUT_MODE selects how the money moves:
//   simulate - records the payout with a "sim-" signature, no chain call (default; works with no funded wallet)
//   devnet   - sends a real devnet USDC TransferChecked signed by RESEARCHER_SECRET_KEY
// The transfer carries only wallets and an amount: no memo, no grant or health terms on-chain (NFR-1).

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const USDC_DECIMALS = 6;

export type PayoutMode = "simulate" | "devnet";

export interface PayoutRecord {
  grantId: string;
  /** Batch number for streams; null for one-off payments. */
  batch: number | null;
  player: string;
  researcher: string;
  amount: number; // USDC base units (6 decimals)
  signature: string; // devnet tx signature, or "sim-..." when simulated
  mode: PayoutMode;
  paidAt: number; // unix seconds
}

export const payoutMode = (): PayoutMode => (process.env.PAYOUT_MODE === "devnet" ? "devnet" : "simulate");

// ---------- ledger (in memory, like the key store) ----------

const g = globalThis as unknown as { __dataDeckPayouts?: Map<string, Promise<PayoutRecord>> };
// One entry per payable unit, so a repeated key request never pays twice. Holding the promise (not the
// record) also stops two concurrent requests for the same batch from both sending a transfer.
const ledger = (g.__dataDeckPayouts ??= new Map());

const ledgerKey = (grant: OnChainGrant, batch: number) =>
  grant.accessType === "stream_30d" ? `${grant.grantId}:${batch}` : `${grant.grantId}:once`;

/** Pays the player for a released batch. Idempotent per batch (per grant for one-off types). */
export function payoutBatch(grant: OnChainGrant, batch: number): Promise<PayoutRecord> {
  const key = ledgerKey(grant, batch);
  const existing = ledger.get(key);
  if (existing) return existing;

  const pending = pay(grant, grant.accessType === "stream_30d" ? batch : null);
  ledger.set(key, pending);
  // A failed transfer is forgotten, so the researcher's next key request retries it.
  pending.catch(() => ledger.delete(key));
  return pending;
}

/** Settled payouts, newest first. Filter by grant or player for the portal and the player's wallet view. */
export async function listPayouts(filter: { grantId?: string; player?: string } = {}): Promise<PayoutRecord[]> {
  const settled = await Promise.allSettled(ledger.values());
  return settled
    .flatMap((s) => (s.status === "fulfilled" ? [s.value] : []))
    .filter((p) => (!filter.grantId || p.grantId === filter.grantId) && (!filter.player || p.player === filter.player))
    .sort((a, b) => b.paidAt - a.paidAt);
}

async function pay(grant: OnChainGrant, batch: number | null): Promise<PayoutRecord> {
  const base = { grantId: grant.grantId, batch, player: grant.player, amount: grant.pricePerDay };
  const paidAt = Math.floor(Date.now() / 1000);
  if (payoutMode() === "simulate") {
    const signature = `sim-${grant.grantId.slice(0, 8)}-${batch ?? "once"}-${paidAt}`;
    return { ...base, researcher: grant.researcher, signature, mode: "simulate", paidAt };
  }

  const researcher = keypairFromEnv("RESEARCHER_SECRET_KEY");
  const mint = new PublicKey(process.env.USDC_MINT || DEVNET_USDC_MINT);
  const tx = new Transaction().add(
    ...usdcTransferIxs(researcher.publicKey, new PublicKey(grant.player), mint, BigInt(grant.pricePerDay)),
  );
  const signature = await sendAndConfirmTransaction(connection(), tx, [researcher]);
  return { ...base, researcher: researcher.publicKey.toBase58(), signature, mode: "devnet", paidAt };
}

// ---------- SPL token instructions, built by hand to avoid adding @solana/spl-token ----------

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/** Creates the player's USDC account if missing (idempotent, researcher pays rent), then TransferChecked. */
export function usdcTransferIxs(from: PublicKey, to: PublicKey, mint: PublicKey, amount: bigint): TransactionInstruction[] {
  const source = associatedTokenAddress(from, mint);
  const dest = associatedTokenAddress(to, mint);

  const createDest = new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: from, isSigner: true, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // CreateIdempotent
  });

  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0); // TransferChecked
  data.writeBigUInt64LE(amount, 1);
  data.writeUInt8(USDC_DECIMALS, 9);
  const transfer = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: from, isSigner: true, isWritable: false },
    ],
    data,
  });

  return [createDest, transfer];
}
