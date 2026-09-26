import type { Bounty, RiskLevel } from "./types";

// Risk label shown next to each request, and the player's tolerance for it.
// Rule-based and deterministic (not AI-generated), so the same request always gets the same label.

const RISK_RANK: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 };
export const RISK_LEVELS = Object.keys(RISK_RANK) as RiskLevel[];

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

/** Retention in months from labels like "12 months" or "None (aggregate)". */
function retentionMonths(retention: string): number {
  const m = retention.match(/(\d+)\s*month/i);
  return m ? Number(m[1]) : 0;
}

export function assessRisk(b: Bounty): RiskAssessment {
  if (!b.verified) return { level: "High", reasons: ["Researcher is not in the verified registry"] };

  const reasons: string[] = [];
  if (b.orgType === "commercial") reasons.push("Commercial buyer");
  if (!b.ethicsRef) reasons.push("No ethics approval reference");
  if (retentionMonths(b.retention) > 12) reasons.push(`Keeps decrypted data for ${b.retention}`);
  if (reasons.length > 0) return { level: "Medium", reasons };

  return { level: "Low", reasons: ["Verified non-profit study with ethics approval"] };
}

export const isRiskLevel = (v: unknown): v is RiskLevel => typeof v === "string" && v in RISK_RANK;

/** True when the request's risk is at or below the player's tolerance. */
export const withinTolerance = (level: RiskLevel, tolerance: RiskLevel) => RISK_RANK[level] <= RISK_RANK[tolerance];
