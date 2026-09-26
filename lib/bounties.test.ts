import { describe, expect, it } from "vitest";
import { BOUNTIES, formatPrice, fullNotice } from "./bounties";
import { findBannedCopy } from "./copy";

describe("bounties", () => {
  it("full notices contain no banned wording", () => {
    for (const bounty of BOUNTIES) expect(findBannedCopy(fullNotice(bounty))).toBeNull();
  });

  it("full notice states access window, retention, price and ethics ref", () => {
    const notice = fullNotice(BOUNTIES[0]);
    expect(notice).toContain("30 days, one batch per day");
    expect(notice).toContain("12 months");
    expect(notice).toContain("0.60 USDC per day of data");
    expect(notice).toContain("Ethics approval: demo");
  });

  it("commercial bounties are manual only", () => {
    for (const b of BOUNTIES.filter((b) => b.orgType === "commercial")) expect(b.manualOnly).toBe(true);
  });

  it("formats one-off prices", () => {
    expect(formatPrice({ amount: 3_000_000, per: "once" })).toBe("3.00 USDC once");
  });
});

describe("findBannedCopy", () => {
  it.each(["We sell data", "Selling is easy", "fully anonymised", "Anonymous", "deleted forever"])("flags %j", (text) => {
    expect(findBannedCopy(text)).not.toBeNull();
  });

  it("allows the approved wording", () => {
    expect(findBannedCopy("You lend pseudonymised data and can stop sharing at any time.")).toBeNull();
  });
});
