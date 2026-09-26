import { randomBytes } from "node:crypto";
import { planBatches } from "@/lib/batches";
import { findBounty } from "@/lib/bounties";
import { devRoutesDisabled, devRoutesEnabled } from "@/lib/devRoutes";
import { getMockGrantService } from "@/lib/grants";
import { loadSampleDays } from "@/lib/sampleData";
import type { Grant } from "@/lib/types";
import { DEMO_DAY_MS, getVault } from "@/lib/vault";

const STREAM_DAYS = 30;

/**
 * Creates a mock grant for a bounty and seals its batches, as a trade plus /api/grants/[id]/seal would.
 * Body (optional): { bountyId?: string, ttlSec?: number }. Default: Trinity Sleep Lab, 300 s (30 demo days).
 */
export async function POST(request: Request) {
  if (!devRoutesEnabled()) return devRoutesDisabled();

  const body = (await request.json().catch(() => ({}))) as { bountyId?: string; ttlSec?: number };
  const bounty = findBounty(body.bountyId ?? "trinity-sleep");
  if (!bounty) return Response.json({ error: "bounty_not_found" }, { status: 404 });
  const plan = planBatches(bounty, loadSampleDays());
  if (!plan.ok) return Response.json({ error: plan.reason }, { status: 409 });

  const nowMs = Date.now();
  const ttlSec = body.ttlSec ?? (STREAM_DAYS * DEMO_DAY_MS) / 1000;
  const grant: Grant = {
    grantId: randomBytes(16).toString("hex"),
    status: "active",
    accessType: bounty.accessType,
    expiresAt: Math.floor(nowMs / 1000) + ttlSec,
    pricePerDay: bounty.price.amount,
  };
  getMockGrantService().createGrant(grant);
  const batches = getVault().seal(grant.grantId, plan.plaintexts, nowMs);

  return Response.json({ grant, batchCount: batches.length }, { status: 201 });
}
