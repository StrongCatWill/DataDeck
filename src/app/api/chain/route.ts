import { NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getBounty } from "@/lib/bounties";
import { effectiveStatus, grantBackend } from "@/lib/grants";
import { connection } from "@/lib/solana/anchorGrants";
import { grantInstruction, killSwitchTransaction } from "@/lib/solana/clientGrants";
import { bytesToBase58 } from "@/lib/solana/codec";
import { rulesMemoIx, setRuleDelegateIx } from "@/lib/solana/grantTx";
import { payoutMode } from "@/lib/solana/payout";
import { delegatePublicKey } from "@/lib/rulesAutoAccept";
import { getRules } from "@/lib/rulesStore";

// Wallet bridge for the static app (public/deck), which ships without web3.js. The server builds the unsigned
// transaction, the player's own wallet (Phantom) signs and sends it, and the app then reports the signature to
// /api/grants or /api/revoke exactly as the React dashboard does. The server never holds the player's key.
//   GET  /api/chain                                       -> { grantBackend, payoutMode, cluster }
//   POST /api/chain { action: "grant", player, bountyId } -> { grantId, message }   (base58 tx message to sign)
//   POST /api/chain { action: "revoke", player }          -> { grantIds, message }  (kill switch)
//   POST /api/chain { action: "rules", player }           -> { message }  (lets the rule delegate act for the
//                                                             player's saved ruleset, as enableAutoAccept does)
const mode = () => {
  const m = process.env.GRANT_BACKEND;
  return m === "anchor" || m === "memo" ? m : "mock";
};

export async function GET() {
  return NextResponse.json({ grantBackend: mode(), payoutMode: payoutMode(), cluster: "devnet" });
}

export async function POST(req: Request) {
  const { action, player, bountyId } = await req.json().catch(() => ({}));
  const m = mode();
  if (m === "mock") return NextResponse.json({ error: "GRANT_BACKEND is mock: no wallet needed" }, { status: 400 });
  let key: PublicKey;
  try {
    key = new PublicKey(player);
  } catch {
    return NextResponse.json({ error: "player must be a wallet address" }, { status: 400 });
  }
  const conn = connection();

  let tx: Transaction;
  let out: Record<string, unknown>;
  if (action === "grant") {
    const bounty = getBounty(bountyId);
    if (!bounty) return NextResponse.json({ error: "Unknown bounty" }, { status: 404 });
    const { grantId, ix } = await grantInstruction(bounty, key, m);
    tx = new Transaction().add(ix);
    out = { grantId };
  } else if (action === "revoke") {
    const grantIds = (await grantBackend().listGrants(player)).filter((g) => effectiveStatus(g) === "Active").map((g) => g.grantId);
    if (grantIds.length === 0) return NextResponse.json({ error: "Nothing to stop" }, { status: 409 });
    tx = await killSwitchTransaction(key, grantIds, m, conn);
    out = { grantIds };
  } else if (action === "rules") {
    const saved = getRules(player);
    if (!saved?.active) return NextResponse.json({ error: "Save a ruleset first" }, { status: 409 });
    const delegate = new PublicKey(delegatePublicKey());
    const { expiresAt } = saved;
    tx = new Transaction().add(
      m === "anchor"
        ? setRuleDelegateIx(key, delegate, saved.ruleHash, expiresAt)
        : rulesMemoIx(key, { delegate: delegate.toBase58(), ruleHash: saved.ruleHash, expiresAt }),
    );
    out = {};
  } else {
    return NextResponse.json({ error: "action must be grant, revoke or rules" }, { status: 400 });
  }

  tx.feePayer = key;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  return NextResponse.json({ ...out, message: bytesToBase58(tx.serializeMessage()) });
}
