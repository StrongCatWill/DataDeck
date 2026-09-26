import { NextResponse } from "next/server";
import { erasureLog, grantBackend } from "@/lib/grants";
import { disableRules } from "@/lib/rulesStore";
import { destroyUnreleasedKeys } from "@/lib/vault";

// POST /api/revoke { player }                  - mock: the server revokes every active grant itself
// POST /api/revoke { player, tx, grantIds }    - anchor/memo: the player's wallet already signed the revoke tx
// Kill switch: shred unreleased keys, log an erasure request (FR-6, FR-12).
export async function POST(req: Request) {
  const { player, tx, grantIds } = await req.json();
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  if (tx !== undefined || grantIds !== undefined) return recordSignedRevoke(player, tx, grantIds);

  const { tx: mockTx, revoked } = await grantBackend().revokeAll(player);
  disableRules(player); // the mock stand-in for disable_delegate in the same tx
  const destroyed = revoked.reduce((n, g) => n + destroyUnreleasedKeys(g.grantId), 0);
  const requestedAt = new Date().toISOString();
  for (const g of revoked) erasureLog.push({ grantId: g.grantId, researcher: g.researcher, revokeTx: mockTx, requestedAt });

  return NextResponse.json({ tx: mockTx, revoked: revoked.map((g) => g.grantId), keysDestroyed: destroyed });
}

async function recordSignedRevoke(player: string, tx: unknown, grantIds: unknown) {
  if (typeof tx !== "string" || !tx || !Array.isArray(grantIds) || !grantIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "tx and grantIds required" }, { status: 400 });
  }

  const backend = grantBackend();
  const requestedAt = new Date().toISOString();
  const revoked: string[] = [];
  const rejected: { grantId: string; reason: string }[] = [];
  let destroyed = 0;

  for (const grantId of new Set(grantIds as string[])) {
    // Trust the chain, not the request: only a grant this player really revoked is shredded and logged.
    const grant = await backend.readGrant(grantId);
    if (!grant || grant.player !== player) {
      rejected.push({ grantId, reason: "Unknown grant for this player" });
      continue;
    }
    if (grant.status !== "Revoked") {
      // The server's RPC may lag the wallet's; the key API still refuses once the revoke lands.
      rejected.push({ grantId, reason: "Not revoked on-chain yet" });
      continue;
    }
    destroyed += destroyUnreleasedKeys(grantId);
    if (!erasureLog.some((e) => e.grantId === grantId)) {
      erasureLog.push({ grantId, researcher: grant.researcher, revokeTx: tx, requestedAt });
    }
    revoked.push(grantId);
  }

  // The wallet's kill switch also ran disable_delegate; stop server-side auto-accept to match.
  if (revoked.length > 0) disableRules(player);
  const status = revoked.length === 0 && rejected.length > 0 ? 403 : 200;
  return NextResponse.json({ tx, revoked, rejected, keysDestroyed: destroyed }, { status });
}
