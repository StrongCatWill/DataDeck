# Data Deck

Data Deck turns a week of sleep, steps and heart-rate data into collectible cards. Players level up from healthy habits, and can lend a card to a research study by the day, with an off switch they always hold. The design system makes the app feel like a bright, tactile mobile game on the surface and a plain, honest contract wherever data is shared.

This is version 2 of the look, now with 3D objects. It replaces the earlier sharp-cornered style and abstract card art with icons, data infographics, game mechanics and a few real 3D pieces (the pack, the coin, the level badge, flip cards).

## Platform

Data Deck is a mobile-only app for iOS and Android, portrait, designed on a 390 × 844 frame. There is no web version. The theme is light only for now.

- Navigation is a floating five-tab dock: Today, Deck, Bounties, Wallet, You. Detail screens push from the right; permissions, consent, Sleep mode, cash out, log out and "Sharing stopped" are bottom sheets.
- Everything that shows data is a button: tiles open their data screen, bars and chart points show that day, log lines open their record, badges and locked cards explain how they are earned.
- Touch targets are at least 44pt. The primary button sits at the bottom of the screen, in the thumb zone.
- Respect safe areas: content clears the notch, and the tab dock sits 10pt above the bottom inset and is 66pt tall.
- Text follows the system font size up to 130%. Layouts stack rather than truncate.

## Data sources

| Source | What it gives | Can cards be lent? |
| --- | --- | --- |
| Apple Health on iPhone, Health Connect on Android | Sleep, steps, heart rate from a watch or phone | Yes |
| This phone (built-in tracker) | Steps from the motion sensor; sleep logged with Sleep mode. No heart rate | Yes |
| Strava | Runs and rides | No: "Cards for you only; can't be lent" |
| Sample data | A ready-made four weeks for trying the app | No |

- Nobody is stuck without a watch: "This phone" is always offered, and declining a permission returns to the list with every other option.
- Health Connect carries Google Fit, Fitbit and Samsung Health data, so never label a button "Google Fit".
- Name what is read in plain words: "Motion and fitness", "Sleep", "Heart rate". Never show API or permission identifiers.
- Phone tracking is less exact than a watch. Say so once, on the sync screen, and never dress it up.

## Principles

1. **Show the data, not decoration.** Every graphic is an infographic: a ring, bars, a pulse line, a countdown. If a shape does not carry a number or a state, remove it.
2. **Icon plus word, always.** Sleep is a moon in `sleep`, steps are footprints in `steps`, heart rate is a heart in `heart`. The icon, the colour and the word travel together everywhere.
3. **Play for habits, never for sharing.** XP, streaks, quests and badges come from walking, sleeping and collecting. Lending gives USDC and nothing else: no XP, no badge, no streak, no countdown pressure.
4. **Game on the outside, contract on the inside.** Cards, packs and rewards are colourful and bouncy. The consent sheet and the kill switch are white, still and exact.
5. **Say exactly what happens.** "Lend for 30 days", "Hold to stop sharing", "Request refused".

## Game system

| Mechanic | Earned by | Shown in |
| --- | --- | --- |
| XP (400 per level) | Quests (+30), opening a pack (+40) | LevelHero, toasts |
| Level 1 to 5: Rookie, Walker, Night Owl, Pacer, Legend | XP | LevelHero, You |
| Streak | At least one quest done that day | LevelHero day dots |
| Quests, three a day | Steps goal, sleep goal, open the pack | Today |
| Badges | Milestones in habits and collecting; one for reading a full notice | You |
| Cards and rarity (1 to 4 gems) | Rules over the week's data, shown under "Why you got this card" | Deck |

Levels and rarity are cosmetic. A study pays the same flat daily price to every player.

## Voice and copy

- Say **lend, borrow, share for 30 days**. Never "sell", "trade away" or "forever".
- Say **pseudonymised**. Never "anonymous" or "anonymised".
- Say **"Stops future access and payments right away. Batches already shared can't be taken back."** Never "deleted forever".
- AI text always sits in a box labelled **AI-generated summary**, above the researcher's full notice.
- Prices are flat with their unit: **0.60 a day**, **3.00 once**.
- No crypto words on the main path: Wallet, balance, payout. Never seed phrase, gas or sign a transaction.
- Sentence case everywhere. Buttons name the outcome.

## Colour

Each data type owns one colour in three steps: the colour, a darker `-d` for lips and text on tints, and a pale `-t` for tiles.

| Token | Job | Text on it |
| --- | --- | --- |
| `cloud` | Screen background | `night`, `muted` |
| `card` | Rows, tiles, sheets | `night`, `muted` |
| `night` | Text; level hero, toasts, Sleep mode | white |
| `sleep` | Brand, primary action, sleep data | white |
| `steps` | Steps data, connected, done | icons and fills; use `steps-d` under white text |
| `heart` | Heart-rate data, notification dot | icons and fills |
| `gold` | XP, level, streak, coin, Legendary, countdown | `night` |
| `sky` | A study matches a card | outlines and fills; `sky-d` text on `sky-t` |
| `danger` | Stop sharing, delete | white |

Status never depends on colour alone: "On loan", "Stopped", "On", the rarity word and "n of 7 on target" are always printed.

## Type

- **Bricolage Grotesque** (`display`) for titles and every number: chunky, friendly and a little odd, which suits a game. Weights 700 and 800, tabular figures for numbers.
- **Figtree** (`sans`) for everything people read closely: notices, rows, buttons, captions.
- Smallest size is `micro` (11px, bold). One `d1` per screen at most.

## Shape and depth

- Corners are generous: `radius-m` (16px) for buttons and quests, `radius-l` (22px) for tiles, rows and cards, `radius-xl` (28px) for sheets and hero blocks.
- Depth is a solid lip, never a soft shadow: `shadow-lip` at rest, `shadow-lip-pressed` when pressed, with the element moving 3px down. Only toasts float (`shadow-float`).
- White surfaces carry a 2px inner outline in `line`. Tinted tiles carry none.
- Spacing sits on a 4px grid. Screen gutter and block gap are `space-4`.

## Infographics

| Element | Shows | Component |
| --- | --- | --- |
| Progress ring | Steps today against the goal; days left on a loan | StatTile, GrantRow |
| Seven bars with a dashed goal line | A week of sleep or steps | StatTile, WeekChart, Card |
| Pulse line | Resting heart rate | StatTile |
| XP bar and day dots | Level progress and the streak | LevelHero |
| Thirty payout bars | One bar per paid day | Balance |
| Icon tiles with check or x | Which data types leave the phone | ConsentSheet |
| Fill sweep | Hold-to-stop progress | KillSwitch |

Charts always print their numbers. Bars that miss the goal fade to 35% rather than turning red: the app shows what happened and does not judge it.

## 3D objects

Four things are modelled in 3D with CSS transforms, because they are the things a player holds: nothing else is.

| Object | Where | Behaviour |
| --- | --- | --- |
| Weekly pack | Deck, Today banner, set-up | Floats, a light sweeps across the foil, tilts to the pointer, shakes and drops away when opened |
| Coin | Wallet balance, cash-out success | Five stacked discs spinning slowly |
| Level badge | Today, You, level-up | A gold hexagon with thickness; bobs gently, spins in once on level-up |
| Cards | Card detail, Today carousel | Tilt to the pointer, flip to a record on the back, rotate in a cover-flow carousel |

Charts get depth too: week bars are blocks with a lighter top and darker side. Icon badges have a 4px inner lip. Consent, the kill switch and every sheet about sharing stay flat.

## Iconography

One family of solid, rounded glyphs on a 24px grid, drawn in a single colour. See the Icons card for the full set. Icons sit in a rounded badge filled with the data colour, and always beside a word, except Back and Close.

## Motion

Motion rewards an action or explains a change. Only the 3D objects move on their own (float, spin, bob), slowly, and never on a screen about sharing.

- `dur-fast`: presses, toggles, the tab bubble.
- `dur-base` + `ease-out`: rows rising in, sheets, toasts.
- `dur-slow` + `ease-snap`: cards dealing, checks popping, numbers counting up.
- 700 to 900ms + `ease-out`: rings and bars filling to their value.
- `dur-hold`: the kill switch fill.
- Once only: confetti on opening a pack, the foil sheen on a Legendary, two wiggles of the pack seal.
- Haptics confirm what motion shows: light on presses and payouts, success on connect and confirm, heavy on a Legendary and at the end of hold-to-stop.
- Reduce Motion (the system setting, or the switch in You, Accessibility): every movement becomes a 120ms fade, the 3D objects stand still, confetti is removed, and the hold still takes `dur-hold`.
- Toasts let taps through, so they never block the back button.

The screen-by-screen flow is in the section "End-to-end flow".

## Accessibility

- Body text meets 4.5:1 on its ground. White text is used only on `sleep`, `night`, `steps-d` and `danger`; `gold` and the orange and green cards take `night` text.
- Touch targets are at least 44pt. Focus shows a 3px `sky` outline offset by 2px.
- The kill switch is one tap from any active loan, and its hold can be replaced by two taps.
- Every chart has a text equivalent beside it ("7 of 7 on target", "1,188 to go").
