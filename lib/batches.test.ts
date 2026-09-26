import { describe, expect, it } from "vitest";
import { planBatches } from "./batches";
import { findBounty } from "./bounties";
import { loadSampleDays } from "./sampleData";

const days = loadSampleDays();
const plan = (bountyId: string, from = days) => {
  const result = planBatches(findBounty(bountyId)!, from);
  if (!result.ok) throw new Error(result.reason);
  return result.plaintexts.map((p) => JSON.parse(p));
};

describe("planBatches", () => {
  it("stream: one batch per day with only the bounty's fields", () => {
    const batches = plan("trinity-sleep");
    expect(batches).toHaveLength(28);
    expect(batches[0]).toEqual({ date: "2026-08-29", sleepHours: 7.5 });
  });

  it("snapshot: one batch with the most recent matching weeks", () => {
    const [rows] = plan("heart-health-ai");
    expect(rows).toHaveLength(14); // Calm Heart in weeks 2 and 4
    expect(rows[0]).toEqual({ date: "2026-09-05", restingHr: 58 });
    expect(rows[13]).toEqual({ date: "2026-09-25", restingHr: 56 });
  });

  it("single query: one aggregate and no raw rows", () => {
    // Marathon Week is week 3 only: 106,100 steps over 7 days.
    expect(plan("active-ireland")).toEqual([{ metric: "mean steps", value: 15157.1, days: 7 }]);
  });

  it("refuses when the player never earned the wanted card", () => {
    expect(planBatches(findBounty("trinity-sleep")!, days.slice(0, 7))).toEqual({ ok: false, reason: "card_not_held" });
  });
});
