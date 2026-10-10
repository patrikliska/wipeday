# 04b The Blast Map: the full catalog (proposal)

All 361 nodes of the Blast Map in one place: Ground Zero and the eight sectors of `04-blast-map.md`, as written in `04b-<sector>.json` and checked by `model/treecheck.py`. The data is `04b-blast-map.json` (one array, `ground_zero` first). Names are proposals for the owner's pass; numbers are starting values that the simulator may retune in data. The readable sector notes (`04b-<sector>.md`) explain each writer's choices; where this catalog and a sector note differ, this catalog is current (section 4 lists every change).

**Check result:** 361 nodes, **0 errors**, 7 warnings (section 5). Generated from the JSON by `model/catalog.py`; do not edit by hand.

## 1. How to read it

- **Place.** `ring.slot`: ring 1 is next to Ground Zero, ring 9 is the rim; slots run 1..n clockwise across the sector's wedge (ring sizes 2, 3, 4, 5, 5, 6, 6, 7, 7).
- **Type.** `small` (one stat from the step table, no blurb), `notable` (a named mechanic, ×2 price), `keystone` (rule-bending, works only when slotted, ×3 price, at 5.3 and 8.4), `unlock` and `automation` (may need new code: `feature:<id>`), `completion` (needs every node of the previous ring, at 4.3 and 9.4). "anchor" marks canon 6.7's fixed nodes; "scene" a node that changes the island (its drawing is in the JSON's `scene`).
- **Text.** The player-facing line (the blurb for every node that is not small). *[counts as …]* is the node's `counts_as`: what a feature is worth to the power budget at its cap, which the simulator also uses. *[conflicts …]* names keystones the rebuild screen warns about.
- **Cost** is crater glass, printed as `fmtCount` does (separators below a million).
- **Requires** is OR: one owned parent is enough. A completion needs all of the previous ring (AND). Every edge runs from the previous ring of the same sector (`04` 1.3's default wiring; no extra links).
- **Wave** is the build that shows the node (resolution 3.8): R2 rings 1-3, R3-R5 rings 4-6, R7 rings 7-9. "data Rn" is when a hidden ring 7-9 node joins `blastmap.json5`. "gate n" is the node's own Wipe Day gate (at least its system's agenda count and its ring's gate).

What `treecheck.py` asserts (`04` 9.3, `10-balance.md` 6, resolutions 1.5, 3.8, 3.12, 3.13):

| Check | Rule |
| --- | --- |
| Structure | 361 nodes; 45 per sector; ring sizes 2-7; slots unique; types equal `04` 6's slot tables and 2.2's quotas; keystones at 5.3 and 8.4, completions at 4.3 and 9.4; `04` 6's fixed nodes at their slots |
| Ids and words | unique `snake_case` ids, 2-32 characters, never a sector, line, era, target, flotsam kind or shelf upgrade id; the eight legacy perk ids present; names at most 24 characters, blurbs at most 80 |
| Edges | parents exist, sit in the previous ring of the same sector, include the default wiring, number 1-3 (a completion: the whole ring); acyclic; every node reachable from `ground_zero` |
| Chains | never three small nodes in a row on any path (dynamic programming over the graph); consecutive smalls change series (warning) |
| Costs | on `04` 3.1's ladder and inside the ring's band × type factor; keystones 7,777 and 7.77M; completions 555 and 55.5M; Dead Hand 22,200 |
| Waves | 73 shown in R2, 178 by R3, 191 by R4, 201 by R5, 361 in R7; `04` 1.4's R4 and R5 node lists; no node in data before its system ships; no orphan in any build |
| Effects | every stat, op, `per`, `when` and `scope` registered (`09` 5.1); every `per` has a `max`; `feature:*` only on unlock, automation and keystone nodes; outside keystones nothing worsens a stat; small nodes have one effect |
| Gates | a node touching Rush, Grit, the Flare, the Foreman, Dares or Dead Hand carries at least that agenda count, and no gate sits below its ring's |
| Keystones | a printed downside (an effect that lowers a stat, or a feature, which warns); conflicts name keystones and run both ways |
| Anchors | canon 6.7's nodes with resolution 3.13's values: Glow Lamp `k` +0.02, Union Rules ×2.2, Lone Wolf taps ×50 and no hands, Dead Hand 22,200 |
| Ceilings | `04` 4.2 over all non-keystone nodes: Hustle ×2.25, hold 6 s, drain 5/s, gain 3; Afterglow 900 s and 120 s held; float 25 s (40 s in rain); Night Shift exactly +32 h; offline ×1.772; glass ×2.25; `k` 0.49; Morale per page 0.05, Morale ×1.5; prices ×0.29 / ×0.25 per shelf kind / ×0.5 for eras (errata E25: capped, and measured by the simulator before R3); flotsam ×1.05 / ×1.05; milestone, roster, Mk and rank pays; no node on the Sealed Locker |
| 10% rule | each small from ring 3 raises its stat and scope at least 10% over the lower rings (the Magnet's winches are a timer and exempt, note) |
| Budget | per ring and column, the running product (or sum) of node effects through each ring stays within `10-balance.md` 6.1's running budget +10%; each sector within its share (section 3.3) |
| Taps | the steady tap coefficient `c` = 6 taps/s × p × tap value × Hustle × crits × fells ≤ 0.6 with the whole tree |

## 2. Counts

### 2.1 By sector and type

| Sector | Small | Notable | Keystone | Unlock | Automation | Completion | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grip | 24 | 10 | 2 | 3 | 4 | 2 | 45 |
| Crew | 22 | 8 | 2 | 3 | 8 | 2 | 45 |
| Works | 24 | 9 | 2 | 4 | 4 | 2 | 45 |
| Tide | 22 | 9 | 2 | 7 | 3 | 2 | 45 |
| Bunker | 24 | 9 | 2 | 4 | 4 | 2 | 45 |
| Blast | 24 | 9 | 2 | 4 | 4 | 2 | 45 |
| Logbook | 24 | 8 | 2 | 6 | 3 | 2 | 45 |
| Scrapyard | 23 | 8 | 2 | 4 | 6 | 2 | 45 |
| Ground Zero | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| **Total** | **187** | **70** | **16** | **36** | **36** | **16** | **361** |
| Share | 51.8% | 19.4% | 4.4% | 10.0% | 10.0% | 4.4% | 100% |

### 2.2 By ring

| Ring | Opens at Wipe Day | Nodes | Small | Notable | Keystone | Unlock | Automation | Completion | Running total (with GZ) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | #1 | 16 | 8 | 5 | 0 | 2 | 1 | 0 | 17 |
| 2 | #1 | 24 | 8 | 10 | 0 | 3 | 3 | 0 | 41 |
| 3 | #3 | 32 | 16 | 12 | 0 | 2 | 2 | 0 | 73 |
| 4 | #5 | 40 | 16 | 5 | 0 | 4 | 7 | 8 | 113 |
| 5 | #10 | 40 | 16 | 10 | 8 | 0 | 6 | 0 | 153 |
| 6 | #20 | 48 | 29 | 8 | 0 | 6 | 5 | 0 | 201 |
| 7 | #30 | 48 | 32 | 5 | 0 | 7 | 4 | 0 | 249 |
| 8 | #40 | 56 | 32 | 9 | 8 | 0 | 7 | 0 | 305 |
| 9 | #50 | 56 | 30 | 6 | 0 | 11 | 1 | 8 | 361 |

### 2.3 By build (resolution 3.8)

"Shown" counts nodes drawn and buyable in that build (with Ground Zero); "in data" adds the hidden ring 7-9 nodes already in `blastmap.json5`, which the simulator counts (N15).

| Build | New nodes shown | Shown (running) | Target | In data (running) | What arrives |
| --- | --- | --- | --- | --- | --- |
| R2 | 73 | 73 | 73 | 73 | Ground Zero and rings 1-3 of all eight sectors |
| R3 | 105 | 178 | 178 | 319 | rings 4-6 except 23 reserved slots; 141 ring 7-9 nodes join the data, hidden |
| R4 | 13 | 191 | 191 | 340 | shown: Old Maps, War Stories, Margin Notes, Page Turner, Tall Tales, Field Guide, Old Plans I, Ship's Log I, Dog-eared Pages, Field Notes, Night Log III, Bottle Reader, Sea Stories I; joining the data: Campfire Stories, Bottle Post, Hint Lamp, Pressed Flowers, Archivist, Bound Volume, Treasure Map, Full Log |
| R5 | 10 | 201 | 201 | 358 | shown: Hair Trigger, Foreman's Mate, Flare Gun, Wake-up Call, Dead Hand, Deep Pockets, Quick Winch, Greased Cable, Gold Braid, Sewn Lining; joining the data: Auto Flare, Heavy Coil, Night Crane, Brass Polish, Sentimental, Junk Drawer, Yard Boss, Golden Hook |
| R7 | 160 | 361 | 361 | 361 | rings 7-9 shown; joining the data last: Lost Cargo, Double Dare, Dare Ledger |

Per sector and build (nodes shown):

| Sector | R2 | R3 | R4 | R5 | R7 |
| --- | --- | --- | --- | --- | --- |
| Grip | 9 | 15 | 0 | 1 | 20 |
| Crew | 9 | 15 | 0 | 1 | 20 |
| Works | 9 | 16 | 0 | 0 | 20 |
| Tide | 9 | 15 | 0 | 1 | 20 |
| Bunker | 9 | 15 | 0 | 1 | 20 |
| Blast | 9 | 15 | 0 | 1 | 20 |
| Logbook | 9 | 3 | 13 | 0 | 20 |
| Scrapyard | 9 | 11 | 0 | 5 | 20 |

## 3. The power budget (`10-balance.md` 6)

How a node is counted (`10-balance.md` 6.2, the rules the check uses):

- Multiplicative columns are the product of node effects; `inc` effects count as the ratio of `(1 + Σinc)` with and without the ring, every lower ring owned; additive columns are sums. Every column is checked **cumulatively**: the running product through ring r may exceed the budget's running product by at most 10%. Moving power to a later ring is allowed.
- Each effect counts at its typical state: `night` at 0.1 in rings 1-3 and 0.4 from ring 4, `rain` 0.2, `afterglow` 0.02 (`04` 7.3), `online` 0.1, `offline` at full value; `per` effects at their `max`; features at their `counts_as`.
- Scopes count at their share of line income. Rings 4-9 (mid-game): Reactor 0.82, Ship Breaker 0.15, Radio Mast 0.03, other lines 0 (Armored 0.97, Sheet Metal 0.03). Rings 1-3 (week 1): Radio Mast 0.58 and Sheet Metal 0.83 as 10 gives them; the other week-1 lines are this checker's estimates (Generator 0.18, Dock 0.07, Stone era 0.155, Timber 0.012, Twig 0.003) until `10-balance.md` publishes them.
- `milestone_x2` counts ×(x/2)³, `roster_x2` ×(x/2)², `mk_mult` ×(x/3)², `rank_mult` ×(x/2)⁵, `speed` and `morale` as `output`. Keystones sit outside the budget.
- **Night Shift hours** are checked against `04`'s window plan (+4 h in each of rings 1-8), which `10-balance.md` 6.1's text says its column follows; its table row (+4, 0, +4, 0, +4, +8, +4, +8, 0) runs 4 h behind the plan in rings 2-7 and should be corrected (note 3).

### 3.1 The lines column, ring by ring

| Ring | Budget | Tree (linear count) | Running | Running budget | Used | Time-weighted fold (diagnostic) | Fold running |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ×1.3 | ×1.13 | ×1.13 | ×1.3 | 87% | ×1.13 | ×1.13 |
| 2 | ×1.54 | ×1.21 | ×1.37 | ×2 | 68% | ×1.22 | ×1.37 |
| 3 | ×1.76 | ×1.56 | ×2.13 | ×3.52 | 60% | ×1.56 | ×2.14 |
| 4 | ×2 | ×1.41 | ×3.01 | ×7.05 | 43% | ×1.41 | ×3.02 |
| 5 | ×10 | ×13.3 | ×40 | ×70.5 | 57% | ×14.7 | ×44.3 |
| 6 | ×1,000 | ×1,043 | ×4.17e4 | ×7.05e4 | 59% | ×1,450 | ×6.43e4 |
| 7 | ×1,000 | ×666 | ×2.78e7 | ×7.05e7 | 39% | ×832 | ×5.34e7 |
| 8 | ×1,000 | ×1,176 | ×3.26e10 | ×7.05e10 | 46% | ×1,746 | ×9.33e10 |
| 9 | ×1,000 | ×2,033 | ×6.64e13 | ×7.05e13 | 94% | ×3,659 | ×3.42e14 |

The tree ends at ×6.64e13 of the budget's ×7.05e13 (94%). Rings 1-4 run well behind (the early runaway guard), so rings 5, 8 and 9 may each pass their own ring's figure while every running total holds. The diagnostic columns fold conditions together per line and per time slice instead of counting each effect on its own; see note 1.

### 3.2 Every other column (running total through the ring / running budget)

| Column | r1 | r2 | r3 | r4 | r5 | r6 | r7 | r8 | r9 | Whole tree |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tap` | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | 1.5 / 1.5 | ×1.5 |
| `tap_share` (p) | 1 / 1 | 1.1 / 1.1 | 1.1 / 1.1 | 1.19 / 1.2 | 1.19 / 1.2 | 1.19 / 1.2 | 1.19 / 1.2 | 1.19 / 1.2 | 1.19 / 1.2 | ×1.19 |
| `hustle_max` (+) | 0 / 0 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 / 0.25 | 0.25 |
| crits (average) | 1 / 1 | 1 / 1 | 1.45 / 1.45 | 1.45 / 1.45 | 1.45 / 1.45 | 1.45 / 1.45 | 1.45 / 1.45 | 1.45 / 1.45 | 1.45 / 1.45 | ×1.45 |
| `line_cost` | 1 / 0.95 | 0.9 / 0.855 | 0.81 / 0.769 | 0.689 / 0.654 | 0.585 / 0.556 | 0.497 / 0.473 | 0.423 / 0.402 | 0.359 / 0.341 | 0.305 / 0.29 | ×0.305 |
| `hand_cost` | 0.95 / 0.95 | 0.855 / 0.855 | 0.769 / 0.769 | 0.654 / 0.654 | 0.556 / 0.556 | 0.556 / 0.473 | 0.556 / 0.402 | 0.556 / 0.341 | 0.473 / 0.29 | ×0.473 |
| `upgrade_cost` Grip rungs | 0.85 / 0.85 | 0.765 / 0.722 | 0.689 / 0.614 | 0.558 / 0.553 | 0.558 / 0.497 | 0.558 / 0.448 | 0.558 / 0.403 | 0.558 / 0.363 | 0.558 / 0.326 | ×0.558 |
| `upgrade_cost` Line Mks | 0.85 / 0.85 | 0.722 / 0.722 | 0.65 / 0.614 | 0.585 / 0.553 | 0.527 / 0.497 | 0.527 / 0.448 | 0.474 / 0.403 | 0.427 / 0.363 | 0.346 / 0.326 | ×0.346 |
| `upgrade_cost` island | 0.9 / 0.85 | 0.9 / 0.722 | 0.72 / 0.614 | 0.583 / 0.553 | 0.583 / 0.497 | 0.472 / 0.448 | 0.425 / 0.403 | 0.383 / 0.363 | 0.344 / 0.326 | ×0.344 |
| `era_cost` | 1 / 1 | 1 / 1 | 1 / 1 | 0.9 / 0.9 | 0.81 / 0.81 | 0.81 / 0.729 | 0.81 / 0.656 | 0.729 / 0.59 | 0.729 / 0.531 | ×0.729 |
| `flotsam_rate` | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | ×1.05 |
| `flotsam_effect` | 1 / 1 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | 1.05 / 1.05 | ×1.05 |
| `night_shift` (+h) | 4 / 4 | 8 / 8 | 12 / 12 | 16 / 16 | 16 / 20 | 24 / 24 | 28 / 28 | 32 / 32 | 32 / 32 | 32 |
| `offline` | 1 / 1 | 1 / 1 | 1 / 1 | 1.1 / 1.1 | 1.21 / 1.21 | 1.33 / 1.33 | 1.46 / 1.46 | 1.61 / 1.61 | 1.77 / 1.77 | ×1.77 |
| `glass_gain` | 1.1 / 1.1 | 1.15 / 1.16 | 1.26 / 1.27 | 1.39 / 1.4 | 1.53 / 1.54 | 1.68 / 1.69 | 1.85 / 1.86 | 2.04 / 2.05 | 2.24 / 2.25 | ×2.24 |
| `glow_k` (+) | 0 / 0 | 0.01 / 0.01 | 0.03 / 0.03 | 0.05 / 0.05 | 0.07 / 0.08 | 0.11 / 0.11 | 0.15 / 0.15 | 0.19 / 0.19 | 0.24 / 0.24 | 0.24 |
| `morale_per` (+) | 0 / 0 | 0 / 0 | 0 / 0 | 0.005 / 0.005 | 0.01 / 0.01 | 0.015 / 0.015 | 0.02 / 0.02 | 0.02 / 0.025 | 0.03 / 0.03 | 0.03 |

**Steady tap coefficient:** c = 6 × p 0.0191 × tap value 1.50 × Hustle 2.25 × crits 1.45 × fells 1.0192 = **0.572** (ceiling 0.6, resolution 1.5). Nothing past ring 4 raises `c`; Clear-Cut's fells are a burst while Afterglow lasts and sit outside it.

### 3.3 The lines share by sector (factor used in the ring / share)

`04` 7.2 and `10-balance.md` 6.3 split the lines column differently (each multiplies to the ring's budget). Grip, Tide and Blast record `04` 7.2's split as a trade (10 gives them no `output`); Works, Crew, Logbook, Bunker and Scrapyard follow 10. A sector's share here is the larger of its two figures, checked cumulatively at +10%; the ring totals in 3.1 decide whether the trades hold. They did not until Works gave back part of its ×22 a ring (section 4, the Works row): Works is `04` 7.2's donor for that trade. Small scoped effects on early lines (Twig, Timber, Docks, Beachcombers) count near zero here and show as –.

| Sector | r1 | r2 | r3 | r4 | r5 | r6 | r7 | r8 | r9 | Sector total | Share (04 / 10) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Grip | – | – | – | – | 1.14 / 1.15 | 1.5 / 1.5 | 1.41 / 1.5 | 1.46 / 1.5 | 1.45 / 1.5 | ×5.13 | ×5.82 / ×1 |
| Crew | – | 1.05 / 1.1 | 1.04 / 1.1 | 1.02 / 1.1 | 1.57 / 1.6 | 3.83 / 4.4 | 4.02 / 4.4 | 3.91 / 4.4 | 4.17 / 4.4 | ×440 | ×649 / ×496 |
| Works | 1 / 1.15 | 1 / 1.2 | 1.35 / 1.5 | 1.33 / 1.65 | 2.6 / 2.8 | 9.12 / 22 | 6.11 / 22 | 12 / 22 | 16.3 / 22 | ×5.13e4 | ×1.11e4 / ×2.04e6 |
| Tide | – | – | – | – | 1.19 / 1.2 | 1.42 / 1.5 | 1.39 / 1.5 | 1.26 / 1.5 | 1.45 / 1.5 | ×4.31 | ×6.07 / ×1 |
| Bunker | – | 1.03 / 1.1 | 1.04 / 1.1 | 1 / 1.1 | 1.25 / 1.26 | 1.97 / 2 | 1.96 / 2 | 1.92 / 2 | 1.93 / 2 | ×19 | ×7.41 / ×22.2 |
| Blast | – | – | – | – | 1.1 / 1.1 | 1.39 / 1.4 | 1.39 / 1.4 | 1.39 / 1.4 | 1.39 / 1.4 | ×4.15 | ×4.23 / ×1 |
| Logbook | 1.12 / 1.2 | 1.13 / 1.17 | 1.12 / 1.17 | 1.04 / 1.1 | 1.4 / 1.4 | 2.7 / 2.8 | 2.59 / 2.8 | 2.7 / 2.8 | 2.72 / 2.8 | ×107 | ×81.1 / ×146 |
| Scrapyard | – | – | – | – | 1.25 / 1.26 | 1.9 / 3 | 1.95 / 3 | 1.87 / 3 | 1.94 / 3 | ×16.8 | ×97.2 / ×20.2 |

### 3.4 What the tree costs (glass)

| Ring | Grip | Crew | Works | Tide | Bunker | Blast | Logbook | Scrapyard | Ring | Running |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 3 | 3 | 4 | 3 | 5 | 4 | 4 | 29 | 29 |
| 2 | 23 | 25 | 18 | 20 | 31 | 20 | 22 | 20 | 179 | 208 |
| 3 | 209 | 168 | 220 | 190 | 220 | 179 | 242 | 168 | 1,596 | 1,804 |
| 4 | 2,220 | 1,887 | 2,220 | 1,887 | 2,331 | 2,220 | 2,331 | 1,665 | 16,761 | 18,565 |
| 5 | 26,664 | 21,109 | 27,775 | 23,331 | 22,220 | 23,331 | 25,553 | 21,109 | 191,092 | 209,657 |
| 6 | 188,700 | 233,100 | 244,200 | 266,400 | 277,500 | 233,100 | 233,100 | 222,000 | 1.9M | 2.11M |
| 7 | 2.33M | 2.11M | 3M | 2.33M | 2.22M | 2.33M | 2.33M | 2.33M | 19M | 21.1M |
| 8 | 32.2M | 26.6M | 38.9M | 31.1M | 31.1M | 34.4M | 35.5M | 26.6M | 256M | 277M |
| 9 | 255M | 266M | 311M | 300M | 322M | 289M | 266M | 233M | 2.24B | 2.52B |
| **Sector** | **290M** | **295M** | **353M** | **333M** | **356M** | **326M** | **305M** | **262M** | **2.52B** | |

Lighting the whole map takes 2.52B glass (`04` 3.2 estimated about 2.9B). Wave 1 (rings 1-3) costs 1,804; the first nuke's 10 glass buys the guided basket of ring-1 nodes (`04` 3.4).

## 4. What the checker changed in the sector files

Every change is in `model/fix_04b.py`, applied to the writers' originals (kept in `model/backup_04b/`). All eight files were also re-serialised in one layout, with no change to any other value.

| # | Nodes and change | Why |
| --- | --- | --- |
| 1 | Grip `golden_chip`: `output ×1.5, when: golden_chip` moved from `effects` to `counts_as` (output ×1.5 at its cap); the feature carries the rule<br>Grip `woodpile`: `output +2% a log, per: logs, max ×1.4` moved from `effects` to `counts_as` (output ×1.4 at its cap); the feature carries the rule<br>Grip `trophy_rack`: `output +4% a trophy, per: trophies, max ×1.2` moved from `effects` to `counts_as` (output ×1.2 at its cap); the feature carries the rule | `when: golden_chip`, `per: logs` and `per: trophies` are not registered (09 5.1); the budget still counts the bonus at its cap (04 7.3) |
| 2 | Logbook `personal_best`: added `counts_as` output ×1.075 | a feature's power the writer counted in the share (+15% for the rest of a run, counted at half as 10 6.6 does), now visible to the check |
| 3 | Crew `pay_day`: added `counts_as` output ×1.02<br>Crew `crew_photo`: added `counts_as` output ×1.4<br>Crew `relief_crew`: added `counts_as` output ×1.5 | a feature's power the writer counted in the share (04b-crew 1), now visible to the check |
| 4 | Works `line_mk_iv`: added `counts_as` output ×3 | a feature's power the writer counted in the share (04b-works 2.1), now visible to the check |
| 5 | Bunker `lights_out`: added `counts_as` output ×1.1 | a feature's power the writer counted in the share (04b-bunker 2.1), now visible to the check |
| 6 | Tide `tide_mill`: renamed `tide_pump` (Tide Pump, "a tide pump creaks at the water's edge"); Sea Wall III's requires follows | `tide_mill` is island upgrade 6's id and its prop (02 5.4): one id would name two scene drawings |
| 7 | Crew `campfire_stories`: data_from (none, read as R3) → R4 (`per: entries` needs the Logbook)<br>Tide `lost_cargo`: data_from (none, read as R3) → R7 (the `lost_cargo` flotsam kind and its code ship in R7)<br>Scrapyard `heavy_coil`: data_from (none, read as R3) → R5 (the Magnet ships in R5)<br>Scrapyard `night_crane`: data_from (none, read as R3) → R5 (the Magnet ships in R5)<br>Scrapyard `brass_polish`: data_from (none, read as R3) → R5 (ranks ship in R5)<br>Scrapyard `sentimental`: data_from (none, read as R3) → R5 (Pockets ship in R5)<br>Scrapyard `junk_drawer`: data_from (none, read as R3) → R5 (Pockets ship in R5)<br>Scrapyard `yard_boss`: data_from (none, read as R3) → R5 (ranks ship in R5)<br>Scrapyard `golden_hook`: data_from (none, read as R3) → R5 (the Magnet ships in R5) | no node joins the data before its system ships (04 1.4, 9.3 check 16) |
| 8 | Tide `bottle_post`: `dataFrom` renamed `data_from`<br>Tide `auto_flare`: `dataFrom` renamed `data_from` | one key name in all eight files |
| 9 | all sectors 109 ring 7-9 nodes: `data_from: "R3"` written out where it was implicit | 04 1.4: rings 7-9 join the data in R3 unless their system ships later; now explicit in every file |
| 10 | Grip `hair_trigger`: gate (none) → 20 (Rush (#4) on a ring-6 node (#20))<br>Bunker `wake_up_call`: gate 8 → 10 (Grit (#8) on a ring-5 node (#10))<br>Tide `flare_gun`: gate 15 → 20 (the Flare (#15) on a ring-6 node (#20))<br>Tide `auto_flare`: gate 15 → 40 (the Flare (#15) on a ring-8 node (#40))<br>Logbook `double_dare`: gate 5 → 30 (Dares (#5) on a ring-7 node (#30))<br>Logbook `dare_ledger`: gate 5 → 40 (Dares (#5) on a ring-8 node (#40)) | 04 9.3 check 15: a gate carries the system's agenda count and is at least its ring's gate; nothing opens earlier or later than before |
| 11 | Works `elbow_grease_4`: output more ×1.5 → ×1.3 (scope all)<br>Works `elbow_grease_5`: output more ×1.5 → ×1.3 (scope all)<br>Works `elbow_grease_6`: output more ×1.5 → ×1.3 (scope all)<br>Works `retooling_4`: output more ×1.5 → ×1.3 (scope hqm)<br>Works `retooling_5`: output more ×1.5 → ×1.3 (scope hqm)<br>Works `retooling_6`: output more ×1.5 → ×1.3 (scope hqm)<br>Works `smokestacks`: output more ×4 → ×2 (scope all)<br>Works `rivet_gun`: output more ×2.5 → ×2 (scope hqm) | the lines column ran ×5.5 over 10 6.1 through ring 9 once the writers' feature bonuses were counted: Works spent 10's ×22 a ring while Grip, Tide and Blast took 04 7.2's trade, whose donor is Works; Works rings 7-9 now ×6.1 / ×12.0 / ×16.3, the tree ends at 94% of its budget |
| 12 | Crew `lone_wolf`: conflicts + bunker_mentality, archivist<br>Grip `fever_pitch`: conflicts + archivist | conflicts run both ways, so the rebuild screen warns from either keystone (04 5) |

38 changes in 12 groups. The Works trim (the row naming Elbow Grease IV-VI, Retooling IV-VI, Smokestacks and Rivet Gun) is the only change of power; every other row is vocabulary, data hygiene or a gate that moves nothing.

One later change, by hand: the Sealed Locker's weight is 1%, not 1.5% (errata E15), so Tide `scavengers_eye` sets the Fuel Drum to 99 (was 98.5) and the Locker keeps exactly its 1%.

## 5. Warnings and open items

The check passes. These are warnings it prints and items for other plan files:

1. **Stacked conditions (for `10-balance.md` 6.2; Bunker's open question 1).** Counted one effect at a time, as 6.2 says, the lines column ends at ×6.64e13 against ×7.05e13. Folded together per line and per time slice, the same nodes read ×3.42e14, about ×5.1 more, because conditions multiply inside themselves: at the full tree night pays ×32 the day (Logbook's Night Log I-VI and Almanac, Bunker's Night Lamps, Lantern Oil I-IV, Moonshine Still and Night Owls) and rain ×7.8 (Weather Log, Storm Harvest, Rain Barrels, Rainy Day Fund). Removing night and rain effects brings the two readings within ×1.5. Proposal for 10: count each condition by its fold (`1 + w × (Π f − 1)`, cumulatively), or cap each condition over all non-keystone nodes (night ×4, rain ×3, like the flotsam column). Either way the fix is in data: Night Log III-VI and Rainy Day Fund move most of their value to all-line effects of the same linear count. This catalog keeps the writers' values because 6.2's rule, as written, passes them.
2. **Keystones whose downside lives in a feature:** Mass Production (the speed milestones pay nothing), Tall Tales (lines lose Morale while Hustle runs) and Sentimental (one Pocket slot fewer). Check 5 must read a feature's printed downside, or `09` 5.1 registers a stat for it (Scrapyard's `pocket_cap`). Every keystone still needs its simulator row (resolution 3.13).
3. **Night Shift hours row.** `10-balance.md` 6.1's table gives the window +4, 0, +4, 0, +4, +8, +4, +8, 0 h; its text, `04` 4.2, 6.7, 7.1 and 10.4 give +4 h in each of rings 1-8. The tree never runs ahead of the plan (Bunker puts Root Cellar III in ring 6 beside Cold Storage, so ring 5 adds nothing and ring 6 adds +8 h). Against the table row it runs 4 h ahead in rings 2-7. The row should read +4 in rings 1-8; hours past Deep Cellars move no simulated number.
4. **Week-1 line shares.** Rings 1-3 are counted at the typical state `10-balance.md` 6.1 lists per ring (week 1 for rings 1-3; errata E25); the estimates in 3 stand until the simulator measures it. Every ring 1-4 total is far under its budget, so no estimate changes the result.
5. **Line Mk IV and `mk_mult`.** Mk IV counts ×3. If it pays `mk_mult` like Mk II and III (Works open question 4), Spare Parts, Double Rivets and Yard Boss lift it too (×3.7 to ×4 late) and Yard Boss's Mk part counts (x/3)³; about ×1.4 more at ring 9, inside the remaining room only if the simulator agrees. Simplest: Mk IV pays a flat ×3.
6. **The Magnet's winches** (Quick Winch, Greased Cable, Heavy Coil, Night Crane) add 4-5% each and are exempt from the 10% rule as a timer (Scrapyard open question 1); `04` 9.3 check 12 should say so.
7. **Gates.** Node gates now equal the larger of the system's agenda count and the ring's gate (Hair Trigger 20, Wake-up Call 10, Flare Gun 20, Auto Flare 40, Double Dare 30, Dare Ledger 40, Foreman's Mate 20, Dead Hand 25). Nothing opens earlier or later; `04` 1.4's table ("gate 4", "gate 15" ...) names the system count, which the agenda line still shows.
8. **Names for the naming pass.** Rain Barrels (Tide 6.4) and Cutting Torch (Tide 7.3, 8.2) repeat the Garden's and Ship Breaker's Mk II subtitles (`02` 5.3); one of each should change. Scavenger's Eye's blurb names Bottles and Sealed Lockers, which ship after it (R4, R5): its R3 locale line should leave them out (resolution 3.7). Starter Kit (Works 1.1) is on the list too: a common phrase, but also a Cookie Clicker upgrade name; the id `packed_crate` stays (errata E27).
9. **Lines share left unused** (room for the simulator): Works ends at ×5.13e4, Logbook ×107, Scrapyard ×16.8; the tree as a whole at 94% of its budget.

Checker warnings, verbatim:

- WARN [keystones] mass_production: downside lives in its feature only (check 5 must read it)
- WARN [keystones] tall_tales: downside lives in its feature only (check 5 must read it)
- WARN [keystones] sentimental: downside lives in its feature only (check 5 must read it)
- WARN [budget] output: ring 5 alone x13.3 > x10 +10% (allowed: the running total holds, 10 6.2.1)
- WARN [budget] output: ring 8 alone x1.18e+03 > x1000 +10% (allowed: the running total holds, 10 6.2.1)
- WARN [budget] output: ring 9 alone x2.03e+03 > x1000 +10% (allowed: the running total holds, 10 6.2.1)
- WARN [budget] diagnostic: the time-weighted fold (conditions folded together, not counted one by one) reads x3.42e+14 through ring 9 against x7.05e+13 (linear count x6.64e+13); night stacks to x31.9 and rain to x7.8 at the full tree (10 6.2's counting rule, Bunker OQ 1)
- NOTE [ten_percent] quick_winch: magnet_hours is a timer (exempt, Scrapyard OQ 1)
- NOTE [ten_percent] greased_cable: magnet_hours is a timer (exempt, Scrapyard OQ 1)
- NOTE [ten_percent] heavy_coil: magnet_hours is a timer (exempt, Scrapyard OQ 1)
- NOTE [ten_percent] night_crane: magnet_hours is a timer (exempt, Scrapyard OQ 1)

## 6. The nodes

### 6.0 Ground Zero

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `ground_zero` | unlock (anchor, scene) | Ground Zero | Lit by the first nuke: the map opens and Glow works from Wipe Day #1. | free (the first nuke) | – | R2 |

### 6.1 Grip (`grip`): "Your hands are the first machine"

24 small, 10 notable, 2 keystone, 3 unlock, 4 automation, 2 completion; 290M glass to light. Sector notes: `04b-grip.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `second_wind` | notable | Second Wind | Hustle holds 3 s (was 2) and drains 20% slower | 2 | `ground_zero` | R2 |
| 1.2 | `steady_hands` | small (anchor) | Calloused Hands | Taps +50% | 1 | `ground_zero` | R2 |
| 2.1 | `whetstone` | notable (scene) | Whetstone | Taps carry +0.16% of supplies/s; a whetstone by the target throws sparks | 11 | `second_wind` | R2 |
| 2.2 | `quick_fingers` | small | Quick Fingers | Hustle tops out at ×2.25 (was ×2) | 5 | `second_wind`, `steady_hands` | R2 |
| 2.3 | `keep_swinging` | automation | Keep Swinging | Unmanned lines keep running while Hustle is above zero, not just while you tap | 7 | `steady_hands` | R2 |
| 3.1 | `steady_breath_1` | small | Steady Breath I | Hustle holds +0.5 s | 33 | `whetstone` | R2 |
| 3.2 | `lucky_swing` | notable (anchor) | Lucky Swing | 5% of your taps crit for ×10 | 77 | `whetstone`, `quick_fingers` | R2 |
| 3.3 | `heavy_haft` | notable | Heavy Haft | Fells need 20% fewer taps | 55 | `quick_fingers`, `keep_swinging` | R2 |
| 3.4 | `rhythm_1` | small | Rhythm I | Hustle +0.25 a tap | 44 | `keep_swinging` | R2 |
| 4.1 | `tool_rack` | automation | Tool Rack | Grip rungs buy themselves the moment you can afford them (page open) | 333 | `steady_breath_1` | R3 |
| 4.2 | `slow_burn_1` | small | Slow Burn I | Hustle drains 10% slower | 222 | `steady_breath_1`, `lucky_swing` | R3 |
| 4.3 | `iron_palms` | completion | Iron Palms | Taps carry +0.15% more of supplies/s; Hustle holds 0.5 s longer | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `steady_breath_2` | small | Steady Breath II | Hustle holds +0.5 s | 333 | `heavy_haft`, `rhythm_1` | R3 |
| 4.5 | `afterburn` | notable | Afterburn | Afterglow's half-life 5 → 7 min | 777 | `rhythm_1` | R3 |
| 5.1 | `hard_graft_1` | small | Hard Graft I | All lines ×1.12 | 3,333 | `tool_rack` | R3 |
| 5.2 | `work_song` | notable (scene) | Work Song | Afterglow holds its full ×3 for the first minute; the crew sing while you work | 5,555 | `slow_burn_1` | R3 |
| 5.3 | `wipe_day_rush` | keystone (anchor) | Wipe Day Rush | Afterglow holds ×5 for 60 min, then fades. Night Shift window ×0.5 *[conflicts: hot_core]* | 7,777 | `iron_palms` | R3 |
| 5.4 | `masks_on` | notable (scene) | Masks On | All lines ×2 while Afterglow lasts; the crew work on in gas masks | 7,777 | `steady_breath_2` | R3 |
| 5.5 | `steady_breath_3` | small | Steady Breath III | Hustle holds +0.5 s | 2,222 | `afterburn` | R3 |
| 6.1 | `steady_breath_4` | small | Steady Breath IV | Hustle holds +0.5 s | 22,200 | `hard_graft_1` | R3 |
| 6.2 | `hair_trigger` | automation | Hair Trigger | Rush fires itself the moment Hustle fills (page open) | 33,300 | `hard_graft_1`, `work_song` | R5, gate 20 |
| 6.3 | `rhythm_2` | small | Rhythm II | Hustle +0.25 a tap | 33,300 | `work_song`, `wipe_day_rush` | R3 |
| 6.4 | `slow_burn_2` | small | Slow Burn II | Hustle drains 10% slower | 22,200 | `wipe_day_rush`, `masks_on` | R3 |
| 6.5 | `golden_chip` | unlock (scene) | Golden Chip | A run's 20th fell drops a golden chip: all lines ×1.5 for the rest of the run *[counts as output ×1.5]* | 44,400 | `masks_on`, `steady_breath_3` | R3 |
| 6.6 | `rhythm_3` | small | Rhythm III | Hustle +0.25 a tap | 33,300 | `steady_breath_3` | R3 |
| 7.1 | `long_dawn` | notable | Long Dawn | Afterglow holds its full ×3 for the first 2 minutes | 555,000 | `steady_breath_4` | R7, data R3 |
| 7.2 | `rhythm_4` | small | Rhythm IV | Hustle +0.25 a tap | 222,000 | `hair_trigger` | R7, data R3 |
| 7.3 | `slow_burn_3` | small | Slow Burn III | Hustle drains 10% slower | 333,000 | `rhythm_2` | R7, data R3 |
| 7.4 | `rhythm_5` | small | Rhythm V | Hustle +0.25 a tap | 333,000 | `slow_burn_2` | R7, data R3 |
| 7.5 | `green_sky_1` | small | Green Sky I | All lines ×1.25 while Afterglow lasts | 444,000 | `golden_chip` | R7, data R3 |
| 7.6 | `woodpile` | unlock (scene) | Woodpile | Each fell this run stacks a log by the cabin: all lines +2% a log, up to +40% *[counts as output ×1.4]* | 444,000 | `rhythm_3` | R7, data R3 |
| 8.1 | `hard_graft_2` | small | Hard Graft II | All lines ×1.1 | 3.33M | `long_dawn` | R7, data R3 |
| 8.2 | `hard_graft_3` | small | Hard Graft III | All lines ×1.1 | 4.44M | `long_dawn`, `rhythm_4` | R7, data R3 |
| 8.3 | `clear_cut` | notable | Clear-Cut | While Afterglow lasts, fells need half the taps | 5.55M | `rhythm_4`, `slow_burn_3` | R7, data R3 |
| 8.4 | `fever_pitch` | keystone | Fever Pitch | Hustle peaks at ×6, not ×2; it holds 1.5 s less and drains ×3 as fast *[conflicts: archivist]* | 7.77M | `slow_burn_3`, `rhythm_5` | R7, data R3 |
| 8.5 | `apprentice` | automation (scene) | Apprentice | While the page is open and you aren't tapping, an apprentice taps once a second | 3.33M | `rhythm_5`, `green_sky_1` | R7, data R3 |
| 8.6 | `hard_graft_4` | small | Hard Graft IV | All lines ×1.1 | 4.44M | `green_sky_1`, `woodpile` | R7, data R3 |
| 8.7 | `hard_graft_5` | small | Hard Graft V | All lines ×1.1 | 3.33M | `woodpile` | R7, data R3 |
| 9.1 | `rhythm_6` | small | Rhythm VI | Hustle +0.25 a tap | 22.2M | `hard_graft_2` | R7, data R3 |
| 9.2 | `muscle_memory` | notable | Muscle Memory | Hustle holds 0.5 s longer and fills 0.25 a tap faster (the tree's limits) | 44.4M | `hard_graft_3` | R7, data R3 |
| 9.3 | `green_sky_2` | small | Green Sky II | All lines ×1.25 while Afterglow lasts | 33.3M | `clear_cut` | R7, data R3 |
| 9.4 | `iron_grip` | completion | Iron Grip | All lines ×1.2; Hustle drains 10% slower | 55.5M | all of ring 8 (AND) | R7, data R3 |
| 9.5 | `rhythm_7` | small | Rhythm VII | Hustle +0.25 a tap | 22.2M | `apprentice` | R7, data R3 |
| 9.6 | `trophy_rack` | unlock (scene) | Trophy Rack | Each run with 50+ fells hangs a trophy: all lines +4% a trophy, up to +20% *[counts as output ×1.2]* | 33.3M | `hard_graft_4` | R7, data R3 |
| 9.7 | `green_sky_3` | small | Green Sky III | All lines ×1.25 while Afterglow lasts | 44.4M | `hard_graft_5` | R7, data R3 |

### 6.2 Crew (`crew`): "Every line has a name on it"

22 small, 8 notable, 2 keystone, 3 unlock, 8 automation, 2 completion; 295M glass to light. Sector notes: `04b-crew.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `old_friend` | automation (anchor, scene) | Old Friends | Mara stays hired through every Wipe Day and rows back in with you | 2 | `ground_zero` | R2 |
| 1.2 | `fair_pay_1` | small | Fair Pay I | Hands cost ×0.95 | 1 | `ground_zero` | R2 |
| 2.1 | `hiring_board` | notable (scene) | Hiring Board | Dax stays hired through every Wipe Day too, and every hand costs ×0.9 | 9 | `old_friend` | R2 |
| 2.2 | `work_gang_1` | small | Work Gang I | Twig-era lines +25% | 5 | `old_friend`, `fair_pay_1` | R2 |
| 2.3 | `pep_talk` | notable | Pep Talk | All lines +1% a hand on shift (up to +5%), twice that while Afterglow lasts | 11 | `fair_pay_1` | R2 |
| 3.1 | `work_gang_2` | small | Work Gang II | Timber-era lines +30% | 25 | `hiring_board` | R2 |
| 3.2 | `old_crew_1` | automation (anchor) | Old Crew I | Hands for lines 1-6 stay hired through every Wipe Day | 33 | `hiring_board`, `work_gang_1` | R2 |
| 3.3 | `fair_wages` | notable | Fair Wages | Hands cost ×0.9, and each hand on shift adds +0.5% to all lines (up to +5%) | 66 | `work_gang_1`, `pep_talk` | R2 |
| 3.4 | `crew_kit_1` | small | Crew Kit I | Runs start with 10 Looms, at work as soon as Timber opens | 44 | `pep_talk` | R2 |
| 4.1 | `pay_day` | unlock (scene) | Pay Day | Ring the bell by the cabin once a run: manned lines ×3 for 5 minutes *[counts as output ×1.02]* | 333 | `work_gang_2` | R3 |
| 4.2 | `crew_kit_2` | small | Crew Kit II | Runs start with 10 Workbenches, at work as soon as Timber opens | 222 | `work_gang_2`, `old_crew_1` | R3 |
| 4.3 | `full_crew` | completion | Full Crew | All of Crew's ring 3 lit: hands cost ×0.85 | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `work_gang_3` | small | Work Gang III | Stone-era lines +30% | 333 | `fair_wages`, `crew_kit_1` | R3 |
| 4.5 | `roll_call` | automation | Roll Call | A Roll Call button hires every hand you can afford, keeping the crown's price | 444 | `crew_kit_1` | R3 |
| 5.1 | `fair_pay_2` | small | Fair Pay II | Hands cost ×0.85 | 2,222 | `pay_day` | R3 |
| 5.2 | `old_crew_2` | automation | Old Crew II | Hands for lines 1-10 stay hired through every Wipe Day | 3,333 | `crew_kit_2` | R3 |
| 5.3 | `skeleton_crew` | keystone | Skeleton Crew | Hands cost nothing and manned lines pay ×2, but only five hands work at once *[conflicts: lone_wolf]* | 7,777 | `full_crew` | R3 |
| 5.4 | `bunkhouse` | notable (scene) | Bunkhouse | Rested hands: all lines cycle ×1.3 faster; the bunkhouse stands from the start | 4,444 | `work_gang_3` | R3 |
| 5.5 | `crew_spirit_1` | small | Crew Spirit I | All lines +1.5% a hand on shift (up to ×1.21) | 3,333 | `roll_call` | R3 |
| 6.1 | `crew_spirit_2` | small | Crew Spirit II | All lines +2% a hand on shift (up to ×1.28) | 22,200 | `fair_pay_2` | R3 |
| 6.2 | `foremans_mate` | automation | Foreman's Mate | The Foreman also buys units for lines with no hand on shift | 33,300 | `fair_pay_2`, `old_crew_2` | R5, gate 20 |
| 6.3 | `old_crew_3` | automation | Old Crew III | Every hand stays hired through every Wipe Day | 44,400 | `old_crew_2`, `skeleton_crew` | R3 |
| 6.4 | `work_gang_4` | small | Work Gang IV | Armored-era lines ×1.5 | 33,300 | `skeleton_crew`, `bunkhouse` | R3 |
| 6.5 | `crew_charter` | notable | Crew Charter | All lines +3% for every Crew node you own (up to ×1.75) | 77,700 | `bunkhouse`, `crew_spirit_1` | R3 |
| 6.6 | `square_meals_1` | small | Square Meals I | All lines ×1.15 | 22,200 | `crew_spirit_1` | R3 |
| 7.1 | `scar_tissue` | notable | Scar Tissue | All lines +0.5% for every Wipe Day your crew has lived through (up to ×1.25) | 555,000 | `crew_spirit_2` | R7, data R3 |
| 7.2 | `work_gang_5` | small | Work Gang V | Armored-era lines ×1.5 | 333,000 | `foremans_mate` | R7, data R3 |
| 7.3 | `square_meals_2` | small | Square Meals II | All lines ×1.1 | 222,000 | `old_crew_3` | R7, data R3 |
| 7.4 | `crew_spirit_3` | small | Crew Spirit III | All lines +2% a hand on shift (up to ×1.28) | 333,000 | `work_gang_4` | R7, data R3 |
| 7.5 | `square_meals_3` | small | Square Meals III | All lines ×1.1 | 222,000 | `crew_charter` | R7, data R3 |
| 7.6 | `crew_photo` | unlock (scene) | Crew Photo | All lines ×1.4 until this run out-earns your crew photo; then it's retaken *[counts as output ×1.4]* | 444,000 | `square_meals_1` | R7, data R3 |
| 8.1 | `crew_spirit_4` | small | Crew Spirit IV | All lines +2% a hand on shift (up to ×1.28) | 2.22M | `scar_tissue` | R7, data R3 |
| 8.2 | `square_meals_4` | small | Square Meals IV | All lines ×1.1 | 2.22M | `scar_tissue`, `work_gang_5` | R7, data R3 |
| 8.3 | `time_and_motion` | notable | Time and Motion | All lines cycle ×1.7 faster | 5.55M | `work_gang_5`, `square_meals_2` | R7, data R3 |
| 8.4 | `lone_wolf` | keystone (anchor) | Lone Wolf | Taps ×50, but no hands at all: lines run only while you tap (ranks still count) *[conflicts: archivist, bunker_mentality, skeleton_crew]* | 7.77M | `square_meals_2`, `crew_spirit_3` | R7, data R3 |
| 8.5 | `standing_crew` | automation | Standing Crew | Each kept hand brings 10 units of their line, on top of any kit | 3.33M | `crew_spirit_3`, `square_meals_3` | R7, data R3 |
| 8.6 | `work_gang_6` | small | Work Gang VI | Armored-era lines ×1.5 | 3.33M | `square_meals_3`, `crew_photo` | R7, data R3 |
| 8.7 | `square_meals_5` | small | Square Meals V | All lines ×1.1 | 2.22M | `crew_photo` | R7, data R3 |
| 9.1 | `square_meals_6` | small | Square Meals VI | All lines ×1.1 | 22.2M | `crew_spirit_4` | R7, data R3 |
| 9.2 | `relief_crew` | unlock (scene) | Relief Crew | Each line takes a second hand at ×10 the price: that line ×1.5 *[counts as output ×1.5]* | 33.3M | `square_meals_4` | R7, data R3 |
| 9.3 | `square_meals_7` | small | Square Meals VII | All lines ×1.1 | 22.2M | `time_and_motion` | R7, data R3 |
| 9.4 | `crew_legends` | completion (scene) | Crew Legends | All of Crew's ring 8 lit: all lines ×2 | 55.5M | all of ring 8 (AND) | R7, data R3 |
| 9.5 | `campfire_stories` | notable | Campfire Stories | All lines +0.1% for every Logbook page (up to ×1.15) | 77.7M | `standing_crew` | R7, data R4 |
| 9.6 | `lifers` | automation | Lifers | Kept hands keep their line's Line Mk III through the blast | 33.3M | `work_gang_6` | R7, data R3 |
| 9.7 | `fair_pay_3` | small | Fair Pay III | Hands cost ×0.85 (second hands too) | 22.2M | `square_meals_5` | R7, data R3 |

### 6.3 Works (`works`): "Build it once, build it bigger"

24 small, 9 notable, 2 keystone, 4 unlock, 4 automation, 2 completion; 353M glass to light. Sector notes: `04b-works.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `packed_crate` | unlock (anchor, scene) | Starter Kit | Start every run with 10 Beachcombers and 5 Campfires, already working. | 2 | `ground_zero` | R2 |
| 1.2 | `hot_coals` | small | Hot Coals | Campfires +100%. | 1 | `ground_zero` | R2 |
| 2.1 | `first_light` | notable | First Light | Beachcombers, Campfires and Gardens cycle twice as fast. Up at dawn. | 9 | `packed_crate` | R2 |
| 2.2 | `bulk_discount_1` | small | Bulk Discount I | Line units cost ×0.9. | 5 | `packed_crate`, `hot_coals` | R2 |
| 2.3 | `bulk_buttons` | unlock | Bulk Buttons | Adds Next to the bulk toggle: buys just enough for each line's next milestone. | 4 | `hot_coals` | R2 |
| 3.1 | `elbow_grease_1` | small | Elbow Grease I | All lines +15%. | 44 | `first_light` | R2 |
| 3.2 | `conveyor` | notable (scene) | Conveyor Belts | All lines +30%. Belts rattle between the buildings, carrying every product. | 77 | `first_light`, `bulk_discount_1` | R2 |
| 3.3 | `prefab_walls` | unlock (scene) | Prefab Walls | Every run starts in the Timber era. The cabin comes flat-packed. | 66 | `bulk_discount_1`, `bulk_buttons` | R2 |
| 3.4 | `bulk_discount_2` | small | Bulk Discount II | Line units cost ×0.9. | 33 | `bulk_buttons` | R2 |
| 4.1 | `big_kit` | automation | Bigger Kit | Start every run with 25 Beachcombers, 25 Campfires and 25 Gardens. | 333 | `elbow_grease_1` | R3 |
| 4.2 | `retooling_1` | small | Retooling I | Timber lines +30%. | 222 | `elbow_grease_1`, `conveyor` | R3 |
| 4.3 | `shop_floor` | completion | Shop Floor | Line units cost ×0.85. The shop floor finally has a floor. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `retooling_2` | small | Retooling II | Stone lines +30%. | 333 | `prefab_walls`, `bulk_discount_2` | R3 |
| 4.5 | `union_rules` | notable (anchor) | Union Rules | Every ×2 milestone pays ×2.2. The crew read the small print. | 777 | `bulk_discount_2` | R3 |
| 5.1 | `bulk_discount_3` | small | Bulk Discount III | Line units cost ×0.85. | 2,222 | `big_kit` | R3 |
| 5.2 | `stone_foundations` | automation (scene) | Stone Foundations | Every run starts in the Stone era. Somebody finally poured concrete. | 3,333 | `retooling_1` | R3 |
| 5.3 | `mass_production` | keystone | Mass Production | Every line +2% per unit of it you own, up to ×8. Speed milestones do nothing. | 7,777 | `shop_floor` | R3 |
| 5.4 | `assembly_line` | notable | Assembly Line | All lines +5% for every Works node you own, up to ×2. | 9,999 | `retooling_2` | R3 |
| 5.5 | `elbow_grease_2` | small | Elbow Grease II | All lines ×1.3. | 4,444 | `union_rules` | R3 |
| 6.1 | `elbow_grease_3` | small | Elbow Grease III | All lines ×1.5. | 44,400 | `bulk_discount_3` | R3 |
| 6.2 | `full_roster` | notable | Full Roster | Roster milestones that pay ×2 pay ×3. Bunting for everyone. | 55,500 | `bulk_discount_3`, `stone_foundations` | R3 |
| 6.3 | `retooling_3` | small | Retooling III | Armored lines ×1.5. | 33,300 | `stone_foundations`, `mass_production` | R3 |
| 6.4 | `hot_cells_1` | small | Hot Cells I | Reactors ×2. | 55,500 | `mass_production`, `assembly_line` | R3 |
| 6.5 | `standing_orders` | automation | Standing Orders | Line Mk II and III buy themselves when affordable, while the page is open. | 33,300 | `assembly_line`, `elbow_grease_2` | R3 |
| 6.6 | `bulk_discount_4` | small | Bulk Discount IV | Line units cost ×0.85. | 22,200 | `elbow_grease_2` | R3 |
| 7.1 | `tin_roofs` | automation (scene) | Tin Roofs | Every run starts in the Sheet Metal era. Rain drums on tin, not on you. | 333,000 | `elbow_grease_3` | R7, data R3 |
| 7.2 | `elbow_grease_4` | small | Elbow Grease IV | All lines ×1.3. | 444,000 | `full_roster` | R7, data R3 |
| 7.3 | `bulk_discount_5` | small | Bulk Discount V | Line units cost ×0.85. | 222,000 | `retooling_3` | R7, data R3 |
| 7.4 | `retooling_4` | small | Retooling IV | Armored lines ×1.3. | 333,000 | `hot_cells_1` | R7, data R3 |
| 7.5 | `hot_cells_2` | small | Hot Cells II | Reactors ×2. | 555,000 | `standing_orders` | R7, data R3 |
| 7.6 | `smokestacks` | notable (scene) | Smokestacks | All lines ×2. Every building grows a smokestack; the gulls hate it. | 1.11M | `bulk_discount_4` | R7, data R3 |
| 8.1 | `elbow_grease_5` | small | Elbow Grease V | All lines ×1.3. | 4.44M | `tin_roofs` | R7, data R3 |
| 8.2 | `bulk_discount_6` | small | Bulk Discount VI | Line units cost ×0.85. | 2.22M | `tin_roofs`, `elbow_grease_4` | R7, data R3 |
| 8.3 | `rivet_gun` | notable (scene) | Rivet Gun | Armored lines ×2. Every plate gets a rivet, needed or not. | 9.99M | `elbow_grease_4`, `bulk_discount_5` | R7, data R3 |
| 8.4 | `monoculture` | keystone | Monoculture | The highest line you own ×2; every other line ×0.5. The rest can make do. | 7.77M | `bulk_discount_5`, `retooling_4` | R7, data R3 |
| 8.5 | `overtime` | notable | Overtime | Every line cycles twice as fast. Nobody asked the crew. | 5.55M | `retooling_4`, `hot_cells_2` | R7, data R3 |
| 8.6 | `retooling_5` | small | Retooling V | Armored lines ×1.3. | 3.33M | `hot_cells_2`, `smokestacks` | R7, data R3 |
| 8.7 | `hot_cells_3` | small | Hot Cells III | Reactors ×2. | 5.55M | `smokestacks` | R7, data R3 |
| 9.1 | `bulk_discount_7` | small | Bulk Discount VII | Line units cost ×0.85. | 22.2M | `elbow_grease_5` | R7, data R3 |
| 9.2 | `barn_raising` | notable (scene) | Barn Raising | Runs start with 25 of every open line, and lines ×4 while Afterglow lasts. | 99.9M | `bulk_discount_6` | R7, data R3 |
| 9.3 | `elbow_grease_6` | small | Elbow Grease VI | All lines ×1.3. | 44.4M | `rivet_gun` | R7, data R3 |
| 9.4 | `the_works` | completion | The Works | All lines ×3. You built the whole works. | 55.5M | all of ring 8 (AND) | R7, data R3 |
| 9.5 | `retooling_6` | small | Retooling VI | Armored lines ×1.3. | 33.3M | `overtime` | R7, data R3 |
| 9.6 | `line_mk_iv` | unlock (scene) | Line Mk IV | Line Mk IV on the shelf (needs 100 owned): that line ×3, painted sign and all. *[counts as output ×3]* | 33.3M | `retooling_5` | R7, data R3 |
| 9.7 | `retooling_7` | small | Retooling VII | Sheet Metal lines ×1.5. | 22.2M | `hot_cells_3` | R7, data R3 |

### 6.4 Tide (`tide`): "The sea always brings something"

22 small, 9 notable, 2 keystone, 7 unlock, 3 automation, 2 completion; 333M glass to light. Sector notes: `04b-tide.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `lucky_tide` | notable | Lucky Tide | Flotsam drifts in 5% more often. | 3 | `ground_zero` | R2 |
| 1.2 | `slow_current_1` | small | Slow Current I | Flotsam floats 1 s longer. | 1 | `ground_zero` | R2 |
| 2.1 | `lookout_post` | unlock (scene) | Lookout Post | A lookout points and a bell rings 3 s before flotsam drifts in. | 7 | `lucky_tide` | R2 |
| 2.2 | `driftwood_1` | small | Driftwood I | Beachcombers +50%. | 4 | `lucky_tide`, `slow_current_1` | R2 |
| 2.3 | `rally_cry` | notable (scene) | Rally Cry | Flotsam pays 5% more, Rallies included; the crew cheer each Rally. | 9 | `slow_current_1` | R2 |
| 3.1 | `slow_current_2` | small | Slow Current II | Flotsam floats 2 s longer. | 44 | `lookout_post` | R2 |
| 3.2 | `rainmaker` | notable | Rainmaker | In rain, flotsam floats 10 s longer. | 55 | `lookout_post`, `driftwood_1` | R2 |
| 3.3 | `circling_gulls` | notable (scene) | Circling Gulls | Gulls circle anything afloat: flotsam floats 3 s longer. | 66 | `driftwood_1`, `rally_cry` | R2 |
| 3.4 | `driftwood_2` | small | Driftwood II | Beachcombers +60%. | 25 | `rally_cry` | R2 |
| 4.1 | `life_raft` | unlock (scene) | Life Raft | New flotsam (4%): a castaway rows in and mans your top unmanned line for 10 min. | 333 | `slow_current_2` | R3 |
| 4.2 | `storm_drift` | small | Storm Drift | In rain, flotsam floats 3 s longer. | 222 | `slow_current_2`, `rainmaker` | R3 |
| 4.3 | `high_water` | completion (scene) | High Water | Flotsam floats 3 s longer (25 s, the most); the tide line rises. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `slow_current_3` | small | Slow Current III | Flotsam floats 3 s longer. | 333 | `circling_gulls`, `driftwood_2` | R3 |
| 4.5 | `drag_line` | automation (scene) | Drag Line | Flotsam you miss snags on a line and waits on the shore, one at a time. | 444 | `driftwood_2` | R3 |
| 5.1 | `beach_camp_1` | small | Beach Camp I | Twig-era lines ×1.3. | 2,222 | `life_raft` | R3 |
| 5.2 | `storm_harvest` | notable | Storm Harvest | In rain, all lines ×1.4 and flotsam floats 2 s longer. | 5,555 | `storm_drift` | R3 |
| 5.3 | `scavengers_eye` | keystone | Scavenger's Eye | Every flotsam is a Fuel Drum (Sealed Lockers aside): no crates, kits or bottles. *[conflicts: bunker_mentality]* | 7,777 | `high_water` | R3 |
| 5.4 | `beachcombers_net` | automation (scene) | Beachcomber's Net | Drift Crates catch themselves while the page is open. | 3,333 | `slow_current_3` | R3 |
| 5.5 | `sea_wall_1` | small | Sea Wall I | All lines ×1.1. | 4,444 | `drag_line` | R3 |
| 6.1 | `deep_nets_1` | small | Deep Nets I | Docks ×2. | 22,200 | `beach_camp_1` | R3 |
| 6.2 | `flare_gun` | unlock | Flare Gun | Choose what your Flare calls: any kind but the Sealed Locker and the Bottle. | 33,300 | `beach_camp_1`, `storm_harvest` | R5, gate 20 |
| 6.3 | `breakwater` | notable (scene) | Breakwater | Beachcombers, Docks and Ship Breakers ×1.5; car hulks shelter the bay. | 77,700 | `storm_harvest`, `scavengers_eye` | R3 |
| 6.4 | `rain_barrels` | small | Rain Barrels | In rain, all lines ×2. | 44,400 | `scavengers_eye`, `beachcombers_net` | R3 |
| 6.5 | `tide_pump` | notable (scene) | Tide Pump | Every line cycles 10% faster; a tide pump creaks at the water's edge. | 55,500 | `beachcombers_net`, `sea_wall_1` | R3 |
| 6.6 | `driftwood_3` | small | Driftwood III | Beachcombers ×2. | 33,300 | `sea_wall_1` | R3 |
| 7.1 | `rogue_wave` | unlock (scene) | Rogue Wave | Once a run, tap the surf: a big wave rolls in carrying a Drift Crate. | 333,000 | `deep_nets_1` | R7, data R3 |
| 7.2 | `sea_wall_2` | small | Sea Wall II | All lines ×1.1. | 444,000 | `flare_gun` | R7, data R3 |
| 7.3 | `cutting_torch_1` | small | Cutting Torch I | Ship Breakers ×2. | 333,000 | `breakwater` | R7, data R3 |
| 7.4 | `beach_camp_2` | small | Beach Camp II | Twig-era lines ×1.5. | 222,000 | `rain_barrels` | R7, data R3 |
| 7.5 | `sea_wall_3` | small | Sea Wall III | All lines ×1.1. | 555,000 | `tide_pump` | R7, data R3 |
| 7.6 | `lost_cargo` | unlock (scene) | Lost Cargo | New flotsam (3%): a shipping container; line units cost half for 5 min. | 444,000 | `driftwood_3` | R7, data R7 |
| 8.1 | `sea_wall_4` | small | Sea Wall IV | All lines ×1.1. | 4.44M | `rogue_wave` | R7, data R3 |
| 8.2 | `cutting_torch_2` | small | Cutting Torch II | Ship Breakers ×2. | 5.55M | `rogue_wave`, `sea_wall_2` | R7, data R3 |
| 8.3 | `bottle_post` | notable | Bottle Post | Messages in a Bottle wash up twice as often (1%); each still holds a crate. | 4.44M | `sea_wall_2`, `cutting_torch_1` | R7, data R4 |
| 8.4 | `wreckers_moon` | keystone (scene) | Wreckers' Moon | A Drift Crate washes up for each hour away, up to 12; online flotsam ×0.5. *[conflicts: bunker_mentality]* | 7.77M | `cutting_torch_1`, `beach_camp_2` | R7, data R3 |
| 8.5 | `auto_flare` | automation | Auto Flare | Your Flare fires itself when it's ready and nothing floats, page open. | 3.33M | `beach_camp_2`, `sea_wall_3` | R7, data R5, gate 40 |
| 8.6 | `deep_nets_2` | small | Deep Nets II | Docks ×2. | 3.33M | `sea_wall_3`, `lost_cargo` | R7, data R3 |
| 8.7 | `driftwood_4` | small | Driftwood IV | Beachcombers ×2. | 2.22M | `lost_cargo` | R7, data R3 |
| 9.1 | `beach_camp_3` | small | Beach Camp III | Twig-era lines ×1.5. | 22.2M | `sea_wall_4` | R7, data R3 |
| 9.2 | `tide_tables` | unlock | Tide Tables | A tide clock shows when the next three flotsam arrive, and what they are. | 33.3M | `cutting_torch_2` | R7, data R3 |
| 9.3 | `sea_wall_5` | small | Sea Wall V | All lines ×1.1. | 44.4M | `bottle_post` | R7, data R3 |
| 9.4 | `king_tide` | completion (scene) | King Tide | All lines ×1.2; the sea floods the low beach. | 55.5M | all of ring 8 (AND) | R7, data R3 |
| 9.5 | `relit_lighthouse` | notable (scene) | Relit Lighthouse | All lines ×1.1; the lighthouse on the far island burns again at night. | 77.7M | `auto_flare` | R7, data R3 |
| 9.6 | `weather_buoy` | unlock (scene) | Weather Buoy | A buoy shows the island's next 24 h of weather, so you can plan for rain. | 44.4M | `deep_nets_2` | R7, data R3 |
| 9.7 | `deep_nets_3` | small | Deep Nets III | Docks ×2. | 22.2M | `driftwood_4` | R7, data R3 |

### 6.5 Bunker (`bunker`): "Lock up, sleep well, wake up rich"

24 small, 9 notable, 2 keystone, 4 unlock, 4 automation, 2 completion; 356M glass to light. Sector notes: `04b-bunker.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `hot_breakfast` | unlock (scene) | Hot Breakfast | Back after 6 h or more? Collect also starts a Rally: all lines ×4 for 60 s. | 2 | `ground_zero` | R2 |
| 1.2 | `deep_cellars` | small (anchor, scene) | Deep Cellars | Night Shift +4 h. | 1 | `ground_zero` | R2 |
| 2.1 | `night_lamps` | notable (scene) | Night Lamps | Lines +20% at night. Lanterns go up on every building after dusk. | 11 | `hot_breakfast` | R2 |
| 2.2 | `lantern_oil_1` | small | Lantern Oil I | Lines +10% at night. | 5 | `hot_breakfast`, `deep_cellars` | R2 |
| 2.3 | `insulated_walls` | notable (scene) | Insulated Walls | Night Shift +4 h. Shutters go up and the draughts stay out. | 15 | `deep_cellars` | R2 |
| 3.1 | `lantern_oil_2` | small | Lantern Oil II | Lines +30% at night. | 44 | `night_lamps` | R2 |
| 3.2 | `all_clear` | notable (scene) | All Clear | Lines +50% while Afterglow lasts. The siren winds down; the crew climb out. | 77 | `night_lamps`, `lantern_oil_1` | R2 |
| 3.3 | `moonshine_still` | notable (scene) | Moonshine Still | Lines +1% at night per Bunker node you own, up to +10%. It's lamp fuel. Mostly. | 66 | `lantern_oil_1`, `insulated_walls` | R2 |
| 3.4 | `root_cellar_1` | small | Root Cellar I | Night Shift +4 h. | 33 | `insulated_walls` | R2 |
| 4.1 | `night_porter` | automation | Night Porter | Collect runs itself 3 s after the welcome-back card opens; the card stays. | 333 | `lantern_oil_2` | R3 |
| 4.2 | `root_cellar_2` | small | Root Cellar II | Night Shift +4 h. | 222 | `lantern_oil_2`, `all_clear` | R3 |
| 4.3 | `snug` | completion | Snug | Lines ×1.1 while you're away. Blankets, a stove and a door that shuts. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `fuel_cache` | small | Fuel Cache | Oil Presses +60%. | 444 | `moonshine_still`, `root_cellar_1` | R3 |
| 4.5 | `banked_fires` | notable (scene) | Banked Fires | Campfires, Kilns and Furnaces ×2 at night. The fires are banked, never out. | 777 | `root_cellar_1` | R3 |
| 5.1 | `night_rations_1` | small | Night Rations I | Lines ×1.1 while you're away. | 3,333 | `night_porter` | R3 |
| 5.2 | `night_owls` | notable | Night Owls | Lines +2% at night for each hand on shift, up to +28%. Hire before bed. | 5,555 | `root_cellar_2` | R3 |
| 5.3 | `bunker_mentality` | keystone (anchor, scene) | Bunker Mentality | Lines ×1.5 while you're away. No flotsam drifts in, ever. *[conflicts: scavengers_eye, wreckers_moon, lone_wolf]* | 7,777 | `snug` | R3 |
| 5.4 | `wake_up_call` | automation | Wake-up Call | Grit fires itself on your first visit after it is ready. | 3,333 | `fuel_cache` | R5, gate 10 |
| 5.5 | `lantern_oil_3` | small | Lantern Oil III | Lines ×1.3 at night. | 2,222 | `banked_fires` | R3 |
| 6.1 | `root_cellar_3` | small | Root Cellar III | Night Shift +4 h. | 33,300 | `night_rations_1` | R3 |
| 6.2 | `cold_storage` | notable (scene) | Cold Storage | Night Shift +4 h, and lines ×1.15 while you're away. The beans keep. | 77,700 | `night_rations_1`, `night_owls` | R3 |
| 6.3 | `lantern_oil_4` | small | Lantern Oil IV | Lines ×1.5 at night. | 22,200 | `night_owls`, `bunker_mentality` | R3 |
| 6.4 | `night_rations_2` | small | Night Rations II | Lines ×1.1 while you're away. | 44,400 | `bunker_mentality`, `wake_up_call` | R3 |
| 6.5 | `lights_out` | unlock (scene) | Lights Out | Say when you'll be back. Return within 30 min of it: the Night Shift pays ×1.1. *[counts as output ×1.1]* | 44,400 | `wake_up_call`, `lantern_oil_3` | R3 |
| 6.6 | `tinned_beans_1` | small | Tinned Beans I | Lines ×1.3. | 55,500 | `lantern_oil_3` | R3 |
| 7.1 | `snooze` | automation | Snooze | 'Night Shift over' rings an hour early, while there's still time to top up. | 222,000 | `root_cellar_3` | R7, data R3 |
| 7.2 | `root_cellar_4` | small | Root Cellar IV | Night Shift +4 h. | 333,000 | `cold_storage` | R7, data R3 |
| 7.3 | `tinned_beans_2` | small | Tinned Beans II | Lines ×1.4. | 222,000 | `lantern_oil_4` | R7, data R3 |
| 7.4 | `tinned_beans_3` | small | Tinned Beans III | Lines ×1.4. | 444,000 | `night_rations_2` | R7, data R3 |
| 7.5 | `night_rations_3` | small | Night Rations III | Lines ×1.1 while you're away. | 555,000 | `lights_out` | R7, data R3 |
| 7.6 | `night_crew` | unlock (scene) | Night Crew | Lines without a hand work the Night Shift at 10%. Head-torches bob all night. | 444,000 | `tinned_beans_1` | R7, data R3 |
| 8.1 | `night_rations_4` | small | Night Rations IV | Lines ×1.1 while you're away. | 2.22M | `snooze` | R7, data R3 |
| 8.2 | `steel_plating_1` | small | Steel Plating I | Sheet Metal lines ×1.5. | 3.33M | `snooze`, `root_cellar_4` | R7, data R3 |
| 8.3 | `bunk_beds` | notable | Bunk Beds | Night Shift +4 h: the window reaches 48 h, the most it gets. | 5.55M | `root_cellar_4`, `tinned_beans_2` | R7, data R3 |
| 8.4 | `graveyard_shift` | keystone (scene) | Graveyard Shift | Lines ×4 at night but ×0.5 always: double after dark, half by day. | 7.77M | `tinned_beans_2`, `tinned_beans_3` | R7, data R3 |
| 8.5 | `shift_report` | automation | Shift Report | The welcome-back card breaks the night down, line by line. | 2.22M | `tinned_beans_3`, `night_rations_3` | R7, data R3 |
| 8.6 | `tinned_beans_4` | small | Tinned Beans IV | Lines ×1.4. | 4.44M | `night_rations_3`, `night_crew` | R7, data R3 |
| 8.7 | `tinned_beans_5` | small | Tinned Beans V | Lines ×1.35. | 5.55M | `night_crew` | R7, data R3 |
| 9.1 | `tinned_beans_6` | small | Tinned Beans VI | Lines ×1.2. | 22.2M | `night_rations_4` | R7, data R3 |
| 9.2 | `dug_in` | notable (scene) | Dug In | Lines +0.5% per Bunker node you own, up to +20%. Nobody's moving us. | 77.7M | `steel_plating_1` | R7, data R3 |
| 9.3 | `tinned_beans_7` | small | Tinned Beans VII | Lines ×1.2. | 33.3M | `bunk_beds` | R7, data R3 |
| 9.4 | `deep_sleep` | completion (scene) | Deep Sleep | Lines ×1.1 while you're away. The whole crew sleeps like logs. | 55.5M | all of ring 8 (AND) | R7, data R3 |
| 9.5 | `tinned_beans_8` | small | Tinned Beans VIII | Lines ×1.1. | 44.4M | `shift_report` | R7, data R3 |
| 9.6 | `bunker_door` | unlock (scene) | Bunker Door | Away 24 h or more? A Fuel Drum and a Drift Crate wait at a door in the hill. | 33.3M | `tinned_beans_4` | R7, data R3 |
| 9.7 | `steel_plating_2` | small | Steel Plating II | Sheet Metal lines ×1.5. | 55.5M | `tinned_beans_5` | R7, data R3 |

### 6.6 Blast (`blast`): "Bigger bangs, brighter glass"

24 small, 9 notable, 2 keystone, 4 unlock, 4 automation, 2 completion; 326M glass to light. Sector notes: `04b-blast.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `souvenir_jar` | notable (scene) | Souvenir Jar | Afterglow's half-life +1 min. A jar on the shelf fills with glass. | 3 | `ground_zero` | R2 |
| 1.2 | `bigger_payload` | small (anchor) | Bigger Payload | Crater glass +10% from every nuke. | 2 | `ground_zero` | R2 |
| 2.1 | `forecast` | automation | Forecast | The Big Red's card tells you when the next Wipe Day will count, at this rate. | 5 | `souvenir_jar` | R2 |
| 2.2 | `warm_embers_1` | small | Warm Embers I | Afterglow's half-life +60 s. | 4 | `souvenir_jar`, `bigger_payload` | R2 |
| 2.3 | `tinfoil_hats` | notable (scene) | Tinfoil Hats | Glow factor +0.01 and crater glass +5%. The crew swear by them. | 11 | `bigger_payload` | R2 |
| 3.1 | `bigger_payload_2` | small | Bigger Payload II | Crater glass ×1.1. | 33 | `forecast` | R2 |
| 3.2 | `glow_lamp` | notable (anchor, scene) | Glow Lamp | Glow factor +0.02. A green lamp glows on the Kettle's pad. | 77 | `forecast`, `warm_embers_1` | R2 |
| 3.3 | `flight_school` | unlock | Flight School | Pick the missile's flight on the cover card, from the flights you've seen. | 44 | `warm_embers_1`, `tinfoil_hats` | R2 |
| 3.4 | `fertile_ash_1` | small | Fertile Ash I | Gardens +60%. | 25 | `tinfoil_hats` | R2 |
| 4.1 | `quick_rebuild` | automation | Quick Rebuild | Rebuild in one tap: skip the rebuild screen and keep your last loadout. | 333 | `bigger_payload_2` | R3 |
| 4.2 | `fertile_ash_2` | small | Fertile Ash II | Twig lines +30%. | 222 | `bigger_payload_2`, `glow_lamp` | R3 |
| 4.3 | `glass_garden` | completion (scene) | Glass Garden | Crater glass ×1.1. Glass shards glitter in the crater. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `warm_embers_2` | small | Warm Embers II | Afterglow's half-life +60 s. | 333 | `flight_school`, `fertile_ash_1` | R3 |
| 4.5 | `crater_lake` | notable (scene) | Crater Lake | Glow factor +0.02. Rain pools in the crater; the gulls approve. | 777 | `fertile_ash_1` | R3 |
| 5.1 | `bigger_payload_3` | small | Bigger Payload III | Crater glass ×1.1. | 3,333 | `quick_rebuild` | R3 |
| 5.2 | `blast_radius` | notable | Blast Radius | All lines +0.5% for every lit Blast node, up to ×1.1. | 5,555 | `fertile_ash_2` | R3 |
| 5.3 | `hot_core` | keystone | Hot Core | Crater glass ×1.5, but lines run at a quarter while Afterglow lasts. *[conflicts: wipe_day_rush]* | 7,777 | `glass_garden` | R3 |
| 5.4 | `glass_strata` | notable | Glass Strata | Glow factor +0.001 for every Wipe Day, up to +0.02. | 4,444 | `warm_embers_2` | R3 |
| 5.5 | `warm_embers_3` | small | Warm Embers III | Afterglow's half-life +90 s. | 2,222 | `crater_lake` | R3 |
| 6.1 | `bright_glass_1` | small | Bright Glass I | Glow factor +0.04. | 44,400 | `bigger_payload_3` | R3 |
| 6.2 | `dead_hand` | automation (anchor) | Dead Hand | An opt-in switch that presses the Big Red for you while the page is open. | 22,200 | `bigger_payload_3`, `blast_radius` | R5, gate 25 |
| 6.3 | `fertile_ash_3` | small | Fertile Ash III | All lines ×1.18. | 33,300 | `blast_radius`, `hot_core` | R3 |
| 6.4 | `shockwave_1` | small | Shockwave I | All lines run 18% faster. | 33,300 | `hot_core`, `glass_strata` | R3 |
| 6.5 | `postcard_album` | unlock | Postcard Album | Your last 20 postcards, each with a snapshot of the island you flattened. | 44,400 | `glass_strata`, `warm_embers_3` | R3 |
| 6.6 | `bigger_payload_4` | small | Bigger Payload IV | Crater glass ×1.1. | 55,500 | `warm_embers_3` | R3 |
| 7.1 | `ash_bloom` | notable (scene) | Ash Bloom | While Afterglow lasts, every line ×2. Odd flowers push up through the ash. | 555,000 | `bright_glass_1` | R7, data R3 |
| 7.2 | `bright_glass_2` | small | Bright Glass II | Glow factor +0.04. | 444,000 | `dead_hand` | R7, data R3 |
| 7.3 | `shockwave_2` | small | Shockwave II | All lines run 10% faster. | 222,000 | `fertile_ash_3` | R7, data R3 |
| 7.4 | `fertile_ash_4` | small | Fertile Ash IV | All lines ×1.13. | 333,000 | `shockwave_1` | R7, data R3 |
| 7.5 | `shockwave_3` | small | Shockwave III | All lines run 10% faster. | 333,000 | `postcard_album` | R7, data R3 |
| 7.6 | `double_barrel` | unlock (scene) | Double Barrel | A twin Kettle joins the pad: crater glass ×1.1, and the film launches both. | 444,000 | `bigger_payload_4` | R7, data R3 |
| 8.1 | `shockwave_4` | small | Shockwave IV | All lines run 12% faster. | 2.22M | `ash_bloom` | R7, data R3 |
| 8.2 | `bigger_payload_5` | small | Bigger Payload V | Crater glass ×1.1. | 5.55M | `ash_bloom`, `bright_glass_2` | R7, data R3 |
| 8.3 | `glowing_bunks` | notable | Glowing Bunks | Glow factor +0.001 for every lit Bunker node, up to +0.04. | 9.99M | `bright_glass_2`, `shockwave_2` | R7, data R3 |
| 8.4 | `chain_reaction` | keystone | Chain Reaction | Glow factor +0.25, but every nuke pays half the glass. | 7.77M | `shockwave_2`, `fertile_ash_4` | R7, data R3 |
| 8.5 | `kettle_watch` | automation | Kettle Watch | A notification when the Big Red is crowned, if you switch it on. | 3.33M | `fertile_ash_4`, `shockwave_3` | R7, data R3 |
| 8.6 | `fertile_ash_5` | small | Fertile Ash V | All lines ×1.12. | 3.33M | `shockwave_3`, `double_barrel` | R7, data R3 |
| 8.7 | `shockwave_5` | small | Shockwave V | All lines run 11% faster. | 2.22M | `double_barrel` | R7, data R3 |
| 9.1 | `fertile_ash_6` | small | Fertile Ash VI | All lines ×1.12. | 22.2M | `shockwave_4` | R7, data R3 |
| 9.2 | `nose_art` | unlock (scene) | Nose Art | Paint the missile in a livery earned from your flights and records. | 33.3M | `bigger_payload_5` | R7, data R3 |
| 9.3 | `shockwave_6` | small | Shockwave VI | All lines run 12% faster. | 33.3M | `glowing_bunks` | R7, data R3 |
| 9.4 | `second_sun` | completion (scene) | Second Sun | Glow factor +0.05. A pale second sun hangs over the island. | 55.5M | all of ring 8 (AND) | R7, data R3 |
| 9.5 | `warm_embers_4` | small | Warm Embers IV | Afterglow's half-life +90 s. | 22.2M | `kettle_watch` | R7, data R3 |
| 9.6 | `sunburst` | notable (scene) | Sunburst | Crater glass ×1.1. The mushroom cloud glows gold. | 77.7M | `fertile_ash_5` | R7, data R3 |
| 9.7 | `fertile_ash_7` | small | Fertile Ash VII | All lines ×1.11. | 44.4M | `shockwave_5` | R7, data R3 |

### 6.7 Logbook (`logbook`): "Write it down; it pays"

24 small, 8 notable, 2 keystone, 6 unlock, 3 automation, 2 completion; 305M glass to light. Sector notes: `04b-logbook.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `tally_wall` | notable (scene) | Tally Wall | Lines +1% a Wipe Day, up to +10%. Somebody keeps score on the cabin wall. | 3 | `ground_zero` | R2 |
| 1.2 | `night_log_1` | small | Night Log I | Lines +25% at night. | 1 | `ground_zero` | R2 |
| 2.1 | `personal_best` | unlock (scene) | Personal Best | Beat your last run's supplies made: the bell rings, lines +15% for the run. *[counts as output ×1.075]* | 7 | `tally_wall` | R2 |
| 2.2 | `crib_notes_1` | small | Crib Notes I | Twig lines +25%. | 4 | `tally_wall`, `night_log_1` | R2 |
| 2.3 | `weather_log` | notable | Weather Log | Lines +30% in rain. Today's entry: 'Wet. Again.' | 11 | `night_log_1` | R2 |
| 3.1 | `crib_notes_2` | small | Crib Notes II | Timber lines +30%. | 33 | `personal_best` | R2 |
| 3.2 | `almanac` | notable | Almanac | Lines +30% at night. The crew know when dark falls and work to it. | 66 | `personal_best`, `crib_notes_1` | R2 |
| 3.3 | `bookshelf` | notable (scene) | Bookshelf | Lines +1.5% per Logbook node you own, up to +9%. The shelf sags a bit. | 99 | `crib_notes_1`, `weather_log` | R2 |
| 3.4 | `night_log_2` | small | Night Log II | Lines +30% at night. | 44 | `weather_log` | R2 |
| 4.1 | `old_maps` | unlock (scene) | Old Maps | Secret hints show now, not at Wipe Day #15. Pinned up with a knife. | 333 | `crib_notes_2` | R4 |
| 4.2 | `war_stories` | small | War Stories | Morale per page +0.005 (0.02 to 0.025). | 222 | `crib_notes_2`, `almanac` | R4 |
| 4.3 | `well_read` | completion | Well Read | Eras cost ×0.9. Somebody finally read the instructions. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `crib_notes_3` | small | Crib Notes III | Stone lines +30%. | 444 | `bookshelf`, `night_log_2` | R3 |
| 4.5 | `long_memory` | notable | Long Memory | Lines +0.5% a Wipe Day, up to +10%. Nobody forgets a good blast. | 777 | `night_log_2` | R3 |
| 5.1 | `margin_notes` | small | Margin Notes | Morale per page +0.005. | 3,333 | `old_maps` | R4 |
| 5.2 | `page_turner` | notable | Page Turner | Lines +0.4% for every Logbook page, up to ×1.4. Nobody can put it down. | 9,999 | `war_stories` | R4 |
| 5.3 | `tall_tales` | keystone (scene) | Tall Tales | While Hustle runs, lines lose Morale and taps get it twice (up to ×5 more). *[conflicts: archivist]* | 7,777 | `well_read` | R4 |
| 5.4 | `field_guide` | automation | Field Guide | Every page shows how close you are: bars on all, best tries on timed ones. | 2,222 | `crib_notes_3` | R4 |
| 5.5 | `old_plans_1` | small | Old Plans I | Eras cost ×0.9. | 2,222 | `long_memory` | R4 |
| 6.1 | `ships_log_1` | small | Ship's Log I | Lines +2% a Wipe Day, up to ×1.35. | 33,300 | `margin_notes` | R4 |
| 6.2 | `dog_eared` | notable | Dog-eared Pages | Morale ×1.2. The good pages fall open on their own. | 55,500 | `margin_notes`, `page_turner` | R4 |
| 6.3 | `field_notes` | small | Field Notes | Morale per page +0.005. | 22,200 | `page_turner`, `tall_tales` | R4 |
| 6.4 | `night_log_3` | small | Night Log III | Lines ×1.7 at night. | 44,400 | `tall_tales`, `field_guide` | R4 |
| 6.5 | `bottle_reader` | unlock | Bottle Reader | A Message in a Bottle names a secret's answer, not just its hint. | 44,400 | `field_guide`, `old_plans_1` | R4 |
| 6.6 | `sea_stories_1` | small | Sea Stories I | Lines ×1.3. | 33,300 | `old_plans_1` | R4 |
| 7.1 | `hint_lamp` | automation | Hint Lamp | With nothing crowned, the advisor points at your nearest unfound page. | 333,000 | `ships_log_1` | R7, data R4 |
| 7.2 | `pressed_flowers` | small | Pressed Flowers | Morale per page +0.005. | 222,000 | `dog_eared` | R7, data R4 |
| 7.3 | `night_log_4` | small | Night Log IV | Lines ×1.7 at night. | 333,000 | `field_notes` | R7, data R3 |
| 7.4 | `ships_log_2` | small | Ship's Log II | Lines +2% a Wipe Day, up to ×1.35. | 444,000 | `night_log_3` | R7, data R3 |
| 7.5 | `sea_stories_2` | small | Sea Stories II | Lines ×1.5. | 555,000 | `bottle_reader` | R7, data R3 |
| 7.6 | `double_dare` | unlock (scene) | Double Dare | Take two Dares in one run: both rules apply, each goal pays its reward. | 444,000 | `sea_stories_1` | R7, data R7, gate 30 |
| 8.1 | `ships_log_3` | small | Ship's Log III | Lines +2% a Wipe Day, up to ×1.35. | 3.33M | `hint_lamp` | R7, data R3 |
| 8.2 | `old_plans_2` | small | Old Plans II | Eras cost ×0.9. | 2.22M | `hint_lamp`, `pressed_flowers` | R7, data R3 |
| 8.3 | `rainy_day_fund` | notable (scene) | Rainy Day Fund | Lines ×2.4 in rain. Bad weather, good business. | 9.99M | `pressed_flowers`, `night_log_4` | R7, data R3 |
| 8.4 | `archivist` | keystone (scene) | Archivist | Morale ×2. Taps ×0.25: someone has to copy the Logbook out by hand. *[conflicts: tall_tales, lone_wolf, fever_pitch]* | 7.77M | `night_log_4`, `ships_log_2` | R7, data R4 |
| 8.5 | `dare_ledger` | automation | Dare Ledger | Rebuild picks your last unfinished Dare again. Change it if you like. | 2.22M | `ships_log_2`, `sea_stories_2` | R7, data R7, gate 40 |
| 8.6 | `night_log_5` | small | Night Log V | Lines ×1.5 at night. | 4.44M | `sea_stories_2`, `double_dare` | R7, data R3 |
| 8.7 | `sea_stories_3` | small | Sea Stories III | Lines ×1.3. | 5.55M | `double_dare` | R7, data R3 |
| 9.1 | `bound_volume` | small | Bound Volume | Morale per page +0.010 (0.04 to 0.05). | 44.4M | `ships_log_3` | R7, data R4 |
| 9.2 | `treasure_map` | unlock (scene) | Treasure Map | Once a week an X turns up on the island. Dig: one secret's answer. | 33.3M | `old_plans_2` | R7, data R4 |
| 9.3 | `sea_stories_4` | small | Sea Stories IV | Lines ×1.3. | 33.3M | `rainy_day_fund` | R7, data R3 |
| 9.4 | `full_log` | completion | Full Log | Morale ×1.25. The first Logbook is full; volume two is started. | 55.5M | all of ring 8 (AND) | R7, data R4 |
| 9.5 | `night_log_6` | small | Night Log VI | Lines ×1.6 at night. | 22.2M | `dare_ledger` | R7, data R3 |
| 9.6 | `postcard_pen` | unlock | Postcard Pen | Write one line on each postcard (40 characters). It posts with the news. | 33.3M | `night_log_5` | R7, data R3 |
| 9.7 | `ships_log_4` | small | Ship's Log IV | Lines +2% a Wipe Day, up to ×1.35. | 44.4M | `sea_stories_3` | R7, data R3 |

### 6.8 Scrapyard (`scrapyard`): "Nothing is junk if you keep it"

23 small, 8 notable, 2 keystone, 4 unlock, 6 automation, 2 completion; 262M glass to light. Sector notes: `04b-scrapyard.md`.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `scrap_heap` | notable (scene) | Scrap Heap | Grip rungs and Line Mks cost 15% less; the junk heap grows every Wipe Day. | 3 | `ground_zero` | R2 |
| 1.2 | `odd_lumber_1` | small | Odd Lumber I | Island upgrades cost 10% less. | 1 | `ground_zero` | R2 |
| 2.1 | `tool_bag` | automation | Tool Bag | Start every run with Stone Tools in hand. | 5 | `scrap_heap` | R2 |
| 2.2 | `sharp_eye_1` | small | Sharp Eye I | Grip rungs cost 10% less. | 4 | `scrap_heap`, `odd_lumber_1` | R2 |
| 2.3 | `bargain_bin` | notable | Bargain Bin | Line Mk upgrades cost 15% less. Every bolt in the bin is 'nearly new'. | 11 | `odd_lumber_1` | R2 |
| 3.1 | `sharp_eye_2` | small | Sharp Eye II | Grip rungs cost 10% less. | 25 | `tool_bag` | R2 |
| 3.2 | `patched_sail` | notable (scene) | Patched Sail | Island upgrades cost 20% less; the skiff flies a sail of three old tarps. | 66 | `tool_bag`, `sharp_eye_1` | R2 |
| 3.3 | `iron_bag` | automation | Iron Bag | Start every run with Iron Tools in hand. | 44 | `sharp_eye_1`, `bargain_bin` | R2 |
| 3.4 | `bolt_bucket_1` | small | Bolt Bucket I | Line Mk upgrades cost 10% less. | 33 | `bargain_bin` | R2 |
| 4.1 | `deep_pockets` | unlock (scene) | Deep Pockets | Pocket slot 2 opens (15 scrap): keep a second upgrade through every blast. | 333 | `sharp_eye_2` | R5 |
| 4.2 | `odd_lumber_2` | small | Odd Lumber II | Island upgrades cost 10% less. | 222 | `sharp_eye_2`, `patched_sail` | R3 |
| 4.3 | `sorted_yard` | completion (scene) | Sorted Yard | Every shelf upgrade costs 10% less. The heap finally has labels. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `sharp_eye_3` | small | Sharp Eye III | Grip rungs cost 10% less. | 222 | `iron_bag`, `bolt_bucket_1` | R3 |
| 4.5 | `salvage_cart` | automation (scene) | Salvage Cart | One tap buys every shelf upgrade you can afford, cheapest first. | 333 | `bolt_bucket_1` | R3 |
| 5.1 | `quick_winch` | small | Quick Winch | The Magnet hauls 1 h sooner: early from 19 h, sure from 22 h, by itself at 23 h. | 2,222 | `deep_pockets` | R5 |
| 5.2 | `spare_parts` | notable | Spare Parts | Every Line Mk pays ×3.35, not ×3. Nobody asks where the spare bolts go. | 5,555 | `odd_lumber_2` | R3 |
| 5.3 | `hoarder` | keystone (scene) | Hoarder | Lines +10% per hour of output held unspent, to +100%. Line units cost ×2. | 7,777 | `sorted_yard` | R3 |
| 5.4 | `first_shelf` | automation | First Shelf | Start every run with Sorting Tables already standing. | 2,222 | `sharp_eye_3` | R3 |
| 5.5 | `bolt_bucket_2` | small | Bolt Bucket II | Line Mk upgrades cost 10% less. | 3,333 | `salvage_cart` | R3 |
| 6.1 | `greased_cable` | small | Greased Cable | The Magnet hauls 1 h sooner again: early from 18 h, sure from 21 h, alone at 22 h. | 22,200 | `quick_winch` | R5 |
| 6.2 | `cart_shed` | notable | Cart Shed | Start every run with Handcarts; island upgrades cost 10% less. | 44,400 | `quick_winch`, `spare_parts` | R3 |
| 6.3 | `gold_braid` | notable | Gold Braid | Each crew rank pays ×2.1, not ×2: ×40.8 at rank 5, was ×32. | 55,500 | `spare_parts`, `hoarder` | R5 |
| 6.4 | `wreck_salvage_1` | small | Wreck Salvage I | Armored lines (Ship Breaker, Reactor) ×1.5. | 33,300 | `hoarder`, `first_shelf` | R3 |
| 6.5 | `sewn_lining` | unlock (scene) | Sewn Lining | Pocket slot 3 opens (40 scrap): a third upgrade rides out every blast. | 44,400 | `first_shelf`, `bolt_bucket_2` | R5 |
| 6.6 | `odd_lumber_3` | small | Odd Lumber III | Island upgrades cost 10% less. | 22,200 | `bolt_bucket_2` | R3 |
| 7.1 | `mk_kit` | automation | Mk Kit | Start every run with Line Mk II on your first six lines (Beachcomber to Kiln). | 222,000 | `greased_cable` | R7, data R3 |
| 7.2 | `heavy_coil` | small | Heavy Coil | The Magnet hauls 1 h sooner again: early from 17 h, sure from 20 h, alone at 21 h. | 222,000 | `cart_shed` | R7, data R5 |
| 7.3 | `double_rivets` | small | Double Rivets | Every Line Mk pays ×3.7. | 444,000 | `gold_braid` | R7, data R3 |
| 7.4 | `odd_lumber_4` | small | Odd Lumber IV | Island upgrades cost 10% less. | 333,000 | `wreck_salvage_1` | R7, data R3 |
| 7.5 | `bolt_bucket_3` | small | Bolt Bucket III | Line Mk upgrades cost 10% less. | 333,000 | `sewn_lining` | R7, data R3 |
| 7.6 | `odds_and_ends` | notable (scene) | Odds and Ends | All lines ×1.02 per Scrapyard node lit, up to ×1.6. Nothing here is junk. | 777,000 | `odd_lumber_3` | R7, data R3 |
| 8.1 | `night_crane` | small | Night Crane | The Magnet hauls 1 h sooner again: early from 16 h, sure from 19 h, alone at 20 h. | 2.22M | `mk_kit` | R7, data R5 |
| 8.2 | `wreck_salvage_2` | small | Wreck Salvage II | Armored lines (Ship Breaker, Reactor) ×1.5. | 3.33M | `mk_kit`, `heavy_coil` | R7, data R3 |
| 8.3 | `brass_polish` | notable | Brass Polish | Each crew rank pays ×2.2: ×51.5 at rank 5. Shine them pips. | 5.55M | `heavy_coil`, `double_rivets` | R7, data R5 |
| 8.4 | `sentimental` | keystone | Sentimental | Pocketed island upgrades and Line Mks pay 40% more. One Pocket slot fewer. | 7.77M | `double_rivets`, `odd_lumber_4` | R7, data R5 |
| 8.5 | `power_kit` | automation | Power Kit | Start every run with Salvaged Tools in hand. | 2.22M | `odd_lumber_4`, `bolt_bucket_3` | R7, data R3 |
| 8.6 | `odd_lumber_5` | small | Odd Lumber V | Island upgrades cost 10% less. | 3.33M | `bolt_bucket_3`, `odds_and_ends` | R7, data R3 |
| 8.7 | `bolt_bucket_4` | small | Bolt Bucket IV | Line Mk upgrades cost 10% less. | 2.22M | `odds_and_ends` | R7, data R3 |
| 9.1 | `bolt_bucket_5` | small | Bolt Bucket V | Line Mk upgrades cost 10% less. | 22.2M | `night_crane` | R7, data R3 |
| 9.2 | `junk_drawer` | unlock | Junk Drawer | Once a run, swap a full Pocket at any time, not just before your first buy. | 33.3M | `wreck_salvage_2` | R7, data R5 |
| 9.3 | `wreck_salvage_3` | small | Wreck Salvage III | Armored lines (Ship Breaker, Reactor) ×1.5. | 44.4M | `brass_polish` | R7, data R3 |
| 9.4 | `yard_boss` | completion (scene) | Yard Boss | Each crew rank pays ×2.25 and every Line Mk ×4. The yard has a boss now. | 55.5M | all of ring 8 (AND) | R7, data R5 |
| 9.5 | `bolt_bucket_6` | small | Bolt Bucket VI | Line Mk upgrades cost 10% less. | 22.2M | `power_kit` | R7, data R3 |
| 9.6 | `golden_hook` | unlock (scene) | Golden Hook | Once a week the Magnet lands a gold-painted bolt. Pretty. Worth nothing. | 33.3M | `odd_lumber_5` | R7, data R5 |
| 9.7 | `odd_lumber_6` | small | Odd Lumber VI | Island upgrades cost 10% less. | 22.2M | `bolt_bucket_4` | R7, data R3 |
