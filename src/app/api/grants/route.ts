import { NextResponse } from "next/server";
import { batchesFor } from "@/lib/batches";
import { getBounty } from "@/lib/bounties";
import { loadSampleRows } from "@/lib/csv";
import { effectiveStatus, grantBackend } from "@/lib/grants";
import { rememberGrant } from "@/lib/solana/grantIndex";
import type { Bounty, OnChainGrant } from "@/lib/types";
import { getBatches, sealBatches } from "@/lib/vault";

// GET /api/grants?player=<pubkey>
export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  return NextResponse.json(await grantBackend().listGrants(player));
}

// POST /api/grants { player, bountyId, cardId, grantId? }
// Manual trade after the consent sheet's Confirm. Auto-accept goes through POST /api/auto-accept.
// With grantId: the player's wallet already signed create_grant (or the dd:grant memo); the server
// verifies that grant on-chain, remembers its off-chain context and seals its batches.
export async function POST(req: Request) {
  const { player, bountyId, cardId, grantId } = await req.json();
  const bounty = getBounty(bountyId);
  if (!player || !bounty || !cardId) return NextResponse.json({ error: "player, bountyId, cardId required" }, { status: 400 });
  if (grantId) return recordSignedGrant(grantId, player, bounty, cardId);

  const grant = await grantBackend().createGrant({ player, bountyId, cardId });
  sealBatches(grant.grantId, batchesFor(bounty.accessType, loadSampleRows()));
  return NextResponse.json(grant, { status: 201 });
}

async function recordSignedGrant(grantId: string, player: string, bounty: Bounty, cardId: string) {
  // Never re-seal: fresh keys would undo crypto-shredding after a revoke.
  if (getBatches(grantId).length > 0) return NextResponse.json({ error: "Grant already recorded" }, { status: 409 });

  // The Memo backend finds grants through the player's address, so the context goes in before the read.
  rememberGrant(grantId, { player, bountyId: bounty.id, cardId });
  const grant = await grantBackend().readGrant(grantId);
  if (!grant) return NextResponse.json({ error: "Grant not found on-chain yet" }, { status: 404 });

  const mismatch = signedGrantMismatch(grant, player, bounty);
  if (mismatch) return NextResponse.json({ error: mismatch }, { status: 403 });

  sealBatches(grantId, batchesFor(bounty.accessType, loadSampleRows()));
  return NextResponse.json({ ...grant, bountyId: bounty.id, cardId }, { status: 201 });
}

/** The on-chain grant must match what the player agreed to on the consent sheet. */
function signedGrantMismatch(grant: OnChainGrant, player: string, bounty: Bounty): string | null {
  if (grant.player !== player) return "Grant belongs to another player";
  if (effectiveStatus(grant) !== "Active") return "Grant is not active";
  if (grant.accessType !== bounty.accessType) return "Access type does not match the bounty";
  if (bounty.researcherPubkey && grant.researcher !== bounty.researcherPubkey) return "Researcher does not match the bounty";
  if (grant.pricePerDay !== Math.round(bounty.priceUsdc * 1_000_000)) return "Price does not match the bounty";
  return null;
}
