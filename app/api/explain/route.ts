import { findBounty, fullNotice } from "@/lib/bounties";
import { AI_SUMMARY_LABEL, cachedSummary } from "@/lib/explain";

/**
 * Consent sheet content (FR-3): labelled AI summary on top, full notice below.
 * Body: { bountyId }. If Claude is unavailable the summary is null and the full notice still returns,
 * so the consent sheet keeps working.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { bountyId?: string };
  const bounty = body.bountyId ? findBounty(body.bountyId) : undefined;
  if (!bounty) return Response.json({ error: "bounty_not_found" }, { status: 404 });

  const notice = fullNotice(bounty);
  try {
    const text = await cachedSummary(bounty.bountyId, notice);
    return Response.json({ bountyId: bounty.bountyId, summary: { label: AI_SUMMARY_LABEL, text }, notice });
  } catch (error) {
    console.error("explain: summary unavailable:", error instanceof Error ? error.message : error);
    return Response.json({ bountyId: bounty.bountyId, summary: null, notice });
  }
}
