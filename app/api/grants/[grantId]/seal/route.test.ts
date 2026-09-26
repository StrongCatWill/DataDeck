import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getMockGrantService } from "@/lib/grants";
import type { Grant } from "@/lib/types";
import { decrypt, getVault } from "@/lib/vault";
import { POST } from "./route";

function mockGrant(patch: Partial<Grant> = {}): string {
  const grant: Grant = {
    grantId: randomBytes(16).toString("hex"),
    status: "active",
    accessType: "stream30d",
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    pricePerDay: 600_000,
    ...patch,
  };
  getMockGrantService().createGrant(grant);
  return grant.grantId;
}
const seal = (grantId: string, body: unknown = { bountyId: "trinity-sleep" }) =>
  POST(new Request("http://test", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ grantId }) });

describe("POST /api/grants/[grantId]/seal", () => {
  it("seals only the bounty's fields for an active grant", async () => {
    const grantId = mockGrant();
    const res = await seal(grantId);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ grantId, batchCount: 28 });

    const now = Date.now();
    const [first] = getVault().listAvailable(grantId, now)!;
    expect(JSON.parse(decrypt(first, getVault().getKey(grantId, 0, now)!))).toEqual({ date: "2026-08-29", sleepHours: 7.5 });
  });

  it("is a no-op when repeated, so keys are not replaced", async () => {
    const grantId = mockGrant();
    await seal(grantId);
    const key = getVault().getKey(grantId, 0, Date.now());
    expect(await (await seal(grantId)).json()).toEqual({ grantId, alreadySealed: true });
    expect(getVault().getKey(grantId, 0, Date.now())).toBe(key);
  });

  it("refuses grants that are unknown, revoked or expired", async () => {
    expect((await seal("0".repeat(32))).status).toBe(403);
    expect((await seal(mockGrant({ status: "revoked" }))).status).toBe(403);
    expect((await seal(mockGrant({ expiresAt: 1 }))).status).toBe(403);
  });

  it("refuses a grant whose access type differs from the bounty's", async () => {
    expect((await seal(mockGrant({ accessType: "snapshot24h" }))).status).toBe(409);
  });

  it("validates the grant ID and bounty", async () => {
    expect((await seal("not-hex")).status).toBe(400);
    expect((await seal(mockGrant(), { bountyId: "nope" })).status).toBe(404);
  });
});
