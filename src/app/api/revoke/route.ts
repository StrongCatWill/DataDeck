import { NextResponse } from "next/server";
import { erasureLog, grantBackend } from "@/lib/grants";
import { destroyUnreleasedKeys } from "@/lib/vault";

// POST /api/revoke { player }
// Kill switch: revoke on-chain, shred unreleased keys, log an erasure request (FR-6, FR-12).
// TODO(role A): the player signs the revoke tx client-side; this route should then only verify it.
export async function POST(req: Request) {
  const { player } = await req.json();
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });

  const { tx, revoked } = await grantBackend().revokeAll(player);
  const destroyed = revoked.reduce((n, g) => n + destroyUnreleasedKeys(g.grantId), 0);
  const requestedAt = new Date().toISOString();
  for (const g of revoked) erasureLog.push({ grantId: g.grantId, researcher: g.researcher, revokeTx: tx, requestedAt });

  return NextResponse.json({ tx, revoked: revoked.map((g) => g.grantId), keysDestroyed: destroyed });
}
