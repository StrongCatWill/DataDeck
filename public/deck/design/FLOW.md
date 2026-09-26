# End-to-end flow

The demo runs on two screens side by side: the player's phone (390 × 844) and the researcher portal (1440 wide). Each step names the screen, what the person does, and the one animation that explains the change.

| # | Screen | Person does | What changes | Animation (tokens) |
| --- | --- | --- | --- | --- |
| 1 | Onboarding | Confirms 18+ and "sample data only" | Deck unlocks | Hero shapes slide in from three edges, 60ms apart; title rises 12px (`dur-base`, `ease-out`) |
| 2 | My Deck | Taps "Open week 38 pack" | Pack tears; cards appear | Pack wrapper splits top-down; cards deal onto the table 80ms apart, each flips once (`dur-slow`, `ease-snap`); Legendary lands last with one sun flash |
| 3 | Card detail | Taps Deep Sleeper | Card fills the screen | Shared element: the card grows from its grid slot into the detail header (`dur-slow`); "Why this card?" expands inline (`dur-base`) |
| 4 | Card detail | Sees "1 matching bounty" | Bounty chip appears | Cobalt chip slides up from the card's bottom edge (`dur-base`) |
| 5 | Bounty board | Opens bounties | Matching bounty on top | Rows stack in 40ms apart; the match has a cobalt left block and "Matches your card" label |
| 6 | Consent sheet | Taps Trinity Sleep Lab | Sheet rises | Sheet slides up with `shadow-hard-lg`, backdrop dims; AI summary shows a striped placeholder, then text types in line by line |
| 7 | Consent sheet | Taps "Lend 30 days" | Grant opens | Button drops onto its shadow (`dur-fast`), label swaps to a spinner, then a check (`ease-snap`); sheet closes |
| 8 | Card detail | Sees lending state | Card gains "Lending" badge and countdown | Sun badge stamps on (scale 1.2 to 1, `ease-snap`); countdown ring draws once |
| 9 | Researcher portal | Watches | New batch arrives, then decrypts | Row slides in from the right; the ciphertext scrambles into values (`dur-slow`); Paid chip ticks in mint |
| 10 | Player toast | Watches | Payment received | Toast drops from the top; "+0.60 USDC" counts up in mono (`dur-slow`), auto-hides after 4s |
| 11 | Card detail | Presses and holds "Stop sharing" | Kill switch arms | Danger ring fills around the button over `dur-hold`; releasing early drains it back |
| 12 | Stopped sheet | Reads outcome | Grant revoked | Sheet lists what stopped, what was destroyed, what can't be recalled, and the revoke transaction ID |
| 13 | Researcher portal | Requests next batch | Access revoked | Next row blurs, a lock draws in, "Access revoked by participant" stamps on in danger; earlier rows stay but go muted |

## Screen inventory

Onboarding · My Deck with pack · Card detail (resting, lending, stopped) · Bounty board · Consent sheet · Payment toast · Stop sharing sheet · Researcher portal (streaming, revoked) · Rule builder and auto-accept notification (Should, not in the core demo) · Privacy panel · Earnings.
