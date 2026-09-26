import { describe, expect, it } from "vitest";
import { batchesFor } from "../batches";
import { getBounty } from "../bounties";
import { loadSampleRows } from "../csv";

const rows = loadSampleRows(); // data/sample.csv, 14 days
const bounty = (id: string) => getBounty(id)!;

describe("batchesFor", () => {
  it("reads the sample CSV as typed daily rows", () => {
    expect(rows).toHaveLength(14);
    expect(rows[0]).toMatchObject({ week: 1, day: 1, date: "2026-09-14", sleep_hours: 8.2, steps: 8120 });
  });

  it("gives a 30-day stream one row per daily batch with only the card's fields", () => {
    const batches = batchesFor(bounty("b-trinity-sleep"), rows)!;
    expect(batches).toHaveLength(30);
    expect(batches.every((b) => b.length === 1)).toBe(true);
    expect(batches[0][0]).toEqual({ date: "2026-09-14", sleep_hours: 8.2, deep_sleep_min: 94 });
    expect(batches[14][0]).toEqual(batches[0][0]);
  });

  it("gives a snapshot one batch with the weeks that earned the card", () => {
    const [batch] = batchesFor(bounty("b-heart-health-ai"), rows)!;
    expect(batch).toHaveLength(7); // Calm Heart in week 1 only
    expect(batch[0]).toEqual({ date: "2026-09-14", resting_hr: 58 });
  });

  it("gives a single query only an aggregate of the card's field, never raw rows", () => {
    // Marathon Week is week 2: 109,210 steps over 7 days.
    expect(batchesFor(bounty("b-active-ireland"), rows)).toEqual([[{ mean_steps: 15601.43, days: 7 }]]);
  });

  it("returns null when the card was never earned", () => {
    expect(batchesFor(bounty("b-trinity-sleep"), rows.filter((r) => r.week === 2))).toBeNull();
  });
});
