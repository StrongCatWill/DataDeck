import { NextResponse } from "next/server";
import { USDC_DECIMALS, listPayouts, payoutMode } from "@/lib/solana/payout";

// GET /api/payouts?player=...&grantId=...
// USDC paid so far, newest first, for the player's "USDC arrives per day" view and the researcher portal (FR-7).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const player = url.searchParams.get("player") ?? undefined;
  const grantId = url.searchParams.get("grantId") ?? undefined;
  if (!player && !grantId) return NextResponse.json({ error: "Pass player or grantId" }, { status: 400 });

  const payouts = await listPayouts({ player, grantId });
  const total = payouts.reduce((sum, p) => sum + p.amount, 0);
  return NextResponse.json({ mode: payoutMode(), totalUsdc: total / 10 ** USDC_DECIMALS, payouts });
}
