// Decides what goes into a grant's encrypted batches: only the bounty's fields (data minimisation,
// Art. 5(1)(c)), shaped by access type. Pure: no encryption or storage here.
import type { Bounty } from "./bounties";
import { buildDeck, splitWeeks, type DayRecord } from "./cards";

export type BatchPlan = { ok: true; plaintexts: string[] } | { ok: false; reason: "card_not_held" };

function pick(day: DayRecord, fields: (keyof DayRecord)[]): Partial<DayRecord> {
  return Object.fromEntries(fields.map((f) => [f, day[f]]));
}

/** Days from the most recent weeks that earned the bounty's card, up to weeksWanted weeks. */
function matchingDays(bounty: Bounty, days: DayRecord[]): DayRecord[] {
  const weeks = splitWeeks(days);
  return buildDeck(days)
    .filter((pack) => pack.cards.some((card) => card.name === bounty.cardWanted))
    .slice(-bounty.weeksWanted)
    .flatMap((pack) => weeks[pack.week - 1]);
}

/**
 * - stream30d: one batch per day (batch N unlocks on demo day N).
 * - snapshot24h: one batch holding the matching weeks.
 * - singleQuery: one batch holding a single aggregate; no raw rows leave the app.
 */
export function planBatches(bounty: Bounty, days: DayRecord[]): BatchPlan {
  const matching = matchingDays(bounty, days);
  if (matching.length === 0) return { ok: false, reason: "card_not_held" };

  switch (bounty.accessType) {
    case "stream30d":
      return { ok: true, plaintexts: days.map((d) => JSON.stringify(pick(d, bounty.fields))) };
    case "snapshot24h":
      return { ok: true, plaintexts: [JSON.stringify(matching.map((d) => pick(d, bounty.fields)))] };
    case "singleQuery": {
      const field = bounty.fields.find((f) => f !== "date");
      if (!field) throw new Error(`Bounty ${bounty.bountyId} has no field to aggregate`);
      const values = matching.map((d) => Number(d[field]));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      return { ok: true, plaintexts: [JSON.stringify({ metric: `mean ${field}`, value: Math.round(mean * 10) / 10, days: values.length })] };
    }
  }
}
