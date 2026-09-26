import { NextResponse } from "next/server";
import { checkKeyAccess } from "@/lib/grantAccess";
import { grantBackend } from "@/lib/grants";
import { payoutBatch } from "@/lib/solana/payout";
import { destroyUnreleasedKeys, releaseKey } from "@/lib/vault";
import type { KeyRelease } from "@/lib/types";

// GET /api/keys/[grantId]/[batch]
// Releases a batch key only while the grant is Active and unexpired (FR-5); otherwise 403 and shred.
export async function GET(_req: Request, { params }: { params: Promise<{ grantId: string; batch: string }> }) {
  const { grantId, batch: batchParam } = await params;
  if (!/^\d+$/.test(batchParam)) return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
  const batch = Number(batchParam);

  const backend = grantBackend();
  // TODO(role A): with GRANT_BACKEND=anchor this is one RPC read of the Grant PDA (NFR-2: < 2 s).
  const access = await checkKeyAccess(backend, grantId);
  if (!access.ok) {
    // Unknown grants get a bare 403 too, so the API does not reveal which grant IDs exist.
    if (access.reason === "unknown") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    destroyUnreleasedKeys(grantId);
    return NextResponse.json({ error: "Access revoked by participant", status: access.reason }, { status: 403 });
  }

  const key = releaseKey(grantId, batch);
  if (!key) return NextResponse.json({ error: "No key for this batch" }, { status: 404 });

  if (access.grant.accessType === "single_query") await backend.consumeGrant(grantId);
  // Pays the player for this batch (FR-7). A failed transfer never blocks the key; the next request retries it.
  const payout = await payoutBatch(access.grant, batch).catch(() => null);
  const body: KeyRelease = { grantId, batch, key: key.toString("base64"), payoutSig: payout?.signature };
  return NextResponse.json(body);
}
