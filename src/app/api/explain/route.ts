import { NextResponse } from "next/server";
import { getBounty } from "@/lib/bounties";
import { AI_SUMMARY_LABEL, cachedSummary } from "@/lib/explain";

const UNAVAILABLE = "Summary unavailable. Read the full notice below.";

// POST /api/explain { bountyId } -> a labelled summary shown ABOVE the full notice (FR-3, AI Act Art. 50).
// The consent sheet still shows the full notice and needs an explicit Confirm, so it works without Claude too.
export async function POST(req: Request) {
  const { bountyId } = (await req.json().catch(() => ({}))) as { bountyId?: string };
  const bounty = bountyId ? getBounty(bountyId) : undefined;
  if (!bounty) return NextResponse.json({ error: "Unknown bounty" }, { status: 404 });

  try {
    const summary = await cachedSummary(bounty.id, bounty.fullNotice);
    return NextResponse.json({ label: AI_SUMMARY_LABEL, summary, notice: bounty.fullNotice });
  } catch (error) {
    console.error("explain: summary unavailable:", error instanceof Error ? error.message : error);
    return NextResponse.json({ label: AI_SUMMARY_LABEL, summary: UNAVAILABLE, notice: bounty.fullNotice });
  }
}
