# Screen: `tasks` (Daily tasks)

**Reached from:** `base` -> Tasks. **Visibility:** ephemeral. **Card:** none.
**Builder:** `src/ui/screens/tasks.ts`.

## Purpose
Three small goals a day, the same three for everyone (seeded by the UTC day), each with a
progress bar and a reward. Rewards are banked the moment a task completes and the home
message says so (`Task done: Smelt 300 ore · +10 scrap`); this screen is the overview.
Tasks a player cannot do yet (no furnace, no workbench) are swapped for ones they can.

## States
| State | Shows | When |
| --- | --- | --- |
| normal | Three tasks with `▰▰▰▱▱ 3/5` bars and rewards, reset time as `<t:R>` | Any time |
| complete | All three ticked, "New tasks <t:R>" | All done |

## Primary action rule
Back is primary (the tasks are done on the base, not here).

## Rows
1. Buttons: Back · Home

Balance in `data/active.json5` (`tasks`): the pool, targets, rewards, how many per day.
