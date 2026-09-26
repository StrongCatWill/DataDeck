// Sample bounties (v2 guide, "Sample bounties") and the full notice shown on the consent sheet.
// Off-chain only: study topics and card names must never be written on-chain.
import type { CardName } from "./cards";
import type { AccessType } from "./types";

export type OrgType = "non_profit_university" | "non_profit" | "commercial";

export interface Bounty {
  bountyId: string;
  researcher: string;
  orgType: OrgType;
  /** Ethics approval reference; null when none was provided. */
  ethicsRef: string | null;
  purpose: string;
  cardWanted: CardName;
  weeksWanted: number;
  /** Only these fields leave the app, pseudonymised. */
  dataShared: string[];
  accessType: AccessType;
  /** How long the researcher can request keys, in plain words. */
  accessWindow: string;
  /** How long the researcher may keep decrypted data, in plain words. */
  retention: string;
  /** Devnet USDC base units (6 decimals). */
  price: { amount: number; per: "day" | "once" };
  /** Commercial buyers never auto-match; they always need a manual trade. */
  manualOnly: boolean;
}

export const BOUNTIES: Bounty[] = [
  {
    bountyId: "trinity-sleep",
    researcher: "Trinity Sleep Lab",
    orgType: "non_profit_university",
    ethicsRef: "demo",
    purpose: "Studying how regular sleep duration relates to next-day activity in adults.",
    cardWanted: "Deep Sleeper",
    weeksWanted: 4,
    dataShared: ["date", "sleep hours"],
    accessType: "stream30d",
    accessWindow: "30 days, one batch per day",
    retention: "12 months",
    price: { amount: 600_000, per: "day" },
    manualOnly: false,
  },
  {
    bountyId: "heart-health-ai",
    researcher: "Heart Health AI",
    orgType: "commercial",
    ethicsRef: null,
    purpose: "Training a model that estimates resting heart rate trends from wearable data.",
    cardWanted: "Calm Heart",
    weeksWanted: 2,
    dataShared: ["date", "resting heart rate"],
    accessType: "snapshot24h",
    accessWindow: "24 hours, one package",
    retention: "6 months",
    price: { amount: 3_000_000, per: "once" },
    manualOnly: true,
  },
  {
    bountyId: "active-ireland",
    researcher: "Active Ireland study",
    orgType: "non_profit",
    ethicsRef: null,
    purpose: "Measuring average weekly step counts among very active people.",
    cardWanted: "Marathon Week",
    weeksWanted: 1,
    dataShared: ["one aggregate figure (average steps); no daily rows"],
    accessType: "singleQuery",
    accessWindow: "one answer, then access ends",
    retention: "none (aggregate only)",
    price: { amount: 1_000_000, per: "once" },
    manualOnly: false,
  },
];

export function findBounty(bountyId: string): Bounty | undefined {
  return BOUNTIES.find((b) => b.bountyId === bountyId);
}

const ORG_LABEL: Record<OrgType, string> = {
  non_profit_university: "Non-profit university",
  non_profit: "Non-profit",
  commercial: "Commercial company",
};

const ACCESS_LABEL: Record<AccessType, string> = {
  snapshot24h: "24-hour snapshot",
  stream30d: "30-day stream",
  singleQuery: "Single query (aggregate only)",
};

export function formatPrice({ amount, per }: Bounty["price"]): string {
  const usdc = (amount / 1_000_000).toFixed(2);
  return per === "day" ? `${usdc} USDC per day of data` : `${usdc} USDC once`;
}

/** The full notice (Art. 13) shown below the AI summary. Written by us, not generated. */
export function fullNotice(b: Bounty): string {
  return [
    `Who: ${b.researcher} (${ORG_LABEL[b.orgType]}). Ethics approval: ${b.ethicsRef ?? "none provided"}.`,
    `Purpose: ${b.purpose}`,
    `What is shared: ${b.dataShared.join(", ")} from ${b.weeksWanted} week(s) matching your "${b.cardWanted}" card. ` +
      "The data is pseudonymised: your name is removed, but daily health series can sometimes be linked back to a person.",
    `Access: ${ACCESS_LABEL[b.accessType]}, ${b.accessWindow}. Each batch is encrypted; the researcher gets a key only while your grant is active.`,
    `Retention: the researcher may keep what they decrypted for ${b.retention}.`,
    `Payment: ${formatPrice(b.price)}. Your card level does not change the price.`,
    "Your choice: you are lending access, not handing over your data for good. You can stop sharing at any time with one tap. " +
      "Stopping ends future access and payments and destroys keys not yet released. " +
      "Data the researcher already decrypted cannot be recalled; we send them an erasure request.",
    "Legal basis: your explicit consent. The public blockchain records only a grant ID, timestamps, status and payment, never your health data.",
  ].join("\n");
}
