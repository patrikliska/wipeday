# Screen: `node` (Work the node)

**Reached from:** `base` -> Gather (opens automatically as an ephemeral follow-up).
**Visibility:** ephemeral. **Card:** none (the whole point is speed; text edits are fast).
**Builder:** `src/ui/screens/node.ts`.

## Purpose
The thing to do while the gather cooldown runs. Rust rewards hitting the moving X on a
tree; here the "X" is the one highlighted button among four, and it jumps after every hit.
Each hit banks a slice of the gather bonus at once (`+12 wood · +8 stone`), so every click
changes something visible (rule 10). Five hits max; letting the marker fade (no hit within
the window) ends the run.

## States
| State | Shows | When |
| --- | --- | --- |
| running | `Hit the glowing button · 2/5 · marker fades <t:R>`, four position buttons, one primary | Run alive |
| done | `Perfect run · +60 wood · +40 stone` (or how far it got), Home primary | 5 hits, a miss, or the window passed |
| stale | The run has ended meanwhile; shows the done state | Double click after the end |

## Primary action rule
The marker *is* the primary button: the game is to find and press it fast. When the run is
over, Home is primary (back to the base, which already shows the banked bonus).

## Rows
1. Buttons: four positions (`1` `2` `3` `4`), the marker primary, the rest secondary
2. Buttons: Back (re-shows the run) · Home

Balance in `data/active.json5` (`node`): hits per run, percent of the gather bonus per hit,
seconds allowed between hits.
