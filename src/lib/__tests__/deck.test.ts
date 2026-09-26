import { describe, expect, it } from "vitest";
import { BOUNTIES } from "../bounties";
import { generateCards } from "../cards";
import { loadSampleRows } from "../csv";
import { CARD_RARITY, CARD_TYPES, bountiesForCard, collectionSlots, packsByWeek, setCompletion } from "../deck";

const cards = generateCards(loadSampleRows()); // data/sample.csv
const byId = (id: string) => cards.find((c) => c.id === id)!;

describe("deck helpers on the sample data", () => {
  it("knows all six card types, with the rarities cards.ts assigns", () => {
    expect(CARD_TYPES).toHaveLength(6);
    for (const c of cards) expect(c.rarity).toBe(CARD_RARITY[c.name]);
  });

  it("makes one pack per week, commonest card first and rarest last", () => {
    const packs = packsByWeek(cards);
    expect(packs.map((p) => p.week)).toEqual([1, 2]);
    expect(packs[0].cards.map((c) => c.name)).toEqual(["Early Bird", "Step Starter", "Deep Sleeper", "Calm Heart", "Perfect Week"]);
    expect(packs[1].cards.map((c) => c.name)).toEqual(["Early Bird", "Step Starter", "Marathon Week"]);
    expect(packs.flatMap((p) => p.cards)).toHaveLength(cards.length);
  });

  it("shows every card type, locked until a revealed card earns it", () => {
    const none = collectionSlots([]);
    expect(none.map((s) => s.name)).toEqual(CARD_TYPES);
    expect(setCompletion(none)).toEqual({ earned: 0, total: 6 });

    const week1 = collectionSlots(packsByWeek(cards)[0].cards);
    expect(week1.find((s) => s.name === "Marathon Week")!.copies).toEqual([]);
    expect(setCompletion(week1)).toEqual({ earned: 5, total: 6 });

    expect(setCompletion(collectionSlots(cards))).toEqual({ earned: 6, total: 6 });
  });

  it("keeps each copy of a repeated card with its own id, week and level", () => {
    const earlyBird = collectionSlots(cards).find((s) => s.name === "Early Bird")!;
    expect(earlyBird.copies.map((c) => [c.id, c.week, c.level])).toEqual([
      ["w1-early-bird", 1, 1],
      ["w2-early-bird", 2, 2],
    ]);
  });

  it("matches research requests to a card by type, and can match none", () => {
    expect(bountiesForCard(byId("w1-deep-sleeper"), BOUNTIES).map((b) => b.id)).toEqual(["b-trinity-sleep"]);
    expect(bountiesForCard(byId("w2-marathon-week"), BOUNTIES).map((b) => b.id)).toEqual(["b-active-ireland"]);
    expect(bountiesForCard(byId("w1-early-bird"), BOUNTIES)).toEqual([]);
  });
});
