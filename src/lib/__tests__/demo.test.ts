import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as reset } from "@/app/api/demo/reset/route";
import { POST as createGrant } from "@/app/api/grants/route";
import { GET as getKey } from "@/app/api/keys/[grantId]/[batch]/route";
import { POST as revoke } from "@/app/api/revoke/route";
import PrivacyPage from "@/app/privacy/page";
import { generateCards } from "../cards";
import { loadSampleRows } from "../csv";
import { erasureLog, grantBackend } from "../grants";
import { getRules, saveRuleset } from "../rulesStore";
import { DEMO_RULE } from "../rules";
import { getBatches } from "../vault";

// The same flow as scripts/demo-flow.mjs, through the route handlers directly (like MockMvc).
const post = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });
const key = (grantId: string, batch: number) =>
  getKey(new Request("http://test"), { params: Promise.resolve({ grantId, batch: String(batch) }) });
const privacyHtml = async (player: string) =>
  renderToStaticMarkup(await PrivacyPage({ searchParams: Promise.resolve({ player }) }));

async function lend(player: string) {
  const card = generateCards(loadSampleRows()).find((c) => c.name === "Deep Sleeper")!;
  const res = await createGrant(post({ player, bountyId: "b-trinity-sleep", cardId: card.id }));
  expect(res.status).toBe(201);
  return (await res.json()).grantId as string;
}

afterEach(() => vi.unstubAllEnvs());

describe("demo flow: lend, key, stop sharing, refused", () => {
  it("releases a key while active, refuses after stop sharing and logs an erasure request", async () => {
    const grantId = await lend("p-flow");
    expect((await key(grantId, 0)).status).toBe(200);

    const r = await (await revoke(post({ player: "p-flow" }))).json();
    expect(r.revoked).toEqual([grantId]);
    expect(r.keysDestroyed).toBeGreaterThan(0);

    const denied = await key(grantId, 1);
    expect(denied.status).toBe(403);
    expect(erasureLog.some((e) => e.grantId === grantId)).toBe(true);
  });
});

describe("/privacy page", () => {
  it("shows the player's grants and erasure requests with the no-recall notice", async () => {
    const grantId = await lend("p-privacy");
    await revoke(post({ player: "p-privacy" }));
    const html = await privacyHtml("p-privacy");
    expect(html).toContain(grantId.slice(0, 8));
    expect(html).toContain("Revoked");
    expect(html).toContain("cannot be recalled");
    expect(html).not.toContain("No erasure requests yet");
  });

  it("shows only this player's grants", async () => {
    await lend("p-other");
    expect(await privacyHtml("p-nobody")).toContain("No grants yet");
  });
});

describe("POST /api/demo/reset", () => {
  it("clears grants, keys, rules and the erasure log", async () => {
    const grantId = await lend("p-reset");
    await revoke(post({ player: "p-reset" }));
    saveRuleset("p-reset", DEMO_RULE);

    const res = await reset();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect(await grantBackend().readGrant(grantId)).toBeNull();
    expect(getBatches(grantId)).toEqual([]);
    expect(erasureLog).toHaveLength(0);
    expect(getRules("p-reset")).toBeUndefined();
    expect(await privacyHtml("p-reset")).toContain("No grants yet");
  });

  it("is refused on a production build unless ALLOW_DEMO_RESET=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await reset()).status).toBe(403);
    vi.stubEnv("ALLOW_DEMO_RESET", "1");
    expect((await reset()).status).toBe(200);
  });
});
