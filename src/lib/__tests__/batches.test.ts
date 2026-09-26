import { describe, expect, it } from "vitest";
import { batchesFor } from "../batches";
import { loadSampleRows } from "../csv";

const rows = loadSampleRows(); // data/sample.csv, 14 days

describe("batchesFor", () => {
  it("reads the sample CSV as typed daily rows", () => {
    expect(rows).toHaveLength(14);
    expect(rows[0]).toMatchObject({ week: 1, day: 1, date: "2026-09-14", sleep_hours: 7.6, steps: 8120 });
  });

  it("gives a 30-day stream one row per daily batch, repeating the sample", () => {
    const batches = batchesFor("stream_30d", rows);
    expect(batches).toHaveLength(30);
    expect(batches.every((b) => b.length === 1)).toBe(true);
    expect(batches[0][0]).toEqual(rows[0]);
    expect(batches[14][0]).toEqual(rows[0]);
  });

  it("gives a snapshot one batch with every row", () => {
    expect(batchesFor("snapshot_24h", rows)).toEqual([rows]);
  });

  it("gives a single query only an aggregate, never raw rows", () => {
    const batches = batchesFor("single_query", rows);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([{ mean_sleep_hours: 7.52 }]);
  });
});
