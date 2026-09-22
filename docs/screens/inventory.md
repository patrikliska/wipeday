# Screen: `inventory`

**Reached from:** `base` -> Inventory, `craft` -> Inventory. **Visibility:** ephemeral.
**Card:** `inventory` (`src/render/cards/inventory.tsx`). **Builder:** `src/ui/screens/inventory.ts`.

## Purpose
Everything the player owns that is not a raw resource: boxes, workbench, gear. The card is a
Rust-style grid: icon, count badge, name, tier-coloured frame by rarity. Empty state says
where items come from (Craft).

## States
| State | Shows | When |
| --- | --- | --- |
| empty | Card with an empty-grid message | No items |
| normal | Grid, grouped by category, storage line in the status | Items owned |
| full | 24+ item types, 4-digit counts, longest item name | Worst case |

## Primary action rule
Craft (the natural next step) when a workbench is owned; otherwise Back.

## Buttons (one row)
| Label | Style | Action |
| --- | --- | --- |
| Craft | primary / secondary | Opens the craft screen |
| Back | secondary | Return to base |
| Home | secondary | Return to base |
