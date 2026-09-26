import { NextResponse } from "next/server";
import { delegatePublicKey } from "@/lib/rulesAutoAccept";
import { disableRules, getRules, noticesFor, saveRuleset } from "@/lib/rulesStore";

// GET /api/rules?player=<pubkey>
// The player's ruleset (if any) and their auto-accept notifications.
export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  return NextResponse.json({ rules: getRules(player) ?? null, notices: noticesFor(player) });
}

// POST /api/rules { player, ruleset }
// Saves a ruleset after the fixed guardrails (400 with the reasons if it breaks one).
// Returns `register`: what the player's wallet signs so the delegate may act for them
// (memo: grantTx.rulesMemoIx, anchor: grantTx.setRuleDelegateIx). Mock mode needs no signature.
export async function POST(req: Request) {
  const { player, ruleset } = await req.json();
  if (!player || !ruleset?.match) return NextResponse.json({ error: "player, ruleset required" }, { status: 400 });

  const { errors, saved } = saveRuleset(player, ruleset);
  if (!saved) return NextResponse.json({ errors }, { status: 400 });
  return NextResponse.json(
    { rules: saved, register: { delegate: delegatePublicKey(), ruleHash: saved.ruleHash, expiresAt: saved.expiresAt } },
    { status: 201 },
  );
}

// DELETE /api/rules?player=<pubkey>
// Turns auto-accept off for this player (the kill switch's disable_delegate, server side).
export async function DELETE(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  return NextResponse.json({ disabled: disableRules(player) });
}
