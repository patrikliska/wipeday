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
1. Storage is full -> **Collect** (the status line says so; the button must agree)
2. A base upgrade is affordable and nothing is building -> **Build**
3. A tool upgrade is affordable -> **Tools**
4. Furnace output is ready, or ore is waiting and a slot is free -> **Furnace**
5. Gather bonus is ready -> **Gather**
6. Otherwise -> **Collect** (always usable, never harmful)

## Buttons (two rows, Phase 2)
| Label | Style | Action |
| --- | --- | --- |
| Collect | primary/secondary | Bank accrued resources, show deltas, edit in place |
| Gather / `Gather · on cooldown` | primary/secondary, disabled on cooldown | Active bonus |
| Tools | primary/secondary | Ephemeral tools screen |
| Build | primary/secondary | Ephemeral build screen |
| Refresh | secondary | Re-render with current numbers |
| Furnace | primary/secondary | Ephemeral furnace screen (Phase 2) |
| Craft | secondary | Ephemeral craft screen (Phase 2) |
| Inventory | secondary | Ephemeral inventory screen (Phase 2) |

Phase 2 buttons appear only once the tier that unlocks them is reached (rule 6: reveal
mechanics as they become relevant), except Build, which is always there.

## Status and details (Phase 2 additions)
- Building: `Upgrading to Stone · done <t:R>` replaces the storage status while a build runs.
- Upkeep: a details line `Upkeep paid for 18h` / `DECAYING · pay upkeep by collecting` in
  the warning/danger tone; a decaying base makes the container red.
- Furnaces: a details line `Furnace: 320 metal frags ready` when output waits.

Root screen: no Back/Home. customIds carry the owner's Discord id; other users get
`error.not_your_message`.
