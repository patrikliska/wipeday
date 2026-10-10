# Wipe Day game design: an incremental idle game with a personal nuke

Approved by the owner on 2026-10-10 (all 22 decisions in `docs/redesign/README.md` section 3).
This file is the design in short; the detail and the reasons live in `docs/redesign/`: the vision
(`01`), the run (`02`), the nuke (`03`), the Blast Map (`04`, catalog `04b`), meta layers (`05`,
catalog `05b`), friends (`06`), what changed (`07`), screens (`08`), balance (`10`) and the phases
(`11`); where they disagree, `working/vision/errata-v3.md` wins. Every number is a P1 starting
value owned by the simulator: it lives in `packages/content/data` and `pnpm sim` may retune it.
`docs/redesign/09-architecture.md` is the engineering spec. Names marked *(proposal)* wait for
the owner's naming passes.

## 1. Vision and pillars

You wash up on Saltmarsh with nothing. One tree stands on the rise. Tap it, and supplies pour
out. Spend them up a 14-rung ladder of production lines, from beachcombers to a pre-war reactor.
A line without a hand only works while you tap; hire one and it runs forever, even while you
sleep. On the slope someone is bolting together a boiler on stilts with a traffic-cone nose, the
Kettle, and beside it, under a hinged toilet-seat lid, sits a fat red button. Press it, and your
own missile flattens your own island. The crater glass it leaves is all that lasts. Spend it on
the Blast Map, 361 nodes around Ground Zero, and the next island goes up faster.

It stays a private game for a handful of friends at very different levels: own world and names
(D43), no real money, mobile first, zero tutorial.

The five pillars (the priority order in `CLAUDE.md` section 1 does not change):

1. **One glance, one number, one tap.** One big number going up, one thing to tap, one crowned
   purchase. A mechanic that needs a sentence belongs in the tree, not in the run.
2. **Tap to start it, hire to keep it.** Every line starts manual and becomes automatic.
3. **Boom is progress.** The nuke is the only reset. You choose when, and it always shows what it
   gives. No forced wipes, decay or raids.
4. **The island tells the story.** Every line, milestone, era and hand is drawn in the scene.
5. **Friends cheer, never compete for stock.** Social features count events, times and ratios,
   never amounts. No trading, gifting or PvP.

**Where Rust lives:** in mechanics and mood, never names. The tool ladder (Grip), five tiers
re-climbed every run, gathering on a tree, an outcrop, an ore seam, a sulfur vent and a wreck,
products you can see, scrap as the precious currency, jank homemade engineering, and the wipe as
a ritual: Wipe Day is the day you wipe your own island.

The references, in one line each (`01` 1.4): AdVenture Capitalist gives the run (lines, hands,
milestones); Cookie Clicker the bursts (flotsam) and the prestige shape; Clicker Heroes the
Toolbelt and the second layer; Realm Grinder the agenda and Dares; Egg, Inc. hold-to-work, Hustle
and co-op; Melvor full-rate offline and automation as upgrades.

## 2. The guardrails

These replace the W-phase guardrails (D129). The simulator (`pnpm sim check`, inside `pnpm test`)
asserts the N-numbers as amended (`10` 4.9, errata v3); the rest are domain tests, content
checks and the shots review. Warn-only targets print a warning and never fail the build.

1. **The first nuke comes on day 1.** N1: continuous play at 6 taps/s, 40-60 min. N2: any archetype,
   autoclicker included, at least 25 min on the wall clock. N3: casual by the day-1 21:00 check-in.
2. **Active play is a bonus, not a different game.** N8: in run 1's first minute tap-driven income
   (taps plus unmanned lines) is at least 50%; from minute 10, outside bursts, direct taps are
   5-25%. N9: an active hour is 1.5-3× an idle online hour, on the weather-weighted hour (rain
   hours warn). N10: at most 15 taps/s credited, bursts of 45, a hold counts 4/s.
3. **Friends stay in one race.** N16: glass ever at days 30 and 90 in a group of five with Late
   Tide: active at most 2×, optimal at most 2.5×, idler at least 0.5× the casual. Solo gaps and the
   doubling idler's trough warn; the late idler gaps are asserted for an idler following the
   crown. N17: a friend who joins on day 30 reaches the day-30 casual within 12 days, asserted for
   two players (five players warn).
4. **There is always something to buy.** N5: nothing affordable for at most 30 s in the first 10
   online minutes of runs 1-5. N6: at most 120 s online with nothing affordable. N7: at least 90%
   of casual check-ins in days 1-30 contain a purchase.
5. **Every nuke feels faster.** N11: run N+1 passes run N's gain in at most 65% / 95% / 100% of
   its time (early / mid / late medians; warn-only until R7). N12: combined power per nuke
   ×1.5-2.5 / ×1.15-1.6 / ×1.1-1.5. N13: five consecutive nukes together below ×1.3 with nothing
   opening in the next three fails the build.
6. **The tree lasts months.** N14: 6-10 nodes bought at the first nuke, a median of at least 2
   later. N15: the optimal player has at most 45% lit at day 30 and never 100% before day 90; the
   casual at least 45% at day 180 (warning).
7. **Absence never hurts.** N18: the Night Shift pays 100% inside 12 h, rising to 48 h; a full
   window stops accrual and destroys nothing. Only your own button takes progress.
8. **Precious things are never at risk; no casino.** N19: scrap 0.8-2 a day for a casual (7-day
   average from day 2, one-offs excluded), at least 25 by day 30, nobody above 2.5; single 7-day
   windows warn. Glass and scrap are never traded, gifted, wagered, stolen or sold; no command
   writes another base.
9. **Randomness is visible; no hidden catch-up.** N20: timers and odds as printed (flotsam every
   4-10 min for 13 s; the Magnet at 20/23/24 h). An Odds sheet in Settings from R1, repeated in the
   Logbook from R4. Late Tide is labelled to its own player, never on boards or shared surfaces.
10. **Numbers stay meaningful.** N21: glass is the fifth root of lifetime (`L0` 5e5), Glow
    `1 + 0.25√G`. N23: run 1 ends at 1e10-1e12 supplies made; under 1e150 over 180 days; always
    finite. N22: a nuke counts only if it adds at least 10% to glass ever.
11. **Respect the clock.** Idle timers (Night Shift, Magnet, Toolbelt cooldowns, the Freighter)
    run on the game clock; active timers (taps, Hustle, flotsam, buffs, felling, the cinematic)
    run on real seconds and never speed up with the demo clock (CLAUDE.md 6.3.9, amended).

Also asserted: N4 first hand within 2 min; N24 settle is path-independent; N25 tap batches of at
most 1 s or 30 taps; N26 the Blast Map's shape (361 nodes, ×10 per ring band, small nodes at most
52%, never three small in a row); N27 touch targets at least 44 CSS px and the tap target at least
120 px tall on a phone. Month-1 bands: the casual makes 2-8 nukes and 300-2,000 glass in the first
week (asserted alone) and 20-40 Wipe Days by day 30. Casual runs after day 30 of at most 3 days
are a warning (the late wall, section 6).

Retired with the redesign: the 25% legacy cap and its four enforcements, "8 check-ins is about
1.6×", the day-14 and day-18 floors, storage caps as the check-in driver, the casino and PvP rules.

## 3. Time scales and loops

| Scale | Loop | What the player does |
| --- | --- | --- |
| seconds | tap, Hustle, felling, flotsam (13 s), buffs (12-60 s) | tap hard, catch flotsam |
| minutes | lines, milestones, hands, eras, Afterglow (30 min) | buy the crown, hire, climb |
| hours | run 1 (46-48 min of play; day-1 21:00 casual), runs 2-5 | check in, Collect |
| days | runs of a day (month 1), 4-5 days (months 2-6); the Magnet | nuke when crowned |
| weeks | the Freighter, Pockets, crew ranks, the agenda | pick a loadout, load a ship |
| months | the Blast Map, Logbook, ranks (7-9 months to max) | grow a sector |

Taps start lines, lines make the lifetime that pays glass, and glass buys nodes that make the
next run faster.

**Check-ins.** The design player is the casual: 08:00, 13:00 and 21:00, about five minutes each at
4 taps a second. The idler comes twice a day; the active player eight times for ten minutes. A
check-in is Collect, a few crowned buys and, about once a day in month 1, the Big Red. The **Night
Shift** (12 h at the start) covers the casual's 21:00-08:00 night from day 1; Deep Cellars (1
glass) covers the idler's 13 hours. Every purchase is instant; no timer gates one.

## 4. World and names

Own IP (D43): nothing references another game's items, sites or icons. The island is
**Saltmarsh**; its clock runs at UTC+1 with no daylight saving (decision 2). Ids never change when
a display name does, so a rename is a locale edit (`07` 7.3 has the checklist). Name passes: R1,
R2 and R4; the eras lean to keeping the five Rust grades.

New names are *(proposal)*; "kept" names exist in the W-phase game.

| Name | id | What |
| --- | --- | --- |
| Supplies *(proposal)* | `supplies` | the one run currency |
| Crater Glass, Glow *(proposal)* | `glass`, `glow` | prestige currency; its multiplier |
| Morale, Hustle *(proposal)* | `morale`, `hustle` | Logbook multiplier; tap meter |
| Scrap (kept) | `scrap` | the rare currency |
| Beachcomber, Ship Breaker, Reactor *(proposal)* | `beachcomber` ... | lines 1, 13, 14 |
| Campfire ... Radio Mast (kept) | `campfire` ... `radio_mast` | lines 2-12 |
| Driftwood ... Power Cells *(proposal)* | `timber` ... `cell` | the 14 product badges |
| Mara ... Tamsin (kept); Gus, Vera *(proposal)* | crew ids | the 14 hands |
| Twig, Timber, Stone, Sheet Metal, Armored (kept) | `twig` ... `hqm` | eras |
| Rock ... Power Tools (kept) | tool ids | Grip rungs |
| Lone Pine, Outcrop, Ore Seam, Sulfur Vent, The Wreck | `tree` ... `wreck` | tap targets |
| Drift Crate, Fuel Drum, Adrenaline Kit *(proposal)* | `crate` ... | flotsam, R1 |
| Drowned Drone, Sealed Locker, Message in a Bottle | `drowned_drone` ... | flotsam, R4-R5 |
| Night Shift, the Kettle, the Big Red *(proposal)* | `night_shift` ... | offline; missile; button |
| Wipe Day #N, small blast, Afterglow, Fizzle | `fizzle` | the nuke's beats |
| Blast Map, Ground Zero; the eight sectors | `ground_zero`, sector ids | the tree *(proposal)* |
| Calloused Hands, Old Friends, Starter Kit | `steady_hands` ... | ring-1 nodes (perk ids) |
| Logbook, the Magnet, Crew rank, Pocket | `magnet`, `rank`, `pocket` | meta *(proposal)* |
| Foreman, Dead Hand; Rush, Grit, Flare | `foreman` ... | automation; Toolbelt |
| Long Night, Rich Tides, Storm Season, Quiet Hands | `long_nights` ... | Dares *(proposal)* |
| Blowback, Island Count, the Freighter, Late Tide | | social *(proposal)* |
| The Barge, the Crossing, Sea Charts *(proposal)* | `barge`, `sea_charts` | second layer, later |

"Starter Kit" (`packed_crate`) is on the R1 naming-pass list: a common phrase, but also a Cookie
Clicker upgrade. The Radio Mast's product is `broadcast`, never `signal`.

**Rejected names** (`07` 7.2): Blueprint Fragments (a Rust item that promises crafting), Rads,
Fallout, Vault, Glowheads and Caps (Fallout), Stash and Recycler (Rust), Half-life (a Valve
title), Dredge, Ashfall, Exodus and Ark (other games' titles), Keepsakes (another game's item
category).

## 5. Systems

### 5.1 The run (R1)

A **run** is one island's life between two nukes. **Supplies** is the only run currency: each
line sells what it makes the moment it makes it; nothing is stocked, capped or carried over. Each
line shows one **product** badge (driftwood, smoked fish, hemp, rope, planks, charcoal, ingots,
leather, lamp oil, fish crates, batteries, broadcasts, steel plates, power cells) in the shop row,
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
fixed order: base, add, milestones, `(1 + Σinc)`, `Πmore` (Line Mk, island upgrades, eras, ranks,
Grit, nodes), Glow, Morale, buffs.

**Manned and unmanned lines.** A manned line (a hand hired) produces continuously, also while you
are away inside the Night Shift. An unmanned line runs only in cycles that credited taps start: at
most one cycle in flight, started only when the line is idle, tracked by a busy-until `readyAt`.
A started cycle pays at its end even if tapping stopped. So one tap a second on a 19-second Kiln
runs it once every 19 seconds. Speed milestones pay fully only with a hand: one more reason to
hire.

**Milestones.** Per line: 10 owned ×2, 25 speed ×2, 50 speed ×2, 100 ×2, 200 ×3, 300 ×3, 400 ×4,
500-900 ×2 each, 1,000 ×5, then ×2 every 100. A speed milestone that would take the cycle under
0.1 s doubles the payout instead. Roster (every unlocked line): 25 all ×2, 100 all ×2, 250 all ×3;
once reached it is kept for the run, so buying an era never lowers income. The row always shows
the next one ("38/50 → speed ×2"). Buildings redraw at 1, 25 and 100 owned.

**The shelf** (44 one-off upgrades a run; with 14 hands, 58 purchases):

- **Grip** (4 rungs after Rock): Stone Tools 60, Iron Tools 6k, Salvaged Tools 6M, Power Tools 6B.
  Each doubles the flat tap and adds 0.4% of the full rate to every tap.
- **Line Mk II and Mk III** (28): line ×3 each, priced `c_i × 10^4` (25 owned) and `c_i × 10^8`
  (50 owned).
- **Island upgrades** (8): all lines ×2 each, from Sorting Tables (1M) to Steam Hammer (1e34); the
  shelf shows one at a time, and each adds a prop to the island.
- **Eras** (4): Timber 1.5k, Stone 3M, Sheet Metal 20B, Armored 400T (after Wipe Day #2). Each is
  all lines ×2 (×16 at Armored) and opens three lines (two at Armored).

40 shelf upgrades are Pocket-eligible (every Grip rung, Line Mk and island upgrade; never an era).
Works nodes may cut prices, capped at ×0.25 per shelf kind and ×0.5 for eras.

**Eras and targets.** Each era changes the tap target and how many taps fell it: Lone Pine (40,
"Timber!"), Outcrop (60, "Crumble!"), Ore Seam (80, "Rich vein!"), Sulfur Vent (100, "Pop!"), The
Wreck (120, "Cracked open!"). An era purchase plays about 1.2 s of show: a last fell, the base
redrawn in the tier colour, three staked plots with price signs.

### 5.2 The tap (R1)

```
tapValue  = (2^grip × G + p × fullRate) × T × Hustle × Afterglow × B × crit
fellBonus = 10 × tapValue (without crit), once every N taps (40, 60, 80, 100, 120)
```

`G` is the global fold on the flat part (eras, island upgrades, roster, Grit, Glow, Morale); `p`
is 0.4% per Grip rung; `fullRate` is every owned line as if manned, buffs included; `T` the tap
nodes (Calloused Hands +50%); `B` tap buffs (Adrenaline ×100, Rush ×5); `crit` ×10 on a crit
(Lucky Swing: 5% of taps, a Grip node). With the whole tree the steady coefficient
`c = taps/s × p × T × Hustle × crit` stays at or under 0.6 (a content check).

- **Hustle**, the tap meter: +1 per credited tap, 0-100; the tap multiplier runs from ×1 to ×2
  (×2.25 at most with Grip nodes). It holds 2 s after the last tap, then drains 10 a second.
- **The token bucket:** up to 15 credited taps a second, bursts of 45. Taps over it still shake
  the target but pay nothing, silently; an autoclicker earns what 15 taps do. Taps travel in
  batches (about 1 s or 30 taps); the counter reacts on the frame.
- **Hold to work:** a press held 0.35 s counts 4 taps a second until release. **Felling** adds
  `10/N` to tap income: +25% in Twig down to +8% in Armored.

### 5.3 Flotsam (R1, more kinds in R4 and R5)

One flotsam every 4-10 minutes on a seeded schedule while the page is open, 1.5× as often in
rain, floating 13 s with a pie ring (Tide nodes extend it to 25 s). It glows but never takes the
crown. Missed flotsam costs nothing.

| Flotsam | Weight | Effect | Ships |
| --- | --- | --- | --- |
| Drift Crate | 45 | `max(1 min, min(15% of held supplies, 10 min))` of output | R1 |
| Fuel Drum | 40 | Rally: all lines ×4 for 60 s | R1 |
| Adrenaline Kit | 6 | taps ×100 for 12 s | R1 |
| Drowned Drone | 7 | one owned line ×12 for 30 s | R4 |
| Sealed Locker | 1 | 1 scrap | R5 |
| Message in a Bottle | 0.5 | a Logbook secret's hint plus a Drift Crate | R4 |

Odds are renormalised over shipped kinds and printed (R1-R3: crate 49.5%, drum 44.0%, kit 6.6%).
Different buffs multiply; the same buff caught again restarts its timer. **Run 1's guaranteed
crate:** until the first catch, every spawn is a Drift Crate paying a flat 2 minutes of output,
exactly every 3:00. Later runs have none.

### 5.4 Hands and the automation ladder (R1, R2, R5)

A hand is a named crew member hired onto one line (price `300 × c_i`, needs one unit); from then
on the line runs forever. No tiredness, injuries, gear or levels. Hiring has its own row under
each line, one button and one price.

**The automation ladder:** hands, one line at a time, from about 0:41 of run 1, and bulk buying
from the second hand (R1); the start of a run with Starter Kit, Old Friends (Mara kept) and
Afterglow from Wipe Day #1, and hands for lines 1-3 kept from #3, extended by the Old Crew nodes
(R2); buying lines with the Foreman from #7 (lines 1-6) and #20 (all), calling flotsam with the
Flare from #15, and the nuke itself with Dead Hand from #25, opt-in and online only (R5).

### 5.5 The Night Shift and welcome back (R1)

- Manned lines produce at **100%** while you are away, every lasting multiplier included, for
  **12 h** from your last command (taps, buys or pings). Deep Cellars (+4 h), Wipe Day #10 (+4 h),
  more Bunker nodes and Long Night's reward raise it to a ceiling of **48 h** (12 + 4 + 32 from
  nodes); the Wipe Day Rush keystone halves it.
- A full window stops accrual and destroys nothing. "Night Shift over" is the one notification on
  by default. A visible tab pings every 5 minutes; you count as away 6 minutes after your last
  command.
- Taps, Hustle, new unmanned cycles, flotsam and Afterglow stop while away; cooldowns, the Magnet
  and a cycle already in flight keep running.
- **Welcome back**, after at least an hour away: one card, one primary, **Collect**. It never
  crowns the nuke. Collect banks the gain, empties the Magnet's tray and (from R5) runs the
  Foreman's pass. No hands, no card: a hint points at the best hand row instead.

### 5.6 The advisor's crown (R1; the Big Red from R2)

Exactly one thing is crowned, in signal orange; first match wins: (1) the Big Red when
recommended (5.7); (2) the next era, affordable within 30 s; (3) a hand for the top-earning
unmanned line, affordable within 30 s; (4) the best-payback purchase affordable now (`price /
Δincome`, with the player's own tap rate); (5) waiting Blowback crates (R6); (6) a ready Toolbelt
skill (R5); (7) otherwise "Tap the {target}". Flotsam and the Magnet glow but never take it.

**One crown per view:** while the crown sits on the Big Red, crates, a skill or the tap hint, the
collapsed drawer shows no orange row; the expanded drawer always crowns one row. The era comes
before the hand. One-line hints (20 in run 1, `02` 11.2) retire after two uses. Never tease
unshipped content: locked things show only real, reachable reasons.

### 5.7 The Big Red (R2)

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

**When to press.** The card and chip show "+12 now · 9/h now · peak 14/h". The advisor crowns the
Big Red (first match): the first nuke at a delta of 10 (guided); doubling (gain ≥ glass ever); a
slowing run (at least 10 min old, rate under 80% of its peak) when the nuke counts; or a counting
nuke in a run at least 20 h old. The crown is sticky, waits while a buff runs or a Dare's goal is
unmet, and never shows on welcome back. Rule 3's rate definition is an R2 tuning item.

**The Kettle** stands on the slope where the Signal stood and assembles as the yield grows: the
pad at 5e8 lifetime supplies in run 1 (minute 9-10; from the rebuild later), with a locked card
that says what the first launch needs; the frame at a yield of 5 (later 1% of glass ever); the
warhead when the nuke counts; fuel and steam when crowned. A "+1" glass floater rises from it.

**The press.** The cover card (danger style, never primary) shows the gain, "Glow ×1.79 → ×2.17",
what this Wipe Day unlocks, and what is kept and lost; **Flip the lid** or **Not yet**. Then
**hold 2 s** to launch, against a rising siren, with a crew one-liner ("I *just* fixed the
roof."). A cinematic of 6-8 s on real time: the crew row away, the Kettle flies one of 12 flight
variants (four in R2, eight more with the Logbook in R4), a flash, a fireball and a mushroom
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
crater, flights seen, agenda unlocks, kept hands, cosmetics, settings, and from later phases the
Logbook, scrap, ranks, Pockets, Toolbelt cooldowns, Blowback crates and Dare rewards. **Lost:**
supplies, every line unit, shelf upgrades (except pocketed ones), the era, hands not kept,
Hustle, buffs, the flotsam schedule. The Night Shift window refills.

**The agenda** (counted Wipe Days; only shipped content is ever named):

| Wipe Day | Unlock |
| --- | --- |
| 1 | Blast Map rings 1-2, Ground Zero, Glow, Afterglow, the crater; the Magnet and 3 scrap (R5) |
| 2 | the Armored era; Pocket slot 1 (R5) |
| 3 | hands for lines 1-3 survive nukes; ring 3 |
| 4 / 8 / 15 | Toolbelt: Rush / Grit / Flare (R5); #15 also Logbook secret hints (R4) |
| 5 | ring 4 (R3); Dares (R7) |
| 7 / 20 | the Foreman for lines 1-6 / all lines (R5) |
| 10 | ring 5, keystone slot 1, Night Shift +4 h (R3) |
| 20 | ring 6, keystone slot 2 (R3) |
| 25 | Dead Hand's node becomes buyable (R5) |
| 30 / 40 / 50 | rings 7 / 8 / 9; keystone slot 3 at 40 (R7) |

New flights and crater-sign styles arrive along the way. A player past a gate when its phase
ships gets it at once, with one "New on Saltmarsh" card.

### 5.8 The Blast Map (R2, R3, R7)

- **Shape:** Ground Zero at the centre; 8 sectors of 45°, clockwise Grip, Crew, Works, Tide,
  Bunker, Blast, Logbook, Scrapyard; 9 rings of 2, 3, 4, 5, 5, 6, 6, 7, 7 nodes per sector: 45 per
  sector, **361** in all. Prerequisites are OR within a sector; completions need a whole ring.
- **Waves:** wave 1 is rings 1-3 (73 with Ground Zero) in R2; wave 2 rings 4-6 reach 178 nodes in
  R3, 191 in R4 and 201 in R5 as their systems ship; wave 3 rings 7-9 sit in data from R3 (so the
  simulator measures all 361) and show in R7. Ring gates: #1, #1, #3, #5, #10, #20, #30, #40, #50.
- **Node types:** 187 small (one stat), 70 notable (a named mechanic), 16 keystone (a rule-bending
  gain with a printed downside), 36 unlock (a new toy), 36 automation, 16 completion. Only
  unlocks, automations and keystones may need new code. Never three small nodes in a row.
- **Sectors:** Grip (taps, Hustle, crits, Afterglow), Crew (hands, kept hands), Works (lines,
  milestones, prices), Tide (flotsam), Bunker (offline, the Night Shift), Blast (glass and Glow),
  Logbook (Morale, secrets), Scrapyard (Pockets, the Magnet, ranks). Each has scene-changing nodes.
- **Costs:** one ladder of playful numbers, ×10 per ring: ring 1 costs 1-4 glass, ring 4 about
  222-1,111, ring 9 tens of millions; keystones cost 7,777 (ring 5) and 7.77M (ring 8). The whole
  tree costs about 2.9B glass, about 1e53 lifetime supplies.
- **The first basket:** Starter Kit, Calloused Hands, Deep Cellars, Hot Coals, Old Friends and
  Bigger Payload, 6 nodes for 9 glass, with 1 left over. Later a casual buys a median of 2-3 a nuke.
- **Keystones:** owned forever, work only when slotted; exactly three slots (Wipe Days #10, #20,
  #40), changed free on the rebuild screen. Examples: Wipe Day Rush (Afterglow holds ×5 for 60
  min; Night Shift ×0.5), Bunker Mentality (offline ×1.5; no flotsam), Lone Wolf (taps ×50; no
  hands). A keystone may at most double the income of the archetype it targets.
- **Effects** are data `{stat, op, value, scope?, per?, max?, when?}` with ops add, inc, more,
  set, unlock; every `per` carries a `max`; guarded numbers (the bucket, the 48 h ceiling, the 10%
  rule, scrap income, social systems) have no node.
- **Permanent:** nodes are never refunded and apply at once. A balance patch that changes bought
  nodes ships with a full free respec (all glass back); there is no partial or paid respec.

### 5.9 Meta layers (R4, R5, R7)

- **Logbook and Morale (R4).** The crew's diary of achievements: 120 pages at launch (30 secrets,
  11 categories), growing to about 250 by R7. Morale = `1 + 0.02 × pages`, raised to 0.05 a page by
  Logbook nodes; it multiplies every line and tap. Every 25 pages pay 1 scrap. Secrets show "???"
  with a one-line hint from Wipe Day #15, Old Maps, a Message in a Bottle or a friend's first find.
- **Scrap and the Magnet (R5).** A free crane over the bay, on the game clock: growing 0-20 h; an
  early haul at 20-23 h (50%: 1 scrap); sure at 23-24 h (1 scrap, 10% rich: 2-3); at 24 h it hauls
  by itself into the tray. About 1 scrap a day; winch nodes bring it to 16/19/20 h.
- **Crew ranks (R5).** Five ranks per hand at 1, 2, 4, 8 and 16 scrap, each ×2 to that line,
  kept forever. **Ranks rise together:** no hand is ever two ranks above another. 434 scrap maxes
  all 14, about 7-9 months. Scrapyard nodes raise the step to ×2.5 at most.
- **Pockets (R5).** Three slots at 5, 15 and 40 scrap: slot 1 from Wipe Day #2, slots 2 and 3
  through the nodes `deep_pockets` and `sewn_lining`. Each keeps one shelf upgrade active from the
  first second of every run. A full slot swaps only before the run's first purchase.
- **The Foreman (R5).** From Wipe Day #7 (lines 1-6) and #20 (all): buys units of manned lines,
  the lowest payback first, at most one buy a second while the page is visible, and one
  deterministic pass at Collect. It always keeps the crowned purchase's price in reserve. Never
  hands, upgrades, eras, nodes or the Big Red. A switch in Crew, on when unlocked.
- **Dead Hand (R5).** The `dead_hand` node (22.2k glass), buyable from Wipe Day #25, off by
  default: it presses the Big Red at 25 / 50 / 100 / 200% of glass ever or "when crowned". Only
  in a visible, focused tab, only for a counted nuke, after a 5-second toast with Stop; never
  offline or from Discord. It plays a short landing instead of the cinematic.
- **The Toolbelt (R5).** Three round buttons, never a fourth. Rush (#4): taps ×5 for 30 s, 10 min
  cooldown. Grit (#8): all lines ×1.05 for the rest of the run, stacking to 10, every 8 h: the
  casual's check-in ritual. Flare (#15): calls one flotsam now, every 60 min; the `flare_gun`
  node lets the player choose crate, drum or kit. Effects on real seconds, cooldowns on the game
  clock.
- **Dares (R7).** From Wipe Day #5, one opt-in Dare per run, picked on the rebuild screen, with
  constraint, goal and reward shown in full; abandon any time, free. A met goal pays a permanent
  effect of at most +25% on one stat at the next nuke. The launch four reuse the season-modifier
  ids: Long Night (no Night Shift; reward Night Shift +4 h), Rich Tides, Storm Season, Quiet Hands.
  Eight more are designed for later (twelve at most).
- **The Crossing (later, gated).** A second reset above the nuke, to a new island with its own
  curve, paying **Sea Charts** `floor(5 × log10(glass ever / 1e4))`. It is built only when its
  trigger fires (a simulator call, the late-wall decision) and never shown before. It keeps the
  Logbook, scrap, ranks, Pockets, Dare rewards, the Wipe Day count, agenda unlocks and cosmetics.
- **Creeds (deferred).** At most three (Scrappers, Bunker Folk, Tinkers), only if a playtest
  after R7 finds runs samey.

### 5.10 Friends (R2, R4, R6)

Every social number is a count, a time, a ratio, or an amount in the viewer's own numbers. No
trading, gifting, PvP or tap goals; co-op pays only scrap and cosmetics; a friend's effect on you
is derived lazily on your own settle, never written into your base.

- **Nuke news (R2).** Every counted Wipe Day posts to the feed and `#wipe-day-idle`: "Ben pressed
  the Big Red. Wipe Day #1 on Saltmarsh: +10 crater glass." One news nuke per player per 30 min;
  quick repeats fold into one line; milestones and records always post. Small blasts never post.
  The Discord post carries the postcard image from R6.
- **Blowback (R6).** Each friend's Wipe Day washes 3 crates onto every other shore, at most 9
  waiting, no expiry. Each pays the Drift Crate's formula in the receiver's own run, so a full
  shore is worth 9 minutes to 1 h 30 min of their own output.
- **The Island Count (R6).** Every Wipe Day by anyone since the cut-over. Tiers at 10, 25, 50,
  100, 175 and 250 unlock a cosmetic for everyone (a scorched flag first, a gold lid last).
- **The Freighter (R6).** A weekly co-op ship, grounded from Monday 00:00 UTC. A load costs one
  hour of your own output; at most 6 loads a week. Tiers I, II and III at an average of 2, 4 and 6
  loads per active player; each tier pays 1 scrap to every loader (at most 3 a week); tier III
  raises a pennant. Nobody is listed as not having loaded.
- **Late Tide (R6).** Below 50% of the median glass ever of the other players active in the last
  14 days, nukes pay ×3 glass, never past that median. Shown openly to that player only.
- **Boards (R6).** Seven boards with a monthly and an all-time window, nobody ever reset: Wipe
  Days, Best blast (a ratio), Fastest comeback (a ratio), Nodes lit, Logbook, Flotsam, Freighter
  loads. Zero is never shown. The Hall keeps season 1 as "the old world".
- **Visit (R6 stretch).** A friend's island, read-only, without amounts, Glow or activity times.
- **Shared first finds (R4).** The first player to log a secret opens its hint for everyone; the
  feed names the hint, never the secret.
- **The Discord companion v2 (R2).** The `/base` card shows the idle rate, the glass chip, the
  Night Shift bar and the Big Red's yield. Its only command is **Collect** (which also runs the
  Foreman's pass); no taps, buying or nuke from Discord. A monthly post replaces season news.
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

## 6. Progression

All times and amounts are the P1 model's (`10` 4); the simulator re-measures them.

**The first ten minutes** (phone, continuous play at 6 taps a second):

| Time | What happens |
| --- | --- |
| 0:00 | Dawn, a twig lean-to, a glowing pine. The only text: "Tap the tree." |
| 0:02 | The drawer slides up with one crowned row: Beachcomber, 6. |
| 0:07 | Forty taps fell the tree ("Timber!"); a new one pops up. |
| 0:08 | Stone Tools (60): taps ×2 and +0.4% of supplies per second. |
| 0:12 | 10 Beachcombers: ×2. |
| 0:36 | Timber era (1.5k): a cabin, the outcrop, three new lines. |
| 0:41 | Hire Mara (1.8k): the first line runs without taps. The nav row slides in. |
| 1:30 | The second hand; the ×10 / ×100 / Max toggle appears. |
| 3:00 | The first crate: a flat 2 minutes of output, back every 3 minutes until caught. |
| 3:01 | Sorting Tables (1M): everything ×2. |
| 4:30 | Stone era (3M); the target becomes an ore seam. |
| 9-10 min | At 5e8 made the Kettle's taped "DO NOT" pad rises, with its locked card (R2). |

R1 may slow the very first minute (for example a dearer Timber era) if playtests find it rushed,
within the asserted numbers.

**The first hour.** From minute 10 taps are about 14% of income outside bursts. The Kettle's
frame goes up at a yield of 5 (about minute 12-13), Sheet Metal lands at about minute 42-46, and
about seven or eight flotsam are caught. **The first nuke comes at about 46-48 minutes**, worth 10
glass; an autoclicker cannot bring it under 25 minutes.

**Day 1, casual.** 08:00: about 40 purchases, the Timber era and Mara. 13:00: one Collect after
five hours of Night Shift, the Stone era, four hands and Sorting Tables. 21:00: about 40B made, the
pad and the Kettle's frame up; a minute of tapping takes the yield to 10, and **the first nuke
lands at the day-1 21:00 check-in**. The 11 hours to 08:00 fit the 12-hour Night Shift.

**Run 2.** Starter Kit units and Mara are already working, taps carry Glow ×1.79, Calloused Hands
and Afterglow ×3, and run 1's whole gain is passed in under half its time. Each postcard names the
next unlock.

**The first week** (alone): the casual makes about 7 Wipe Days and 1,050 glass ever (17% of the
tree, about 60 of the 72 nodes of rings 1-3); the active player about 12 and 10.8k; the idler 4
and about 230. Armored opens at Wipe Day #2 and is first reached in run 3 or 4. The first 3 scrap
rank three hands, and a Pocket slot follows within days. In a group that starts together, Late
Tide lifts the casual's week to about 10k glass.

**The first month.** Runs settle at about a day: the casual makes about 24 Wipe Days alone (20-22
in a group of five), the active player 27. By day 30 the casual has about 42k glass ever (64k in
the group) and 34% of the tree; the optimal player 36-37%. Rings 4-6 and two keystone slots open;
the Logbook fills; the casual has about 47-54 scrap, ranks 1-2 on every hand. Each counted Wipe
Day adds 10-25% to glass ever, about ×1.2 of output power. Group gaps at day 30: active 1.06,
optimal 1.34, idler 0.67 of the casual.

**Months 2-6 and the late wall.** Casual runs stretch to about 4.5 days. At day 90 the casual has
about 238k glass ever, 41 Wipe Days and 43% of the tree; at day 180, about 594k, 50 and 47%.
Rings 7-9 open at Wipe Days #30, #40 and #50 in R7, but cost 200k glass and up, out of reach until
about day 150. After day 180 runs reach about 10 days, and the tree is 57% lit at day 365 (60%
for the active and optimal players). Ranks, Morale and Dares keep growing with real days. This is
the **late wall** (`10` 5), an open owner choice before R7 (section 10): option 1 accepts a slow
outer tree and lowers the Crossing's trigger to "45% lit and N13 firing" (months 4-6); option 2
adds a calendar-fair power source (the deepening crater, `05` 10.3), designed and simulated
alongside.

**Coming back after two days.** One card, one Collect: the window's gain, the Magnet's scrap,
friends' crates, new Logbook pages. The stalled run is over 20 hours old, so if the nuke counts the
next crown is the Big Red. Nothing was lost, only paused.

## 7. Content volume per phase

- **Lines** 14, **hands** 14, **shelf upgrades** 44 (R1); lines 13-14 are reached from R2, when
  the Armored era opens after Wipe Day #2.
- **Eras** 5 and **targets** 5 (R1; Armored and the Wreck reachable from R2).
- **Flotsam kinds** 3 in R1 (crate, drum, kit), 5 in R4 (drone, bottle), 6 in R5 (locker).
- **Blast Map** 73 nodes in R2, 178 in R3, 191 in R4, 201 in R5, 361 in R7; 16 keystones, three
  slots.
- **Flight variants** 4 in R2 (U-Turn, Loop-the-Loop, Sputter and Drop, Fizzle), 12 in R4.
- **Logbook** 120 pages in R4 (30 secrets), about 40 more in R5, 40 in R6 and 50 in R7: about 250.
- **Toolbelt** 3 skills in R5. **Dares** 4 in R7, 8 more later (12 at most).
- **Social** in R6: 7 boards, 6 Island Count tiers, the Freighter's 3 tiers; 4 notification kinds.
- **Later, gated:** the Crossing and its island, at most 3 creeds, a sea layer.

## 8. Economy

| Currency | Sources | Sinks |
| --- | --- | --- |
| Supplies (a run) | taps, fells, lines, flotsam, Blowback | lines, hands, shelf, eras, loads |
| Glass ever | every nuke's gain (delta × multipliers) | none: drives Glow, never falls |
| Glass held | the same gains, plus granted glass | Blast Map nodes only |
| Scrap | Magnet, Locker, pages, Freighter, 3 at #1 | crew ranks (434), Pockets (60) |
| Sea Charts | the Crossing (reserved, not built) | Chart nodes (reserved) |

- **Supplies** grow without limit; prices grow geometrically per line, so there is always a sink.
  Nothing is capped or stocked; a full Night Shift only stops accrual.
- **Glass** grows as the fifth root of lifetime, and Glow as its square root: concave twice, so a
  several-fold lead in glass is a small lead in power, and tree prices rise ×10 per ring.
- **Scrap** is rare and scale-free: about 1.15 per Magnet haul, the Sealed Locker at 1% of
  flotsam, 1 per 25 pages, at most 3 a week from the Freighter. A casual earns 0.8-2 a day (7-day
  average), at least 25 by day 30, nobody above 2.5. Recorded from R2; the chip shows in R5 with
  its sinks. All 494 scrap of sinks take about ten months of a casual's scrap.
- **Founders' gift:** a Founder skin and 5 glass held (never Glow) for every season 1 base, at the
  cut-over.
- **Numbers** print with suffixes up to decillion (`1.2Dc`, 10^33), then scientific notation, with
  a setting for e-notation throughout (decision 20).

## 9. Deliberately not in the game

- **Cut** (`07` 2.2): Gather and its cooldown, the daily haul, storage caps, upkeep and decay,
  construction timers and builders, 22 of 23 stocked resources, the crafting web, blueprints and
  items, crew needs (arrivals, levels, tiredness, injuries, gear, bonds), daily tasks, the Den
  counter, contracts and the player market, the casino, NPC raids, defence, bandit camps and PvP,
  monthly seasons, the Signal and the 25% legacy cap.
- **Parked in git:** expeditions, the fogged map, sites, regions, keycodes and report cards, until
  the R6 playtest decides on a possible sea layer (decision 6).
- **No trading, no gifting, no PvP, no casino, no monthly reset.** "Month" survives only as a
  board window; one season row stays forever. Season 1 runs untouched on the old build and ends
  quietly at the R2 cut-over with one `pnpm season end` (decision 7).
- **No nuke from Discord**, no offline auto-nuke, no node autobuyer, no fourth Toolbelt button,
  no fourth keystone slot, no tap counts in anything social. No real money.

## 10. Open questions

- **The late wall** (decision 21): option 1 is the working plan; option 2 is designed and
  simulated alongside, and the final option is chosen before R7 from R6's simulations and
  playtest. It also settles the Crossing's player gate (`03` open question 2).
- **Names:** the passes in R1, R2 and R4 (Starter Kit renamed in R1; the eras lean to the five
  Rust grades; "Long Night" and "Quiet Hands" replace the locale's "Long Nights" and "Quiet
  Raiders").
- **Hand traits** (decision 19): decided in R5, leaning to one-line perks or none.
- **Creeds and a sea layer** wait for their triggers (after R7; the R6 playtest).

The owner's to-do list, phase by phase, is in `docs/roadmap.md`.
