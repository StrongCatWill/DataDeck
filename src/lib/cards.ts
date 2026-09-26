import type { Card, CardName, DailyRow, Rarity } from "./types";

// Card rules from the v1 build guide, one week at a time. Each rule returns a reason string so
// "Why this card?" is always shown (FR-1). Card data stays off-chain.
interface CardRule {
  name: CardName;
  rarity: Rarity;
  test: (week: DailyRow[]) => string | null;
}

const totalSteps = (w: DailyRow[]) => w.reduce((a, d) => a + d.steps, 0);
const stepsText = (w: DailyRow[]) => `You walked ${totalSteps(w).toLocaleString("en")} steps this week.`;
const deepSleeper = (w: DailyRow[]) => w.length === 7 && w.every((d) => d.sleep_hours >= 8);
const stepStarter = (w: DailyRow[]) => totalSteps(w) >= 50_000;
const calmHeart = (w: DailyRow[]) => w.every((d) => d.resting_hr < 60);

const RULES: CardRule[] = [
  {
    name: "Early Bird", // Awake before 7:00 on 5+ days
    rarity: "Common",
    test: (w) => {
      const n = w.filter((d) => d.wake_time < "07:00").length;
      return n >= 5 ? `You were up before 7:00 on ${n} of 7 days.` : null;
    },
  },
  {
    name: "Step Starter", // 50,000+ steps
    rarity: "Common",
    test: (w) => (stepStarter(w) ? stepsText(w) : null),
  },
  {
    name: "Deep Sleeper", // 8+ hours sleep on 7 nights
    rarity: "Rare",
    test: (w) =>
      deepSleeper(w)
        ? `You slept 8+ hours every night; your shortest night was ${Math.min(...w.map((d) => d.sleep_hours))} h.`
        : null,
  },
  {
    name: "Calm Heart", // Resting heart rate under 60 bpm all week
    rarity: "Rare",
    test: (w) =>
      calmHeart(w)
        ? `Your resting heart rate stayed under 60 bpm all week; the highest was ${Math.max(...w.map((d) => d.resting_hr))}.`
        : null,
  },
  {
    name: "Marathon Week", // 100,000+ steps
    rarity: "Epic",
    test: (w) => (totalSteps(w) >= 100_000 ? stepsText(w) : null),
  },
  {
    name: "Perfect Week", // Deep Sleeper + Step Starter + Calm Heart in the same week
    rarity: "Legendary",
    test: (w) =>
      deepSleeper(w) && stepStarter(w) && calmHeart(w)
        ? "You earned Deep Sleeper, Step Starter and Calm Heart in the same week."
        : null,
  },
];

export function groupWeeks(rows: DailyRow[]): Map<number, DailyRow[]> {
  const weeks = new Map<number, DailyRow[]>();
  for (const r of rows) weeks.set(r.week, [...(weeks.get(r.week) ?? []), r]);
  return weeks;
}

/** Cards per week. Earning the same card again raises its level (cosmetic only; never changes pay). */
export function generateCards(rows: DailyRow[]): Card[] {
  const cards: Card[] = [];
  const earned = new Map<CardName, number>();
  for (const [week, days] of [...groupWeeks(rows)].sort(([a], [b]) => a - b)) {
    for (const rule of RULES) {
      const why = rule.test(days);
      if (!why) continue;
      const level = (earned.get(rule.name) ?? 0) + 1;
      earned.set(rule.name, level);
      cards.push({
        id: `w${week}-${rule.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: rule.name,
        rarity: rule.rarity,
        week,
        whyThisCard: why,
        level,
      });
    }
  }
  return cards;
}
