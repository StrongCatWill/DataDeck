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
      "Who: Trinity Sleep Lab, a non-profit university lab (ethics approval: demo). " +
      "Purpose: studying how regular sleep duration relates to next-day activity in adults. " +
      "What is shared: date, sleep hours and deep-sleep minutes, pseudonymised: your name is removed, but daily health " +
      "series can sometimes be linked back to a person. " +
      "Access: 30-day stream, one encrypted batch per day; the researcher gets a key only while your grant is active. " +
      "Retention: the researcher may keep what they decrypted for 12 months. Payment: 0.60 USDC per day of data. " +
      "Your choice: you lend access, you do not hand your data over for good. You can stop sharing at any time with one tap. " +
      "Stopping ends future access and payments and destroys keys not yet released. Data the researcher already decrypted " +
      "cannot be recalled; we send them an erasure request. Legal basis: your explicit consent (Art. 9(2)(a)). " +
      "The public blockchain records only a grant ID, hashes, timestamps, status and payment, never your health data.",
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
    fullNotice:
      "Who: Heart Health AI, a commercial company. Commercial requests are never auto-accepted; you decide each time. " +
      "Purpose: training a model that estimates resting heart rate trends from wearable data. " +
      "What is shared: date and resting heart rate for the weeks of your Calm Heart card, pseudonymised: your name is " +
      "removed, but daily health series can sometimes be linked back to a person. " +
      "Access: 24-hour snapshot, one encrypted package. Retention: 6 months. Payment: 3 USDC once. " +
      "Your choice: you lend access, you do not hand your data over for good. You can stop sharing at any time with one tap. " +
      "Stopping ends future access and payments and destroys keys not yet released. Data the researcher already decrypted " +
      "cannot be recalled; we send them an erasure request. Legal basis: your explicit consent (Art. 9(2)(a)). " +
      "The public blockchain records only a grant ID, hashes, timestamps, status and payment, never your health data.",
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
    fullNotice:
      "Who: Active Ireland study, a non-profit (ethics approval: demo). " +
      "Purpose: measuring average weekly step counts among very active people. " +
      "What is shared: one aggregate figure, your average daily steps in your Marathon Week. No daily rows leave the app. " +
      "Access: a single query; access ends once the answer is released. Retention: none beyond the aggregate. " +
      "Payment: 1 USDC once. " +
      "Your choice: you lend access, you do not hand your data over for good. You can stop sharing at any time with one tap. " +
      "Stopping ends future access and payments and destroys keys not yet released. Data the researcher already decrypted " +
      "cannot be recalled; we send them an erasure request. Legal basis: your explicit consent (Art. 9(2)(a)). " +
      "The public blockchain records only a grant ID, hashes, timestamps, status and payment, never your health data.",
  },
];

export const getBounty = (id: string) => BOUNTIES.find((b) => b.id === id);
