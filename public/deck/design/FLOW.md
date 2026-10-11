# End-to-end flow

Data Deck is a mobile-only app (iOS and Android, portrait, 390 × 844 reference frame). Each step names the screen, what the person does, and the one animation and haptic that explain the change. The researcher's portal is outside the app; the player sees its effect in the activity log.

| # | Screen | Person does | What changes | Animation (tokens) | Haptic |
| --- | --- | --- | --- | --- | --- |
| 1 | Splash | Waits | Three cards fan out: steps, sleep, heart | Cards fan from one stack (600ms, `ease-snap`) | None |
| 2 | Intro, 3 cards | Swipes or taps Next | Collect, lend, stop any time, each with one infographic | Icons pop in order; bars rise 60ms apart | None |
| 3 | Sign in | Taps Continue with Apple, Google or email | Account and wallet created | Button presses onto its lip (`dur-fast`); label becomes a spinner | Light |
| 4 | 18+ check | Picks birth year | Under 18 stops here | Number steps | Tick per step |
| 5 | Where should your cards come from? | Picks Apple Health, This phone, Strava or Sample data | Permission sheet opens | Sheet rises (320ms, `ease-out`) | None |
| 6 | Permission sheet | Leaves toggles on, taps Allow | Source connects | Row turns `steps-t`, "On" pill pops (`ease-snap`) | Success |
| 7 | Setting up | Watches | What was found or set up is listed | Bar fills in three steps; each row rises in with a check | Light per row |
| 8 | Today | Lands on the dashboard | Top bar, level, XP, streak, pack banner, steps ring, sleep bars, closest card, quests | XP bar and ring fill to their values (700 to 900ms) | None |
| 9 | Today (phone tracker) | Taps Start on the Sleep mode tile | Sleep mode sheet with a timer | Night sheet rises; moon pops | Light |
| 10 | Sleep mode | Taps "I'm awake" | Night is logged, quest completes | Toast drops with "+30 XP"; XP bar grows | Success |
| 11 | Deck | Taps the sealed pack | Pack opens; cards appear | Pack drops away (`dur-slow`, `ease-in`); cards deal 90ms apart; confetti once; "+40 XP" toast | Medium, light per card, heavy on Legendary |
| 12 | Card detail | Taps Deep Sleeper | Card grows into the header | Shared element from the grid slot (`dur-slow`, `ease-snap`); chart bars grow 50ms apart | None |
| 13 | Card detail | Reads "Why you got this card", sees "A study wants this card" | Match box appears | Box rises 14px (`dur-base`) | None |
| 14 | Bounties | Opens the tab or taps View | Matching study on top | Rows rise 50ms apart; tab bubble pops | Selection |
| 15 | Consent sheet | Taps Trinity Sleep Lab | Sheet rises | Shimmer, then the AI summary types in | None |
| 16 | Consent sheet | Taps "Lend for 30 days", confirms with Face ID | Loan starts | Face ID tile, then a check pops (`ease-snap`); sheet closes | Success |
| 17 | Loan detail | Sees the countdown | Ring shows days left | Ring draws once | None |
| 18 | Any tab | Receives the daily payout | Balance grows | Toast drops; amount counts up; coin chip bumps | Light |
| 19 | Wallet | Opens the tab | Balance, 30 payout bars, loans, activity | A new bar turns solid each day | Selection |
| 20 | Loan detail | Presses and holds "Hold to stop sharing" | Kill switch arms | Dark fill sweeps over `dur-hold`; release cancels | Ticks every 200ms, then heavy |
| 21 | Sharing stopped sheet | Reads the three outcomes | Loan stopped | Sheet rises; rows appear | Warning |
| 22 | Activity log | Checks proof | "Request refused" appears | New row rises in with a lock badge | None |
| 23 | You | Looks at badges; opens Data sources or Privacy panel | Toggles or disconnects a source | Toggle knob slides (`dur-fast`); row loses its tint | Light |
| 24 | You, Export or delete my data | Confirms with two taps | All loans stop, account removed | Return to Splash with a fade | Warning |

## Flows added in the 3D build

| Flow | Path | Ends with |
| --- | --- | --- |
| Goals | First run step 5, or You, Daily goals, or the Steps and Sleep screens | Quests and the Step Starter card use the new numbers |
| Data screens | Today tile, then Steps, Sleep or Heart | Tap a bar or point to read that day; change the goal; jump to the source |
| Notifications | Bell on Today | Each row opens what it is about; opening the list marks all read |
| Level up | XP passes 400 | Full-screen moment, then the Levels sheet is one tap away |
| One answer | Bounties, Active Ireland, "Share one answer", Face ID | +1.00 once, an "Answered" pill, a receipt with "Ask them to erase my answer" |
| Card not held | Bounties, Heart Health AI | The terms are readable; the action is replaced by "How to earn Calm Heart" |
| Cash out | Wallet, Cash out, pick bank or own wallet, Face ID | Success sheet with the coin; a "Cashed out" log line |
| Records | Any log line or gold batch square | What, when, amount, public reference with Copy |
| After stopping | Loan screen, "Erasure request sent" | Three-step tracker; "Email the study" |
| Profile | You, pencil | Name and colour saved |
| Log out | You, Log out | Sheet says what stays and warns if a loan is running; sign-in reads "Welcome back" and returns to Today |
| Help | You, Help | Six questions, the intro again, Contact us |

## What gives XP, and what never does

| Action | Reward |
| --- | --- |
| Complete a daily quest (steps, sleep) | +30 XP |
| Open the weekly pack | +40 XP |
| Keep a streak | Day dot and a badge at 5 days |
| Lend a card | USDC only. No XP, no badge, no streak |
| Stop sharing | Nothing lost: level, cards and streak stay |

## States every data screen needs

- **Loading:** a shimmer block shaped like the content. Spinners only inside buttons.
- **Empty:** one sentence and one action, e.g. "No loans yet. Lend a card to a study and it shows here with its countdown." with "See bounties".
- **Error:** what went wrong and how to fix it, with a Retry button, e.g. "Couldn't read Apple Health. Check permissions in Settings." Always offer "Use this phone instead".

## Reduced motion

With the system's Reduce Motion on, every movement becomes a 120ms fade and confetti is removed. The hold-to-stop still takes `dur-hold`, and haptics stay.
