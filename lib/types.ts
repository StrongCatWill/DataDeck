// Shared contract between the Solana (A), frontend (B) and backend (C) roles.
// Mirrors exactly what is on-chain: IDs, timestamps, status, access type, expiry, price.
// Nothing health-related belongs in these types.

export type GrantStatus = "active" | "revoked" | "consumed";

export type AccessType = "snapshot24h" | "stream30d" | "singleQuery";

export interface Grant {
  /** 16 random bytes as 32 lowercase hex chars. */
  grantId: string;
  status: GrantStatus;
  accessType: AccessType;
  /** Unix time in seconds. */
  expiresAt: number;
  /** Devnet USDC base units (6 decimals): 600000 = 0.60 USDC per day. */
  pricePerDay: number;
}
