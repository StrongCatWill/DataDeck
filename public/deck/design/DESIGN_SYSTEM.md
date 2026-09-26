# Data Deck

Data Deck turns weekly wearable data into collectible cards that players can lend to research, by the day, with an off switch they always hold. The design system makes that feel like a bold card game on the surface and a precise, trustworthy instrument underneath.

## Principles

1. **Bold on the cards, calm in the contract.** Colour, big shapes and motion live on cards, packs and payouts. Consent sheets, notices and the kill switch are plain, high-contrast and slow to read.
2. **Sharp, not soft.** Corners stop at `radius-lg` (6px). Edges are 2px `line` borders with a hard `shadow-hard` offset. Nothing is pill-shaped except the countdown ring.
3. **Every colour has one job.** `cobalt` acts, `mint` pays, `sun` is Legendary and lending, `danger` stops. Never swap them for decoration.
4. **Say exactly what happens.** Copy names the real outcome: "Lend 30 days", "Stop sharing", "Access revoked by participant".

## Voice and copy

- Say **lend, share for 30 days, grant access**. Never "sell", "trade away" or "forever".
- Say **pseudonymised**. Never "anonymous" or "anonymised".
- Say **"Stops future access. Data already shared can't be recalled."** Never "deleted forever" or "disappears".
- AI text always sits in a box labelled **AI-generated summary**, above the researcher's full notice.
- Prices are flat and per day: **0.60 USDC / day**. Levels never change what a bounty pays.
- Sentence case everywhere except `label` style, which is uppercase.

## Colour

| Token | Job | Text on it |
| --- | --- | --- |
| `paper` | Page ground | `ink` |
| `surface` | Cards, rows, sheets | `ink` |
| `surface-sunk` | AI summary well, locked batch | `ink` |
| `cobalt` | Primary action, links, Rare | `on-cobalt` |
| `tangerine` | Pack energy, illustration highlights | `ink` |
| `sun` | Legendary, lending badge, countdown | `ink` |
| `mint` | USDC received, grant active | `ink` |
| `danger` | Kill switch, Access revoked | `on-danger` |

Rarity uses `rarity-common` (slate), `rarity-rare` (cobalt), `rarity-epic` (violet) and `rarity-legendary` (sun), always with the rarity word printed on the card, so colour never carries it alone.

## Type

- **Unbounded** (`display`) for screen titles and card names: wide, heavy, game-like. One `display-xl` per screen at most.
- **Onest** (`sans`) for everything people read closely: notices, rows, buttons.
- **JetBrains Mono** (`mono`) for every number: USDC, countdowns, grant IDs, batch numbers. Always tabular.

## Shape and depth

- Borders: `border-w` (2px) in `line` on every component; rarity frames use `border-w-thick` (3px) in the rarity colour.
- Radii: `radius-sm` chips, `radius-md` buttons and rows, `radius-lg` cards and sheets. No other radii.
- Depth is a hard offset, never a blur: `shadow-hard` at rest, `shadow-hard-lg` when lifted, `shadow-pressed` when pressed (the element moves 3px down-right).
- Spacing sits on a 4px grid: `space-1` to `space-8`. Screen gutter `space-4`.

## Graphics

Card art is bold, flat geometry: two to four solid shapes from the palette, square corners, no gradients except the Legendary halftone. Every card has an original illustration plus a tiny chart of that week's data.

| Card | Rarity | Art |
| --- | --- | --- |
| Early Bird | Common | Tangerine sky, a sun half-disc rising behind three ink horizon bars |
| Step Starter | Common | Mint ground, a rising staircase of ink blocks |
| Deep Sleeper | Rare | Cobalt night, a sun-yellow crescent moon, three square stars |
| Calm Heart | Rare | Sun ground, one thick ink pulse line that flattens out |
| Marathon Week | Epic | Violet ground, a thick route line with start and finish squares |
| Perfect Week | Legendary | Sun ground with an ink halftone, the moon, stairs and pulse joined like a constellation |

Onboarding, empty states and the pack use the same shape language: overlapping rectangles and half-discs in cobalt, tangerine and sun. No faces, mascots, emoji or stock icons on cards.

## Iconography

Line icons at 24px, 2px stroke, square caps and mitred joins, in `ink` (Lucide at stroke-width 2 fits). One icon size per screen. Icons always sit beside a word, except the close and back buttons, which carry an accessible label.

## Motion

Motion explains a change: something opened, arrived, locked or paid. Nothing loops.

- `dur-fast` + `ease-out`: presses (element drops onto its shadow).
- `dur-base` + `ease-out`: sheets rise, rows slide in, toasts drop.
- `dur-slow` + `ease-snap`: card flip on reveal, card-to-detail transition.
- `dur-hold`: the kill switch fills a ring while held; release early cancels.
- Reduced motion: every movement becomes a 120ms fade; the hold still takes `dur-hold`.

The full screen-by-screen flow and every animation are in the section "End-to-end flow".

## Accessibility

- Text meets 4.5:1 on its ground in both themes; ink is used on sun, mint and tangerine.
- Status never relies on colour: rarity words, "Lending", "Active", "Revoked" are always printed.
- Touch targets are at least 44px tall. Focus shows a 2px `cobalt` outline offset by 2px.
- The kill switch is reachable in one tap from any active grant, and its hold can be replaced by a double-confirm for users who can't press and hold.
