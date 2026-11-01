# 04b Scrapyard: the sector catalog (proposal)

Sector `scrapyard`, "Nothing is junk if you keep it": the eighth wedge, between Logbook and Grip.
45 nodes in rings 1-9 (2, 3, 4, 5, 5, 6, 6, 7, 7). The data is `04b-scrapyard.json` (one object per
node, the shape the orchestrator set). Every name is a proposal for the owner's pass; numbers are
starting values the simulator may retune inside the budget. Read with `04-blast-map.md` 6.10 (the
brief), `10-balance.md` 6 (the budget) and `05-meta-layers.md` 2-4 (Magnet, ranks, Pockets).

## How the sector plays

- **Rings 1-3 (R2): the shelf.** Cheaper Grip rungs, Line Mks and island upgrades, and tools in
  hand from the first tap (Tool Bag, Iron Bag). The junk heap by the skiff grows a layer every Wipe
  Day and the skiff gets a patched sail, so the shelf's corner of the island visibly fills up.
- **Rings 4-6 (R3, R5): keeping things.** Pocket slots 2 and 3, the Magnet's first two winches,
  the Salvage Cart's one-tap shelf sweep, Sorting Tables and Handcarts standing at the start, Spare
  Parts on every Line Mk, the first rank notable, Armored lines ×1.5, and the Hoarder keystone (hold
  your supplies, and lines grow; spend them, and they shrink back).
- **Rings 7-9 (R7): the yard pays.** Line Mk II kits, the last winches (16/19/20 h, canon's
  floor), Odds and Ends (every lit Scrapyard node lifts every line), Brass Polish, the Sentimental
  keystone, Junk Drawer, Golden Hook, and Yard Boss, the capstone that closes both ladders: crew
  ranks ×2.25 and Line Mk ×4.

No node touches scrap income: no haul size, rich chance, Sealed Locker weight or new source (04
2.4.6). Golden Hook is cosmetic only.

```
r9  S U S C S U S     C = Yard Boss (all of ring 8); U = Junk Drawer, Golden Hook
r8  S S N K A S S     K = Sentimental; N = Brass Polish; A = Power Kit
r7  A S S S S N       A = Mk Kit; N = Odds and Ends
r6  S N N S U S       N = Cart Shed, Gold Braid (04's S->F turn); U = Sewn Lining
r5  S N K A S         K = Hoarder; N = Spare Parts; A = First Shelf
r4  U S C S A         U = Deep Pockets; C = Sorted Yard (all of ring 3); A = Salvage Cart
r3  S N A S           N = Patched Sail; A = Iron Bag
r2  A S N             A = Tool Bag; N = Bargain Bin
r1  N S               N = Scrap Heap
```

**Series** (`04` 10.1): Odd Lumber I-VI (island upgrades ×0.9), Sharp Eye I-III (Grip rungs ×0.9),
Bolt Bucket I-VI (Line Mk upgrades ×0.9), Wreck Salvage I-III (Armored lines ×1.5). One-offs: the
four winches (Quick Winch, Greased Cable, Heavy Coil, Night Crane) and Double Rivets (Line Mk ×3.7).
Edges are 04 1.3's default wiring with no extra `links`. A script over that wiring confirms: slots
and types match the template, the quotas are exact (23 small, 8 notable, 2 keystone, 4 unlock, 6
automation, 2 completion), every price is on 04 3.1's ladder, no chain has three smalls in a row,
consecutive smalls on a chain always belong to different series, and each band (1-3, 4-6, 7-9) has
scene nodes.

## Changes from 04's fixed table

| Node | 04 6.10 | Here | Why |
| --- | --- | --- | --- |
| `scrap_heap` | shelf ×0.8 | Grip rungs and Line Mks ×0.85; island upgrades take Odd Lumber I (×0.9) beside it | ring 1 allows ×0.85 per shelf kind (`10` 6.1, 6.6) and 1.2 must still be a small |
| `bargain_bin` | Line Mk ×0.6 | ×0.85 | ring 2's per-kind share |
| `patched_sail` | island ×0.7 | ×0.8 | the running per-kind budget through ring 3 (×0.614) |
| `sorted_yard` | shelf ×0.7 | ×0.9 on each kind | ring 4's per-kind share |
| `spare_parts` | Line Mk ×3.25 | ×3.35 | `10` 6.6's fix: (3.35/3)² = ×1.247, ring 5's ×1.26 |
| 6.3 (writer's) | rank ×2.1 | `gold_braid`, ×2.1 | as 04 |
| `brass_polish` | rank ×2.25 | ×2.2 | rank ladder 2.1 / 2.2 / 2.25 ends at `05` 3's ×2.25, inside `10` 6.6's ×2.3 and `04` 4.2's ×2.5 |
| `yard_boss` | rank ×2.5 | rank ×2.25 and Line Mk ×4 | as above; the capstone also closes the Mk ladder at 04 4.2's ceiling |
| `sentimental` | ×2 becomes ×3 | pays 40% more (×2 → ×2.8) | keystone rule (resolution 3.13): two live slots give at most 1.4² = ×1.96 |

## Budget tracking

Shares are `10-balance.md` 6.3 (which replaces 04 7.2: Scrapyard's lines share is ×1.26 in ring 5
and ×2 in each of rings 6-9). Counting follows `10` 6.2: `mk_mult` from 3 to x as (x/3)²,
`rank_mult` from 2 to x as (x/2)⁵, the Armored scope at 0.97 of its bonus, `per` effects at their
`max`, and the cumulative rule (a running product never passes the running share). Keystones sit
outside the shares.

### Lines (`output`, Mk, ranks)

| Ring | Share | Nodes (counted as) | Ring product | Running product | Running share |
| --- | --- | --- | --- | --- | --- |
| 1-4 | none | none (shelf prices, kits, automation) | ×1 | ×1 | ×1 |
| 5 | ×1.26 | Spare Parts: Mk ×3.35 (×1.247) | ×1.247 | ×1.25 | ×1.26 |
| 6 | ×2 | Gold Braid: rank ×2.1 (×1.276); Wreck Salvage I: Armored ×1.5 (×1.485) | ×1.895 | ×2.36 | ×2.52 |
| 7 | ×2 | Double Rivets: Mk ×3.7 (×1.220); Odds and Ends: ×1.02 per node, at its max (×1.6) | ×1.952 | ×4.61 | ×5.04 |
| 8 | ×2 | Brass Polish: rank ×2.2 (×1.262); Wreck Salvage II (×1.485) | ×1.874 | ×8.64 | ×10.1 |
| 9 | ×2 | Yard Boss: rank ×2.25 (×1.119) and Mk ×4 (×1.169); Wreck Salvage III (×1.485) | ×1.942 | ×16.8 | ×20.2 |

Every ring is under its own share as well as the running one. The whole sector ends at ×16.8 of
×20.2 (94% in log terms); the slack is left for the simulator rather than spent on a fourth Wreck
Salvage that would put ring 9 at ×2.9.

### Shelf prices (`upgrade_cost`, per shelf kind; Scrapyard's own column)

Each cell: the ring's nodes, the ring's factor, then the running product. The running product must
stay at or above the running budget (a price may not fall faster than the budget allows).

| Ring | Budget (ring / running) | Grip rungs | Line Mk | Island upgrades |
| --- | --- | --- | --- | --- |
| 1 | ×0.85 / 0.850 | Scrap Heap ×0.85 → 0.850 | Scrap Heap ×0.85 → 0.850 | Odd Lumber I ×0.9 → 0.900 |
| 2 | ×0.85 / 0.723 | Sharp Eye I ×0.9 → 0.765 | Bargain Bin ×0.85 → 0.723 | none → 0.900 |
| 3 | ×0.85 / 0.614 | Sharp Eye II ×0.9 → 0.689 | Bolt Bucket I ×0.9 → 0.650 | Patched Sail ×0.8 → 0.720 |
| 4 | ×0.9 / 0.553 | Sorted Yard, Sharp Eye III ×0.81 → 0.558 | Sorted Yard ×0.9 → 0.585 | Sorted Yard, Odd Lumber II ×0.81 → 0.583 |
| 5 | ×0.9 / 0.497 | none → 0.558 | Bolt Bucket II ×0.9 → 0.527 | none → 0.583 |
| 6 | ×0.9 / 0.448 | none → 0.558 | none → 0.527 | Cart Shed, Odd Lumber III ×0.81 → 0.472 |
| 7 | ×0.9 / 0.403 | none → 0.558 | Bolt Bucket III ×0.9 → 0.474 | Odd Lumber IV ×0.9 → 0.425 |
| 8 | ×0.9 / 0.363 | none → 0.558 | Bolt Bucket IV ×0.9 → 0.427 | Odd Lumber V ×0.9 → 0.383 |
| 9 | ×0.9 / 0.326 | none → **0.558** | Bolt Bucket V, VI ×0.81 → **0.346** | Odd Lumber VI ×0.9 → **0.344** |

- No kind ever runs ahead of its running budget; all three end above `04` 4.2's ×0.25 ceiling.
- Four ring factors are ×0.81 against a ring share of ×0.9 (Grip and island in ring 4, island in
  ring 6, Line Mk in ring 9). Each follows rings that ran behind, which `10` 6.2.1's cumulative rule
  allows. Ring 4 cannot avoid it: Sorted Yard takes all three kinds and 4.2 and 4.4 must be smalls.
- Grip rungs stop at ×0.56 after ring 4. They cost 60 to 6B and stop mattering in the mid game, so
  the late smalls go to Line Mks (to 2.7 Sp) and island upgrades (to 1e34).

### Every other column

| Column | Scrapyard |
| --- | --- |
| `era_cost` | none. `10` 6.3 names Scrapyard, but `04` 6.9 puts Old Plans and Well Read in Logbook and they fill the ×0.53 column; recorded as a trade of the whole column to Logbook |
| `magnet_hours` (N19, unbudgeted) | 24 → 23, 22, 21, 20 in rings 5-8 (05 2.2): thresholds 16 / 19 / 20 h, canon's floor |
| Kits (`10` 6.4) | Tool Bag r2 (Stone Tools), Iron Bag r3, First Shelf r5 (Sorting Tables), Mk Kit r7, Power Kit r8 (Salvaged Tools): exactly the schedule. Cart Shed r6 (Handcarts) is new; it sits after First Shelf's row (`10` 6.2.6) and needs its simulator row |
| `tap`, tap internals, flotsam, `night_shift`, `offline`, `glass_gain`, `glow_k`, Morale | none |
| Keystones (rule 3.13, simulator row each) | Hoarder targets the idler: at most ×2 (the +100% cap), costs line units ×2. Sentimental targets the casual: at most ×1.96, costs a slot (and pays nothing with one slot) |

Glass to light the whole sector: 262M (ring by ring: 4, 20, 168, 1,665, 21,109, 222,000, 2.33M, 26.6M, 233M).

## The 45 nodes

"(scene)" marks a node with a drawing (list below). Requires are OR, except completions (AND).
Wave is the build that shows the node; "data R5" nodes join `blastmap.json5` in R5 (their system
ships then), the other wave-3 nodes in R3.

| Slot | Id | Type | Name | Text | Glass | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `scrap_heap` | notable | Scrap Heap (scene) | Grip rungs and Line Mks cost 15% less; the junk heap grows every Wipe Day. | 3 | `ground_zero` | R2 |
| 1.2 | `odd_lumber_1` | small | Odd Lumber I | Island upgrades cost 10% less. | 1 | `ground_zero` | R2 |
| 2.1 | `tool_bag` | automation | Tool Bag | Start every run with Stone Tools in hand. | 5 | `scrap_heap` | R2 |
| 2.2 | `sharp_eye_1` | small | Sharp Eye I | Grip rungs cost 10% less. | 4 | `scrap_heap`, `odd_lumber_1` | R2 |
| 2.3 | `bargain_bin` | notable | Bargain Bin | Line Mk upgrades cost 15% less. Every bolt in the bin is 'nearly new'. | 11 | `odd_lumber_1` | R2 |
| 3.1 | `sharp_eye_2` | small | Sharp Eye II | Grip rungs cost 10% less. | 25 | `tool_bag` | R2 |
| 3.2 | `patched_sail` | notable | Patched Sail (scene) | Island upgrades cost 20% less; the skiff flies a sail of three old tarps. | 66 | `tool_bag`, `sharp_eye_1` | R2 |
| 3.3 | `iron_bag` | automation | Iron Bag | Start every run with Iron Tools in hand. | 44 | `sharp_eye_1`, `bargain_bin` | R2 |
| 3.4 | `bolt_bucket_1` | small | Bolt Bucket I | Line Mk upgrades cost 10% less. | 33 | `bargain_bin` | R2 |
| 4.1 | `deep_pockets` | unlock | Deep Pockets (scene) | Pocket slot 2 opens (15 scrap): keep a second upgrade through every blast. | 333 | `sharp_eye_2` | R5 |
| 4.2 | `odd_lumber_2` | small | Odd Lumber II | Island upgrades cost 10% less. | 222 | `sharp_eye_2`, `patched_sail` | R3 |
| 4.3 | `sorted_yard` | completion | Sorted Yard (scene) | Every shelf upgrade costs 10% less. The heap finally has labels. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `sharp_eye_3` | small | Sharp Eye III | Grip rungs cost 10% less. | 222 | `iron_bag`, `bolt_bucket_1` | R3 |
| 4.5 | `salvage_cart` | automation | Salvage Cart (scene) | One tap buys every shelf upgrade you can afford, cheapest first. | 333 | `bolt_bucket_1` | R3 |
| 5.1 | `quick_winch` | small | Quick Winch | The Magnet hauls 1 h sooner: early from 19 h, sure from 22 h, by itself at 23 h. | 2,222 | `deep_pockets` | R5 |
| 5.2 | `spare_parts` | notable | Spare Parts | Every Line Mk pays ×3.35, not ×3. Nobody asks where the spare bolts go. | 5,555 | `odd_lumber_2` | R3 |
| 5.3 | `hoarder` | keystone | Hoarder (scene) | Lines +10% per hour of output held unspent, to +100%. Line units cost ×2. | 7,777 | `sorted_yard` | R3 |
| 5.4 | `first_shelf` | automation | First Shelf | Start every run with Sorting Tables already standing. | 2,222 | `sharp_eye_3` | R3 |
| 5.5 | `bolt_bucket_2` | small | Bolt Bucket II | Line Mk upgrades cost 10% less. | 3,333 | `salvage_cart` | R3 |
| 6.1 | `greased_cable` | small | Greased Cable | The Magnet hauls 1 h sooner again: early from 18 h, sure from 21 h, alone at 22 h. | 22,200 | `quick_winch` | R5 |
| 6.2 | `cart_shed` | notable | Cart Shed | Start every run with Handcarts; island upgrades cost 10% less. | 44,400 | `quick_winch`, `spare_parts` | R3 |
| 6.3 | `gold_braid` | notable | Gold Braid | Each crew rank pays ×2.1, not ×2: ×40.8 at rank 5, was ×32. | 55,500 | `spare_parts`, `hoarder` | R5 |
| 6.4 | `wreck_salvage_1` | small | Wreck Salvage I | Armored lines (Ship Breaker, Reactor) ×1.5. | 33,300 | `hoarder`, `first_shelf` | R3 |
| 6.5 | `sewn_lining` | unlock | Sewn Lining (scene) | Pocket slot 3 opens (40 scrap): a third upgrade rides out every blast. | 44,400 | `first_shelf`, `bolt_bucket_2` | R5 |
| 6.6 | `odd_lumber_3` | small | Odd Lumber III | Island upgrades cost 10% less. | 22,200 | `bolt_bucket_2` | R3 |
| 7.1 | `mk_kit` | automation | Mk Kit | Start every run with Line Mk II on your first six lines (Beachcomber to Kiln). | 222,000 | `greased_cable` | R7 |
| 7.2 | `heavy_coil` | small | Heavy Coil | The Magnet hauls 1 h sooner again: early from 17 h, sure from 20 h, alone at 21 h. | 222,000 | `cart_shed` | R7 (data R5) |
| 7.3 | `double_rivets` | small | Double Rivets | Every Line Mk pays ×3.7. | 444,000 | `gold_braid` | R7 |
| 7.4 | `odd_lumber_4` | small | Odd Lumber IV | Island upgrades cost 10% less. | 333,000 | `wreck_salvage_1` | R7 |
| 7.5 | `bolt_bucket_3` | small | Bolt Bucket III | Line Mk upgrades cost 10% less. | 333,000 | `sewn_lining` | R7 |
| 7.6 | `odds_and_ends` | notable | Odds and Ends (scene) | All lines ×1.02 per Scrapyard node lit, up to ×1.6. Nothing here is junk. | 777,000 | `odd_lumber_3` | R7 |
| 8.1 | `night_crane` | small | Night Crane | The Magnet hauls 1 h sooner again: early from 16 h, sure from 19 h, alone at 20 h. | 2.22M | `mk_kit` | R7 (data R5) |
| 8.2 | `wreck_salvage_2` | small | Wreck Salvage II | Armored lines (Ship Breaker, Reactor) ×1.5. | 3.33M | `mk_kit`, `heavy_coil` | R7 |
| 8.3 | `brass_polish` | notable | Brass Polish | Each crew rank pays ×2.2: ×51.5 at rank 5. Shine them pips. | 5.55M | `heavy_coil`, `double_rivets` | R7 (data R5) |
| 8.4 | `sentimental` | keystone | Sentimental | Pocketed island upgrades and Line Mks pay 40% more. One Pocket slot fewer. | 7.77M | `double_rivets`, `odd_lumber_4` | R7 (data R5) |
| 8.5 | `power_kit` | automation | Power Kit | Start every run with Salvaged Tools in hand. | 2.22M | `odd_lumber_4`, `bolt_bucket_3` | R7 |
| 8.6 | `odd_lumber_5` | small | Odd Lumber V | Island upgrades cost 10% less. | 3.33M | `bolt_bucket_3`, `odds_and_ends` | R7 |
| 8.7 | `bolt_bucket_4` | small | Bolt Bucket IV | Line Mk upgrades cost 10% less. | 2.22M | `odds_and_ends` | R7 |
| 9.1 | `bolt_bucket_5` | small | Bolt Bucket V | Line Mk upgrades cost 10% less. | 22.2M | `night_crane` | R7 |
| 9.2 | `junk_drawer` | unlock | Junk Drawer | Once a run, swap a full Pocket at any time, not just before your first buy. | 33.3M | `wreck_salvage_2` | R7 (data R5) |
| 9.3 | `wreck_salvage_3` | small | Wreck Salvage III | Armored lines (Ship Breaker, Reactor) ×1.5. | 44.4M | `brass_polish` | R7 |
| 9.4 | `yard_boss` | completion | Yard Boss (scene) | Each crew rank pays ×2.25 and every Line Mk ×4. The yard has a boss now. | 55.5M | all of ring 8 (AND) | R7 (data R5) |
| 9.5 | `bolt_bucket_6` | small | Bolt Bucket VI | Line Mk upgrades cost 10% less. | 22.2M | `power_kit` | R7 |
| 9.6 | `golden_hook` | unlock | Golden Hook (scene) | Once a week the Magnet lands a gold-painted bolt. Pretty. Worth nothing. | 33.3M | `odd_lumber_5` | R7 (data R5) |
| 9.7 | `odd_lumber_6` | small | Odd Lumber VI | Island upgrades cost 10% less. | 22.2M | `bolt_bucket_4` | R7 |

### Scene drawings (`04` 2.5)

| Node | Slot | What the island shows |
| --- | --- | --- |
| `scrap_heap` | 1.1 | a junk heap beside the beached skiff, one layer taller each Wipe Day (drawing caps at #50) |
| `patched_sail` | 3.2 | the beached skiff gets a mast and a sail stitched from three mismatched tarps |
| `deep_pockets` | 4.1 | a second barnacled locker stands beside the first by the skiff |
| `sorted_yard` | 4.3 | the junk heap is split into hand-labelled bins (TOOLS, BOLTS, PLANKS, ???) |
| `salvage_cart` | 4.5 | a rusty shopping trolley with one wonky wheel parked by the skiff |
| `hoarder` | 5.3 | while slotted: supply crates stack around the cabin, one stack per hour held (up to 10) |
| `sewn_lining` | 6.5 | a third locker joins the row by the skiff, its lid wired shut with a coat hanger |
| `odds_and_ends` | 7.6 | a junk wind chime by the skiff gains a piece (spoon, key, bottle cap) per Scrapyard node lit |
| `yard_boss` | 9.4 | a YARD BOSS sign swings from the Magnet's crane; the crane's lamp gets a hard hat |
| `golden_hook` | 9.6 | a bolt board at the crane's foot; one gold-painted bolt screwed on each week |

Bands: rings 1-3 (Scrap Heap, Patched Sail), 4-6 (Sorted Yard and Salvage Cart in R3; the lockers in
R5), 7-9 (Odds and Ends, Yard Boss, Golden Hook). Deep Pockets and Sewn Lining reuse one locker
drawing.

## Mechanics behind the features

| Node | Feature (phase) | Rule |
| --- | --- | --- |
| Hoarder | `feature:hoarder` (R3) | Lines × `1 + 0.1 × min(10, H)`, H = supplies held at your last command ÷ one hour of the line rate (without Hoarder) at that moment. Fixed between commands, so settle stays piecewise constant and path independent (`09` 4.8). Line units cost ×2 (`line_cost` more 2). The Foreman spends the hoard: the sheet says "The Foreman spends what you hold; switch him off in Crew to hoard" (a link, not a block). Crate stacks by the cabin show H |
| Salvage Cart | `feature:salvage_cart` (R3) | One command buys Grip rungs, Line Mks and island upgrades (never eras), cheapest first, keeping the advisor's crowned price in reserve as the Foreman's pass does (resolution 1.10). A secondary button on the Upgrades tab: "Buy all · 7 · 1.2M", disabled with its reason at 0 |
| Deep Pockets, Sewn Lining | `feature:pocket_slot_2`, `pocket_slot_3` (R5) | Make Pocket slots 2 and 3 buyable at 15 and 40 scrap (resolution 3.10) |
| Sentimental | `feature:sentimental` (R5 data, code by R7) | A pocketed island upgrade pays ×2.8 (not ×2), a pocketed Line Mk ×4.2 (not ×3); Grip rungs unchanged, so `c` stays within 0.6. The highest owned slot sleeps ("asleep while Sentimental is slotted") and keeps its upgrade. The sheet warns before the buy when only one slot is owned |
| Junk Drawer | `feature:junk_drawer` (R5 data) | One swap of a full Pocket per run, at any time; the picker lists this run's buys |
| Golden Hook | `feature:golden_hook` (R5 data) | A gold-painted bolt each week (Monday 00:00 UTC, the Freighter's clock) on a bolt board at the crane; a count, never scrap |
| Odds and Ends | none (vocabulary) | `per: sector:scrapyard` counts lit Scrapyard nodes, keystones included: ×1.6 from 30 nodes |

| Build | Scrapyard nodes shown |
| --- | --- |
| R2 | 9: rings 1-3, no features |
| R3 | 20: + 4.2-4.5, 5.2-5.5, 6.2, 6.4, 6.6 (features: Salvage Cart, Hoarder) |
| R5 | 25: + Deep Pockets, Quick Winch, Greased Cable, Gold Braid, Sewn Lining (04 1.4's five) |
| R7 | 45: rings 7-9 |

## Open questions

1. **Winches and the 10% rule.** One hour off a 24-hour cycle is 4-5%, under check 12's 10%. The
   winches are fixed stat nodes in 04 6.10 and `05` 2.2 and sit in 04 10.2's steps, so check 12
   should exempt `magnet_hours` (a timer, not a multiplier).
2. **`mk_mult` steps.** Double Rivets (×3.7) needs a `mk_mult` row in 04 10.2's step table (rings
   6-9: 3.7). Ranks have no small: with 2.1 / 2.2 / 2.25 on notables, no rank step reaches 10%.
3. **Sentimental's downside lives in its feature.** Check 5 wants an effect that lowers a stat;
   either it reads a feature's printed downside, or `09` 5.1 registers `pocket_cap` (set, keystones
   only), as it does `hand_cap`.
4. **Wreck Salvage's weight.** Counted at the Armored era's 0.97 (`10` 6.2.3). At 04 7.3's planning
   weight (one era at half) the sector sits further under its share; the simulator decides.
5. **Hoarder's simulator row** must show the idler at most ×2 with ×2 line prices, and measure the
   Foreman interaction.
6. **Power Kit** gives Salvaged Tools (`10` 6.4), not Power Tools; the owner may prefer the name
   Salvage Kit to avoid the mix-up.
