// Auto-accept rulesets (FR-9). Pure decisions only; signing create_grant with the rule delegate is the
// Solana side. The guardrails below are fixed and not editable by the player (v2 guide, "Auto-accept rulesets").
import type { Bounty, OrgType } from "./bounties";
import type { CardName } from "./cards";
import type { AccessType } from "./types";

export interface Ruleset {
  ruleId: string;
  label: string;
  match: {
    orgType: Exclude<OrgType, "commercial">;
    cardTypes: CardName[];
    dataForm: "pseudonymised";
    /** Devnet USDC base units; one-off bounties must pay at least this once. */
    minPricePerDay: number;
    maxAccess: AccessType;
  };
  /** YYYY-MM-DD */
  createdAt: string;
  /** YYYY-MM-DD, at most 90 days after createdAt. */
  expiresAt: string;
  notify: "after_each_accept";
}

/** Researchers in the verified registry. Demo list; production would use a maintained registry. */
export const VERIFIED_RESEARCHERS = new Set(["Trinity Sleep Lab", "Active Ireland study"]);

export const MAX_RULE_DAYS = 90;

/** Shortest to longest; a 30-day stream is the longest access any rule can grant. */
const ACCESS_RANK: Record<AccessType, number> = { singleQuery: 0, snapshot24h: 1, stream30d: 2 };

const DAY_MS = 86_400_000;
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS;

/** Guardrail problems with a ruleset as written; empty when it may be saved. */
export function validateRuleset(rule: Ruleset): string[] {
  const problems: string[] = [];
  if ((rule.match.orgType as OrgType) === "commercial") problems.push("Commercial buyers can never be auto-accepted.");
  if (rule.match.dataForm !== "pseudonymised") problems.push('Data form must be "pseudonymised".');
  if (!(rule.match.maxAccess in ACCESS_RANK)) problems.push("Unknown access type.");
  if (rule.match.cardTypes.length === 0) problems.push("Pick at least one card.");
  const length = days(rule.createdAt, rule.expiresAt);
  if (!(length > 0)) problems.push("The rule must expire after it is created.");
  if (length > MAX_RULE_DAYS) problems.push(`A rule can last at most ${MAX_RULE_DAYS} days.`);
  return problems;
}

export type MatchDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_rule"
        | "rule_expired"
        | "manual_only"
        | "not_verified"
        | "no_ethics_approval"
        | "org_type_mismatch"
        | "card_not_in_rule"
        | "access_exceeds_rule"
        | "price_too_low";
    };

/** Whether a bounty may be auto-accepted under a rule on the given day (YYYY-MM-DD). */
export function matchBounty(rule: Ruleset, bounty: Bounty, today: string): MatchDecision {
  if (validateRuleset(rule).length > 0) return { ok: false, reason: "invalid_rule" };
  if (today > rule.expiresAt) return { ok: false, reason: "rule_expired" };
  if (bounty.manualOnly || bounty.orgType === "commercial") return { ok: false, reason: "manual_only" };
  if (!VERIFIED_RESEARCHERS.has(bounty.researcher)) return { ok: false, reason: "not_verified" };
  if (!bounty.ethicsRef) return { ok: false, reason: "no_ethics_approval" };
  if (bounty.orgType !== rule.match.orgType) return { ok: false, reason: "org_type_mismatch" };
  if (!rule.match.cardTypes.includes(bounty.cardWanted)) return { ok: false, reason: "card_not_in_rule" };
  if (ACCESS_RANK[bounty.accessType] > ACCESS_RANK[rule.match.maxAccess]) {
    return { ok: false, reason: "access_exceeds_rule" };
  }
  if (bounty.price.amount < rule.match.minPricePerDay) return { ok: false, reason: "price_too_low" };
  return { ok: true };
}

/** The demo rule from the v2 guide: non-profit university sleep studies at 0.50 USDC/day or more. */
export const DEMO_RULE: Ruleset = {
  ruleId: "r-01",
  label: "Non-profit university sleep studies",
  match: {
    orgType: "non_profit_university",
    cardTypes: ["Deep Sleeper", "Early Bird"],
    dataForm: "pseudonymised",
    minPricePerDay: 500_000,
    maxAccess: "stream30d",
  },
  createdAt: "2026-09-26",
  expiresAt: "2026-12-24",
  notify: "after_each_accept",
};
