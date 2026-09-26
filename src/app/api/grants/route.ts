import { NextResponse } from "next/server";
import { batchesFor } from "@/lib/batches";
import { getBounty } from "@/lib/bounties";
import { loadSampleRows } from "@/lib/csv";
import { grantBackend } from "@/lib/grants";
import { DEMO_RULE, matches } from "@/lib/rules";
import { sealBatches } from "@/lib/vault";

// GET /api/grants?player=<pubkey>
export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  return NextResponse.json(await grantBackend().listGrants(player));
}

// POST /api/grants { player, bountyId, cardId, auto? }
// Manual trade after the consent sheet's Confirm, or auto-accept via the rule delegate.
export async function POST(req: Request) {
  const { player, bountyId, cardId, auto } = await req.json();
  const bounty = getBounty(bountyId);
  if (!player || !bounty || !cardId) return NextResponse.json({ error: "player, bountyId, cardId required" }, { status: 400 });

  // TODO(role C): load the player's saved rulesets instead of the demo rule.
  if (auto && !matches(DEMO_RULE, bounty)) {
    return NextResponse.json({ error: "Bounty does not match an auto-accept rule" }, { status: 403 });
  }

  const grant = await grantBackend().createGrant({ player, bountyId, cardId, rule: auto ? DEMO_RULE : undefined });
  sealBatches(grant.grantId, batchesFor(bounty.accessType, loadSampleRows()));
  return NextResponse.json(grant, { status: 201 });
}
