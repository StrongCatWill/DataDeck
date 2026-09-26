import type { Connection, ConfirmedSignatureInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import type { GrantBackend } from "../grants";
import type { GrantView, OnChainGrant } from "../types";
import { connection, withContext } from "./anchorGrants";
import { parseRpcMemoField, type GrantMemo } from "./codec";
import { grantContext } from "./grantIndex";

// GRANT_BACKEND=memo: the 12:30 fallback. The player's wallet writes dd:grant / dd:revoke memos
// (grantTx.grantMemoIx / memoKillSwitchTx); the latest memo per grant ID, signed by the player, is its state.
// Consumed is kept in server memory only. Auto-accept is not supported on this backend.

const consumed = new Set<string>();

/** A memo only counts if the player signed its transaction; anyone can send a memo tx that mentions them. */
async function signedByPlayer(conn: Connection, sig: string, player: string): Promise<boolean> {
  const tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 });
  return Boolean(tx?.transaction.message.accountKeys.some((k) => k.signer && k.pubkey.toBase58() === player));
}

/** Folds a player's memo history (newest first, as the RPC returns it) into grant states. */
export async function grantsFromMemos(
  conn: Connection,
  player: string,
  sigs: ConfirmedSignatureInfo[],
  onlyGrantId?: string,
): Promise<OnChainGrant[]> {
  const revokedAt = new Map<string, number>();
  const grants = new Map<string, OnChainGrant>();
  for (const s of sigs) {
    if (s.err) continue;
    const memos = parseRpcMemoField(s.memo).filter((m) => !onlyGrantId || m.grantId === onlyGrantId);
    if (memos.length === 0 || !(await signedByPlayer(conn, s.signature, player))) continue;
    for (const m of memos) {
      if (grants.has(m.grantId)) continue; // an older memo for a grant we already resolved
      if (m.kind === "revoke") {
        if (!revokedAt.has(m.grantId)) revokedAt.set(m.grantId, s.blockTime ?? 0);
      } else {
        grants.set(m.grantId, fromMemo(m, player, s.blockTime ?? 0, revokedAt.get(m.grantId) ?? null));
      }
    }
  }
  return [...grants.values()];
}

function fromMemo(m: GrantMemo, player: string, createdAt: number, revokedAt: number | null): OnChainGrant {
  return {
    player,
    researcher: m.researcher,
    grantId: m.grantId,
    bountyHash: m.bountyHash,
    accessType: m.accessType,
    createdAt,
    expiresAt: m.expiresAt,
    pricePerDay: m.pricePerDay,
    status: revokedAt !== null ? "Revoked" : consumed.has(m.grantId) ? "Consumed" : "Active",
    auto: false,
    ruleHash: null,
    revokedAt,
  };
}

async function memoGrants(player: string, onlyGrantId?: string): Promise<GrantView[]> {
  const conn = connection();
  const sigs = await conn.getSignaturesForAddress(new PublicKey(player), { limit: 1000 });
  return (await grantsFromMemos(conn, player, sigs, onlyGrantId)).map(withContext);
}

export const memoBackend: GrantBackend = {
  async readGrant(grantId) {
    const player = grantContext(grantId)?.player; // memos are found through the player's address
    if (!player) return null;
    return (await memoGrants(player, grantId))[0] ?? null;
  },
  listGrants: (player) => memoGrants(player),
  async createGrant() {
    throw new Error("Memo backend: the player's wallet signs the dd:grant memo (grantTx.grantMemoIx); auto-accept is not supported");
  },
  async revokeAll() {
    throw new Error("Memo backend: the player's wallet signs the kill switch (grantTx.memoKillSwitchTx)");
  },
  async consumeGrant(grantId) {
    consumed.add(grantId);
  },
};
