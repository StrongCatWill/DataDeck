import { describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/me/route";
import { GET as exportMe } from "@/app/api/me/export/route";
import { GET as getKey } from "@/app/api/keys/[grantId]/[batch]/route";
import { POST as createGrant } from "@/app/api/grants/route";
import { generateCards } from "../cards";
import { loadSampleRows } from "../csv";
import { grantBackend } from "../grants";
import { completeQuest, getProfile, openPack, signIn, verifyAge } from "../profile";

const me = (body: Record<string, unknown>) => POST(new Request("http://test", { method: "POST", body: JSON.stringify(body) }));
const json = async (res: Response) => ({ status: res.status, body: await res.json() });

async function adult(player: string) {
  await me({ player, action: "signIn", provider: "apple", name: "Sam" });
  expect((await me({ player, action: "age", birthYear: 2000 })).status).toBe(200);
}

describe("/api/me account", () => {
  it("returns null before sign-in, then the saved profile", async () => {
    expect((await json(await GET(new Request("http://test?player=p-new")))).body.profile).toBeNull();
    await adult("p-new");
    const { body } = await json(await GET(new Request("http://test?player=p-new")));
    expect(body.profile).toMatchObject({ name: "Sam", provider: "apple", signedIn: true, ageVerified: true, level: 1 });
  });

  it("refuses under-18s and blocks every other change until a valid year", async () => {
    await me({ player: "p-teen", action: "signIn", provider: "email" });
    const young = new Date().getFullYear() - 16;
    expect((await me({ player: "p-teen", action: "age", birthYear: young })).status).toBe(403);
    expect((await me({ player: "p-teen", action: "goals", goals: { steps: 8000 } })).status).toBe(403);
  });

  it("needs sign-in first", async () => {
    expect((await me({ player: "p-ghost", action: "goals", goals: { steps: 8000 } })).status).toBe(401);
  });

  it("validates goals, sources and details", async () => {
    await adult("p-set");
    expect((await me({ player: "p-set", action: "goals", goals: { steps: 10 } })).status).toBe(400);
    const ok = await json(await me({ player: "p-set", action: "goals", goals: { steps: 9000, sleep: 7.5 } }));
    expect(ok.body.profile.goals).toEqual({ steps: 9000, sleep: 7.5 });
    const src = await json(await me({ player: "p-set", action: "sources", sources: { sample: true, bogus: true } }));
    expect(src.body.profile.sources).toEqual({ health: false, phone: false, strava: false, sample: true });
    expect((await me({ player: "p-set", action: "details", color: "red" })).status).toBe(400);
  });

  it("rejects an unknown action", async () => {
    await adult("p-act");
    expect((await me({ player: "p-act", action: "hack" })).status).toBe(400);
  });
});

describe("game rules on the server", () => {
  it("gives quest XP once per quest per day and counts the streak", () => {
    signIn("p-quest", "email");
    verifyAge("p-quest", 1999);
    const day1 = Date.parse("2026-10-01T12:00:00Z");
    expect(completeQuest("p-quest", "steps", day1).xp).toBe(30);
    expect(completeQuest("p-quest", "steps", day1).xp).toBe(0);
    expect(completeQuest("p-quest", "sleep", day1).xp).toBe(30);
    completeQuest("p-quest", "steps", day1 + 86_400_000);
    expect(getProfile("p-quest")!.streak).toBe(2);
    completeQuest("p-quest", "steps", day1 + 3 * 86_400_000); // a day skipped
    expect(getProfile("p-quest")!.streak).toBe(1);
  });

  it("gives pack XP once per week and levels up at 400 XP", () => {
    signIn("p-pack", "email");
    verifyAge("p-pack", 1999);
    for (let w = 1; w <= 10; w++) openPack("p-pack", w);
    expect(openPack("p-pack", 1).xp).toBe(0);
    expect(getProfile("p-pack")).toMatchObject({ level: 2, xp: 0 }); // 10 x 40 = 400
  });

  it("logs a Sleep mode night and finishes the sleep quest when the goal is met", async () => {
    await adult("p-night");
    const end = Math.floor(Date.now() / 1000), start = end - 8.5 * 3600;
    const r = await json(await me({ player: "p-night", action: "sleep", start, end }));
    expect(r.body).toMatchObject({ hours: 8.5, xp: 30 });
  });
});

describe("cash out, export and delete", () => {
  async function paidLoan(player: string) {
    const card = generateCards(loadSampleRows()).find((c) => c.name === "Deep Sleeper")!;
    const { grantId } = await (await createGrant(new Request("http://test", { method: "POST", body: JSON.stringify({ player, bountyId: "b-trinity-sleep", cardId: card.id }) }))).json();
    await getKey(new Request("http://test"), { params: Promise.resolve({ grantId, batch: "0" }) });
    return grantId as string;
  }

  it("never cashes out more than payouts paid", async () => {
    await adult("p-cash");
    await paidLoan("p-cash"); // 0.60 paid
    expect((await me({ player: "p-cash", action: "cashOut", amountUsdc: 1, destination: "bank" })).status).toBe(409);
    const ok = await json(await me({ player: "p-cash", action: "cashOut", amountUsdc: 0.6, destination: "bank" }));
    expect(ok.body.cashOut.signature).toMatch(/^sim-cash-/);
    expect((await me({ player: "p-cash", action: "cashOut", amountUsdc: 0.01, destination: "bank" })).status).toBe(409);
  });

  it("exports the account and its loans as a JSON file", async () => {
    await adult("p-export");
    const grantId = await paidLoan("p-export");
    const res = await exportMe(new Request("http://test?player=p-export"));
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = await res.json();
    expect(body.account.name).toBe("Sam");
    expect(body.records.grants[0]).toMatchObject({ grantId, batchesOpened: 1, paidUsdc: 0.6 });
  });

  it("delete stops every loan first, then removes the account", async () => {
    await adult("p-delete");
    const grantId = await paidLoan("p-delete");
    const r = await json(await DELETE(new Request("http://test?player=p-delete")));
    expect(r.body).toMatchObject({ deleted: true, stopped: { revoked: [grantId] } });
    expect(getProfile("p-delete")).toBeNull();
    expect((await grantBackend().readGrant(grantId))!.status).toBe("Revoked");
  });
});
