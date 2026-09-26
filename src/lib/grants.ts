import { getBounty } from "./bounties";
import { randomGrantId, saltedHash, sha256Hex } from "./hash";
import { anchorBackend } from "./solana/anchorGrants";
import { memoBackend } from "./solana/memoGrants";
import type { AccessType, ErasureRequest, GrantStatus, GrantView, OnChainGrant, Ruleset } from "./types";
import { DEMO_DAY_SECONDS } from "./types";

// Grant backend. GRANT_BACKEND selects the implementation:
//   mock   - in-memory, lets roles B and C build before 12:30 (default)
//   anchor - reads/writes the data_deck_grants program on devnet (solana/anchorGrants.ts)
//   memo   - 12:30 fallback: dd:grant / dd:revoke memos (solana/memoGrants.ts)

export interface CreateGrantInput {
  player: string;
  bountyId: string;
  cardId: string;
  rule?: Ruleset; // set when the rule delegate signs
}

export interface GrantBackend {
  createGrant(input: CreateGrantInput): Promise<GrantView>;
  readGrant(grantId: string): Promise<GrantView | null>;
  listGrants(player: string): Promise<GrantView[]>;
  /** Kill switch: revokes every active grant and disables the delegate in one tx. Returns the tx signature. */
  revokeAll(player: string): Promise<{ tx: string; revoked: GrantView[] }>;
  consumeGrant(grantId: string): Promise<void>;
}

const now = () => Math.floor(Date.now() / 1000);

/** Demo clock for streams (30 "days" x 10 s); snapshots use a real 24 hours. */
export function expiresAtFor(accessType: AccessType, createdAt: number): number {
  switch (accessType) {
    case "snapshot_24h":
      return createdAt + 24 * 3600;
    case "stream_30d":
      return createdAt + 30 * DEMO_DAY_SECONDS;
    case "single_query":
      return createdAt + 24 * 3600; // window to run the query; ends as Consumed
  }
}

/** Status as the key service must see it: Active past expires_at is Expired. */
export function effectiveStatus(g: OnChainGrant, at = now()): GrantStatus {
  if (g.status === "Active" && at >= g.expiresAt) return "Expired";
  return g.status;
}

// ---------- mock backend ----------

const g = globalThis as unknown as { __dataDeckGrants?: Map<string, GrantView>; __dataDeckErasures?: ErasureRequest[] };
const store = (g.__dataDeckGrants ??= new Map());
export const erasureLog = (g.__dataDeckErasures ??= []);

const mockBackend: GrantBackend = {
  async createGrant({ player, bountyId, cardId, rule }) {
    const bounty = getBounty(bountyId);
    if (!bounty) throw new Error("Unknown bounty");
    const createdAt = now();
    const grant: GrantView = {
      player,
      researcher: bounty.researcherPubkey ?? "researcher-demo",
      grantId: randomGrantId(),
      bountyHash: saltedHash(bounty.id).hash,
      accessType: bounty.accessType,
      createdAt,
      expiresAt: expiresAtFor(bounty.accessType, createdAt),
      pricePerDay: Math.round(bounty.priceUsdc * 1_000_000),
      status: "Active",
      auto: Boolean(rule),
      ruleHash: rule ? sha256Hex(JSON.stringify(rule)) : null,
      revokedAt: null,
      bountyId,
      cardId,
    };
    store.set(grant.grantId, grant);
    return grant;
  },
  async readGrant(grantId) {
    return store.get(grantId) ?? null;
  },
  async listGrants(player) {
    return [...store.values()].filter((x) => x.player === player);
  },
  async revokeAll(player) {
    const t = now();
    const revoked: GrantView[] = [];
    for (const x of store.values()) {
      if (x.player === player && effectiveStatus(x, t) === "Active") {
        x.status = "Revoked";
        x.revokedAt = t;
        revoked.push(x);
      }
    }
    // TODO: disable_delegate in the same tx once the program exists.
    return { tx: `mock-revoke-${t}`, revoked };
  },
  async consumeGrant(grantId) {
    const x = store.get(grantId);
    if (x) x.status = "Consumed";
  },
};

export function grantBackend(): GrantBackend {
  const mode = process.env.GRANT_BACKEND ?? "mock";
  if (mode === "anchor") return anchorBackend;
  if (mode === "memo") return memoBackend;
  return mockBackend;
}
