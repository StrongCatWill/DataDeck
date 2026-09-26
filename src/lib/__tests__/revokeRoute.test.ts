import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnChainGrant } from "../types";

// Stands in for the Anchor/Memo backend: a map of grants "on-chain".
const chain = new Map<string, OnChainGrant>();
vi.mock("@/lib/grants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/grants")>()),
  grantBackend: () => ({ readGrant: async (id: string) => chain.get(id) ?? null }),
}));

const { POST } = await import("@/app/api/revoke/route");
const { erasureLog } = await import("../grants");
const { releaseKey, sealBatches } = await import("../vault");

let n = 0;
function onChain(overrides: Partial<OnChainGrant> = {}): OnChainGrant {
  const grant: OnChainGrant = {
    player: "player-1",
    researcher: "researcher-1",
    grantId: `r${++n}`.padEnd(32, "0"),
    bountyHash: "00",
    accessType: "stream_30d",
    createdAt: 0,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    pricePerDay: 0,
    status: "Revoked",
    auto: false,
    ruleHash: null,
    revokedAt: 1,
    ...overrides,
  };
  chain.set(grant.grantId, grant);
  sealBatches(grant.grantId, [[{ day: 1 }], [{ day: 2 }]]);
  return grant;
}

const post = (body: object) => POST(new Request("http://test/api/revoke", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/revoke with a wallet-signed tx", () => {
  beforeEach(() => chain.clear());

  it("shreds unreleased keys and logs an erasure request with the player's tx", async () => {
    const g = onChain();
    const kept = releaseKey(g.grantId, 0); // already delivered before the revoke
    const res = await post({ player: "player-1", tx: "sig-1", grantIds: [g.grantId] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tx: "sig-1", revoked: [g.grantId], rejected: [], keysDestroyed: 1 });
    expect(releaseKey(g.grantId, 0)).toEqual(kept); // cannot be recalled, and we do not pretend otherwise
    expect(releaseKey(g.grantId, 1)).toBeNull();
    expect(erasureLog.filter((e) => e.grantId === g.grantId)).toEqual([
      expect.objectContaining({ grantId: g.grantId, researcher: "researcher-1", revokeTx: "sig-1" }),
    ]);
  });

  it("logs each grant once when the kill switch is sent twice", async () => {
    const g = onChain();
    await post({ player: "player-1", tx: "sig-a", grantIds: [g.grantId, g.grantId] });
    await post({ player: "player-1", tx: "sig-b", grantIds: [g.grantId] });
    expect(erasureLog.filter((e) => e.grantId === g.grantId)).toHaveLength(1);
  });

  it("does nothing for grants that are still Active on-chain", async () => {
    const g = onChain({ status: "Active", revokedAt: null });
    const res = await post({ player: "player-1", tx: "sig-2", grantIds: [g.grantId] });
    expect(res.status).toBe(403);
    expect((await res.json()).rejected).toEqual([{ grantId: g.grantId, reason: "Not revoked on-chain yet" }]);
    expect(releaseKey(g.grantId, 1)).not.toBeNull();
  });

  it("does nothing for another player's grant or an unknown grant", async () => {
    const other = onChain({ player: "player-2" });
    const res = await post({ player: "player-1", tx: "sig-3", grantIds: [other.grantId, "f".repeat(32)] });
    expect(res.status).toBe(403);
    expect((await res.json()).revoked).toEqual([]);
    expect(releaseKey(other.grantId, 1)).not.toBeNull();
  });

  it("revokes the verified grants and reports the rest", async () => {
    const ok = onChain();
    const active = onChain({ status: "Active", revokedAt: null });
    const res = await post({ player: "player-1", tx: "sig-4", grantIds: [ok.grantId, active.grantId] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toEqual([ok.grantId]);
    expect(body.rejected).toHaveLength(1);
  });

  it.each([{ tx: "sig" }, { grantIds: ["x"] }, { tx: "", grantIds: [] }, { tx: "sig", grantIds: "x" }])(
    "returns 400 for a malformed body %j",
    async (extra) => {
      expect((await post({ player: "player-1", ...extra })).status).toBe(400);
    },
  );
});
