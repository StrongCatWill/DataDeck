import type { Connection, ConfirmedSignatureInfo } from "@solana/web3.js";
import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getBounty } from "../bounties";
import type { GrantBackend } from "../grants";
import { saltedHash } from "../hash";
import { ruleHash } from "../rules";
import type { GrantView, OnChainGrant } from "../types";
import { connection, keypairFromEnv, withContext } from "./anchorGrants";
import { parseRpcMemoField, type DdMemo, type GrantMemo } from "./codec";
import { grantContext, rememberGrant } from "./grantIndex";
import { grantMemoIx, newGrantId } from "./grantTx";

// GRANT_BACKEND=memo: the 12:30 fallback. State lives in memos:
// - the player's wallet signs dd:grant / dd:revoke / dd:rules / dd:rules-off (grantTx, clientGrants)
// - the rule delegate (server key) signs dd:grant ... p=<player> rh=<rule hash> for auto-accept
// The latest memo per grant ID is its state. A delegate grant only counts if, at that moment, the player's latest
// dd:rules memo named this delegate and rule hash and had not expired or been switched off.
// Consumed is kept in server memory only.

const consumed = new Set<string>();

interface MemoEvent {
  memo: DdMemo;
  slot: number;
  time: number;
  byDelegate: boolean;
}

/** A memo only counts if the expected key signed its transaction; anyone can send a memo tx that mentions a player. */
async function signedBy(conn: Connection, sig: string, signer: string): Promise<boolean> {
  const tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 });
  return Boolean(tx?.transaction.message.accountKeys.some((k) => k.signer && k.pubkey.toBase58() === signer));
}

async function collect(
  conn: Connection,
  sigs: ConfirmedSignatureInfo[],
  signer: string,
  keep: (m: DdMemo) => boolean,
  byDelegate: boolean,
): Promise<MemoEvent[]> {
  const out: MemoEvent[] = [];
  for (const s of sigs) {
    if (s.err) continue;
    const memos = parseRpcMemoField(s.memo).filter(keep);
    if (memos.length === 0 || !(await signedBy(conn, s.signature, signer))) continue;
    for (const memo of memos) out.push({ memo, slot: s.slot, time: s.blockTime ?? 0, byDelegate });
  }
  return out;
}

export interface MemoSources {
  playerSigs: ConfirmedSignatureInfo[];
  delegate?: string;
  delegateSigs?: ConfirmedSignatureInfo[];
  onlyGrantId?: string;
}

/** Folds a player's memo history (and their delegate's) into grant states. */
export async function grantsFromMemos(conn: Connection, player: string, src: MemoSources): Promise<OnChainGrant[]> {
  const wanted = (m: DdMemo) => !src.onlyGrantId || !("grantId" in m) || m.grantId === src.onlyGrantId;
  const own = await collect(conn, src.playerSigs, player, (m) => wanted(m) && !(m.kind === "grant" && m.player), false);
  const delegated =
    src.delegate && src.delegateSigs
      ? await collect(conn, src.delegateSigs, src.delegate, (m) => wanted(m) && m.kind === "grant" && m.player === player, true)
      : [];

  // Rules timeline, oldest first, to check each delegate grant against the rule in force at its slot.
  const rules = own.filter((e) => e.memo.kind === "rules" || e.memo.kind === "rules-off").sort((a, b) => a.slot - b.slot);
  const authorised = (e: MemoEvent & { memo: GrantMemo }) => {
    const inForce = rules.filter((r) => r.slot <= e.slot).at(-1)?.memo;
    return (
      inForce?.kind === "rules" &&
      inForce.delegate === src.delegate &&
      inForce.ruleHash === e.memo.ruleHash &&
      inForce.expiresAt > e.time
    );
  };

  const events = [...own, ...delegated].sort((a, b) => b.slot - a.slot); // newest first
  const revokedAt = new Map<string, number>();
  const grants = new Map<string, OnChainGrant>();
  for (const e of events) {
    const m = e.memo;
    if (m.kind === "revoke" && !e.byDelegate) {
      if (!revokedAt.has(m.grantId) && !grants.has(m.grantId)) revokedAt.set(m.grantId, e.time);
    } else if (m.kind === "grant" && !grants.has(m.grantId)) {
      if (e.byDelegate && !authorised(e as MemoEvent & { memo: GrantMemo })) continue;
      grants.set(m.grantId, fromMemo(m, player, e.time, revokedAt.get(m.grantId) ?? null));
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
    auto: Boolean(m.ruleHash),
    ruleHash: m.ruleHash ?? null,
    revokedAt,
  };
}

function delegateKey(): string | undefined {
  try {
    return keypairFromEnv("RULE_DELEGATE_SECRET_KEY").publicKey.toBase58();
  } catch {
    return undefined; // auto-accept not configured
  }
}

async function memoGrants(player: string, onlyGrantId?: string): Promise<GrantView[]> {
  const conn = connection();
  const delegate = delegateKey();
  const [playerSigs, delegateSigs] = await Promise.all([
    conn.getSignaturesForAddress(new PublicKey(player), { limit: 1000 }),
    delegate ? conn.getSignaturesForAddress(new PublicKey(delegate), { limit: 1000 }) : undefined,
  ]);
  return (await grantsFromMemos(conn, player, { playerSigs, delegate, delegateSigs, onlyGrantId })).map(withContext);
}

/** Same TTLs as the Anchor program (demo clock for streams). */
function expiresAt(accessType: GrantMemo["accessType"], now: number) {
  return now + (accessType === "stream_30d" ? 30 * 10 : 24 * 3600);
}

export const memoBackend: GrantBackend = {
  async readGrant(grantId) {
    const player = grantContext(grantId)?.player; // memos are found through the player's address
    if (!player) return null;
    return (await memoGrants(player, grantId))[0] ?? null;
  },
  listGrants: (player) => memoGrants(player),

  // Auto-accept only: the rule delegate signs a dd:grant memo tagged with the player and rule hash.
  async createGrant({ player, bountyId, cardId, rule }) {
    if (!rule) throw new Error("Memo backend: the player's wallet signs the dd:grant memo (clientGrants.lendCard)");
    const bounty = getBounty(bountyId);
    const researcher = bounty?.researcherPubkey ?? process.env.NEXT_PUBLIC_DEMO_RESEARCHER_PUBKEY;
    if (!bounty || !researcher) throw new Error("Unknown bounty or no researcher pubkey");
    const delegate = keypairFromEnv("RULE_DELEGATE_SECRET_KEY");
    const grantId = newGrantId();
    const ix = grantMemoIx(delegate.publicKey, {
      grantId,
      accessType: bounty.accessType,
      expiresAt: expiresAt(bounty.accessType, Math.floor(Date.now() / 1000)),
      pricePerDay: Math.round(bounty.priceUsdc * 1_000_000),
      researcher,
      bountyHash: saltedHash(bounty.id).hash,
      player,
      ruleHash: ruleHash(rule),
    });
    await sendAndConfirmTransaction(connection(), new Transaction().add(ix), [delegate]);
    rememberGrant(grantId, { player, bountyId, cardId });
    const grant = await this.readGrant(grantId);
    if (!grant) throw new Error("Auto-accept memo sent but not authorised: has the player registered this rule (dd:rules)?");
    return grant;
  },

  async revokeAll() {
    throw new Error("Memo backend: the player's wallet signs the kill switch (clientGrants.stopSharing)");
  },
  async consumeGrant(grantId) {
    consumed.add(grantId);
  },
};
