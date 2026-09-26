import { ruleExpiresAt, ruleHash, validateRuleset } from "./rules";
import type { Ruleset } from "./types";

// Server-side store of each player's auto-accept ruleset (off-chain; only its hash goes on-chain).
// One ruleset per player, like the RuleDelegate PDA, which holds one rule_hash.
// In memory for the demo, like the vault's keys.

export interface PlayerRules {
  player: string;
  ruleset: Ruleset;
  ruleHash: string;
  expiresAt: number; // unix seconds
  /** False after the kill switch; stays off until the player saves a ruleset again. */
  active: boolean;
}

/** Sent after every auto-accept: study, access window and a kill-switch button (guide, "Auto-accept rulesets"). */
export interface AutoAcceptNotice {
  player: string;
  grantId: string;
  study: string;
  accessWindow: string;
  expiresAt: number; // unix seconds
  ruleLabel: string;
  acceptedAt: string; // ISO
}

interface RulesState {
  rules: Map<string, PlayerRules>;
  notices: AutoAcceptNotice[];
  accepted: Set<string>;
}
const g = globalThis as unknown as { __dataDeckRules?: RulesState };
const state: RulesState = (g.__dataDeckRules ??= { rules: new Map(), notices: [], accepted: new Set() });

export function saveRuleset(player: string, ruleset: Ruleset, now = new Date()): { errors: string[]; saved?: PlayerRules } {
  const errors = validateRuleset(ruleset, now);
  if (errors.length > 0) return { errors };
  const saved: PlayerRules = { player, ruleset, ruleHash: ruleHash(ruleset), expiresAt: ruleExpiresAt(ruleset), active: true };
  state.rules.set(player, saved);
  return { errors, saved };
}

export const getRules = (player: string) => state.rules.get(player);
export const activeRules = () => [...state.rules.values()].filter((r) => r.active);

/** Kill switch: the delegate may no longer sign for this player. */
export function disableRules(player: string): boolean {
  const r = state.rules.get(player);
  if (!r?.active) return false;
  r.active = false;
  return true;
}

export const pushNotice = (n: AutoAcceptNotice) => void state.notices.push(n);
export const noticesFor = (player: string) => state.notices.filter((n) => n.player === player);

/** One auto-accept per player and bounty, so a re-posted bounty does not open a second grant. */
export const alreadyAccepted = (player: string, bountyId: string) => state.accepted.has(`${player}:${bountyId}`);
export const markAccepted = (player: string, bountyId: string) => void state.accepted.add(`${player}:${bountyId}`);
export const unmarkAccepted = (player: string, bountyId: string) => void state.accepted.delete(`${player}:${bountyId}`);
