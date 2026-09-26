// Server-only: plain-language summary of a bounty's full notice, via the Claude API.
// The summary sits above the full notice and is always labelled as AI-generated (AI Act Art. 50).
import Anthropic from "@anthropic-ai/sdk";
import { findBannedCopy } from "./copy";

export const AI_SUMMARY_LABEL = "AI-generated summary";

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You summarise a research data-sharing notice for a player of a health data card game.
Write 2 or 3 short sentences in plain English, second person, for a non-expert.
Cover who gets the data and why, what exactly is shared and for how long, the pay, and that they can stop sharing at any time.
Use only facts stated in the notice; do not add promises, risks or advice that are not in it.
Say the player "lends" access. Describe the data as "pseudonymised".
Never use the words "sell", "sold", "anonymous", "anonymised" or "deleted forever".
Reply with the summary text only.`;

export class ExplainError extends Error {}

/** Only the part of the SDK client we use, so tests can pass a fake. */
export type ExplainClient = { beta: { messages: Pick<Anthropic["beta"]["messages"], "create"> } };

export async function summariseNotice(client: ExplainClient, notice: string): Promise<string> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: notice }],
  });

  if (response.stop_reason === "refusal") throw new ExplainError("Claude declined to summarise this notice");
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new ExplainError("Claude returned an empty summary");
  const banned = findBannedCopy(text);
  if (banned) throw new ExplainError(`Summary used banned wording: "${banned}"`);
  return text;
}

// Summaries depend only on the fixed bounty notice, so each is generated once per server process.
const store = globalThis as unknown as { explainCache?: Map<string, string> };

export async function cachedSummary(key: string, notice: string, client?: ExplainClient): Promise<string> {
  store.explainCache ??= new Map();
  const hit = store.explainCache.get(key);
  if (hit) return hit;
  const text = await summariseNotice(client ?? new Anthropic(), notice);
  store.explainCache.set(key, text);
  return text;
}
