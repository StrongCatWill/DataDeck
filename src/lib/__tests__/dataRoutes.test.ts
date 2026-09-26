import { describe, expect, it } from "vitest";
import { GET as getBounties } from "../../app/api/bounties/route";
import { GET as getCards } from "../../app/api/cards/route";

describe("data routes for the app", () => {
  it("GET /api/cards returns the sample deck", async () => {
    const { cards } = await (await getCards()).json();
    expect(cards.map((c: { name: string }) => c.name)).toContain("Deep Sleeper");
  });

  it("GET /api/bounties marks only Trinity Sleep Lab as auto-accepted", async () => {
    const { bounties } = await (await getBounties()).json();
    expect(bounties.filter((b: { autoAccept: boolean }) => b.autoAccept).map((b: { id: string }) => b.id)).toEqual([
      "b-trinity-sleep",
    ]);
  });
});
