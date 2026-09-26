import { generateCards, groupWeeks } from "./cards";
import type { Bounty, CardName, DailyRow } from "./types";

/**
 * Data minimisation (Art. 5(1)(c)): a grant only ever carries the fields behind the card it lends.
 * For a single query, the first non-date field is the one averaged.
 */
export const SHARED_FIELDS: Record<CardName, (keyof DailyRow)[]> = {
  "Early Bird": ["date", "wake_time"],
  "Step Starter": ["date", "steps"],
  "Deep Sleeper": ["date", "sleep_hours", "deep_sleep_min"],
  "Calm Heart": ["date", "resting_hr"],
  "Marathon Week": ["date", "steps"],
  "Perfect Week": ["date", "sleep_hours", "steps", "resting_hr"],
};

const pick = (row: DailyRow, fields: (keyof DailyRow)[]) => Object.fromEntries(fields.map((f) => [f, row[f]]));

/** Rows from the most recent weeks that earned the bounty's card, up to weeksWanted weeks. */
function matchingRows(bounty: Bounty, rows: DailyRow[]): DailyRow[] {
  const weeks = groupWeeks(rows);
  const earnedWeeks = generateCards(rows)
    .filter((c) => c.name === bounty.cardWanted)
    .map((c) => c.week)
    .slice(-bounty.weeksWanted);
  return earnedWeeks.flatMap((w) => weeks.get(w) ?? []);
}

/**
 * Splits sample rows into the batches a grant delivers; each batch is later sealed with its own key.
 * Returns null when the player never earned the card the bounty wants.
 */
export function batchesFor(bounty: Bounty, rows: DailyRow[]): unknown[][] | null {
  const matching = matchingRows(bounty, rows);
  if (matching.length === 0) return null;
  const fields = SHARED_FIELDS[bounty.cardWanted];

  switch (bounty.accessType) {
    case "stream_30d":
      // One batch per demo day; the sample CSV repeats to fill 30 days.
      return Array.from({ length: 30 }, (_, i) => [pick(rows[i % rows.length], fields)]);
    case "snapshot_24h":
      return [matching.map((r) => pick(r, fields))];
    case "single_query": {
      // Single query: an aggregate computed on our side, never raw rows.
      const field = fields.find((f) => f !== "date")!;
      const mean = matching.reduce((a, r) => a + Number(r[field]), 0) / matching.length;
      return [[{ [`mean_${field}`]: Number(mean.toFixed(2)), days: matching.length }]];
    }
  }
}
