import type { Bounty, Card, CardName, Rarity } from "./types";

// Pure deck helpers for the game screens. They only arrange generateCards() output; card rules stay in cards.ts.

/** Every card type with its rarity, in collection order. Record<CardName, …> fails to compile if a type is missing. */
export const CARD_RARITY: Record<CardName, Rarity> = {
  "Early Bird": "Common",
  "Step Starter": "Common",
  "Deep Sleeper": "Rare",
  "Calm Heart": "Rare",
  "Marathon Week": "Epic",
  "Perfect Week": "Legendary",
};

export const CARD_TYPES = Object.keys(CARD_RARITY) as CardName[];

const RARITY_RANK: Record<Rarity, number> = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };

export const ORG_LABEL: Record<Bounty["orgType"], string> = {
  non_profit_university: "Non-profit university",
  non_profit: "Non-profit",
  commercial: "Commercial",
};

export const priceLabel = (b: Bounty) => `${b.priceUsdc} USDC ${b.priceUnit === "per_day" ? "per day" : "once"}`;

export interface Pack {
  week: number;
  /** Reveal order: commonest first, rarest last. */
  cards: Card[];
}

/** One sealed pack per week that earned at least one card, oldest week first. */
export function packsByWeek(cards: Card[]): Pack[] {
  const weeks = new Map<number, Card[]>();
  for (const c of cards) weeks.set(c.week, [...(weeks.get(c.week) ?? []), c]);
  return [...weeks]
    .sort(([a], [b]) => a - b)
    .map(([week, cs]) => ({ week, cards: [...cs].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]) }));
}

export interface CollectionSlot {
  name: CardName;
  rarity: Rarity;
  /** Earned copies, oldest week first. Empty means the slot is locked. */
  copies: Card[];
}

/** One slot per card type, earned or locked, from the cards the player has revealed so far. */
export function collectionSlots(revealed: Card[]): CollectionSlot[] {
  return CARD_TYPES.map((name) => ({
    name,
    rarity: CARD_RARITY[name],
    copies: revealed.filter((c) => c.name === name).sort((a, b) => a.week - b.week),
  }));
}

export function setCompletion(slots: CollectionSlot[]): { earned: number; total: number } {
  return { earned: slots.filter((s) => s.copies.length > 0).length, total: slots.length };
}

/** Research requests that want this card's type. */
export const bountiesForCard = (card: Card, bounties: Bounty[]) => bounties.filter((b) => b.cardWanted === card.name);
