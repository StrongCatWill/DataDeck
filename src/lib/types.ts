// Shared contract for all three roles (A: Solana, B: app, C: data/privacy/AI).
// Anything marked OnChain must never carry health terms (NFR-1).

// ---------- Cards (off-chain) ----------

export type CardName =
  | "Early Bird"
  | "Deep Sleeper"
  | "Calm Heart"
  | "Marathon Week"
  | "Perfect Week"
  | "Night Owl"; // TODO: confirm the sixth card against the v1 guide

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";

export interface DailyRow {
  week: number;
  day: number;
  date: string;
  sleep_hours: number;
  deep_sleep_min: number;
  bedtime: string;
  wake_time: string;
  steps: number;
  resting_hr: number;
  active_min: number;
}

export interface Card {
  id: string;
  name: CardName;
  rarity: Rarity;
  week: number;
  /** Plain-language reason the card was generated (FR-1, Art. 13-15). */
  whyThisCard: string;
  /** Cosmetic only: never changes what a bounty pays. */
  level: number;
  /** Set while a grant is open against this card; the card stays in the deck. */
  lendingGrantId?: string;
}

// ---------- Bounties (off-chain) ----------

export type OrgType = "non_profit_university" | "non_profit" | "commercial";

export type AccessType = "snapshot_24h" | "stream_30d" | "single_query";

export interface Bounty {
  id: string;
  researcher: string;
  orgType: OrgType;
  verified: boolean; // in the verified researcher registry
  ethicsRef: string | null;
  cardWanted: CardName;
  weeksWanted: number;
  accessType: AccessType;
  accessWindowLabel: string; // e.g. "30 days"
  retention: string; // e.g. "12 months", or "None (aggregate)"
  /** Flat, disclosed price in devnet USDC (per day for streams, once otherwise). */
  priceUsdc: number;
  priceUnit: "per_day" | "once";
  /** Per-study researcher pubkey (mitigation for on-chain linkage). */
  researcherPubkey?: string;
  fullNotice: string;
}

// ---------- Grants ----------

/** Mirrors the Anchor enum order: 0 active, 1 revoked, 2 consumed. Expired is derived from expires_at. */
export type GrantStatus = "Active" | "Revoked" | "Consumed" | "Expired";

export const ACCESS_TYPE_CODE: Record<AccessType, number> = {
  snapshot_24h: 0,
  stream_30d: 1,
  single_query: 2,
};

/** What the public chain sees. IDs, hashes, timestamps, prices, statuses only. */
export interface OnChainGrant {
  player: string;
  researcher: string;
  grantId: string; // hex, 16 random bytes
  bountyHash: string; // hex, salted sha256 of the bounty id
  accessType: AccessType;
  createdAt: number; // unix seconds
  expiresAt: number; // unix seconds
  pricePerDay: number; // USDC base units (6 decimals)
  status: GrantStatus;
  auto: boolean;
  ruleHash: string | null; // hex
  revokedAt: number | null;
}

/** App-side view joining a grant with its off-chain context. Never written on-chain. */
export interface GrantView extends OnChainGrant {
  bountyId: string;
  cardId: string;
}

export interface OnChainRuleDelegate {
  player: string;
  delegate: string;
  ruleHash: string;
  expiresAt: number;
  active: boolean;
}

// ---------- Auto-accept rulesets (off-chain; only the hash goes on-chain) ----------

export interface Ruleset {
  ruleId: string;
  label: string;
  match: {
    orgType: Exclude<OrgType, "commercial">;
    requiresEthicsApproval: true;
    cardTypes: CardName[];
    dataForm: "pseudonymised";
    minPricePerDayUsdc: number;
    maxAccess: AccessType;
  };
  expiresAt: string; // ISO date, at most 90 days out
  notify: "after_each_accept";
}

// ---------- Key service ----------

export interface EncryptedBatch {
  grantId: string;
  batch: number;
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

export interface KeyRelease {
  grantId: string;
  batch: number;
  key: string; // base64, AES-256
  payoutSig?: string; // devnet USDC transfer signature for stream batches
}

export interface ErasureRequest {
  grantId: string;
  researcher: string;
  revokeTx: string;
  requestedAt: string; // ISO
}

/** Demo clock: one "day" of a stream is 10 seconds. */
export const DEMO_DAY_SECONDS = 10;
