import { describe, expect, it } from "vitest";
import { GET as getBounties } from "@/app/api/bounties/route";
import { getBounty } from "../bounties";
import { DEMO_RULE, matches, validateRuleset } from "../rules";
import { assessRisk, withinTolerance } from "../risk";
import type { Bounty, RiskLevel, Ruleset } from "../types";

const trinity = getBounty("b-trinity-sleep")!;
const heartAi = getBounty("b-heart-health-ai")!;
const withTolerance = (maxRisk: RiskLevel): Ruleset => ({ ...DEMO_RULE, match: { ...DEMO_RULE.match, maxRisk } });

describe("assessRisk", () => {
  it("labels a verified non-profit study with ethics approval Low", () => {
    expect(assessRisk(trinity).level).toBe("Low");
  });

  it("labels a commercial buyer Medium and says why", () => {
    expect(assessRisk(heartAi)).toEqual({ level: "Medium", reasons: ["Commercial buyer", "No ethics approval reference"] });
  });

  it("labels an unverified researcher High", () => {
    expect(assessRisk({ ...trinity, verified: false } as Bounty).level).toBe("High");
  });

  it("labels retention over 12 months Medium", () => {
    expect(assessRisk({ ...trinity, retention: "24 months" }).level).toBe("Medium");
  });
});

describe("risk tolerance", () => {
  it("compares levels Low < Medium < High", () => {
    expect(withinTolerance("Low", "Low")).toBe(true);
    expect(withinTolerance("Medium", "Low")).toBe(false);
    expect(withinTolerance("Medium", "High")).toBe(true);
  });

  it("auto-accept skips a request above the rule's tolerance", () => {
    const longRetention = { ...trinity, retention: "24 months" }; // Medium
    expect(matches(withTolerance("Medium"), longRetention)).toBe(true);
    expect(matches(withTolerance("Low"), longRetention)).toBe(false);
    expect(matches(DEMO_RULE, longRetention)).toBe(true); // no tolerance set: unchanged behaviour
  });

  it("rejects an invalid tolerance in a ruleset", () => {
    expect(validateRuleset(withTolerance("Extreme" as RiskLevel), new Date("2026-10-01"))).toContain(
      "Risk tolerance must be Low, Medium or High.",
    );
  });

  it("GET /api/bounties?tolerance=Low marks only Low requests as within tolerance", async () => {
    const { bounties } = await (await getBounties(new Request("http://test/api/bounties?tolerance=Low"))).json();
    const byId = Object.fromEntries(bounties.map((b: { id: string }) => [b.id, b]));
    expect(byId["b-trinity-sleep"]).toMatchObject({ risk: { level: "Low" }, withinTolerance: true });
    expect(byId["b-heart-health-ai"]).toMatchObject({ risk: { level: "Medium" }, withinTolerance: false });
  });

  it("GET /api/bounties rejects an unknown tolerance", async () => {
    expect((await getBounties(new Request("http://test/api/bounties?tolerance=Zero"))).status).toBe(400);
  });
});
