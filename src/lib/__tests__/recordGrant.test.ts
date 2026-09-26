import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnChainGrant } from "../types";

// Stands in for the Anchor/Memo backend: a map of grants "on-chain".
const chain = new Map<string, OnChainGrant>();
vi.mock("@/lib/grants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/grants")>()),
  grantBackend: () => ({ readGrant: async (id: string) => chain.get(id) ?? null }),
}));

const { POST } = await import("@/app/api/grants/route");
const { getBatches } = await import("../vault");
const { grantContext } = await import("../solana/grantIndex");

const now = () => Math.floor(Date.now() / 1000);
let n = 0;

// b-trinity-sleep: 30-day stream at 0.5 USDC/day in the sample bounties.
function onChain(overrides: Partial<OnChainGrant> = {}): OnChainGrant {
  const grant: OnChainGrant = {
    player: "player-1",
    researcher: "researcher-1",
    grantId: `g${++n}`.padEnd(32, "0"),
    bountyHash: "00",
    accessType: "stream_30d",
    createdAt: now(),
    expiresAt: now() + 300,
    pricePerDay: 0,
    status: "Active",
    auto: false,
    ruleHash: null,
    revokedAt: null,
    ...overrides,
  };
  chain.set(grant.grantId, grant);
  return grant;
}

const post = (body: object) => POST(new Request("http://test/api/grants", { method: "POST", body: JSON.stringify(body) }));
const record = (grantId: string, player = "player-1") => post({ player, bountyId: "b-trinity-sleep", cardId: "card-1", grantId });

describe("POST /api/grants with a wallet-signed grantId", async () => {
  const { getBounty } = await import("../bounties");
  const price = Math.round(getBounty("b-trinity-sleep")!.priceUsdc * 1_000_000);
  beforeEach(() => chain.clear());

  it("verifies the on-chain grant, remembers its context and seals 30 daily batches", async () => {
    const g = onChain({ pricePerDay: price });
    const res = await record(g.grantId);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ grantId: g.grantId, bountyId: "b-trinity-sleep", cardId: "card-1" });
    expect(getBatches(g.grantId)).toHaveLength(30);
    expect(grantContext(g.grantId)).toEqual({ player: "player-1", bountyId: "b-trinity-sleep", cardId: "card-1" });
  });

  it("refuses to record the same grant twice, so revoked keys are never re-created", async () => {
    const g = onChain({ pricePerDay: price });
    expect((await record(g.grantId)).status).toBe(201);
    expect((await record(g.grantId)).status).toBe(409);
  });

  it("returns 404 while the grant is not on-chain yet", async () => {
    expect((await record("f".repeat(32))).status).toBe(404);
  });

  it.each([
    ["another player's grant", { player: "someone-else" }],
    ["a revoked grant", { status: "Revoked" as const }],
    ["an expired grant", { expiresAt: now() - 1 }],
    ["a different access type", { accessType: "snapshot_24h" as const }],
    ["a different price", { pricePerDay: 1 }],
  ])("returns 403 for %s and seals nothing", async (_label, overrides) => {
    const g = onChain({ pricePerDay: price, ...overrides });
    expect((await record(g.grantId)).status).toBe(403);
    expect(getBatches(g.grantId)).toEqual([]);
  });
});
