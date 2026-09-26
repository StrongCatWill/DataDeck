import type { Grant } from "@/lib/types";
import type { GrantService } from "./GrantService";

/** In-memory grants for building and testing without Solana. */
export class MockGrantService implements GrantService {
  private grants = new Map<string, Grant>();

  async getGrant(grantId: string): Promise<Grant | null> {
    const grant = this.grants.get(grantId);
    return grant ? { ...grant } : null;
  }

  createGrant(grant: Grant): void {
    this.grants.set(grant.grantId, { ...grant });
  }

  revokeGrant(grantId: string): void {
    const grant = this.grants.get(grantId);
    if (grant) grant.status = "revoked";
  }
}
