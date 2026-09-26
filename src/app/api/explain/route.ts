import { NextResponse } from "next/server";
import { getBounty } from "@/lib/bounties";

const LABEL = "AI-generated summary";
const MODEL = "claude-sonnet-5";

// POST /api/explain { bountyId } -> a labelled summary shown ABOVE the full notice (FR-3, AI Act Art. 50).
// The consent sheet still shows the full notice and needs an explicit Confirm.
export async function POST(req: Request) {
  const { bountyId } = await req.json();
  const bounty = getBounty(bountyId);
  if (!bounty) return NextResponse.json({ error: "Unknown bounty" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ label: LABEL, summary: "(Summary unavailable: set ANTHROPIC_API_KEY.) Read the full notice below." });
  }

  // TODO(role C): tune the prompt. Copy must never say "sell", "anonymous" or "deleted forever" (NFR-4).
  const prompt =
    `Summarise this research data request for a participant in plain English, in at most three sentences. ` +
    `Say who gets access, for how long, how long they keep it, what it pays, and that they can stop sharing at any time ` +
    `but already-shared data cannot be recalled. The data is pseudonymised, not anonymous. ` +
    `Never use the words "sell", "anonymous" or "deleted forever".\n\n${JSON.stringify(bounty)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return NextResponse.json({ label: LABEL, summary: "Summary unavailable. Read the full notice below." });
  const data = await res.json();
  return NextResponse.json({ label: LABEL, summary: data.content?.[0]?.text ?? "" });
}
