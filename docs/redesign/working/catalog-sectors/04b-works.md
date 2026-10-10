# 04b Works (`works`): "Build it once, build it bigger" (proposal)

The 45 nodes of the Works wedge of the Blast Map. Data: `04b-works.json` (same folder). Names and
lines need the owner's pass. Numbers are starting values the simulator may retune in data.

Works owns lines, milestones, line prices, starting kits and start eras: the tree's main share of
line output. The wedge reads as one story, ring by ring:

- **Rings 1-3 (R2): a running start.** Starter Kit, Hot Coals, faster Twig lines, the Timber start
  and the conveyor belts that tie the base together.
- **Rings 4-6 (R3): the factory.** Union Rules and Full Roster make milestones pay more, Assembly
  Line rewards going deep into Works, the Stone start, the Bigger Kit, and Standing Orders buying
  the Line Mks for you. Keystone: Mass Production.
- **Rings 7-9 (R7): heavy industry.** The Sheet Metal start, smokestacks on every roof, riveted
  Armored lines, Overtime, Barn Raising (the island lands as a town) and Line Mk IV. Keystone:
  Monoculture. Capstone: The Works.

Every slot type, price, edge and wave follows `04-blast-map.md` (template 2.3, quotas 2.2, ladder
3.1, wiring 1.3, waves 1.4). The power budget is `10-balance.md` section 6, which replaces 04's
section 7 for `04b` (10-balance 9).

## 1. Checks run on the file

| Check | Result |
| --- | --- |
| Nodes and types | 45: 24 small, 9 notable, 2 keystone, 4 unlock, 4 automation, 2 completion (quota exact) |
| Template | every slot's type as 04 6.5's slot table; keystones 5.3 and 8.4; completions 4.3 and 9.4 |
| Edges | default wiring exactly (1.3); completions need their whole previous ring; ring 1 needs `ground_zero` |
| Three smalls in a row | never: the longest run of smalls on any chain is 2 |
| Series on a chain | no two chained smalls share a series |
| Prices | all on the ladder and in band; keystones 7,777 and 7.77M; completions 555 and 55.5M; every ×1 price rises ring to ring |
| Waves | rings 1-3 R2, 4-6 R3, 7-9 R7; no Works node needs an R4-R6 system, so nothing is reserved |
| Features | only on unlock, automation and keystone nodes: `bulk_buy` (R2), `autobuy` (R3, shared with Grip's Tool Rack), `mass_production` (R3), `monoculture` and `line_mk_iv` (R7); one wave-1 feature |
| Scene | rings 1-3: Starter Kit, Conveyor Belts, Prefab Walls; 4-6: Stone Foundations; 7-9: Tin Roofs, Smokestacks, Rivet Gun, Barn Raising, Line Mk IV |
| Lengths | names at most 24 characters; every non-small text at most 80 (usable as the blurb) |
| Every `per` has a `max` | yes (Assembly Line, Mass Production) |

The checker is `scripts/check_04b_works.py` in the scratchpad.

## 2. Power budget

Counted with `10-balance.md` 6.2: scoped effects at their mid-game share of line income (line 14
0.8, Armored 0.97, Sheet Metal 0.03, lines 1-11 and Twig to Stone 0); `inc` as the ratio of
`(1 + Σinc)` against Works' own lower-ring incs only (conservative: other sectors' incs make the
real ratio smaller); `milestone_x2` as ×(x/2)³, `roster_x2` as ×(x/2)²; `speed` on all lines as
output; `when: afterglow` at 0.02; `per` effects at their `max`. Keystones sit outside the budget.

### 2.1 Per ring

| Ring | `output` share (10-balance 6.3) | Works uses | Counted from | `line_cost` share (cumulative) | Works uses (cumulative) | Starts and kits (10-balance 6.4) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ×1.15 | ×1.00 | Hot Coals: a Twig line, free mid-game (×1.1 by 04's old tenth weight) | ×0.95 (0.950) | ×1.00 (1.000) | Starter Kit |
| 2 | ×1.2 | ×1.00 | First Light: Twig speed, free (×1.1 by 04's weight) | ×0.90 (0.855) | ×0.90 (0.900) | |
| 3 | ×1.5 | **×1.45** | Elbow Grease I +15%, Conveyor Belts +30% | ×0.90 (0.770) | ×0.90 (0.810) | Timber start |
| 4 | ×1.5 | **×1.33** (×1.39 in week 1) | Union Rules (2.2/2)³; Retooling I-II on Timber and Stone free (Stone ~0.15 of week-1 income) | ×0.85 (0.654) | Shop Floor ×0.85 (0.689) | Bigger Kit |
| 5 | ×2.8 | **×2.60** | Elbow Grease II ×1.3, Assembly Line ×2 at its max | ×0.85 (0.556) | ×0.85 (0.585) | Stone start |
| 6 | ×22 | **×9.0** | Full Roster 2.25, Elbow Grease III 1.5, Retooling III 1.485, Hot Cells I 1.8 | ×0.85 (0.473) | ×0.85 (0.497) | |
| 7 | ×22 | **×16.0** | Elbow Grease IV 1.5, Retooling IV 1.485, Hot Cells II 1.8, Smokestacks 4 | ×0.85 (0.402) | ×0.85 (0.423) | Sheet Metal start |
| 8 | ×22 | **×19.7** | Elbow Grease V 1.5, Rivet Gun 2.455, Overtime 2, Retooling V 1.485, Hot Cells III 1.8 | ×0.85 (0.341) | ×0.85 (0.359) | |
| 9 | ×22 | **×21.6** | The Works 3, Line Mk IV 3, Elbow Grease VI 1.5, Retooling VI 1.485, Retooling VII 1.015, Barn Raising 1.06 | ×0.85 (0.290) | ×0.85 (0.306) | 25 of every open line (Barn Raising) |

Running products against the budget's running totals: output ×1.45 / 2.07 by ring 3, ×5.0 / 8.7
by ring 5, ×308k / 2.0M by ring 9; line prices ×0.306 against the column's ×0.29. Works is at or
under its share in every ring and cumulatively, so nothing moves power earlier.

### 2.2 Ceilings (04 4.2)

| Stat | Works reaches | Ceiling |
| --- | --- | --- |
| `milestone_x2` | 2.2 (Union Rules) | 2.2 |
| `roster_x2` | 3 (Full Roster) | 3 |
| `line_cost` | ×0.306 | ≥ ×0.29 |
| `start_owned` | 25 a line (Bigger Kit, Barn Raising) | 25 |
| `start_era` | Sheet Metal (Tin Roofs) | Sheet Metal |
| `speed` | Twig ×2 (First Light), all ×2 (Overtime) | the share; the 0.1 s floor turns the rest into payout |

### 2.3 Keystones (outside the budget; the keystone rule)

| Keystone | Gain | Downside | Net, by construction | Targets | Costs elsewhere |
| --- | --- | --- | --- | --- | --- |
| Mass Production (5.3, 7,777) | every line +2% per unit of it owned, up to ×8 (at 350 owned) | the speed milestones (25 and 50 owned) do nothing (`feature:mass_production`) | a line at 50 owned ×0.5, at 150 ×1.0, at 350+ ×2.0; never above ×2 | idler: long runs, deep unit counts | every run's first hours and every short run (the active player) |
| Monoculture (8.4, 7.77M) | the highest line you own ×2 | every other line ×0.5 | income × (0.5 + 1.5 × the top line's share): ×1.7 at 0.8, never above ×2; break-even at a third | casual | run openings until the top line is bought; every lower line, offline included |

Data form: Mass Production is a vocabulary `per: owned` effect plus the feature that switches the
speed milestones off. Monoculture is "all lines ×0.5" in data (the lowering effect check 5 looks
for) plus `feature:monoculture`, which multiplies the highest owned line by 4, net ×2.

## 3. The nodes

| Ring.slot | Id | Type | Name | Text | Glass | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `packed_crate` | unlock | Starter Kit | Start every run with 10 Beachcombers and 5 Campfires, already working. | 2 | `ground_zero` | R2 |
| 1.2 | `hot_coals` | small | Hot Coals | Campfires +100%. | 1 | `ground_zero` | R2 |
| 2.1 | `first_light` | notable | First Light | Beachcombers, Campfires and Gardens cycle twice as fast. Up at dawn. | 9 | `packed_crate` | R2 |
| 2.2 | `bulk_discount_1` | small | Bulk Discount I | Line units cost ×0.9. | 5 | `packed_crate`, `hot_coals` | R2 |
| 2.3 | `bulk_buttons` | unlock | Bulk Buttons | Adds Next to the bulk toggle: buys just enough for each line's next milestone. | 4 | `hot_coals` | R2 |
| 3.1 | `elbow_grease_1` | small | Elbow Grease I | All lines +15%. | 44 | `first_light` | R2 |
| 3.2 | `conveyor` | notable | Conveyor Belts | All lines +30%. Belts rattle between the buildings, carrying every product. | 77 | `first_light`, `bulk_discount_1` | R2 |
| 3.3 | `prefab_walls` | unlock | Prefab Walls | Every run starts in the Timber era. The cabin comes flat-packed. | 66 | `bulk_discount_1`, `bulk_buttons` | R2 |
| 3.4 | `bulk_discount_2` | small | Bulk Discount II | Line units cost ×0.9. | 33 | `bulk_buttons` | R2 |
| 4.1 | `big_kit` | automation | Bigger Kit | Start every run with 25 Beachcombers, 25 Campfires and 25 Gardens. | 333 | `elbow_grease_1` | R3 |
| 4.2 | `retooling_1` | small | Retooling I | Timber lines +30%. | 222 | `elbow_grease_1`, `conveyor` | R3 |
| 4.3 | `shop_floor` | completion | Shop Floor | Line units cost ×0.85. The shop floor finally has a floor. | 555 | all of ring 3 | R3 |
| 4.4 | `retooling_2` | small | Retooling II | Stone lines +30%. | 333 | `prefab_walls`, `bulk_discount_2` | R3 |
| 4.5 | `union_rules` | notable | Union Rules | Every ×2 milestone pays ×2.2. The crew read the small print. | 777 | `bulk_discount_2` | R3 |
| 5.1 | `bulk_discount_3` | small | Bulk Discount III | Line units cost ×0.85. | 2,222 | `big_kit` | R3 |
| 5.2 | `stone_foundations` | automation | Stone Foundations | Every run starts in the Stone era. Somebody finally poured concrete. | 3,333 | `retooling_1` | R3 |
| 5.3 | `mass_production` | keystone | Mass Production | Every line +2% per unit of it you own, up to ×8. Speed milestones do nothing. | 7,777 | `shop_floor` | R3 |
| 5.4 | `assembly_line` | notable | Assembly Line | All lines +5% for every Works node you own, up to ×2. | 9,999 | `retooling_2` | R3 |
| 5.5 | `elbow_grease_2` | small | Elbow Grease II | All lines ×1.3. | 4,444 | `union_rules` | R3 |
| 6.1 | `elbow_grease_3` | small | Elbow Grease III | All lines ×1.5. | 44.4k | `bulk_discount_3` | R3 |
| 6.2 | `full_roster` | notable | Full Roster | Roster milestones that pay ×2 pay ×3. Bunting for everyone. | 55.5k | `bulk_discount_3`, `stone_foundations` | R3 |
| 6.3 | `retooling_3` | small | Retooling III | Armored lines ×1.5. | 33.3k | `stone_foundations`, `mass_production` | R3 |
| 6.4 | `hot_cells_1` | small | Hot Cells I | Reactors ×2. | 55.5k | `mass_production`, `assembly_line` | R3 |
| 6.5 | `standing_orders` | automation | Standing Orders | Line Mk II and III buy themselves when affordable, while the page is open. | 33.3k | `assembly_line`, `elbow_grease_2` | R3 |
| 6.6 | `bulk_discount_4` | small | Bulk Discount IV | Line units cost ×0.85. | 22.2k | `elbow_grease_2` | R3 |
| 7.1 | `tin_roofs` | automation | Tin Roofs | Every run starts in the Sheet Metal era. Rain drums on tin, not on you. | 333k | `elbow_grease_3` | R7 |
| 7.2 | `elbow_grease_4` | small | Elbow Grease IV | All lines ×1.5. | 444k | `full_roster` | R7 |
| 7.3 | `bulk_discount_5` | small | Bulk Discount V | Line units cost ×0.85. | 222k | `retooling_3` | R7 |
| 7.4 | `retooling_4` | small | Retooling IV | Armored lines ×1.5. | 333k | `hot_cells_1` | R7 |
| 7.5 | `hot_cells_2` | small | Hot Cells II | Reactors ×2. | 555k | `standing_orders` | R7 |
| 7.6 | `smokestacks` | notable | Smokestacks | All lines ×4. Every building grows a smokestack; the gulls hate it. | 1.11M | `bulk_discount_4` | R7 |
| 8.1 | `elbow_grease_5` | small | Elbow Grease V | All lines ×1.5. | 4.44M | `tin_roofs` | R7 |
| 8.2 | `bulk_discount_6` | small | Bulk Discount VI | Line units cost ×0.85. | 2.22M | `tin_roofs`, `elbow_grease_4` | R7 |
| 8.3 | `rivet_gun` | notable | Rivet Gun | Armored lines ×2.5. Every plate gets a rivet, needed or not. | 9.99M | `elbow_grease_4`, `bulk_discount_5` | R7 |
| 8.4 | `monoculture` | keystone | Monoculture | The highest line you own ×2; every other line ×0.5. The rest can make do. | 7.77M | `bulk_discount_5`, `retooling_4` | R7 |
| 8.5 | `overtime` | notable | Overtime | Every line cycles twice as fast. Nobody asked the crew. | 5.55M | `retooling_4`, `hot_cells_2` | R7 |
| 8.6 | `retooling_5` | small | Retooling V | Armored lines ×1.5. | 3.33M | `hot_cells_2`, `smokestacks` | R7 |
| 8.7 | `hot_cells_3` | small | Hot Cells III | Reactors ×2. | 5.55M | `smokestacks` | R7 |
| 9.1 | `bulk_discount_7` | small | Bulk Discount VII | Line units cost ×0.85. | 22.2M | `elbow_grease_5` | R7 |
| 9.2 | `barn_raising` | notable | Barn Raising | Runs start with 25 of every open line, and lines ×4 while Afterglow lasts. | 99.9M | `bulk_discount_6` | R7 |
| 9.3 | `elbow_grease_6` | small | Elbow Grease VI | All lines ×1.5. | 44.4M | `rivet_gun` | R7 |
| 9.4 | `the_works` | completion | The Works | All lines ×3. You built the whole works. | 55.5M | all of ring 8 | R7 |
| 9.5 | `retooling_6` | small | Retooling VI | Armored lines ×1.5. | 33.3M | `overtime` | R7 |
| 9.6 | `line_mk_iv` | unlock | Line Mk IV | Line Mk IV on the shelf (needs 100 owned): that line ×3, painted sign and all. | 33.3M | `retooling_5` | R7 |
| 9.7 | `retooling_7` | small | Retooling VII | Sheet Metal lines ×1.5. | 22.2M | `hot_cells_3` | R7 |

**Series** (`node_series.<id>`): Bulk Discount I-VII (`line_cost`, every ring from 2 but 4),
Elbow Grease I-VI (`output` all, rings 3 and 5-9), Retooling I-VII (`output` on one era: Timber
and Stone in ring 4, Armored in rings 6-9, Sheet Metal last for faster run openings), Hot Cells
I-III (`output` on the Reactor, rings 6-8). Hot Coals keeps its legacy id and name.

**Costs:** the wedge costs about 353M glass (ring 9 alone 311M). Two paths from nothing: Union
Rules is Hot Coals 1, Bulk Buttons 4, Bulk Discount II 33, Union Rules 777 (4 nodes, 815 glass);
Tin Roofs is Starter Kit 2, First Light 9, Elbow Grease I 44, Bigger Kit 333, Bulk Discount III
2,222, Elbow Grease III 44.4k, Tin Roofs 333k (7 nodes, about 380k).

**Synergies and tensions:** Monoculture with Hot Cells (both feed the Reactor); Full Roster with
Barn Raising (every open line starts at 25, so the roster's ×3 is on from the first second); Tin
Roofs, Retooling VII and Barn Raising together make the opening of a late run fast and loud;
Assembly Line counts every Works node, smalls included; Mass Production keeps node speed (First
Light, Overtime) and loses only the milestones'. Barn Raising and Blast's Hot Core cancel each other
while Afterglow lasts (×4 and ×0.25). Under the Thirteen Dare (at most 13 of a line) Mass
Production is a free +26%, since no line reaches a speed milestone anyway: a small, fair trick.

## 4. Changes from 04's brief, and why

1. **Bulk Buttons does something new.** The ×10/×100/Max toggle already appears in run 1 and is
   kept through every nuke (`02-the-run.md` 2.5, `03-the-big-red.md` 11), so "from the first second
   of every run" did nothing. It now adds a **Next** option that buys exactly enough of a line to
   reach its next milestone ("38/50 → speed ×2" becomes one tap). Feature id kept: `bulk_buy`.
2. **Mass Production rewritten.** As drafted (×2 milestones pay ×3, speed milestones off) it nets
   ×0.56-0.84 on a top line past two or three ×2 milestones, a loss for every archetype, and grows
   as 1.5^N without a bound past 500 owned. The new gain, +2% per unit owned up to ×8, against the
   speed milestones' ×4 nets at most ×2 by construction and rewards deep unit counts in long runs.
3. **Monoculture retuned** from ×3 / ×0.5 (×2.5 for the casual at a 0.8 top-line share, over the
   rule) to ×2 / ×0.5, which can never pass ×2.
4. **Conveyor Belts +30%** (was +10%) to use ring 3's ×1.5 share, the largest piece of the ring's
   ×1.76 in `10-balance.md`.
5. **Ring 4's smalls are Retooling I-II** (Timber and Stone +30%), not kits: Bigger Kit already
   gives lines 1-3 the 25-unit ceiling and Crew's Crew Kits take lines 4-6 in rings 3-4, so a Works
   kit would only duplicate a `set`. There is no Elbow Grease in ring 4: with about +0.75 of
   all-line `inc` below it, a +15% small adds under 10% (check 12). There is no Bulk Discount in
   ring 4: Shop Floor takes the ring's whole ×0.85.
6. **Hot Cells** is a series 04 does not list. It uses the step table's "one line ×2" for rings
   6-9 on the Reactor, the line that earns most from week 2 to the end.
7. **Hot Coals** keeps the legacy value (+100% on one line) instead of the step's +50%, as the
   anchors keep theirs. A Twig line, so free in the budget.
8. **Bigger Kit (4.1) and Stone Foundations (5.2)** stay where 04 puts them, P1's schedule.
   `10-balance.md` 6.4's table lists them a ring later and says P1's schedule gives the same numbers
   to day 180; one ring earlier needs no simulator run.
9. Free notables, written here: Assembly Line (5.4), Smokestacks (7.6), Rivet Gun (8.3), Overtime
   (8.5) and Barn Raising (9.2).

## Open questions

1. **Rings 6-8 run behind the ×22 share** (×9.0, ×16.0, ×19.7) because the template gives Works one
   notable in rings 6 and 7. If the simulator needs the full share, the levers are, in order:
   Smokestacks ×4 → ×5 (ring 7 → ×20.0), Rivet Gun ×2.5 → ×2.75 (ring 8 → ×21.6), and 6.6 Bulk
   Discount IV → a Retooling (ring 6 → ×13.4, with line prices then ending at ×0.36). `04-blast-map.md`
   6.5 and 7.2 still show the older split (×6.5 a ring from ring 6, ×1.2 in ring 3); its own fixed
   ring-9 nodes (The Works ×3, Line Mk IV ×3) already exceed ×6.5, so 04 should adopt
   `10-balance.md` 6.3's numbers.
2. **Elbow Grease I's 10% margin** holds while the other sectors' all-line `inc` in rings 1-2 adds
   up to at most +0.5 (Tally Wall, Personal Best, Pep Talk). Above that, move +5% from Conveyor Belts
   to Elbow Grease I.
3. **Two scope readings for `09` 5.1:** `per: owned` with scope `all` (Mass Production) counts the
   units of the line being folded; `start_owned` with scope `all` (Barn Raising) applies to every
   line the run's start era opens.
4. **Line Mk IV:** 14 new shelf rows `{line}_mk4` at base × 1e12, needing 100 owned, paying
   `mk_mult` like Mk II and III (so Scrapyard's Spare Parts lifts it too); Standing Orders buys them
   as well. Whether a Mk IV may be pocketed is for the Pockets design (`05-meta-layers.md` 4).
5. **Keystone rows for the simulator:** Mass Production's break-even (about 150 owned) and
   Monoculture's (a top-line share of a third) are estimates; both need their R3 / R7 simulator
   rows before shipping (resolution 3.13).
