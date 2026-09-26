import { BOUNTIES } from "@/lib/bounties";
import { DEMO_RULE, matchBounty } from "@/lib/rules";

/** The demo ruleset and, for each bounty, whether it would be auto-accepted today (and why not). */
export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  return Response.json({
    rule: DEMO_RULE,
    matches: BOUNTIES.map((b) => ({ bountyId: b.bountyId, ...matchBounty(DEMO_RULE, b, today) })),
  });
}
