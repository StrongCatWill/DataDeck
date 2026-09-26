// Core demo flow through the route handlers, with the mock grant service:
// grant → encrypted batches → key → kill switch → 403.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, DEMO_DAY_MS, type SealedBatch } from "@/lib/vault";
import { GET as getBatches } from "./batches/[grantId]/route";
import { POST as createGrant } from "./dev/grants/route";
import { POST as revokeGrant } from "./dev/grants/[grantId]/revoke/route";
import { GET as getKey } from "./keys/[grantId]/[batch]/route";

const req = (body?: unknown) =>
  new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

async function newGrant(body?: unknown): Promise<string> {
  const res = await createGrant(req(body));
  expect(res.status).toBe(201);
  return (await res.json()).grant.grantId;
}
const keyFor = (grantId: string, batch: string) => getKey(req(), params({ grantId, batch }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("key API with the mock grant service", () => {
  it("streams a batch per demo day and releases keys that decrypt them", async () => {
    const grantId = await newGrant();
    vi.advanceTimersByTime(DEMO_DAY_MS);

    const res = await getBatches(req(), params({ grantId }));
    const { batches } = (await res.json()) as { batches: SealedBatch[] };
    expect(batches.map((b) => b.batch)).toEqual([0, 1]);

    const keyRes = await keyFor(grantId, "1");
    expect(keyRes.status).toBe(200);
    const { key } = await keyRes.json();
    expect(JSON.parse(decrypt(batches[1], key))).toMatchObject({ date: "2026-08-30" });
  });

  it("returns 404 for a batch that has not arrived yet", async () => {
    const grantId = await newGrant();
    expect((await keyFor(grantId, "5")).status).toBe(404);
  });

  it("kill switch: the next key request returns 403 and keys stay destroyed", async () => {
    const grantId = await newGrant();
    expect((await keyFor(grantId, "0")).status).toBe(200);

    expect((await revokeGrant(req(), params({ grantId }))).status).toBe(200);

    const refused = await keyFor(grantId, "0");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "access_refused", reason: "revoked" });
  });

  it("returns 403 once the grant has expired", async () => {
    const grantId = await newGrant({ ttlSec: 30 });
    vi.advanceTimersByTime(30_000);
    expect(await (await keyFor(grantId, "0")).json()).toEqual({ error: "access_refused", reason: "expired" });
  });

  it("returns 403 for an unknown grant and 400 for a bad batch number", async () => {
    expect((await keyFor("unknown", "0")).status).toBe(403);
    expect((await keyFor("unknown", "-1")).status).toBe(400);
    expect((await keyFor("unknown", "abc")).status).toBe(400);
  });
});
