import { describe, expect, it } from "vitest";
import { checkKeyAccess, type GrantReader } from "../grantAccess";
import type { GrantStatus, GrantView } from "../types";

const NOW = 1_800_000_000;

function grant(status: GrantStatus, expiresAt: number): GrantView {
  return {
    player: "player-1",
    researcher: "researcher-1",
    grantId: "g1",
    bountyHash: "00",
    accessType: "stream_30d",
    createdAt: NOW - 100,
    expiresAt,
    pricePerDay: 0,
    status,
    auto: false,
    ruleHash: null,
    revokedAt: null,
    bountyId: "b1",
    cardId: "c1",
  };
}

// A stub reader, like a Mockito mock of the repository.
const readerOf = (g: GrantView | null): GrantReader => ({ readGrant: async () => g });

describe("checkKeyAccess", () => {
  it("allows an Active, unexpired grant", async () => {
    const g = grant("Active", NOW + 60);
    expect(await checkKeyAccess(readerOf(g), "g1", NOW)).toEqual({ ok: true, grant: g });
  });

  it("refuses an Active grant at or past expiresAt", async () => {
    expect(await checkKeyAccess(readerOf(grant("Active", NOW)), "g1", NOW)).toEqual({ ok: false, reason: "Expired" });
    expect(await checkKeyAccess(readerOf(grant("Active", NOW - 1)), "g1", NOW)).toEqual({ ok: false, reason: "Expired" });
  });

  it.each(["Revoked", "Consumed"] as const)("refuses a %s grant even before expiry", async (status) => {
    expect(await checkKeyAccess(readerOf(grant(status, NOW + 60)), "g1", NOW)).toEqual({ ok: false, reason: status });
  });

  it("refuses an unknown grant", async () => {
    expect(await checkKeyAccess(readerOf(null), "missing", NOW)).toEqual({ ok: false, reason: "unknown" });
  });
});
