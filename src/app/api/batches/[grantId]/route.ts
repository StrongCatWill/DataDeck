import { NextResponse } from "next/server";
import { grantBackend } from "@/lib/grants";
import { DEMO_DAY_SECONDS } from "@/lib/types";
import { getBatches } from "@/lib/vault";

// GET /api/batches/[grantId] -> ciphertexts delivered so far. Ciphertext alone is useless without a key.
export async function GET(_req: Request, { params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  const grant = await grantBackend().readGrant(grantId);
  if (!grant) return NextResponse.json({ error: "Unknown grant" }, { status: 404 });

  const all = getBatches(grantId);
  if (grant.accessType !== "stream_30d") return NextResponse.json(all);
  // Streams deliver one batch per demo day.
  const elapsedDays = Math.floor((Date.now() / 1000 - grant.createdAt) / DEMO_DAY_SECONDS) + 1;
  return NextResponse.json(all.slice(0, elapsedDays));
}
