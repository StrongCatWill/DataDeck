import { batchesFor } from "./batches";
import { getBounty } from "./bounties";
import { generateCards } from "./cards";
import { loadSampleRows } from "./csv";
import { grantBackend } from "./grants";
import { matches } from "./rules";
import { activeRules, alreadyAccepted, markAccepted, pushNotice, unmarkAccepted, type AutoAcceptNotice } from "./rulesStore";
import { keypairFromEnv } from "./solana/anchorGrants";
import { sealBatches } from "./vault";

// Auto-accept: when a bounty is posted, every player whose ruleset matches gets a grant signed by the
// rule delegate (server key), without a tap. The backend decides how the delegate signs:
//   mock   - in-memory grant, no key needed
//   memo   - delegate signs dd:grant ... p=<player> rh=<rule hash>; counts only if the player's dd:rules memo allows it
//   anchor - delegate signs create_grant; the program checks the RuleDelegate PDA
// Either way the player registered the delegate first (POST /api/rules returns what to sign).

export type AutoAcceptResult =
  | { player: string; status: "accepted"; notice: AutoAcceptNotice }
  | { player: string; status: "failed"; error: string };

/** Public key the player registers as their rule delegate. */
export function delegatePublicKey(): string {
  if ((process.env.GRANT_BACKEND ?? "mock") === "mock") return "mock-delegate";
  return keypairFromEnv("RULE_DELEGATE_SECRET_KEY").publicKey.toBase58();
}

export async function autoAcceptBounty(bountyId: string, now = new Date()): Promise<AutoAcceptResult[]> {
  const bounty = getBounty(bountyId);
  if (!bounty) throw new Error("Unknown bounty");
  const deck = generateCards(loadSampleRows());

  const results: AutoAcceptResult[] = [];
  for (const r of activeRules()) {
    if (alreadyAccepted(r.player, bountyId) || !matches(r.ruleset, bounty, now)) continue;
    const card = deck.find((c) => c.name === bounty.cardWanted);
    if (!card) continue;

    markAccepted(r.player, bountyId); // before the await, so two calls cannot both sign
    try {
      const grant = await grantBackend().createGrant({ player: r.player, bountyId, cardId: card.id, rule: r.ruleset });
      sealBatches(grant.grantId, batchesFor(bounty.accessType, loadSampleRows()));
      const notice: AutoAcceptNotice = {
        player: r.player,
        grantId: grant.grantId,
        study: bounty.researcher,
        accessWindow: bounty.accessWindowLabel,
        expiresAt: grant.expiresAt,
        ruleLabel: r.ruleset.label,
        acceptedAt: now.toISOString(),
      };
      pushNotice(notice);
      results.push({ player: r.player, status: "accepted", notice });
    } catch (e) {
      unmarkAccepted(r.player, bountyId); // e.g. delegate not registered yet: allow a retry
      results.push({ player: r.player, status: "failed", error: (e as Error).message });
    }
  }
  return results;
}
