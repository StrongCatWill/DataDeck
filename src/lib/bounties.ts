import type { Bounty } from "./types";

// Sample bounties from the v2 guide. Prices in devnet USDC.
export const BOUNTIES: Bounty[] = [
  {
    id: "b-trinity-sleep",
    researcher: "Trinity Sleep Lab",
    orgType: "non_profit_university",
    verified: true,
    ethicsRef: "demo",
    cardWanted: "Deep Sleeper",
    weeksWanted: 1,
    accessType: "stream_30d",
    accessWindowLabel: "30 days (one batch per day)",
    retention: "12 months",
    priceUsdc: 0.6,
    priceUnit: "per_day",
    fullNotice:
      "TODO(role C): full researcher notice. Controller, purpose, legal basis (explicit consent, Art. 9(2)(a)), " +
      "pseudonymised daily sleep data, access window, retention period, recipients, your rights and how to withdraw.",
  },
  {
    id: "b-heart-health-ai",
    researcher: "Heart Health AI startup",
    orgType: "commercial",
    verified: true,
    ethicsRef: null,
    cardWanted: "Calm Heart",
    weeksWanted: 2,
    accessType: "snapshot_24h",
    accessWindowLabel: "24 hours",
    retention: "6 months",
    priceUsdc: 3,
    priceUnit: "once",
    fullNotice: "TODO(role C): full researcher notice. Commercial buyer: manual trade only, never auto-accepted.",
  },
  {
    id: "b-active-ireland",
    researcher: "Active Ireland study",
    orgType: "non_profit",
    verified: true,
    ethicsRef: "demo",
    cardWanted: "Marathon Week",
    weeksWanted: 1,
    accessType: "single_query",
    accessWindowLabel: "One aggregate answer",
    retention: "None (aggregate)",
    priceUsdc: 1,
    priceUnit: "once",
    fullNotice: "TODO(role C): full researcher notice. Aggregate only; no raw rows leave the app.",
  },
];

export const getBounty = (id: string) => BOUNTIES.find((b) => b.id === id);
