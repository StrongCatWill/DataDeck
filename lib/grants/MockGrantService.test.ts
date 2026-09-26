import { describe, expect, it } from "vitest";
import { MockGrantService } from "./MockGrantService";
import type { Grant } from "@/lib/types";

const grant: Grant = {
  grantId: "7f3a0000000000000000000000000001",
  status: "active",
  accessType: "stream30d",
  expiresAt: 1_800_000_300,
  pricePerDay: 600_000,
};

describe("MockGrantService", () => {
  it("returns null for an unknown grant", async () => {
    expect(await new MockGrantService().getGrant("nope")).toBeNull();
  });

  it("returns a created grant", async () => {
    const service = new MockGrantService();
    service.createGrant(grant);
    expect(await service.getGrant(grant.grantId)).toEqual(grant);
  });

  it("revoking changes the status seen by the next read", async () => {
    const service = new MockGrantService();
    service.createGrant(grant);
    service.revokeGrant(grant.grantId);
    expect((await service.getGrant(grant.grantId))?.status).toBe("revoked");
  });

  it("callers cannot change stored state through a returned grant", async () => {
    const service = new MockGrantService();
    service.createGrant(grant);
    (await service.getGrant(grant.grantId))!.status = "revoked";
    expect((await service.getGrant(grant.grantId))?.status).toBe("active");
  });
});
