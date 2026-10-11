# SourceRow

One place the app can get data from.

| Source | What it gives | Can cards be lent? |
| --- | --- | --- |
| Apple Health (Health Connect on Android) | Sleep, steps and heart rate | Yes |
| This phone (built-in tracker) | Steps from the motion sensor, sleep with Sleep mode. No heart rate | Yes |
| Strava | Runs and rides | No: "Cards for you only; can't be lent" |
| Sample data | A ready-made four weeks | No |

- Connected state (`dd-source dd-on`). In You, a connected row shows "Turn off" instead of the pill.
- Connect or Use opens a permission sheet listing each thing in plain words with a toggle each, ending with "Your data stays on this phone."
- Declining returns to the list with every other option still there.
