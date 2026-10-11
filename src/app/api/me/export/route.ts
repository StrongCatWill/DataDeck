import { NextResponse } from "next/server";
import { GET as records } from "@/app/api/records/route";
import { getProfile, view } from "@/lib/profile";

// GET /api/me/export?player=... -> a JSON file with everything held about the player (GDPR Art. 15 and 20):
// the account, game progress, notifications, cash-outs, and every loan with its terms, batches opened and payouts.
export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  const p = getProfile(player);
  if (!p) return NextResponse.json({ error: "No account for this player" }, { status: 404 });
  const rec = await (await records(new Request(`http://internal/api/records?player=${encodeURIComponent(player)}`))).json();
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: view(p), records: rec }, null, 2);
  return new NextResponse(body, {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="data-deck-export.json"` },
  });
}
