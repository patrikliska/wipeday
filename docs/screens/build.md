# Screen: `build` (Base upgrade)

**Reached from:** `base` -> Build. **Visibility:** ephemeral. **Card:** none.
**Builder:** `src/ui/screens/build.ts`.

## Purpose
Rule 4: cost and outcome before commitment. Shows the next base tier, its cost against
stock, the build time, what the tier unlocks (storage, furnaces, workbench, box slots), the
hourly upkeep it will start costing, and the stock left after paying.

## States
| State | Shows | When |
| --- | --- | --- |
| normal | Next tier, cost vs stock, duration, unlocks, upkeep, stock after | Affordable, not building |
| locked | Same, Build button disabled with the shortfall | Not affordable |
| building | Current build with a live `<t:R>` countdown, no Build button | A build is running |
| maxed | "Armored is the top tier" | HQM |

## Primary action rule
Build when affordable; otherwise Back.

## Buttons (one row)
| Label | Style | Action |
| --- | --- | --- |
| Build / `Build · need 1.2k stone` | primary / disabled | Pay, start the timer, back to base |
| Back | secondary / primary when locked or building | Return to base |
| Home | secondary | Return to base |

Twig -> wood is instant per the spec's spirit ("twig instant"): the first upgrade has no
timer so the new player sees the mechanic work at once.
