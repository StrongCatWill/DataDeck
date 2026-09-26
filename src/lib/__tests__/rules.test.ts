import { beforeEach, describe, expect, it } from "vitest";
import { getBounty } from "../bounties";
import { DEMO_RULE, matches, ruleHash, validateRuleset } from "../rules";
import type { Ruleset } from "../types";

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const rule = (overrides: Partial<Ruleset> = {}, match: Partial<Ruleset["match"]> = {}): Ruleset => ({
  ...DEMO_RULE,
  expiresAt: days(30),
  ...overrides,
  match: { ...DEMO_RULE.match, ...match },
});

const trinity = getBounty("b-trinity-sleep")!;
const heartAi = getBounty("b-heart-health-ai")!;

describe("guardrails", () => {
  it("accepts the guide's demo rule shape", () => {
    expect(validateRuleset(rule())).toEqual([]);
  });

  it("rejects rules longer than 90 days, past expiry, commercial buyers and empty card lists", () => {
    expect(validateRuleset(rule({ expiresAt: days(120) }))).toHaveLength(1);
    expect(validateRuleset(rule({ expiresAt: days(-1) }))).toHaveLength(1);
    expect(validateRuleset(rule({}, { orgType: "commercial" as never }))).toHaveLength(1);
    expect(validateRuleset(rule({}, { cardTypes: [] }))).toHaveLength(1);
  });
});

describe("matches", () => {
  it("auto-accepts Trinity Sleep Lab under the demo rule", () => {
    expect(matches(rule(), trinity)).toBe(true);
  });

  it("never matches a commercial buyer, even with a rule that names it", () => {
    expect(matches(rule({}, { orgType: "commercial" as never, cardTypes: ["Calm Heart"], maxAccess: "snapshot_24h" }), heartAi)).toBe(false);
  });

  it("needs a verified researcher with an ethics reference", () => {
    expect(matches(rule(), { ...trinity, verified: false })).toBe(false);
    expect(matches(rule(), { ...trinity, ethicsRef: null })).toBe(false);
  });

  it("respects the player's price floor, card list and a rule that breaks a guardrail", () => {
    expect(matches(rule({}, { minPricePerDayUsdc: 1 }), trinity)).toBe(false);
    expect(matches(rule({}, { cardTypes: ["Early Bird"] }), trinity)).toBe(false);
    expect(matches(rule({ expiresAt: days(120) }), trinity)).toBe(false);
  });
});

describe("auto-accept routes (mock backend)", async () => {
  const rules = await import("@/app/api/rules/route");
  const auto = await import("@/app/api/auto-accept/route");
  const { getBatches } = await import("../vault");
  const { grantBackend } = await import("../grants");

  const json = (body: object) => ({ method: "POST", body: JSON.stringify(body) });
  const saveRule = (player: string, r: Ruleset) => rules.POST(new Request("http://test/api/rules", json({ player, ruleset: r })));
  const postBounty = (bountyId: string) => auto.POST(new Request("http://test/api/auto-accept", json({ bountyId })));

  let n = 0;
  let player = "";
  beforeEach(() => void (player = `rules-player-${++n}`));

  it("rejects a ruleset that breaks a guardrail with the reasons", async () => {
    const res = await saveRule(player, rule({ expiresAt: days(120) }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toHaveLength(1);
  });

  it("opens a delegate grant for a matching bounty, seals its batches and notifies the player", async () => {
    const r = rule();
    const saved = await saveRule(player, r);
    expect(saved.status).toBe(201);
    expect((await saved.json()).register).toMatchObject({ delegate: "mock-delegate", ruleHash: ruleHash(r) });

    const { results } = await (await postBounty("b-trinity-sleep")).json();
    const mine = results.find((x: { player: string }) => x.player === player);
    expect(mine.status).toBe("accepted");

    const grant = await grantBackend().readGrant(mine.notice.grantId);
    expect(grant).toMatchObject({ player, auto: true, ruleHash: ruleHash(r), accessType: "stream_30d" });
    expect(getBatches(mine.notice.grantId)).toHaveLength(30);

    const { notices } = await (await rules.GET(new Request(`http://test/api/rules?player=${player}`))).json();
    expect(notices).toEqual([expect.objectContaining({ study: "Trinity Sleep Lab", grantId: mine.notice.grantId })]);
  });

  it("does not open a second grant when the same bounty is posted again", async () => {
    await saveRule(player, rule());
    await postBounty("b-trinity-sleep");
    const { results } = await (await postBounty("b-trinity-sleep")).json();
    expect(results.find((x: { player: string }) => x.player === player)).toBeUndefined();
  });

  it("stops auto-accepting after the player turns rules off", async () => {
    await saveRule(player, rule());
    await rules.DELETE(new Request(`http://test/api/rules?player=${player}`, { method: "DELETE" }));
    const { results } = await (await postBounty("b-trinity-sleep")).json();
    expect(results.find((x: { player: string }) => x.player === player)).toBeUndefined();
  });

  it("never auto-accepts the commercial bounty", async () => {
    await saveRule(player, rule({}, { cardTypes: ["Calm Heart", "Deep Sleeper"] }));
    const { results } = await (await postBounty("b-heart-health-ai")).json();
    expect(results).toEqual([]);
  });
});
