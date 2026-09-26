import { NextResponse } from "next/server";
import { BOUNTIES } from "@/lib/bounties";
import { DEMO_RULE, matches } from "@/lib/rules";

// GET /api/bounties -> the bounty board (FR-2), with whether the demo rule would auto-accept each one (FR-9).
export async function GET() {
  return NextResponse.json({
    rule: DEMO_RULE,
    bounties: BOUNTIES.map((b) => ({ ...b, autoAccept: matches(DEMO_RULE, b) })),
  });
}
