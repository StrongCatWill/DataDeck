import type { Grant } from "@/lib/types";

/** Read-only view of grant state. Implemented by the mock now, Anchor or Memo later. */
export interface GrantService {
  /** Returns null when no grant with this ID exists. */
  getGrant(grantId: string): Promise<Grant | null>;
}
