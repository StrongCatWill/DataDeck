import type { Card, CardName, DailyRow, Rarity } from "./types";

// TODO(role C): replace these thresholds with the exact v1 card rules.
// Each rule returns a reason string so "Why this card?" is always shown (FR-1).
interface CardRule {
  name: CardName;
  rarity: Rarity;
  test: (week: DailyRow[]) => string | null;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const RULES: CardRule[] = [
  {
    name: "Early Bird",
    rarity: "Common",
    test: (w) => {
      const n = w.filter((d) => d.wake_time <= "06:30").length;
      return n >= 5 ? `You woke up by 06:30 on ${n} of 7 days.` : null;
    },
  },
  {
    name: "Deep Sleeper",
    rarity: "Rare",
    test: (w) => {
      const deep = avg(w.map((d) => d.deep_sleep_min));
      return deep >= 95 ? `Your deep sleep averaged ${deep.toFixed(0)} minutes a night.` : null;
    },
  },
  {
    name: "Calm Heart",
    rarity: "Rare",
    test: (w) => {
      const hr = avg(w.map((d) => d.resting_hr));
      return hr <= 58 ? `Your resting heart rate averaged ${hr.toFixed(0)} bpm.` : null;
    },
  },
  {
    name: "Marathon Week",
    rarity: "Epic",
    test: (w) => {
      const steps = w.reduce((a, d) => a + d.steps, 0);
      return steps >= 100_000 ? `You walked ${steps.toLocaleString("en")} steps this week.` : null;
    },
  },
  {
    name: "Night Owl",
    rarity: "Common",
    test: (w) => {
      const n = w.filter((d) => d.bedtime >= "23:30" || d.bedtime < "05:00").length;
      return n >= 3 ? `You went to bed after 23:30 on ${n} nights.` : null;
    },
  },
  {
    name: "Perfect Week",
    rarity: "Legendary",
    test: (w) =>
      w.every((d) => d.sleep_hours >= 7.5 && d.active_min >= 30)
        ? "Every day this week had 7.5+ hours of sleep and 30+ active minutes."
        : null,
  },
];

export function generateCards(rows: DailyRow[]): Card[] {
  const weeks = new Map<number, DailyRow[]>();
  for (const r of rows) weeks.set(r.week, [...(weeks.get(r.week) ?? []), r]);

  const cards: Card[] = [];
  for (const [week, days] of weeks) {
    for (const rule of RULES) {
      const why = rule.test(days);
      if (why) {
        cards.push({
          id: `w${week}-${rule.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: rule.name,
          rarity: rule.rarity,
          week,
          whyThisCard: why,
          level: 1,
        });
      }
    }
  }
  return cards;
}
