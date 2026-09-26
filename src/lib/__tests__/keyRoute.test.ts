import { createDecipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/keys/[grantId]/[batch]/route";
import { grantBackend } from "../grants";
import { getBatches, releaseKey, sealBatches } from "../vault";

// Calls the route handler directly, like a MockMvc test without starting a server.
const call = (grantId: string, batch: string) => GET(new Request("http://test"), { params: Promise.resolve({ grantId, batch }) });

async function newGrant(player: string) {
  const grant = await grantBackend().createGrant({ player, bountyId: "b-trinity-sleep", cardId: "card-1" });
  sealBatches(grant.grantId, [[{ day: 1 }], [{ day: 2 }]]);
  return grant;
}

describe("GET /api/keys/[grantId]/[batch]", () => {
  it("returns a key that decrypts the batch while the grant is Active", async () => {
    const grant = await newGrant("p-active");
    const res = await call(grant.grantId, "1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ grantId: grant.grantId, batch: 1 });
    expect(body.payoutSig).toMatch(/^sim-/); // PAYOUT_MODE defaults to simulate

    const b = getBatches(grant.grantId)[1];
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(body.key, "base64"), Buffer.from(b.iv, "base64"));
    decipher.setAuthTag(Buffer.from(b.authTag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(b.ciphertext, "base64")), decipher.final()]);
    expect(JSON.parse(plain.toString())).toEqual([{ day: 2 }]);
  });

  it("returns 403 after revocation and shreds unreleased keys", async () => {
    const grant = await newGrant("p-revoke");
    expect((await call(grant.grantId, "0")).status).toBe(200);
    await grantBackend().revokeAll("p-revoke");

    const res = await call(grant.grantId, "1");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ status: "Revoked" });
    // The key for batch 1 was never released, so it has been shredded: even a later Active check could not return it.
    expect(releaseKey(grant.grantId, 1)).toBeNull();
  });

  it("returns 403 once the grant has expired", async () => {
    const grant = await newGrant("p-expired");
    grant.expiresAt = Math.floor(Date.now() / 1000) - 1; // the mock store holds this same object
    const res = await call(grant.grantId, "0");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ status: "Expired" });
  });

  it("returns 403 for an unknown grant", async () => {
    const res = await call("does-not-exist", "0");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Access denied" });
  });

  it.each(["abc", "-1", "1.5", "", " 1", "1e0"])("returns 400 for batch %j", async (batch) => {
    const grant = await newGrant("p-bad-batch");
    expect((await call(grant.grantId, batch)).status).toBe(400);
  });

  it("returns 404 for a batch that does not exist", async () => {
    const grant = await newGrant("p-missing-batch");
    expect((await call(grant.grantId, "99")).status).toBe(404);
  });
});
