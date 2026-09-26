// NFR-4: copy never says "sell", "anonymous" or "deleted forever" (say "lend", "pseudonymised").
const BANNED = [/\bsell/i, /\bsold\b/i, /anonym/i, /deleted forever/i];

/** Returns the first banned phrase found in text, or null. */
export function findBannedCopy(text: string): string | null {
  for (const pattern of BANNED) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}
