import { sha256Hex } from "./hash";
import { assessRisk, isRiskLevel, withinTolerance } from "./risk";
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
  if (r.match.requiresEthicsApproval !== true) errors.push("Rules only match studies with an ethics approval reference.");
  if (r.match.maxRisk !== undefined && !isRiskLevel(r.match.maxRisk)) errors.push("Risk tolerance must be Low, Medium or High.");
  if (r.match.cardTypes.length === 0) errors.push("Pick at least one card type.");
  if (Number.isNaN(new Date(r.expiresAt).getTime()) || new Date(r.expiresAt) <= now) errors.push("Expiry must be a future date.");
  return errors;
}

/** Returns true only if the bounty passes the fixed guardrails AND the player's rule. */
export function matches(rule: Ruleset, bounty: Bounty, now = new Date()): boolean {
  // Fixed guardrails
  if (validateRuleset(rule, now).length > 0) return false;
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
    bounty.priceUsdc >= m.minPricePerDayUsdc &&
    (m.maxRisk === undefined || withinTolerance(assessRisk(bounty).level, m.maxRisk))
  );
}

/** What goes on-chain (RuleDelegate.rule_hash or the dd:rules memo) so a grant can prove which rule created it. */
export const ruleHash = (rule: Ruleset) => sha256Hex(JSON.stringify(rule));

/** Rule expiry as unix seconds, for set_rule_delegate / dd:rules. */
export const ruleExpiresAt = (rule: Ruleset) => Math.floor(new Date(rule.expiresAt).getTime() / 1000);

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
