@AGENTS.md

# Data Deck — hackathon demo (Solana devnet)

Weekly health data (sample CSV) becomes collectible cards. Researchers post bounties.
Trading a card opens a CONSENT GRANT, not a sale: a time-limited, revocable access window.
Source of truth for scope: the Data Deck v2 build guide (PDF in the team drive).

## Hard rules
- Demo only: devnet only, sample data only, no real health data.
- Nothing health-related on-chain: no card names, health values or study topics in any
  transaction, memo or account. Grants hold only IDs, timestamps, status, access type,
  expiry and price.
- UI copy never says "sell", "anonymous" or "deleted forever" (say "lend", "pseudonymised").
- Secrets stay server-side in `.env.local`; never use `NEXT_PUBLIC_` for them.
- Core demo first: card → bounty → consent grant → encrypted batch → researcher requests key
  → kill switch → next key request returns 403. No nice-to-haves until that works.

## Shared contract
- `lib/types.ts` is the contract between roles. Change it only after the team agrees.
- The key API reads grants only through `GrantService` (`lib/grants/`). The mock, Anchor and
  Memo implementations must all return the same `Grant` shape.

## Commands
- `npm run dev` — app on http://localhost:3000
- `npm test` — Vitest unit tests
