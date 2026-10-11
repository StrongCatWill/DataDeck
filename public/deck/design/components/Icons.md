# Icons

Solid, rounded glyphs drawn on a 24px grid in a single colour (`currentColor`). They replace the abstract shapes of the earlier design: every data type, action and status has one icon and keeps it everywhere.

- Three anchors never change: `moon` is sleep (`sleep`), `steps` is steps (`steps`), `heart` is heart rate (`heart`). The colour and the icon always travel together.
- `flame` is the streak, `bolt` is XP, `coin` is USDC, `gem` counts rarity (1 to 4), `stop` is the kill switch.
- Sizes: 12 to 14px inside pills, 18 to 26px in rows and tiles, 34 to 52px as a card emblem or pack seal.
- Icons sit inside a rounded badge (`radius-m`, 44 to 48px) filled with the data colour, with the icon in white. On `gold` the icon is `night`.
- An icon never stands alone as a control, except Back and Close, which carry an accessible label.
- In React Native, draw them with `react-native-svg` from the same paths; do not mix in a second icon family.
