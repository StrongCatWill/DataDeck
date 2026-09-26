import type { AccessType, DailyRow } from "./types";

/** Splits sample rows into the batches a grant delivers; each batch is later sealed with its own key. */
export function batchesFor(accessType: AccessType, rows: DailyRow[]): unknown[][] {
  switch (accessType) {
    case "stream_30d":
      // One batch per demo day; the sample CSV repeats to fill 30 days.
      return Array.from({ length: 30 }, (_, i) => [rows[i % rows.length]]);
    case "snapshot_24h":
      return [rows];
    case "single_query": {
      // Single query: an aggregate computed on our side, never raw rows.
      const mean = rows.reduce((a, r) => a + r.sleep_hours, 0) / rows.length;
      return [[{ mean_sleep_hours: Number(mean.toFixed(2)) }]];
    }
  }
}
