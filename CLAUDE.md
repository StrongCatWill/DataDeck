# Data Deck (v2, GDPR-hardened)

One-day Solana hackathon app: Next.js on **devnet**. Weekly health data (sample CSV) becomes collectible cards.
Researchers post bounties. Trading a card opens a **consent grant**, not a sale: a time-limited, revocable access window.

- Grant types: 24h snapshot, 30-day stream (one batch per day; 1 day = 10 s in the demo), single query (aggregate only).
- Each data batch is AES-256-GCM encrypted with its own key. `/api/keys/[grantId]/[batch]` releases a key only if the
  grant is Active and unexpired; otherwise 403 and every unreleased key for that grant is destroyed.
- Kill switch revokes grants on-chain (plus `disable_delegate`, same tx); the key API then refuses.
- Auto-accept rules let a server delegate key create grants for **verified non-profit studies with an ethics ref only**,
  max 30-day stream, rules expire within 90 days. Commercial buyers never auto-match.

## Hard rules
- Nothing health-related on-chain: no card names, values or study topics in any tx, memo or account. Only IDs, salted
  hashes, timestamps, prices, statuses.
- UI copy never says "sell", "anonymous" or "deleted forever". Say "lend", "pseudonymised", "stop sharing".
- Never promise revocation is retroactive: already-decrypted batches cannot be recalled; we log an erasure request.
- Secrets live in `.env.local`, server-side only. Never `NEXT_PUBLIC_` a secret.
- AI summaries are labelled "AI-generated summary" and sit above the full notice with an explicit Confirm.

## Layout
- `src/lib/types.ts` shared contract for all roles. Change it deliberately.
- `src/lib/grants.ts` grant backend (`GRANT_BACKEND=mock|anchor|memo`); only `mock` exists so far.
- `src/lib/vault.ts` per-batch encryption and in-memory key store.
- `src/lib/rules.ts` auto-accept guardrails. `src/lib/cards.ts` card rules. `src/lib/bounties.ts` sample bounties.
- `program/lib.rs` Anchor program for Solana Playground.
