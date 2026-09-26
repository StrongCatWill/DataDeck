import { describe, expect, it } from "vitest";
import { canRelease } from "./access";
import type { Grant } from "./types";

const now = 1_800_000_000;
const grant: Grant = {
  grantId: "7f3a0000000000000000000000000001",
  status: "active",
  accessType: "stream30d",
  expiresAt: now + 300,
  pricePerDay: 600_000,
};

describe("canRelease", () => {
  it("allows an active, unexpired grant", () => {
    expect(canRelease(grant, now)).toEqual({ ok: true });
  });

  it("refuses a missing grant", () => {
    expect(canRelease(null, now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses a revoked grant", () => {
    expect(canRelease({ ...grant, status: "revoked" }, now)).toEqual({ ok: false, reason: "revoked" });
  });

  it("refuses a consumed grant", () => {
    expect(canRelease({ ...grant, status: "consumed" }, now)).toEqual({ ok: false, reason: "consumed" });
  });

  it("refuses at and after expiry", () => {
    expect(canRelease(grant, grant.expiresAt)).toEqual({ ok: false, reason: "expired" });
    expect(canRelease(grant, grant.expiresAt + 1)).toEqual({ ok: false, reason: "expired" });
  });
});
