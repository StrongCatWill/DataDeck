// Card rules from the v1 build guide. Pure functions: no file or network access.
// Card data stays off-chain; nothing here may be written to a transaction or memo.

export interface DayRecord {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  wakeTime: string;
  sleepHours: number;
  steps: number;
  restingHr: number;
}

export type CardName =
  | "Early Bird"
  | "Step Starter"
  | "Deep Sleeper"
  | "Calm Heart"
  | "Marathon Week"
  | "Perfect Week";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Card {
  name: CardName;
  rarity: Rarity;
  /** The rule in one sentence, shown on the card. */
  rule: string;
  /** "Why this card?": what in this week's data earned it. */
  why: string;
  /** Times this card has been earned up to and including this week. Cosmetic only. */
  level: number;
}

export interface WeekPack {
  /** 1-based week number within the sample data. */
  week: number;
  /** Date of the first day in the week. */
  weekStart: string;
  cards: Card[];
}

export const CARD_RULES: Record<CardName, { rarity: Rarity; rule: string }> = {
  "Early Bird": { rarity: "common", rule: "Awake before 7:00 on 5+ days" },
  "Step Starter": { rarity: "common", rule: "50,000+ steps in the week" },
  "Deep Sleeper": { rarity: "rare", rule: "8+ hours sleep on all 7 nights" },
  "Calm Heart": { rarity: "rare", rule: "Resting heart rate under 60 bpm all week" },
  "Marathon Week": { rarity: "epic", rule: "100,000+ steps in the week" },
  "Perfect Week": { rarity: "legendary", rule: "Deep Sleeper + Step Starter + Calm Heart in the same week" },
};

/** Parses the sample CSV (header: date,wake_time,sleep_hours,steps,resting_hr). No quoted fields. */
export function parseHealthCsv(csv: string): DayRecord[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(",").map((c) => c.trim());
  const at = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`CSV is missing column "${name}"`);
    return i;
  };
  const idx = {
    date: at("date"),
    wake: at("wake_time"),
    sleep: at("sleep_hours"),
    steps: at("steps"),
    hr: at("resting_hr"),
  };
  return lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const v = line.split(",").map((c) => c.trim());
      return {
        date: v[idx.date],
        wakeTime: v[idx.wake],
        sleepHours: Number(v[idx.sleep]),
        steps: Number(v[idx.steps]),
        restingHr: Number(v[idx.hr]),
      };
    });
}

/** Splits days into consecutive 7-day weeks; a trailing partial week is dropped. */
export function splitWeeks(days: DayRecord[]): DayRecord[][] {
  const weeks: DayRecord[][] = [];
  for (let i = 0; i + 7 <= days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** Cards earned by one 7-day week, with a "why" line each. Level is 1; buildDeck sets real levels. */
export function cardsForWeek(week: DayRecord[]): Card[] {
  const earned: { name: CardName; why: string }[] = [];
  const totalSteps = week.reduce((sum, d) => sum + d.steps, 0);
  const stepsText = totalSteps.toLocaleString("en-US");

  const earlyDays = week.filter((d) => d.wakeTime < "07:00").length;
  if (earlyDays >= 5) earned.push({ name: "Early Bird", why: `Awake before 7:00 on ${earlyDays} of 7 days.` });

  const stepStarter = totalSteps >= 50_000;
  if (stepStarter) earned.push({ name: "Step Starter", why: `${stepsText} steps this week.` });

  const deepSleeper = week.length === 7 && week.every((d) => d.sleepHours >= 8);
  if (deepSleeper) {
    const least = Math.min(...week.map((d) => d.sleepHours));
    earned.push({ name: "Deep Sleeper", why: `8+ hours every night; your shortest night was ${least} h.` });
  }

  const calmHeart = week.every((d) => d.restingHr < 60);
  if (calmHeart) {
    const highest = Math.max(...week.map((d) => d.restingHr));
    earned.push({ name: "Calm Heart", why: `Resting heart rate stayed under 60; your highest was ${highest} bpm.` });
  }

  if (totalSteps >= 100_000) earned.push({ name: "Marathon Week", why: `${stepsText} steps this week.` });

  if (deepSleeper && stepStarter && calmHeart) {
    earned.push({ name: "Perfect Week", why: "You earned Deep Sleeper, Step Starter and Calm Heart in the same week." });
  }

  return earned.map(({ name, why }) => ({ name, why, level: 1, ...CARD_RULES[name] }));
}

/** One pack per full week, with each card's level counting how often it has been earned so far. */
export function buildDeck(days: DayRecord[]): WeekPack[] {
  const counts = new Map<CardName, number>();
  return splitWeeks(days).map((week, i) => ({
    week: i + 1,
    weekStart: week[0].date,
    cards: cardsForWeek(week).map((card) => {
      const level = (counts.get(card.name) ?? 0) + 1;
      counts.set(card.name, level);
      return { ...card, level };
    }),
  }));
}
