# 04b Bunker sector: "Lock up, sleep well, wake up rich" (proposal)

The 45 nodes of the Bunker wedge of the Blast Map. Data: `04b-bunker.json` (this file is the
readable copy). Names are proposals for the owner's pass; numbers are starting values the
simulator may retune in data. Read with `04-blast-map.md` 6.7 (the brief), `10-balance.md` 6 (the
budget, authoritative), `02-the-run.md` 10 (the Night Shift and welcome back) and
`05-meta-layers.md` 7 (Grit, for Wake-up Call).

## 1. The sector

The Bunker is the casual player's wedge: the Night Shift window, output while you're away, the
night, and the welcome back. Nearly every node pays off whether or not you tap.

- **Rings 1-3 (R2): hours, lanterns, breakfast.** Deep Cellars and Insulated Walls stretch the
  window, Hot Breakfast turns the morning Collect into a Rally, Night Lamps light the base, All
  Clear brings the crew up out of the hatch after a Wipe Day, and the Moonshine Still grows with
  the wedge ("It's lamp fuel. Mostly.").
- **Rings 4-6 (R3; Wake-up Call R5): away pays, and Collect helps.** Night Porter collects for
  you, Snug and the Night Rations raise output while you're away, Banked Fires keep the fire lines
  working through a night-time rebuild, Bunker Mentality is the idler's keystone, Cold Storage
  adds hours, and Lights Out pays ×1.1 when you come back when you said you would.
- **Rings 7-9 (R7, in data from R3): night crews and the bunker door.** Snooze warns an hour
  before the window fills, Night Crew puts head-torches on unmanned plots, Bunk Beds reach the
  48 h ceiling, Graveyard Shift trades the day for the night, Shift Report breaks the night down,
  Dug In grows with the whole wedge, and the Bunker Door leaves a drum and a crate after a long
  absence.

**Anchors (canon 6.7):** Deep Cellars (`deep_cellars`, 1.2, +4 h, 1 glass; the legacy perk id, so
its `perk.*` locale keys move to `node.*`) and Bunker Mentality (`bunker_mentality`, 5.3, 7,777).

**Fields beyond the brief's list**, as the other `04b` files use them: `series` on series smalls,
`gate` on Wake-up Call (Grit, Wipe Day #8), `conflicts` on keystones, `data_from` on rings 7-9
(every one joins `blastmap.json5` in R3: none needs a system after R3). A feature effect carries
its one parameter in `value`: Hot Breakfast 6 (hours away), Night Porter 3 (seconds), Lights Out
1.1 (the pay), Night Crew 0.1 (the share), Bunker Door 24 (hours away); the rest use 1.

### 1.1 Changes from `04-blast-map.md` 6.7, and why

| Node or rule | 04 draft | Here | Reason |
| --- | --- | --- | --- |
| Lines shares | ×1.1 (night) in rings 2-5, ×1.5 in 6-9 | –, –, –, ×1.1, ×1.26, then ×2 a ring | `10-balance.md` 6.3 replaces 04 section 7 |
| Window plan | +4 h in each of rings 1-8: 1.2, 2.3, 3.1, 4.2, 5.1, 6.2, 7.3, 8.3 | +4 h in rings 1-4 (1.2, 2.3, 3.4, 4.2), none in 5, +8 h in 6 (6.1, 6.2), +4 h in 7 (7.2) and 8 (8.3) | same +32 h; never ahead of 04's running total; ring 6 takes +8 h as `10-balance.md` 6.1 does, so its fourth small costs no lines share; Root Cellar I moves to 3.4 so no chain runs Root Cellar → Root Cellar (soft rule) |
| Trade-off notables ("lines ×1.3 at night, ×0.9 by day") | 3.2, 3.3, 4.5, 5.2, 9.2 | none | canon 13.5 and `09` 5.1: outside keystones a `more` on a "higher" stat is at least 1 (monotonicity); the zero-share rings get small conditional notables instead (All Clear, Moonshine Still) and a scoped one (Banked Fires) |
| Late lines share | Lantern Oil (night) smalls | mostly Tinned Beans (all lines), Lantern Oil stops at IV | night stacks multiplicatively inside its own condition (section 2.2); `away` bonuses beyond ×2 make a closed tab pay more than an open one |
| Graveyard Shift | lines ×8 at night, ×0.5 always | lines ×4 at night, ×0.5 always | with the tree's own night power, night is most of income late; ×8/×0.5 then gives the casual ×2.7-3.6, over the keystone rule. ×4/×0.5 can never pass ×2, whatever the night share |
| Bunker Mentality conflicts | Scavenger's Eye, Wreckers' Moon | plus Lone Wolf | Lone Wolf has no hands, so almost nothing runs while you're away (Night Crew's 10% aside) |
| Bunk Beds | +4 h (44 → 48) | the same | |
| Snug, Deep Sleep | offline ×1.1 | the same | they take rings 4 and 9 of the `offline` column |
| Lights Out | Night Shift pays ×1.1 when on time | the same, counted in Bunker's lines share | it pays on output while away; the `offline` column is full |
| Snooze | early "Night Shift over" | the same, id kept | |

## 2. Budget tracking (`10-balance.md` 6)

**How nodes are counted** (the same way as the other `04b` files): `inc` as `1 + w × v` (an upper
bound for the Σinc ratio check); `more` as `1 + w × (f − 1)`; `when: night` at w = 0.1 in rings
1-3 and 0.4 from ring 4; `afterglow` 0.02; `offline` (away) at full value; `per` effects at their
`max`; scopes at mid-game weights from ring 4 (lines 1-11 0, Sheet Metal 0.03). Lights Out counts
×1.1 in the lines share. Keystones sit outside. Bunker touches no tap, flotsam, glass, Glow,
Morale, price or shelf column, and no rain.

### 2.1 Per ring

| Ring | Lines share | Lines used (nodes) | Running share | Running used | `offline` (ring · running, budget) | `night_shift` this ring | Running hours (04 plan · 10 table) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | – | ×1 (none) | ×1 | ×1 | – (–) | +4 h | 4 h (4 · 4) |
| 2 | – | ×1.03 (Night Lamps 1.02 · Lantern Oil I 1.01) | ×1 | ×1.03 | – (–) | +4 h | 8 h (8 · 4) |
| 3 | – | ×1.051 (Lantern Oil II 1.03 · All Clear 1.01 · Moonshine Still 1.01) | ×1 | ×1.082 | – (–) | +4 h | 12 h (12 · 8) |
| 4 | ×1.1 | ×1 (none) | ×1.1 | ×1.082 | ×1.1 · ×1.1 (×1.1) | +4 h | 16 h (16 · 8) |
| 5 | ×1.26 | ×1.245 (Night Owls 1.112 · Lantern Oil III 1.12) | ×1.386 | ×1.348 | ×1.1 · ×1.21 (×1.21) | +0 h | 16 h (20 · 12) |
| 6 | ×2 | ×1.973 (Cold Storage 1.15 · Lantern Oil IV 1.2 · Lights Out 1.1 · Tinned Beans I 1.3) | ×2.772 | ×2.66 | ×1.1 · ×1.331 (×1.331) | +8 h | 24 h (24 · 20) |
| 7 | ×2 | ×1.96 (Tinned Beans II 1.4 · Tinned Beans III 1.4) | ×5.544 | ×5.214 | ×1.1 · ×1.464 (×1.464) | +4 h | 28 h (28 · 24) |
| 8 | ×2 | ×1.918 (Steel Plating I 1.015 · Tinned Beans IV 1.4 · Tinned Beans V 1.35) | ×11.088 | ×10.003 | ×1.1 · ×1.611 (×1.611) | +4 h | 32 h (32 · 32) |
| 9 | ×2 | ×1.929 (Tinned Beans VI 1.2 · Dug In 1.2 · Tinned Beans VII 1.2 · Tinned Beans VIII 1.1 · Steel Plating II 1.015) | ×22.176 | ×19.299 | ×1.1 · ×1.772 (×1.772) | +0 h | 32 h (32 · 32) |

- **Lines.** From ring 4 every ring sits at or under its own share and the running total stays
  under the budget's running total; the sector delivers ×19.3 of its ×22.2 (87%), leaving room
  for the simulator. **Rings 2-3** have no Bunker lines share in `10-balance.md` 6.3, but the brief
  puts Night Lamps (+20% at night) at 2.1 and the step table makes every ring-2/3 small a night
  bonus, so they read ×1.03 and ×1.05 (running ×1.08): inside the check's +10%, and repaid by
  ring 4, which spends none of its ×1.1. If the check must read exactly ×1.0 there, the fix is in
  data: Lantern Oil I-II and Night Lamps on the Twig and Timber eras (nearly free in week 1).
- **Offline:** ×1.1 in each of rings 4-9 (Snug, Night Rations I-IV, Deep Sleep): ×1.772 against
  the column's ×1.77, which is 1.1⁶ rounded; the ceiling in `04` 4.2 should read ×1.772.
- **Hours:** exactly +32 h (12 + 4 at Wipe Day #10 + 32 = 48). The running total never passes 04's
  window plan. It runs ahead of `10-balance.md` 6.1's row by 4-8 h in rings 2-7; that row says it
  follows 04's plan, and `10-balance.md` itself notes that no archetype is away more than 13 h, so
  hours past Deep Cellars move no number (open question 2).
- **The 10% rule:** every Root Cellar raises the window at least 10% over the lower rings
  (20 → 24, 24 → 28, 32 → 36, 40 → 44 h; the agenda's +4 h lands at Wipe Day #10); every `more`
  small raises its stat by its own factor (×1.1-1.5); Lantern Oil II (+30% at night over a night
  Σinc of about 1.9) is +16%; Fuel Cache (+60% on the Oil Press over about 2.0) is +30%.
  Lantern Oil I sits in ring 2, where the rule does not apply.
- **Unbudgeted features**, measured by the simulator: Hot Breakfast (a 60 s ×4 Rally after 6 h
  away, about 3 minutes of output a day), Bunker Door (a drum and a crate after 24 h away, at most
  about 13 minutes of output), Night Crew (×1.0 once every hand is kept by Old Crew III; it matters
  for Skeleton Crew and Lone Wolf loadouts, which are keystones), Night Porter, Wake-up Call,
  Snooze and Shift Report (no power).

### 2.2 Conditions stack

A condition multiplies everything inside it. The linear count above adds `w × (f − 1)` per node,
but two night nodes of ×1.5 make night ×2.25, not two separate ×1.2. Bunker's non-keystone night
multiplier is about ×3.4-4.7 at ring 9 (Night Lamps, Lantern Oil I-IV, Moonshine Still, Night
Owls); the Logbook's Night Log series and Almanac add about ×7-10. Night would then be about 95%
of a late player's income. That is why Bunker stops Lantern Oil at IV, adds no rain (Tide and the
Logbook already reach about ×8 in rain), keeps its away bonus beyond the `offline` column to Cold
Storage's ×1.15, and spends the rest of its late share on all-lines smalls. See open question 1.

### 2.3 Keystones (outside the shares; the simulator row decides)

| Keystone | Gain | Downside | Target | Estimate |
| --- | --- | --- | --- | --- |
| Bunker Mentality (5.3) | `offline` ×1.5 | `flotsam_rate` ×0: no flotsam | idler | ×1.49 for the idler (about 99% of its supplies come while away), ×1.47 for the casual; the active player loses the flotsam share of its online hour |
| Graveyard Shift (8.4) | lines ×4 at night | lines ×0.5 always (×2 after dark, ×0.5 by day) | casual | `0.5 × ((1 − s) + 4s)` for night share `s`: ×1.4 at s = 0.6, ×1.9 at s = 0.95, never above ×2; the active player's daytime sessions pay half |

Bunker Mentality also stops Sealed Lockers while slotted, so it lowers its owner's own scrap a
little (1.5% of flotsam caught online, about 0.03 a day for a casual); it never raises scrap.

## 3. Series (small nodes)

| Series (`node_series.<id>`) | Stat | Members (slot: value) |
| --- | --- | --- |
| Root Cellar (`root_cellar`) | `night_shift` +4 h | 3.4: +4 h · 4.2: +4 h · 6.1: +4 h · 7.2: +4 h |
| Lantern Oil (`lantern_oil`) | `output`, `when: night` | 2.2: +10% · 3.1: +30% · 5.5: ×1.3 · 6.3: ×1.5 |
| Night Rations (`night_rations`) | `offline` ×1.1 | 5.1: ×1.1 · 6.4: ×1.1 · 7.5: ×1.1 · 8.1: ×1.1 |
| Tinned Beans (`tinned_beans`) | `output` (all lines) | 6.6: ×1.3 · 7.3: ×1.4 · 7.4: ×1.4 · 8.6: ×1.4 · 8.7: ×1.35 · 9.1: ×1.2 · 9.3: ×1.2 · 9.5: ×1.1 |
| Steel Plating (`steel_plating`) | `output` on the Sheet Metal era (`metal`) | 8.2: ×1.5 · 9.7: ×1.5 |
| One-offs (own names) | | Deep Cellars 1.2: `night_shift` +4 h (anchor) · Fuel Cache 4.4: `output` on the Oil Press (`press`) +60% |

Every small's value comes from `04` 10.2's step table for its ring. Five series and two one-offs
(04 10.1 asks for 4-6). The eleven small-to-small edges all change series (Deep Cellars →
Lantern Oil I, Lantern Oil II → Root Cellar II, Root Cellar I → Fuel Cache, Night Rations I →
Root Cellar III, Lantern Oil III → Tinned Beans I, and so on); the longest run of small nodes
along any chain is 2 (checked over the DAG).

## 4. All 45 nodes

Costs print as `fmtCount` does. "(scene)" marks a scene-changing node (`04` 2.5): the drawing is
in the JSON's `scene`. A completion (4.3, 9.4) needs every node of the previous ring; every other
node needs one of its parents. "R7 (R3 data)" means hidden until R7, in `blastmap.json5` from R3.

| Slot | Id | Type | Name | Text | Glass | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `hot_breakfast` | unlock | Hot Breakfast | Back after 6 h or more? Collect also starts a Rally: all lines ×4 for 60 s. (scene) | 2 | ground_zero | R2 |
| 1.2 | `deep_cellars` | small, anchor | Deep Cellars | Night Shift +4 h. (scene) | 1 | ground_zero | R2 |
| 2.1 | `night_lamps` | notable | Night Lamps | Lines +20% at night. Lanterns go up on every building after dusk. (scene) | 11 | hot_breakfast | R2 |
| 2.2 | `lantern_oil_1` | small | Lantern Oil I | Lines +10% at night. | 5 | hot_breakfast, deep_cellars | R2 |
| 2.3 | `insulated_walls` | notable | Insulated Walls | Night Shift +4 h. Shutters go up and the draughts stay out. (scene) | 15 | deep_cellars | R2 |
| 3.1 | `lantern_oil_2` | small | Lantern Oil II | Lines +30% at night. | 44 | night_lamps | R2 |
| 3.2 | `all_clear` | notable | All Clear | Lines +50% while Afterglow lasts. The siren winds down; the crew climb out. (scene) | 77 | night_lamps, lantern_oil_1 | R2 |
| 3.3 | `moonshine_still` | notable | Moonshine Still | Lines +1% at night per Bunker node you own, up to +10%. It's lamp fuel. Mostly. (scene) | 66 | lantern_oil_1, insulated_walls | R2 |
| 3.4 | `root_cellar_1` | small | Root Cellar I | Night Shift +4 h. | 33 | insulated_walls | R2 |
| 4.1 | `night_porter` | automation | Night Porter | Collect runs itself 3 s after the welcome-back card opens; the card stays. | 333 | lantern_oil_2 | R3 |
| 4.2 | `root_cellar_2` | small | Root Cellar II | Night Shift +4 h. | 222 | lantern_oil_2, all_clear | R3 |
| 4.3 | `snug` | completion | Snug | Lines ×1.1 while you're away. Blankets, a stove and a door that shuts. | 555 | all of ring 3 (4 nodes) | R3 |
| 4.4 | `fuel_cache` | small | Fuel Cache | Oil Presses +60%. | 444 | moonshine_still, root_cellar_1 | R3 |
| 4.5 | `banked_fires` | notable | Banked Fires | Campfires, Kilns and Furnaces ×2 at night. The fires are banked, never out. (scene) | 777 | root_cellar_1 | R3 |
| 5.1 | `night_rations_1` | small | Night Rations I | Lines ×1.1 while you're away. | 3,333 | night_porter | R3 |
| 5.2 | `night_owls` | notable | Night Owls | Lines +2% at night for each hand on shift, up to +28%. Hire before bed. | 5,555 | root_cellar_2 | R3 |
| 5.3 | `bunker_mentality` | keystone, anchor | Bunker Mentality | Lines ×1.5 while you're away. No flotsam drifts in, ever. (scene) | 7,777 | snug | R3 |
| 5.4 | `wake_up_call` | automation, gate 8 | Wake-up Call | Grit fires itself on your first visit after it is ready. | 3,333 | fuel_cache | R5 (slot reserved in R3) |
| 5.5 | `lantern_oil_3` | small | Lantern Oil III | Lines ×1.3 at night. | 2,222 | banked_fires | R3 |
| 6.1 | `root_cellar_3` | small | Root Cellar III | Night Shift +4 h. | 33,300 | night_rations_1 | R3 |
| 6.2 | `cold_storage` | notable | Cold Storage | Night Shift +4 h, and lines ×1.15 while you're away. The beans keep. (scene) | 77,700 | night_rations_1, night_owls | R3 |
| 6.3 | `lantern_oil_4` | small | Lantern Oil IV | Lines ×1.5 at night. | 22,200 | night_owls, bunker_mentality | R3 |
| 6.4 | `night_rations_2` | small | Night Rations II | Lines ×1.1 while you're away. | 44,400 | bunker_mentality, wake_up_call | R3 |
| 6.5 | `lights_out` | unlock | Lights Out | Say when you'll be back. Return within 30 min of it: the Night Shift pays ×1.1. (scene) | 44,400 | wake_up_call, lantern_oil_3 | R3 |
| 6.6 | `tinned_beans_1` | small | Tinned Beans I | Lines ×1.3. | 55,500 | lantern_oil_3 | R3 |
| 7.1 | `snooze` | automation | Snooze | 'Night Shift over' rings an hour early, while there's still time to top up. | 222,000 | root_cellar_3 | R7 (R3 data) |
| 7.2 | `root_cellar_4` | small | Root Cellar IV | Night Shift +4 h. | 333,000 | cold_storage | R7 (R3 data) |
| 7.3 | `tinned_beans_2` | small | Tinned Beans II | Lines ×1.4. | 222,000 | lantern_oil_4 | R7 (R3 data) |
| 7.4 | `tinned_beans_3` | small | Tinned Beans III | Lines ×1.4. | 444,000 | night_rations_2 | R7 (R3 data) |
| 7.5 | `night_rations_3` | small | Night Rations III | Lines ×1.1 while you're away. | 555,000 | lights_out | R7 (R3 data) |
| 7.6 | `night_crew` | unlock | Night Crew | Lines without a hand work the Night Shift at 10%. Head-torches bob all night. (scene) | 444,000 | tinned_beans_1 | R7 (R3 data) |
| 8.1 | `night_rations_4` | small | Night Rations IV | Lines ×1.1 while you're away. | 2.22M | snooze | R7 (R3 data) |
| 8.2 | `steel_plating_1` | small | Steel Plating I | Sheet Metal lines ×1.5. | 3.33M | snooze, root_cellar_4 | R7 (R3 data) |
| 8.3 | `bunk_beds` | notable | Bunk Beds | Night Shift +4 h: the window reaches 48 h, the most it gets. | 5.55M | root_cellar_4, tinned_beans_2 | R7 (R3 data) |
| 8.4 | `graveyard_shift` | keystone | Graveyard Shift | Lines ×4 at night but ×0.5 always: double after dark, half by day. (scene) | 7.77M | tinned_beans_2, tinned_beans_3 | R7 (R3 data) |
| 8.5 | `shift_report` | automation | Shift Report | The welcome-back card breaks the night down, line by line. | 2.22M | tinned_beans_3, night_rations_3 | R7 (R3 data) |
| 8.6 | `tinned_beans_4` | small | Tinned Beans IV | Lines ×1.4. | 4.44M | night_rations_3, night_crew | R7 (R3 data) |
| 8.7 | `tinned_beans_5` | small | Tinned Beans V | Lines ×1.35. | 5.55M | night_crew | R7 (R3 data) |
| 9.1 | `tinned_beans_6` | small | Tinned Beans VI | Lines ×1.2. | 22.2M | night_rations_4 | R7 (R3 data) |
| 9.2 | `dug_in` | notable | Dug In | Lines +0.5% per Bunker node you own, up to +20%. Nobody's moving us. (scene) | 77.7M | steel_plating_1 | R7 (R3 data) |
| 9.3 | `tinned_beans_7` | small | Tinned Beans VII | Lines ×1.2. | 33.3M | bunk_beds | R7 (R3 data) |
| 9.4 | `deep_sleep` | completion | Deep Sleep | Lines ×1.1 while you're away. The whole crew sleeps like logs. (scene) | 55.5M | all of ring 8 (7 nodes) | R7 (R3 data) |
| 9.5 | `tinned_beans_8` | small | Tinned Beans VIII | Lines ×1.1. | 44.4M | shift_report | R7 (R3 data) |
| 9.6 | `bunker_door` | unlock | Bunker Door | Away 24 h or more? A Fuel Drum and a Drift Crate wait at a door in the hill. (scene) | 33.3M | tinned_beans_4 | R7 (R3 data) |
| 9.7 | `steel_plating_2` | small | Steel Plating II | Sheet Metal lines ×1.5. | 55.5M | tinned_beans_5 | R7 (R3 data) |

Ring totals: 1: 3 · 2: 31 · 3: 220 · 4: 2,331 · 5: 22,220 · 6: 277,500 · 7: 2.22M · 8: 31.08M · 9: 321.9M. Whole wedge: 355.5M glass (about an eighth of `04` 3.2's ~2.9B).

**Scene-changing nodes:** rings 1-3 Hot Breakfast, Deep Cellars, Night Lamps, Insulated Walls, All
Clear, Moonshine Still; rings 4-6 Banked Fires, Bunker Mentality, Cold Storage, Lights Out; rings
7-9 Night Crew, Graveyard Shift, Dug In, Deep Sleep, Bunker Door. **First nuke:** both ring-1 nodes
cost 3 glass together (Deep Cellars is in the guided basket).

## 5. Open questions

1. **Stacked conditions (for `10-balance.md` 6.2).** The linear count understates nodes that share a
   condition: by ring 9 the tree's night multiplier is about ×25-50 (Logbook and Bunker) and rain
   about ×8 (Tide and Logbook), so night is about 95% of late income and the day hardly matters.
   Proposal: count conditions by the fold (`1 + w × (Π f − 1)` per condition, cumulatively), or cap
   each condition across the tree (for example ×4 at night and ×3 in rain, like the flotsam
   column). Bunker is already inside such a cap except for night (about ×4); Graveyard Shift is
   safe either way.
2. **Hours row.** `10-balance.md` 6.1 lists the window's hours as +4/0/+4/0/+4/+8/+4/+8 and says it
   follows 04's window plan, which is +4 in each of rings 1-8. Hours past 16 h move no simulated
   number, and following the 6.1 row literally would force three more night smalls into rings 2-4
   (about +15% over the lines budget at ring 4). This file follows 04's plan; 6.1's row should be
   corrected to match.
3. **Lone Wolf's conflicts** (Crew) should list `bunker_mentality` too, so the rebuild screen warns
   from either side.
4. **Steel Plating on Sheet Metal** is nearly free mid-game (×1.015 each). If the simulator wants
   more of Bunker's ring-8 and ring-9 share spent, the cheapest change is Steel Plating on the
   Armored era (`hqm`, ×1.49 each) with Tinned Beans IV-VIII trimmed to keep the rings at ×2.

