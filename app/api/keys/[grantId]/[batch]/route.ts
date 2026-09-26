import { canRelease } from "@/lib/access";
import { getGrantService } from "@/lib/grants";
import { getVault } from "@/lib/vault";

type Params = { params: Promise<{ grantId: string; batch: string }> };

/** Releases one batch key, only while the grant is active and unexpired. */
export async function GET(_request: Request, { params }: Params) {
  const { grantId, batch } = await params;
  const batchNo = Number(batch);
  if (!Number.isInteger(batchNo) || batchNo < 0) {
    return Response.json({ error: "invalid_batch" }, { status: 400 });
  }

  const nowMs = Date.now();
  const grant = await getGrantService().getGrant(grantId);
  const decision = canRelease(grant, Math.floor(nowMs / 1000));
  if (!decision.ok) {
    getVault().destroyKeys(grantId);
    return Response.json({ error: "access_refused", reason: decision.reason }, { status: 403 });
  }

  const key = getVault().getKey(grantId, batchNo, nowMs);
  if (!key) return Response.json({ error: "batch_not_available" }, { status: 404 });
  // A single query releases its one key once; marking the grant Consumed on-chain is consume_grant (Solana side).
  if (grant!.accessType === "singleQuery") getVault().destroyKeys(grantId);
  return Response.json({ grantId, batch: batchNo, key });
}
