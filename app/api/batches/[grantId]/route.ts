import { getVault } from "@/lib/vault";

type Params = { params: Promise<{ grantId: string }> };

/** Encrypted batches available so far. Ciphertext alone is useless without a key from /api/keys. */
export async function GET(_request: Request, { params }: Params) {
  const { grantId } = await params;
  const batches = getVault().listAvailable(grantId, Date.now());
  if (!batches) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ grantId, batches });
}
