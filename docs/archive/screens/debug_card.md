# Screen: `debug_card`

**Command:** `/idle-debug card` (Administrator only). **Visibility:** ephemeral.
**Card:** `base` fixtures (`src/render/cards/base.tsx`). **Builder:** `src/ui/screens/debugCard.ts`.

## Purpose
Prove the whole pipeline inside real Discord: data load -> card render -> attachment ->
Components V2 message -> button round trip -> cache. Also lets the owner flip through the
base card's states on an actual phone, which is the one thing `pnpm preview` cannot show.

## States
| State | Shows | When |
| --- | --- | --- |
| normal | Typical mid-season player | Default after the command |
| full | Worst case: 32-char name, 7-digit amounts, storage full, decaying | Button |
| empty | New player: twig, two resources at 0, no upkeep | Button |
| error | Ephemeral one-line notice (`error.unexpected`) | Render or Discord failure |

No locked state: nothing here costs anything.

## Layout (fixed order, as every screen)
1. Title: "Render pipeline check"
2. Status, one line: "Rendered in {ms} ms · {present}/{planned} assets supplied"
   (or "Served from cache in ..." on a cache hit)
3. Card image
4. Detail: one sentence explaining the tinted placeholder tiles
5. Buttons

## Primary action rule
The primary button is always a state the viewer is not currently looking at:
normal -> "Worst case", full -> "New player", empty -> "Typical player".

## Buttons (one row)
| Label | Style | Action |
| --- | --- | --- |
| Worst case / New player / Typical player | primary + secondary | Switch state |
| Render again | secondary | Same state again; status shows the cache hit |

Root screen: no Back/Home. customIds carry no owner (`-`) because the message is ephemeral.
