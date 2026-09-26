import { canRelease } from "@/lib/access";
import { planBatches } from "@/lib/batches";
import { findBounty } from "@/lib/bounties";
import { getGrantService } from "@/lib/grants";
import { loadSampleDays } from "@/lib/sampleData";
import { getVault } from "@/lib/vault";

type Params = { params: Promise<{ grantId: string }> };

const GRANT_ID = /^[0-9a-f]{32}$/;

/**
 * Called once a trade's grant exists (on-chain, or in the mock): encrypts the batches for that grant.
 * Body: { bountyId }. Only the bounty's fields are sealed. Repeating the call is a no-op.
 */
export async function POST(request: Request, { params }: Params) {
  const { grantId } = await params;
  if (!GRANT_ID.test(grantId)) return Response.json({ error: "invalid_grant_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { bountyId?: string };
  const bounty = body.bountyId ? findBounty(body.bountyId) : undefined;
  if (!bounty) return Response.json({ error: "bounty_not_found" }, { status: 404 });

  const vault = getVault();
  if (vault.has(grantId)) return Response.json({ grantId, alreadySealed: true });

  const nowMs = Date.now();
  const grant = await getGrantService().getGrant(grantId);
  const decision = canRelease(grant, Math.floor(nowMs / 1000));
  if (!decision.ok) return Response.json({ error: "grant_not_usable", reason: decision.reason }, { status: 403 });
  if (grant!.accessType !== bounty.accessType) {
    return Response.json({ error: "access_type_mismatch" }, { status: 409 });
  }

  const plan = planBatches(bounty, loadSampleDays());
  if (!plan.ok) return Response.json({ error: plan.reason }, { status: 409 });

  const batches = vault.seal(grantId, plan.plaintexts, nowMs);
  return Response.json({ grantId, batchCount: batches.length }, { status: 201 });
}
