import type { AccessType, Bounty, Ruleset } from "./types";

// Guardrails baked into the rules engine; the player cannot edit these.
export const MAX_RULE_DAYS = 90;
const ACCESS_RANK: Record<AccessType, number> = { single_query: 0, snapshot_24h: 1, stream_30d: 2 };
export const MAX_RULE_ACCESS: AccessType = "stream_30d";

export function validateRuleset(r: Ruleset, now = new Date()): string[] {
  const errors: string[] = [];
  const days = (new Date(r.expiresAt).getTime() - now.getTime()) / 86_400_000;
  if (days > MAX_RULE_DAYS) errors.push(`A ruleset can last at most ${MAX_RULE_DAYS} days.`);
  if (ACCESS_RANK[r.match.maxAccess] > ACCESS_RANK[MAX_RULE_ACCESS]) errors.push("Longest access a rule can grant is a 30-day stream.");
  if ((r.match.orgType as string) === "commercial") errors.push("Commercial buyers can never be auto-accepted.");
  if (r.match.dataForm !== "pseudonymised") errors.push('Data form must be "pseudonymised".');
  return errors;
}

/** Returns true only if the bounty passes the fixed guardrails AND the player's rule. */
export function matches(rule: Ruleset, bounty: Bounty, now = new Date()): boolean {
  // Fixed guardrails
  if (bounty.orgType === "commercial") return false;
  if (!bounty.verified || !bounty.ethicsRef) return false;
  if (new Date(rule.expiresAt) < now) return false;
  // Player's rule
  const m = rule.match;
  return (
    bounty.orgType === m.orgType &&
    m.cardTypes.includes(bounty.cardWanted) &&
    ACCESS_RANK[bounty.accessType] <= ACCESS_RANK[m.maxAccess] &&
    bounty.priceUnit === "per_day" &&
    bounty.priceUsdc >= m.minPricePerDayUsdc
  );
}

export const DEMO_RULE: Ruleset = {
  ruleId: "r-01",
  label: "Non-profit university sleep studies",
  match: {
    orgType: "non_profit_university",
    requiresEthicsApproval: true,
    cardTypes: ["Deep Sleeper", "Early Bird"],
    dataForm: "pseudonymised",
    minPricePerDayUsdc: 0.5,
    maxAccess: "stream_30d",
  },
  expiresAt: "2026-12-24",
  notify: "after_each_accept",
};
