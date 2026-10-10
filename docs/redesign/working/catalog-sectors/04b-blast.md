# 04b Blast: the 45 nodes of the Blast sector (proposal)

Status: proposal for the owner, 2026-10-08. The data is `04b-blast.json` (45 nodes, valid JSON).
It follows `04-blast-map.md` 6.8 (the sector brief, slot table and fixed nodes), the slot template
(2.3), quotas (2.2), price ladder (3.1), waves (resolution 3.8), the keystone rule (resolution
3.13) and `10-balance.md` 6 (the budget). Names need the owner's pass. Numbers are starting values
the simulator may retune in data.

---

## 1. The sector

**Blast (`blast`): "Bigger bangs, brighter glass."** Blast owns two budget columns alone: glass
per nuke (`glass_gain`) and Glow's factor (`glow_k`). It shapes Afterglow with Grip, dresses up
the Kettle, the film and the crater, and takes a lines share from ring 5 (3.2).

| Band | Ships | What the player gets |
| --- | --- | --- |
| Rings 1-3 | R2 | More glass from every nuke (Bigger Payload, Tinfoil Hats), a stronger Glow (Glow Lamp), a slower Afterglow fade (Souvenir Jar, Warm Embers), the Forecast on the Big Red's card, and Flight School to pick the film. |
| Rings 4-6 | R3; Dead Hand R5 | Quick Rebuild, a crater that changes (Glass Garden, Crater Lake), two notables that grow as you play (Blast Radius with your Blast nodes, Glass Strata with your Wipe Days), the Hot Core keystone, Dead Hand and the Postcard Album. |
| Rings 7-9 | R7 (in data from R3, hidden) | Ash Bloom (lines join the green-sky rush), the Double Barrel twin Kettle, Glowing Bunks (a Bunker synergy), the Chain Reaction keystone, Kettle Watch, Nose Art, Second Sun and Sunburst. |

Five small-node series: **Bigger Payload** (glass), **Bright Glass** (Glow factor), **Warm Embers**
(Afterglow half-life), **Fertile Ash** (line output, growing from the gardens in ring 3 to the
Twig plots in ring 4 to every line from ring 6) and **Shockwave** (line speed).

### 1.1 Slot map (types exactly as 04 6.8)

```
r9  FA VI · Nose Art · SW VI · SECOND SUN · WE IV · Sunburst · FA VII          S U S C S N S
r8  SW IV · BP V · Glowing Bunks · <CHAIN REACTION> · Kettle Watch · FA V · SW V S S N K A S S
r7  Ash Bloom · BG II · SW II · FA IV · SW III · Double Barrel                  N S S S S U
r6  BG I · Dead Hand · FA III · SW I · Postcard Album · BP IV                   S A S S U S
r5  BP III · Blast Radius · <HOT CORE> · Glass Strata · WE III                  S N K N S
r4  Quick Rebuild · FA II · GLASS GARDEN · WE II · Crater Lake                  A S C S N
r3  BP II · Glow Lamp · Flight School · FA I                                    S N U S
r2  Forecast · WE I · Tinfoil Hats                                              A S N
r1  Souvenir Jar · Bigger Payload                                               N S
```

BP Bigger Payload, BG Bright Glass, WE Warm Embers, FA Fertile Ash, SW Shockwave; `<>` keystone,
capitals completion. Mix: 24 small, 9 notable, 2 keystone, 4 unlock, 4 automation, 2 completion.

---

## 2. Budget tracking (per ring, every lower ring lit)

Shares are `10-balance.md` 6.1 (glass, `k`) and `04-blast-map.md` 7.2 (lines; see 3.2).
Cumulative columns show Blast's running total against the budget's running total.

| Ring (opens) | `glass_gain` share → Blast | glass cumulative (budget) | `glow_k` share → Blast | `k` cumulative (budget) | Lines share → Blast | Afterglow half-life (unbudgeted) | Ring cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (#1) | ×1.10 → ×1.10 Bigger Payload (+10%) | 1.100 (1.100) | – | 0 (0) | – → none | +60 s Souvenir Jar | 5 |
| 2 (#1) | ×1.05 → ×1.045 Tinfoil Hats (+5%) | 1.150 (1.155) | +0.01 → +0.01 Tinfoil Hats | 0.01 (0.01) | – → none | +60 s WE I | 20 |
| 3 (#3) | ×1.10 → ×1.10 BP II | 1.265 (1.271) | +0.02 → +0.02 Glow Lamp | 0.03 (0.03) | – → Gardens +60% (free scope) | – | 179 |
| 4 (#5) | ×1.10 → ×1.10 Glass Garden | 1.392 (1.398) | +0.02 → +0.02 Crater Lake | 0.05 (0.05) | – → Twig era +30% (free scope) | +60 s WE II | 2,220 |
| 5 (#10) | ×1.10 → ×1.10 BP III | 1.531 (1.537) | +0.03 → +0.02 Glass Strata (at max) | 0.07 (0.08) | ×1.1 → ×1.10 Blast Radius (at max) | +90 s WE III | 23,331 |
| 6 (#20) | ×1.10 → ×1.10 BP IV | 1.684 (1.691) | +0.03 → +0.04 BG I | 0.11 (0.11) | ×1.4 → ×1.392 (FA III ×1.18, SW I ×1.18) | – | 233,100 |
| 7 (#30) | ×1.10 → ×1.10 Double Barrel | 1.852 (1.860) | +0.04 → +0.04 BG II | 0.15 (0.15) | ×1.4 → ×1.395 (SW II ×1.1, FA IV ×1.13, SW III ×1.1, Ash Bloom counted ×1.02) | – | 2.33M |
| 8 (#40) | ×1.10 → ×1.10 BP V | 2.037 (2.046) | +0.04 → +0.04 Glowing Bunks (at max) | 0.19 (0.19) | ×1.4 → ×1.392 (SW IV ×1.12, FA V ×1.12, SW V ×1.11) | – | 34.4M |
| 9 (#50) | ×1.10 → ×1.10 Sunburst | 2.241 (2.251) | +0.05 → +0.05 Second Sun | 0.24 (0.24) | ×1.4 → ×1.392 (FA VI ×1.12, SW VI ×1.12, FA VII ×1.11) | +90 s WE IV | 288.6M |
| **Sector** | **×2.241** (ceiling ×2.25) | | **0.25 → 0.49** (ceiling 0.49) | | **×4.14** (share ×4.23) | **+360 s** of the tree's +600 s | **325.6M** |

Keystones sit outside the shares (Hot Core, Chain Reaction; section 4).

### 2.1 How it was counted

- **Glass.** Rings 1-2 use `inc` (+10%, +5%), counted as the ratio of `(1 + Σinc)`; from ring 3
  every glass node is `more` ×1.1. The running product never passes the budget's.
- **Glow factor.** Additive, checked cumulatively. Ring 5 takes +0.02 of its +0.03 so the Bright
  Glass smalls keep the 10% rule. Ring 8's +0.04 sits on a notable (Glowing Bunks) instead of 04's
  Bright Glass III: a small there would add exactly 10.0% (0.04 on 0.40), a floating-point edge
  for the content check.
- **`per` effects count at their `max`:** Blast Radius ×1.1 (reached at 20 lit Blast nodes, so
  in ring 6), Glass Strata +0.02 (at Wipe Day #20), Glowing Bunks +0.04 (at 40 lit Bunker nodes,
  about #50). Early values are lower than counted.
- **Conditions:** Ash Bloom's `when: afterglow` counts at 0.02 (04 7.3), so its ×2 counts ×1.02.
  `10-balance.md` 6.2 leaves Afterglow-only effects to the simulator's N11.
- **Free scopes:** Fertile Ash I (Gardens) and II (the Twig era) count 0 under `10-balance.md`
  6.2.3 (lines 1-11 and early eras are 0 mid-game and in week 1). Under 04 7.3's older planning
  weights (a tenth) they would be ×1.06 and ×1.03: inside the +10% tolerance either way. They
  speed up run openings, which the simulator measures.
- **Afterglow half-life** (unbudgeted, ceiling 300 → 900 s over all non-keystone nodes): Blast uses
  +360 s (Souvenir Jar 60, Warm Embers 60, 60, 90, 90). Grip's Afterburn takes +120 s, which
  leaves 120 s for Grip's other notables.

### 2.2 The 10% rule (smalls from ring 3, every lower ring owned)

| Small | Gain | Small | Gain |
| --- | --- | --- | --- |
| BP II-V (glass ×1.1) | 10.0% each | WE II / III / IV | 14.3% / 15.0% / 13.0% (with Grip's Afterburn from ring 4) |
| BG I / BG II (+0.04) | 12.5% / 11.1% | FA III-VII | 18 / 13 / 12 / 12 / 11% |
| FA I / FA II | +60% on one line, +30% on one era (steps 3-4) | SW I-VI | 18 / 10 / 10 / 12 / 11 / 12% |

### 2.3 Checks run on the JSON

Ring sizes and slot types match 04 6.8; quota exact; every `requires` is the default wiring
(04 1.3), completions need their whole previous ring; at most two smalls in a row on any chain;
consecutive smalls always belong to different series; prices are on the ladder (completions at
555 and 55.5M, keystones at 7,777 and 7.77M); names at most 24 characters, texts at most 80;
`feature:*` only on unlock and automation nodes; every `per` has a `max`; scene nodes per band
3 / 2 / 5.

---

## 3. Notables, unlocks and automation: what they do

| Node | Mechanic and intent |
| --- | --- |
| Souvenir Jar (1.1) | Fixed. The run-2 rush lasts longer; a jar on the cabin shelf fills with glass, a little each Wipe Day. |
| Tinfoil Hats (2.3) | Ring 2's glass and `k` in one cheap pick. The crew wear tinfoil hats while the sky is green: a visible gag on every rebuild. |
| Glow Lamp (3.2) | Anchor: `k` 0.25 → 0.27 on its own (resolution 3.13). A green lamp on the Kettle's pad. |
| Crater Lake (4.5) | Fixed. Rain pools in the crater; a gull paddles in it. |
| Blast Radius (5.2) | Grows with the sector: every lit Blast node adds 0.5% to all lines, to ×1.1. A reason to finish Blast's inner rings. |
| Glass Strata (5.4) | Grows with play: every Wipe Day adds 0.001 to Glow's factor, to +0.02 at #20 (the ring-6 gate). |
| Ash Bloom (7.1) | Changes how a run opens: while Afterglow lasts, lines ×2, so the green-sky rush is no longer taps only. Odd glowing flowers push through the ash. |
| Glowing Bunks (8.3) | Cross-sector synergy: every lit Bunker node adds 0.001 to Glow's factor, to +0.04. |
| Sunburst (9.6) | Fixed (replaces `fourth_socket`, resolution 3.9). The mushroom cloud glows gold. |
| Forecast (2.1) | `feature:forecast`, R2. The Big Red's card adds "Counts as a Wipe Day in about 2 h 10 m at this rate". |
| Flight School (3.3) | `feature:flight_school`, R2. A row of seen flights on the cover card; the seeded one stays the default. Storm Rider still needs rain and small blasts still Fizzle, so unseen flights (Logbook pages) cannot be picked. |
| Quick Rebuild (4.1) | `feature:quick_rebuild`, R3. The postcard's Rebuild goes straight to the landing with the last loadout; "Change loadout" stays as a link. From R5 it also skips the screen after Dead Hand fires (note 3). |
| Dead Hand (6.2) | Anchor, `feature:dead_hand`, gate 25, R5. As `05-meta-layers.md` 6. |
| Postcard Album (6.5) | `feature:postcard_album`, R3. The last 20 postcards, each drawn by `postcardSvg` from its `nuked` summary. |
| Double Barrel (7.6) | `feature:double_barrel` plus ring 7's glass ×1.1. A smaller twin Kettle on the pad; the film launches both (proposal: the twin flies the same variant 300 ms behind). |
| Kettle Watch (8.5) | `feature:kettle_watch`. Adds a "Big Red crowned" notification type, off until switched on; quiet hours apply. |
| Nose Art (9.2) | `feature:nose_art`. Liveries tied to flights seen and records (shark teeth, checkers, a gull, a lightning bolt for Storm Rider); the Kettle wears the chosen one on the pad and in the film. |

### 3.1 Keystones (rule: at most ×2 for the target, a cost elsewhere; simulator rows before R3 / R7)

| Keystone | Gain | Downside | Targets | Notes |
| --- | --- | --- | --- | --- |
| Hot Core (5.3, 7,777) | glass ×1.5 (Glow grows about ×1.22 in the long run) | lines ×0.25 while Afterglow lasts | casual | `conflicts: wipe_day_rush` (60 min of lines ×0.25). Ash Bloom halves the downside (net ×0.5): its simulator row must run with and without Ash Bloom. |
| Chain Reaction (8.4, 7.77M) | `k` +0.25 (Glow about ×1.5 at `k` 0.49) | glass ×0.5 | idler | A late cash-in: strong at once, slower glass after. With Hot Core both slotted, glass is ×0.75. |

### 3.2 Scene drawings (10)

Souvenir Jar (a jar on the shelf), Tinfoil Hats (crew hats in the green sky), Glow Lamp (a lamp on
the pad, `lights`), Glass Garden (glints on the crater rim, `lights`), Crater Lake (a pool and a
gull), Ash Bloom (flowers in the ash during Afterglow), Double Barrel (the twin Kettle), Nose Art
(the livery), Second Sun (a pale second disc in the sky), Sunburst (a gold cloud in the film).

---

## 4. All 45 nodes

`requires` is OR (any one parent), except completions (AND). Costs are crater glass.

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `souvenir_jar` | notable (scene) | Souvenir Jar | Afterglow's half-life +1 min. A jar on the shelf fills with glass. | 3 | `ground_zero` | R2 |
| 1.2 | `bigger_payload` | small (anchor) | Bigger Payload | Crater glass +10% from every nuke. | 2 | `ground_zero` | R2 |
| 2.1 | `forecast` | automation (feature:forecast) | Forecast | The Big Red's card tells you when the next Wipe Day will count, at this rate. | 5 | `souvenir_jar` | R2 |
| 2.2 | `warm_embers_1` | small | Warm Embers I | Afterglow's half-life +60 s. | 4 | `souvenir_jar`, `bigger_payload` | R2 |
| 2.3 | `tinfoil_hats` | notable (scene) | Tinfoil Hats | Glow factor +0.01 and crater glass +5%. The crew swear by them. | 11 | `bigger_payload` | R2 |
| 3.1 | `bigger_payload_2` | small | Bigger Payload II | Crater glass ×1.1. | 33 | `forecast` | R2 |
| 3.2 | `glow_lamp` | notable (anchor; scene) | Glow Lamp | Glow factor +0.02. A green lamp glows on the Kettle's pad. | 77 | `forecast`, `warm_embers_1` | R2 |
| 3.3 | `flight_school` | unlock (feature:flight_school) | Flight School | Pick the missile's flight on the cover card, from the flights you've seen. | 44 | `warm_embers_1`, `tinfoil_hats` | R2 |
| 3.4 | `fertile_ash_1` | small | Fertile Ash I | Gardens +60%. | 25 | `tinfoil_hats` | R2 |
| 4.1 | `quick_rebuild` | automation (feature:quick_rebuild) | Quick Rebuild | Rebuild in one tap: skip the rebuild screen and keep your last loadout. | 333 | `bigger_payload_2` | R3 |
| 4.2 | `fertile_ash_2` | small | Fertile Ash II | Twig lines +30%. | 222 | `bigger_payload_2`, `glow_lamp` | R3 |
| 4.3 | `glass_garden` | completion (scene) | Glass Garden | Crater glass ×1.1. Glass shards glitter in the crater. | 555 | all of ring 3 (AND) | R3 |
| 4.4 | `warm_embers_2` | small | Warm Embers II | Afterglow's half-life +60 s. | 333 | `flight_school`, `fertile_ash_1` | R3 |
| 4.5 | `crater_lake` | notable (scene) | Crater Lake | Glow factor +0.02. Rain pools in the crater; the gulls approve. | 777 | `fertile_ash_1` | R3 |
| 5.1 | `bigger_payload_3` | small | Bigger Payload III | Crater glass ×1.1. | 3,333 | `quick_rebuild` | R3 |
| 5.2 | `blast_radius` | notable | Blast Radius | All lines +0.5% for every lit Blast node, up to ×1.1. | 5,555 | `fertile_ash_2` | R3 |
| 5.3 | `hot_core` | keystone (conflicts wipe_day_rush) | Hot Core | Crater glass ×1.5, but lines run at a quarter while Afterglow lasts. | 7,777 | `glass_garden` | R3 |
| 5.4 | `glass_strata` | notable | Glass Strata | Glow factor +0.001 for every Wipe Day, up to +0.02. | 4,444 | `warm_embers_2` | R3 |
| 5.5 | `warm_embers_3` | small | Warm Embers III | Afterglow's half-life +90 s. | 2,222 | `crater_lake` | R3 |
| 6.1 | `bright_glass_1` | small | Bright Glass I | Glow factor +0.04. | 44,400 | `bigger_payload_3` | R3 |
| 6.2 | `dead_hand` | automation (anchor; feature:dead_hand; gate 25) | Dead Hand | An opt-in switch that presses the Big Red for you while the page is open. | 22,200 | `bigger_payload_3`, `blast_radius` | R5 |
| 6.3 | `fertile_ash_3` | small | Fertile Ash III | All lines ×1.18. | 33,300 | `blast_radius`, `hot_core` | R3 |
| 6.4 | `shockwave_1` | small | Shockwave I | All lines run 18% faster. | 33,300 | `hot_core`, `glass_strata` | R3 |
| 6.5 | `postcard_album` | unlock (feature:postcard_album) | Postcard Album | Your last 20 postcards, each with a snapshot of the island you flattened. | 44,400 | `glass_strata`, `warm_embers_3` | R3 |
| 6.6 | `bigger_payload_4` | small | Bigger Payload IV | Crater glass ×1.1. | 55,500 | `warm_embers_3` | R3 |
| 7.1 | `ash_bloom` | notable (scene) | Ash Bloom | While Afterglow lasts, every line ×2. Odd flowers push up through the ash. | 555,000 | `bright_glass_1` | R7 |
| 7.2 | `bright_glass_2` | small | Bright Glass II | Glow factor +0.04. | 444,000 | `dead_hand` | R7 |
| 7.3 | `shockwave_2` | small | Shockwave II | All lines run 10% faster. | 222,000 | `fertile_ash_3` | R7 |
| 7.4 | `fertile_ash_4` | small | Fertile Ash IV | All lines ×1.13. | 333,000 | `shockwave_1` | R7 |
| 7.5 | `shockwave_3` | small | Shockwave III | All lines run 10% faster. | 333,000 | `postcard_album` | R7 |
| 7.6 | `double_barrel` | unlock (scene; feature:double_barrel) | Double Barrel | A twin Kettle joins the pad: crater glass ×1.1, and the film launches both. | 444,000 | `bigger_payload_4` | R7 |
| 8.1 | `shockwave_4` | small | Shockwave IV | All lines run 12% faster. | 2.22M | `ash_bloom` | R7 |
| 8.2 | `bigger_payload_5` | small | Bigger Payload V | Crater glass ×1.1. | 5.55M | `ash_bloom`, `bright_glass_2` | R7 |
| 8.3 | `glowing_bunks` | notable | Glowing Bunks | Glow factor +0.001 for every lit Bunker node, up to +0.04. | 9.99M | `bright_glass_2`, `shockwave_2` | R7 |
| 8.4 | `chain_reaction` | keystone | Chain Reaction | Glow factor +0.25, but every nuke pays half the glass. | 7.77M | `shockwave_2`, `fertile_ash_4` | R7 |
| 8.5 | `kettle_watch` | automation (feature:kettle_watch) | Kettle Watch | A notification when the Big Red is crowned, if you switch it on. | 3.33M | `fertile_ash_4`, `shockwave_3` | R7 |
| 8.6 | `fertile_ash_5` | small | Fertile Ash V | All lines ×1.12. | 3.33M | `shockwave_3`, `double_barrel` | R7 |
| 8.7 | `shockwave_5` | small | Shockwave V | All lines run 11% faster. | 2.22M | `double_barrel` | R7 |
| 9.1 | `fertile_ash_6` | small | Fertile Ash VI | All lines ×1.12. | 22.2M | `shockwave_4` | R7 |
| 9.2 | `nose_art` | unlock (scene; feature:nose_art) | Nose Art | Paint the missile in a livery earned from your flights and records. | 33.3M | `bigger_payload_5` | R7 |
| 9.3 | `shockwave_6` | small | Shockwave VI | All lines run 12% faster. | 33.3M | `glowing_bunks` | R7 |
| 9.4 | `second_sun` | completion (scene) | Second Sun | Glow factor +0.05. A pale second sun hangs over the island. | 55.5M | all of ring 8 (AND) | R7 |
| 9.5 | `warm_embers_4` | small | Warm Embers IV | Afterglow's half-life +90 s. | 22.2M | `kettle_watch` | R7 |
| 9.6 | `sunburst` | notable (scene) | Sunburst | Crater glass ×1.1. The mushroom cloud glows gold. | 77.7M | `fertile_ash_5` | R7 |
| 9.7 | `fertile_ash_7` | small | Fertile Ash VII | All lines ×1.11. | 44.4M | `shockwave_5` | R7 |

The JSON adds three keys from `09-architecture.md` 8.2's node schema beyond the requested shape:
`series` on series members, `gate: 25` on `dead_hand` and `conflicts` on `hot_core`.

---

## Open questions

1. **Blast's lines share is a trade.** `10-balance.md` 6.3's table gives Blast no `output`; 04 7.2
   gives it ×1.1 in ring 5 and ×1.4 in rings 6-9 (Works ×6.5 instead of ×22, the rest to Grip,
   Tide, Blast and Scrapyard; ring products ×10.2 and ×1,013). 10-balance 6.3 allows such a trade
   when the ring's product holds, so this file records 04 7.2 as the trade. Without it, rings 6-9
   cannot be filled within budget: four smalls a ring, and at most one glass and one `k` small fit.
2. **`speed` needs a steps row.** Content check 11 takes a small's value from `steps`, and 04 10.2
   has no `speed` row. Proposal: `speed.more` uses the `output` all-lines row (×1.1-1.3 in ring
   5, ×1.1-1.5 in rings 6-9), as `10-balance.md` 6.2.4 counts speed as output.
3. **Autopilot.** `05-meta-layers.md` 6 names "Autopilot (Blast ring 8, R7)" to skip the rebuild
   screen after Dead Hand. Ring 8's one automation slot is Kettle Watch (04 6.8). Proposal: Quick
   Rebuild (4.1) covers it, because Dead Hand's rebuild is a rebuild; 05 drops the name.
4. **Bright Glass III became Glowing Bunks** (2.1). 04 6.8's "Bright Glass I-III (rings 6-8)" reads
   "I-II (rings 6-7) and a ring-8 notable".
5. **The Afterglow half-life ceiling is shared.** Blast takes +360 s and Grip's Afterburn +120 s; the
   Grip catalog has 120 s left before the 900 s ceiling.
6. **Bright Glass II's only parent is Dead Hand** (ring 7 goes straight up). Dead Hand's gate (25)
   is below ring 7's (#30), so it never blocks; a `links` edge from 6.1 would make three smalls in
   a row (5.1, 6.1, 7.2), so none is added.
7. **Kettle Watch** needs the crown moment in `nextEventAt` (`09-architecture.md` 4.7) for crown
   rules 3 and 4 (rate below 80% of the peak; a 20-hour run), computed on the server like the
   Night Shift's end.
8. **Nose Art's liveries** are data (proposal: `prestige.json5` `liveries`, each tied to a flight
   seen or a record from R2), each a small procedural paint layer on the Kettle drawing.
