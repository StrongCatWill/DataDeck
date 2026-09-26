# Data Deck

Collect cards, lend data by the day, keep the off switch.

> **Devnet only. Sample data only. No real health data is used.** (NFR-6)

## Run

```bash
npm install
cp .env.example .env.local   # fill in as parts come online
npm run dev                  # http://localhost:3000, researcher view at /researcher?grant=<id>
```

`GRANT_BACKEND=mock` (the default) keeps grants in server memory so the app, key API and researcher portal work before
the Anchor program is deployed.

## Consent grants

Every trade opens one grant with an access type, an expiry, a flat price and a status only the player can set to Revoked.

| Type | Researcher gets | Ends | Pays |
|---|---|---|---|
| 24-hour snapshot | One encrypted package; key available 24 h | `created_at + 24h` | Once |
| 30-day stream | One encrypted batch per day (10 s in the demo) | Day 30 or kill switch | Per released batch, devnet USDC |
| Single query | One aggregate answer, no raw rows | Consumed after one key release | Once |

**Kill switch** ("Stop sharing"): one transaction revokes every active grant and disables the rule delegate. It stops
all future key releases and payments, destroys every unreleased batch key (crypto-shredding), and logs an erasure
request to the researcher with the revoke transaction as proof of time.

**Auto-accept guardrails** (not editable by the player): verified-registry researchers with an ethics reference only;
commercial buyers never auto-match; at most a 30-day stream; rulesets expire within 90 days; every auto-accept notifies
the player with a kill-switch button.

## What's on-chain

| On-chain (public) | Off-chain (app only) |
|---|---|
| Grant ID (random 16 bytes), player and per-study researcher pubkeys | Card names, rarities, "Why this card?" |
| Salted bounty hash, rule hash | Bounty text, study topic, researcher notice |
| Access type, created/expires/revoked timestamps | Health values (sleep, steps, heart rate) |
| Price per day, status, `auto` flag | Ruleset contents, batch keys, ciphertext |

## Limits

- **Revocation is not retroactive.** Batches a researcher already decrypted cannot be recalled; the erasure request is
  enforced by the researcher agreement, not cryptography (Art. 7(3), 17(1)(b)).
- **Access window ≠ retention.** Each bounty declares both; the consent sheet shows both.
- **Pseudonymised, not anonymous.** Daily wearable series can re-identify people.
- **Wallet links are personal data.** Salted hashes and per-study researcher keys reduce linkage; per-grant wallets
  are roadmap.
- **Demo key store is server memory.** Production needs a managed KMS, per-player key separation and access logging.
- **Production needs a DPIA** (Art. 35), joint-controller arrangements with researchers (Art. 26) and legal review.

## Status of the skeleton

| Part | State |
|---|---|
| Next.js app, wallet connect (devnet), 18+ gate | Working |
| Shared types (`src/lib/types.ts`) | Done |
| Cards from sample CSV with "Why this card?" | Working; thresholds are placeholders until the v1 card rules are pasted in |
| Bounty board, consent sheet with labelled AI summary | Working; full notices are TODO |
| Per-batch AES-256-GCM + key API + crypto-shredding | Working against the mock grant backend |
| Researcher portal (decrypt, lock on revoke) | Working |
| Kill switch | Working against mock; needs the signed on-chain tx |
| Anchor program `program/lib.rs` | Compiles (`cargo check`, anchor-lang 0.31); not yet deployed |
| Anchor/Memo grant backends, USDC payouts, ruleset builder UI, privacy panel, notifications | TODO |

## Roles

- **A. Solana**: deploy `program/lib.rs` from Solana Playground, drop the IDL in `src/idl/`, implement
  `anchorBackend` (and `memoBackend` if the 12:30 checkpoint fails) in `src/lib/grants.ts`, USDC payout in the key route.
- **B. App and game**: pack opening, deck, lending badge + countdown, kill-switch confirm, notifications, privacy panel.
- **C. Data, privacy and AI**: real v1 card rules, full notices, ruleset builder, Claude prompt, README and pitch.
