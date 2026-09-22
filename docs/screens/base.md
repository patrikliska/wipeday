# Screen: `base` (Home)

**Commands:** `/start` (creates the player, then this), `/base` (posts or refreshes).
**Visibility:** public, one persistent message per player; every navigation edits it.
**Card:** `base` (`src/render/cards/base.tsx`). **Builder:** `src/ui/screens/base.ts`.

## Purpose
The player's home. Everything starts and ends here. Shows stock, what is waiting to be
collected, and the one thing worth doing next.

## States
| State | Shows | When |
| --- | --- | --- |
| empty | Twig base, Rock, wood and stone at 0, hint "gather" | Right after `/start` |
| normal | Stock, uncollected amounts, cooldown as `<t:R>` | Any later visit |
| full | Storage bar red, status "Storage full · collect" | Uncollected fills the cap |
| stale | Re-rendered silently | State changed since last render |
| error | Ephemeral one-liner | Anything failing |

No locked state: the screen itself is always available.

## Layout
1. Title: `{name}'s base`
2. Status, one line: storage fill and what is waiting, e.g. `Storage 62% · +1.2k wood, +800 stone waiting` or `Gather ready <t:..:R>`
3. Card: base overview
4. Details: last action's deltas (`+214 wood · +160 stone`), when there are any
5. Hint (onboarding), until used twice
6. Buttons

## Primary action rule (`ui/advisor.ts`)
1. A tool upgrade is affordable -> **Tools**
2. Gather bonus is ready -> **Gather**
3. Otherwise -> **Collect** (always usable, never harmful)

## Buttons (one row)
| Label | Style | Action |
| --- | --- | --- |
| Collect | primary/secondary | Bank accrued resources, show deltas, edit in place |
| Gather / `Gather · on cooldown` | primary/secondary, disabled on cooldown | Active bonus |
| Tools / `Tools · need 200 wood` | primary/secondary, disabled if nothing affordable and nothing to see | Opens the ephemeral tools screen |
| Refresh | secondary | Re-render with current numbers |

Root screen: no Back/Home. customIds carry the owner's Discord id; other users get
`error.not_your_message`.
