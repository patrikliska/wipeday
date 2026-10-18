# Wipe Day game design: an incremental idle game with a personal nuke

Approved by the owner on 2026-10-10 (all 22 decisions in `docs/redesign/README.md` section 3) and
amended by the Feel redesign of 2026-10-17 and 2026-10-18 (D181-D200, `docs/redesign/12-feel.md`).
This file is the design in short; the detail and the reasons live in `docs/redesign/`: the vision
(`01`), the run (`02`), the nuke (`03`), the Blast Map (`04`, catalog `04b`), meta layers (`05`,
catalog `05b`), friends (`06`), what changed (`07`), screens (`08`), balance (`10`), the phases
(`11`) and the feel (`12`). Where `12` disagrees with `02`, `05`, `10` or `11`, `12` wins, and
D191-D200 refine `12`; elsewhere `working/vision/errata-v3.md` wins. Every number is a P1 starting
value owned by the simulator: it lives in `packages/content/data` and `pnpm sim` may retune it.
`docs/redesign/09-architecture.md` is the engineering spec. Names marked *(proposal)* wait for
the owner's naming passes.

## 1. Vision and pillars

You wash up on Saltmarsh with nothing. One tree stands on the rise. Tap it, and every tap knocks
something loose onto a stockpile beside it. Spend the supplies up a 14-rung ladder of production
lines, from beachcombers to a pre-war reactor, and in a Workshop of small upgrades between them. A
line without a hand only works while you tap; hire one and it runs by itself, also while you are
away. The crew are survivors you collect as cards from Supply Drops, star up and kit out. On the
slope someone is bolting together a boiler on stilts with a traffic-cone nose, the Kettle, and
beside it, under a hinged toilet-seat lid, sits a fat red button. Press it, and your own missile
flattens your own island. The crater glass it leaves is all that lasts. Spend it on the Blast
Map, 361 nodes around Ground Zero, and the next island goes up faster.

It stays a private game for a handful of friends at very different levels: own world and names
(D43), no real money before the last phase (D182), desktop, tablet and phone, zero tutorial.

The five pillars (the priority order in `CLAUDE.md` section 1 does not change):

1. **One glance, one number, one tap.** One big number going up, one thing to tap, one crowned
   purchase. A mechanic that needs a sentence belongs in the tree, not in the run.
2. **Tap to start it, hire to keep it.** Every line starts manual and becomes automatic. Taps stay
   worth it all game: an active hour is 4-6× an idle one (D184).
3. **Boom is progress.** The nuke is the only reset. You choose when, and it always shows what it
   gives. No forced wipes, decay or raids.
4. **The island tells the story.** Every line, milestone, era, hand and tap is drawn in the scene:
   a tap makes a thing, not only a number.
5. **Friends cheer, never compete for stock.** Social features count events, times and ratios,
   never amounts. No trading, gifting or PvP.

**Where Rust lives:** in mechanics and mood, never names. The tool ladder (Grip), five tiers
re-climbed every run, gathering on a tree, an outcrop, an ore seam, a sulfur vent and a wreck,
products you can see, scrap as the precious currency, salvaged gear, jank homemade engineering,
and the wipe as a ritual: Wipe Day is the day you wipe your own island.

The references, in one line each (`01` 1.4, `12` 1): AdVenture Capitalist gives the run (lines,
hands, milestones); Cookie Clicker the bursts (flotsam, gulls) and the prestige shape; Clicker
Heroes the Toolbelt and the second layer; Realm Grinder the agenda and Dares; Egg, Inc.
hold-to-work, Hustle, the common research (the Workshop) and co-op; Melvor full-rate offline and
automation as upgrades. The Feel brainstorm measured the game against Cookie Clicker, Egg, Inc.
and Idle Cave Miner 2: physical taps, a second system before the nuke, crew as a collection,
reveal moments, juice.

## 2. The guardrails

These replace the W-phase guardrails (D129). The simulator (`pnpm sim check`, inside `pnpm test`)
asserts the N-numbers as amended (`10` 4.9, errata v3, `12` 11); the rest are domain tests,
content checks and the shots review. Warn-only targets print a warning and never fail the build.

1. **The first nuke comes on day 1.** N1: continuous play at 6 taps/s, 40-60 min. N2: any archetype,
   autoclicker included, at least 25 min on the wall clock. N3: casual by the day-1 21:00 check-in.
   It stands under the 2 h Night Shift; day 1 is retuned around it (D183).
2. **Active play is a bonus, not a different game.** N8: in run 1's first minute tap-driven income
   (taps plus unmanned lines) is at least 50%; from minute 10, outside bursts, direct taps are
   10-30%. N9: an active hour is 4-6× an idle online hour, on the weather-weighted hour (rain
   hours warn). The levers are Frenzy, Rush, drops and boosts (D184). N10: at most 15 taps/s
   credited, bursts of 45, a hold counts 4/s; the bucket does not move.
3. **Friends stay in one race.** N16: glass ever at days 30 and 90 in a group of five with Late
   Tide: active at most 2×, optimal at most 2.5×, idler at least 0.5× the casual. Solo gaps and the
   doubling idler's trough warn; the late idler gaps are asserted for an idler following the
   crown. N17: a friend who joins on day 30 reaches the day-30 casual within 12 days, asserted for
   two players (five players warn).
4. **There is always something to buy.** N5: nothing affordable for at most 30 s in the first 10
   online minutes of runs 1-5. N6: at most 120 s online with nothing affordable. N7: at least 90%
   of casual check-ins in days 1-30 contain a purchase. N31: the Workshop keeps N5-N7 true with
   the shelf's Mk rows moved into it.
5. **Every nuke feels faster.** N11: run N+1 passes run N's gain in at most 65% / 95% / 100% of
   its time (early / mid / late medians; warn-only until R9). N12: combined power per nuke
   ×1.5-2.5 / ×1.15-1.6 / ×1.1-1.5. N13: five consecutive nukes together below ×1.3 with nothing
   opening in the next three fails the build.
6. **The tree lasts months.** N14: 6-10 nodes bought at the first nuke, a median of at least 2
   later. N15: the optimal player has at most 45% lit at day 30 and never 100% before day 90; the
   casual at least 45% at day 180 (warning).
7. **Absence never hurts.** N18: the Night Shift pays 100% inside 2 h, rising to 24 h (D183); a
   full window stops accrual and destroys nothing. Only your own button takes progress.
8. **Precious things are never at risk; randomness is paid for in play and always printed.** N19:
   scrap 4-6 a day for a casual (7-day average from day 2), at least 100 by day 30, nobody above 8
   (from R3, D192). Glass and scrap are never traded, gifted, wagered, stolen or sold for
   Supplies; no command writes another base. N28: no Supply Drop card is blank, a duplicate pays
   shards (domain test). N29: pity as printed (10 / 40 / 150 cards), asserted by the seeded drop
   test. N30: the casual opens at least one drop a day in days 1-30.
9. **Randomness is visible; no hidden catch-up.** N20: timers and odds as printed (flotsam every
   4-10 min for 13 s; gulls every 2-4 min, 1 in 20 elite; the Magnet at 20/23/24 h). An Odds sheet
   in Settings from R1, repeated in the Logbook from R6; drop odds and pity counters in the Album
   from R3. Late Tide is labelled to its own player, never on boards or shared surfaces.
10. **Numbers stay meaningful.** N21: glass is the fifth root of lifetime (`L0` 5e5), Glow
    `1 + 0.25√G`. N23: run 1 ends at 1e10-1e12 supplies made; under 1e150 over 180 days; always
    finite. N22: a nuke counts only if it adds at least 10% to glass ever.
11. **Respect the clock.** Idle timers (Night Shift, Magnet, Toolbelt cooldowns, the Freighter)
    run on the game clock; active timers (taps, Hustle, Frenzy, flotsam, gulls, buffs, boosts,
    felling, the cinematic) run on real seconds and never speed up with the demo clock (CLAUDE.md
    6.3.9, amended).

Also asserted: N4 first hand within 2 min; N24 settle is path-independent; N25 tap batches of at
most 1 s or 30 taps; N26 the Blast Map's shape (361 nodes, ×10 per ring band, small nodes at most
52%, never three small in a row); N27 touch targets at least 44 CSS px and the tap target at least
120 px tall on a phone. Month-1 bands: the casual makes 2-8 nukes and 300-2,000 glass in the first
week (asserted alone) and 20-40 Wipe Days by day 30. Casual runs after day 30 of at most 3 days
are a warning (the late wall, section 6).

Retired with the redesign: the 25% legacy cap and its four enforcements, "8 check-ins is about
1.6×", the day-14 and day-18 floors, storage caps as the check-in driver, PvP, and the blanket
"no casino" (D181: drops with printed odds and pity, never wagering).

## 3. Time scales and loops

| Scale | Loop | What the player does |
| --- | --- | --- |
| seconds | tap, Hustle, Frenzy (15 s), felling, flotsam (13 s), gulls, buffs (12-60 s), boosts | tap hard, catch flotsam and gulls |
| minutes | lines, milestones, hands, the Workshop, eras, Afterglow (30 min), drops | buy the crown, hire, research, climb |
| hours | run 1 (43-49 min of play; day-1 21:00 casual), runs 2-5; the 2 h Night Shift | check in, Collect |
| days | runs of a day (month 1), 4-5 days (months 2-6); daily quests, the Magnet | nuke when crowned, open drops |
| weeks | the Freighter, Pockets, survivor stars, sets, the agenda | pick a loadout, kit out the crew |
| months | the Blast Map, the Logbook, the Album | grow a sector, finish a set |

Taps start lines, lines make the lifetime that pays glass, and glass buys nodes that make the
next run faster. The Workshop fills the minutes between line purchases; cards and drops are the
layer that carries across runs.

**Check-ins.** The design player is the casual: 08:00, 13:00 and 21:00, about five minutes each at
4 taps a second. The idler comes twice a day; the active player eight times for ten minutes. A
check-in is Collect, a few crowned buys, the day's quests and drops and, about once a day in month
1, the Big Red. The **Night Shift** starts at 2 h (4 h with the run's Spare Wicks), so on day 1 it
covers a lunch break, not the night: the 13:00 check-in is a real check-in again (D183). Deep
Cellars (1 glass) is the first of the permanent steps to 24 h (5.5). Every purchase is instant; no
timer gates one.

## 4. World and names

Own IP (D43): nothing references another game's items, sites or icons. The island is
**Saltmarsh**; its clock runs at UTC+1 with no daylight saving (decision 2). Ids never change when
a display name does, so a rename is a locale edit (`07` 7.3 has the checklist). Name passes: R1,
R4 and R6; pass 1 is done (D157, D164) and the eras keep the five Rust grades. The Feel names
(Workshop, Supply Drop, Album, Frenzy, Spare Wicks) were picked by the agent as the owner asked
(D188) and stay open to a later pass.

New names are *(proposal)* until their pass; "kept" names exist in the W-phase game; pass 1's
names are approved.

| Name | id | What |
| --- | --- | --- |
| Supplies | `supplies` | the one run currency |
| Crater Glass, Glow *(proposal)* | `glass`, `glow` | prestige currency; its multiplier |
| Morale *(proposal)*, Hustle | `morale`, `hustle` | badge and Logbook multiplier; tap meter |
| Frenzy *(proposal)* | `frenzy` | the second tap meter and its tripped buff (D196) |
| Scrap (kept) | `scrap` | the premium currency, earned in play (R3) |
| Beachcomber, Ship Breaker, Reactor | `beachcomber` ... | lines 1, 13, 14 |
| Campfire ... Radio Mast (kept) | `campfire` ... `radio_mast` | lines 2-12 |
| Driftwood ... Power Cells | `timber` ... `cell` | the 14 product badges |
| Mara ... Tamsin (kept); Gus, Vera | crew ids | the 14 hands; survivor cards from R3 |
| Twig, Timber, Stone, Sheet Metal, Armored (kept) | `twig` ... `hqm` | eras |
| Rock ... Power Tools (kept) | tool ids | Grip rungs |
| Lone Pine, Outcrop, Ore Seam, Sulfur Vent, The Wreck | `tree` ... `wreck` | tap targets |
| the stockpile *(proposal)* | | the prop the tap's chips land on |
| Workshop; Spare Wicks *(proposal)* | `{line}_mk` | the per-run research tree; its offline item |
| Sharper Hooks, Dry Kindling, Calloused Thumbs *(proposal)* | | Workshop tier-1 items |
| Drift Crate, Fuel Drum, Adrenaline Kit, Rally | `crate` ... | flotsam, R1 |
| gull, elite gull *(proposal)* | | the sky's tap-to-catch sibling of flotsam, R2 |
| Drowned Drone, Sealed Locker, Message in a Bottle | `drowned_drone` ... | flotsam, R6-R7 |
| Supply Drop, Album; shards, stars, sets *(proposal)* | | chest; collection; card progress, R3 |
| Salvaged Hatchet ... Crowbar *(proposal)* | | gear cards, R3 |
| Overdrive, Double Time, Lucky Tide *(proposal)* | | scrap boosts, R3 |
| badges, daily quests, the ticker, Best buy *(proposal)* | | the scaffolding (R2, R3) |
| Night Shift; the Kettle, the Big Red *(proposal)* | `night_shift` ... | offline; missile; button |
| Wipe Day #N, small blast, Afterglow, Fizzle | `fizzle` | the nuke's beats |
| Blast Map, Ground Zero; the eight sectors | `ground_zero`, sector ids | the tree *(proposal)* |
| Calloused Hands, Old Friends, Go Bag | `steady_hands` ... | ring-1 nodes (perk ids) |
| Logbook, the Magnet, Pocket | `magnet`, `pocket` | meta *(proposal)* |
| Foreman, Dead Hand; Rush, Grit, Flare | `foreman` ... | automation; Toolbelt |
| Long Night, Rich Tides, Storm Season, Quiet Hands | `long_nights` ... | Dares *(proposal)* |
| Blowback, Island Count, the Freighter, Late Tide | | social *(proposal)* |
| The Barge, the Crossing, Sea Charts *(proposal)* | `barge`, `sea_charts` | second layer, later |

Names pass 1 (D157, D164): the Go Bag (`packed_crate`, once "Starter Kit", a Cookie Clicker
upgrade name) and Tinned Fish (`food`, once "Fish Crates"); every other pass-1 name kept as
proposed, Hold to work and Grip included. The Radio Mast's product is `broadcast`, never `signal`.
Crew rank (`rank`) goes with the ranks (D181).

**Rejected names** (`07` 7.2): Blueprint Fragments (a Rust item that promises crafting), Rads,
Fallout, Vault, Glowheads and Caps (Fallout), Stash and Recycler (Rust), Half-life (a Valve
title), Dredge, Ashfall, Exodus and Ark (other games' titles), Keepsakes (another game's item
category).

**The look** (D187-D191). The scene is chunky side-view pixel art: one grid (1 art pixel = 5
stage units, so the stage is 320×180 art pixels and the hero target at least 60 tall), integer
zoom a whole number of device pixels per art pixel that shows the whole island (D204), nearest-neighbour, no
sub-pixel movement. One palette of at most 48 colours in `scene/palette.ts`, taken from the
approved Saltmarsh Scene Mock plus the five era colours (D191; 0-mem0ry's workshop set stays the
inspiration, no file of it is used). Sprites come from Retro Diffusion (`rd_pro__platformer`,
`rd_plus__low_res` under 40 px), bands from the palette gradient, all through `pnpm art` (D189,
D190). Item icons become 16×16 pixel PNGs, UI glyphs stay currentColor SVG (D141 amended). The HUD
stays crisp CSS on the Feel Board's tokens: salvaged plywood and steel panels, Big Shoulders
Display and Barlow, signal orange primary, no pixel font. Desktop 1440 is designed first, 390 px
right after. The pixel scene came first after all, at the owner's request (D202).

**The island and the house** (D203, D206). Saltmarsh is a terraced side view: the beach with the
target in the middle, the Twig lines either side and the sea lines in the shallows; the yard
above with the kiln and the house; the hill on top with the Sheet Metal and Armored structures.
The crafting lines (loom, workbench, furnace, tannery, press) work inside the house: tapping it
opens its room, a cut-away interior at the island's zoom over the dimmed island, with those lines
and their hands. The room grows with the house (tent, cabin, stone house, shed, bunker); the
Twig tent has none (its era has no crafting line), so the house becomes a door at Timber, with a
one-line hint until it has been opened twice. A wide screen keeps a strip of sea on the left for
the flotsam and gives the rest to the hill.

## 5. Systems

### 5.1 The run (R1, R2)

A **run** is one island's life between two nukes. **Supplies** is the only run currency: each
line sells what it makes the moment it makes it; nothing is stocked, capped or carried over. Each
line shows one **product** badge (driftwood, smoked fish, hemp, rope, planks, charcoal, ingots,
leather, lamp oil, tinned fish, batteries, broadcasts, steel plates, power cells) in the shop card,
the floater and the scene, using the owner's resource icons. Products are never spent.

**The 14 lines.** For rung `i` from 1 to 14:

```
cost   c_i = 6 × 16^(i−1)      output r_i = 1.5 × 4.75^(i−1) supplies/s per unit
cycle  t_i = 0.6 × 2^(i−1) s    growth g_i = 1.15 − 0.006 × (i − 1)
hand   h_i = 300 × c_i          next unit, owning n: c_i × g_i^n
cycle used = max(0.1 s, t_i / speed); speed past the floor becomes payout
```

| # | Line | Era | Cost | Base /s | Cycle | Hand | Hand price |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Beachcomber | Twig | 6 | 1.5 | 0.6 s | Mara | 1.8k |
| 2 | Campfire | Twig | 96 | 7.13 | 1.2 s | Dax | 28.8k |
| 3 | Garden | Twig | 1.54k | 33.8 | 2.4 s | Ivo | 461k |
| 4 | Loom | Timber | 24.6k | 161 | 4.8 s | Rook | 7.37M |
| 5 | Workbench | Timber | 393k | 764 | 9.6 s | Sela | 118M |
| 6 | Charcoal Kiln | Timber | 6.29M | 3.63k | 19 s | Bram | 1.89B |
| 7 | Furnace | Stone | 101M | 17.2k | 38 s | Wren | 30.2B |
| 8 | Tannery | Stone | 1.61B | 81.8k | 77 s | Otto | 483B |
| 9 | Oil Press | Stone | 25.8B | 389k | 2.6 min | Juno | 7.73T |
| 10 | Dock | Sheet Metal | 412B | 1.85M | 5.1 min | Pike | 124T |
| 11 | Generator | Sheet Metal | 6.6T | 8.77M | 10 min | Hale | 1.98Qa |
| 12 | Radio Mast | Sheet Metal | 106T | 41.7M | 20 min | Tamsin | 31.7Qa |
| 13 | Ship Breaker | Armored | 1.69Qa | 198M | 41 min | Gus | 507Qa |
| 14 | Reactor | Armored | 27Qa | 940M | 82 min | Vera | 8.11Qi |

Costs rise ×16 per rung and output ×4.75, so the cheapest output keeps moving between lines.
Buy ×1 / ×10 / ×100 / Max (closed form) from the second hand of run 1. Multipliers fold in one
fixed order: base, add, milestones, `(1 + Σinc)` (Workshop items, survivor stars), `Πmore` (Line
Mk, island upgrades, eras, Grit, nodes), Glow, Morale, buffs (Rally, Frenzy, boosts).

**Manned and unmanned lines.** A manned line (a hand hired) produces continuously, also while you
are away inside the Night Shift. An unmanned line runs only in cycles that credited taps start: at
most one cycle in flight, started only when the line is idle, tracked by a busy-until `readyAt`.
A started cycle pays at its end even if tapping stopped. A batch of taps covers its seconds to
the end of the last one, so tapping faster than a line's cycle keeps it running exactly as if
manned (D176), while one tap a second on a 19-second Kiln runs it once every 19 seconds. Stop
tapping and every unmanned line stops: hands are what keep a line running while you are away.

**Milestones.** Per line: 10 owned ×2, 25 speed ×2, 50 speed ×2, 100 ×2, 200 ×3, 300 ×3, 400 ×4,
500-900 ×2 each, 1,000 ×5, then ×2 every 100. A speed milestone that would take the cycle under
0.1 s doubles the payout instead. Roster (every unlocked line): 25 all ×2, 100 all ×2, 250 all ×3;
once reached it is kept for the run, so buying an era never lowers income. The card always shows
the next one ("38/50 → speed ×2"). Buildings redraw at 1, 25 and 100 owned.

**The shelf** (16 one-off upgrades a run from R2, when the Line Mks move into the Workshop; with
14 hands, 30 purchases):

- **Grip** (4 rungs after Rock): Stone Tools 60, Iron Tools 6k, Salvaged Tools 6M, Power Tools 6B.
  Each doubles the flat tap and adds 0.4% of the full rate to every tap.
- **Island upgrades** (8): all lines ×2 each, from Sorting Tables (1M) to Steam Hammer (1e34); the
  shelf shows one at a time, and each adds a prop to the island.
- **Eras** (4): Timber 1.5k, Stone 3M, Sheet Metal 20B, Armored 400T (after Wipe Day #2). Each is
  all lines ×2 (×16 at Armored) and opens three lines (two at Armored).
- **Line Mk II and Mk III** were 28 shelf rows in R1; from R2 each line has one Workshop item
  `{line}_mk` of two levels, `output more 3` each, priced `c_i × 10^4` (25 owned) and
  `c_i × 10^8` (50 owned), listed under the line's era (D194, 5.12).

Grip rungs and island upgrades are Pocket-eligible (never an era; the Mk items' eligibility is
open, section 10). Works nodes may cut prices, capped at ×0.25 per shelf kind and ×0.5 for eras.

**Eras and targets.** Each era changes the tap target and how many taps fell it: Lone Pine (40,
"Timber!"), Outcrop (60, "Crumble!"), Ore Seam (80, "Rich vein!"), Sulfur Vent (100, "Pop!"), The
Wreck (120, "Cracked open!"). An era purchase plays about 1.2 s of show: a last fell, the base
redrawn in the tier colour, three staked plots with price signs.

### 5.2 The tap: the hero tap and Frenzy (R1, R2)

```
tapValue  = (2^grip × G + p × fullRate) × T × Hustle × Afterglow × B × crit
fellBonus = 10 × tapValue (without crit), once every N taps (40, 60, 80, 100, 120)
```

`G` is the global fold on the flat part (eras, island upgrades, roster, Grit, Glow, Morale); `p`
is 0.4% per Grip rung; `fullRate` is every owned line as if manned, buffs included; `T` the tap
nodes and Workshop items (Calloused Hands +50%, Calloused Thumbs); `B` tap buffs (Adrenaline
×100, Rush ×5, Frenzy ×3, Double Time ×5); `crit` ×10 on a crit (Lucky Swing: 5% of taps, a Grip
node). With the whole tree the steady coefficient `c = taps/s × p × T × Hustle × crit` stays at or
under 0.6 (a content check); `multCeiling` bounds the folded tap multiplier with Frenzy in it
(D196).

- **The hero tap (R2).** The target stands at about 35% of the screen height, centre-left on
  desktop, centre on a phone, at least 120 px tall (N27). Every tap chips a thing (a log, a stone,
  a nugget, a pinch of sulfur, a plate) that arcs onto a **stockpile** prop next to the target and
  stays there until a hand or the tap floater "sells" it. The counter still credits at once; the
  stockpile is the picture of it. Squash and stretch on the target, chips and dust, a 60 ms shake
  on the fell, a thud.
- **Hustle**, the tap meter: +1 per credited tap, 0-100; the tap multiplier runs from ×1 to ×2
  (×2.25 at most with Grip nodes). It holds 2 s after the last tap, then drains 10 a second. It
  stays the tap's base.
- **Frenzy (R2, D196)**, a second meter (`run.frenzy`) drawn under the target, filled by credited
  taps and draining while idle, tuned so the first trip comes near minute 12. At its cap it trips
  the `frenzy` buff for 15 real seconds: taps `more 3` and lines `speed more 1.5`, so the sky
  warms, the lines visibly spin faster and a sting plays; then it drains. The trip resolves in
  closed form inside its taps batch. The simulator may drop the speed part or retune both (D144).
- **The token bucket:** up to 15 credited taps a second, bursts of 45. Taps over it still shake
  the target but pay nothing, silently; an autoclicker earns what 15 taps do. Taps travel in
  batches (about 1 s or 30 taps); the counter reacts on the frame.
- **Hold to work:** a press held 0.35 s counts 4 taps a second until release. **Felling** adds
  `10/N` to tap income: +25% in Twig down to +8% in Armored; from R3 a fell also drops a tier-I
  Supply Drop on a printed schedule (every 5th fell in run 1, every 10th after). Afterglow stays.

### 5.3 Flotsam and gulls (R1, R2; more kinds in R6 and R7)

One flotsam every 4-10 minutes on a seeded schedule while the page is open, 1.5× as often in
rain, drifting in from the sea and floating 13 s off the beach with a pie ring (Tide nodes extend
it to 25 s). It glows but never takes the crown; a hint beside it says what to do until the
player has caught two. Missed flotsam costs nothing: one that sinks says so in one quiet line,
never a toast (D171). Settings and the Multipliers sheet open the **Odds** sheet (D174).

| Flotsam | Weight | Effect | Ships |
| --- | --- | --- | --- |
| Drift Crate | 45 | `max(1 min, min(15% of held supplies, 10 min))` of output | R1 |
| Fuel Drum | 40 | Rally: all lines ×4 for 60 s | R1 |
| Adrenaline Kit | 6 | taps ×100 for 12 s | R1 |
| Drowned Drone | 7 | one owned line ×12 for 30 s | R6 |
| Sealed Locker | 1 | a tier-II Supply Drop (replaces its scrap, `12` 7.1) | R7 |
| Message in a Bottle | 0.5 | a Logbook secret's hint plus a Drift Crate | R6 |

Odds are renormalised over shipped kinds and printed (R1-R5: crate 49.5%, drum 44.0%, kit 6.6%).
Different buffs multiply; the same buff caught again restarts its timer. **Run 1's guaranteed
crate:** until the first catch, every spawn is a Drift Crate paying a flat 2 minutes of output,
exactly every 3:00. Later runs have none. The Lucky Tide boost (R3) brings flotsam every 90 s for
5 minutes.

**Gulls (R2, D197)** are flotsam's skill-based sibling. A gull crosses the sky while the page is
open: slot `j` starts every 180 s from the run's first line at a seeded offset in [0, 60 s], so
gaps fall in 2-4 minutes and none is under 120 s. Tapping one pays 30 s of output. One in 20 is
**elite** (glowing, faster), seeded too: it pays 180 s of output in R2 and 1 scrap from R3, when
scrap has a use (D140). `claim_gull {run, k}` checks the slot and its crossing window; nothing
lives in settle (N24). The odds are printed with the flotsam's.

### 5.4 Hands and the automation ladder (R1, R4, R7)

A hand is a named crew member hired onto one line (price `300 × c_i`, needs one unit); from then
on the line runs forever. No tiredness or injuries. Hiring has its own row under each line's card,
one button and one price. The run is never gated by a card: a hand is always hired with Supplies;
from R3 owning that survivor's card adds stars, a trait and three gear slots (5.13).

**The automation ladder:** hands, one line at a time, from about 0:47 of run 1, and bulk buying
from the second hand (R1); the start of a run with Go Bag, Old Friends (Mara kept) and
Afterglow from Wipe Day #1, and hands for lines 1-3 kept from #3, extended by the Old Crew nodes
(R4); buying lines with the Foreman from #7 (lines 1-6) and #20 (all), calling flotsam with the
Flare from #15, and the nuke itself with Dead Hand from #25, opt-in and online only (R7).

### 5.5 The Night Shift and welcome back (R1, R2)

- Manned lines produce at **100%** while you are away, every lasting multiplier included, for
  **2 h** from your last command (taps, buys or pings) (D183, from R2; R1 shipped 12 h). Per
  run, Spare Wicks in the Workshop adds 20 min a level for six levels, **4 h** (`night_shift add
  1/3`, bought again each run, cheap; D195). Permanently, five Bunker-sector nodes add 2 h each
  (Deep Cellars, 1 glass, is the first), **14 h**; Wipe Days #10, #20 and #40 add 2 h each,
  **20 h**; the Long Night Dare's reward and one ring-7 node reach the ceiling of **24 h**. The
  fold caps the sum at the ceiling; the Wipe Day Rush keystone halves the window.
- A full window stops accrual and destroys nothing. "Night Shift over" is the one notification on
  by default. A visible tab pings every 5 minutes; you count as away 6 minutes after your last
  command.
- **Shown:** a lamp bar in the counter plate ("1 h 42 min of 2 h"); the Workshop names the next
  step ("Spare Wicks: +20 min, 1.2k").
- Taps, Hustle, Frenzy, new unmanned cycles, flotsam, gulls and Afterglow stop while away;
  cooldowns, the Magnet and a cycle already in flight keep running.
- **Welcome back**, after at least an hour away: one card, one primary, **Collect**, with the
  window's fill drawn as the lamp burning down. It never crowns the nuke. Collect banks the gain,
  coins arc into the counter, it empties the Magnet's tray (from R7) and runs the Foreman's pass
  (R7). The gain is the card's big figure; the counter waits at the old value until Collect flies
  it in. With nobody on shift the card says so and its button is "Back to work" (D173).

### 5.6 The advisor's crown and the HUD (R1, R2; the Big Red from R4)

Exactly one thing is crowned, in signal orange; first match wins: (1) the Big Red when
recommended (5.7, R4); (2) the next era, affordable within 30 s; (3) a hand for the top-earning
unmanned line, affordable within 30 s; (4) the best purchase by score (the wait to afford it
plus `price / Δincome`), a Workshop tile included, when it is affordable; while it is out of
reach the player saves, so the crown goes to the tap hint and the card keeps its place with its
countdown; (5) waiting Blowback crates (R8); (6) a ready Toolbelt skill (R7); (7) otherwise "Tap
the {target}". Flotsam and the Magnet glow but never take it. Δincome is weighed over the player's
day (D177): their own tap pace, times the half of the day they are present, counts for unmanned
lines and Grip, and a hand earns the rest; a line nobody owns also counts as the way to its hand,
so a player who never taps is still led to new lines. The crown scores the state's lasting rates
and ignores timed buffs (Frenzy, Rally, boosts), so it never jumps every 15 s (D200).

**One crown per view:** while the crown sits on the Big Red, crates, a skill or the tap hint, the
collapsed drawer shows no orange card; the expanded drawer always crowns one. The era comes before
the hand. One-line hints (20 in run 1, `02` 11.2) retire after two uses. Never tease unshipped
content: locked things show only real, reachable reasons.

**The shop (R2, D186).** On desktop a right column of **cards**, 400 px: an art thumbnail with the
level badge and the hand's portrait, the name, the rate, progress to the next milestone, one
button. On a phone the drawer, two cards collapsed, dragged open. Tabs: Lines, Shelf, Research.
The order is fixed by rung, forever: the crown lights its card in place, and a **Best buy** chip
in the counter plate scrolls the list to the crowned card and pulses once. Panels never reorder,
hide or collapse rows on their own; locked rows stay visible with the reason. (R1's "the row leads
the drawer", D165-D170, is withdrawn.)

**The dock (R2, D187, D199).** One bottom dock on every device, centred with larger icons on
desktop. It appears at 0:00 with Island alone and grows as each destination unlocks: the Workshop
when research opens (2:00), Crew at the first hand, the Logbook at the first badge; the Album
joins in R3 at the first drop and is hidden, not locked, before it. Badges count new things. The
Workshop tab opens the shop on its Research tab (the drawer expanded on a phone, the column's tab
on desktop), so research lives in one place. Panels open as sheets over the scene, full-height on
a phone, wide and centred on desktop; Escape, the back gesture or a click outside closes them.

**Juice and sound (R2, every phase after).** Every purchase: a sound, a flash on the thing it
changed, a number pop. Every bar ticks at its end. Every gain floats as a delta from where it came
from, with its icon (6.3.7). Buttons have depth and a press state; cards flip; chests creak, then
burst; one sting per rarity. Reduced-motion players get the same information without the motion.
Sound is off on the web until the first tap, then on, with one switch; the sources are Kenney's
Interface and Impact Sounds (CC0), Freesound filtered to CC0 and the Sonniss GDC bundles; one
`sounds.json5` maps events to files and nothing plays from a component.

### 5.7 The Big Red (R4)

**Glass.** `L` is lifetime supplies made since the last Crossing (spending never lowers it). The
formula level is `G(L) = floor((L / 5e5)^(1/5))`: 10 glass at 50B made; doubling it takes 32× the
lifetime, a counted nuke (+10%) 1.61×. A nuke pays the delta, `gain = floor((G(L) − level) × m)`
with `m` the glass multipliers (Bigger Payload, Hot Core, Late Tide); then `level = G(L)` and the
gain goes to **glass ever** and **glass held**. Multipliers are never clawed back. Granted glass
(the founders' 5, admin grants) goes to held only and never moves Glow. The exponent never goes
above 1/5 without a group-simulation proof.

**Glow** = `1 + 0.25 × √(glass ever)` (Blast nodes raise `k`), a global multiplier on lines and
the flat tap. Spending glass never lowers it. Ground Zero is granted lit with the first nuke.

**Wipe Day or small blast.** The first nuke needs a formula delta of 10; later nukes are
pressable at a gain of 1. A nuke that adds at least 10% to glass ever is a counted **Wipe Day**:
it raises Wipe Day #N, moves the agenda, posts news, washes Blowback, adds to the Island Count and
the boards, and deepens the crater. A smaller press is a **small blast**: it resets the island and
pays its glass quietly (the Fizzle flight, a private postcard). The cover card always says which.
Every nuke also pays a Supply Drop: tier I for a small blast, II for a Wipe Day, III for a
doubling Wipe Day; and scrap, 3 on a Wipe Day and 10 on a doubling (`12` 7.1, 8).

**When to press.** The card and chip show "+12 now · 9/h now · peak 14/h". The advisor crowns the
Big Red (first match): the first nuke at a delta of 10 (guided); doubling (gain ≥ glass ever); a
slowing run (at least 10 min old, rate under 80% of its peak) when the nuke counts; or a counting
nuke in a run at least 20 h old. The crown is sticky, waits while a buff runs or a Dare's goal is
unmet, and never shows on welcome back. Rule 3's rate definition is an R4 tuning item.

**The Kettle** stands on the slope where the Signal stood and assembles as the yield grows: the
pad at 5e8 lifetime supplies in run 1 (minute 9-10; from the rebuild later), with a locked card
that says what the first launch needs; the frame at a yield of 5 (later 1% of glass ever); the
warhead when the nuke counts; fuel and steam when crowned. A "+1" glass floater rises from it.

**The press.** The cover card (danger style, never primary) shows the gain, "Glow ×1.79 → ×2.17",
what this Wipe Day unlocks, and what is kept and lost; **Flip the lid** or **Not yet**. Then
**hold 2 s** to launch, against a rising siren, with a crew one-liner ("I *just* fixed the
roof."). A cinematic of 6-8 s on real time: the crew row away, the Kettle flies one of 12 flight
variants (four in R4, eight more with the Logbook in R6), a flash, a fireball and a mushroom
cloud. No skip on Wipe Day #1. One idempotency key per hold, so one hold never becomes two nukes.

**The postcard** ("Greetings from Ground Zero", the crater with its "WIPE DAY #N" sign) shows the
run's numbers and names what the **next** Wipe Day unlocks. Wipe Day #1 has one button, **Open the
Blast Map**; the map's "< Rebuild" lands the boat. From #2: **Rebuild**, with the Blast Map as
secondary. The rebuild screen appears only when it offers a choice (Pockets, keystones, a Dare).
The landing: a rowboat, a sapling, a twig lean-to, green sky and ash for ten minutes.

**Afterglow** = `1 + 2 × 2^(−t/300 s)` on taps only: ×3 at the start, the bonus halving every 5
minutes, ended at 30 minutes. `t` counts real seconds from the run's first tap. The first minutes
of every run are the most tap-heavy of the game, and fade exactly as automation takes over.

**Kept:** glass ever and held, Glow, nodes and keystones, the Wipe Day count and records, the
crater, flights seen, agenda unlocks, kept hands, badges, cosmetics, settings, and from the phases
that ship them the cards, shards and Album, scrap, the Logbook, Pockets, Toolbelt cooldowns,
Blowback crates and Dare rewards. **Lost:** supplies, every line unit, shelf upgrades (except
pocketed ones), Workshop levels, the era, hands not kept, Hustle, Frenzy, buffs, the flotsam
schedule. The Night Shift window refills.

**The agenda** (counted Wipe Days; only shipped content is ever named):

| Wipe Day | Unlock |
| --- | --- |
| 1 | Blast Map rings 1-2, Ground Zero, Glow, Afterglow, the crater; the Magnet (R7) |
| 2 | the Armored era; Pocket slot 1 (R7) |
| 3 | hands for lines 1-3 survive nukes; ring 3 |
| 4 / 8 / 15 | Toolbelt: Rush / Grit / Flare (R7); #15 also Logbook secret hints (R6) |
| 5 | ring 4 (R5); Dares (R9) |
| 7 / 20 | the Foreman for lines 1-6 / all lines (R7) |
| 10 | ring 5, keystone slot 1, Night Shift +2 h (R5) |
| 20 | ring 6, keystone slot 2, Night Shift +2 h (R5) |
| 25 | Dead Hand's node becomes buyable (R7) |
| 30 / 40 / 50 | rings 7 / 8 / 9; keystone slot 3 and Night Shift +2 h at 40 (R9) |

New flights and crater-sign styles arrive along the way. A player past a gate when its phase
ships gets it at once, with one "New on Saltmarsh" card.

### 5.8 The Blast Map (R4, R5, R9)

- **Shape:** Ground Zero at the centre; 8 sectors of 45°, clockwise Grip, Crew, Works, Tide,
  Bunker, Blast, Logbook, Scrapyard; 9 rings of 2, 3, 4, 5, 5, 6, 6, 7, 7 nodes per sector: 45 per
  sector, **361** in all. Prerequisites are OR within a sector; completions need a whole ring.
- **Waves:** wave 1 is rings 1-3 (73 with Ground Zero) in R4; wave 2 rings 4-6 reach 178 nodes in
  R5, 191 in R6 and 201 in R7 as their systems ship; wave 3 rings 7-9 sit in data from R5 (so the
  simulator measures all 361) and show in R9. Ring gates: #1, #1, #3, #5, #10, #20, #30, #40, #50.
- **Node types:** 187 small (one stat), 70 notable (a named mechanic), 16 keystone (a rule-bending
  gain with a printed downside), 36 unlock (a new toy), 36 automation, 16 completion. Only
  unlocks, automations and keystones may need new code. Never three small nodes in a row.
- **Sectors:** Grip (taps, Hustle, crits, Afterglow), Crew (hands, kept hands), Works (lines,
  milestones, prices), Tide (flotsam), Bunker (offline, the Night Shift: five nodes of +2 h),
  Blast (glass and Glow), Logbook (Morale, secrets), Scrapyard (Pockets, the Magnet). Each has
  scene-changing nodes. The Scrapyard's rank nodes need new targets now that ranks are gone
  (section 10).
- **Costs:** one ladder of playful numbers, ×10 per ring: ring 1 costs 1-4 glass, ring 4 about
  222-1,111, ring 9 tens of millions; keystones cost 7,777 (ring 5) and 7.77M (ring 8). The whole
  tree costs about 2.9B glass, about 1e53 lifetime supplies.
- **The first basket:** Go Bag, Calloused Hands, Deep Cellars, Hot Coals, Old Friends and
  Bigger Payload, 6 nodes for 9 glass, with 1 left over. Later a casual buys a median of 2-3 a nuke.
- **Keystones:** owned forever, work only when slotted; exactly three slots (Wipe Days #10, #20,
  #40), changed free on the rebuild screen. Examples: Wipe Day Rush (Afterglow holds ×5 for 60
  min; Night Shift ×0.5), Bunker Mentality (offline ×1.5; no flotsam), Lone Wolf (taps ×50; no
  hands). A keystone may at most double the income of the archetype it targets.
- **Effects** are data `{stat, op, value, scope?, per?, max?, when?}` with ops add, inc, more,
  set, unlock; every `per` carries a `max`; guarded numbers (the bucket, the 24 h ceiling, the 10%
  rule, scrap income, drop odds and pity, social systems) have no node.
- **Permanent:** nodes are never refunded and apply at once. A balance patch that changes bought
  nodes ships with a full free respec (all glass back); there is no partial or paid respec.

### 5.9 Meta layers (R6, R7, R9)

- **Logbook and Morale (R6).** The crew's diary of achievements; its first pages are R2's badges
  (5.15). In full: 120 pages (30 secrets, 11 categories), growing to about 250 by R9. Morale =
  `1 + 0.01 × pages` from R2 (D198); the Logbook phase raises the step (`05` 1's 0.02) and
  Logbook nodes take it to 0.05 a page; it multiplies every line and tap. Pages pay 1 scrap per 5
  and a Supply Drop per 10 (`12` 7.1, 8). Secrets show "???" with a one-line hint from Wipe Day
  #15, Old Maps, a Message in a Bottle or a friend's first find.
- **Scrap and the Magnet (R7).** A free crane over the bay, on the game clock: growing 0-20 h; an
  early haul at 20-23 h (50%: 1 scrap); sure at 23-24 h (1 scrap, 10% rich: 2-3); at 24 h it hauls
  by itself into the tray. About 1 scrap a day; winch nodes bring it to 16/19/20 h.
- **Crew ranks are gone** (D181): survivor stars from shards (5.13) do their job, and "ranks rise
  together" goes with them.
- **Pockets (R7).** Three slots at 5, 15 and 40 scrap: slot 1 from Wipe Day #2, slots 2 and 3
  through the nodes `deep_pockets` and `sewn_lining`. Each keeps one shelf upgrade active from the
  first second of every run. A full slot swaps only before the run's first purchase.
- **The Foreman (R7).** From Wipe Day #7 (lines 1-6) and #20 (all): buys units of manned lines,
  the lowest payback first, at most one buy a second while the page is visible, and one
  deterministic pass at Collect. It always keeps the crowned purchase's price in reserve. Never
  hands, upgrades, Workshop items, eras, nodes or the Big Red. A switch in Crew, on when unlocked.
- **Dead Hand (R7).** The `dead_hand` node (22.2k glass), buyable from Wipe Day #25, off by
  default: it presses the Big Red at 25 / 50 / 100 / 200% of glass ever or "when crowned". Only
  in a visible, focused tab, only for a counted nuke, after a 5-second toast with Stop; never
  offline or from Discord. It plays a short landing instead of the cinematic.
- **The Toolbelt (R7).** Three round buttons, never a fourth. Rush (#4): taps ×5 for 30 s, 10 min
  cooldown. Grit (#8): all lines ×1.05 for the rest of the run, stacking to 10, every 8 h: the
  casual's check-in ritual. Flare (#15): calls one flotsam now, every 60 min; the `flare_gun`
  node lets the player choose crate, drum or kit. Effects on real seconds, cooldowns on the game
  clock.
- **Dares (R9).** From Wipe Day #5, one opt-in Dare per run, picked on the rebuild screen, with
  constraint, goal and reward shown in full; abandon any time, free. A met goal pays a permanent
  effect of at most +25% on one stat at the next nuke. The launch four reuse the season-modifier
  ids: Long Night (no Night Shift; its reward lengthens the window toward the 24 h ceiling, 5.5),
  Rich Tides, Storm Season, Quiet Hands. Eight more are designed for later (twelve at most).
- **The Crossing (later, gated).** A second reset above the nuke, to a new island with its own
  curve, paying **Sea Charts** `floor(5 × log10(glass ever / 1e4))`. It is built only when its
  trigger fires (a simulator call, the late-wall decision) and never shown before. It keeps the
  Logbook, scrap, the cards and Album, Pockets, Dare rewards, the Wipe Day count, agenda unlocks
  and cosmetics.
- **Creeds (deferred).** At most three (Scrappers, Bunker Folk, Tinkers), only if a playtest
  after R9 finds runs samey.

### 5.10 Friends (R4, R6, R8)

Every social number is a count, a time, a ratio, or an amount in the viewer's own numbers. No
trading, gifting, PvP or tap goals; co-op pays only scrap and cosmetics; a friend's effect on you
is derived lazily on your own settle, never written into your base. Boards count events, never
scrap or cards.

- **Nuke news (R4).** Every counted Wipe Day posts to the feed, the ticker and `#wipe-day-idle`:
  "Ben pressed the Big Red. Wipe Day #1 on Saltmarsh: +10 crater glass." One news nuke per player
  per 30 min; quick repeats fold into one line; milestones and records always post. Small blasts
  never post. The Discord post carries the postcard image from R8.
- **Blowback (R8).** Each friend's Wipe Day washes 3 crates onto every other shore, at most 9
  waiting, no expiry. Each pays the Drift Crate's formula in the receiver's own run, so a full
  shore is worth 9 minutes to 1 h 30 min of their own output.
- **The Island Count (R8).** Every Wipe Day by anyone since the cut-over. Tiers at 10, 25, 50,
  100, 175 and 250 unlock a cosmetic for everyone (a scorched flag first, a gold lid last).
- **The Freighter (R8).** A weekly co-op ship, grounded from Monday 00:00 UTC. A load costs one
  hour of your own output; at most 6 loads a week. Tiers I, II and III at an average of 2, 4 and 6
  loads per active player; each tier pays 1 scrap to every loader (at most 3 a week); tier III
  raises a pennant. Nobody is listed as not having loaded.
- **Late Tide (R8).** Below 50% of the median glass ever of the other players active in the last
  14 days, nukes pay ×3 glass, never past that median. Shown openly to that player only.
- **Boards (R8).** Seven boards with a monthly and an all-time window, nobody ever reset: Wipe
  Days, Best blast (a ratio), Fastest comeback (a ratio), Nodes lit, Logbook, Flotsam, Freighter
  loads. Zero is never shown. The Hall keeps season 1 as "the old world".
- **Visit (R8 stretch).** A friend's island, read-only, without amounts, Glow or activity times.
- **Shared first finds (R6).** The first player to log a secret opens its hint for everyone; the
  feed names the hint, never the secret.
- **The Discord companion v2 (R4).** The `/base` card shows the idle rate, the glass chip, the
  Night Shift bar and the Big Red's yield. Its only command is **Collect** (which also runs the
  Foreman's pass); no taps, buying, drops or nuke from Discord. A monthly post replaces season
  news.
- **Notifications.** Four kinds: "Night Shift over" (on by default, from R1), "Magnet full",
  "friend nuked" and "Freighter tier" (off by default). Quiet hours 22:00-08:00 in the player's
  browser time zone, on by default, hold pushes until 08:00.

### 5.11 Weather and the island clock (R1)

Weather and day and night are domain data (`island.json5`), the same for every friend, so the
server checks them. The island clock runs at UTC+1 with no daylight saving. Each 30-minute block
is clear, rain or fog by a seeded draw, about 70 / 20 / 10%. Rain brings flotsam 1.5× as often;
night and rain feed node conditions (`when: rain`, `when: night`), flight variants and Logbook
secrets. The scene draws both, and the shots review checks contrast in day, dusk, night, rain and
fog.

### 5.12 The Workshop (R2, R3) *(proposal)*

Egg, Inc.'s common research in our materials (D185): a per-run tree of small, repeatable upgrades
priced in Supplies, open from minute two, reset by the nuke so every run re-climbs it. It is the
engine behind guardrail 4 in the minutes between line purchases, bought alongside lines, never
instead.

- **Shape:** 8 tiers of 5 items, 40 items, each 5-25 levels. Tier `k` opens with era `k/2`
  rounded up (tiers 1-2 Twig, 3-4 Timber, 5-6 Stone, 7-8 Sheet Metal); Armored has no tier. R2
  ships tiers 1-4, R3 tiers 5-8. Beside the tiers, the 14 Line Mk items (`{line}_mk`, 5.1; D194).
- **Price:** level `n` of an item in tier `k` costs `b_k × 1.35^n` with `b_k = 40 × 20^(k−1)`
  (tier 1 from 40, tier 8 from 51B). Content check: the whole tree costs under 1e18 Supplies,
  about 3% of a run-1 lifetime at the top.
- **Effects** in the one vocabulary (`09` 5.1): `inc` on one line's output or on all lines of an
  era, `more` on taps, `add` on the Night Shift (Spare Wicks, D195), `add` on flotsam odds, `inc` on
  milestone thresholds (never below 10), `add` on Frenzy gain, price cuts capped at ×0.6.
- **Tier 1:** Sharper Hooks (Beachcomber +5% a level, 25 levels; 40 at 2:00), Dry Kindling
  (Campfire +5%, 25), Spare Wicks (Night Shift +20 min, 6), Calloused Thumbs (tap +1, 10). Quick
  Count (buy ×10) is dropped: it duplicates bulk buying from the second hand and adds no income the
  crown could score (D194).
- **Shown** as a grid of tiles with an icon, a level ring, the next level's cost and gain, on the
  shop's Research tab; the crown may land on a tile (rule 4 scores it like any purchase).
- **Simulator:** the crown buys research by the same payback rule as lines; N5-N7 measure it and
  N31 asserts it.

### 5.13 Cards, Supply Drops and the Album (R3)

**Supply Drops** (D181) are chests of **three cards**; tiers I, II and III set the odds. Every drop
is earned in play or bought with scrap; nothing else opens one before R9.

| Source | Tier | How often | Ships |
| --- | --- | --- | --- |
| Felling | I | every 5th fell in run 1, every 10th after (printed) | R3 |
| Daily quests | I | the third quest of the day | R3 |
| Badges and pages | I-II | one per 10 | R3 |
| Scrap | II / III | 30 / 120 scrap | R3 |
| The nuke | I / II / III | a small blast / a Wipe Day / a doubling Wipe Day | R4 |
| Flotsam: Sealed Locker | II | weight 1 | R7 |

**Odds, printed in the Album** (per card, Common/Rare/Epic/Legendary): tier I 70/25/4.5/0.5%;
tier II 45/40/13/2%; tier III 10/50/32/8%. **Pity, printed:** a Rare or better within 10 cards,
an Epic or better within 40, a Legendary within 150, counted per player across tiers. **No blank
pulls:** a duplicate pays shards (N28, N29). The reveal is one flip per tap, rarity colour first;
"Flip the next" is primary, "To the Album" secondary, both always present.

**Survivor cards.** The 14 hands are 14 survivor cards; the run never needs one (5.4).

- **Rarity** fixed per survivor, not per line order, so early pulls matter: 5 Common (Mara, Dax,
  Ivo, Bram, Otto), 5 Rare (Rook, Sela, Wren, Juno, Pike), 3 Epic (Hale, Tamsin, Gus), 1
  Legendary (Vera).
- **Stars** 1-5 from shards: 10 / 25 / 50 / 100 shards for stars 2-5; each star is that line
  +25% (`inc`), five stars ×2.
- **One trait** each, on while hired, at most +25% on one stat, in `cards.json5`: Dax "Keeps the
  fire" (crit +2%), Mara "Early riser" (Night Shift +10 min), Wren "Hot hands" (Furnace cycle
  −10%), and so on.
- **Three gear slots.**

**Gear cards.** About 30 at launch, Rust in mood with our names: Salvaged Hatchet, Driftwood Rod,
Rope Belt, Tin Lantern, Gas Mask, Hazmat Coat, Jerrycan, Car Battery, Welding Goggles, Crowbar.
Each has a rarity, one stat (`{stat, op, value}`, at most +20% Common to +60% Legendary) and a
slot kind (hand, head, pack); equipped to one survivor at a time, swapped free and instantly.
Duplicates pay shards of their rarity; shards buy any gear card of that rarity in the Album (20 /
50 / 120 / 300), so a wanted piece is always reachable by play.

**Sets**, printed in the Album: all five Common survivors at 3 stars, Twig and Timber lines ×1.5;
all 14 at 1 star, Morale +10%; a survivor with three gear pieces of one rarity, that line +10%.

**The Album** is a dock destination: survivors as a grid of portraits (greyed until owned, stars
under each), gear as a grid, sets, the odds and pity counters, the shard balances. Icons from
game-icons.net until the pixel icons exist (D141's fallback).

### 5.14 Scrap, boosts and the store (R3, R9)

Scrap is the premium currency (D182): earned in play, spent on drops and boosts.

- **Earn:** badges and pages 1 per 5, elite gulls 1, the day's quest set 1 (R3); the nuke 3 on a
  Wipe Day, 10 on a doubling (R4); the Magnet about 1 a day (R7); the Freighter at most 3 a week
  (R8). Target for a casual: 4-6 a day (N19).
- **Spend:** Supply Drops (30 / 120) and **boosts** on real seconds (R3): Overdrive (all lines ×3
  for 10 min, 15 scrap), Double Time (taps ×5 for 2 min, 10), Lucky Tide (flotsam every 90 s for
  5 min, 20); Pocket slots (R7). Boosts stack with Rally and Frenzy: that stack is the
  active-play jackpot.
- **Never:** traded, gifted, wagered, stolen or sold for Supplies.
- **The store (R9)** adds one thing: scrap packs for money, with the odds page one tap away.
  Before it ships: a payment provider, a short legal check on loot boxes for the players'
  countries, and the owner's prices. Nothing else in the game changes when the switch flips.

### 5.15 Badges, daily quests and the ticker (R2, R3)

- **Badges (R2, D198).** The Logbook's pages in their simplest form: 60 at launch, shown as a wall
  with locked badges visible with their condition and a toast with the badge on each unlock. Their
  counters are lifetime stats (taps, fells, crits, flotsam, gulls, Frenzies, hands, units, Workshop
  levels, eras, supplies made); drops and nukes count once they ship (D140). Each is Morale +1%.
  They are checked after every successful command, never inside settle (N24); `badge_unlocked` is
  logged.
- **Daily quests (R3).** Three a day on the island's clock: "Tap 500 times", "Hire 2 hands",
  "Catch 3 flotsam", "Open a drop", "Fell 20 times". The third completed pays a tier-I drop and 1
  scrap. Never "spend scrap"; no rerolls.
- **The news ticker (R2).** One line under the dock on desktop, in the drawer's handle on a phone:
  crew one-liners, the island's weather and, from R4, friends' Wipe Days. Thirty lines at launch
  in `en.json`.

## 6. Progression

Run 1's measured times are the simulator's (R1, a player following the crown, 12 flotsam seeds;
D179), under R1's rules (12 h Night Shift, no Workshop, Hustle only); the rest are the P1 model's
(`10` 4) until their phase re-measures them. R2 Feel retunes day 1 around the 2 h window and
re-measures all of it.

**The first ten minutes** (R1, phone, continuous play at 6 taps a second):

| Time | What happens |
| --- | --- |
| 0:00 | Dawn, a twig lean-to, a glowing pine. The only text: "Tap the tree." |
| 0:01 | The drawer slides up with one crowned card: Beachcomber, 6. |
| 0:07 | Forty taps fell the tree ("Timber!"); a new one pops up. |
| 0:09 | Stone Tools (60): taps ×2 and +0.4% of supplies per second. |
| 0:33 | Timber era (1.5k): a cabin, the outcrop, three new lines. |
| 0:47 | Hire Mara (1.8k): the first line runs without taps. Crew joins the dock. |
| 3:00 | The first crate: a flat 2 minutes of output, back every 3 minutes until caught. |
| 3:59 | Sorting Tables (1M): everything ×2. |
| 5:44 | Stone era (3M); the target becomes an ore seam. |
| 9-10 min | At 5e8 made the Kettle's taped "DO NOT" pad rises, with its locked card (R4). |

**The first session's target beats** (`12` 10; targets, not yet measured):

| Time | What is new |
| --- | --- |
| 0:00 | Tap the tree; logs arc onto the stockpile |
| 1:00 | First line, the shop card |
| 2:00 | The Workshop opens (Sharper Hooks 40) |
| 4:00 | Fifth fell: first Supply Drop, first survivor reveal, Mara (R3) |
| 5:00 | First badge |
| 8:00 | First gull |
| 12:00 | First Frenzy trips |
| 15:00 | Timber era |
| 20:00 | Daily quests reveal, one already complete (R3) |
| 45:00 | The Big Red; a tier-II drop and the Blast Map (R4) |

A new kind of thing every few minutes until minute 20, then the known rhythm. The two tables
disagree on the early pace (Timber at 0:33 measured, 15:00 targeted); R2 Feel's balance session
settles it from `pnpm sim` within N4-N8 (section 10).

**The first hour.** From minute 10 taps were about 14% of income outside bursts in R1 (the new N8
band is 10-30%). The Kettle's frame goes up at a yield of 5 (about minute 12-13), Sheet Metal
lands at about minute 40-48 (Handcarts, the second island upgrade, at 5e9 on the way), and about
seven or eight flotsam are caught. **Yield 10, the first nuke's, comes at about 43-49 minutes**; an
autoclicker cannot bring it under 25 minutes.

**Day 1, casual.** 08:00: about 40 purchases, the Timber era and Mara. 13:00: one Collect, now of
the 2 h window (4 h with Spare Wicks) rather than R1's five hours, the Stone era, four hands and
Sorting Tables. 21:00: the pad and the Kettle's frame up; a minute of tapping takes the yield to
10, and **the first nuke lands at the day-1 21:00 check-in** (guardrail 1). R1 measured about 40B
made by 21:00 under the 12 h window; the 2 h window lowers the afternoon's gain, and R2 Feel
retunes the curve so the nuke still lands (the simulator reports what the casual loses at 2 h
against 12 h). The night to 08:00 is no longer covered on day 1.

**Run 2.** Go Bag units and Mara are already working, taps carry Glow ×1.79, Calloused Hands
and Afterglow ×3, and run 1's whole gain is passed in under half its time. Each postcard names the
next unlock.

**The first week** (alone, P1 model before the Feel redesign): the casual makes about 7 Wipe
Days and 1,050 glass ever (17% of the tree, about 60 of the 72 nodes of rings 1-3); the active
player about 12 and 10.8k; the idler 4 and about 230. Armored opens at Wipe Day #2 and is first
reached in run 3 or 4. Scrap comes in at 4-6 a day (N19): drops and boosts from day 1, a Pocket
slot within days of R7. In a group that starts together, Late Tide lifts the casual's week to
about 10k glass.

**The first month.** Runs settle at about a day: the casual makes about 24 Wipe Days alone (20-22
in a group of five), the active player 27. By day 30 the casual has about 42k glass ever (64k in
the group) and 34% of the tree; the optimal player 36-37%. Rings 4-6 and two keystone slots open;
the Logbook fills; the casual has at least 100 scrap (N19) and has opened a drop every day (N30).
Each counted Wipe Day adds 10-25% to glass ever, about ×1.2 of output power. Group gaps at day 30:
active 1.06, optimal 1.34, idler 0.67 of the casual.

**Months 2-6 and the late wall.** Casual runs stretch to about 4.5 days. At day 90 the casual has
about 238k glass ever, 41 Wipe Days and 43% of the tree; at day 180, about 594k, 50 and 47%.
Rings 7-9 open at Wipe Days #30, #40 and #50 in R9, but cost 200k glass and up, out of reach until
about day 150. After day 180 runs reach about 10 days, and the tree is 57% lit at day 365 (60%
for the active and optimal players). Stars, sets, Morale and Dares keep growing with real days.
This is the **late wall** (`10` 5), an open owner choice before R9 (section 10): option 1 accepts
a slow outer tree and lowers the Crossing's trigger to "45% lit and N13 firing" (months 4-6);
option 2 adds a calendar-fair power source (the deepening crater, `05` 10.3), designed and
simulated alongside.

**Coming back after two days.** One card, one Collect: the window's gain (at most the window, 2 h
to 24 h), the Magnet's scrap, friends' crates, new Logbook pages. The stalled run is over 20 hours
old, so if the nuke counts the next crown is the Big Red. Nothing was lost, only paused.

## 7. Content volume per phase

- **Lines** 14, **hands** 14 (R1); lines 13-14 are reached from R4, when the Armored era opens
  after Wipe Day #2. **Shelf** 44 upgrades in R1, 16 from R2 (4 Grip, 8 island upgrades, 4 eras).
- **Eras** 5 and **targets** 5 (R1; Armored and the Wreck reachable from R4).
- **Workshop** tiers 1-4 and the 14 Line Mk items in R2; tiers 5-8 in R3 (40 tier items).
- **Flotsam kinds** 3 in R1 (crate, drum, kit), 5 in R6 (drone, bottle), 6 in R7 (locker);
  gulls in R2.
- **Badges** 60 in R2; **Logbook** 120 pages in R6 (30 secrets), about 40 more in R7, 40 in R8 and
  50 in R9: about 250.
- **Cards** in R3: 14 survivors, about 30 gear, 3 drop tiers, 3 sets, 3 boosts; daily quests 3 a
  day. The **store** in R9.
- **Sound** for every event in `sounds.json5`, and 30 ticker lines, in R2.
- **Blast Map** 73 nodes in R4, 178 in R5, 191 in R6, 201 in R7, 361 in R9; 16 keystones, three
  slots.
- **Flight variants** 4 in R4 (U-Turn, Loop-the-Loop, Sputter and Drop, Fizzle), 12 in R6.
- **Toolbelt** 3 skills in R7. **Dares** 4 in R9, 8 more later (12 at most).
- **Social** in R8: 7 boards, 6 Island Count tiers, the Freighter's 3 tiers; 4 notification kinds.
- **Later, gated:** the Crossing and its island, at most 3 creeds, a sea layer.

## 8. Economy

| Currency | Sources | Sinks |
| --- | --- | --- |
| Supplies (a run) | taps, fells, lines, flotsam, gulls, Blowback | lines, hands, shelf, eras, the Workshop, loads |
| Glass ever | every nuke's gain (delta × multipliers) | none: drives Glow, never falls |
| Glass held | the same gains, plus granted glass | Blast Map nodes only |
| Scrap | badges, elite gulls, quests (R3); nukes (R4); Magnet (R7); Freighter (R8); the store (R9) | Supply Drops, boosts (R3); Pockets (R7, 60) |
| Shards | duplicate cards (R3) | survivor stars, gear cards of that rarity |
| Sea Charts | the Crossing (reserved, not built) | Chart nodes (reserved) |

- **Supplies** grow without limit; prices grow geometrically per line and per Workshop level, so
  there is always a sink. Nothing is capped or stocked; a full Night Shift only stops accrual.
- **Glass** grows as the fifth root of lifetime, and Glow as its square root: concave twice, so a
  several-fold lead in glass is a small lead in power, and tree prices rise ×10 per ring.
- **Scrap** is earned in play and scale-free: a casual earns 4-6 a day (7-day average from day 2),
  at least 100 by day 30, nobody above 8 (N19, asserted from R3, D192). It is recorded and shown
  from R3 with its sinks, and sold for money only from R9 (D182).
- **Cards** never gate the run; drops print their odds and pity, and a duplicate always pays.
- **Founders' gift:** a Founder skin and 5 glass held (never Glow) for every season 1 base, at the
  cut-over (R4).
- **Numbers** print with suffixes up to decillion (`1.2Dc`, 10^33), then scientific notation, with
  a setting for e-notation throughout (decision 20).

## 9. Deliberately not in the game

- **Cut** (`07` 2.2): Gather and its cooldown, the daily haul, storage caps, upkeep and decay,
  construction timers and builders, 22 of 23 stocked resources, the crafting web, blueprints and
  items, crew needs (arrivals, tiredness, injuries, bonds), the Den counter, contracts and the
  player market, the casino, NPC raids, defence, bandit camps and PvP, monthly seasons, the
  Signal and the 25% legacy cap. Three cut things return in a new form with the Feel redesign:
  crew levels and gear as survivor cards with stars and gear cards (R3), daily tasks as daily
  quests (R3), chance as Supply Drops (D181).
- **Parked in git:** expeditions, the fogged map, sites, regions, keycodes and report cards, until
  the R8 playtest decides on a possible sea layer (decision 6).
- **No trading, no gifting, no PvP, no wagering, no monthly reset.** Drops are printed odds with
  pity, never blank. "Month" survives only as a board window; one season row stays forever.
  Season 1 runs untouched on the old build and ends quietly at the R4 cut-over with one
  `pnpm season end` (decision 7).
- **No nuke from Discord**, no offline auto-nuke, no node autobuyer, no fourth Toolbelt button,
  no fourth keystone slot, no tap counts in anything social. **Real money is deferred, not
  banned:** the store and the purchase switch ship in R9 only (D182); nothing is wired before it.

## 10. Open questions

- **Survivor traits:** only while hired, or always once owned? (Proposal: while hired, so the run
  still matters.)
- **Gear slots:** open at stars 1 / 3 / 5, or all at once? (Proposal: all at once; fewer rules.)
- **The nuke's drop tier:** by glass gained or by the Wipe Day count? (Proposal: glass gained, so
  a small blast never out-pays a Wipe Day.)
- **The 2 h window and the idler at day 1:** too tight? The simulator answers before R2 Feel's
  S1 closes.
- **The early pace:** `12` 10's target beats (first line 1:00, Timber 15:00, first gull 8:00) do
  not match R1's measured run (Timber 0:33) or D197's gull grid (the first slot inside about 4
  minutes of the first line); R2 Feel's balance session decides from the simulator.
- **Five stars against five ranks:** `12` 7.2 calls ×2 "the old rank-5 value", but five ranks of
  ×2 were ×32 a line; the simulator must show what dropping ranks costs the months-long curve.
- **The Workshop's count:** whether the 14 Line Mk items sit inside the 40 tier items or beside
  them, what replaces Quick Count in tier 1, and whether the Mk items are Pocket-eligible as the
  Line Mk rows were.
- **Scrap in R3:** N19 (4-6 a day) switches on in R3, but the Magnet (about 1 a day) ships in R7
  and the nuke's scrap in R4; R3's sources (badges, elite gulls, quests) must carry the band or
  the band's phase moves.
- **The dock's five places:** Island, Workshop, Crew, Album, Logbook leave no place for the Blast
  Map (R4) or Friends (R8).
- **The Scrapyard sector** loses its rank nodes; `04b` needs replacements.
- **Badges and the Logbook's 120 pages:** whether R2's 60 badges count among them.
- **Names:** the passes in R1, R4 and R6 and a later pass for the Feel names. The Workshop's
  offline item is Spare Wicks (D201: "Spare Wicks" is the Oil Press's product); Calloused Thumbs sits next to the
  Calloused Hands node; Salvaged Hatchet and Hazmat Coat are to be checked against D43.
- **The late wall** (decision 21): option 1 is the working plan; option 2 is designed and
  simulated alongside, and the final option is chosen before R9 from R8's simulations and
  playtest. It also settles the Crossing's player gate (`03` open question 2).
- **Creeds and a sea layer** wait for their triggers (after R9; the R8 playtest).

The owner's to-do list, phase by phase, is in `docs/roadmap.md`.
