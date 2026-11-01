# Screen: `craft` (Workbench and crafting)

**Reached from:** `base` -> Craft. **Visibility:** ephemeral. **Card:** none.
**Builder:** `src/ui/screens/craft.ts`.

## Purpose
Craft what the workbench level allows: storage boxes (raise the cap), the next workbench,
and gear for later phases. Rule 11: a select menu, sorted by relevance (affordable first,
then by workbench level), each option with its emoji, its cost in the description, and
unaffordable ones marked.

## States
| State | Shows | When |
| --- | --- | --- |
| normal | Select of recipes, workbench level in the status | Workbench owned |
| none | How to get a workbench (craft it here: it is the one recipe available at level 0) | No workbench |
| locked | Options marked `needs 200 wood`; recipes above the workbench level listed as locked | As applicable |
| result | "Crafted Wood Storage Box · storage +500" with Craft again / Back / Home | After crafting |

Crafting is instant (decision D30). A select choice crafts one unit and shows the result.

## Primary action rule
The result screen's primary is "Craft again"; the list screen has no primary among buttons
(the select is the action), so Back is primary.

## Rows
1. Select: recipe (up to 25)
2. Buttons: Inventory · Back · Home
