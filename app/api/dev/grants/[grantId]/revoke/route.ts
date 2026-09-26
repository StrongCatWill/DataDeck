import { devRoutesDisabled, devRoutesEnabled } from "@/lib/devRoutes";
import { getMockGrantService } from "@/lib/grants";
import { getVault } from "@/lib/vault";

type Params = { params: Promise<{ grantId: string }> };

/** Mock kill switch: revokes the grant and destroys every key still held for it. */
export async function POST(_request: Request, { params }: Params) {
  if (!devRoutesEnabled()) return devRoutesDisabled();

  const { grantId } = await params;
  const service = getMockGrantService();
  if (!(await service.getGrant(grantId))) return Response.json({ error: "not_found" }, { status: 404 });

  service.revokeGrant(grantId);
  getVault().destroyKeys(grantId);
  return Response.json({ grantId, status: "revoked" });
}
