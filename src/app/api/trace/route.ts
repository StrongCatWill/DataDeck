import { NextResponse } from "next/server";
import { listAccess } from "@/lib/accessLog";
import { traceText } from "@/lib/fingerprint";
import { grantBackend } from "@/lib/grants";

// POST /api/trace { player, text } -> which of the player's grants a found copy of their data came from.
// text is anything pasted from the copy (a row, CSV or JSON); every trace_id in it is looked up. Only the player's
// own grants are reported, so the API never reveals another player's grants.
export async function POST(req: Request) {
  const { player, text } = await req.json().catch(() => ({}));
  if (typeof player !== "string" || !player || typeof text !== "string") {
    return NextResponse.json({ error: "player and text required" }, { status: 400 });
  }

  const backend = grantBackend();
  const opened = listAccess(player);
  const matches = [];
  for (const hit of traceText(text)) {
    const grant = await backend.readGrant(hit.grantId);
    if (!grant || grant.player !== player) continue;
    // Oldest key release for this batch: when the researcher first could read it.
    const first = opened.filter((a) => a.grantId === hit.grantId && a.batch === hit.batch).at(-1);
    matches.push({
      traceId: hit.traceId,
      grantId: grant.grantId,
      batch: hit.batch,
      researcher: grant.researcher,
      bountyId: grant.bountyId,
      openedAt: first?.releasedAt ?? null,
      status: grant.status,
    });
  }
  return NextResponse.json({ matches });
}
