import { describe, expect, it } from "vitest";
import { findBounty, type Bounty } from "./bounties";
import { DEMO_RULE, matchBounty, validateRuleset, type Ruleset } from "./rules";

const today = "2026-09-26";
const trinity = findBounty("trinity-sleep")!;
const rule = (match: Partial<Ruleset["match"]> = {}, patch: Partial<Ruleset> = {}): Ruleset => ({
  ...DEMO_RULE,
  ...patch,
  match: { ...DEMO_RULE.match, ...match },
});
const reason = (r: Ruleset, b: Bounty = trinity, day = today) => {
  const d = matchBounty(r, b, day);
  return d.ok ? "ok" : d.reason;
};

describe("validateRuleset", () => {
  it("accepts the demo rule", () => {
    expect(validateRuleset(DEMO_RULE)).toEqual([]);
  });

  it("caps a rule at 90 days", () => {
    expect(validateRuleset(rule({}, { expiresAt: "2026-12-25" }))).toEqual([]);
    expect(validateRuleset(rule({}, { expiresAt: "2026-12-26" }))).toEqual(["A rule can last at most 90 days."]);
  });

  it("rejects commercial buyers, non-pseudonymised data and empty card lists", () => {
    const bad = rule({ orgType: "commercial" as never, dataForm: "raw" as never, cardTypes: [] });
    expect(validateRuleset(bad)).toHaveLength(3);
  });

  it("rejects a rule that ends before it starts", () => {
    expect(validateRuleset(rule({}, { expiresAt: "2026-09-01" }))).toContain("The rule must expire after it is created.");
  });
});

describe("matchBounty", () => {
  it("auto-accepts Trinity Sleep Lab under the demo rule", () => {
    expect(reason(DEMO_RULE)).toBe("ok");
  });

  it("never auto-accepts the commercial Heart Health AI bounty", () => {
    expect(reason(rule({ cardTypes: ["Calm Heart"] }), findBounty("heart-health-ai")!)).toBe("manual_only");
  });

  it("requires a verified researcher and an ethics approval", () => {
    expect(reason(DEMO_RULE, { ...trinity, researcher: "Unknown Lab" })).toBe("not_verified");
    expect(reason(DEMO_RULE, { ...trinity, ethicsRef: null })).toBe("no_ethics_approval");
    expect(reason(rule({ orgType: "non_profit", cardTypes: ["Marathon Week"] }), findBounty("active-ireland")!)).toBe(
      "no_ethics_approval",
    );
  });

  it("stops matching after the rule expires", () => {
    expect(reason(DEMO_RULE, trinity, "2026-12-24")).toBe("ok");
    expect(reason(DEMO_RULE, trinity, "2026-12-25")).toBe("rule_expired");
  });

  it("checks org type, card, access length and price", () => {
    expect(reason(rule({ orgType: "non_profit" }))).toBe("org_type_mismatch");
    expect(reason(rule({ cardTypes: ["Early Bird"] }))).toBe("card_not_in_rule");
    expect(reason(rule({ maxAccess: "snapshot24h" }))).toBe("access_exceeds_rule");
    expect(reason(rule({ minPricePerDay: 600_001 }))).toBe("price_too_low");
    expect(reason(rule({ minPricePerDay: 600_000 }))).toBe("ok");
  });

  it("refuses under an invalid rule", () => {
    expect(reason(rule({}, { expiresAt: "2027-06-01" }))).toBe("invalid_rule");
  });
});
