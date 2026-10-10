# Screen: `furnace` (Storage and furnaces)

**Reached from:** `base` -> Furnace. **Visibility:** ephemeral. **Card:** none (numbers
change every minute; text with `<t:R>` timers does the job). **Builder:** `src/ui/screens/furnace.ts`.

## Purpose
Turn ore into refined metal. One line per furnace slot: idle, or smelting `{amount} {ore}`
with a live finish time and what is ready to take out. Smelting is the gate to the stone
tier (needs metal fragments), so this screen must be obvious the first time.

## States
| State | Shows | When |
| --- | --- | --- |
| none | What a furnace costs and what it does; Buy button | No furnace owned yet |
| idle | Empty slots, select menu of ores in stock | Furnace owned, nothing running |
| running | Per-slot progress and finish time, Collect button when output is ready | Jobs running |
| locked | Select shows unaffordable ores as such; upgrade to the next furnace type disabled with reason | As applicable |

## Primary action rule
Collect output if any is ready; else Smelt (select) if an ore is in stock and a slot is free;
else Buy/Upgrade furnace if affordable; else Back.

## Rows
1. Select: which ore to smelt (all of it, or as much as the wood allows) — only when a slot is free
2. Buttons: Collect output · Buy/Upgrade furnace (or locked with reason) · Back · Home

Smelting takes all of that ore in stock, limited by the wood on hand (wood is burned up
front) and by a per-job maximum from the data file. A confirm step is skipped: the select
option's description already states cost and duration (rule 4's "trivial threshold" is
judged per option: it shows exactly what will happen).
