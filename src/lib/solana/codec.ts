import type { AccessType, GrantStatus, OnChainGrant } from "../types";

// Pure byte and text formats for the data_deck_grants program and the Memo fallback.
// No Node or web3 imports, so both the server backends and the browser tx builders can use it.

/** Anchor discriminators: first 8 bytes of sha256("global:<ix>") / sha256("account:<Name>"). Checked in tests. */
export const DISC = {
  createGrant: [19, 119, 176, 223, 45, 142, 225, 156],
  revokeGrant: [134, 180, 57, 39, 152, 7, 154, 98],
  consumeGrant: [73, 180, 19, 83, 37, 23, 141, 99],
  disableDelegate: [72, 67, 145, 11, 191, 67, 66, 72],
  setRuleDelegate: [85, 110, 240, 86, 44, 120, 83, 166],
  grantAccount: [161, 166, 11, 205, 204, 135, 205, 54],
} as const;

const ACCESS_TYPES: AccessType[] = ["snapshot_24h", "stream_30d", "single_query"]; // index = on-chain u8
const STATUSES: GrantStatus[] = ["Active", "Revoked", "Consumed"]; // index = on-chain u8; Expired is derived

export const accessTypeCode = (t: AccessType) => ACCESS_TYPES.indexOf(t);

/** Byte offsets of the Grant account (8-byte discriminator + fields in lib.rs order). Total 187 bytes. */
export const GRANT_LAYOUT = {
  player: 8,
  researcher: 40,
  grantId: 72,
  bountyHash: 88,
  accessType: 120,
  createdAt: 121,
  expiresAt: 129,
  pricePerDay: 137,
  status: 145,
  auto: 146,
  ruleHash: 147,
  revokedAt: 179,
  size: 187,
} as const;

export function hexToBytes(hex: string, length: number): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`).test(hex)) throw new Error(`expected ${length} bytes of lowercase hex`);
  return Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16));
}

export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/**
 * Decodes a Grant account. Pubkeys come back as raw 32 bytes; the caller turns them into base58
 * (keeps this file free of web3). Returns null if the data is not a Grant account.
 */
export function decodeGrant(
  data: Uint8Array,
  toBase58: (bytes: Uint8Array) => string,
): OnChainGrant | null {
  if (data.length < GRANT_LAYOUT.size) return null;
  if (!DISC.grantAccount.every((b, i) => data[i] === b)) return null;
  const L = GRANT_LAYOUT;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const i64 = (o: number) => Number(view.getBigInt64(o, true));
  const slice = (o: number, n: number) => data.subarray(o, o + n);

  const accessType = ACCESS_TYPES[data[L.accessType]];
  const status = STATUSES[data[L.status]];
  if (!accessType || !status) return null;

  const ruleHash = slice(L.ruleHash, 32);
  const revokedAt = i64(L.revokedAt);
  return {
    player: toBase58(slice(L.player, 32)),
    researcher: toBase58(slice(L.researcher, 32)),
    grantId: bytesToHex(slice(L.grantId, 16)),
    bountyHash: bytesToHex(slice(L.bountyHash, 32)),
    accessType,
    createdAt: i64(L.createdAt),
    expiresAt: i64(L.expiresAt),
    pricePerDay: Number(view.getBigUint64(L.pricePerDay, true)),
    status,
    auto: data[L.auto] === 1,
    ruleHash: ruleHash.every((b) => b === 0) ? null : bytesToHex(ruleHash),
    revokedAt: revokedAt === 0 ? null : revokedAt,
  };
}

/** create_grant args: grant_id[16], bounty_hash[32], access_type u8, price_per_day u64 (little-endian). */
export function encodeCreateGrant(grantIdHex: string, bountyHashHex: string, accessType: AccessType, pricePerDay: number) {
  const out = new Uint8Array(8 + 16 + 32 + 1 + 8);
  out.set(DISC.createGrant, 0);
  out.set(hexToBytes(grantIdHex, 16), 8);
  out.set(hexToBytes(bountyHashHex, 32), 24);
  out[56] = accessTypeCode(accessType);
  new DataView(out.buffer).setBigUint64(57, BigInt(pricePerDay), true);
  return out;
}

/** set_rule_delegate args: delegate pubkey (32), rule_hash[32], expires_at i64 (little-endian). */
export function encodeSetRuleDelegate(delegate: Uint8Array, ruleHashHex: string, expiresAt: number) {
  const out = new Uint8Array(8 + 32 + 32 + 8);
  out.set(DISC.setRuleDelegate, 0);
  out.set(delegate, 8);
  out.set(hexToBytes(ruleHashHex, 32), 40);
  new DataView(out.buffer).setBigInt64(72, BigInt(expiresAt), true);
  return out;
}

// ---------- Memo fallback ----------
// Signed by the player:
//   dd:grant id=<32 hex> type=S24|S30|Q1 exp=<unix s> price=<USDC base units> res=<researcher pubkey> bh=<64 hex>
//   dd:revoke id=<32 hex>
//   dd:rules d=<delegate pubkey> rh=<64 hex> exp=<unix s>     (registers the auto-accept delegate)
//   dd:rules-off                                              (kill switch: disables the delegate)
// Signed by the rule delegate for a player (auto-accept): dd:grant ... p=<player pubkey> rh=<64 hex>
// Same fields as the Grant / RuleDelegate accounts; nothing health-related.

const MEMO_TYPE: Record<AccessType, string> = { snapshot_24h: "S24", stream_30d: "S30", single_query: "Q1" };
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export interface GrantMemo {
  kind: "grant";
  grantId: string;
  accessType: AccessType;
  expiresAt: number;
  pricePerDay: number;
  researcher: string;
  bountyHash: string;
  /** Set only on delegate-signed (auto-accept) grants. */
  player?: string;
  ruleHash?: string;
}
export interface RulesMemo {
  kind: "rules";
  delegate: string;
  ruleHash: string;
  expiresAt: number;
}
export type DdMemo = GrantMemo | RulesMemo | { kind: "revoke"; grantId: string } | { kind: "rules-off" };

export function formatGrantMemo(m: Omit<GrantMemo, "kind">): string {
  const base = `dd:grant id=${m.grantId} type=${MEMO_TYPE[m.accessType]} exp=${m.expiresAt} price=${m.pricePerDay} res=${m.researcher} bh=${m.bountyHash}`;
  return m.player && m.ruleHash ? `${base} p=${m.player} rh=${m.ruleHash}` : base;
}

export const formatRevokeMemo = (grantId: string) => `dd:revoke id=${grantId}`;
export const formatRulesMemo = (m: Omit<RulesMemo, "kind">) => `dd:rules d=${m.delegate} rh=${m.ruleHash} exp=${m.expiresAt}`;
export const RULES_OFF_MEMO = "dd:rules-off";

/** Parses one memo string; returns null for anything that is not a well-formed dd: memo. */
export function parseMemo(text: string): DdMemo | null {
  const [head, ...pairs] = text.trim().split(/\s+/);
  const f: Record<string, string> = Object.fromEntries(pairs.map((p) => p.split("=", 2)));
  const int = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : null);

  if (head === "dd:rules-off") return pairs.length === 0 ? { kind: "rules-off" } : null;
  if (head === "dd:rules") {
    const expiresAt = int(f.exp);
    if (!PUBKEY_RE.test(f.d ?? "") || !HASH_RE.test(f.rh ?? "") || expiresAt === null) return null;
    return { kind: "rules", delegate: f.d, ruleHash: f.rh, expiresAt };
  }

  if (!/^[0-9a-f]{32}$/.test(f.id ?? "")) return null;
  if (head === "dd:revoke") return { kind: "revoke", grantId: f.id };
  if (head !== "dd:grant") return null;

  const accessType = (Object.keys(MEMO_TYPE) as AccessType[]).find((t) => MEMO_TYPE[t] === f.type);
  const expiresAt = int(f.exp);
  const pricePerDay = int(f.price);
  if (!accessType || expiresAt === null || pricePerDay === null) return null;
  if (!PUBKEY_RE.test(f.res ?? "") || !HASH_RE.test(f.bh ?? "")) return null;
  const memo: GrantMemo = { kind: "grant", grantId: f.id, accessType, expiresAt, pricePerDay, researcher: f.res, bountyHash: f.bh };
  if (f.p !== undefined || f.rh !== undefined) {
    if (!PUBKEY_RE.test(f.p ?? "") || !HASH_RE.test(f.rh ?? "")) return null;
    memo.player = f.p;
    memo.ruleHash = f.rh;
  }
  return memo;
}

/**
 * The RPC puts memos on each signature as "[len] text", several joined by "; ".
 * Returns the dd: memos found in that string.
 */
export function parseRpcMemoField(field: string | null | undefined): DdMemo[] {
  if (!field) return [];
  return field
    .split("; ")
    .map((s) => parseMemo(s.replace(/^\[\d+\]\s*/, "")))
    .filter((m): m is DdMemo => m !== null);
}
