import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import type { AccessType, Bounty, Ruleset } from "../types";
import { DEMO_DAY_SECONDS } from "../types";
import { bytesToHex } from "./codec";
import {
  createGrantIx,
  grantMemoIx,
  killSwitchTx,
  memoKillSwitchTx,
  newGrantId,
  ruleDelegatePda,
  rulesMemoIx,
  setRuleDelegateIx,
} from "./grantTx";

// Browser helpers for the dashboard: one call per player action, whatever GRANT_BACKEND is.
//   lendCard     - Confirm on the consent sheet: wallet signs create_grant (or the dd:grant memo), server records it.
//   stopSharing  - kill switch: wallet signs revoke_grant x N + disable_delegate (or dd:revoke + dd:rules-off memos) in one tx.
//   enableAutoAccept - wallet registers the server's rule delegate for one ruleset (set_rule_delegate or dd:rules memo).
// In mock mode they call the API directly, as the dashboard does today.

export type GrantMode = "mock" | "anchor" | "memo";

/** Must match the server's GRANT_BACKEND. */
export function clientGrantMode(): GrantMode {
  const m = process.env.NEXT_PUBLIC_GRANT_BACKEND;
  return m === "anchor" || m === "memo" ? m : "mock";
}

/** The subset of wallet-adapter's useWallet() these helpers need. */
export interface WalletLike {
  publicKey: PublicKey | null;
  sendTransaction(tx: Transaction, connection: Connection): Promise<string>;
}

interface Deps {
  wallet: WalletLike;
  connection: Connection;
  mode?: GrantMode;
  fetchFn?: typeof fetch;
}

const post = (fetchFn: typeof fetch, url: string, body: unknown) =>
  fetchFn(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Memo grants carry their own expiry; mirrors expiresAtFor in grants.ts (the Anchor program sets it on-chain). */
function memoExpiresAt(accessType: AccessType, now: number): number {
  return now + (accessType === "stream_30d" ? 30 * DEMO_DAY_SECONDS : 24 * 3600);
}

/** Salted sha256 of the bounty id, so the chain cannot be matched against the public bounty list (risk 3). */
const sha256Hex = async (text: string) =>
  bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));

async function saltedBountyHash(bountyId: string): Promise<string> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  return sha256Hex(salt + bountyId);
}

function researcherFor(bounty: Bounty): PublicKey {
  const key = bounty.researcherPubkey ?? process.env.NEXT_PUBLIC_DEMO_RESEARCHER_PUBKEY;
  if (!key) throw new Error(`Bounty ${bounty.id} has no researcherPubkey and NEXT_PUBLIC_DEMO_RESEARCHER_PUBKEY is not set`);
  return new PublicKey(key);
}

async function sendAndConfirm(tx: Transaction, { wallet, connection }: Deps): Promise<string> {
  const sig = await wallet.sendTransaction(tx, connection);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  return sig;
}

export async function lendCard(bounty: Bounty, cardId: string, deps: Deps): Promise<{ grantId: string; tx?: string }> {
  const mode = deps.mode ?? clientGrantMode();
  const fetchFn = deps.fetchFn ?? fetch;
  const { publicKey } = deps.wallet;

  if (mode === "mock") {
    const res = await post(fetchFn, "/api/grants", { player: publicKey?.toBase58() ?? "demo-player", bountyId: bounty.id, cardId });
    if (!res.ok) throw new Error((await res.json()).error ?? "Could not open the grant");
    return { grantId: (await res.json()).grantId };
  }

  if (!publicKey) throw new Error("Connect a wallet first");
  const grantId = newGrantId();
  const fields = {
    grantId,
    bountyHash: await saltedBountyHash(bounty.id),
    accessType: bounty.accessType,
    pricePerDay: Math.round(bounty.priceUsdc * 1_000_000),
  };
  const researcher = researcherFor(bounty);
  const ix =
    mode === "anchor"
      ? createGrantIx({ player: publicKey, researcher, ...fields })
      : grantMemoIx(publicKey, { ...fields, researcher: researcher.toBase58(), expiresAt: memoExpiresAt(bounty.accessType, Math.floor(Date.now() / 1000)) });
  const tx = await sendAndConfirm(new Transaction().add(ix), deps);

  // The RPC the server reads from can lag the one the wallet used, so 404 means "not yet".
  for (let attempt = 0; ; attempt++) {
    const res = await post(fetchFn, "/api/grants", { player: publicKey.toBase58(), bountyId: bounty.id, cardId, grantId });
    if (res.ok || res.status === 409) return { grantId, tx };
    if (res.status !== 404 || attempt >= 4) throw new Error(`${(await res.json()).error ?? "Recording failed"} (tx ${tx})`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/**
 * Kill switch. Pass the grants the dashboard shows as active. Returns the tx signature, which the server
 * logs as proof of time in the erasure request.
 */
export async function stopSharing(activeGrantIds: string[], deps: Deps): Promise<{ tx: string; response: unknown }> {
  const mode = deps.mode ?? clientGrantMode();
  const fetchFn = deps.fetchFn ?? fetch;
  const { publicKey } = deps.wallet;

  if (mode === "mock") {
    const res = await post(fetchFn, "/api/revoke", { player: publicKey?.toBase58() ?? "demo-player" });
    const response = await res.json();
    return { tx: response.tx, response };
  }

  if (!publicKey) throw new Error("Connect a wallet first");
  let tx: Transaction;
  if (mode === "anchor") {
    const hasDelegate = (await deps.connection.getAccountInfo(ruleDelegatePda(publicKey))) !== null;
    tx = killSwitchTx(publicKey, activeGrantIds, hasDelegate);
  } else {
    tx = memoKillSwitchTx(publicKey, activeGrantIds);
  }
  if (tx.instructions.length === 0) throw new Error("Nothing to stop");
  const sig = await sendAndConfirm(tx, deps);

  // The server checks each revoke on-chain; while its RPC lags it answers "Not revoked on-chain yet", so retry those.
  const revoked: string[] = [];
  let pending = activeGrantIds;
  let response: RevokeResponse = { tx: sig, revoked, rejected: [], keysDestroyed: 0 };
  let keysDestroyed = 0;
  for (let attempt = 0; pending.length > 0; attempt++) {
    const res = await post(fetchFn, "/api/revoke", { player: publicKey.toBase58(), tx: sig, grantIds: pending });
    const body = (await res.json()) as Partial<RevokeResponse>;
    revoked.push(...(body.revoked ?? []));
    keysDestroyed += body.keysDestroyed ?? 0;
    const rejected = body.rejected ?? [];
    response = { tx: sig, revoked, rejected, keysDestroyed };
    pending = rejected.filter((r) => r.reason === NOT_YET).map((r) => r.grantId);
    if (pending.length === 0 || attempt >= 4 || res.status === 400) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { tx: sig, response };
}

const NOT_YET = "Not revoked on-chain yet";

export interface RevokeResponse {
  tx: string;
  revoked: string[];
  rejected: { grantId: string; reason: string }[];
  keysDestroyed: number;
}

/**
 * Lets the server's rule delegate open grants for this player under one ruleset, until the ruleset expires.
 * The rule hash matches the server's sha256(JSON.stringify(rule)), so each auto grant proves which rule created it.
 */
export async function enableAutoAccept(rule: Ruleset, deps: Deps): Promise<{ tx?: string; ruleHash: string }> {
  const mode = deps.mode ?? clientGrantMode();
  const ruleHash = await sha256Hex(JSON.stringify(rule));
  if (mode === "mock") return { ruleHash };

  const { publicKey } = deps.wallet;
  if (!publicKey) throw new Error("Connect a wallet first");
  const delegateKey = process.env.NEXT_PUBLIC_RULE_DELEGATE_PUBKEY;
  if (!delegateKey) throw new Error("NEXT_PUBLIC_RULE_DELEGATE_PUBKEY is not set");
  const delegate = new PublicKey(delegateKey);
  const expiresAt = Math.floor(new Date(rule.expiresAt).getTime() / 1000);
  const ix =
    mode === "anchor"
      ? setRuleDelegateIx(publicKey, delegate, ruleHash, expiresAt)
      : rulesMemoIx(publicKey, { delegate: delegate.toBase58(), ruleHash, expiresAt });
  return { tx: await sendAndConfirm(new Transaction().add(ix), deps), ruleHash };
}
