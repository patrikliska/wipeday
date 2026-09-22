# Screen: `tools` (Gathering tool upgrade)

**Reached from:** `base` -> Tools. **Visibility:** ephemeral.
**Card:** none (numbers change per click; text is enough). **Builder:** `src/ui/screens/tools.ts`.

## Purpose
Rule 4: show cost and outcome before commitment. The player sees the next tool tier, what
it costs, what they have, the rates before and after, and their stock after paying.

## States
| State | Shows | When |
| --- | --- | --- |
| normal | Next tier, cost vs stock, rates now -> after, stock after | Affordable |
| locked | Same, with the missing amount and the Upgrade button disabled with the reason | Not affordable |
| maxed | "You have the best tools" | Top tier |
| error | Ephemeral one-liner | Anything failing |

## Layout
1. Title: `Upgrade to {tool}`
2. Status: `Costs 200 wood, 100 stone · you have 340 wood, 90 stone`
3. Details: rate lines `Wood +120/h -> +240/h`, new resources unlocked, stock after
4. Buttons

## Primary action rule
Upgrade when affordable; otherwise Back (the player must leave to go gather).

## Buttons (one row)
| Label | Style | Action |
| --- | --- | --- |
| Upgrade / `Upgrade · need 110 stone` | primary / disabled | Pay and switch tool, then back to base |
| Back | secondary / primary when locked | Return to base |
| Home | secondary | Return to base |
