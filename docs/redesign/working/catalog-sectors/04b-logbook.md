# 04b Logbook sector: "Write it down; it pays" (proposal)

The 45 nodes of the Logbook wedge of the Blast Map. Data: `04b-logbook.json` (this file is the
readable copy). Names are proposals for the owner's pass; numbers are starting values the
simulator may retune in data. Read with `04-blast-map.md` 6.9 (the brief), `10-balance.md` 6 (the
budget, authoritative) and `05-meta-layers.md` 1 (pages, Morale, secrets, hints).

## 1. The sector

- **Rings 1-3 (R2): history.** The Wipe Day count (Tally Wall), records (Personal Best), rain and
  night (Weather Log, Almanac, Night Log), early-era know-how (Crib Notes) and a shelf that grows
  with the wedge itself (Bookshelf). Nothing here needs the Logbook system, so wave 1 ships whole.
- **Rings 4-6 (R3/R4): pages become power.** Old Maps and War Stories (the legacy perk ids), the
  Morale smalls, Page Turner, Dog-eared Pages, Bottle Reader and the first keystone, Tall Tales.
- **Rings 7-9 (R7): the long haul.** Hint Lamp, Treasure Map and Full Log close the secrets loop;
  Double Dare and Dare Ledger carry the Dares; Rainy Day Fund makes rain a payday; Archivist is the
  idler's keystone; Postcard Pen lets a player sign the news.

There are no canon 6.7 anchors in this wedge. `war_stories` and `old_maps` reuse legacy perk ids,
so their `perk.*` locale keys move to `node.*` and keep the id.

**Fields beyond the brief's list:** `series` on series smalls (`04` 9.1), `gate` on the two Dare
nodes (Dares at Wipe Day #5; the ring gate #30/#40 binds first), `conflicts` on keystones, and
`data_from` on rings 7-9 (the build in which the hidden node joins `blastmap.json5`: R3 unless its
system ships later, `04` 1.4). Feature effects carry their one parameter in `value`
(`personal_best`: the +15%; `tall_tales`: the ×5 cap); every other feature uses 1.

### 1.1 Changes from `04-blast-map.md` 6.9, and why

| Node or rule | 04 draft | Here | Reason |
| --- | --- | --- | --- |
| Lines shares | ×1.2, 1.1, 1.1, 1.1, 1.3, 2.5 … | ×1.13, 1.17, 1.17, 1.1, 1.4, 2.8 … | `10-balance.md` 6.3 replaces 04 section 7 |
| Old Plans (`era_cost`) | smalls in rings 1-4 | rings 5 and 8 only | `10-balance.md` 6.1 gives `era_cost` no budget before ring 4 ("never earlier") |
| Rings 1-3 smalls | Old Plans | Night Log (`night`) and Crib Notes (one early era) | inside the share; early-era scopes are nearly free (`10-balance.md` 6.2.3) |
| Well Read | eras ×0.85 | eras ×0.9 | ring 4's `era_cost` budget is ×0.9 |
| Tally Wall | +2% a Wipe Day to +20% | +1% to +10% | `10-balance.md` 6.6 (+13%), trimmed to fit Night Log I beside it |
| Personal Best | lines ×1.1 | +15% | `10-balance.md` 6.6 |
| Long Memory | +1% a Wipe Day to +10% | +0.5% to +10% | same cap, reached at #20, so it is not a copy of Tally Wall |
| Full Log | Morale ×1.5 | Morale ×1.25 | 04 4.2's `morale` ceiling is ×1.5 over all nodes; Dog-eared takes ×1.2 |
| Field Notes | slot 6.1 | slot 6.3 | Margin Notes (5.1) → 6.1 would be two Morale smalls in a row (soft rule) |
| Field Guide | every page shows its bar | bars on every page, best try on timed ones | `05` 1.3 already gives counter pages bars; event pages had none |
| Tall Tales | Morale ×3 on taps; Morale no longer on lines | while Hustle runs: lines lose Morale, taps get it twice (≤ ×5) | the draft cost every archetype more than it paid (offline is 85-99% of supplies, `10-balance.md` 6.2), so nobody would slot it |
| Double Dare | "both to be met" | both rules apply; each goal pays its own reward | the draft's wording was ambiguous; this is the friendlier reading |

**Trade recorded:** `10-balance.md` 6.3 names Scrapyard as the owner of `era_cost`, but the 04
briefs give every era node to the Logbook and none to Scrapyard. The Logbook uses the column here
(×0.9 in rings 4, 5 and 8: ×0.73 against the column's ×0.53). If Scrapyard writes `era_cost`
nodes too, the two must split the column.

## 2. Budget tracking (`10-balance.md` 6)

**How nodes are counted:** `inc` as `1 + v` (an upper bound for the Σinc ratio check); `when:
night` at 0.1 in rings 1-3 and 0.4 from ring 4; `rain` at 0.2; `per` effects at their `max`; scope
weights in week 1 (rings 1-3): Twig 0.01, Timber 0.03, Stone 0.15; mid-game (ring 4 on): eras
before Sheet Metal 0. Personal Best counts at half its value, as 10-balance 6.6 counts a
past-the-record bonus (×2 counted ×1.5). `morale` (`more`) counts in `output`. Keystones sit
outside. Glass, Glow, taps, hours, offline, flotsam and the shelf: no Logbook node touches them.

| Ring | `output` share | used | cumulative share | cumulative used | `era_cost` budget (cum.) | used (cum.) | `morale_per` budget (cum.) | used (cum.) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ×1.13 | ×1.128 (Tally Wall 1.10 · Night Log I 1.025) | ×1.13 | ×1.128 | – | – | – | – |
| 2 | ×1.17 | ×1.142 (Personal Best 1.075 · Crib Notes I 1.003 · Weather Log 1.06) | ×1.32 | ×1.29 | – | – | – | – |
| 3 | ×1.17 | ×1.167 (Crib Notes II 1.009 · Almanac 1.03 · Bookshelf 1.09 · Night Log II 1.03) | ×1.55 | ×1.50 | – | – | – | – |
| 4 | ×1.1 | ×1.10 (Long Memory 1.10 · Crib Notes III 1.0) | ×1.70 | ×1.65 | ×0.90 | ×0.90 (Well Read) | +0.005 | +0.005 (War Stories) |
| 5 | ×1.4 | ×1.40 (Page Turner) | ×2.38 | ×2.31 | ×0.81 | ×0.81 (Old Plans I) | +0.010 | +0.010 (Margin Notes) |
| 6 | ×2.8 | ×2.70 (Ship's Log I 1.35 · Dog-eared 1.2 · Night Log III 1.28 · Sea Stories I 1.3) | ×6.67 | ×6.24 | ×0.73 | ×0.81 | +0.015 | +0.015 (Field Notes) |
| 7 | ×2.8 | ×2.59 (Night Log IV 1.28 · Ship's Log II 1.35 · Sea Stories II 1.5) | ×18.7 | ×16.2 | ×0.66 | ×0.81 | +0.020 | +0.020 (Pressed Flowers) |
| 8 | ×2.8 | ×2.70 (Ship's Log III 1.35 · Rainy Day Fund 1.28 · Night Log V 1.2 · Sea Stories III 1.3) | ×52.3 | ×43.6 | ×0.59 | ×0.73 (Old Plans II) | +0.025 | +0.020 |
| 9 | ×2.8 | ×2.72 (Sea Stories IV 1.3 · Full Log 1.25 · Night Log VI 1.24 · Ship's Log IV 1.35) | ×146 | ×119 | ×0.53 | ×0.73 | +0.030 | +0.030 (Bound Volume) |

- Every ring sits at or under its share, and every running total stays under the budget's
  running total, so nothing arrives early. The sector delivers ×119 of its ×146 (81%).
- **Ceilings:** `morale` ×1.2 × ×1.25 = ×1.5 (the ceiling exactly); `morale_per` 0.02 → 0.05
  exactly; `era_cost` ×0.73 (floor ×0.5).
- **Sensitivity:** if the check counts Personal Best at full value, ring 2 reads ×1.22 (4.5% over
  the share, inside the check's +10%) and the running total through ring 3 is 3.9% over. If ring 4
  is counted with week-1 era weights, Crib Notes III reads ×1.045 and ring 4 ×1.15 (4.1% over;
  running total 1.2% over). Either fix is a value change in data: Personal Best +10%, or Crib Notes
  III on Timber.

## 3. Series (small nodes)

| Series (`node_series.<id>`) | Stat | Members (slot: value) |
| --- | --- | --- |
| Night Log (`night_log`) | `output`, `when: night` | 1.2: +25% · 3.4: +30% · 6.4: ×1.7 · 7.3: ×1.7 · 8.6: ×1.5 · 9.5: ×1.6 |
| Crib Notes (`crib_notes`) | `output` on one early era | 2.2: Twig +25% · 3.1: Timber +30% · 4.4: Stone +30% |
| Old Plans (`old_plans`) | `era_cost` | 5.5: ×0.9 · 8.2: ×0.9 |
| Ship's Log (`ships_log`) | `output`, `per: nukes` | 6.1, 7.4, 8.1, 9.7: +2% a Wipe Day, max ×1.35 |
| Sea Stories (`sea_stories`) | `output` (all lines) | 6.6: ×1.3 · 7.5: ×1.5 · 8.7: ×1.3 · 9.3: ×1.3 |
| Morale one-offs (own names, `05` 1.4) | `morale_per` | War Stories 4.2, Margin Notes 5.1, Field Notes 6.3, Pressed Flowers 7.2: +0.005 · Bound Volume 9.1: +0.010 |

Every small's value comes from `04` 10.2's step table for its ring, and each raises its own stat
and scope by at least 10% over the lower rings. The eleven small-to-small edges all change series
(Night Log → Crib Notes at 1.2 → 2.2, Crib Notes → War Stories at 3.1 → 4.2, and so on). The
longest run of small nodes along any chain is 2.

## 4. All 45 nodes

Costs print as `fmtCount` does. "R4 data" means a hidden ring 7-9 node that joins the file in R4.
A completion (4.3, 9.4) needs every node of the previous ring; every other node needs one parent.

| Slot | Id | Type | Name | Text | Glass | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `tally_wall` | notable | Tally Wall | Lines +1% a Wipe Day, up to +10%. Somebody keeps score on the cabin wall. (scene) | 3 | ground_zero | R2 |
| 1.2 | `night_log_1` | small | Night Log I | Lines +25% at night. | 1 | ground_zero | R2 |
| 2.1 | `personal_best` | unlock | Personal Best | Beat your last run's supplies made: the bell rings, lines +15% for the run. (scene) | 7 | tally_wall | R2 |
| 2.2 | `crib_notes_1` | small | Crib Notes I | Twig lines +25%. | 4 | tally_wall, night_log_1 | R2 |
| 2.3 | `weather_log` | notable | Weather Log | Lines +30% in rain. Today's entry: 'Wet. Again.' | 11 | night_log_1 | R2 |
| 3.1 | `crib_notes_2` | small | Crib Notes II | Timber lines +30%. | 33 | personal_best | R2 |
| 3.2 | `almanac` | notable | Almanac | Lines +30% at night. The crew know when dark falls and work to it. | 66 | personal_best, crib_notes_1 | R2 |
| 3.3 | `bookshelf` | notable | Bookshelf | Lines +1.5% per Logbook node you own, up to +9%. The shelf sags a bit. (scene) | 99 | crib_notes_1, weather_log | R2 |
| 3.4 | `night_log_2` | small | Night Log II | Lines +30% at night. | 44 | weather_log | R2 |
| 4.1 | `old_maps` | unlock | Old Maps | Secret hints show now, not at Wipe Day #15. Pinned up with a knife. (scene) | 333 | crib_notes_2 | R4 |
| 4.2 | `war_stories` | small | War Stories | Morale per page +0.005 (0.02 to 0.025). | 222 | crib_notes_2, almanac | R4 |
| 4.3 | `well_read` | completion | Well Read | Eras cost ×0.9. Somebody finally read the instructions. | 555 | all of ring 3 | R3 |
| 4.4 | `crib_notes_3` | small | Crib Notes III | Stone lines +30%. | 444 | bookshelf, night_log_2 | R3 |
| 4.5 | `long_memory` | notable | Long Memory | Lines +0.5% a Wipe Day, up to +10%. Nobody forgets a good blast. | 777 | night_log_2 | R3 |
| 5.1 | `margin_notes` | small | Margin Notes | Morale per page +0.005. | 3,333 | old_maps | R4 |
| 5.2 | `page_turner` | notable | Page Turner | Lines +0.4% for every Logbook page, up to ×1.4. Nobody can put it down. | 9,999 | war_stories | R4 |
| 5.3 | `tall_tales` | keystone | Tall Tales | While Hustle runs, lines lose Morale and taps get it twice (up to ×5 more). (scene) | 7,777 | well_read | R4 |
| 5.4 | `field_guide` | automation | Field Guide | Every page shows how close you are: bars on all, best tries on timed ones. | 2,222 | crib_notes_3 | R4 |
| 5.5 | `old_plans_1` | small | Old Plans I | Eras cost ×0.9. | 2,222 | long_memory | R4 |
| 6.1 | `ships_log_1` | small | Ship's Log I | Lines +2% a Wipe Day, up to ×1.35. | 33,300 | margin_notes | R4 |
| 6.2 | `dog_eared` | notable | Dog-eared Pages | Morale ×1.2. The good pages fall open on their own. | 55,500 | margin_notes, page_turner | R4 |
| 6.3 | `field_notes` | small | Field Notes | Morale per page +0.005. | 22,200 | page_turner, tall_tales | R4 |
| 6.4 | `night_log_3` | small | Night Log III | Lines ×1.7 at night. | 44,400 | tall_tales, field_guide | R4 |
| 6.5 | `bottle_reader` | unlock | Bottle Reader | A Message in a Bottle names a secret's answer, not just its hint. | 44,400 | field_guide, old_plans_1 | R4 |
| 6.6 | `sea_stories_1` | small | Sea Stories I | Lines ×1.3. | 33,300 | old_plans_1 | R4 |
| 7.1 | `hint_lamp` | automation | Hint Lamp | With nothing crowned, the advisor points at your nearest unfound page. | 333,000 | ships_log_1 | R7 (R4 data) |
| 7.2 | `pressed_flowers` | small | Pressed Flowers | Morale per page +0.005. | 222,000 | dog_eared | R7 (R4 data) |
| 7.3 | `night_log_4` | small | Night Log IV | Lines ×1.7 at night. | 333,000 | field_notes | R7 |
| 7.4 | `ships_log_2` | small | Ship's Log II | Lines +2% a Wipe Day, up to ×1.35. | 444,000 | night_log_3 | R7 |
| 7.5 | `sea_stories_2` | small | Sea Stories II | Lines ×1.5. | 555,000 | bottle_reader | R7 |
| 7.6 | `double_dare` | unlock, gate 5 | Double Dare | Take two Dares in one run: both rules apply, each goal pays its reward. (scene) | 444,000 | sea_stories_1 | R7 (R7 data) |
| 8.1 | `ships_log_3` | small | Ship's Log III | Lines +2% a Wipe Day, up to ×1.35. | 3.33M | hint_lamp | R7 |
| 8.2 | `old_plans_2` | small | Old Plans II | Eras cost ×0.9. | 2.22M | hint_lamp, pressed_flowers | R7 |
| 8.3 | `rainy_day_fund` | notable | Rainy Day Fund | Lines ×2.4 in rain. Bad weather, good business. (scene) | 9.99M | pressed_flowers, night_log_4 | R7 |
| 8.4 | `archivist` | keystone | Archivist | Morale ×2. Taps ×0.25: someone has to copy the Logbook out by hand. (scene) | 7.77M | night_log_4, ships_log_2 | R7 (R4 data) |
| 8.5 | `dare_ledger` | automation, gate 5 | Dare Ledger | Rebuild picks your last unfinished Dare again. Change it if you like. | 2.22M | ships_log_2, sea_stories_2 | R7 (R7 data) |
| 8.6 | `night_log_5` | small | Night Log V | Lines ×1.5 at night. | 4.44M | sea_stories_2, double_dare | R7 |
| 8.7 | `sea_stories_3` | small | Sea Stories III | Lines ×1.3. | 5.55M | double_dare | R7 |
| 9.1 | `bound_volume` | small | Bound Volume | Morale per page +0.010 (0.04 to 0.05). | 44.4M | ships_log_3 | R7 (R4 data) |
| 9.2 | `treasure_map` | unlock | Treasure Map | Once a week an X turns up on the island. Dig: one secret's answer. (scene) | 33.3M | old_plans_2 | R7 (R4 data) |
| 9.3 | `sea_stories_4` | small | Sea Stories IV | Lines ×1.3. | 33.3M | rainy_day_fund | R7 |
| 9.4 | `full_log` | completion | Full Log | Morale ×1.25. The first Logbook is full; volume two is started. | 55.5M | all of ring 8 | R7 (R4 data) |
| 9.5 | `night_log_6` | small | Night Log VI | Lines ×1.6 at night. | 22.2M | dare_ledger | R7 |
| 9.6 | `postcard_pen` | unlock | Postcard Pen | Write one line on each postcard (40 characters). It posts with the news. | 33.3M | night_log_5 | R7 |
| 9.7 | `ships_log_4` | small | Ship's Log IV | Lines +2% a Wipe Day, up to ×1.35. | 44.4M | sea_stories_3 | R7 |

**Mix:** 24 small, 8 notable, 2 keystone, 6 unlock, 3 automation, 2 completion (04 2.2 exactly).
**Waves:** 9 nodes in R2; 3 in R3 (4.3-4.5); 13 in R4 (Old Maps, War Stories, rings 5-6), which
is the 13 that `04` 1.4 counts; 20 in R7. Wave 1 uses one feature (Personal Best, already in
04 2.4's seven). **Glass:** 4 / 22 / 242 / 2,331 / 25,553 / 233,100 / 2.33M / 35.5M / 266M per
ring, 304.5M for the wedge.

**Paths:** Tall Tales from nothing is both ring-1 nodes, Personal Best, Weather Log, all of ring 3,
Well Read and the keystone: 10 nodes, 8,596 glass. Archivist's cheapest path is Night Log I, Crib
Notes I, Almanac, War Stories, Page Turner, Field Notes, Night Log IV and the keystone: 8 nodes,
about 8.14M.

## 5. The mechanics that are not small

- **Tally Wall, Long Memory, Ship's Log:** history pays. Every counted Wipe Day adds, so a casual
  who nukes once a day feels them grow; the caps keep them inside the budget.
- **Personal Best** (`feature:personal_best`): the run summary already records supplies made. When
  this run passes the last one, the bell on the post rings, a toast says "Personal best: lines
  +15% for the rest of the run", and the bonus holds until the nuke. It turns the back half of
  every run into a small goal.
- **Bookshelf:** the wedge rewards itself, a book on the shelf per Logbook node (up to 9 drawn).
- **Page Turner:** pages pay twice, once through Morale and once here, up to ×1.4 at 100 pages.
- **Rainy Day Fund:** rain becomes the island's payday, offline included (settle splits at weather
  blocks, `09` 4.2), and the tarps over the lines tell the player why the number jumped.
- **Field Guide, Hint Lamp, Bottle Reader, Treasure Map, Old Maps:** the secrets ladder, from a
  hint early, to the answer from a bottle, to the advisor pointing, to a weekly dig.
- **Postcard Pen:** one line of the player's own words on the postcard and in the news ("Back by
  lunch. Probably."). It is plain text on a private server; the owner can clear it from the admin
  page (R7).

### 5.1 Keystones: what the simulator row must show (`10-balance.md` 6.5)

| Keystone | Targets | Gain | Cost elsewhere | Expected row |
| --- | --- | --- | --- | --- |
| Tall Tales (5.3, `feature:tall_tales`) | active | while Hustle runs, taps take Morale a second time, capped at ×5 | while Hustle runs, lines lose Morale; a weak tapper (casual, about 4 taps/s with few Grip nodes) earns less while tapping than without it | active about ×1.0 at Morale ×2-3, rising to about ×1.1-1.4 overall; it never pays offline or while idle, so the casual and idler gain nothing |
| Archivist (8.4) | idler | Morale ×2 | taps ×0.25 (×0.5 net), so the wipe-day rush and tap-heavy play shrink | idler ×2.0, at the rule's limit (if over, Morale ×1.8); flag: casual and active also gain about ×1.8, so its cost is lost play style, not income |

- `tall_tales` conflicts with `archivist`. `archivist` conflicts with `tall_tales`, `lone_wolf` and
  `fever_pitch` (taps ×0.25 hollows all three). The rebuild screen warns and never blocks.
- Tall Tales' downside lives inside its feature, so content check 5 ("an effect that lowers a stat
  or turns something off") must accept a feature that names its downside in the blurb.
- Both scenes draw only while the keystone is slotted.

## 6. Scene drawings (one per node, registered under its id)

| Node | Drawing |
| --- | --- |
| `tally_wall` | scratch marks on the cabin wall, struck through in fives, up to 50 |
| `personal_best` | a ship's bell on a post by the cabin; it swings and clangs when the record falls |
| `bookshelf` | a crooked plank shelf by the cabin door, one battered book per Logbook node (up to 9) |
| `old_maps` | a stained map pinned to the cabin wall with a knife |
| `tall_tales` | while Hustle runs, the crew down tools at the fire and act out your swings, arms wide |
| `double_dare` | two flags on the crater sign while two Dares run |
| `rainy_day_fund` | tarps over every line in rain; a dented RAINY DAY tin on the porch |
| `archivist` | a desk on the porch, a crew member in cracked spectacles copying the Logbook by lantern |
| `treasure_map` | a chalk X somewhere on the island once a week; tapped, a crew member digs up a tin box |

Bands: rings 1-3 three, rings 4-6 two, rings 7-9 four (`04` 2.5's rule needs one each).

## Open questions

1. **`era_cost` owner.** `10-balance.md` 6.3 gives it to Scrapyard; `04`'s briefs give its nodes
   to the Logbook. This file uses it (section 1.1); the orchestrator should name one owner.
2. **Personal Best's weight.** Counted at half (10-balance 6.6's ratio). If the check counts it in
   full, ring 2 is 4.5% over its share (inside +10%); the fix is +10%.
3. **Week-1 scope weights** for Twig, Timber and Stone (0.01 / 0.03 / 0.15) are this file's
   estimates from "Sheet Metal 0.83"; `10-balance.md` should publish them (04's open question 2).
4. **Tall Tales** departs from 04 6.1's shape (section 1.1). If the owner prefers the original,
   it needs a far larger tap gain to be worth slotting, which breaks `c` harder than Lone Wolf.
5. **Archivist** is near-dominant under offline-heavy play, like several other `×2`-class
   keystones; its row decides whether the downside should be harder (for example taps ×0.1, or
   "no Afterglow").
6. **Check 15 and Dare gates.** `04` gives Double Dare and Dare Ledger gate 5 while their rings open
   at #30 and #40; check 15 as written wants a node's gate at least its ring's gate. This file
   keeps 5 (the system's count) and reads the effective gate as the larger of the two.
