import { Buffer } from "buffer";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import type { OnChainGrant } from "../types";
import { connection, keypairFromEnv } from "./anchorGrants";

// Per-batch devnet USDC payout (FR, demo moment 4): each released stream batch pays price_per_day from the
// researcher wallet to the player. The key route calls payoutBatch after it releases a stream batch key.
// Built by hand (SPL Token transferChecked + idempotent ATA create) to avoid adding @solana/spl-token.

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const USDC_DECIMALS = 6;

export const associatedTokenAddress = (owner: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ATA_PROGRAM_ID)[0];

/** Creates the player's USDC account if missing (researcher pays rent), then transfers `amount` base units. */
export function payoutIxs(researcher: PublicKey, player: PublicKey, mint: PublicKey, amount: number): TransactionInstruction[] {
  const from = associatedTokenAddress(researcher, mint);
  const to = associatedTokenAddress(player, mint);
  const createIdempotent = new TransactionInstruction({
    programId: ATA_PROGRAM_ID,
    keys: [
      { pubkey: researcher, isSigner: true, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
  const data = Buffer.alloc(10);
  data[0] = 12; // TransferChecked
  data.writeBigUInt64LE(BigInt(amount), 1);
  data[9] = USDC_DECIMALS;
  const transfer = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: from, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: to, isSigner: false, isWritable: true },
      { pubkey: researcher, isSigner: true, isWritable: false },
    ],
    data,
  });
  return [createIdempotent, transfer];
}

const g = globalThis as unknown as { __dataDeckPaid?: Set<string> };
const paid = (g.__dataDeckPaid ??= new Set());

/**
 * Pays one stream batch. Returns the tx signature, or null when nothing is owed (not a stream, already paid,
 * or a mock player that is not a wallet). Throws if the transfer fails, so the caller can log it.
 */
export async function payoutBatch(grant: OnChainGrant, batch: number): Promise<string | null> {
  if (grant.accessType !== "stream_30d" || grant.pricePerDay <= 0) return null;
  const key = `${grant.grantId}:${batch}`;
  if (paid.has(key)) return null;
  let player: PublicKey;
  try {
    player = new PublicKey(grant.player);
  } catch {
    return null; // mock backend's "demo-player"
  }
  const mint = process.env.USDC_MINT;
  if (!mint) throw new Error("USDC_MINT is not set");
  const researcher = keypairFromEnv("RESEARCHER_SECRET_KEY");
  paid.add(key); // before sending, so a concurrent key request cannot pay twice
  try {
    const tx = new Transaction().add(...payoutIxs(researcher.publicKey, player, new PublicKey(mint), grant.pricePerDay));
    return await sendAndConfirmTransaction(connection(), tx, [researcher]);
  } catch (e) {
    paid.delete(key);
    throw e;
  }
}
