import { NextResponse } from "next/server";
import { getBounty } from "@/lib/bounties";
import { autoAcceptBounty } from "@/lib/rulesAutoAccept";

// POST /api/auto-accept { bountyId }
// A researcher posted a bounty: every player whose ruleset matches gets a grant signed by the rule delegate.
// Commercial or unverified bounties never match (rules.matches). Returns one result per matched player.
export async function POST(req: Request) {
  const { bountyId } = await req.json();
  if (!getBounty(bountyId)) return NextResponse.json({ error: "Unknown bounty" }, { status: 400 });
  return NextResponse.json({ results: await autoAcceptBounty(bountyId) });
}
