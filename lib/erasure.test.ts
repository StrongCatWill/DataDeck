import { describe, expect, it } from "vitest";
import { findBannedCopy } from "./copy";
import { ErasureLog } from "./erasure";

describe("ErasureLog", () => {
  it("logs one request per grant and keeps the first", () => {
    const log = new ErasureLog();
    const first = log.request("g1", null, Date.UTC(2026, 8, 26, 12));
    expect(first).toMatchObject({ grantId: "g1", revokeTx: null, requestedAt: "2026-09-26T12:00:00.000Z" });
    expect(log.request("g1", "later-tx", Date.UTC(2026, 8, 27))).toBe(first);
  });

  it("returns null for grants without a request", () => {
    expect(new ErasureLog().get("g1")).toBeNull();
  });

  it("uses no banned wording", () => {
    expect(findBannedCopy(new ErasureLog().request("g1", null, 0).message)).toBeNull();
  });
});
