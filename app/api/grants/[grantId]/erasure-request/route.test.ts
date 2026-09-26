import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getMockGrantService } from "@/lib/grants";
import { getVault } from "@/lib/vault";
import { GET, POST } from "./route";

function mockGrant(status: "active" | "revoked"): string {
  const grantId = randomBytes(16).toString("hex");
  getMockGrantService().createGrant({
    grantId,
    status,
    accessType: "stream30d",
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    pricePerDay: 600_000,
  });
  return grantId;
}
const ctx = (grantId: string) => ({ params: Promise.resolve({ grantId }) });
const post = (grantId: string, body: unknown = {}) =>
  POST(new Request("http://test", { method: "POST", body: JSON.stringify(body) }), ctx(grantId));
const TX = "5".repeat(88);

describe("/api/grants/[grantId]/erasure-request", () => {
  it("logs a request for a revoked grant and destroys its keys", async () => {
    const grantId = mockGrant("revoked");
    getVault().seal(grantId, ["a"], 0);
    const res = await post(grantId, { revokeTx: TX });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ grantId, revokeTx: TX });
    expect(getVault().getKey(grantId, 0, Date.now())).toBeNull();

    const read = await GET(new Request("http://test"), ctx(grantId));
    expect(await read.json()).toMatchObject({ grantId, revokeTx: TX });
  });

  it("refuses while the grant is still active", async () => {
    expect((await post(mockGrant("active"))).status).toBe(409);
  });

  it("rejects unknown grants and malformed signatures", async () => {
    expect((await post("0".repeat(32))).status).toBe(404);
    expect((await post(mockGrant("revoked"), { revokeTx: "not a signature" })).status).toBe(400);
    expect((await GET(new Request("http://test"), ctx("0".repeat(32)))).status).toBe(404);
  });
});
