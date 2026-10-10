# 02. The run

Status: proposal, 2026-10-07, awaiting the owner's approval (amendment A3). Expands canon
section 4 and amendment A1 as settled by the design director's resolutions (canon v2, cited as
"resolution 3.3" for item 3 of section 3). Numbers are P1 from `10-balance.md` (resolution 1).
Constants marked *(sim)* are starting values the simulator may retune in data; names marked
(proposal) need the owner's pass.

A **run** is one island's life between two nukes: from "Tap the tree." on a bare beach to the
Big Red. This file designs everything inside it. The nuke itself (yield, the Kettle, the cover
card, the cinematic, Afterglow's look, the rebuild screen) is in `03-the-big-red.md`; the
permanent layers in `04-blast-map.md` and `05-meta-layers.md`; wireframes in `08-screens.md`;
settle, commands and storage in `09-architecture.md`.

Clocks: lines and the Night Shift run on the game clock. Taps, Hustle, felling, flotsam, buffs
and Afterglow run on real seconds and never speed up with the demo clock (canon 12.3, rule
6.3.9). In production the two are the same clock. The demo clock runs at 1× with time jumps
(+1 h, +6 h, next day; resolution 3.18): a jump moves lines and the Night Shift, never a buff
or a flotsam window.

---

## 1. Resource model and product badges

### 1.1 One currency, visible products

- **Supplies** (`supplies`) is the only run currency. A line sells what it makes as supplies
  the moment it makes it. Nothing is stocked, capped, carried over or spent except supplies.
- Each line has exactly one **product**: an id, an icon, a name and a drawing. It is a badge,
  never a resource. It answers "what does this building do?" at a glance and keeps the Rust feel
  of a base that makes things.
- Product ids reuse existing resource and item ids wherever one fits, so the icons the owner
  already drew stay in use (A1). Three are new. No product is shared by two lines.

| # | Line | Product id | Reused from | Name (proposal) | Drawn in the scene |
| --- | --- | --- | --- | --- | --- |
| 1 | `beachcomber` | `timber` | resource | Driftwood | bleached driftwood bundles at the tideline |
| 2 | `campfire` | `roast` | item (meal) | Smoked Fish | fish on skewers over the fire, then on a drying rack |
| 3 | `garden` | `fibre` | resource | Hemp | hemp sheaves tied with twine |
| 4 | `loom` | `rope` | resource (part) | Rope | rope coils on a peg |
| 5 | `workbench` | `planks` | resource (part) | Planks | a plank stack |
| 6 | `kiln` | `charcoal` | resource (part) | Charcoal | black sacks |
| 7 | `furnace` | `ingots` | resource | Ingots | stacked ingots, glowing for a second |
| 8 | `tannery` | `leather` | resource (part) | Leather | rolled hides on a rack |
| 9 | `press` | `fuel` | resource (part) | Lamp Oil | drums with a red band |
| 10 | `dock` | `food` | resource | Fish Crates | crates of fish on the jetty |
| 11 | `generator` | `battery` | new | Batteries | batteries with a spark |
| 12 | `radio_mast` | `broadcast` | new | Broadcasts | radio rings rising from the mast top |
| 13 | `shipbreaker` | `plates` | resource (part) | Steel Plates | cut plates on a sledge |
| 14 | `reactor` | `cell` | new | Power Cells | glowing cells in a cradle |

- The Garden draws hemp (the `fibre` icon), not vegetables, so only two lines draw fish, and
  their icons differ: a skewer (`roast`) and a crate (`food`).
- The Radio Mast's product is `broadcast` (resolution 3.21), not A1's `signal`, the removed
  season system's id.
- `resources.json5` is slimmed to the currencies and these 14 product ids, not deleted, so
  locale keys and icons survive (resolution 3.19). Names keep their keys,
  `resource.<id>.name`; `roast` moves there from `item.roast.name`, and the three new ids are
  added. The other 12 resources and 13 items leave the data (10 items stop, the three keycodes
  wait; `07-what-changes.md`). `stone`, `ore` and `sulfur` live on as **target** ids, another
  icon kind.
- Icons live at `packages/content/icons/product/<id>.svg` (resolution 3.22); an icon already
  drawn as a resource or item moves there unchanged.

### 1.2 Where a product appears (the same icon in three places)

1. **The shop row.** The line's building icon (40 px) carries its product badge (18 px) on the
   lower-right corner. The line's info sheet reads "Makes rope. Every coil sells for supplies
   at once."
2. **The floater.** When a cycle completes, "+1.2k" with the product icon rises from the
   building and flies into the Supplies counter (0.6 s, ease-in). Line floaters show only for
   effective cycles of 2 s or more, merge per line within 1 s, and take at most 4 of the 12
   pooled floaters (canon 12.4), biggest first; tap floaters always win a slot.
3. **The scene.** Each cycle pops one product sprite onto the building's pile; the pile gets a
   second stack at 10 owned, and a crew member or the hand carts it off every few cycles. Lines
   faster than 0.5 s pop at most twice a second.

Each line also has its own one-shot sound on a completed cycle (procedural, canon 12.4),
throttled to 4 per second across all lines, the biggest earner first.

---

## 2. The 14 lines

### 2.1 Formulas *(sim)*

For rung `i` from 1 to 14:

| Quantity | Formula |
| --- | --- |
| Base cost | `c_i = 6 × 16^(i−1)` |
| Base output per unit | `r_i = 1.5 × 4.75^(i−1)` supplies per second (P1; canon ×5.5) |
| Base cycle | `t_i = 0.6 × 2^(i−1)` seconds |
| Growth | `g_i = 1.15 − 0.006 × (i − 1)` |
| Hand price | `h_i = 300 × c_i` |
| Price of the next unit, owning `n` | `P(n) = c_i × g_i^n × d` (`d` = discount from nodes, 1 by default) |
| Effective cycle | `t_eff = max(0.1 s, t_i / speed)`; speed beyond the floor becomes payout |
| Line rate | `R_i = owned × r_i × fold_i` supplies per second |
| Payout of one cycle | `R_i × t_eff` |

`fold_i` is the effect evaluator's fixed order (canon 13.5): base → add → milestones (per line,
then roster) → `(1 + Σinc)` → `Πmore` (Line Mk, island upgrades, eras, crew ranks, Grit, nodes)
→ Glow → Morale → transient buffs (Rally, Drowned Drone). Speed milestones multiply `R_i` and
divide the cycle.

So the first unit costs `c_i`, the 10th costs `c_i × g_i^9`. Costs rise ×16 per rung and output
×4.75, so base payback rises about ×3.4 per rung (4 s for the Beachcomber, about 330 days for
the Reactor before multipliers) and the cheapest output keeps moving between lines.

### 2.2 The table

| # | Line (id) | Era | Base cost | Base /s | Cycle | Growth | Hand | Hand price |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Beachcomber (`beachcomber`, new) | Twig | 6 | 1.5 | 0.6 s | 1.150 | Mara | 1.8k |
| 2 | Campfire (`campfire`) | Twig | 96 | 7.13 | 1.2 s | 1.144 | Dax | 28.8k |
| 3 | Garden (`garden`) | Twig | 1.54k | 33.8 | 2.4 s | 1.138 | Ivo | 461k |
| 4 | Loom (`loom`) | Timber | 24.6k | 161 | 4.8 s | 1.132 | Rook | 7.37M |
| 5 | Workbench (`workbench`) | Timber | 393k | 764 | 9.6 s | 1.126 | Sela | 118M |
| 6 | Charcoal Kiln (`kiln`) | Timber | 6.29M | 3.63k | 19 s | 1.120 | Bram | 1.89B |
| 7 | Furnace (`furnace`) | Stone | 101M | 17.2k | 38 s | 1.114 | Wren | 30.2B |
| 8 | Tannery (`tannery`) | Stone | 1.61B | 81.8k | 77 s | 1.108 | Otto | 483B |
| 9 | Oil Press (`press`) | Stone | 25.8B | 389k | 2.6 min | 1.102 | Juno | 7.73T |
| 10 | Dock (`dock`) | Sheet Metal | 412B | 1.85M | 5.1 min | 1.096 | Pike | 124T |
| 11 | Generator (`generator`) | Sheet Metal | 6.6T | 8.77M | 10 min | 1.090 | Hale | 1.98Qa |
| 12 | Radio Mast (`radio_mast`) | Sheet Metal | 106T | 41.7M | 20 min | 1.084 | Tamsin | 31.7Qa |
| 13 | Ship Breaker (`shipbreaker`, new) | Armored | 1.69Qa | 198M | 41 min | 1.078 | Gus (new) | 507Qa |
| 14 | Reactor (`reactor`, new) | Armored | 27Qa | 940M | 82 min | 1.072 | Vera (new) | 8.11Qi |

Cycle payouts at one unit, before multipliers: 0.9, 8.55, 81.2, 772, 7.33k, 69.6k, 662k, 6.29M,
59.7M, 567M, 5.39B, 51.2B, 486B, 4.62T. The long top cycles double as check-in clocks.

### 2.3 Drawings: three stages per line

Buildings redraw at **1, 25 and 100 owned** with a count badge in screen space (D46). Eleven
lines reuse today's three drawn levels in `apps/web/src/scene/buildings.ts` and `base.ts`;
three are new art. When an era opens, its lines' plots appear as staked outlines with a price
sign, so the island shows what comes next.

| Line | Stage 1 (1 owned) | Stage 2 (25) | Stage 3 (100) |
| --- | --- | --- | --- |
| Beachcomber (new) | a figure with a sack walking the tideline | a driftwood drying rack and a second sack | a tarp shelter, a handcart and a big driftwood stack |
| Campfire | today's fire ring | tripod, pot and log bench | the open-roofed kitchen with a table |
| Garden | one bed | two beds and a fence | three beds, scarecrow, rain barrel |
| Loom | frame and warp | the lean-to | bolts hang (recoloured as rope coils) |
| Workbench | the bench | tool board and vise | anvil and lamp |
| Kiln | small kiln | banded kiln | big kiln |
| Furnace | today's furnace | the large furnace | the electric smelter (the old furnace types become stages) |
| Tannery | racks | soaking vat | today's level 3 |
| Oil Press | the press | one drum | two drums |
| Dock | short jetty and boat | longer jetty | boathouse with a lamp |
| Generator | skid engine | cable pole | the big engine |
| Radio Mast | the pole | lattice mast | tall mast with dishes, red light on top |
| Ship Breaker (new) | a beached hull section and a torch | a gantry with a winch | a slipway, half a ship, a plate sledge |
| Reactor (new) | a salvaged drum in a fenced pit | pipes and a cooling stack | a cooling tower with steam and warning lights (lights layer, D47) |

### 2.4 Unit costs (the n-th unit costs `c_i × g_i^(n−1)`)

| Line | 1st | 10th | 25th | 50th | 100th | First 25 | First 100 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Beachcomber | 6 | 21.1 | 172 | 5.65k | 6.13M | 1.28k | 47.0M |
| 4 Loom | 24.6k | 75.0k | 482k | 10.7M | 5.26B | 3.95M | 45.1B |
| 7 Furnace | 101M | 266M | 1.34B | 20.0B | 4.41T | 12.2B | 43.1T |
| 10 Dock | 412B | 941B | 3.72T | 36.8T | 3.60Qa | 38.2T | 41.1Qa |
| 14 Reactor | 27.0Qa | 50.5Qa | 143Qa | 815Qa | 26.4Qi | 1.76Qi | 392Qi |

Gentler growth on high rungs means the top lines are owned in the hundreds: 1e45 supplies buys
about 714 Beachcombers but 908 Reactors.

### 2.5 Buy-k and buy-max (closed form)

- **Buy `k`**, owning `n`: `C(n, k) = c_i × d × g_i^n × (g_i^k − 1) / (g_i − 1)`.
- **Max**, holding `S`: `k = floor( ln(1 + S × (g_i − 1) / (c_i × d × g_i^n)) / ln g_i )`. A
  floating-point guard steps `k` down by one if `C(n, k) > S`.
- Examples: owning 10 Looms, ×10 costs 1.58M and ×100 costs 156B; holding 1M, Max buys 7
  for 889k. Owning 40 Furnaces and holding 1T, Max buys 25 for 919B.
- The **×1 / ×10 / ×100 / Max** toggle appears after the second hand of run 1 and stays from
  then on. A ×10 the player cannot afford stays visible and disabled ("need 1.58M"); Max shows
  its count ("Max (7) · 889k") and is disabled at 0.

---

## 3. Manned and unmanned lines

### 3.1 Rules

| | Manned (a hand is hired) | Unmanned (no hand) |
| --- | --- | --- |
| Produces | continuously, `R_i` per second | only in cycles that credited taps start |
| While away | yes, inside the Night Shift window | no (the cycle in flight still finishes and pays) |
| Paid | continuously; the bar is animation | each cycle at its end |
| State | none beyond `owned` and the hire | `readyAt`: when the cycle in flight ends |

**Crediting an unmanned line** (resolution 3.3). At most one cycle is in flight per unmanned
line, and a tap starts one only when the line is idle. A `taps` batch `{count, from, to}` first
passes the token bucket (section 7.4), giving `credited`. Then, for every owned unmanned line:

1. `s0 = max(from, readyAt)`. If `s0 > to`, the line was busy for the whole batch: no new cycle.
2. Otherwise `k = min(credited, floor((to − s0) / t_eff) + 1)` cycles run back to back from
   `s0`, and `readyAt = s0 + k × t_eff`.
3. Each cycle pays `R_i × t_eff` at its end, with the multipliers in force then. Cycles that
   ended before the batch is applied pay at once; the last one pays when settle passes
   `readyAt`, even if tapping stopped (a scheduled payout in closed form).

So one tap a second on a 19-second Kiln runs it once every 19 seconds, not at 19 times its rate.
A player tapping faster than once per cycle keeps the line running exactly as if manned, and a
line whose cycle is shorter than the gap between taps runs a fraction
`min(1, taps per second × t_eff)` of the time. A Beachcomber at 50 owned (0.15 s cycle) runs 90%
of the time at 6 taps per second and 60% when holding (4 per second). Speed milestones therefore
pay fully only with a hand: one more reason to hire.

### 3.2 What the row shows

| Part | Manned | Unmanned |
| --- | --- | --- |
| Left of the bar | the hand's round portrait (24 px, rank chevrons from R5) | a small tap glyph |
| Label | "Loom ×38" | "Loom ×38" with "Runs while you tap" under it |
| Bar | loops; below 0.25 s a moving stripe | fills during a running cycle; empty and grey when idle |
| Rate | "+1.2k/s" | "+1.2k/s" while running; "Idle · tap to run" when not |
| Hand row | none | a separate row under the line once one is owned, with one button and one price: "Hire Rook · 7.37M" (crowned when the advisor picks it; errata E5) |
| Under the bar | the next milestone: "38/50 → speed ×2" | the same |

The top bar's `/s` counts manned lines plus unmanned lines with a cycle running, including
active buffs. It climbs while you tap and settles back when you stop: the number tells the story.

### 3.3 Edge cases

| Case | Rule |
| --- | --- |
| A unit is bought while a cycle is in flight | its payout at `readyAt` uses the new count (AdVenture Capitalist's behaviour) |
| A speed milestone lands mid-cycle | the running cycle keeps its length; the next cycle is shorter |
| A hand is hired mid-cycle | the cycle in flight pays at once in full ("Rook finishes the cycle you started"); continuous accrual starts at the hire |
| The player stops tapping | the running cycle finishes and pays; no new one starts |
| The tab closes mid-cycle | the cycle pays when settle passes `readyAt`, even offline |
| A nuke | settle pays every cycle in flight in full, then the run folds (`03-the-big-red.md`) |
| Taps over the bucket | do not start cycles and do not raise Hustle |
| Another command arrives | the client flushes the open taps batch first, so the server always sees taps and purchases in the order they happened |
| A kept hand with 0 owned | the portrait waits on the empty plot: "Mara is waiting for your first Beachcomber"; the first unit is manned at once |
| Lone Wolf keystone (no hands, taps ×50; `04-blast-map.md`) | every line is unmanned; nothing runs offline; the hand row shows the reason in place of the Hire button |
| Quiet Hands Dare (no taps after minute 5) | unmanned lines stop after minute 5; the row says why |

---

## 4. Milestones

### 4.1 Per line

| Owned | Effect | Row and toast | Scene |
| --- | --- | --- | --- |
| 1 | the line starts | the row appears with its bar | stage 1 pops up on its plot (today's building pop) |
| 10 | payout ×2 | toast "Beachcombers ×2" | the product pile gets a second stack (the Beachcomber gets a small sorting table, canon 4.9) |
| 25 | speed ×2 | the bar visibly halves; "Speed ×2" | redraw to stage 2 with the pop |
| 50 | speed ×2 | the bar halves again | a helper figure works beside the hand (or a second silhouette on an unmanned line) |
| 100 | payout ×2 | toast | redraw to stage 3 |
| 200 | ×3 | toast | a bronze pennant on the building |
| 300 | ×3 | toast | a silver pennant |
| 400 | ×4 | toast | a gold pennant |
| 500, 600, 700, 800, 900 | ×2 each | toast | the count badge gains a star per hundred |
| 1,000 | ×5 | big toast | the building gets a warm outline on the lights layer |
| 1,100 and every 100 after | ×2 | toast | none |

- A speed milestone that would take the effective cycle below **0.1 s** doubles the payout
  instead. Line milestones alone never reach the floor (the Beachcomber bottoms at 0.15 s);
  Works nodes can (`04-blast-map.md`).
- The row always shows the next one: "38/50 → speed ×2", "87/100 → ×2". The toast names the
  line and the effect, never a bare "Milestone!".
- Union Rules (Works ring 4) turns every ×2 above into ×2.2 (resolution 3.13).

### 4.2 Roster (every unlocked line)

| Each unlocked line at | Effect | Shop header | Scene |
| --- | --- | --- | --- |
| 25 | all lines ×2 | one bar: "Roster 18/25 → all ×2" (the lowest count among unlocked lines) | bunting across the base |
| 100 | all lines ×2 | "Roster 61/100 → all ×2" | a flag on every building |
| 250 | all lines ×3 | "Roster 140/250 → all ×3" | a big flag on the base roof |

"Unlocked" means every line the current era has opened. A roster milestone, once reached, is
kept for the rest of the run (resolution 3.4): buying an era adds three lines at 0 but never
takes a ×2 away, so an era never lowers income. The next tier counts every line unlocked at the
time.

---

## 5. The shelf (the Upgrades tab)

### 5.1 How it reads

- The Upgrades tab of the shop drawer; the beached skiff in the scene opens it (canon 11).
- One list, sorted: affordable rows by price, then locked rows by price. Each row has its group
  glyph (tool, Mk plate, island prop, era badge), name, one-line effect "in the player's
  numbers" ("All lines ×2: +38k/s now"), price and one button.
- A row is **visible** once its line is unlocked (Mk), the previous rung is owned (Grip) or the
  previous one is bought (island upgrades, eras). A visible row whose condition is unmet is
  disabled with its reason ("Needs 25 Looms · 17/25"). Nothing unshipped is ever shown.
- Bought rows collapse into "Bought · 12" at the bottom; tapping it lists them with their
  effects. A Pocket chip marks pocketed ones (R5).

Canon 4.4's "about 50" one-off purchases are 44 on the shelf (4 Grip rungs, 28 Line Mks, 8
island upgrades, 4 eras); with the 14 hands a run has 58. **40 are Pocket-eligible**: every Grip
rung, Line Mk and island upgrade; never an era. A pocketed upgrade is active from the first
second of a run, whatever its condition. Slots, prices and the swap rule are in
`05-meta-layers.md` (resolution 3.10).

### 5.2 Grip (the five tool ids, kept in `tools.json5`)

Each rung doubles the flat tap and adds 0.4% of the full rate to every tap *(sim; canon 1%)*.
The effects are per rung, so a pocketed Iron Tools works even before Stone Tools is bought.

| Id | Name | Cost | Visible when | Tap after it | Pocket |
| --- | --- | --- | --- | --- | --- |
| `rock` | Rock | start | always owned | 1 per tap | no (owned) |
| `stone_tools` | Stone Tools | 60 | Rock | 2 + 0.4% of the full rate | yes |
| `iron_tools` | Iron Tools | 6k | Stone Tools | 4 + 0.8% | yes |
| `salvaged_tools` | Salvaged Tools | 6M | Iron Tools | 8 + 1.2% | yes |
| `power_tools` | Power Tools | 6B | Salvaged Tools | 16 + 1.6% | yes |

In the scene, each rung changes the tap feedback: a dull thud and bark chips (Rock), stone
chips, iron sparks, a salvaged blade's ring, a power tool's buzz with a spark shower. The tap
sound changes with it.

### 5.3 Line Mk II and Mk III (28)

Mk II: line ×3, price `c_i × 10^4`, needs 25 owned. Mk III: line ×3, price `c_i × 10^8`, needs
50 owned *(sim)*. Ids `{line}_mk2` and `{line}_mk3`; the name is the line's plus a subtitle
(proposal). In the scene, a riveted plate with the mark is nailed to the building.

| Line | Mk II (subtitle) | Mk II price | Mk III (subtitle) | Mk III price |
| --- | --- | --- | --- | --- |
| Beachcomber | Driftwood Hooks | 60k | Beach Sledges | 600M |
| Campfire | Smoke Racks | 960k | Clay Oven | 9.6B |
| Garden | Rain Barrels | 15.4M | Terraces | 154B |
| Loom | Foot Treadle | 246M | Rope Walk | 2.46T |
| Workbench | Bow Saw | 3.93B | Pit Saw | 39.3T |
| Kiln | Earth Mound | 62.9B | Brick Kiln | 629T |
| Furnace | Bellows | 1.01T | Blast Pipe | 10.1Qa |
| Tannery | Bark Vats | 16.1T | Drum Tumbler | 161Qa |
| Oil Press | Screw Press | 258T | Hydraulic Ram | 2.58Qi |
| Dock | Gill Nets | 4.12Qa | Trawler | 41.2Qi |
| Generator | Flywheel | 66Qa | Twin Engines | 660Qi |
| Radio Mast | Copper Coil | 1.06Qi | Relay Dish | 10.6Sx |
| Ship Breaker | Cutting Torch | 16.9Qi | Gantry Winch | 169Sx |
| Reactor | Cooling Loop | 270Qi | Control Rods | 2.7Sp |

### 5.4 Island upgrades (8)

All lines ×2 each *(sim)*. Each becomes visible when the previous one is bought, so the shelf
shows at most one. Each adds a prop to the island.

| Id | Name (proposal) | Price | Prop |
| --- | --- | --- | --- |
| `sorting_tables` | Sorting Tables | 1M | a sorting yard of long tables under a tarp beside the base |
| `handcarts` | Handcarts | 10B | carts trundle between the lines and the base |
| `rope_lift` | Rope Lift | 100T | a rope lift up the slope |
| `rail_spur` | Rail Spur | 1Qi (1e18) | a short rail along the shore with a pump trolley |
| `diesel_crane` | Diesel Crane | 10Sx (1e22) | a crane at the dock |
| `tide_mill` | Tide Mill | 100Sp (1e26) | a waterwheel at the shore |
| `cable_car` | Cable Car | 1No (1e30) | a cable car from the base to the rise |
| `steam_hammer` | Steam Hammer | 10Dc (1e34) | a steam hammer beside the furnace |

### 5.5 Eras (4)

On the shelf and also as a wide row at the foot of the Lines tab, above the three locked rows it
opens. Details in section 6.

| Id (tier id) | Price | Visible when | Effect | Pocket |
| --- | --- | --- | --- | --- |
| `wood` (Timber) | 1.5k | start | all lines ×2; opens lines 4-6 | never |
| `stone` | 3M | Timber | ×2; lines 7-9 | never |
| `metal` (Sheet Metal) | 20B | Stone | ×2; lines 10-12 | never |
| `hqm` (Armored) | 400T | Sheet Metal, after Wipe Day #2 | ×2; lines 13-14 | never |

Before Wipe Day #2 the Armored row reads "Opens after Wipe Day #2" (a real, reachable reason);
before R2 ships it is hidden. Wipe Days are counted nukes, those adding at least 10% to glass
ever (resolution 3.1); a small blast does not move the count.

---

## 6. Eras and targets

### 6.1 The table

| Era (tier id) | Price *(sim)* | Lines | Target (id) | Fells after *(sim)* | Felling | Fell cry | The next one |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Twig (`twig`) | start | 1-3 | Lone Pine (`tree`) | 40 taps | tips and falls away from the base (today's 1.1 s fall), leaves burst | "Timber!" | a pine springs from the stump with today's regrow pop |
| Timber (`wood`) | 1.5k | 4-6 | Outcrop (`stone`) | 60 | crumbles to rubble (today's 0.45 s crumble) | "Crumble!" | a fresh outcrop pushes up |
| Stone (`stone`) | 3M | 7-9 | Ore Seam (`ore`) | 80 | splits; ore nuggets spray | "Rich vein!" | the seam closes into a new face |
| Sheet Metal (`metal`) | 20B | 10-12 | Sulfur Vent (`sulfur`) | 100 | the crust pops in a yellow puff | "Pop!" | a new crust bubbles up |
| Armored (`hqm`) | 400T, after Wipe Day #2 | 13-14 | The Wreck (`wreck`, new) | 120 | the hull section bursts; plates fly | "Cracked open!" | the next section slams down in rust dust |

Era multipliers stack: ×2, ×4, ×8, ×16 at Armored. Prices are the same every run; Works nodes
may discount them (to ×0.5 at most, errata E25) or start runs in a later era (`04-blast-map.md`).

**The Wreck** (new art and icon `target/wreck`): a rusted hull section half-buried on the
rise, rivets and a porthole, taps knock sparks and flakes of paint off; wear shows as peeling
plates (today's wear marks, `drawWear` in `scene/nodes.ts`).

### 6.2 What an era purchase does (instantly, about 1.2 s of show)

1. The old target is felled one last time with its cry, and the new one pushes up in its place.
2. The base redraws in the era's colour with today's tier pop (`Base.setTier`).
3. Three staked plots appear for the new lines, each with a price sign; the drawer shows their
   rows locked with prices, and the cheapest is usually affordable within seconds (rule 6.3.3).
4. The HUD's era badge changes; the fell count and cry change; the toast reads "Timber era:
   all lines ×2. Loom, Workbench and Kiln are open."
5. The scene's trees, rocks and seams that were targets before stay as scenery.

Run 1 times (resolution 3.29 with the 2-minute guaranteed crate, errata E1; P1 model at 6 taps
per second, greedy buyer): Timber about 0:36, Mara 0:41, the second hand 1:30, the first crate
3:00, Sorting Tables 3:01, Stone 4:30, the first nuke about 46-48 minutes. The era is crowned
before the hand. R1 may slow the very first minute (for example a dearer Timber era) if
playtests find it rushed, within the N-asserts. Armored is first reached in run 3 or 4 (canon
4.10: "around nuke 3").

---

## 7. The tap verb

### 7.1 Tap value

One verb: tap the target. Every credited tap pays

```
tapValue = (2^grip × G + p × fullRate) × T × Hustle × Afterglow × B × crit
fellBonus = 10 × tapValue (without crit), once every N taps
```

| Term | Meaning |
| --- | --- |
| `grip` | Grip rungs owned (0 at Rock, 4 at Power Tools) |
| `G` | the global fold on the flat part: Glow × Morale × eras × island upgrades × roster × Grit, since `p × fullRate` already carries them; `09-architecture.md`'s evaluator names this set (errata E23) |
| `p` | 0.4% per Grip rung *(sim)*; Grip nodes raise it by at most +25% of itself |
| `fullRate` | every owned line at full speed as if manned, with every multiplier in force now, Rally and Drowned Drone included |
| `T` | tap nodes, `(1 + Σinc) × Πmore` (Calloused Hands +50%; Lone Wolf ×50) |
| `Hustle` | 1 to 2, to 2.25 at most with Grip nodes, section 7.3 |
| `Afterglow` | `1 + 2 × 2^(−t/300)`, `t` real seconds since the run's first tap (`run.afterglowFrom`), ends at 30 min; 1 in run 1 (resolution 3.2, `03-the-big-red.md`) |
| `B` | tap buffs: Adrenaline ×100, Rush ×5 (R5), Dare factors |
| `crit` | ×10 on a crit tap (Lucky Swing), else 1 |
| `N` | taps per fell for the era: 40, 60, 80, 100, 120 |

### 7.2 Worked examples (run 1, 6 taps per second, greedy buyer)

From the P1 model (`10-balance.md`, seed 7), Hustle full. Line income counts unmanned lines as
running, since taps come faster than their cycles.

| Moment | State | Tap value | Floater | Fell pays | Tap share of income |
| --- | --- | --- | --- | --- | --- |
| 1:00 | Stone Tools, Timber era, Mara hired, full rate about 820/s | `(2 × 2 + 0.004 × 820) × 2 = 14.6` | "+15" | 146 every 60 taps | 102/s of 921/s = 11% |
| 10:00 | Salvaged Tools, Stone era, Sorting Tables, 5 hands, full rate about 1.66M/s | `(8 × 8 + 0.012 × 1.66M) × 2 = 40.0k` | "+40.0k" | 400k every 80 | 270k/s of 1.93M/s = 14% |
| 30:00 | as above with 6 hands, full rate about 13.6M/s | `(64 + 0.012 × 13.6M) × 2 = 326k` | "+326k" | 3.26M every 80 | 2.2M/s of 15.8M/s = 14% |
| 30:00 with Adrenaline | as above, ×100 for 12 s | 32.6M | "+32.6M", gold | | 72 taps and a fell pay about 2.6B: about 3 minutes of line output |
| Run 2, 1:00 | Glow ×1.79, Calloused Hands, Afterglow ×2.74, Iron Tools, Timber era, full rate about 15k/s | `(4 × 1.79 × 2 + 0.008 × 15k) × 1.5 × 2 × 2.74 = 1.10k` | "+1.10k" | 11.0k every 60 | 7.7k/s of 22.7k/s = 34% (Afterglow is a burst) |

Rapid taps merge into one running floater ("+1.2k"), canon 12.4.

### 7.3 Hustle (the tap meter) *(sim)*

| Rule | Value |
| --- | --- |
| Fill | +1 per credited tap, held taps included |
| Range | 0 to 100 |
| Multiplier | `1 + (peak − 1) × H / 100`; `peak` = 2, at most 2.25 with Grip nodes (resolution 1.5; nodes `set` `hustle_max`); applied to the tap after its +1 |
| Grace | 2 real seconds after the last credited tap |
| Drain | then −10 per real second (×3 under Storm Season) |
| Nodes | Grip nodes may lengthen the grace, slow the drain or speed the fill (`hustle_hold`, `hustle_drain`, `hustle_gain`) |
| Offline | drains to 0; nothing else |
| Display | a thin arc around the target; "Hustle ×1.6" beside it above ×1.1; the arc glows at full |

At 6 taps per second Hustle fills in about 17 s; holding fills it in 25 s. A 2-second pause costs
nothing; a full meter empties 10 s after the grace. The server rebuilds it per batch: decay from
the last tap to `from`, then +1 per credited tap, so the sum over a batch is an arithmetic series
up to the cap. Storm Season's Dare reward counts inside the ×2.25 ceiling, so `c` stays at or
under 0.6 (`05-meta-layers.md`; errata E22).

### 7.4 The token bucket, from the player's side

- Up to **15 taps per second** are credited, with bursts of up to **45** (three seconds of
  frantic drumming count in full). Nobody tapping by hand meets it.
- Taps over it still shake the target and shed chips, but pop no floater, add no Hustle and
  start no cycles. There is no message, no toast, no rollback: the client predicts with the same
  bucket (canon 13.4).
- An autoclicker at 50 taps per second earns what 15 do. In run 1 that brings the first nuke
  from 48:00 to 40:30 (P1 model, about ×1.2); with the whole tree's tap nodes, taps are about
  37% of income at 6 per second, so it gains at most about ×1.5.
- Taps leave the client in batches (every ~1 s or 30 taps); the counter and floaters react on
  the frame, so batching is invisible.
- Taps on scene objects (the gull, the Kettle) ride in the same batch as `pokes`, clamped by the
  same bucket (resolution 3.14). They pay nothing; the Logbook (R4) counts them.

### 7.5 Hold to work, felling and crits

- **Hold to work:** a press held 0.35 s without moving more than 12 px becomes a hold that
  counts 4 taps per second, evenly spaced, until release. A ring around the finger shows it.
  It fills Hustle and starts cycles like taps (accessibility, canon 4.5).
- **Felling:** the run's credited tap counter fells the target every `N` taps. The fell pays
  `fellBonus`, plays the era's animation and cry, vibrates on Android, and the next target pops
  up within 0.3 s; its hit area is live during the pop, so no tap is wasted. A fell adds
  `10/N` to tap income: +25% in Twig down to +8% in Armored.
- **Crits** come only from Grip nodes (Lucky Swing: 5% of taps ×10). Tap number `n` of the run
  crits when `rng(seedOf(seed, run, n)).next() < chance`, so client and server agree and the
  client never reports a crit. A crit pops a larger gold floater with a bang.
- The target's hit area is fixed on screen: at least 120 CSS px tall (N27), padded to about
  140 × 160 px on a phone (D48).

### 7.6 Click-share targets (asserted, N8 and N9 as amended)

- **Run 1, minute 0-1:** tap-driven income (taps, fells, crits and unmanned lines) is at least
  **50%** (P1 model: 55%; direct taps 19%).
- **Run 1, from minute 10 outside bursts** (Rally, Adrenaline, Rush, Afterglow's first 10
  minutes): direct taps are **5-25%** (P1: 14%).
- An active hour is worth **1.5-3×** an idle online hour mid-game (N9; P1: 2.95× on the
  weather-weighted hour, 2.83× in clear weather, 3.42× in rain), asserted on the weighted hour; rain hours are a warning (errata E13).
- Once the flat part is small, the direct share is about `X / (1 + X)` with
  `X = taps per second × p × T × Hustle × crit × (1 + 10/N)`. In run 1 (6 taps per second, full
  Hustle, Stone, no nodes) `X ≈ 13.5 p`: Iron Tools gives 10%, Salvaged 14%, Power Tools 18%.
- With the whole tree (T ×1.5, p ×1.2, Hustle ×2.25, crits +45%), the steady coefficient
  `c = taps per second × p × T × Hustle × crit` is 0.56 at 6 taps per second, so taps are 36-38%
  of an active player's income. The content check holds `c ≤ 0.6` (resolution 1.5).

---

## 8. Flotsam

### 8.1 The kinds

| Flotsam (id) | Weight | Effect | Looks like | Ships |
| --- | --- | --- | --- | --- |
| Drift Crate (`crate`) | 45 | `max(1 min, min(15% of held supplies, 10 min))` of output at once | a roped wooden crate | R1 |
| Fuel Drum (`fuel_drum`) | 40 | **Rally**: all lines ×4 for 60 s | a red-banded drum | R1 |
| Adrenaline Kit (`adrenaline`) | 6 | taps ×100 for 12 s | a tin with a lightning mark | R1 |
| Drowned Drone (`drowned_drone`) | 7 | one owned line, picked at random, ×12 for 30 s | a waterlogged drone | R4 |
| Sealed Locker (`sealed_locker`) | 1 (errata E15) | 1 scrap | a barnacled locker | R5 |
| Message in a Bottle (`bottle`) | 0.5 | a Logbook secret's hint plus a Drift Crate | a corked bottle with a note | R4 |

Odds as shown, renormalised over shipped kinds: **R1-R3** crate 49.5%, drum 44.0%, Adrenaline
6.6%; **R4** 45.7 / 40.6 / 6.1 / drone 7.1 / bottle 0.5; **R5** 45.2 / 40.2 / 6.0 /
drone 7.0 / locker 1.0 / bottle 0.5.

- "Output" in the crate is the full rate without buffs. The 1-minute floor keeps a crate worth
  catching right after a big purchase empties the counter. Blowback crates (R6,
  `06-friends.md`) pay by the same formula (resolution 1.6).
- Different buffs multiply; the same buff caught again restarts its timer and never stacks.
- Natural spawns never overlap a Rally: the shortest gap (2:40 in rain) outlasts its 60 s. The
  Rally × Adrenaline combo needs the Flare (Wipe Day #15, R5) with the `flare_gun` node, which
  chooses the kind a Flare calls (resolution 3.11), or Tide nodes that bring flotsam in pairs
  (`04-blast-map.md`). That keeps the jackpot a thing players set up.
- Buffs show as chips under the top bar ("Rally ×4 · 0:48") with a draining ring, at most three.

### 8.2 The schedule

- Each run keeps a flotsam cursor `{index, nextAt}`. At run start `index = 0` and `nextAt =
  start + gap(0)`.
- `gap(k)` is uniform in **4-10 minutes** *(sim)*, from `rng(seedOf(seed, run, k, 1))`, divided
  by **1.5 if it is raining** at the moment it is drawn, and by any Tide node or Dare factor in
  force then. The next gap is drawn at each spawn time, so a node bought mid-run applies from the
  next one.
- The kind is `pickWeighted(rng(seedOf(seed, run, k, 2)), shipped weights)`. The Drowned Drone's
  line is drawn at claim time from the lines then owned, with `seedOf(seed, run, k, 3)`.
- `run` is the run's number (every nuke + 1, small blasts included); `seed` is the base's seed.
- The schedule runs on the real clock and never pauses. About 8.6 flotsam an hour, 12.9 in
  rain.
- **Rain is domain data** (resolution 3.17): `island.json5` holds the island's UTC offset and
  its weather shares. Each 30-minute block is clear, rain or fog by a seeded draw on the block's
  index (about 70 / 20 / 10% *(sim)*), the same for every friend, so the server checks the rain
  factor. The scene's rain, `when: rain` effects and the Logbook secret "launch during a storm"
  read the same function.

### 8.3 Run 1's guaranteed crate

Until the first flotsam of run 1 is caught, every spawn is a **Drift Crate paying a flat 2
minutes of output** (no 15%-of-held cap, since a new player holds almost nothing), and the gap
is exactly **3:00** (resolution 1.6, errata E1). The first comes at 3:00; a player who misses it
gets another three minutes later. After the first catch the normal rules apply. Later runs have
no guaranteed crate. In the P1 model it pays about 1.5M at 3:00, against 0.55M made so far, so
Sorting Tables follows at 3:01 and Stone keeps its own beat at 4:30.

### 8.4 Window and claim

- A flotsam drifts in from the open sea (left of x ≈ 480) along the waterline and floats for
  **13 s** *(sim; Tide nodes extend it)* with a pie ring showing the time left, then sinks. Its
  tap target is fixed on screen at 56 CSS px or more (D48).
- Tapping sends `claim_flotsam {run, index}`. The server accepts it once per index, while
  `now ≤ spawnAt + float + 3 s` (network grace), for the run's current schedule. A late claim is
  refused quietly: the sprite sinks with "It drifted off." and no error toast.
- A claim plays at once (prediction): the crate bursts on the shore, the drum rolls up the beach.
- Flotsam glows in the scene but never takes the advisor's crown (canon 12.5).

### 8.5 Odds display

Randomness is visible (guardrail 9). From R1 an **Odds sheet in Settings** (errata E8), also
opened by the claim toast's "Odds" link and from the Multipliers sheet, lists the shipped
kinds with their percentages, "Every 4-10 minutes while the page is open; 1.5× as often in
rain; 13 s to catch it." From R4 the same table is repeated on the Logbook's Odds page
(`05-meta-layers.md` 1.8).

### 8.6 When the tab is hidden

The schedule keeps running; flotsam that spawn while the tab is hidden float by unseen and are
missed, with no penalty and no notification. If the tab becomes visible inside a window, that
flotsam is still there to catch. Buffs keep their real-time countdown while hidden.

---

## 9. Hands and the automation ladder

### 9.1 The 14 hands

A hand is a named crew member hired onto one line; from then on the line runs forever, offline
included. Price `h_i = 300 × c_i` *(sim)*, needs at least one unit of the line; Crew nodes
discount it. Tiredness, injuries, gear, bonds, levels and arrivals are gone. From R5 each hand
has five ranks, ×2 each, rising together (resolution 1.7, `05-meta-layers.md`). Traits wait for
owner decision 19 (R5). `crew.json5` is slimmed to the 14 hand ids (resolution 3.19).

| Line | Hand (crew id) | Price | At work (scene) |
| --- | --- | --- | --- |
| Beachcomber | Mara (`mara`) | 1.8k | sorts driftwood at the table |
| Campfire | Dax (`dax`) | 28.8k | turns the skewers |
| Garden | Ivo (`ivo`) | 461k | hoes the beds |
| Loom | Rook (`rook`) | 7.37M | works the treadle |
| Workbench | Sela (`sela`) | 118M | saws planks |
| Kiln | Bram (`bram`) | 1.89B | rakes the coals |
| Furnace | Wren (`wren`) | 30.2B | pumps the bellows |
| Tannery | Otto (`otto`) | 483B | scrapes hides |
| Oil Press | Juno (`juno`) | 7.73T | turns the screw |
| Dock | Pike (`pike`) | 124T | hauls the nets |
| Generator | Hale (`hale`) | 1.98Qa | cranks the engine |
| Radio Mast | Tamsin (`tamsin`) | 31.7Qa | taps the key |
| Ship Breaker | Gus (`gus`, new) | 507Qa | cuts with the torch |
| Reactor | Vera (`vera`, new) | 8.11Qi | watches the dials |

**Walk-in.** On hire the domain marks the line manned at once; the hand walks from the base door
to the plot (about 2 s, real time), a "Hired!" pop rises over them, and the bar starts looping.
Reduced motion: they fade in at the plot. The row swaps the tap glyph for the portrait.

### 9.2 What survives a nuke

| From | Kept hands | Source |
| --- | --- | --- |
| Wipe Day #1 | Mara | Old Friends (`old_friend`, Crew ring 1, 2 glass) |
| Wipe Day #3 | lines 1-3 | the agenda (canon 5.8) |
| Old Crew I | lines 1-6 | Crew ring 3, 33 glass |
| Old Crew II, III | more lines, then all 14 | later Crew rings (`04-blast-map.md`) |
| Lone Wolf (keystone) | none: no hands at all | Crew ring 8 |

A kept hand stands at its empty plot from the rebuild; the first unit bought is manned at once.

### 9.3 The automation ladder

| When | What automates | By what | Ships |
| --- | --- | --- | --- |
| Run 1, about 0:41 on | one line at a time | hiring hands | R1 |
| Run 1, after the 2nd hand (about 1:30) | buying in bulk | the ×1 / ×10 / ×100 / Max toggle | R1 |
| Wipe Day #1 | the start of a run | Starter Kit, Old Friends, Afterglow | R2 |
| Wipe Day #3 | the early hands | hands for lines 1-3 survive; Old Crew extends it | R2 |
| Wipe Day #7 / #20 | buying lines | the Foreman, lines 1-6 / all (`05-meta-layers.md`) | R5 |
| Wipe Day #15 | calling flotsam | the Flare on the Toolbelt | R5 |
| Wipe Day #25 | the nuke itself | Dead Hand, opt-in, online only | R5 |

---

## 10. The Night Shift (offline)

### 10.1 Rules

| Rule | Value |
| --- | --- |
| What produces | manned lines at **100%** of their rate, every non-transient multiplier included (Glow, Morale, Grit, ranks) |
| Window | **12 h** at the start *(data check, N18)*, from the last command of any kind (taps, buys, pings) |
| Longer windows | Deep Cellars +4 h (Bunker ring 1), Wipe Day #10 +4 h, further Bunker nodes, Long Night's reward +4 h; ceiling **48 h**; Wipe Day Rush halves it |
| Ping | a visible tab sends a slim `ping` every 5 minutes; a hidden tab sends none |
| Away | you count as away 6 minutes after your last command; `when: offline` effects (Bunker Mentality ×1.5) apply from then |
| Window full | accrual stops; nothing is destroyed; "Night Shift over" is the one notification on by default (held during quiet hours, `06-friends.md`) |
| Keeps running | buff tails until their end, an unmanned cycle already in flight, Toolbelt cooldowns, the Magnet (R5) |
| Stops | taps, Hustle (drains), new unmanned cycles, flotsam (missed), Afterglow (taps only) |

The 12-hour base covers a casual player's 21:00-08:00 night from day 1; an idler's 13-hour gap
(21:00-08:00 plus an hour) is covered once Deep Cellars (1 glass, ring 1) is bought after the
first nuke (resolution 1.11). Settle splits at the window's end and at scheduled buff ends;
everything else is closed form (`09-architecture.md`).

### 10.2 Welcome back

After at least an hour away, one card with one primary, **Collect** (canon 12.6); the nuke is
never crowned on it (resolution 1.9). The supplies were banked by settle; Collect flies them into
the counter, which waits at the pre-away value until then, and from R5 runs the Foreman's pass,
which keeps the crowned purchase's price in reserve (resolution 1.10).

| Number | Definition |
| --- | --- |
| Away | now − the last command |
| Worked | `min(away, window)` |
| Gain | supplies settle credited since the last command (manned lines, finished cycles, buff tails) |
| Stopped at | last command + window, when away > window |

Copy (R1; the Magnet, crates and Logbook lines join in R4-R6):

- Window not used up: "Away 9 h 40 m. Your hands kept working: +4.2T supplies."
- Window used up: "Away 2 d 3 h. Your hands worked the Night Shift (12 h of it): +4.2T supplies.
  They stopped yesterday at 21:40." From R2 a secondary link follows: "Longer Night Shift: Bunker
  on the Blast Map".
- Nothing earned (no hands): no card. The hint "Nobody was on shift. Hire a hand to keep a line
  running while you're away." points at the best hand row instead.

Under an hour away there is no card; the counter simply shows the new total.

---

## 11. The advisor and the first 20 hints

### 11.1 The crown inside a run (canon 12.5; first match wins)

| # | Crown | Condition | Looks like |
| --- | --- | --- | --- |
| 1 | the Big Red | the nuke is recommended: doubling, a fading glass rate with a counting nuke, or a counting nuke in a run at least 20 h old; the first at yield 10 (resolution 1.9, `03-the-big-red.md`) | the hazard chip above the drawer; never orange |
| 2 | the next era | affordable within 30 s at the current income *(sim)* | the era row, its button counting down "in 0:12" until affordable |
| 3 | a hand | for the top-earning unmanned line, affordable within 30 s | the Hire button on that line's hand row |
| 4 | the best-payback purchase | affordable now; least `price / Δincome`, where Δincome uses the player's own tap rate over the last minute (so an idle player is never crowned a Grip rung or an unmanned line) | the row's orange button |
| 5 | waiting Blowback crates | R6 | the crates on the shore glow |
| 6 | a ready Toolbelt skill | R5 | the skill button glows |
| 7 | "Tap the {target}" | otherwise | the target glows |

One crown per view (resolution 3.25): while the crown sits on the Big Red, crates, a Toolbelt
skill or the tap hint, the collapsed drawer shows no orange row; the expanded drawer, a separate
sheet, always crowns exactly one row. Other affordable rows stay enabled and secondary (canon
12.3). Ties go to the cheaper purchase. The era comes before the hand: Timber (1.5k, about 0:36)
is crowned before Mara (1.8k, about 0:41).

### 11.2 The first 20 hints

One line each, anchored to the thing they name, never modal. A hint **retires after two uses**
of what it names (two fells, two hires, two catches); passive ones after two showings.

| # | Id | Trigger | Copy (proposal) |
| --- | --- | --- | --- |
| 1 | `tap_target` | run 1 starts | "Tap the tree." (later eras: "Tap the outcrop.") |
| 2 | `first_line` | 6 supplies held for the first time | "Buy a Beachcomber. It works while you tap." |
| 3 | `grip` | Stone Tools affordable | "Stone Tools: every tap pays double." |
| 4 | `fell` | the first fell | "Timber! Every 40th tap fells it for a bonus." |
| 5 | `milestone` | any line at 7 owned | "10 of a line pay double. Every line has milestones." |
| 6 | `hustle` | Hustle first reaches 50 | "Hustle: keep tapping and every tap pays up to double." |
| 7 | `unmanned` | an unmanned line goes idle for 5 s | "No hand yet: this line only works while you tap." |
| 8 | `hand` | the first hand is crowned | "Hands keep a line running, even while you're away." |
| 9 | `era` | the Timber era is crowned | "Timber cabin: all lines ×2, and three new ones." |
| 10 | `flotsam` | the first flotsam is on screen | "Something's drifting in. Tap it before it floats off." |
| 11 | `bulk` | the toggle appears | "Buy 10, 100 or as many as you can afford." |
| 12 | `speed` | any line at 22 owned | "At 25 owned the bar runs twice as fast." |
| 13 | `rally` | the first Fuel Drum caught | "Rally! All lines ×4 for a minute." |
| 14 | `hold` | 45 s of steady tapping in run 1 | "Tired? Hold your finger down: it works 4 times a second." |
| 15 | `island_upgrade` | Sorting Tables crowned | "Island upgrades double every line." |
| 16 | `crown` | the crown first moves to a line other than the last one bought | "The crown marks the best buy right now." |
| 17 | `mk` | the first Mk II becomes visible | "Mk II: one line ×3. It's on the Upgrades shelf." |
| 18 | `adrenaline` | the first Adrenaline Kit caught | "Adrenaline! Taps ×100 for 12 seconds. Go!" |
| 19 | `roster` | every unlocked line at 15 or more | "Own 25 of every line: everything ×2." |
| 20 | `night_shift` | the tab is hidden for the first time with a hand hired (shown on return) | "Hands work up to 12 hours while you're away." |

The Kettle's pad (at 5e8 lifetime supplies, about minute 9-10 of run 1; it and its locked card
ship in R2, errata E2) and the first nuke's hints belong to `03-the-big-red.md`. Locale keys
are `hint.<id>`; the old `hint.*` keys go with their systems.

---

## 12. Starting a run after a nuke

### 12.1 The new run's state

| Thing | At the start of run N+1 |
| --- | --- |
| Supplies, lines, shelf, era, Hustle, buffs, flotsam | 0, none, none, Twig, 0, none, a fresh schedule (no guaranteed crate) |
| Starter Kit (`packed_crate`; the name is on the naming-pass list, the id stays, errata E27) | 10 Beachcombers and 5 Campfires pop in with their count badges (so the Beachcomber's ×2 is already on) |
| Kept hands | at their plots: Mara (Old Friends), lines 1-3 from Wipe Day #3, lines 1-6 with Old Crew I |
| Pocketed upgrades (R5) | active from the first second, marked with the Pocket chip on the shelf |
| Afterglow | taps ×3, halving every 5 minutes from the first tap, ended at 30 (`03-the-big-red.md`) |
| Glow and nodes | Glow on every line and on the flat tap; every node's effect in force |
| The toggle, retired hints | kept |
| The Kettle | its pad stands from the start; the crater sign counts Wipe Days |
| The Night Shift window | full |

The rebuild beat (rowboat, sapling to Lone Pine, lean-to, kept hands walking out) is in
`03-the-big-red.md`; the first tap ends it.

### 12.2 How run 2 feels different

From the P1 model at 6 taps per second (seed 7; the model buys ring 1 from its budget, so its
tap nodes sit a little under Calloused Hands' ×1.5).

| Moment | Run 1 | Run 2 (10 glass, Glow ×1.79, Starter Kit, Calloused Hands, Old Friends) |
| --- | --- | --- |
| First seconds | "+1" per tap, one Beachcomber at a time | "+8" per tap, rising to "+16" as Hustle fills, under a green sky; 15 Starter Kit units working, Mara at the tideline |
| Timber era | about 0:36 | about 0:09 |
| Stone era | about 4:30 (errata E1) | about 2:30 |
| 1B made | about 12:40 | about 7:00 |
| Run 1's total (52B) | 48:00 | about 22:40, 47% of run 1's time (N11 as amended allows 65%) |
| New on screen | | the glass chip with ×Glow, the Afterglow pill, the Blast Map nav item, the crater sign, "Next Wipe Day unlocks …" |

Run 2 starts as a rush instead of a crawl: Afterglow makes taps a third of the income in the
first minutes (34% at 1:00) and the eras that took minutes take seconds. From run 3 the agenda
keeps adding visible differences (Armored, kept hands, the Toolbelt).

---

## 13. Data files

All in `packages/content/data`, validated with zod at startup; `lines` and costs are validated
as formulas (canon 13.1). Amounts are `z.number().finite().nonnegative()`. Every id is its
locale key and has an icon (falling back to today's tile). Effects use the canon 13.5
vocabulary with resolution 3.12's extensions.

### 13.1 `lines.json5`

```json5
// The 14 lines. Rung i: cost costBase × costRatio^(i−1), output rateBase × rateRatio^(i−1)
// per second per unit, cycle cycleBase × cycleRatio^(i−1) s, growth growthBase − growthStep ×
// (i−1), hand price handFactor × cost. A line may override any derived number.
{
  island: "saltmarsh",
  formula: {
    costBase: 6, costRatio: 16, rateBase: 1.5, rateRatio: 4.75,
    cycleBase: 0.6, cycleRatio: 2, growthBase: 1.15, growthStep: 0.006,
    handFactor: 300, cycleFloor: 0.1,
  },
  stages: [1, 25, 100],
  run: {
    nightShift: { windowHours: 12, maxHours: 48, pingMinutes: 5, awayAfterMinutes: 6, welcomeAfterMinutes: 60 },
    bulkAfterHands: 2,
    advisor: { saveSeconds: 30 },
  },
  lines: [
    { id: "beachcomber", rung: 1, era: "twig", hand: "mara", product: "timber" },
    { id: "campfire", rung: 2, era: "twig", hand: "dax", product: "roast" },
    // ...
    { id: "radio_mast", rung: 12, era: "metal", hand: "tamsin", product: "broadcast" },
    { id: "reactor", rung: 14, era: "hqm", hand: "vera", product: "cell" },
  ],
}
```

Checks: 14 lines with rungs 1-14 contiguous; ids unique; every era opens exactly its lines;
cost, output and payback strictly increase with the rung; growth in (1, 1.2]; derived numbers
finite; hands are `crew.json5` ids, one per line; products unique and in `resources.json5`'s
product list, each with a name and an icon; `windowHours ≥ 12`, `maxHours ≤ 48` (N18); `island`
matches `island.json5`.

### 13.2 `eras.json5` and `targets.json5`

```json5
{
  eras: [
    { id: "twig", cost: 0, target: "tree", effects: [] },
    { id: "wood", cost: 1.5e3, target: "stone",
      effects: [{ stat: "line_output", op: "more", value: 2 }] },
    { id: "stone", cost: 3e6, target: "ore", effects: [{ stat: "line_output", op: "more", value: 2 }] },
    { id: "metal", cost: 2e10, target: "sulfur", effects: [{ stat: "line_output", op: "more", value: 2 }] },
    { id: "hqm", cost: 4e14, target: "wreck", requires: { wipeDays: 2 },
      effects: [{ stat: "line_output", op: "more", value: 2 }] },
  ],
}
```

```json5
{
  tap: {
    bucket: { perSecond: 15, burst: 45 },
    holdTapsPerSecond: 4, holdAfterSeconds: 0.35,
    hustle: { perTap: 1, cap: 100, peak: 2, peakCeiling: 2.25, graceSeconds: 2, drainPerSecond: 10 },
    fellBonusTaps: 10, popSeconds: 0.3,
  },
  targets: [
    { id: "tree", era: "twig", fellAfter: 40, art: "tree" },
    { id: "stone", era: "wood", fellAfter: 60, art: "rock_stone" },
    { id: "ore", era: "stone", fellAfter: 80, art: "rock_ore" },
    { id: "sulfur", era: "metal", fellAfter: 100, art: "rock_sulfur" },
    { id: "wreck", era: "hqm", fellAfter: 120, art: "wreck" },
  ],
}
```

Checks: the five tier ids in `tiers.ts` order; costs strictly increasing; one target per era,
each target used once; `fellAfter` increasing and at least 10; `requires.wipeDays` matches the
agenda row; cries exist as `target.<id>.cry`; the bucket matches N10; no node sets Hustle's peak
above `peakCeiling`.

### 13.3 `tools.json5` (Grip), `upgrades.json5` and `milestones.json5`

```json5
{ tools: [
  { id: "rock", tier: "twig", cost: 0, effects: [] },
  { id: "stone_tools", tier: "wood", cost: 60, pocket: true, effects: [
    { stat: "tap_flat", op: "more", value: 2 }, { stat: "tap_rate_share", op: "add", value: 0.004 } ] },
  // iron_tools 6e3, salvaged_tools 6e6, power_tools 6e9: the same two effects
] }
```

```json5
{
  lineMk: [
    { id: "mk2", costFactor: 1e4, needOwned: 25, pocket: true,
      effects: [{ stat: "line_output", op: "more", value: 3 }] },
    { id: "mk3", costFactor: 1e8, needOwned: 50, pocket: true,
      effects: [{ stat: "line_output", op: "more", value: 3 }] },
  ],
  island: [
    { id: "sorting_tables", cost: 1e6, prop: "sorting_tables", pocket: true,
      effects: [{ stat: "line_output", op: "more", value: 2 }] },
    // handcarts 1e10, rope_lift 1e14, rail_spur 1e18, diesel_crane 1e22,
    // tide_mill 1e26, cable_car 1e30, steam_hammer 1e34
  ],
}
```

```json5
{
  line: [
    { at: 10, payout: 2 }, { at: 25, speed: 2 }, { at: 50, speed: 2 }, { at: 100, payout: 2 },
    { at: 200, payout: 3 }, { at: 300, payout: 3 }, { at: 400, payout: 4 },
  ],
  lineEvery: { from: 500, step: 100, payout: 2, special: [{ at: 1000, payout: 5 }] },
  roster: [{ at: 25, payout: 2 }, { at: 100, payout: 2 }, { at: 250, payout: 3 }],
}
```

Checks: Grip ids equal the tool ids in order with rising costs; the 28 Mk ids (`{line}_mk2`,
`{line}_mk3`) are generated and each has a locale name; island costs strictly increase; no
upgrade id collides with a line, era, target, product or node id; `pocket` is never set on an
era; milestone thresholds strictly increase and every multiplier is at least 1; every effect
parses under the vocabulary with a known stat.

### 13.4 `flotsam.json5` and `island.json5`

```json5
{
  schedule: { gapMinutes: [4, 10], floatSeconds: 13, graceSeconds: 3, rainFactor: 1.5 },
  firstRun: { atSeconds: 180, repeatSeconds: 180, kind: "crate", flatMinutes: 2 },
  kinds: [
    { id: "crate", weight: 45, effect: { lump: { floorMinutes: 1, heldShare: 0.15, rateMinutes: 10 } } },
    { id: "fuel_drum", weight: 40, effect: { buff: "rally", seconds: 60,
      effects: [{ stat: "line_output", op: "more", value: 4 }] } },
    { id: "adrenaline", weight: 6, effect: { buff: "adrenaline", seconds: 12,
      effects: [{ stat: "tap_value", op: "more", value: 100 }] } },
    // R4: drowned_drone (7, one line ×12 for 30 s), bottle (0.5); R5: sealed_locker (1)
  ],
}
```

```json5
// The island's clock and weather, shared by every friend (resolution 3.17).
{ id: "saltmarsh", utcOffsetMinutes: 60, weather: { blockMinutes: 30, clear: 70, rain: 20, fog: 10 } }
```

Only shipped kinds are in the file, so nothing unshipped is ever drawn or listed. Checks: ids
unique with icons and names; weights positive; `gapMinutes[0] < gapMinutes[1]`;
`floatSeconds ≥ 8`; `floorMinutes ≤ rateMinutes`; buff seconds positive; the first-run kind
exists; the shortest rainy gap is longer than the longest buff (so natural spawns never combo);
the printed odds (renormalised) sum to 100%; weather shares sum to 100. The island's clock is
UTC+1 with no daylight saving (errata E9; owner decision 2, 2026-10-10).

---

## Open questions

None; settled by errata v3.
