import { NextResponse } from "next/server";
import { explorerUrl, listAccess } from "@/lib/accessLog";
import { getBounty } from "@/lib/bounties";
import { effectiveStatus, erasureLog, grantBackend } from "@/lib/grants";
import { USDC_DECIMALS, listPayouts } from "@/lib/solana/payout";

// GET /api/records?player=... -> everything the app shows as the player's records, from the server's stores:
// each grant with the terms agreed to, its erasure request, the batches opened and the payouts.
// The same data as the /privacy page, as JSON for the mobile app (like a read-only REST controller).
export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });

  const [grants, payouts] = await Promise.all([grantBackend().listGrants(player), listPayouts({ player })]);
  const access = listAccess(player);
  const usdc = (base: number) => base / 10 ** USDC_DECIMALS;

  return NextResponse.json({
    player,
    totalPaidUsdc: usdc(payouts.reduce((sum, p) => sum + p.amount, 0)),
    grants: grants.map((g) => {
      const bounty = getBounty(g.bountyId);
      const erasure = erasureLog.find((e) => e.grantId === g.grantId) ?? null;
      const paid = payouts.filter((p) => p.grantId === g.grantId);
      return {
        grantId: g.grantId,
        bountyId: g.bountyId,
        cardId: g.cardId,
        researcher: bounty?.researcher ?? g.researcher,
        accessType: g.accessType,
        accessWindow: bounty?.accessWindowLabel ?? null,
        retention: bounty?.retention ?? null,
        priceUsdc: usdc(g.pricePerDay),
        auto: g.auto,
        status: effectiveStatus(g),
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
        revokedAt: g.revokedAt,
        notice: bounty?.fullNotice ?? null,
        batchesOpened: new Set(access.filter((a) => a.grantId === g.grantId).map((a) => a.batch)).size,
        paidUsdc: usdc(paid.reduce((sum, p) => sum + p.amount, 0)),
        erasure: erasure && { requestedAt: erasure.requestedAt, revokeTx: erasure.revokeTx },
      };
    }),
    payouts: payouts.map((p) => ({
      grantId: p.grantId,
      batch: p.batch,
      amountUsdc: usdc(p.amount),
      signature: p.signature,
      mode: p.mode,
      paidAt: p.paidAt,
      explorer: explorerUrl(p.signature),
    })),
  });
}
