import type { Grant } from "@/lib/types";

export type AccessDecision =
  | { ok: true }
  | { ok: false; reason: "not_found" | "revoked" | "consumed" | "expired" };

/** A key may be released only while the grant exists, is active and has not expired. */
export function canRelease(grant: Grant | null, nowSec: number): AccessDecision {
  if (!grant) return { ok: false, reason: "not_found" };
  if (grant.status !== "active") return { ok: false, reason: grant.status };
  if (nowSec >= grant.expiresAt) return { ok: false, reason: "expired" };
  return { ok: true };
}
