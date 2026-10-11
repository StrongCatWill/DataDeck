import { describe, expect, it } from "vitest";
import { GET as records } from "@/app/api/records/route";
import { GET as stats } from "@/app/api/stats/route";
import { POST as createGrant } from "@/app/api/grants/route";
import { GET as getKey } from "@/app/api/keys/[grantId]/[batch]/route";
import { POST as revoke } from "@/app/api/revoke/route";
import { generateCards } from "../cards";
import { loadSampleRows } from "../csv";

const post = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });

describe("GET /api/records", () => {
  it("returns each grant with its terms, batches opened, payouts and erasure request", async () => {
    const card = generateCards(loadSampleRows()).find((c) => c.name === "Deep Sleeper")!;
    const { grantId } = await (await createGrant(post({ player: "p-rec", bountyId: "b-trinity-sleep", cardId: card.id }))).json();
    await getKey(new Request("http://test"), { params: Promise.resolve({ grantId, batch: "0" }) });
    await revoke(post({ player: "p-rec" }));

    const body = await (await records(new Request("http://test?player=p-rec"))).json();
    expect(body.totalPaidUsdc).toBe(0.6);
    expect(body.grants).toEqual([
      expect.objectContaining({
        grantId, researcher: "Trinity Sleep Lab", status: "Revoked", retention: "12 months", priceUsdc: 0.6,
        batchesOpened: 1, paidUsdc: 0.6, erasure: expect.objectContaining({ revokeTx: expect.any(String) }),
      }),
    ]);
    expect(body.payouts[0]).toMatchObject({ grantId, amountUsdc: 0.6, explorer: null });
  });

  it("needs a player", async () => {
    expect((await records(new Request("http://test"))).status).toBe(400);
  });
});

describe("GET /api/stats", () => {
  it("returns the sample rows grouped by week", async () => {
    const body = await (await stats()).json();
    expect(body.weeks.map((w: { week: number }) => w.week)).toEqual([1, 2]);
    expect(body.weeks[0].days).toHaveLength(7);
  });
});
