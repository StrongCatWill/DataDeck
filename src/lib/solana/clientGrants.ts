import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import type { AccessType, Bounty } from "../types";
import { DEMO_DAY_SECONDS } from "../types";
import { bytesToHex } from "./codec";
import { createGrantIx, grantMemoIx, killSwitchTx, memoKillSwitchTx, newGrantId, ruleDelegatePda } from "./grantTx";

// Browser helpers for the dashboard: one call per player action, whatever GRANT_BACKEND is.
//   lendCard     - Confirm on the consent sheet: wallet signs create_grant (or the dd:grant memo), server records it.
//   stopSharing  - kill switch: wallet signs revoke_grant x N + disable_delegate (or dd:revoke memos) in one tx.
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
async function saltedBountyHash(bountyId: string): Promise<string> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + bountyId));
  return bytesToHex(new Uint8Array(digest));
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
  const res = await post(fetchFn, "/api/revoke", { player: publicKey.toBase58(), tx: sig, grantIds: activeGrantIds });
  return { tx: sig, response: await res.json() };
}
