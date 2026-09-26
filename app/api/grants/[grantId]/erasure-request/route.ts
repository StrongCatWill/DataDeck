import { getErasureLog } from "@/lib/erasure";
import { getGrantService } from "@/lib/grants";
import { getVault } from "@/lib/vault";

type Params = { params: Promise<{ grantId: string }> };

const TX_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

/**
 * Kill switch follow-up: after the revoke transaction lands, the app logs an erasure request.
 * Body (optional): { revokeTx }. The grant must already read as revoked. Also destroys any keys still held.
 */
export async function POST(request: Request, { params }: Params) {
  const { grantId } = await params;
  const body = (await request.json().catch(() => ({}))) as { revokeTx?: string };
  const revokeTx = body.revokeTx ?? null;
  if (revokeTx !== null && !TX_SIGNATURE.test(revokeTx)) {
    return Response.json({ error: "invalid_revoke_tx" }, { status: 400 });
  }

  const grant = await getGrantService().getGrant(grantId);
  if (!grant) return Response.json({ error: "not_found" }, { status: 404 });
  if (grant.status !== "revoked") return Response.json({ error: "grant_not_revoked" }, { status: 409 });

  getVault().destroyKeys(grantId);
  return Response.json(getErasureLog().request(grantId, revokeTx, Date.now()), { status: 201 });
}

/** The erasure request for a grant, for the researcher portal. */
export async function GET(_request: Request, { params }: Params) {
  const { grantId } = await params;
  const entry = getErasureLog().get(grantId);
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(entry);
}
