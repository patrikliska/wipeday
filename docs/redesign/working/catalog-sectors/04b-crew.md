# 04b Crew (`crew`): "Every line has a name on it" (proposal)

The 45 nodes of the Crew sector of the Blast Map. Data: `04b-crew.json` (same folder). Everything
is a proposal for the owner; names need the owner's pass; numbers are starting values the
simulator may move in data. Structure, slot template, prices and checks are `04-blast-map.md`;
the budget is `10-balance.md` section 6; the systems are `02-the-run.md` (hands), `03-the-big-red.md`
(rebuild, agenda) and `05-meta-layers.md` (Foreman, ranks).

## The sector in one paragraph

Crew is the "hire, then keep" sector. Rings 1-3 make the first hands cheap and keep Mara, Dax and
then hands 1-6 through every Wipe Day. Rings 4-6 hire in bulk (Roll Call), add a once-a-run
Pay Day bell, keep every hand by ring 6, and turn the crew into a lines multiplier (Bunkhouse,
Crew Charter). Rings 7-9 are the crew's legend: hands that bring their kit (Standing Crew,
Lifers), a second hand on every line (Relief Crew), and a crew photo that pushes every run until
it beats your best. The two keystones pull against the Old Crews: **Skeleton Crew** (five hands,
free, ×2) and **Lone Wolf** (no hands at all, taps ×50).

Series (small nodes, `node_series.<id>`): **Fair Pay** (`hand_cost`), **Work Gang** (`output` on
one era), **Crew Kit** (`start_owned`, lines 4-5), **Crew Spirit** (`output` `per: hands`),
**Square Meals** (`output` on all lines). Five series, 22 smalls.

## 1. Budget tracking

Counting follows `10-balance.md` 6.2: `per` effects at their `max` (`per: hands` at 14 hands),
`afterglow` at 0.02, era scopes at their mid-game share of income (Armored 0.97; Twig and Timber 0;
Stone 0.01 at ring 4's typical state), `speed` on all lines as `output`. Feature nodes count at
their cap: Pay Day ×1.02 (5 min of ×3 once in a 6-hour active run; ×1.007 for the casual), Crew
Photo ×1.4 (its cap, as if a run never beats the photo), Relief Crew ×1.5. Crew's `inc` nodes are
counted against Crew's own Σinc, which overstates them (the tree's other `inc` nodes dilute them),
so the column is conservative. Keystones sit outside the budget (keystone rule, 6.1 below).

**Two sources disagree on Crew's lines share.** `10-balance.md` 6.3 (authoritative; it replaces
04 section 7) gives r2 ×1.1, r4 ×1.1, r5 ×1.6, r6-9 ×4. `04-blast-map.md` 6.4 / 7.2 gives
r2 ×1.05, r3 ×1.1, r5 ×1.5, r6-9 ×4.4. This catalog stays inside **both**: per ring within +10%
of each, and cumulatively under each.

| Ring (opens) | Lines share 10-bal / 04 | Crew lines, this ring (what) | Running product: catalog / 10-bal / 04 | Hand prices share | This ring (what) | Running: catalog / budget | Unbudgeted (6.4 schedule, automation) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (#1) | – / – | ×1.00 | 1.00 / 1.00 / 1.00 | ×0.95 | ×0.95 (Fair Pay I) | 0.950 / 0.950 | Mara kept (Old Friends) |
| 2 (#1) | ×1.1 / ×1.05 | ×1.05 (Pep Talk +5%, +0.1% Afterglow; Work Gang I is Twig only, ×1.00) | 1.05 / 1.10 / 1.05 | ×0.9 | ×0.9 (Hiring Board) | 0.855 / 0.855 | Dax kept (Hiring Board) |
| 3 (#3) | – / ×1.1 | ×1.048 (Fair Wages +5%; Work Gang II Timber, ×1.00) | 1.10 / 1.10 / 1.16 | ×0.9 | ×0.9 (Fair Wages) | 0.769 / 0.769 | hands 1-6 kept (Old Crew I); 10 Looms (Crew Kit I) |
| 4 (#5) | ×1.1 / – | ×1.023 (Pay Day ×1.02; Work Gang III Stone ×1.003) | 1.13 / 1.21 / 1.16 | ×0.85 | ×0.85 (Full Crew) | 0.654 / 0.654 | 10 Workbenches (Crew Kit II); Roll Call |
| 5 (#10) | ×1.6 / ×1.5 | ×1.573 (Bunkhouse speed ×1.3, Crew Spirit I ×1.21) | 1.77 / 1.94 / 1.73 | ×0.85 | ×0.85 (Fair Pay II) | 0.556 / 0.556 | hands 1-10 kept (Old Crew II) |
| 6 (#20) | ×4 / ×4.4 | ×3.83 (Crew Charter ×1.75, Work Gang IV ×1.485, Crew Spirit II ×1.28, Square Meals I ×1.15) | 6.78 / 7.74 / 7.62 | ×0.85 | none | 0.556 / 0.473 | every hand kept (Old Crew III); Foreman's Mate |
| 7 (#30) | ×4 / ×4.4 | ×4.03 (Crew Photo ×1.4, Scar Tissue ×1.25, Work Gang V ×1.485, Crew Spirit III ×1.28, Square Meals II-III ×1.1 each) | 27.3 / 31.0 / 33.5 | ×0.85 | none | 0.556 / 0.402 | |
| 8 (#40) | ×4 / ×4.4 | ×3.91 (Time and Motion speed ×1.7, Work Gang VI ×1.485, Crew Spirit IV ×1.28, Square Meals IV-V ×1.1 each) | 107 / 124 / 148 | ×0.85 | none | 0.556 / 0.341 | Standing Crew |
| 9 (#50) | ×4 / ×4.4 | ×4.17 (Crew Legends ×2, Relief Crew ×1.5, Campfire Stories ×1.15, Square Meals VI-VII ×1.1 each) | 445 / 496 / 649 | ×0.85 | ×0.85 (Fair Pay III) | 0.473 / 0.290 | Lifers |

- **Over a ring's share, inside the rules:** ring 5 is +4.9% over 04's ×1.5 (under 10-balance's
  ×1.6); ring 7 is +0.6% and ring 9 +4.4% over ×4, each within the +10% allowance and under every
  running total (earlier rings ran behind). Ring 3 sits exactly on 10-balance's running ×1.10.
- **Hand prices stop mattering at ring 6.** Kept hands are never rehired, so once Old Crew III
  keeps all 14, `hand_cost` only touches Relief Crew's second hands and keystone runs. Rings 6-8
  leave the share unused on purpose; Fair Pay III (ring 9) serves the second hands. Whole sector:
  ×0.47 against the ×0.29 ceiling.
- **Ceilings:** `hand_cost` ≥ ×0.29 (0.47 here); `start_owned` ≤ 25 a line (10 here); no node
  touches taps, flotsam, hours, offline, glass, Glow, Morale, scrap or a guarded system. Lone Wolf's
  taps ×50 is a keystone (resolution 3.13).
- **Schedule (10-balance 6.4):** Mara ring 1, hands 1-6 ring 3, 1-10 ring 5 as listed. Old Crew III
  sits in ring 6 (04's slot) where 10-balance's table says ring 7: one ring earlier, which is P1's
  schedule and "gives the same numbers to day 180", so it needs no new simulator run. Dax (ring 2)
  and the Loom kit (ring 3) are not in the table; each sits in the ring of its nearest row (Old
  Friends; Old Crew I and the Timber start).

### 1.1 Keystones (outside the budget, keystone rule)

| Keystone | Targets | Gain | What it costs |
| --- | --- | --- | --- |
| Skeleton Crew (5.3, 7,777) | casual | manned lines ×2; hands free | at most five hands. Crew Spirit, Pep Talk and Fair Wages count five hands, so at the full tree their combined ×2.8 falls to ×1.5. The other nine lines run only on taps and stop overnight. Estimate: ×1.7 for the casual at ring 5, about ×1.1 at the full tree. If the simulator finds the cost too small, the first lever is a second downside: the five work the Night Shift for 12 h at most. |
| Lone Wolf (8.4, 7.77M, anchor) | active | taps ×50 | no hands: every line is unmanned and nothing runs offline. Every Old Crew, per-hand node, Standing Crew, Lifers and Relief Crew does nothing. `10-balance.md` 6.5: ×1.6 active, ×0.2 casual |

The pair conflict (04 section 5); see open question 3 for how `hand_cap` must fold when both are slotted.

## 2. The 45 nodes

Wave: rings 1-3 ship in R2, rings 4-6 in R3, rings 7-9 are in data from R3 and shown in R7.
Foreman's Mate ships in R5 (reserved slot until then); Campfire Stories joins the data in R4
(`per: entries` needs the Logbook). Glass prints as 04 does (7,777; 22.2k; 2.22M).

| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `old_friend` | automation (anchor, scene) | Old Friends | Mara stays hired through every Wipe Day and rows back in with you | 2 | ground_zero | R2 |
| 1.2 | `fair_pay_1` | small | Fair Pay I | Hands cost ×0.95 | 1 | ground_zero | R2 |
| 2.1 | `hiring_board` | notable (scene) | Hiring Board | Dax stays hired through every Wipe Day too, and every hand costs ×0.9 | 9 | old_friend | R2 |
| 2.2 | `work_gang_1` | small | Work Gang I | Twig-era lines +25% | 5 | old_friend, fair_pay_1 | R2 |
| 2.3 | `pep_talk` | notable | Pep Talk | All lines +1% a hand on shift (up to +5%), twice that while Afterglow lasts | 11 | fair_pay_1 | R2 |
| 3.1 | `work_gang_2` | small | Work Gang II | Timber-era lines +30% | 25 | hiring_board | R2 |
| 3.2 | `old_crew_1` | automation (anchor) | Old Crew I | Hands for lines 1-6 stay hired through every Wipe Day | 33 | hiring_board, work_gang_1 | R2 |
| 3.3 | `fair_wages` | notable | Fair Wages | Hands cost ×0.9, and each hand on shift adds +0.5% to all lines (up to +5%) | 66 | work_gang_1, pep_talk | R2 |
| 3.4 | `crew_kit_1` | small | Crew Kit I | Runs start with 10 Looms, at work as soon as Timber opens | 44 | pep_talk | R2 |
| 4.1 | `pay_day` | unlock (scene) | Pay Day | Ring the bell by the cabin once a run: manned lines ×3 for 5 minutes | 333 | work_gang_2 | R3 |
| 4.2 | `crew_kit_2` | small | Crew Kit II | Runs start with 10 Workbenches, at work as soon as Timber opens | 222 | work_gang_2, old_crew_1 | R3 |
| 4.3 | `full_crew` | completion | Full Crew | All of Crew's ring 3 lit: hands cost ×0.85 | 555 | all of ring 3 | R3 |
| 4.4 | `work_gang_3` | small | Work Gang III | Stone-era lines +30% | 333 | fair_wages, crew_kit_1 | R3 |
| 4.5 | `roll_call` | automation | Roll Call | A Roll Call button hires every hand you can afford, keeping the crown's price | 444 | crew_kit_1 | R3 |
| 5.1 | `fair_pay_2` | small | Fair Pay II | Hands cost ×0.85 | 2,222 | pay_day | R3 |
| 5.2 | `old_crew_2` | automation | Old Crew II | Hands for lines 1-10 stay hired through every Wipe Day | 3,333 | crew_kit_2 | R3 |
| 5.3 | `skeleton_crew` | keystone | Skeleton Crew | Hands cost nothing and manned lines pay ×2, but only five hands work at once | 7,777 | full_crew | R3 |
| 5.4 | `bunkhouse` | notable (scene) | Bunkhouse | Rested hands: all lines cycle ×1.3 faster; the bunkhouse stands from the start | 4,444 | work_gang_3 | R3 |
| 5.5 | `crew_spirit_1` | small | Crew Spirit I | All lines +1.5% a hand on shift (up to ×1.21) | 3,333 | roll_call | R3 |
| 6.1 | `crew_spirit_2` | small | Crew Spirit II | All lines +2% a hand on shift (up to ×1.28) | 22.2k | fair_pay_2 | R3 |
| 6.2 | `foremans_mate` | automation, gate 20 | Foreman's Mate | The Foreman also buys units for lines with no hand on shift | 33.3k | fair_pay_2, old_crew_2 | R5 |
| 6.3 | `old_crew_3` | automation | Old Crew III | Every hand stays hired through every Wipe Day | 44.4k | old_crew_2, skeleton_crew | R3 |
| 6.4 | `work_gang_4` | small | Work Gang IV | Armored-era lines ×1.5 | 33.3k | skeleton_crew, bunkhouse | R3 |
| 6.5 | `crew_charter` | notable | Crew Charter | All lines +3% for every Crew node you own (up to ×1.75) | 77.7k | bunkhouse, crew_spirit_1 | R3 |
| 6.6 | `square_meals_1` | small | Square Meals I | All lines ×1.15 | 22.2k | crew_spirit_1 | R3 |
| 7.1 | `scar_tissue` | notable | Scar Tissue | All lines +0.5% for every Wipe Day your crew has lived through (up to ×1.25) | 555k | crew_spirit_2 | R7 |
| 7.2 | `work_gang_5` | small | Work Gang V | Armored-era lines ×1.5 | 333k | foremans_mate | R7 |
| 7.3 | `square_meals_2` | small | Square Meals II | All lines ×1.1 | 222k | old_crew_3 | R7 |
| 7.4 | `crew_spirit_3` | small | Crew Spirit III | All lines +2% a hand on shift (up to ×1.28) | 333k | work_gang_4 | R7 |
| 7.5 | `square_meals_3` | small | Square Meals III | All lines ×1.1 | 222k | crew_charter | R7 |
| 7.6 | `crew_photo` | unlock (scene) | Crew Photo | All lines ×1.4 until this run out-earns your crew photo; then it's retaken | 444k | square_meals_1 | R7 |
| 8.1 | `crew_spirit_4` | small | Crew Spirit IV | All lines +2% a hand on shift (up to ×1.28) | 2.22M | scar_tissue | R7 |
| 8.2 | `square_meals_4` | small | Square Meals IV | All lines ×1.1 | 2.22M | scar_tissue, work_gang_5 | R7 |
| 8.3 | `time_and_motion` | notable | Time and Motion | All lines cycle ×1.7 faster | 5.55M | work_gang_5, square_meals_2 | R7 |
| 8.4 | `lone_wolf` | keystone (anchor) | Lone Wolf | Taps ×50, but no hands at all: lines run only while you tap (ranks still count) | 7.77M | square_meals_2, crew_spirit_3 | R7 |
| 8.5 | `standing_crew` | automation | Standing Crew | Each kept hand brings 10 units of their line, on top of any kit | 3.33M | crew_spirit_3, square_meals_3 | R7 |
| 8.6 | `work_gang_6` | small | Work Gang VI | Armored-era lines ×1.5 | 3.33M | square_meals_3, crew_photo | R7 |
| 8.7 | `square_meals_5` | small | Square Meals V | All lines ×1.1 | 2.22M | crew_photo | R7 |
| 9.1 | `square_meals_6` | small | Square Meals VI | All lines ×1.1 | 22.2M | crew_spirit_4 | R7 |
| 9.2 | `relief_crew` | unlock (scene) | Relief Crew | Each line takes a second hand at ×10 the price: that line ×1.5 | 33.3M | square_meals_4 | R7 |
| 9.3 | `square_meals_7` | small | Square Meals VII | All lines ×1.1 | 22.2M | time_and_motion | R7 |
| 9.4 | `crew_legends` | completion (scene) | Crew Legends | All of Crew's ring 8 lit: all lines ×2 | 55.5M | all of ring 8 | R7 |
| 9.5 | `campfire_stories` | notable | Campfire Stories | All lines +0.1% for every Logbook page (up to ×1.15) | 77.7M | standing_crew | R7 |
| 9.6 | `lifers` | automation | Lifers | Kept hands keep their line's Line Mk III through the blast | 33.3M | work_gang_6 | R7 |
| 9.7 | `fair_pay_3` | small | Fair Pay III | Hands cost ×0.85 (second hands too) | 22.2M | square_meals_5 | R7 |

Ring totals: 3 · 25 · 168 · 1,887 · 21.1k · 233k · 2.11M · 26.6M · 266M; the sector costs about
295M glass, in line with 04 3.2's per-sector share. Paths: Old Crew I from nothing is Old
Friends → Work Gang I → Old Crew I, 3 nodes, 40 glass; Skeleton Crew from nothing is 10 nodes,
8,523 glass (both ring-1 nodes, Hiring Board, Pep Talk, all of ring 3, Full Crew, the keystone).

## 3. The named mechanics (how they play)

- **Old Friends, Hiring Board, Old Crew I-III.** The keep-ladder: Mara (#1), Dax (#1), lines 1-6
  (ring 3), 1-10 (ring 5), all (ring 6). Kept hands walk out at the landing and man a line on its
  first unit. Hiring Board also cuts every hire ×0.9, so it still pays after #3, when the agenda
  keeps lines 1-3 anyway.
- **Pep Talk.** The crew get fired up after the blast: the per-hand bonus doubles while Afterglow
  lasts, so hiring early in a run pays twice.
- **Pay Day** (`feature:pay_day`). A rusty bell by the cabin, rung once a run. For 5 real minutes,
  manned lines pay ×3 and the crew cheer. Like any timed buff it splits the settle. It is a scene
  object, never a Toolbelt button (no fourth button, 04 2.4), and the advisor never crowns it.
- **Roll Call** (`feature:roll_call`). One button on the Lines tab: "Roll Call · 3 hands · 1.2T".
  It hires cheapest first and keeps the crowned purchase's price in reserve, as the Foreman does
  (resolution 1.10). Secondary unless crowned.
- **Bunkhouse.** Rested hands work faster: every bar visibly speeds up, and the building stands from
  the first second of every run.
- **Crew Charter.** The sector's build-around: +3% to all lines for each Crew node owned, capped
  at 25 nodes. It is reached by about the end of ring 6 if you went deep in Crew.
- **Scar Tissue.** It grows with the Wipe Day count, from ×1.15 when ring 7 opens (#30) to its
  cap ×1.25 at #50.
- **Crew Photo** (`feature:crew_photo`). The cabin wall holds a photo of your best run's crew,
  stored as that run's peak income rate. Every run, all lines pay ×1.4 until the run's own rate
  (without the photo) passes the photo. Then a flash, a new photo, and the bonus ends for the run.
  It is a catch-up inside every run: fast rebuilds early, nothing extra past your record. Rates
  change only at commands, so settle stays closed-form.
- **Time and Motion.** Every bar runs ×1.7 faster. Beyond the 0.1 s floor, speed becomes payout.
- **Standing Crew** (`feature:standing_crew`). Each kept hand brings 10 units of their line, added
  on top of any kit, when the line's era opens.
- **Relief Crew** (`feature:relief_crew`). A second hand per line at ×10 the hand price, ×1.5 to
  that line. Old Crew III keeps second hands like first ones, so it is bought once per line. The
  scene draws a pair at each plot, swapping at the bell.
- **Lifers** (`feature:lifers`). A kept hand keeps their line's Line Mk III through the blast if it
  was bought that run. Like a pocketed Mk, it works from 0 owned.
- **Foreman's Mate** (`feature:foreman_unmanned`, gate 20). The Foreman also buys for lines with no
  hand on shift. This makes Skeleton Crew, Lone Wolf and the Skeleton Crew Dare runs build
  themselves (see open question 1).

Features by phase (for `11-roadmap.md`): R3 `pay_day`, `roll_call`, `skeleton_crew` (with the
`hand_cap` stat); R5 `foreman_unmanned`; R7 `crew_photo`, `standing_crew`, `relief_crew`,
`lifers`. No wave-1 Crew node uses a feature.

**Flavour lines** (proposal, only if `flavour` keys are added; blurbs stay plain):

| Node | Flavour |
| --- | --- |
| Old Friends | Mara never misses the boat. |
| Hiring Board | WANTED: hands. Must not glow. |
| Pay Day | Paid in beans. Nobody complains. |
| Skeleton Crew | Five of us. More beans each. |
| Bunkhouse | Bunks, a stove, and somebody snoring. |
| Scar Tissue | What doesn't vaporise you makes you stronger. |
| Crew Photo | Say "scrap"! |
| Time and Motion | Somebody gave the Foreman a stopwatch. |
| Lone Wolf | Your crew photo is a selfie now. |
| Campfire Stories | The fish gets bigger every time. |
| Square Meals | Hot beans, twice a day. |

## 4. Checks run on this catalog

- 45 nodes; the slot types equal 04 6.4's table, and the type counts equal the quotas (22 small,
  8 notable, 2 keystone, 3 unlock, 8 automation, 2 completion). Keystones sit at 5.3 and 8.4,
  completions at 4.3 and 9.4.
- `requires` equals 04 1.3's default wiring, and completions need their whole previous ring.
- **Never three small nodes in a row** on any chain (longest run of smalls: 2). All 10
  small-to-small edges join different series (1.2→2.2, 3.1→4.2, 3.4→4.4, 5.1→6.1, 5.5→6.6,
  6.4→7.4, 7.2→8.2, 7.5→8.6, 8.1→9.1, 8.7→9.7).
- Prices: every price is on the ladder and inside its band × type, keystones are 7,777 and 7.77M,
  and completions take the ring's top ×1 price.
- Small nodes have one effect from the 04 10.2 step table. The 10% rule holds from ring 3:
  - each `more` small is ×1.1 or more;
  - Work Gang II-III add +30% to an era scope (+16-18% over the tree's Σinc);
  - kits go 0 → 10;
  - Fair Pay is ×0.85.
- Every `per` has a `max`. `feature:*` appears only on unlock, automation and keystone nodes.
- Ids are unique, `snake_case`, and never a sector, line, era or target id. Names are at most 24
  characters (Square Meals VII is the longest at 16) and blurbs at most 80 (the longest is 79).
- Scene nodes in each band: rings 1-3 Old Friends and Hiring Board; rings 4-6 Pay Day and
  Bunkhouse; rings 7-9 Crew Photo, Relief Crew and Crew Legends. That is 7 drawings in all.
- A casual-felt notable in each band: Hiring Board (rings 1-3), Bunkhouse and Crew Charter (rings
  4-6), Scar Tissue, Time and Motion and Campfire Stories (rings 7-9).
- The JSON adds three fields from 04 9.1's schema: `series` on smalls, `gate` on Foreman's Mate
  and `conflicts` on the keystones.

## Open questions

1. **Foreman's Mate: changed gate and effect.** 04 gives it gate 7 in ring 6, but ring 6 opens at
   Wipe Day #20, so check 15 fails, and the agenda already gives the Foreman every line at #20. The
   node was dead on arrival. This catalog sets gate 20 and a new effect: the Foreman also buys for
   lines with no hand on shift, which pairs with both Crew keystones and the Skeleton Crew Dare.
   `05-meta-layers.md` 5.1 ("line units of manned lines") needs one line naming the exception. If
   the owner wants "lines 1-10 early" kept instead, the node has to move to ring 4 or 5, which
   breaks 04's fixed slots.
2. **Bunkhouse: changed effect.** 04's "hands for lines 1-3 cost ×0.1" does nothing from Wipe Day
   #3 on (the agenda keeps those hands), and ring 5 opens at #10. It is now "all lines cycle ×1.3
   faster", inside ring 5's share; the scene stays.
3. **`hand_cap` must take the lowest value.** 09 5.1 registers it as `set`, best (highest) wins. With
   Lone Wolf (0) and Skeleton Crew (5) both slotted, that gives five hands plus taps ×50, an exploit.
   For `hand_cap` the lowest set should win, so the pair means no hands; the rebuild screen already
   warns about the conflict.
4. **Skeleton Crew needs a stand-down rule.** 09's `hire_hand` refuses at the cap (`hand_cap`). That
   would leave a player stuck with Twig hands as eras open. Proposal: at the cap, a hire replaces the
   lowest line's hand, and the button says so ("Hire Hale · Mara stands down"). Kept hands walk out
   for the five highest lines.
5. **Id clash with a Dare.** `05-meta-layers.md` 8.3 proposes a Dare `skeleton_crew`; the keystone
   holds that id (04 6.1). Rename the Dare (for example `short_handed`), so locale keys and
   `when: dare:<id>` stay unambiguous.
6. **Relief Crew ×3 → ×1.5.** Late in the game, hand prices are tiny next to unit prices, so ×10 the
   hand price is no real cost and ×3 would apply to every line. With Crew Legends ×2 that would put
   ring 9 at ×6 against a ×4 share. Second hands are kept by Old Crew III (stated here; `02` 9.2
   should list them).
7. **Crew Photo redesigned.** 04's "+5% a hand in it" is a flat ×1.7 once Old Crew III keeps all 14
   (every photo has 14 hands). The catch-up version ("×1.4 until you beat the photo") changes how a
   run plays and fits ring 7. It needs the best run's peak rate in records (`03` 11 resets the peak
   per run; the record must be kept).
8. **Units for a line whose era is not open** (Crew Kits, Standing Crew): this catalog has them wait
   and arrive when the era opens. `start_owned` in `09` 5.1 should say so, because Works' kits only
   touch Twig lines and never hit this case.
9. **Skeleton Crew's cost may be too small for the casual,** whose income sits almost entirely on
   the top five lines. The simulator row decides. The first lever is "the five work the Night Shift
   for 12 h at most", and it must pass the keystone rule before R3 ships.
10. **Lifers and N11.** Up to 14 kept Mk IIIs active from the first second is a large start-of-run
    effect (it plays like 14 Pockets). It is unbudgeted as a start, but the simulator should check
    run-to-run speed after ring 9.
