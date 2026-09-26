import { NextResponse } from "next/server";
import { effectiveStatus, grantBackend } from "@/lib/grants";
import { destroyUnreleasedKeys, releaseKey } from "@/lib/vault";
import type { KeyRelease } from "@/lib/types";

// GET /api/keys/[grantId]/[batch]
// Releases a batch key only while the grant is Active and unexpired (FR-5); otherwise 403 and shred.
export async function GET(_req: Request, { params }: { params: Promise<{ grantId: string; batch: string }> }) {
  const { grantId, batch } = await params;
  const backend = grantBackend();
  // TODO(role A): with GRANT_BACKEND=anchor this is one RPC read of the Grant PDA (NFR-2: < 2 s).
  const grant = await backend.readGrant(grantId);
  if (!grant) return NextResponse.json({ error: "Unknown grant" }, { status: 404 });

  const status = effectiveStatus(grant);
  if (status !== "Active") {
    destroyUnreleasedKeys(grantId);
    return NextResponse.json({ error: "Access revoked by participant", status }, { status: 403 });
  }

  const key = releaseKey(grantId, Number(batch));
  if (!key) return NextResponse.json({ error: "No key for this batch" }, { status: 404 });

  if (grant.accessType === "single_query") await backend.consumeGrant(grantId);
  // TODO(role A): for stream batches, send price_per_day devnet USDC from the researcher wallet to the player.
  const body: KeyRelease = { grantId, batch: Number(batch), key: key.toString("base64") };
  return NextResponse.json(body);
}
