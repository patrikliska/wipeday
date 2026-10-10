# 04 The Blast Map (proposal)

The design of the massive tree (canon 6) and the brief for the eight writers of `04b`, who will
each write the 45 nodes of one sector. Everything here is a proposal for the owner. Names need the
owner's pass. Numbers are starting values that the simulator may retune in data. Where canon v2
(`resolutions.md`) settles a point, this file follows it and names the resolution.

Read with: `03-the-big-red.md` (glass formula, agenda, postcard, rebuild screen), `05-meta-layers.md`
(Logbook, Magnet, ranks, Pockets, Foreman, Dead Hand, Toolbelt, Dares), `08-screens.md` (wireframes
2.9-2.11, frames, SHOTS), `09-architecture.md` (evaluator, `buy_node`, schemas) and `10-balance.md`
(the power budget, section 6, split by sector in section 7 here).

---

## 1. Structure

### 1.1 Shape

- **Ground Zero** (`ground_zero`) sits at the centre. The first nuke grants it lit, so Glow works
  from Wipe Day #1 (`03` 1.2). It is never bought.
- **Eight sectors**, 45° wedges, clockwise from 12 o'clock in canon order: Grip, Crew, Works, Tide,
  Bunker, Blast, Logbook, Scrapyard.
- **Nine rings** outward, with per-sector sizes 2, 3, 4, 5, 5, 6, 6, 7, 7: 45 nodes per sector,
  361 in all.

| Ring | Per sector | All sectors | Total with GZ | Opens at | Wave |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 16 | 17 | Wipe Day #1 | 1 (R2) |
| 2 | 3 | 24 | 41 | #1 | 1 (R2) |
| 3 | 4 | 32 | 73 | #3 | 1 (R2) |
| 4 | 5 | 40 | 113 | #5 | 2 (R3-R5) |
| 5 | 5 | 40 | 153 | #10 | 2 |
| 6 | 6 | 48 | 201 | #20 | 2 |
| 7 | 6 | 48 | 249 | #30 | 3 (R7) |
| 8 | 7 | 56 | 305 | #40 | 3 |
| 9 | 7 | 56 | 361 | #50 | 3 |

"Wipe Day #N" counts counted nukes only; a small blast moves nothing (resolution 3.1).

### 1.2 Slots, ids, strings, icons

- A node's place is `ring.slot`. Slots run 1..n from left to right as the sector ladder shows
  them, clockwise across the wedge. Slot `s` of a ring with `n` slots sits at angle
  `wedgeStart + (s − 0.5) / n × 45°`, so the dots of every ring are evenly spaced all the way
  round.
- **Ids** are lowercase `snake_case`, 2-32 characters and unique across the tree. They name the
  thing, never the place (`lucky_swing`, not `grip_3_2`), and never equal a sector, line, era or
  target id. Members of a small-node series take a number: `steady_breath_2`.
- The **eight legacy perk ids** are reused: `steady_hands`, `old_friend`, `packed_crate`,
  `deep_cellars`, `quick_fingers`, `hot_coals`, `war_stories` and `old_maps`. Their `perk.<id>.name`
  and `perk.<id>.effect` keys (checked in `parse.ts` today) move to `node.*`, keeping the id. Their
  English names may change: `steady_hands` is Calloused Hands.
- **Locale** (namespaces from `09` 8.3):
  - `node.<id>.name` for every node except series members, which take `node_series.<series>`
    plus a numeral;
  - `node.<id>.blurb` (at most 80 characters) for every node that is not small;
  - `sector.<id>.name` and `sector.<id>.brief`.
- **Icons:** a node draws its sector glyph (`sector/<id>`) inside its type frame
  (`node_type/<type>`), the kinds in `07-what-changes.md` 8.1 (resolution 3.22). There is no
  per-node icon; a scene-changing node gets a scene drawing instead (2.5).

### 1.3 Edges

- **Prerequisites are OR.** A node can be bought when its ring is open, its own `gate` (if any) is
  met, and at least one of its parents is owned.
- Every ring-1 node's parent is Ground Zero. Every other node's parents are 1-3 nodes in the
  previous ring of the **same sector**. No edge skips a ring or crosses a sector, so the graph is
  acyclic by construction (`09` 8.3).
- **Completion nodes are AND:** they need every node of the previous ring of their sector.
- **Default wiring** (`09`'s layout rule): a node's parents are the previous-ring slots whose
  angular span overlaps its own. `links` may add edges and never remove one.

| Ring | Parents by slot |
| --- | --- |
| 2 | 1←1 · 2←1,2 · 3←2 |
| 3 | 1←1 · 2←1,2 · 3←2,3 · 4←3 |
| 4 | 1←1 · 2←1,2 · **3 = completion (all of ring 3)** · 4←3,4 · 5←4 |
| 5, 7 | straight up: s←s |
| 6 | 1←1 · 2←1,2 · 3←2,3 · 4←3,4 · 5←4,5 · 6←5 |
| 8 | 1←1 · 2←1,2 · 3←2,3 · 4←3,4 · 5←4,5 · 6←5,6 · 7←6 |
| 9 | straight up, except **4 = completion (all of ring 8)** |

There are no cross-sector edges, so a ladder always fits on its own screen and a path never leaves
it. Sectors interact through effects instead: `per: sector:<id>` and stats that other sectors'
systems read.

### 1.4 Gates, waves and phases

- **Ring gates** live in `agenda.json5` (`03` 12). A ring opens when counted Wipe Days reach its
  gate.
- **Node gates.** A node that modifies an agenda system carries that system's count as `gate`:
  Rush 4, Dares 5, Foreman 7, Grit 8, Flare 15, Dead Hand 25. The agenda line reads "Dead Hand on
  the Blast Map".
- **Waves** (resolution 3.8). Every node has `wave`: 1 for rings 1-3, 2 for rings 4-6, 3 for
  rings 7-9. `blastmap.json5` holds `shippedWave` (1 in R2, 2 from R3, 3 in R7). Nodes above it are
  loaded by the content checks and the simulator, but never drawn, listed or bought (`buy_node`
  answers `hidden`). It is the one phase flag in content (`09` 8.1).
- **Reserved slots.** A wave-2 node whose system ships after R3 is not in data until its phase;
  its slot is in `reserved` and drawn as empty space. A wave-3 node whose system ships after R3
  joins the file in that system's phase (Logbook R4; Magnet, ranks, Pockets, Toolbelt and Dead
  Hand R5; Dares R7). Until then the simulator counts any missing node, reserved or not yet
  written, as an effect-free node at its slot's price, so N15 is measured on all 361 from R3.
- **No orphans.** Rings 5, 7 and 9 go straight up, and the edge slots of rings 6 and 8 have one
  parent. So a node whose only parent is reserved is reserved too, and every shipped node stays
  reachable in every build (check 3). The R4 and R5 slots of rings 4-6 are placed so this holds.
- **Wave 1 is complete in R2:** all 73 nodes of rings 1-3 work with R1 and R2 systems. The
  Logbook and Scrapyard wedges open with history and shelf nodes; their own systems' nodes start
  at ring 4.

| Build | Nodes shown | What arrives |
| --- | --- | --- |
| R2 | 73 | rings 1-3, all sectors |
| R3 | 178 | rings 4-6, except 23 reserved slots; rings 7-9 in data, hidden |
| R4 | 191 | 13 Logbook nodes: Old Maps, War Stories and all of rings 5-6 |
| R5 | 201 | 5 Scrapyard nodes (Pockets, winches, a rank notable) plus Hair Trigger, Foreman's Mate, Wake-up Call, Flare Gun and Dead Hand |
| R7 | 361 | rings 7-9 |

### 1.5 The agenda and the tree: who grants what

| Wipe Day | Agenda unlock (`03` 12) | How it arrives | Nodes that build on it |
| --- | --- | --- | --- |
| 1 | rings 1-2, Ground Zero, Glow, Afterglow | free | all of rings 1-2 |
| 1 | the Magnet (R5) | free | the four winches in Scrapyard (`05` 2.2) |
| 2 | Pocket slot 1 (R5) | 5 scrap | `deep_pockets` and `sewn_lining` make slots 2 and 3 buyable, at 15 and 40 scrap (resolution 3.10) |
| 3 | hands for lines 1-3 survive; ring 3 | free | `old_friend` and `hiring_board` (Mara and Dax from #1), Old Crew I-III |
| 4 / 8 / 15 | Rush / Grit / Flare (R5) | free | `hair_trigger` (gate 4), `wake_up_call` (8), `flare_gun` and `auto_flare` (15); the Flare itself is the agenda's (resolution 3.11) |
| 5 | ring 4; Dares (R7) | free | `double_dare`, `dare_ledger` |
| 7 / 20 | the Foreman for lines 1-6 / all (R5) | free | `foremans_mate` (gate 7): lines 1-10 early |
| 10 / 20 / 40 | keystone slots 1 / 2 / 3 | free | the 16 keystones; no node adds a slot (resolution 3.9) |
| 10 | Night Shift +4 h | free | Bunker's +32 h of nodes |
| 15 | secret hints (R4) | free | `old_maps` shows them at once |
| 25 | Dead Hand (R5) | **buying `dead_hand`** (canon 6.7) | |

---

## 2. Node types and mix

### 2.1 Types

| Type (data) | Frame (`08` 2.10) | Price | What it does | New code |
| --- | --- | --- | --- | --- |
| Small (`stat`) | circle | ×1 | one stat, a value from the step table (10.2) | never |
| Notable (`notable`) | double ring | ×2 | a named mechanic built from the vocabulary, 1-3 effects | never |
| Keystone (`keystone`) | hexagon | ×3 | a rule-bending gain with a printed downside; works only when slotted | may |
| Unlock (`unlock`) | rounded square | ×1 | a new toy, verb, flotsam kind or system | usually |
| Automation (`automation`) | cog ring | ×1 | something stops needing your hands: keeps, starts, auto-buys | may |
| Completion (`completion`) | double ring plus a lit-ring badge | ×1 | needs a whole ring; the sector's main share for that ring | never |

Only unlock, automation and keystone nodes may use `feature:<id>` (resolution 3.12), and each
feature is budgeted in its phase (`11-roadmap.md`). Small, notable and completion nodes are pure
vocabulary.

### 2.2 Quotas (enforced exactly)

| Sector | Small | Notable | Keystone | Unlock | Automation | Completion |
| --- | --- | --- | --- | --- | --- | --- |
| Grip | 24 | 10 | 2 | 3 | 4 | 2 |
| Crew | 22 | 8 | 2 | 3 | 8 | 2 |
| Works | 24 | 9 | 2 | 4 | 4 | 2 |
| Tide | 22 | 9 | 2 | 7 | 3 | 2 |
| Bunker | 24 | 9 | 2 | 4 | 4 | 2 |
| Blast | 24 | 9 | 2 | 4 | 4 | 2 |
| Logbook | 24 | 8 | 2 | 6 | 3 | 2 |
| Scrapyard | 23 | 8 | 2 | 4 | 6 | 2 |
| **Total (with GZ)** | **187 (51.8%)** | **70 (19.4%)** | **16 (4.4%)** | **36 (10.0%)** | **36 (10.0%)** | **16 (4.4%)** |

These are resolution 3.8's counts. Ground Zero is the 36th unlock. 187 keeps small under canon's
52% of 361, and two completions per sector make 16.

### 2.3 The slot template

Every sector map in section 6 derives from one template:

- `S` is a small node; `F` is a feature (notable, unlock or automation, chosen by sector quota).
- `K` and `C` are fixed: a keystone above each completion, on the wedge's centre spine.
- Rows above ring 1 are mirror-symmetric.
- With the default wiring, no chain from Ground Zero outward has three small nodes in a row.
  This was checked by search over the lattice.

```
r9  S F S C S F S      C needs all of ring 8 (the capstone)
r8  S S F K F S S      second keystone
r7  F S S S S F
r6  S F S S F S
r5  S F K F S          first keystone
r4  F S C S F          C needs all of ring 3
r3  S F F S
r2  F S F
r1  F S                one cheap pick of each kind for the first nuke
```

Crew and Tide turn two `S` into `F`, and Scrapyard turns one. Turning `S` into `F` never breaks the
rule; turning `F` into `S` may, so it is not allowed.

### 2.4 Placement rules

1. Keystones sit at slot 5.3 and 8.4. Completions sit at 4.3 (all of ring 3) and 9.4 (all of
   ring 8).
2. **Never three small nodes in a row** along any chain. A `links` override must keep this.
3. Rings 1-3 work with R1-R2 systems only, and at most 10 wave-1 nodes use a feature. This plan
   uses 7: Keep Swinging, Bulk Buttons, Lookout Post, Hot Breakfast, Forecast, Flight School and
   Personal Best.
4. A node that modifies a system carries its gate and ships with it.
5. **Every node fits its sector's share** (section 7). Kits, kept hands and start eras stay on
   `10-balance.md` 6.2's rings.
6. **Hands off guarded systems.** No node touches:
   - Blowback, the Freighter, Late Tide, the Island Count or boards;
   - scrap income: the Sealed Locker's weight, haul size or the rich chance (`05` 2.2);
   - an asserted number: hold = 4 taps/s and the 15/s bucket (N10), the 48 h window (N18), the
     10% count rule (N22), the Foreman's one buy a second, a fourth Toolbelt button, a fourth
     keystone slot (resolution 3.9), `c` above 0.6 or Hustle above ×2.25 (resolution 1.5;
     Storm Season's Hustle reward counts inside it, errata E22).
7. **Soft rules** (review, not the check):
   - consecutive smalls along a chain belong to different series;
   - every ring band has at least one notable a casual feels (three check-ins, little tapping).

### 2.5 Scene-changing nodes

A node is scene-changing when owning it adds or changes something drawn on the island in every
run: a prop, building dressing, a crew animation, the target's look, a flotsam kind, the Kettle,
crater, sky or weather. A floater, sound or number alone does not count. Such a node has
`scene: true` and a drawing registered under its id. A web test fails if the drawing is missing.

**Rule:** every sector has at least one scene-changing node in rings 1-3, 4-6 and 7-9 (each band
checked once complete).

---

## 3. Costs

### 3.1 The price ladder

Prices come from one ladder of playful numbers. A price must sit inside its ring's band × the type
factor. Every ring-5 keystone costs 7,777 and every ring-8 keystone 7.77M (canon's anchors).

| Ring | Band (×1) | Small, unlock, automation, completion | Notable (×2) | Keystone (×3) |
| --- | --- | --- | --- | --- |
| 1 | 1-2 | 1, 2 | 2, 3, 4 | |
| 2 | 4-10 | 4, 5, 7, 9 | 9, 11, 15, 19 | |
| 3 | 25-75 | 25, 33, 44, 55, 66 | 55, 66, 77, 99, 111, 150 | |
| 4 | 200-600 | 222, 333, 444, 555 | 444, 555, 777, 999, 1,111 | |
| 5 | 2k-6k | 2,222, 3,333, 4,444, 5,555 | 4,444, 5,555, 7,777, 9,999, 11.1k | 7,777 |
| 6 | 20k-60k | 22.2k, 33.3k, 44.4k, 55.5k | 44.4k, 55.5k, 77.7k, 99.9k, 111k | |
| 7 | 200k-600k | 222k, 333k, 444k, 555k | 444k, 555k, 777k, 999k, 1.11M | |
| 8 | 2M-6M | 2.22M, 3.33M, 4.44M, 5.55M | 4.44M, 5.55M, 7.77M, 9.99M, 11.1M | 7.77M |
| 9 | 20M-60M | 22.2M, 33.3M, 44.4M, 55.5M | 44.4M, 55.5M, 77.7M, 99.9M, 111M | |

- Completions take the top ×1 price of their ring: 555 at ring 4 and 55.5M at ring 9.
- A price never changes when another node is bought.
- Dead Hand costs 22.2k (resolution 3.13). Glass prints with separators below a million
  (`fmtCount`, `09` 2.4), so the ladder's repeated digits show as 7,777 and 22,200.

### 3.2 What the tree costs

These totals use the typical price per type from the slot maps:

| Ring | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ring total | ~30 | ~200 | ~1.9k | ~19k | ~230k | ~2.2M | ~20M | ~290M | ~2.6B |
| Cumulative | 30 | 230 | 2.2k | 21k | 250k | 2.5M | 23M | 310M | **~2.9B** |

- Wave 1 costs about 2.2k. The casual player has about 1,100 glass and 62 of its 73 nodes by day
  7 (`10-balance.md` 4.7).
- The whole tree needs about 2.9B glass ever: about 1e53 lifetime supplies under the fifth root
  (resolution 1.1, `10-balance.md` 4.8). Nobody lights it all in the first year (57-60% at day
  365), and every number stays far under N23's 1e150.

### 3.3 Path totals (examples, Grip)

- **Lucky Swing from nothing:** Calloused Hands 1 → Quick Fingers 5 → Lucky Swing 77 = 3 nodes,
  83 glass.
- **Wipe Day Rush from nothing:** both ring-1 nodes, ring-2 slots 1 and 3, all of ring 3, Iron
  Palms, the keystone = 10 nodes, about 8.6k.

### 3.4 What a nuke buys (N14)

The first nuke pays 10 glass. Ring 1 holds 16 nodes at 1-3 glass (about 30 in all).

- **The guided basket:** Starter Kit 2 (the advisor's first pick), Calloused Hands 1, Deep Cellars
  1, Hot Coals 1, Old Friends 2, Bigger Payload 2. That is **6 nodes for 9 glass**, with 1 left
  over for a seventh. The founders' gift (glass held only, resolution 1.2) makes it 9-10.
- **Later nukes:** each band costs ×10 the last, while glass ever grows about ×1.1-1.3 a nuke
  after the first week (`10-balance.md` 4.5). The casual player buys a median of 2-3 nodes a nuke,
  inside N14's amended "median ≥ 2" (resolution 2). The simulator asserts it.

---

## 4. The effect vocabulary

### 4.1 Shape and ops

`{stat, op, value, scope?, per?, max?, when?}` (canon 13.5 with the extensions adopted by
resolution 3.12), folded in `09` 5.2's fixed order. `09` 5.1 registers every stat below.

| Op | Meaning |
| --- | --- |
| `add` | adds to the stat's base: hours, seconds, chances, factors, units |
| `inc` | summed into `(1 + Σinc)` |
| `more` | multiplied in; reductions are always `more` below 1, never a negative `inc` |
| `set` | replaces the base; the best value among all sets wins (`09` 5.1) |
| `unlock` | turns on a `feature:<id>`, a kept hand or a start-of-run upgrade |

- `scope` is a line, an era or `all`; for shelf stats an upgrade kind (`grip`, `line_mk`,
  `island`) or id; for flotsam stats a kind; for Toolbelt stats a skill.
- `per` is `owned`, `hands`, `nukes`, `entries` or `sector:<id>`, and every `per` effect carries a
  `max`. With `more`, the factor is `1 + value × count`, capped at `max`.
- `when` is `online`, `offline`, `afterglow` (while Afterglow adds at least 10%), `rain`, `night`,
  `hustle_full` or `dare:<id>`. Rain and night come from `island.json5`, so the server checks
  them (resolution 3.17).

### 4.2 Stats nodes may use

"Ceiling" is the most all non-keystone nodes may add together; the content check enforces it.
"Column" is the budget column a stat counts in (section 7); "unbudgeted" stats are capped here and
measured by the simulator.

| Stat | Ops | Base → ceiling | Column | From |
| --- | --- | --- | --- | --- |
| `output`, `speed` | add, inc, more; more | the sector shares | lines | R2 |
| `milestone_x2`, `roster_x2`, `mk_mult` | set | 2 → 2.2; 2 → 3; 3 → 4 | lines | R2 |
| `morale` | more | ≤ ×1.5 | lines | R4 |
| `rank_mult` | set | ×2 → ×2.5 | lines | R5 |
| `tap` (the whole tap, `09` 5.2) | inc, more | ≤ ×1.5 (Calloused Hands) | tap | R2 |
| `tap_flat` | more | no node | | |
| `tap_share` (`p`) | add | +0.16% and +0.15% (+10% and +9% at Power Tools) | tap | R2 |
| `hustle_max` | add (set: keystones) | ×2 → ×2.25 | tap | R2 |
| `crit_chance`, `crit_mult` | add, set | 5% and ×10, Lucky Swing only (+45% average) | tap | R2 |
| `fell_taps`, `fell_bonus` | more, add | fells raise `c` by at most 7% (0.56 → 0.6) | tap | R2 |
| `hustle_hold`, `hustle_drain`, `hustle_gain` | add, more, add | 2 → 6 s; 10 → 5 a second; 1 → 3 | unbudgeted | R2 |
| `afterglow`, `afterglow_half`, `afterglow_hold` | set, add, set | ×3 (only keystones set it); 300 → 900 s; 0 → 120 s | unbudgeted | R2 |
| `line_cost`, `hand_cost` | more < 1 | ≥ ×0.29 each | prices | R2 |
| `upgrade_cost`, `era_cost` | more < 1 | ≥ ×0.25 per shelf kind; ≥ ×0.5 | unbudgeted | R2 |
| `start_owned`, `start_era`, `start_upgrade` | set, set, unlock | ≤ 25 a line; Sheet Metal; never an era | `10-balance.md` 6.2 | R2 |
| `keep_hand` | unlock | | `10-balance.md` 6.2 | R2 |
| `foreman_lines`, `hand_cap` | set | 6 → 10 from #7; `hand_cap` on keystones only | | R5, R3 |
| `flotsam_rate`, `flotsam_effect`, `rally_mult` | more, inc, add | ×1.05 often; ×1.05 pay (Rally included) | flotsam | R2 |
| `flotsam_float` | add | 13 → 25 s; rain up to +15 s more | unbudgeted | R2 |
| `flotsam_weight` | more, set | printed odds sum to 100%; never `sealed_locker`; a new kind takes the Drift Crate's weight and pays about a crate | | R2 |
| `night_shift` | add (more: keystones) | +32 h exactly: 12 + 4 (agenda) + 32 = 48 | hours | R2 |
| `offline` | more | ≤ ×1.77 | offline | R2 |
| `glass_gain` | inc, more | ≤ ×2.25 | glass | R2 |
| `glow_k` | add | 0.25 → 0.49 | `k` | R2 |
| `morale_per` | add | 0.02 → 0.05 (`05` 1.4) | Morale | R4 |
| `magnet_hours` | set | 24 → 20, so 16/19/20 h | N19 | R5 |
| `rush_*`, `grit_*`, `flare_cooldown` | per `05` 7 | no power node; nodes only automate the Toolbelt (N9) | | R5 |
| `feature:<id>` | unlock | unlock, automation and keystone nodes only | | its phase |

### 4.3 How effects read

A small node's line is generated from `effect.<stat>` ("Hustle holds +0.5 s"). The sheet always
adds the player's current numbers (8.2). A non-small node shows its blurb, with `{value}` filled
from data.

---

## 5. Permanence, loadout and respec

- **Permanent.** A node is never refunded and applies the moment it is bought, start-of-run nodes
  included. The Starter Kit's units appear at once (`03` 8.4). Spending glass never lowers Glow.
- **Keystones** are owned forever but work only in the **loadout**: exactly three slots, at
  Wipe Days #10, #20 and #40 (agenda; resolution 3.9). No node adds a slot.
  - A keystone bought while a slot is empty slots itself at once, downside included. Otherwise
    the loadout changes on the rebuild screen (`03` 9.1), free, through `set_loadout {keystones,
    foreman, deadHand}` (resolution 3.15). The sheet says so before the buy: "Your 2 slots are
    full. Swap it in on the rebuild screen."
  - Keystones list `conflicts`, and the rebuild screen warns without blocking: "Bunker Mentality
    stops all flotsam, so Scavenger's Eye does nothing." The pairs are Bunker Mentality with
    Scavenger's Eye and with Wreckers' Moon, Lone Wolf with Skeleton Crew, and Hot Core with
    Wipe Day Rush (60 minutes of lines ×0.25).
- **Respec.** A balance patch that changes bought nodes (price, effect, slot, edge) ships with a
  decision entry and one admin `respec_all` on deploy (`09` 9.6). It works like this:
  - every glass spent is refunded, so glass held = glass ever and Glow is unchanged;
  - every node except Ground Zero is cleared, and the loadout is emptied;
  - hands already on the island stay for the current run.
  - The next visit shows one card: "The Blast Map changed. All 12,345 glass is back to spend.
    What changed: …", with the primary **Open the Blast Map**.
  - A patch that only adds nodes needs no respec. There is no partial or paid respec.

---

## 6. Sector briefs

How to read them:

- Each sector has a **slot table**: per ring, the type of each slot from 1 to n (`S` small, `N`
  notable, `U` unlock, `A` automation, `K` keystone, `C` completion), the wave and the phase it
  ships in, and the sector's **share** of that ring's budget (section 7). Shares are ceilings.
- The **fixed nodes** table is binding in shape; values may move inside the share and the
  ceilings. Keystones are in 6.1 and completions in 6.2. Every other slot is the writer's, guided
  by "smalls" and "other notables".
- "(scene)" marks a scene-changing node. Rings 1-3 ship in R2, rings 4-6 in R3, and rings 7-9 are
  in data from R3 and shown in R7, unless a row says otherwise. "R5 data" on a wave-3 node means
  it joins the file in R5.

### 6.1 Keystones (16)

Each must pass the keystone rule in the simulator: at most ×2 for the archetype it targets, and a
cost to that or another archetype at least as large elsewhere (resolution 3.13). "Targets" is the
archetype the simulator measures first.

| Sector | Slot | Keystone (id) | Gain | Downside | Targets | Feature |
| --- | --- | --- | --- | --- | --- | --- |
| Grip | 5.3 | Wipe Day Rush (`wipe_day_rush`) | Afterglow holds ×5 for 60 min, then fades | Night Shift window ×0.5 | active | |
| Grip | 8.4 | Fever Pitch (`fever_pitch`) | Hustle tops out at ×6 | Hustle holds 0.5 s and drains ×3 as fast | active | |
| Crew | 5.3 | Skeleton Crew (`skeleton_crew`) | hands cost nothing; manned lines ×2 | at most 5 hands | casual | `hand_cap` |
| Crew | 8.4 | Lone Wolf (`lone_wolf`) | taps ×50 (resolution 3.13) | no hands at all (ranks still count) | active | `hand_cap` |
| Works | 5.3 | Mass Production (`mass_production`) | every ×2 milestone pays ×3 | the speed milestones (25 and 50 owned) pay nothing | idler | yes |
| Works | 8.4 | Monoculture (`monoculture`) | your highest line ×3 | every other line ×0.5 | casual | yes |
| Tide | 5.3 | Scavenger's Eye (`scavengers_eye`) | every flotsam but a Sealed Locker is a Fuel Drum | no crates, kits, drones or bottles | active | |
| Tide | 8.4 | Wreckers' Moon (`wreckers_moon`) | Drift Crates wash up while you're away, one an hour, up to 12 | online flotsam half as often | casual | yes |
| Bunker | 5.3 | Bunker Mentality (`bunker_mentality`) | offline ×1.5 | no flotsam | idler | |
| Bunker | 8.4 | Graveyard Shift (`graveyard_shift`) | lines ×8 at night | lines ×0.5 always (net ×4 at night) | casual | |
| Blast | 5.3 | Hot Core (`hot_core`) | glass ×1.5 | lines ×0.25 while Afterglow lasts | casual | |
| Blast | 8.4 | Chain Reaction (`chain_reaction`) | Glow `k` +0.25 | glass ×0.5 | idler | |
| Logbook | 5.3 | Tall Tales (`tall_tales`) | Morale counts ×3 on taps | Morale no longer touches lines | active | yes (R4) |
| Logbook | 8.4 | Archivist (`archivist`) | Morale ×2 | taps ×0.25 | idler | (R4 data) |
| Scrapyard | 5.3 | Hoarder (`hoarder`) | lines +10% per hour of output held unspent, up to +100% | line units cost ×2 | idler | yes |
| Scrapyard | 8.4 | Sentimental (`sentimental`) | a pocketed upgrade's ×2 becomes ×3 | one Pocket slot fewer | casual | yes (R5 data) |

### 6.2 Completions (16)

| Sector | 4.3: needs all of ring 3 (555) | 9.4: needs all of ring 8 (55.5M) |
| --- | --- | --- |
| Grip | Iron Palms (`iron_palms`): taps carry +0.15% more of supplies/s (`p` +9%); Hustle holds 1 s longer | Iron Grip (`iron_grip`): all lines ×1.2; Hustle drains 20% slower |
| Crew | Full Crew (`full_crew`): hands cost ×0.85 | Crew Legends (`crew_legends`): all lines ×2 |
| Works | Shop Floor (`shop_floor`): line units cost ×0.85 | The Works (`the_works`): all lines ×3 |
| Tide | High Water (`high_water`): flotsam floats 3 s longer (25 s, the ceiling); the tide line rises (scene) | King Tide (`king_tide`): all lines ×1.2; the sea floods the low beach (scene) |
| Bunker | Snug (`snug`): offline ×1.1 | Deep Sleep (`deep_sleep`): offline ×1.1 |
| Blast | Glass Garden (`glass_garden`): glass ×1.1; shards glitter in the crater (scene) | Second Sun (`second_sun`): Glow `k` +0.05 |
| Logbook | Well Read (`well_read`): eras cost ×0.85 | Full Log (`full_log`, R4 data): Morale ×1.25 (errata E24) |
| Scrapyard | Sorted Yard (`sorted_yard`): shelf upgrades cost ×0.7 | Yard Boss (`yard_boss`, R5 data): each crew rank ×2.5 |

### 6.3 Grip (`grip`): "Your hands are the first machine"

Taps, Hustle, crits, felling and Afterglow. Rings 1-4 hold the tree's whole tap budget. From ring
5 nothing may raise `c` (N9 sits at 2.95 of 3 on the weather-weighted hour, `10-balance.md` 4.4, errata E13), so the outer rings make
tapping feel better and turn fells into run-long line bonuses: tap hard early in a run, keep it
all run.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | N S | 1 · R2 | tap ×1.5 |
| 2 | N S A | 1 · R2 | `p` +10%; Hustle max +0.25 |
| 3 | S N N S | 1 · R2 | crits +45% |
| 4 | A S C S N | 2 · R3 | `p` +9% |
| 5 | S N K N S | 2 · R3 | lines ×1.15 |
| 6 | S A S S U S | 2 · R3; 6.2 R5 | lines ×1.5 |
| 7 | N S S S S U | 3 · R7 | lines ×1.5 |
| 8 | S S N K A S S | 3 · R7 | lines ×1.5 |
| 9 | S N S C S U S | 3 · R7 | lines ×1.5 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Second Wind (`second_wind`) | notable | Hustle holds 3 s (was 2) and drains 20% slower | 2 |
| 1.2 | Calloused Hands (`steady_hands`) | stat | taps +50% (anchor) | 1 |
| 2.1 | Whetstone (`whetstone`) | notable | taps carry +0.16% of supplies/s; sparks fly from a whetstone by the target (scene) | 11 |
| 2.2 | Quick Fingers (`quick_fingers`) | stat | Hustle tops out at ×2.25 (the tree's ceiling) | 5 |
| 2.3 | Keep Swinging (`keep_swinging`) | automation | unmanned lines keep running while Hustle is above zero (canon 19's fallback, as a choice) | 7 |
| 3.2 | Lucky Swing (`lucky_swing`) | notable | 5% of taps crit ×10 (anchor) | 77 |
| 3.3 | Heavy Haft (`heavy_haft`) | notable | fells need 20% fewer taps | 55 |
| 4.1 | Tool Rack (`tool_rack`) | automation | Grip rungs buy themselves when affordable, page open (`feature:autobuy`) | 333 |
| 4.5 | Afterburn (`afterburn`) | notable | Afterglow's half-life 5 → 7 min | 777 |
| 5.2 | Work Song (`work_song`) | notable | Afterglow holds its full ×3 for the first minute; the crew sing on the wipe-day rush (scene) | 5,555 |
| 6.2 | Hair Trigger (`hair_trigger`) | automation, gate 4, R5 | Rush fires itself when Hustle fills | 33.3k |
| 6.5 | Golden Chip (`golden_chip`) | unlock | the 20th fell of a run throws a golden chip; tap it: all lines ×1.5 for the rest of the run (scene) | 44.4k |
| 7.6 | Woodpile (`woodpile`) | unlock | every fell this run stacks a log by the cabin: all lines +1% a log, up to +50% (scene) | 444k |
| 8.5 | Apprentice (`apprentice`) | automation | while the page is open and you aren't tapping, an apprentice taps once a second (scene) | 3.33M |
| 9.6 | Trophy Rack (`trophy_rack`) | unlock | each run with 20 or more fells hangs a trophy: all lines +2.5% a trophy, up to +25% (scene) | 33.3M |

- **Smalls:** Steady Breath (`hustle_hold`), Slow Burn (`hustle_drain`) and Quick Hands
  (`hustle_gain`) in every ring; Hard Graft (`output` all) for the lines share, one in ring 5 and
  four in ring 8. Fells only while all of Grip keeps `c` within 0.6.
- **Other notables:** `second_breath` (Afterglow holds ×3 for 2 minutes), `in_the_zone` (Hustle
  gains +1 a tap while Afterglow lasts), and more Hustle feel. Nothing `when: hustle_full` or
  `online` adds line power (N9). The run-long bonuses cap at what a casual player's fells reach in
  a day (N16).
- **Synergies:** Blast's Warm Embers (Afterglow length), Tide's Rally, Crew's Lone Wolf.

### 6.4 Crew (`crew`): "Every line has a name on it"

Hand prices, kept hands, per-hand bonuses and the Foreman's scope.
- Rings 1-3: cheap hands and the first kept hands.
- Rings 4-6: hire in bulk; every hand kept by ring 6 (`10-balance.md` 6.2).
- Rings 7-9: second hands and hands that bring their kit.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | A S | 1 · R2 | hand prices ×0.95 |
| 2 | N S N | 1 · R2 | hand prices ×0.9; lines ×1.05 |
| 3 | S A N S | 1 · R2 | hand prices ×0.9; lines ×1.1 |
| 4 | U S C S A | 2 · R3 | hand prices ×0.85 |
| 5 | S A K N S | 2 · R3 | hand prices ×0.85; lines ×1.5 |
| 6 | S A A S N S | 2 · R3; 6.2 R5 | hand prices ×0.85; lines ×4.4 |
| 7 | N S S S S U | 3 · R7 | hand prices ×0.85; lines ×4.4 |
| 8 | S S N K A S S | 3 · R7 | hand prices ×0.85; lines ×4.4 |
| 9 | S U S C N A S | 3 · R7 | hand prices ×0.85; lines ×4.4 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Old Friends (`old_friend`) | automation | Mara's hire survives every Wipe Day; she rows in with the crew (scene, anchor) | 2 |
| 2.1 | Hiring Board (`hiring_board`) | notable | Dax's hire (Campfires) survives every Wipe Day too; a board by the cabin lists the crew (scene) | 9 |
| 2.3 | Pep Talk (`pep_talk`) | notable | all lines +1% a hand, up to +5% | 11 |
| 3.2 | Old Crew I (`old_crew_1`) | automation | hands for lines 1-6 survive (anchor) | 33 |
| 3.3 | Fair Wages (`fair_wages`) | notable | all lines +0.7% a hand, up to +10% | 66 |
| 4.1 | Pay Day (`pay_day`) | unlock | a bell by the cabin; ring it once a run: manned lines ×3 for 5 min (scene) | 333 |
| 4.5 | Roll Call (`roll_call`) | automation | one button hires every hand you can afford | 444 |
| 5.2 | Old Crew II (`old_crew_2`) | automation | hands for lines 1-10 survive | 3,333 |
| 5.4 | Bunkhouse (`bunkhouse`) | notable | hands for lines 1-3 cost ×0.1; the bunkhouse stands from the start (scene) | 4,444 |
| 6.2 | Foreman's Mate (`foremans_mate`) | automation, gate 7, R5 | the Foreman covers lines 1-10 from Wipe Day #7 (`05` 5) | 33.3k |
| 6.3 | Old Crew III (`old_crew_3`) | automation | every hand survives | 44.4k |
| 7.6 | Crew Photo (`crew_photo`) | unlock | a photo of your best run's crew: all lines +5% a hand in it, from the first second (scene) | 444k |
| 8.5 | Standing Crew (`standing_crew`) | automation | lines with a kept hand start with 10 units | 3.33M |
| 9.2 | Relief Crew (`relief_crew`) | unlock | each line takes a second hand at ×10 the price: that line ×3 (scene) | 33.3M |
| 9.6 | Lifers (`lifers`) | automation | kept hands also keep their line's Line Mk III | 33.3M |

- **Smalls:** Fair Pay (`hand_cost`, one a ring where the share allows), Crew Spirit (`output`
  `per: hands` with a `max`) for the lines share, era crews (`output` on one era, rings 6-9), and
  Crew Kits (`start_owned` 10 of one of lines 4-6, unbudgeted) where the share runs out, as in
  rings 3-4.
- **Other notables:** per-hand and hand-price mechanics. Ranks belong to Scrapyard.
- **Synergies:** Works milestones on manned lines; Lone Wolf against the Old Crews.

### 6.5 Works (`works`): "Build it once, build it bigger"

Lines, milestones, line prices, starting kits and eras: the tree's main lines share.
- Rings 1-3: kits, a Timber start, belts.
- Rings 4-6: Union Rules, a bigger kit, a Stone start.
- Rings 7-9: a Sheet Metal start and Line Mk IV.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | U S | 1 · R2 | lines ×1.1 |
| 2 | N S U | 1 · R2 | lines ×1.1; line prices ×0.9 |
| 3 | S N U S | 1 · R2 | lines ×1.2; line prices ×0.9 |
| 4 | A S C S N | 2 · R3 | lines ×1.65; line prices ×0.85 |
| 5 | S A K N S | 2 · R3 | lines ×2.6; line prices ×0.85 |
| 6 | S N S S A S | 2 · R3 | lines ×6.5; line prices ×0.85 |
| 7 | A S S S S N | 3 · R7 | lines ×6.5; line prices ×0.85 |
| 8 | S S N K N S S | 3 · R7 | lines ×6.5; line prices ×0.85 |
| 9 | S N S C S U S | 3 · R7 | lines ×6.5; line prices ×0.85 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Starter Kit (`packed_crate`) | unlock | start runs with 10 Beachcombers and 5 Campfires (scene, anchor; the name is on the naming-pass list, errata E27) | 2 |
| 1.2 | Hot Coals (`hot_coals`) | stat | Campfires ×2 | 1 |
| 2.1 | First Light (`first_light`) | notable | Beachcombers, Campfires and Gardens cycle twice as fast | 9 |
| 2.3 | Bulk Buttons (`bulk_buttons`) | unlock | ×10 / ×100 / Max from the first second of every run (`feature:bulk_buy`) | 4 |
| 3.2 | Conveyor Belts (`conveyor`) | notable | all lines +10%; belts run between the buildings (scene) | 77 |
| 3.3 | Prefab Walls (`prefab_walls`) | unlock | runs start in the Timber era (scene) | 66 |
| 4.1 | Bigger Kit (`big_kit`) | automation | start with 25 Beachcombers, 25 Campfires and 25 Gardens | 333 |
| 4.5 | Union Rules (`union_rules`) | notable | every ×2 milestone pays ×2.2 (anchor, resolution 3.13) | 777 |
| 5.2 | Stone Foundations (`stone_foundations`) | automation | runs start in the Stone era (scene) | 3,333 |
| 6.2 | Full Roster (`full_roster`) | notable | roster milestones ×2 pay ×3 | 55.5k |
| 6.5 | Standing Orders (`standing_orders`) | automation | Line Mk II and III buy themselves when affordable, page open | 33.3k |
| 7.1 | Tin Roofs (`tin_roofs`) | automation | runs start in the Sheet Metal era (scene) | 333k |
| 9.6 | Line Mk IV (`line_mk_iv`) | unlock | Mk IV on the shelf (base × 1e12, 100 owned): that line ×3; painted signs (scene) | 33.3M |

- **Smalls:** Bulk Discount (`line_cost`, one a ring from ring 2), Elbow Grease (`output` all,
  rings 3-9), era works (`output` on one era, rings 5-9), kits (`start_owned` for one line, to 25)
  where the share runs out.
- **Other notables:** rings 5-9 hold the big multipliers, each a `more` on all lines or an era,
  sized so the ring meets its share: in ring 6, four smalls ×1.3 and Full Roster's ×2.25 make
  ×6.4.

### 6.6 Tide (`tide`): "The sea always brings something"

Float time, catching, new kinds, the Flare and the sea lines. The whole tree may add only ×1.05 to
how often flotsam comes and ×1.05 to what it pays (`10-balance.md` 6.1: the canon flotsam alone
nearly doubled an active hour), so Tide's later power is catching help and a lines share.
- Rings 1-3: more time to catch.
- Rings 4-6: new kinds and catching help.
- Rings 7-9: cargo, the tide clock, the weather buoy.

New kinds take their weight from the Drift Crate (45%) and pay about what a crate pays, so the
printed odds still sum to 100% and the payout share holds.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | N S | 1 · R2 | flotsam ×1.05 as often |
| 2 | U S N | 1 · R2 | flotsam effects ×1.05 |
| 3 | S N N S | 1 · R2 | none (float, catching) |
| 4 | U S C S A | 2 · R3 | none |
| 5 | S N K A S | 2 · R3 | lines ×1.2 |
| 6 | S U N S N S | 2 · R3; 6.2 R5 | lines ×1.5 |
| 7 | U S S S S U | 3 · R7 | lines ×1.5 |
| 8 | S S N K A S S | 3 · R7; 8.5 R5 data | lines ×1.5 |
| 9 | S U S C N U S | 3 · R7 | lines ×1.5 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Lucky Tide (`lucky_tide`) | notable | flotsam comes 5% more often (all of the tree's frequency) | 3 |
| 2.1 | Lookout Post (`lookout_post`) | unlock | a lookout points and a bell rings 3 s before flotsam drifts in (scene) | 7 |
| 2.3 | Rally Cry (`rally_cry`) | notable | flotsam effects +5% (all of the tree's payout); the crew cheer a Rally | 9 |
| 3.2 | Rainmaker (`rainmaker`) | notable | in rain, flotsam floats 10 s longer | 55 |
| 4.1 | Life Raft (`life_raft`) | unlock | new kind (4%): a stranger rows in and mans your top unmanned line for 10 minutes (scene) | 333 |
| 4.5 | Drag Line (`drag_line`) | automation | flotsam you miss washes up and waits, one at a time | 444 |
| 5.4 | Beachcomber's Net (`beachcombers_net`) | automation | Drift Crates catch themselves while the page is open | 3,333 |
| 6.2 | Flare Gun (`flare_gun`) | unlock, gate 15, R5 | you choose what the Flare calls: any shipped kind but the Sealed Locker and the Bottle (resolution 3.11) | 33.3k |
| 7.1 | Rogue Wave (`rogue_wave`) | unlock | once a run, tap the surf to call a wave that brings in a Drift Crate (scene) | 333k |
| 7.6 | Lost Cargo (`lost_cargo`) | unlock | new kind (3%): a container; line units cost half for 5 min (scene) | 444k |
| 8.5 | Auto Flare (`auto_flare`) | automation, gate 15, R5 data | the Flare fires itself when ready, page open | 3.33M |
| 9.2 | Tide Tables (`tide_tables`) | unlock | the next three flotsam show as marks on a tide clock | 33.3M |
| 9.6 | Weather Buoy (`weather_buoy`) | unlock | a buoy shows the island's next 24 h of weather, so you know when rain brings flotsam (scene) | 44.4M |

- **Smalls:** Slow Current (`flotsam_float`: +1 s in rings 1-2, +2 s in ring 3, +3 s in ring 4,
  reaching 22 s before High Water), rain float (`flotsam_float` `when: rain`), Sea Wall (`output`
  on all lines or the sea lines: Beachcomber, Dock and Ship Breaker) for the lines share from
  ring 5.
- **Other notables:** catching and float (3.3), sea-line output (rings 5-9). Drowned Drone and
  Bottle nodes (R4 data) sit only in rings 7-9. No node raises frequency, payout or Rally after
  ring 2.

### 6.7 Bunker (`bunker`): "Lock up, sleep well, wake up rich"

The Night Shift window, offline output, night and the welcome back.
- Rings 1-3: hours, lanterns, breakfast.
- Rings 4-6: offline output, Collect helpers and Lights Out.
- Rings 7-9: night crews and the bunker door.

**Window plan** (`night_shift`, one +4 h a ring as `10-balance.md` 6.1 budgets it): Deep Cellars
(1.2), Insulated Walls (2.3), Root Cellar I-II (3.1, 4.2), Root Cellar III (5.1), Cold Storage
(6.2), Root Cellar IV (7.3) and Bunk Beds (8.3). With the 12 h base and the agenda's +4 h that is
exactly 48 h (10.4). The Long Night Dare's +4 h (errata E10) only gets there sooner.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | U S | 1 · R2 | +4 h |
| 2 | N S N | 1 · R2 | +4 h; lines ×1.1 (night) |
| 3 | S N N S | 1 · R2 | +4 h; lines ×1.1 (night) |
| 4 | A S C S N | 2 · R3 | +4 h; offline ×1.1; lines ×1.1 (night) |
| 5 | S N K A S | 2 · R3; 5.4 R5 | +4 h; offline ×1.1; lines ×1.1 |
| 6 | S N S S U S | 2 · R3 | +4 h; offline ×1.1; lines ×1.5 |
| 7 | A S S S S U | 3 · R7 | +4 h; offline ×1.1; lines ×1.5 |
| 8 | S S N K A S S | 3 · R7 | +4 h; offline ×1.1; lines ×1.5 |
| 9 | S N S C S U S | 3 · R7 | offline ×1.1; lines ×1.5 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Hot Breakfast (`hot_breakfast`) | unlock | after 6 h or more away, Collect also starts a Rally; the crew eat at the fire (scene) | 2 |
| 1.2 | Deep Cellars (`deep_cellars`) | stat | Night Shift +4 h; a cellar hatch by the cabin (scene, anchor) | 1 |
| 2.1 | Night Lamps (`night_lamps`) | notable | lines +20% at night; lanterns light the base (scene) | 11 |
| 2.3 | Insulated Walls (`insulated_walls`) | notable | Night Shift +4 h; shutters on the cabin | 15 |
| 4.1 | Night Porter (`night_porter`) | automation | Collect runs by itself 3 s after the welcome-back card opens; the card stays | 333 |
| 5.4 | Wake-up Call (`wake_up_call`) | automation, gate 8, R5 | Grit fires itself on your first visit after it is ready | 3,333 |
| 6.2 | Cold Storage (`cold_storage`) | notable | Night Shift +4 h | 77.7k |
| 6.5 | Lights Out (`lights_out`) | unlock | say when you'll be back; return within 30 min of it and the Night Shift pays ×1.1, never less if late; a "Back at 08:00" sign (scene) | 44.4k |
| 7.1 | Snooze (`snooze`) | automation | "Night Shift over" comes 1 h before the window fills | 222k |
| 7.6 | Night Crew (`night_crew`) | unlock | unmanned lines also work the Night Shift at 10% (scene) | 444k |
| 8.3 | Bunk Beds (`bunk_beds`) | notable | Night Shift +4 h: the window reaches 48 h | 5.55M |
| 8.5 | Shift Report (`shift_report`) | automation | the welcome-back card breaks the night down by line | 2.22M |
| 9.6 | Bunker Door (`bunker_door`) | unlock | after 24 h or more away, a Fuel Drum and a Drift Crate wait at a door in the hill (scene) | 33.3M |

- **Smalls:** Root Cellar (`night_shift` +4 h, the window plan), Lantern Oil (`output` `when:
  night`, the lines share, counted at a third), Night Rations (`offline` ×1.1 where no node of the
  ring takes its offline share).
- **Other notables** (3.2, 3.3, 4.5, 5.2, 9.2): Bunker has no unbudgeted stat, so these trade
  night against day or offline against online, with the net inside the share ("Blackout
  Curtains: lines ×1.3 at night, ×0.9 by day").
- **Tension:** Wipe Day Rush halves the window; Graveyard Shift pays only at night.

### 6.8 Blast (`blast`): "Bigger bangs, brighter glass"

Glass gain, Glow's `k`, Afterglow's length, the Kettle and the cinematic, and nuke chores.
- Rings 1-3: glass and the Glow Lamp.
- Rings 4-6: quick rebuilds and Dead Hand.
- Rings 7-9: a twin Kettle and the brightest glass. Keystone slots come from the agenda only
  (resolution 3.9), so the former `fourth_socket` at 9.6 is now a notable, Sunburst.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | N S | 1 · R2 | glass ×1.1 |
| 2 | A S N | 1 · R2 | glass ×1.05; `k` +0.01 |
| 3 | S N U S | 1 · R2 | glass ×1.1; `k` +0.02 |
| 4 | A S C S N | 2 · R3 | glass ×1.1; `k` +0.02 |
| 5 | S N K N S | 2 · R3 | glass ×1.1; `k` +0.03; lines ×1.1 |
| 6 | S A S S U S | 2 · R3; 6.2 R5 | glass ×1.1; `k` +0.03; lines ×1.4 |
| 7 | N S S S S U | 3 · R7 | glass ×1.1; `k` +0.04; lines ×1.4 |
| 8 | S S N K A S S | 3 · R7 | glass ×1.1; `k` +0.04; lines ×1.4 |
| 9 | S U S C S N S | 3 · R7 | glass ×1.1; `k` +0.05; lines ×1.4 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Souvenir Jar (`souvenir_jar`) | notable | Afterglow's half-life +1 min; a jar on the shelf fills with glass, a little each Wipe Day (scene) | 3 |
| 1.2 | Bigger Payload (`bigger_payload`) | stat | glass +10% (anchor) | 2 |
| 2.1 | Forecast (`forecast`) | automation | the Big Red's card also shows when the next +10% lands | 5 |
| 3.2 | Glow Lamp (`glow_lamp`) | notable | Glow `k` 0.25 → 0.27; a green lamp on the pad (scene, anchor, resolution 3.13) | 77 |
| 3.3 | Flight School (`flight_school`) | unlock | pick the flight from those you've seen, on the cover card | 44 |
| 4.1 | Quick Rebuild (`quick_rebuild`) | automation | Rebuild in one tap with your last loadout | 333 |
| 4.5 | Crater Lake (`crater_lake`) | notable | Glow `k` +0.02; the last crater holds water (scene) | 777 |
| 6.2 | Dead Hand (`dead_hand`) | automation, gate 25, R5 | opt-in auto-nuke while online (`05` 6, anchor) | 22.2k |
| 6.5 | Postcard Album (`postcard_album`) | unlock | your last 20 postcards, each with its island snapshot | 44.4k |
| 7.6 | Double Barrel (`double_barrel`) | unlock | a smaller twin Kettle: glass ×1.1, and the film launches both (scene) | 444k |
| 8.5 | Kettle Watch (`kettle_watch`) | automation | a notification when the Big Red is crowned (opt-in, like every notification type) | 3.33M |
| 9.2 | Nose Art (`nose_art`) | unlock | paint the missile with a livery from the flights and records you've logged; the film shows it (scene) | 33.3M |
| 9.6 | Sunburst (`sunburst`) | notable | glass ×1.1; the mushroom cloud glows gold (scene) | 77.7M |

- **Glow `k` plan** (checked cumulatively, 7.3): the 2.3 notable +0.01, Glow Lamp +0.02, Crater
  Lake +0.02, a ring-5 notable +0.02, Bright Glass I-III (rings 6-8) +0.04 each, Second Sun +0.05.
  That is 0.25 → 0.49, plus Chain Reaction's +0.25 while slotted.
- **Glass plan:** one ×1.1 a ring (+5% in ring 2): the Bigger Payload series in rings 1-3, 5, 6
  and 8, Glass Garden, Double Barrel and Sunburst.
- **Smalls:** Bigger Payload (`glass_gain`), Bright Glass (`glow_k`), Warm Embers
  (`afterglow_half`, sharing its 15-minute ceiling with Grip's Afterglow notables) and Fertile Ash
  (`output` all: ash from the last blast feeds the gardens) for the lines share from ring 5.
- **Other notables** (2.3, 5.2, 5.4, 7.1, 8.3): nuke tricks inside the shares. Dead Hand rebuilds
  with the loadout by itself (`03` 2.4), and glass waits on the map: no node buys nodes.

### 6.9 Logbook (`logbook`): "Write it down; it pays"

Rings 1-3 (R2) are **history**: the Wipe Day count, records, rain and night, and old plans that
make eras cheaper. From ring 4, `05`'s Morale and hint nodes ship with R4 (they move out of rings
1-3 so wave 1 ships whole, resolution 3.8). Dares arrive in rings 7-8.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | N S | 1 · R2 | lines ×1.2 |
| 2 | U S N | 1 · R2 | lines ×1.1 |
| 3 | S N N S | 1 · R2 | lines ×1.1 |
| 4 | U S C S N | 2 · R3; 4.1-4.2 R4 | lines ×1.1; Morale per page +0.005 |
| 5 | S N K A S | 2 · R4 | lines ×1.3; +0.005 |
| 6 | S N S S U S | 2 · R4 | lines ×2.5; +0.005 |
| 7 | A S S S S U | 3 · R7; 7.1-7.2 R4 data, 7.6 R7 data | lines ×2.5; +0.005 |
| 8 | S S N K A S S | 3 · R7; 8.4 R4 data, 8.5 R7 data | lines ×2.5 |
| 9 | S U S C S U S | 3 · R7; 9.1, 9.2, 9.4 R4 data | lines ×2.5; +0.010 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Tally Wall (`tally_wall`) | notable | lines +2% a Wipe Day, up to +20%; a mark on the cabin wall for each (scene) | 3 |
| 2.1 | Personal Best (`personal_best`) | unlock | once this run passes your last run's supplies made, a bell rings and lines ×1.1 for the rest of it | 7 |
| 2.3 | Weather Log (`weather_log`) | notable | lines +30% in rain | 11 |
| 3.2 | Almanac (`almanac`) | notable | lines +30% at night | 66 |
| 4.1 | Old Maps (`old_maps`) | unlock, R4 | secret hints show now, not at Wipe Day #15 (`feature:logbook_hints`; `05` adopts this placement, errata E24); a map pinned in the cabin (scene) | 333 |
| 4.2 | War Stories (`war_stories`) | stat, R4 | Morale per page +0.005 (`05` 1.4) | 222 |
| 4.5 | Long Memory (`long_memory`) | notable | lines +1% a Wipe Day, up to +10% | 777 |
| 5.4 | Field Guide (`field_guide`) | automation, R4 | every visible page shows its progress bar | 2,222 |
| 6.2 | Dog-eared Pages (`dog_eared`) | notable, R4 | Morale ×1.2 (what "secrets count twice" is worth at 250 pages, without new code) | 55.5k |
| 6.5 | Bottle Reader (`bottle_reader`) | unlock, R4 | a Message in a Bottle names a secret's answer, not just its hint | 44.4k |
| 7.1 | Hint Lamp (`hint_lamp`) | automation, R4 data | with nothing crowned, the advisor points to the nearest unfound page | 333k |
| 7.6 | Double Dare (`double_dare`) | unlock, gate 5, R7 data | two Dares at once, both to be met; two flags on the crater sign (scene) | 444k |
| 8.5 | Dare Ledger (`dare_ledger`) | automation, R7 data | Rebuild repeats your last unfinished Dare | 2.22M |
| 9.2 | Treasure Map (`treasure_map`) | unlock, R4 data | once a week an X on the island marks one unfound secret (scene) | 33.3M |
| 9.6 | Postcard Pen (`postcard_pen`) | unlock | write one line (40 characters) on each postcard; it posts with the news | 33.3M |

- **Morale smalls** (`05` 1.4, rings 4-9 as `05` adopts, errata E24): War Stories (4.2), Margin
  Notes (5.1), Field Notes (6.3) and Pressed Flowers (7.2) add +0.005 each, Bound Volume (9.1) +0.010: per page 0.02 → 0.05.
  Rings 2-3's share (+0.006) waits for R4, so the total never runs ahead of the budget.
- **Smalls:** Old Plans (`era_cost` ×0.9) in rings 1-4, reaching ×0.5 with Well Read; Ship's Log
  (`output` `per: nukes` with a `max`) for the lines share from ring 5.
- **Other notables:** 3.3 (history inside the share, or a rain or night trade-off), 5.2 (an R4
  notable), 8.3.

### 6.10 Scrapyard (`scrapyard`): "Nothing is junk if you keep it"

Rings 1-3 (R2) are **the shelf**: cheaper upgrades and Grip rungs at the start. From ring 4 come
the Pocket slots and the Magnet's winches (R5), and from ring 6 ranks (placements `05` adopts,
errata E24). No node adds scrap income (`05` 2.2-2.3). Deep Pockets, Quick Winch and Greased Cable form one column that ships whole in R5.

| Ring | Slots | Wave · ships | Share |
| --- | --- | --- | --- |
| 1 | N S | 1 · R2 | none (shelf prices, kits) |
| 2 | A S N | 1 · R2 | none |
| 3 | S N A S | 1 · R2 | none |
| 4 | U S C S A | 2 · R3; 4.1 R5 | none |
| 5 | S N K A S | 2 · R3; 5.1 R5 | lines ×1.2 |
| 6 | S N N S U S | 2 · R3; 6.1, 6.3, 6.5 R5 | lines ×3 |
| 7 | A S S S S N | 3 · R7; 7.2 R5 data | lines ×3 |
| 8 | S S N K A S S | 3 · R7; 8.1, 8.3, 8.4 R5 data | lines ×3 |
| 9 | S U S C S U S | 3 · R7; 9.2, 9.4, 9.6 R5 data | lines ×3 |

| Slot | Node (id) | Type | Effect | Glass |
| --- | --- | --- | --- | --- |
| 1.1 | Scrap Heap (`scrap_heap`) | notable | shelf upgrades cost ×0.8; a heap by the skiff grows each Wipe Day (scene) | 3 |
| 2.1 | Tool Bag (`tool_bag`) | automation | start every run with Stone Tools | 5 |
| 2.3 | Bargain Bin (`bargain_bin`) | notable | Line Mk upgrades cost ×0.6 | 11 |
| 3.2 | Patched Sail (`patched_sail`) | notable | island upgrades cost ×0.7 | 66 |
| 3.3 | Iron Bag (`iron_bag`) | automation | start with Iron Tools | 44 |
| 4.1 | Deep Pockets (`deep_pockets`) | unlock, R5 | Pocket slot 2 can be bought (15 scrap); a second locker by the skiff (scene; resolution 3.10) | 333 |
| 4.5 | Salvage Cart (`salvage_cart`) | automation | one button buys every affordable shelf upgrade, cheapest first; a handcart (scene) | 333 |
| 5.1 | Quick Winch (`quick_winch`) | stat, R5 | the Magnet's thresholds 1 h sooner: 19/22/23 h (`05` 2.2) | 2,222 |
| 5.2 | Spare Parts (`spare_parts`) | notable | a Line Mk pays ×3.25 (was ×3) | 5,555 |
| 5.4 | First Shelf (`first_shelf`) | automation | start with Sorting Tables, the first island upgrade | 2,222 |
| 6.1 | Greased Cable (`greased_cable`) | stat, R5 | the Magnet 1 h sooner again | 22.2k |
| 6.3 | (writer's) | notable, R5 | each crew rank ×2.1 (was ×2) | 55.5k |
| 6.5 | Sewn Lining (`sewn_lining`) | unlock, R5 | Pocket slot 3 can be bought (40 scrap; resolution 3.10) | 44.4k |
| 7.1 | Mk Kit (`mk_kit`) | automation | start with Line Mk II for lines 1-6 | 222k |
| 8.3 | Brass Polish (`brass_polish`) | notable, R5 data | each crew rank ×2.25 | 5.55M |
| 8.5 | Power Kit (`power_kit`) | automation | start with Salvaged Tools | 2.22M |
| 9.2 | Junk Drawer (`junk_drawer`) | unlock, R5 data | swap one full Pocket once a run, at any time | 33.3M |
| 9.6 | Golden Hook (`golden_hook`) | unlock, R5 data | once a week the Magnet lands a gold-painted bolt for the island, cosmetic only (scene) | 33.3M |

- **Winches** (`magnet_hours`): Quick Winch (5.1), Greased Cable (6.1), Heavy Coil (7.2) and
  Night Crane (8.1), each 1 h off all three thresholds, down to canon's 16/19/20 h.
- **Smalls:** Sharp Eye (`upgrade_cost` ×0.9 on one shelf kind, to ×0.25 a kind) in rings 1-5,
  the winches, and Mk and rank smalls (`mk_mult`, `rank_mult`) for the lines share from ring 6.
- **Other notables:** 6.2 (shelf or start kits, R3) and Pocket or rank mechanics in rings 7-9
  (R5 data).

### 6.11 Where each tree-bought system lives

| System | Node(s) |
| --- | --- |
| Starter kits | `packed_crate` 1.1, `big_kit` 4.1 (Works); `standing_crew`, `lifers`, Crew Kits (Crew); `tool_bag`, `iron_bag`, `first_shelf`, `mk_kit`, `power_kit` (Scrapyard) |
| Start era | `prefab_walls` 3.3, `stone_foundations` 5.2, `tin_roofs` 7.1 (Works) |
| Kept hands | `old_friend` 1.1, `hiring_board` 2.1, `old_crew_1/2/3` 3.2, 5.2, 6.3 (Crew) |
| Foreman scope | `foremans_mate` (Crew 6.2, gate 7) |
| Dead Hand | `dead_hand` (Blast 6.2, gate 25) |
| Flare | agenda #15; `flare_gun`, `auto_flare` (Tide) |
| Toolbelt automation | `hair_trigger` (Grip), `wake_up_call` (Bunker) |
| Keystone slots | the agenda only: #10, #20, #40 |
| Pocket slots 2-3 | `deep_pockets`, `sewn_lining` (Scrapyard) |
| Night Shift hours | Bunker's window plan (6.7) |
| Logbook hints | `old_maps`, `bottle_reader`, `hint_lamp`, `treasure_map` |
| Magnet cycle | the four winches (Scrapyard) |
| Ranks | Scrapyard 6.3, `brass_polish`, `yard_boss` |
| New flotsam kinds | `life_raft`, `lost_cargo` (Tide); Drone and Bottle nodes in rings 7-9 |

---

## 7. Power budget (`10-balance.md` 6, split by sector)

`10-balance.md` 6.1 sets what each ring may add when fully lit, across all eight sectors. This
section splits it. The shares are binding for `04b`; the simulator may move them in data.

### 7.1 Who holds each column

| Column (whole tree) | Sector | Per ring |
| --- | --- | --- |
| Lines and global output (×5.8e13) | shared, 7.2 | |
| Tap value (×1.5) | Grip | ring 1 (Calloused Hands) |
| Tap internals (`p` ×1.2, Hustle ×2.25, crits +45%) | Grip | `p` +10% and Hustle +0.25 (ring 2), crits (ring 3), `p` +9% (ring 4) |
| Line prices (×0.29) | Works | ×0.95, ×0.9, ×0.9, then ×0.85 a ring |
| Hand prices (×0.29) | Crew | the same |
| Flotsam (×1.05 often, ×1.05 pay) | Tide | frequency (ring 1), effects (ring 2), nothing after |
| Night Shift hours (+32 h) | Bunker | +4 h in each of rings 1-8 |
| Offline output (×1.77) | Bunker | ×1.1 in each of rings 4-9 |
| Glass gain (×2.25) | Blast | ×1.1 a ring, ×1.05 in ring 2 |
| Glow `k` (0.25 → 0.49) | Blast | +0.01, +0.02, +0.02, +0.03, +0.03, +0.04, +0.04, +0.05 in rings 2-9 |
| Morale per page (0.02 → 0.05) | Logbook | rings 2-3's +0.006 waits for R4: +0.005 in rings 4-7, +0.010 in ring 9 |

The model applies one price factor to lines and hands, so Works' line prices and Crew's hand
prices each take the whole column.

### 7.2 The lines split

| Ring | Budget | Works | Crew | Logbook | Bunker | Grip | Tide | Blast | Scrapyard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ×1.3 | ×1.1 | | ×1.2 | | | | | |
| 2 | ×1.4 | ×1.1 | ×1.05 | ×1.1 | ×1.1 | | | | |
| 3 | ×1.6 | ×1.2 | ×1.1 | ×1.1 | ×1.1 | | | | |
| 4 | ×2.0 | ×1.65 | | ×1.1 | ×1.1 | | | | |
| 5 | ×10 | ×2.6 | ×1.5 | ×1.3 | ×1.1 | ×1.15 | ×1.2 | ×1.1 | ×1.2 |
| 6-9, each | ×1,000 | ×6.5 | ×4.4 | ×2.5 | ×1.5 | ×1.5 | ×1.5 | ×1.4 | ×3 |

The products are ×1.32, ×1.40, ×1.60, ×2.0, ×10.2 and ×1,010. "Lines" is everything that
multiplies line output: `output`, `speed`, milestone and Mk payouts, ranks and the `morale` factor.
Rings 1-4 allow only ×5.8 for the whole tree, so most early nodes are prices, hours, kits, feel and
automation (`10-balance.md` 6.3 expects about five line nodes per ring there). Rings 6-9's ×1,000
are the model's starting point; R7 revisits them after the owner's late-wall choice (resolution
3.24).

### 7.3 Counting a node

- **The check.** A ring's factor is the fold with the ring lit over the fold without it, every
  lower ring lit, at the ring's typical state, which `10-balance.md` lists per ring (6.1; errata
  E25). Multiplicative columns are checked per ring; additive ones (hours, `k`, Morale per page) cumulatively, so a ring may run
  ahead only as far as earlier rings ran behind. A sector more than 10% over its share fails
  (`10-balance.md` 7.4).
- **Planning weights** for writers until the check runs: an effect on all lines counts in full;
  one era (three lines) at half its bonus; one line at a quarter; a Twig line or the Twig era at a
  tenth; `night` at a third; `rain` at 0.15; `afterglow` at 0.02; `per: hands` at 14 hands;
  `per: nukes` and `per: entries` at their `max`; a run-long bonus earned in the run (Golden Chip,
  Woodpile) at its cap. So Campfires ×2 counts ×1.1, and lines +30% at night ×1.1.
- **Unbudgeted, but capped (4.2):** Hustle and Afterglow feel, fells inside `c`'s headroom, float
  time and catching, new kinds at a crate's value, shelf and era prices (capped at ×0.25 per
  shelf kind and ×0.5 for eras, measured by the simulator before R3; errata E25), the Magnet's
  hours, automation and information. Kits, kept hands and start eras keep `10-balance.md` 6.2's rings:
  Starter Kit, Old Friends and Deep Cellars in ring 1; Old Crew I and the Timber start in ring 3;
  Bigger Kit in ring 4; Old Crew II and the Stone start in ring 5; Old Crew III in ring 6; the
  Sheet Metal start in ring 7.
- **N9 and `c`:** nothing conditional on tapping (`when: hustle_full` or `online`) adds line or
  flotsam power; such effects only change feel. Tap power stops at ring 4. The steady tap
  coefficient stays at most 0.6 at 6 taps/s with the whole tree (resolution 1.5).
- **Keystones** sit outside the shares and answer to the keystone rule (6.1).
- **The advisor's pick** (8.4) uses the same weights to compare nodes.

---

## 8. The UI (React DOM and inline SVG, one renderer)

Wireframes are in `08-screens.md` 2.9-2.11. This section adds the rules behind them.

### 8.1 Overview disk and sector ladder

- **Disk:** `blastLayout(content)` (`09` 10.4) puts shipped ring `i` of `n` at radius
  `R × (0.1 + 0.9 × (i − 0.5) / n)`, so the disk always fills about 370 px, with angles as in 1.2.
  Rings above `shippedWave` are not drawn; locked rings are dashed and carry their gate ("Ring 4
  opens at Wipe Day #5"). Each wedge is one tap target. A ring lit in all eight sectors glows once
  as a full circle, and a finished sector keeps a bright glyph. Sectors have no hues (`08`).
- **Ladder:** ring 1 at the bottom, opened at the lowest unfinished ring.
  - Rings of 5-7 nodes take two staggered rows: odd slots below, even slots above (3 + 2, 3 + 3,
    4 + 3).
  - A node's x is `(slot − 0.5) / size` of the width, so the wedge's order is kept and edges stay
    short.
  - Rows are 116 px and ring headers 32 px.
  - Positions are fixed by slot: a reserved slot is empty space, never a placeholder, and nothing
    moves when its node ships.

### 8.2 Node sheet

- `effectNow` (`09` 10.4) folds the state with and without the node, then reads by kind:
  - income: "+38k/s now (+12%)";
  - taps: "A tap: 1.2k → 1.8k";
  - bounded stats: "Night Shift 16 h → 20 h";
  - features: the blurb.
- It shows the cost and what is left afterwards (rule 6.3.4), and "Leads to: …".
- **Locked reasons**, first that applies:
  1. ring gate: "Ring 4 opens at Wipe Day #5 (2 to go)";
  2. node gate;
  3. no owned parent: "Needs Whetstone or Quick Fingers" (Buy path offered);
  4. glass: "Need 412 more glass".

### 8.3 Path buying

- **Choosing the path:** work down a ring at a time. Nodes with a single parent take it first.
  Every other needed node takes a parent that is owned or already on the path, or else its
  cheapest. A completion needs its whole ring. Buy in ring order, and offer no path through a gate.
- The path lights on the ladder, and the primary reads "Buy path · 4 nodes · 1,240 glass". If only
  part is affordable, it reads "Buy the first 2 · 300 glass".
- One `buy_node {path}` command, all or nothing (`09` 6). The server recomputes cost and order.

### 8.4 Filters and the advisor's pick

- **Filter chips** (canon): Affordable, Taps, Offline, Automation, Keystones. They are derived from
  data and never authored:
  - Taps: `tap*`, `hustle*`, `crit*`, `fell*`, `afterglow*`, `rush*`;
  - Offline: `night_shift`, `offline`, `when: offline/night`;
  - Automation: the automation type plus `start_*`, `keep_hand` and auto-buy features.
  - Chips dim the dots that don't match and narrow the pick.
- **One pulsing pick per map**, first match wins:
  1. after Wipe Day #1, Starter Kit;
  2. the cheapest affordable unlock or automation node not yet picked;
  3. the affordable node with the best income gain per glass (7.3's weights, taps at the
     player's own recent share), with ties to the lower ring, then the lower slot;
  4. otherwise the cheapest reachable node, dim, with its shortfall.

  Keystones and paths are never the pick. The nav item shows the affordable count.

### 8.5 States, motion, desktop, performance, accessibility

- **States** as `08` 2.10. A buy is predicted (D64): the node fills, its edge lights outward in
  300 ms and shards fly from the glass chip; a newly lit ring or sector glows once. Reduced
  motion fills instantly with no pulse, and the pick keeps its orange ring.
- **Desktop** as `08`: the disk, then the selected ladder and its clockwise neighbour, with the
  sheet as a popover.
- **Performance:** one SVG of up to 361 circles with no filters, the state as a CSS class,
  memoised on `meta.nodes`; a ladder is at most 45 buttons and one edge SVG; lazy-loaded, with the
  Pixi ticker at 10 fps while open (`09`). Target: under 50 ms of scripting to open the overview on
  a mid-range phone.
- **Accessibility:**
  - every node is a `<button>` labelled like "Lucky Swing, notable, Grip ring 3, 77 glass,
    affordable";
  - arrow keys walk rings and slots;
  - the disk has a per-wedge text summary;
  - states differ by frame, fill and icon, not colour alone;
  - chips are 44 px tall and label contrast is at least 4.5:1.

### 8.6 `web:shots`

`08` 8.3 lists the Blast Map shots by phase (R2, R3, R7). The ones this section asked for pin:

| Shot | Pins |
| --- | --- |
| `phone_map_first` | Wipe Day #1, 10 glass, the pick card on Starter Kit |
| `phone_node_path_partial` | "Buy the first 2" |
| `phone_map_respec` | the respec card over the map |
| `phone_ladder_long` | the longest names, 55.5M prices, ring 9 in view (R7) |
| `phone_map_full` | all 361 lit, the payoff view (R7) |

---

## 9. `blastmap.json5`

### 9.1 Shape

`09` 8.2's node schema (with `wave`, `gate`, `series`, `conflicts`, `max` on `per` effects) plus the
top-level tables below.

```json5
{
  // clockwise from 12 o'clock
  sectors: ["grip", "crew", "works", "tide", "bunker", "blast", "logbook", "scrapyard"],
  shippedWave: 2, // 1 in R2, 2 from R3, 3 in R7 (resolution 3.8)
  rings: [{ ring: 1, size: 2, band: [1, 2] }, /* … */ { ring: 9, size: 7, band: [2e7, 6e7] }],
  prices: [1, 2, 3, 4, 5, 7, 9, 11, 15, 19, 25, 33, 44, 55, 66, 77, 99, 111, 150, 222 /* … 111e6 */],
  typeFactor: { stat: 1, notable: 2, keystone: 3, unlock: 1, automation: 1, completion: 1 },
  ceilings: { hustle_max: 2.25, night_shift: 32 /* section 4.2 */ },
  budget: { /* section 7: per ring, column and sector */ },
  steps: { "output.more": [/* section 10.2 */] },
  series: [{ id: "steady_breath", sector: "grip" } /* … */],
  reserved: [{ sector: "logbook", ring: 4, slot: 1 } /* filled by R4 */],
  nodes: [ /* below */ ],
}
```

### 9.2 Example entries

```json5
{ id: "steady_hands", sector: "grip", ring: 1, slot: 2, type: "stat", wave: 1, cost: 1,
  effects: [{ stat: "tap", op: "inc", value: 0.5 }] },

{ id: "steady_breath_1", sector: "grip", ring: 3, slot: 1, type: "stat", wave: 1, cost: 33,
  series: "steady_breath", effects: [{ stat: "hustle_hold", op: "add", value: 0.5 }] },

{ id: "tally_wall", sector: "logbook", ring: 1, slot: 1, type: "notable", wave: 1, cost: 3,
  scene: true, effects: [{ stat: "output", op: "inc", value: 0.02, per: "nukes", max: 0.2 }] },

{ id: "wipe_day_rush", sector: "grip", ring: 5, slot: 3, type: "keystone", wave: 2, cost: 7777,
  conflicts: ["hot_core"],
  effects: [{ stat: "afterglow", op: "set", value: 5 },
            { stat: "afterglow_hold", op: "set", value: 3600 },
            { stat: "night_shift", op: "more", value: 0.5 }] },

{ id: "dead_hand", sector: "blast", ring: 6, slot: 2, type: "automation", wave: 2, cost: 22200,
  gate: 25, effects: [{ stat: "feature:dead_hand", op: "unlock", value: 1 }] },
```

### 9.3 Content checks (`checkBlastMap`)

**Structure**
1. `ground_zero` plus 8 sectors × ring sizes, with every slot of a ring in data filled or
   reserved. Slots are unique and within their ring, and every node's `wave` matches its ring.
2. Ids are unique and `snake_case`, 2-32 characters, and match no sector, line, era or target id.
   Locale has `node.<id>.name` (or the series name), `.blurb` for every node that is not small, and
   `sector.<id>.*`. Names are at most 24 characters, blurbs at most 80.
3. Edges come from the layout rule plus outward `links` within the sector. A completion needs its
   whole previous ring. Each node has 1-3 parents. Every node up to `shippedWave` is reachable
   from `ground_zero` without passing a reserved slot; a hidden wave-3 node may wait behind one.

**Mix**

4. Type counts per sector equal 2.2 on the final tree (Ground Zero is the 36th unlock). On a
   partial build they never exceed it.
5. Keystones sit at 5.3 and 8.4. Each has at least one effect that lowers a stat or turns
   something off. `conflicts` name keystones.
6. Completions sit at 4.3 and 9.4.
7. **No three small nodes in a row** on any chain (dynamic programming over the DAG).
8. Each sector has at least one `scene: true` node in each complete band (rings 1-3, 4-6, 7-9).

**Costs**

9. Every price is on the ladder and inside its band × `typeFactor`. Keystones cost exactly 7,777
   or 7.77M. Every ×1 price in ring `r + 1` is above every ×1 price in ring `r`.

**Effects**

10. Every `stat`, `per`, `when` and `scope` is registered (`09` 5.1). Ops are allowed for the stat.
    Every `per` has a `max`. `feature:*` appears only on unlock, automation and keystone nodes.
11. A small node has exactly one effect, taken from `steps` for its ring.
12. **The 10% rule** from ring 3 on (`10-balance.md` 6.3): each small node raises its (stat,
    scope) by at least 10%, assuming every lower-ring node is owned.
13. **Budget:** each sector stays within its share per ring (section 7, +10%), multiplicative
    columns per ring and additive ones cumulatively. The ceilings (4.2) hold over all non-keystone
    nodes: `c` ≤ 0.6 at 6 taps/s, Hustle ≤ ×2.25, `night_shift` exactly +32 h, `magnet_hours` down
    to 20. Nothing touches `sealed_locker`, scrap income or a social system.
14. **Keystones:** each has a simulator row showing at most ×2 for its target and a cost elsewhere
    (resolution 3.13, `10-balance.md` 7.4).

**Gates and waves**

15. Ring gates exist in `agenda.json5` and rise with the ring. A node's `gate` is at least its
    ring's gate. A node touching the Toolbelt, the Foreman, Dares or Dead Hand carries at least
    that system's agenda count.
16. A wave-1 or wave-2 node in data uses only systems shipped in its build. In R7 nothing is
    reserved.

---

## 10. Writing small nodes (the template)

### 10.1 Series

- Each sector writes its 22-24 small nodes as **4-6 series**, one per stat bucket. A series is
  named once (`node_series.<id>`) and numbered outward: Steady Breath I … VI. That gives about 40
  names, not 187.
- The anchors and one-offs keep their own names: `steady_hands`, `quick_fingers`, `hot_coals`,
  `deep_cellars`, `bigger_payload`, `war_stories`, `05`'s Morale nodes and the four winches.
- The series for each sector are in section 6.
- A numeral is 1-8 in data and I-VIII on screen.

### 10.2 Value steps (provisional, in `steps`)

A sector picks values inside these ranges so its ring meets its share (section 7). Line effects
use `inc` in rings 1-4 ("+10%") and `more` from ring 5 ("×1.3").

| Stat (op) | Rings 1-2 | Rings 3-4 | Ring 5 | Rings 6-9 |
| --- | --- | --- | --- | --- |
| `output` all | +10% | +10-15% | ×1.1-1.3 | ×1.1-1.5 |
| `output` one era / one line | +25% / +50% | +30% / +60% | ×1.3 / ×1.6 | ×1.5 / ×2 |
| `output` at night / in rain | +10-30% / +30% | +30% / +60% | ×1.3 / ×1.6 | ×1.5-1.7 / ×2 |
| `output` `per: hands` (max at 14) | +0.5% | +0.7% | +1.5% | +2-3% |
| `output` `per: nukes` (`max`) | +1-2% (+10-20%) | +1% (+10%) | ×1.01 (×1.3) | ×1.02 (×1.35) |
| `line_cost`, `hand_cost` | ×0.95 / ×0.9 | ×0.9 / ×0.85 | ×0.85 | ×0.85 |
| `upgrade_cost`, `era_cost` | ×0.9 | ×0.9 | ×0.9 | ×0.9 |
| `glass_gain` | +10% / +5% (`inc`) | ×1.1 (`more`) | ×1.1 | ×1.1 |
| `glow_k` | +0.01 | +0.02 | +0.02 | +0.04 (rings 6-8) |
| `night_shift` / `offline` | +4 h / – | +4 h / ×1.1 | +4 h / ×1.1 | +4 h / ×1.1 |
| `flotsam_float` | +1 s | +2-3 s | rain +5 s | rain +5 s |
| `hustle_hold` / `hustle_drain` / `hustle_gain` | +0.5 s / ×0.9 / +0.25 | the same | the same | the same |
| `afterglow_half` | +60 s | +60 s | +90 s | +90 s |
| `morale_per` | | +0.005 (ring 4) | +0.005 | +0.005 (ring 9: +0.010) |
| `magnet_hours` | | | 23 | 22, 21, 20 |
| `start_owned` (one line) | 5-10 | 10 | 15 | 25 |

**Ceilings stop a series**, not the writer's taste: when the next step would pass a ceiling or
add less than 10%, the series ends or moves to a notable (10.4).

### 10.3 Rules

- A name is plain words, at most 24 characters and two lines of 12. It contains no other game's
  terms (D43) and no pun that hides the effect.
- A small node has one stat and one effect, and its value comes from the step table. Its effect
  line is generated, so there is no blurb.
- **Order of writing:** put the anchors in first, then the fixed nodes from section 6, then the
  notables inside the share, then the series:
  - keep a running sheet per ring: the share, what the ring uses, what is left;
  - walk every chain so that consecutive smalls belong to different series;
  - run `pnpm check` after each ring once the check exists.
- A blurb is one sentence, at most 80 characters, in the player's terms ("Hustle holds 3 s and
  drains 20% slower"). It has no flavour unless a `flavour` key is added.

### 10.4 Worked example: Bunker's window

| Node | Slot | Value | Window before → after (lower rings owned) | Gain |
| --- | --- | --- | --- | --- |
| Deep Cellars | 1.2 | +4 h | 12 → 16 h | 33% |
| Insulated Walls | 2.3 | +4 h | 16 → 20 h | 25% |
| Root Cellar I | 3.1 | +4 h | 20 → 24 h | 20% |
| Root Cellar II | 4.2 | +4 h | 24 → 28 h | 17% |
| the agenda, Wipe Day #10 | | +4 h | 28 → 32 h | |
| Root Cellar III | 5.1 | +4 h | 32 → 36 h | 12.5% |
| Cold Storage | 6.2 | +4 h | 36 → 40 h | 11% |
| Root Cellar IV | 7.3 | +4 h | 40 → 44 h | 10% |
| Bunk Beds | 8.3 | +4 h | 44 → 48 h | 9%: a notable, so the 10% rule does not apply |

Every ring adds exactly its +4 h, the cumulative total never runs ahead of the budget, and the
last step sits on a notable because a small would fail the 10% rule.

---

## Open questions

1. **Thin early rings.** The budget allows ×5.8 of line output across rings 1-4 for the whole
   tree, so most early nodes are prices, hours, kits, feel and automation, and Bunker's ring 3-4
   notables can only be trade-offs. If playtests find rings 3-4 flat, the fix is a larger ring
   budget from the simulator, not over-budget nodes.
