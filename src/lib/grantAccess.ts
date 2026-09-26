import { effectiveStatus } from "./grants";
import type { GrantStatus, GrantView } from "./types";

// Grant validation seam for the key API. The only thing the key API needs from a grant backend is a
// read; the mock, Anchor and Memo backends all satisfy GrantReader, so swapping one for another
// never touches the key API.
export interface GrantReader {
  readGrant(grantId: string): Promise<GrantView | null>;
}

export type AccessDecision =
  | { ok: true; grant: GrantView }
  | { ok: false; reason: "unknown" | Exclude<GrantStatus, "Active"> };

/** May a key for this grant be released right now? Active and unexpired only (FR-5). */
export async function checkKeyAccess(
  reader: GrantReader,
  grantId: string,
  now = Math.floor(Date.now() / 1000),
): Promise<AccessDecision> {
  const grant = await reader.readGrant(grantId);
  if (!grant) return { ok: false, reason: "unknown" };
  const status = effectiveStatus(grant, now);
  if (status !== "Active") return { ok: false, reason: status };
  return { ok: true, grant };
}
