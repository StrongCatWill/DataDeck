import { Buffer } from "buffer";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { AccessType } from "../types";
import { DISC, encodeCreateGrant, formatGrantMemo, formatRevokeMemo, hexToBytes, type GrantMemo } from "./codec";

// Transaction builders for data_deck_grants and the Memo fallback. Browser-safe: the player's wallet
// signs manual grants and the kill switch, so the frontend calls these; the server only uses them for
// the rule delegate and the researcher.

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function grantProgramId(): PublicKey {
  const id = process.env.NEXT_PUBLIC_GRANT_PROGRAM_ID;
  if (!id) throw new Error("NEXT_PUBLIC_GRANT_PROGRAM_ID is not set (deploy data_deck_grants first)");
  return new PublicKey(id);
}

export function grantPda(player: PublicKey, grantIdHex: string, programId = grantProgramId()): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("grant"), player.toBuffer(), Buffer.from(hexToBytes(grantIdHex, 16))],
    programId,
  )[0];
}

export function ruleDelegatePda(player: PublicKey, programId = grantProgramId()): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("rules"), player.toBuffer()], programId)[0];
}

/** Fresh 16-byte grant ID as hex (Web Crypto, so it works in the browser and in Node). */
export function newGrantId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export interface CreateGrantArgs {
  player: PublicKey;
  researcher: PublicKey;
  grantId: string; // 32 hex
  bountyHash: string; // 64 hex, salted
  accessType: AccessType;
  pricePerDay: number; // USDC base units
  /** Omit when the player signs; set to the delegate key for auto-accept. */
  delegate?: PublicKey;
}

export function createGrantIx(a: CreateGrantArgs, programId = grantProgramId()): TransactionInstruction {
  const signer = a.delegate ?? a.player;
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: a.player, isSigner: false, isWritable: false },
      { pubkey: a.researcher, isSigner: false, isWritable: false },
      // Optional rule_delegate: Anchor reads the program ID as "None".
      { pubkey: a.delegate ? ruleDelegatePda(a.player, programId) : programId, isSigner: false, isWritable: false },
      { pubkey: grantPda(a.player, a.grantId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(encodeCreateGrant(a.grantId, a.bountyHash, a.accessType, a.pricePerDay)),
  });
}

export function revokeGrantIx(player: PublicKey, grantIdHex: string, programId = grantProgramId()) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: player, isSigner: true, isWritable: false },
      { pubkey: grantPda(player, grantIdHex, programId), isSigner: false, isWritable: true },
    ],
    data: Buffer.from(DISC.revokeGrant),
  });
}

export function disableDelegateIx(player: PublicKey, programId = grantProgramId()) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: player, isSigner: true, isWritable: false },
      { pubkey: ruleDelegatePda(player, programId), isSigner: false, isWritable: true },
    ],
    data: Buffer.from(DISC.disableDelegate),
  });
}

export function consumeGrantIx(researcher: PublicKey, player: PublicKey, grantIdHex: string, programId = grantProgramId()) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: researcher, isSigner: true, isWritable: false },
      { pubkey: grantPda(player, grantIdHex, programId), isSigner: false, isWritable: true },
    ],
    data: Buffer.from(DISC.consumeGrant),
  });
}

/**
 * Kill switch: revoke_grant for each active grant plus disable_delegate, in one transaction (FR-6).
 * Set hasDelegate only if the player registered a rule delegate, or the tx fails on the missing account.
 */
export function killSwitchTx(player: PublicKey, activeGrantIds: string[], hasDelegate: boolean): Transaction {
  const tx = new Transaction();
  for (const id of activeGrantIds) tx.add(revokeGrantIx(player, id));
  if (hasDelegate) tx.add(disableDelegateIx(player));
  return tx;
}

// ---------- Memo fallback ----------

const memoIx = (signer: PublicKey, text: string) =>
  new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(text, "utf8"),
  });

export const grantMemoIx = (player: PublicKey, m: Omit<GrantMemo, "kind">) => memoIx(player, formatGrantMemo(m));

/** Memo kill switch: one tx with a dd:revoke memo per grant. */
export function memoKillSwitchTx(player: PublicKey, activeGrantIds: string[]): Transaction {
  const tx = new Transaction();
  for (const id of activeGrantIds) tx.add(memoIx(player, formatRevokeMemo(id)));
  return tx;
}
