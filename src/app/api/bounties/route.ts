import { NextResponse } from "next/server";
import { BOUNTIES } from "@/lib/bounties";
import { assessRisk, isRiskLevel, withinTolerance } from "@/lib/risk";
import { DEMO_RULE, matches } from "@/lib/rules";

// GET /api/bounties[?tolerance=Low|Medium|High] -> the bounty board (FR-2), with whether the demo rule would
// auto-accept each one (FR-9), its risk label, and whether it is within the player's risk tolerance.
export async function GET(req?: Request) {
  const param = req ? new URL(req.url).searchParams.get("tolerance") : null;
  if (param !== null && !isRiskLevel(param)) {
    return NextResponse.json({ error: "tolerance must be Low, Medium or High" }, { status: 400 });
  }
  const tolerance = param ?? "High";
  return NextResponse.json({
    rule: DEMO_RULE,
    tolerance,
    bounties: BOUNTIES.map((b) => {
      const risk = assessRisk(b);
      return { ...b, autoAccept: matches(DEMO_RULE, b), risk, withinTolerance: withinTolerance(risk.level, tolerance) };
    }),
  });
}
