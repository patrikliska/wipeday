# Wipe Day: the canonical vision for the redesign

Status: canon, 2026-10-07. Design director's synthesis of proposals A-D, three judges' verdicts,
the code survey and the reference research. Nothing in the repository was changed.

---

## 0. How to read this document

- **Authority.** The single source of truth for the redesign. It supersedes the four proposals,
  and `docs/game-design.md` and CLAUDE.md sections 1, 4, 6.3 and 8 where they disagree. In R0 it
  moves into those files and into decisions D127 onward.
- **Fixed or tunable.** Names, structures, rules, formula *shapes* and every system's
  disposition are canon. Numbers marked *(sim)* are starting constants the simulator may retune
  in data. Section 15's numbers are assertions; changing one needs a logged decision.
- **Names** are canon until the owner's pass (section 18). Ids are lowercase `snake_case`, are
  their own locale key, and keep today's ids wherever a thing survives, so drawn icons survive.
- **Section writers** expand and never contradict; a needed change of canon is raised as an
  open question.

---

## 1. The verdict

### 1.1 Base proposal

**A, "Wasteland Clicker", is the base.** All three judges ranked it first (8, 7.5 and 8). It has
the clearest first ten minutes, the only calibration model, the simplest settle, the safest
social layer and the fastest route to the full loop, and it delivers the brief literally: start
from nothing, tap like crazy, automate, nuke your own island. B and D keep the process the owner
dislikes; C's creeds have the best long-term variety but break priority 4.

### 1.2 What we took from the other proposals

| From | Graft |
| --- | --- |
| B | DOM/SVG tree views; engine before content; a fixed modifier order; flight variants; the deepening "WIPE DAY #N" crater; shared first finds; digit-pattern prices |
| C | The era-changing tap target; the postcard; a Toolbelt capped at three; Grit; the "+10% or it doesn't count" rule; the Barge; scale-free boards; creeds as a later option |
| D | The felling beat; the missile assembled on the slope; orange primary; the phone layout; Visit; the jam-jar lid |
| Judges | A 12-hour minimum window; cut-over only at the full loop; a slim tap path; never tease unshipped content |

### 1.3 Forks resolved

| Fork | Canon | Reason |
| --- | --- | --- |
| Base design | A | Unanimous; best UX, simplest engine |
| Run resources | One currency, **Supplies** (not "salvage", a near-synonym of scrap) | One number at 390 px; no chains |
| Prestige currency | **Crater Glass**: ever earned (never spent) plus held (spent) | Spending never hurts; one name |
| Prestige formula | Cube root of lifetime with a delta; Glow = √(glass ever) | A's model: linear Glow runs away |
| Rare currency | Scrap from a 24-hour Magnet, about 1-2 a day, never lost | "Make scrap RARE", literally |
| "Blueprint fragments" | Not used | A Rust item (D43) |
| Seasons | No forced reset; one perpetual row | Two resets fight for one emotion |
| Tap target | One per era: tree, outcrop, ore seam, sulfur vent, wreck | Rust's gather verb, existing art |
| Tap meter | One: **Hustle**, on taps only | No meter stacking |
| Bursts | Flotsam from R1; a Toolbelt of at most three from R5 | Casual check-ins need a routine |
| Creeds | Deferred, at most three, only if runs feel samey | Priority 4 |
| Offline | 100% inside a 12-48 h window | One number; covers the 11-hour night |
| Missile | Assembled visually; no purchases | No decision before the peak |
| Tree | 361 nodes, three waves, React DOM and SVG | "MASSIVE", polished, one renderer |
| Expeditions / crafting | Parked / cut (chains only as an island trait) | One glance, no ratio homework |
| Co-op | The Freighter, in each player's own output-hours | Scale-free, idle-friendly |
| Numbers / autobuy | Finite doubles; never autobuy inside settle | Budget far below 1e308; closed-form settle |

---

## 2. Pitch and pillars

**Pitch.** You wash up on Saltmarsh with nothing. One tree stands on the rise. Tap it, and
supplies pour out. Spend them up a 14-rung ladder from beachcombers to a pre-war reactor. A line
without a hand only works while you tap; hire one and it runs forever, even while you sleep.
Meanwhile, on the slope, someone is bolting together a boiler on stilts with a traffic-cone
nose: *the Kettle*. Beside it, under a hinged lid, sits a fat red button. Press it, and your own
missile flattens your own island. The crater glass it leaves is all that lasts; spend it on the
Blast Map, 361 nodes around Ground Zero, and the next island goes up faster.

**Pillars** (they replace the five in `docs/game-design.md` section 1):

1. **One glance, one number, one tap.** One big number going up, one thing to tap, one crowned
   purchase. A mechanic that needs a sentence belongs in the tree, not in the run.
2. **Tap to start it, hire to keep it.** Every line starts manual and becomes automatic.
3. **Boom is progress.** The nuke is the only reset, chosen by the player and always showing what
   it gives. Losing everything is the funniest moment of the game.
4. **The island tells the story.** Every line, milestone, era and hand is drawn in the scene.
5. **Friends cheer, never compete for stock.** Social features count events, times and ratios,
   never amounts.

**Where Rust lives** (mechanics and mood, never names): the tool ladder, the five tiers re-climbed
every run, the gather verb on trees, rocks, ore and sulfur, scrap as the precious currency, jank
homemade engineering, and the wipe itself as the ritual ("Wipe Day" is the day you wipe your own
island).

---

## 3. Currencies and derived values

| Name (id) | Kind | Scope | Sources | Sinks | Display |
| --- | --- | --- | --- | --- | --- |
| **Supplies** (`supplies`) | run currency | one run | the target, lines, flotsam, Blowback | lines, hands, upgrades, eras, Freighter loads | the big counter, `12.4Qa`, with `+3.1T/s` under it |
| **Crater Glass** (`glass`) | prestige | forever | the nuke only (formula in 5.1; Late Tide; glass nodes) | Blast Map nodes only | green shard chip, `2,154`; never traded, gifted, wagered, sold or at risk |
| **Scrap** (`scrap`) | rare | forever | the Magnet (about 1 a day), Sealed Locker flotsam, +1 per 25 Logbook entries, the Freighter (at most 3 a week), 3 for the first nuke | crew ranks, Pocket slots | gold chip with small integers, `7`; never more than about 2 a day |
| **Sea Charts** (`sea_charts`) | second layer | forever | the Crossing (section 9), not built yet | Chart nodes | reserved |

Derived multipliers, never spent: **Glow** from glass ever (shown on the glass chip as `×2.35`,
and "before → after" on the nuke card), **Morale** from Logbook entries, and **Hustle**, the tap
meter (4.5). Supplies gets a new icon (a lashed bundle); `crate` stays the Drift Crate's, so no
two things share an icon.

---

## 4. The run

### 4.1 Resource model

One run currency. Timber, stone, ore and parts no longer exist as resources: each line sells what
it makes as supplies, but **the product is visible**. Each building puts its product in the scene
every cycle and has its own sound, the guard against "a spreadsheet in a Rust skin". In a run the
player watches supplies per second, the Hustle meter and the Kettle's yield.

### 4.2 Lines (the generators)

Fourteen lines across five eras. Eleven keep today's building ids and drawings; three are new.
Formulas live in `packages/content/data/lines.json5`. Constants are *(sim)*; `i` is the rung,
from 1 to 14:

- base cost `c_i = 6 × 16^(i−1)`; cost of the n-th unit `c_i × g_i^n`; buy-k and buy-max in
  closed form (geometric series);
- base output `r_i = 1.5 × 5.5^(i−1)` supplies per second per unit;
- cycle `t_i = 0.6 × 2^(i−1)` seconds;
- growth `g_i = 1.15 − 0.006 (i − 1)` (cheap lines steep, late lines gentle);
- hand price `h_i = 300 × c_i`.

| # | Line (id) | Era | Base cost | Base /s | Cycle | Growth | Hand | Product drawn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Beachcomber (`beachcomber`, new) | Twig | 6 | 1.5 | 0.6 s | 1.150 | Mara | driftwood |
| 2 | Campfire (`campfire`) | Twig | 96 | 8.25 | 1.2 s | 1.144 | Dax | smoked fish |
| 3 | Garden (`garden`) | Twig | 1.54k | 45 | 2.4 s | 1.138 | Ivo | vegetables |
| 4 | Loom (`loom`) | Timber | 24.6k | 250 | 4.8 s | 1.132 | Rook | rope coils |
| 5 | Workbench (`workbench`) | Timber | 393k | 1.37k | 9.6 s | 1.126 | Sela | planks |
| 6 | Charcoal Kiln (`kiln`) | Timber | 6.29M | 7.55k | 19 s | 1.120 | Bram | charcoal sacks |
| 7 | Furnace (`furnace`) | Stone | 101M | 41.5k | 38 s | 1.114 | Wren | ingots |
| 8 | Tannery (`tannery`) | Stone | 1.61B | 228k | 77 s | 1.108 | Otto | leather |
| 9 | Oil Press (`press`) | Stone | 25.8B | 1.26M | 2.6 min | 1.102 | Juno | oil drums |
| 10 | Dock (`dock`) | Sheet Metal | 412B | 6.91M | 5.1 min | 1.096 | Pike | fish crates |
| 11 | Generator (`generator`) | Sheet Metal | 6.6T | 38M | 10 min | 1.090 | Hale | sparks, batteries |
| 12 | Radio Mast (`radio_mast`) | Sheet Metal | 106T | 209M | 20 min | 1.084 | Tamsin | radio rings |
| 13 | Ship Breaker (`shipbreaker`, new) | Armored | 1.69Qa | 1.15B | 41 min | 1.078 | Gus (new) | steel plates |
| 14 | Reactor (`reactor`, new) | Armored | 27Qa | 6.32B | 82 min | 1.072 | Vera (new) | glowing cells |

Costs rise ×16 per rung and output ×5.5, so payback roughly triples per rung and the cheapest
output keeps moving between lines: the core buy decision. Buildings redraw at **1, 25 and 100
owned** (today's three drawn levels) with a count badge. Manned lines accrue continuously at
`owned × r_i × milestones × fold (13.5)`, the cycle bar being animation; unmanned lines are
credited in whole cycles by tap batches (4.5).

### 4.3 Ownership milestones

- **Per line:** 10 owned, ×2; 25 and 50, **speed ×2** (the bar visibly halves); 100, ×2; 200
  and 300, ×3; 400, ×4; then ×2 every 100 and ×5 at 1,000. Rows show the next one ("38/50 →
  speed ×2"). Below a 0.1 s cycle, speed milestones become payout.
- **Roster** (every unlocked line): 25, 100 and 250 of each give everything ×2, ×2 and ×3. This
  rewards buying broadly.

### 4.4 The upgrades shelf and eras

About 50 one-off purchases per run on the Upgrades tab (the beached skiff opens it):

- **Grip** (the tool ids): Rock (1 per tap), Stone Tools 60, Iron Tools 6k, Salvaged Tools 6M,
  Power Tools 6B; each doubles the base tap and adds 1% of supplies per second to it.
- **Line Mk II / III** (28): line ×3, at base × 10^4 (25 owned) and base × 10^8 (50 owned).
- **Island upgrades** (about 8): everything ×2 at 1M, 10B, 100T, 1e18, then every ×10^4.
- **Eras** (4):

| Era (tier id) | Cost (run 1) | Effect | Tap target | Fells after | Fell cry |
| --- | --- | --- | --- | --- | --- |
| Twig (`twig`) | start | lines 1-3 | Lone Pine (`tree`) | 40 taps | "Timber!" |
| Timber (`wood`) | 1.5k | ×2 everything, lines 4-6 | Outcrop (`stone`) | 60 | "Crumble!" |
| Stone (`stone`) | 3M | ×2, lines 7-9 | Ore Seam (`ore`) | 80 | "Rich vein!" |
| Sheet Metal (`metal`) | 20B | ×2, lines 10-12 | Sulfur Vent (`sulfur`) | 100 | "Pop!" |
| Armored (`hqm`) | 400T, needs nuke 2 | ×2, lines 13-14 | The Wreck (`wreck`, new) | 120 | "Cracked open!" |

An era lands instantly with today's tier pop: the base redraws in its colour, the target changes,
and the next three rows appear locked with prices (rule 6.3.3).

### 4.5 The click verb

**One verb: tap the target.** The camera is reframed so the target stands on the rise at about
40% of the phone's height, at least 120 CSS px tall, filling today's empty sky band.

- **Tap value** = `(2^grip + p × supplies per second) × Hustle × Afterglow × buffs`, then the
  global fold. `p` is 1% per Grip rung, plus Grip nodes (up to +25%).
- **Hold to work:** a held finger or mouse counts as 4 taps per second (accessibility).
- **Felling:** after N taps (40/60/80/100/120 by era) the target falls, crumbles, splits, pops or
  bursts open with today's fall and regrow art, paying 10 taps' value. The next one pops up
  within 0.3 s and taps during the pop count, so there is never dead time.
- **Hustle:** +1 per tap (max 100), holding 2 s, then −10 per second. It multiplies **tap value
  only**, ×1 to ×2 (×5 with Grip nodes), on real seconds.
- **Unmanned lines run while you tap.** A batch of `count` taps between `from` and `to` credits
  unmanned line `i` with `min(count, floor((to − from) / t_i) + 1)` cycles: deterministic on
  client and server.
- **Crits** come only from Grip nodes (*Lucky Swing*: 5% of taps ×10). They are derived from the
  seed and the tap count; there is no positional weak spot and no client-reported crit.
- **Click share** (asserted): taps are at least 50% of income in run 1's first minute and 5-25%
  from minute 10 outside bursts. An active hour is worth 2-3× an idle online hour, never more.

### 4.6 Flotsam (the golden event)

While the page is open, something drifts in from the sea **every 4-10 minutes** (1.5× as often in
rain) and floats for **13 s**. The schedule derives from the seed, run and index, so the client
draws it and the server checks `claim_flotsam` against its window. Run 1 guarantees one at 3:00;
the odds are printed in the Logbook.

| Flotsam (id) | Weight | Effect | Ships in |
| --- | --- | --- | --- |
| Drift Crate (`crate`) | 45% | `min(15% of held supplies, 15 min of output)` at once | R1 |
| Fuel Drum (`fuel_drum`) | 40% | **Rally**: all lines ×6 for 60 s | R1 |
| Adrenaline Kit (`adrenaline`) | 6% | taps ×300 for 12 s | R1 |
| Drowned Drone (`drowned_drone`) | 7% | one random line ×12 for 30 s | R4 |
| Sealed Locker (`sealed_locker`) | 1.5% | 1 scrap | R5 |
| Message in a Bottle (`bottle`) | 0.5% | a Logbook secret's hint plus a Drift Crate | R4 |

Until a kind ships, its weight is redistributed. Buffs multiply, so Rally × Adrenaline × Hustle
is the combo active players hunt.

### 4.7 Hands and the automation ladder

A **hand** is a named crew member hired onto one line (AdVenture Capitalist's manager), shown
walking to it; from then on the line runs forever, offline included. The 12 crew serve lines
1-12; Gus and Vera are new. Tiredness, injuries, gear, bonds, levels and arrivals are gone.

| Stage | What automates | By what |
| --- | --- | --- |
| Run 1, about 1:42 | one line at a time | hiring hands (lost on a nuke unless kept) |
| Run 1, after the 2nd hand | buying in bulk | the ×10 / ×100 / Max toggle appears |
| Nuke 1 | the start of a run | Starter Kit and Old Friends nodes, Afterglow |
| Nuke 3 | early hands | milestone: hands for lines 1-3 survive nukes; Old Crew nodes extend it |
| Nuke 7 | buying lines | the **Foreman** (7.5) |
| Nuke 15 | calling flotsam | Flare on the Toolbelt |
| Nuke 25 | the nuke itself | **Dead Hand**, opt-in (7.5) |

### 4.8 The Night Shift (offline)

Manned lines produce at **100% while you are away, up to the Night Shift window: 12 h at the
start, 48 h** with Bunker nodes. The window runs from the last command; a visible tab sends a
slim `ping` every 5 minutes. A full window stops accrual and destroys nothing. Unmanned lines,
Hustle, flotsam and Afterglow do nothing offline. The 12-hour base covers a casual player's
21:00 to 08:00 night from day 1.

### 4.9 The first ten minutes (canon script, phone, 390 px)

The times come from A's model (6 taps per second, greedy buyer); the simulator owns them.

| Time | What happens |
| --- | --- |
| 0:00 | Dawn: a twig lean-to, three crew at a dead fire, a big glowing pine on the rise. The only text: "Tap the tree." Each tap pops "+1" and sheds leaves. |
| 0:05 | The drawer slides up one crowned row: **Beachcomber, 6**. A figure walks to the tideline; the row says "Runs while you tap". |
| 0:12 | **Stone Tools** (60): taps ×2 and +1% of supplies per second. |
| 0:25 | 10 Beachcombers: "×2", a sorting table appears; "17/25 → speed ×2" under the row. |
| 0:40 | Campfire (96). The tree falls: "Timber!", and a new one pops up. |
| 1:42 | **Hire Mara** (1.8k): she walks to the tideline and the bar loops without taps. Hint: "Hands keep a line running, even while you're away." |
| 2:00 | **Timber era** (1.5k): a timber cabin pops up, the target becomes an outcrop, three locked rows appear with prices. |
| 3:00 | The first flotsam: a crate bobs in for 13 s, "+15 min of supplies". |
| 3:18 | Second hand (Dax); the ×10 / ×100 / Max toggle appears. |
| 6:42 | **Sorting Tables** (1M), the first island upgrade: everything ×2. |
| 8:42 | **Stone era** (3M); the target becomes an ore seam. |
| 10:00 | A taped "DO NOT" pad rises on the slope beside a drum with a red dome under a lid. Its card: "The first launch needs 10 glass, at 100B supplies made (now 31M)", with a progress bar: locked, with its reason, never hidden. |

### 4.10 Beyond the first ten minutes (targets)

- **First hour, active:** first glass at about 13 minutes, 5 hands by 18, Sheet Metal at 38, 6-8
  flotsam. **First nuke at 40-60 minutes**, about 10 glass.
- **First day, casual** (08:00, 13:00, 21:00, about 5 minutes each): the first nuke is ready at
  the **21:00 check-in of day 1**.
- **First week:** nukes 2-8; Armored around nuke 3; rings 1-3 about half lit; glass ever
  300-2,000.
- **First month:** 25-40 nukes; runs of a day (casual) or 2-6 hours (active); rings 4-6 open;
  the first keystone at nuke 10; hands at rank 1-2.
- **After two days away:** one card, one **Collect**; the run has stalled at the window, so the
  next crown is usually the Big Red. Two days away become one satisfying blast.

---

## 5. The nuke

### 5.1 Formula

- **Glass ever** `G = floor(cbrt(L / L0))`, with `L` the lifetime supplies across all runs
  (since the last Crossing) and `L0 = 1e8` *(sim)*. A nuke pays `G − glass already earned`
  (Cookie Clicker's delta), so repeated early nukes cannot farm glass. Doubling your glass takes
  8× the lifetime.

  | Lifetime supplies | 1e8 | 1e11 | 1e12 | 1e15 | 1e18 | 1e24 | 1e30 | 1e36 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Glass ever | 1 | 10 | 21 | 215 | 2,154 | 215k | 21.5M | 2.15B |

- **Glow** = `1 + k × √G`, `k = 0.25` *(sim)*: ×1.79 at 10, ×4.7 at 215, ×117 at 215k. Blast
  sector nodes raise `k`. **Spending glass never lowers Glow.**
- **Modifiers on the gain:** Blast-sector glass nodes, Late Tide ×2 (8.5). Dares add permanent
  effects, not glass.
- **Pressable:** the first nuke at a yield of 10 or more; later nukes at 1 or more. A nuke counts
  toward the agenda only if it adds at least 10% to glass ever, and the cover card says so.
- The shape is canon: a power law on lifetime with a delta, plus a concave passive. The simulator
  may retune `L0`, `k` and the exponent in data.

### 5.2 When to press

The Big Red's card always shows "**+12 now · 9/h now · peak 14/h**". The advisor crowns it when
the gain is at least glass ever (the doubling rule), or when this run's glass-per-hour has fallen
below 80% of its peak and the gain is at least 10% of glass ever. The first nuke is guided:
crowned at a yield of 10.

### 5.3 The Kettle and the Big Red

- **Where:** on the slope, in the Signal's old spot: a pad, the Kettle on it, the Big Red beside
  it on an oil drum.
- **The Kettle** assembles **visually** as the yield grows, with no purchases: the pad (minute 10
  of run 1, from the start of later runs); the frame, a boiler on stilts (yield at 10% of the
  threshold, later of glass ever); the warhead, a taped crate with a traffic-cone nose (pressable
  and agenda-counting); fuel and steam (crowned).
- **The Big Red:** a fat red dome bolted to the drum under a hinged **toilet-seat lid** in hazard
  tape, a half-peeled smiley sticker on it (the jam jar is the owner's alternative). It is
  **never** styled as the advisor's primary.
- **On phones**, when crowned, a hazard-framed "Big Red: +12 glass" chip with the crown mark
  appears above the drawer. The chip or the drum opens the cover card.

### 5.4 Staging (one emotional decision, then the show)

1. **Foreshadow** (minute 10): the pad and the taped drum appear.
2. **Ready:** steam curls, a crew member keeps glancing at it, gulls land on the Kettle.
3. **The cover card** (rule 6.3.4, danger style) shows only the **gain** (+12 glass, Glow ×1.79
   → ×2.35, "Next Wipe Day unlocks: …"), **kept** and **lost** (5.5), and two buttons: **Flip the
   lid** and **Not yet**. Loadout and Dare choices wait for the rebuild screen.
4. **Hold to launch** for 2 s: a rising hand-cranked siren and Android vibration; releasing early
   cancels. A crew one-liner rotates ("I *just* fixed the roof.").
5. **Cinematic**, 6-8 s on real time, skippable from the second nuke, a fade under reduced motion.
   The crew sprint to the rowboat (one runs back for the toaster). The Kettle sputters up, arcs
   over the sea and comes back: a **seeded flight variant** (U-turn, loop-the-loop,
   sputter-and-drop at R2), each collected in the Logbook. Then a white flash (a CSS overlay), a
   fireball on the `lights` layer (D47), a puff-sprite mushroom cloud, camera shake and a burnt
   orange tint. Every phase can be pinned for `web:shots`.
6. **The postcard:** "Greetings from Ground Zero", a crater with a **"WIPE DAY #N"** sign; on the
   back, the run time, glass, Glow before → after, best line, flotsam caught and the next unlock.
   Its primary is **Open the Blast Map** the first time (on the advisor's pulsing pick, so the
   reward lands in the same minute), then **Rebuild**.
7. **News:** "Patrik pressed the Big Red. Wipe Day #4 on Saltmarsh: +12 crater glass." goes to the
   feed and `#wipe-day-idle`; friends get Blowback (8.2).

### 5.5 Kept and lost

| Kept forever | Lost every nuke |
| --- | --- |
| glass (ever and held), Glow, every Blast Map node, keystones owned | supplies, every line unit, the shelf upgrades (except pocketed ones), the era |
| Logbook entries and Morale | hands (except those kept by milestones and nodes) |
| scrap, crew ranks, Pocket slots and their contents | Hustle, active buffs, pending flotsam, Toolbelt effects (cooldowns keep running) |
| the nuke count, records, cosmetics, the crater's depth | the Night Shift window (it refills) |

### 5.6 Afterglow and the rebuild

- **Rebuild screen:** keystone loadout (from nuke 10), an optional Dare (from nuke 5), then
  "Rebuild". The rowboat lands, a sapling pokes out of the glassy crater, a lean-to pops up.
- **Afterglow**, from nuke 1: taps ×3, halving every 5 minutes *(sim)*, the wipe-day rush of every
  run. The sky starts green and clears over 10 minutes while ash falls.
- **The crater remembers:** it deepens by √(nukes), and its sign counts Wipe Days.

### 5.7 Run lengths and acceleration (asserted)

| Phase | Run (active / casual) | Gain vs glass ever | Run N+1 passes run N's lifetime gain in |
| --- | --- | --- | --- |
| First nuke | 40-60 min / day-1 evening | 10 (first) | n/a |
| Runs 2-5 | 15-60 min / about a day | at least ×1 (doubling) | ≤ 40% of run N's time |
| Mid (weeks 2-4) | 2-6 h / a day | ×0.5-1 | ≤ 50% |
| Late (month 2 on) | 1-3 days | ×0.2-0.5; a new ring or unlock every 5-10 nukes | ≤ 65% |

Combined power per nuke: ×2-3 early, ×1.5-2 mid, ×1.2-1.5 late (N12). Floors: N2 and N15.

### 5.8 The agenda (nuke-count milestones)

Shown on every postcard as "Next Wipe Day unlocks …". **It lists only shipped content**; when a
later phase ships, players past a gate get it at once, with its hint.

| Nuke | Unlock (phase it ships in) |
| --- | --- |
| 1 | Blast Map rings 1-2, Glow, Afterglow (R2); the Magnet (R5) |
| 2 | the Armored era (R2); Pocket slot 1 (R5) |
| 3 | hands for lines 1-3 survive; ring 3 (R2) |
| 4 / 8 / 15 | Toolbelt: Rush / Grit / Flare (R5) |
| 5 | ring 4 (R3); Dares (R7) |
| 7 | the Foreman for lines 1-6 (R5) |
| 10 | ring 5, keystone slot 1, Night Shift +4 h (R3) |
| 15 | Logbook secret hints (R4) |
| 20 | ring 6, keystone slot 2 (R3); the Foreman for all lines (R5) |
| 25 | Dead Hand (R5); the Barge's keel (later) |
| 30 / 40 / 50 | rings 7 / 8 / 9; keystone slot 3 at 40 (R7) |

---

## 6. The Blast Map (the massive tree)

### 6.1 Structure and size

A blast's scorch pattern around **Ground Zero**: 8 sectors (wedges) × 9 rings, with ring sizes
per sector of 2, 3, 4, 5, 5, 6, 6, 7, 7 outward. That is 45 per sector and **361 nodes** with
Ground Zero. It ships in three waves: rings 1-3 in R2 (73 nodes), rings 4-6 and keystones in R3
(201), rings 7-9 in R7 (361). Rings open by nuke count (5.8) and by cost.

### 6.2 Sectors

| Sector (id) | Theme |
| --- | --- |
| Grip (`grip`) | tap value, Hustle, crits, Afterglow, felling |
| Crew (`crew`) | hand prices, keeping hands, hand bonuses |
| Works (`works`) | lines, milestones, discounts, starting eras and kits |
| Tide (`tide`) | flotsam frequency, float time, effects, new kinds |
| Bunker (`bunker`) | the Night Shift window, offline bonuses, welcome back |
| Blast (`blast`) | glass gain, Glow factor, the cinematic, nuke tricks |
| Logbook (`logbook`) | Morale per entry, secrets, hints |
| Scrapyard (`scrapyard`) | the Magnet's timing, ranks, Pockets |

### 6.3 Node types and mix rules

| Type | Share | About | Example |
| --- | --- | --- | --- |
| Small stat | ≤ 52% | 188 | tap value +50% |
| Notable (a named mechanic) | 19% | 70 | 5% of taps crit ×10 |
| Keystone (rule-bending, slotted) | 4% | 16 (2 per sector, rings 5-9) | Wipe Day Rush, Bunker Mentality |
| Unlock (a new toy or system) | 10% | 36 | Flare Gun, keystone slot, Pocket slot |
| Automation and QoL | 10% | 36 | Old Crew, Foreman scope, Dead Hand |
| Completion and synergy | 5% | 15 | "Works ring 3 lit: all lines ×2"; "+1% per hand hired" |

Content checks: never **three small nodes in a row** on a path; at least one **scene-changing
node** per sector per three rings; every effect is expressible in the effect vocabulary (13.5),
and a node that needs new code counts as an *unlock* budgeted in its phase; the tree is reachable,
acyclic and fully localised, and its ring costs rise.

### 6.4 Costs

Ring bands ×10 per ring *(sim)*: 1-2 glass, 4-10, 25-75, 200-600, 2k-6k, 20k-60k, 200k-600k,
2M-6M, 20M-60M. Prices inside a band use playful digit patterns (1, 2, 7, 11, 22, 77, 222, 777,
7,777); notables cost ×2 and keystones ×3. A price never changes when another node is bought.
The first nuke buys **6-10** ring-1 nodes; later nukes **3-8**.

### 6.5 Permanence, loadout, respec

Nodes are **permanent, never refunded**, except a **free full respec** after any balance patch
that touches the tree (an admin command and a decision entry). **Keystones** work only when
**slotted** (1 slot at nuke 10, 2 at 20, 3 at 40), re-picked free on every rebuild screen.

### 6.6 Reading it (phone first)

- **Overview:** an SVG scorch disk filling the screen, every node a dot, owned dots glowing, each
  wedge showing its fill and affordable count. This is the "MASSIVE" payoff view. Locked rings
  show their gate ("Ring 4 opens at Wipe Day #5").
- **Sector view:** a tapped wedge unrolls into a vertical **ladder**, ring 1 at the bottom,
  opening at the lowest unfinished ring. Rows hold **at most 4 nodes** (56 px circles, two-line
  labels); rings of 5-7 wrap to two rows. No pinch, no pan.
- **Node sheet:** icon, name, type, the effect **in the player's current numbers** ("+38k/s
  now"), cost, and one primary **Buy** or its reason; a far node offers "Buy path: 4 nodes, 1,240
  glass".
- **Filter chips** (Affordable, Taps, Offline, Automation, Keystones); exactly one node pulses,
  the advisor's pick.
- **Desktop:** the same React views, with a larger disk and two ladders side by side.

### 6.7 Anchor nodes (fixing tone and scale for writers)

The eight legacy perk ids are reused as node ids (`steady_hands`, `old_friend`, `packed_crate`,
`deep_cellars`, `war_stories`, `quick_fingers`, `hot_coals`, `old_maps`), so their locale keys
and any drawn art survive.

| Node (id) | Sector, ring, type | Effect | Glass |
| --- | --- | --- | --- |
| Ground Zero (`ground_zero`) | centre | opens the map; Glow active | free at nuke 1 |
| Calloused Hands (`steady_hands`) | Grip 1, stat | tap value +50% | 1 |
| Old Friends (`old_friend`) | Crew 1, automation | Mara's hire survives nukes | 2 |
| Starter Kit (`packed_crate`) | Works 1, unlock | start runs with 10 Beachcombers and 5 Campfires | 2 |
| Deep Cellars (`deep_cellars`) | Bunker 1, stat | Night Shift +4 h | 1 |
| Bigger Payload (`bigger_payload`) | Blast 1, stat | +10% glass per nuke | 2 |
| Lucky Swing (`lucky_swing`) | Grip 3, notable | 5% of taps crit ×10 | 77 |
| Old Crew I (`old_crew_1`) | Crew 3, automation | hands for lines 1-6 survive nukes | 33 |
| Glow Lamp (`glow_lamp`) | Blast 3, notable | Glow factor 0.25 → 0.30 | 77 |
| Union Rules (`union_rules`) | Works 4, notable | every milestone ×2 becomes ×2.5 | 777 |
| **Wipe Day Rush** (keystone) | Grip 5 | Afterglow lasts 60 min at ×5; Night Shift window −50% | 7,777 |
| **Bunker Mentality** (keystone) | Bunker 5 | offline ×1.5; no flotsam | 7,777 |
| Dead Hand (`dead_hand`) | Blast 6, automation | opt-in auto-nuke at a chosen yield (7.5) | 22k |
| **Lone Wolf** (keystone) | Crew 8 | no hands at all; taps ×1,000 | 7.77M |

---

## 7. Persistent layers

### 7.1 The Logbook and Morale (R4)

- Achievements in all but name: "Fell 100 trees", "Hire every hand in one run", flight variants,
  eras, flotsam kinds, jokes. About 120 in R4, growing to about 250. +1 scrap per 25 entries.
- **Morale** = `1 + 0.02 × entries` (Logbook nodes raise the per-entry value): cheap content
  turned into power.
- **Secrets** (about 25%) show "???" with a one-line hint after nuke 15 (earlier with the
  `old_maps` node). Examples: hold exactly 1,337 supplies; launch during a storm; tap the gull 100
  times; nuke with no hands hired.
- **Shared first finds:** the first friend to log a secret gets a feed line, and everyone else
  then sees its hint.

### 7.2 Scrap and the Magnet (R5)

Scrap leaves the run economy completely. **The Magnet**, a free electromagnet crane over the bay
running from nuke 1, is driven lazily by one timestamp: from 20 h you may "haul early" at a shown
50% chance of 1 scrap (a miss resets the timer); from 23 h a haul is sure, 10% of them rich (2-3);
at 24 h it hauls into the tray by itself, so nothing is lost. Scrapyard nodes shorten the cycle to
16/19/20 h.

### 7.3 Crew ranks (R5)

Each hand has 5 ranks, costing 1, 2, 4, 8 and 16 scrap, each **×3** to that hand's line, kept
forever (AdVenture Capitalist's gilding). Maxing all 14 hands takes 434 scrap, about a year.

### 7.4 Pockets (R5)

Three Pocket slots at 5, 15 and 40 scrap. Each keeps one shelf upgrade (a Line Mk, an island
upgrade or a Grip rung, never an era) through every nuke. A pocketed upgrade is active from the
first second of a run.

### 7.5 The Foreman and Dead Hand (R5)

- **The Foreman** (nuke 7 for lines 1-6, nuke 20 for all; a toggle in the Crew panel): while
  the page is open, the client sends ordinary `buy_line` commands for the best-payback line, at
  most one a second. On return, **Collect** runs **one deterministic greedy buy-max pass**. It
  never acts inside settle.
- **Dead Hand** (nuke 25, opt-in): while online, the client launches when the yield reaches a
  chosen percentage of glass ever, with a postcard toast instead of the cinematic. It never fires
  offline.

### 7.6 The Toolbelt (R5)

At most **three** round 48 px buttons, ever, on the right above the drawer:

| Skill | Effect (real seconds) | Cooldown (game clock) | Unlock |
| --- | --- | --- | --- |
| Rush (`rush`) | taps ×10 for 30 s | 10 min | nuke 4 |
| Grit (`grit`) | all lines ×1.05 for the rest of the run, stacking to 10 | 8 h | nuke 8 |
| Flare (`flare`) | calls a flotsam now | 60 min | nuke 15 |

Grit is the casual player's check-in ritual; Rush and Flare are combo tools. No meta-skills.

### 7.7 Dares (R7)

Opt-in challenge runs picked on the rebuild screen from nuke 5. Constraint and goal are shown in
full, progress is a bar, abandoning is free, and each pays a Logbook page plus a permanent effect
(at most +25% on one stat). Four ship first, reusing the season-modifier ids:

| Dare (id) | Constraint | Goal | Reward |
| --- | --- | --- | --- |
| Long Night (`long_nights`) | no Night Shift this run; flotsam ×2 | reach Sheet Metal | Night Shift window +4 h |
| Rich Tides (`rich_tides`) | lines ×0.25; flotsam ×4 | a nuke worth +10% glass | flotsam effects +20% |
| Storm Season (`storm_season`) | Hustle drains ×3; taps ×3 | Stone era within 15 min | Hustle max +25% |
| Quiet Hands (`quiet_raiders`) | no taps after minute 5 | reach Stone | offline output +10% |

Up to 12 Dares later (Bare Hands, Thirteen, Speed Wipe, Twig Only).

---

## 8. Social layer (2-10 friends at very different levels)

**Rule: only counts, times, ratios and each player's own scale.** No trading, no gifting of stock,
no PvP, no shared absolute projects, no tap-count goals, no permanent power from co-op.

### 8.1 Nuke news (R2; the postcard image from R6)

Every nuke, first Armored, Logbook first find, Freighter tier and record posts to the feed and
`#wipe-day-idle` from the same events (D124). From R6 the Discord post carries the postcard,
rendered by the bot's satori pipeline.

### 8.2 Blowback (R6)

When a friend nukes, **3 crates** wash onto everyone else's shore and wait until tapped (no
expiry, at most 9 waiting). Each pays `min(15% of held supplies, 15 min of output)` at claim, so
it scales to the receiver. It is derived lazily from `nuked` events past the player's cursor (a
`World` input), never by writing to another base. The nuker sees "Your blast washed 9 crates onto
3 islands."

### 8.3 The Island Count (R6)

"Saltmarsh has been nuked 214 times." At 10, 50, 100, 250, 500 and 1,000 nukes the whole group
unlocks a cosmetic (a scorched flag, a glass gull, a crater sign style). Cosmetics only.

### 8.4 The Freighter (weekly co-op, R6)

A wreck grounds offshore each Monday 00:00 UTC. One **load** costs one hour of your own current
output, so a day-1 friend and a veteran contribute equally; each player loads at most 6 times a
week. Group tiers sit at an average of 2, 4 and 6 loads per active player; each pays **1 scrap**
to everyone who loaded, and tier III adds a pennant cosmetic. There are no grades, warnings or
kicks, and the hull visibly fills with crates.

### 8.5 Late Tide (catch-up, R6)

Below 50% of the group's median glass ever (players active in the last 14 days), a player gains
**×2 glass per nuke**, labelled openly ("Late Tide ×2"). Catch-up only boosts the player behind;
nothing is cut for the one ahead.

### 8.6 Boards (R6)

Monthly window and all-time; nobody is reset; ties share a rank. The boards: Wipe Days this
month; best blast (glass gained ÷ glass ever before); fastest comeback (time to pass the previous
run's gain, as a % of that run, from nuke 3); nodes lit; Logbook entries; flotsam caught;
Freighter loads. A newcomer can top at least two in week 1.

### 8.7 Visit (R6 stretch)

Tap a friend to see their island read-only: era, hands, the Kettle's stage, the crater sign, the
loadout and the nuke count.

---

## 9. The second layer (design hook only): the Crossing

- **Trigger:** built only when the simulator shows a combined per-nuke gain below ×1.3 for 5
  nukes, with nothing opening in the next 3 and at least 70% of the Blast Map lit.
- **Foreshadowing:** from nuke 25 the keel of **the Barge** lies on the shore and gains a plank
  per nuke.
- **The Crossing:** sail to a new island with its own palette, targets, lines and curve. It
  resets glass, Glow and the Blast Map; it keeps the Logbook, scrap, ranks, Pockets, cosmetics and
  records; it pays **Sea Charts** = `floor(5 × log10(glass ever / 1e6))` for Chart nodes that
  amplify whole sectors and for **island traits**. Multi-good chains may return only here, as an
  island trait.
- **Reserved in data now:** an `island` field on lines, eras and targets, and `keepOnCrossing` on
  meta fields.

---

## 10. Seasons and the cut-over

- **Seasons as a reset are removed.** One season row stays forever (zero SQL); "month" survives
  only as a board window; modifiers become Dares; the Signal goes.
- **Season 1** (started 2026-10-07, two players) runs on the current build until R2 ships, with
  only crash and data-loss fixes.
- **Development** happens on a long-lived `redesign` branch, played locally (LocalBackend) until
  cut-over. `main` stays the live old game: one image serves both the API and the web build, so a
  partial new bundle cannot ship beside it.
- **Cut-over (end of R2), in order:**
  1. take an off-server backup (pulled into R0);
  2. tag the last old-game commit `season-1-final`;
  3. run `pnpm season end` once as season 1's ceremony (archive and hall of fame kept as "the
     old world");
  4. wipe the game rows with the tested recipe, never resetting `event_log`'s sequence;
  5. deploy;
  6. grant founders a **Founder skin and 5 glass** through the new admin grant.
- New bases start lazily from the new `newBase`; nukes overwrite the same `bases` row so
  `version` keeps rising.

---

## 11. Systems disposition

Verdicts: **Keep**, **Rework**, **Remove** (deleted on the redesign branch; history behind the
`pre-redesign` tag), **Park** (deleted from the build, kept in git for a possible return).

| System (decisions) | Verdict | Canon |
| --- | --- | --- |
| Accrual and Collect (D17) | Rework | Production auto-banks; Collect lives only on the welcome-back card |
| Gather and its cooldown | Remove | The tap verb replaces it |
| Node mini-game, marker, wear (D34, D76) | Rework | One era target that fells |
| Daily node haul (D63) | Remove | The token bucket caps taps instead |
| Tools (5) | Rework | Grip, same ids |
| Base tiers (5) | Rework | Eras inside every run, same ids and colours |
| Buildings, 18 × 3 levels (D69) | Rework | 11 become lines (drawn at 1/25/100); warehouse, bunkhouse and lights become scene props; walls, traps, turret and watchtower go |
| Construction timers, builders (D28, D71) | Remove | Purchases are instant |
| Upkeep and decay (D27, D72) | Remove | Nothing punishes absence |
| Storage caps (D26, D33) | Remove | The Night Shift window |
| Resources (23) | Remove | Supplies; scrap becomes rare |
| Furnaces and types (D29) | Rework | The Furnace is line 7 |
| Crafting web, stations, queues, parts, salvage (D77-D83) | Remove | Stations live on as lines; chains only as a later island trait |
| Blueprints (D79, D116) | Remove | The Blast Map is what you keep; Pockets keep upgrades |
| Items: crates, meals, medicine, gear, keycodes (D80) | Remove | Crate art becomes the Drift Crate |
| Crew arrivals, levels, jobs, needs, gear, bonds (D84, D90-D92) | Rework | Hands, one per line; ranks bought with scrap; traits per owner decision 19 |
| Expeditions, fog, sites, regions, keycodes, trip events, report cards, MapView (D85-D95) | Park | A possible sea layer after R6 (trips that survive the nuke) |
| Barrels (D36) | Rework | Flotsam |
| Daily tasks (D37) | Remove | The Logbook and the Magnet are the daily pull |
| Advisor and retiring hints (D21, D67) | Keep, new rules | 12.5 |
| Welcome back | Keep, central | 12.6 |
| Weather and day/night | Keep | Visual; rain makes flotsam ×1.5; ash weather in Afterglow |
| Den counter (D100, D105) | Remove | The skiff stays as the Upgrades shelf's scene home |
| Contracts | Remove | The Freighter takes their social job |
| Player market (D99) | Remove | Exponential goods cannot be traded across scales |
| Casino and RTP tests (D101, D102) | Remove | A rare currency is never gambled |
| Leaderboards, stats, season card (D103) | Rework | Scale-free boards; lifetime stats in `meta` |
| NPC raids and defence (D106-D108, D113) | Remove | Raids cannot land in hour-long runs, and losses punish absence |
| Bandit camps and charges (D109) | Remove | No map |
| PvP (D110, D111) | Remove | Cross-scale theft is worthless or absurd |
| Monthly seasons and reset (D114, D115) | Remove | One perpetual row; `season end` used once at cut-over |
| Season modifiers (D118) | Rework | Dares, same ids |
| The Signal (D119) | Remove | The Island Count; its slope spot hosts the Kettle |
| Legacy points, perks, 25% cap (D116, D117) | Rework | The Blast Map and `meta`; perk ids become node ids; the cap retires |
| Season-over card, Legacy and Hall tabs (D120) | Rework | The postcard; the Hall keeps season 1 and monthly boards |
| Skins and titles | Keep | Founder, Island Count and pennant cosmetics |
| Feed and Web Push (D96, D111) | Keep | New kinds and defaults (12.7, 13.7) |
| Discord companion (D121-D126) | Keep the architecture | Card v2 at R2 (rate, window fill, yield, Open the game; Collect allowed; no taps, no nuke); postcards at R6 |
| Commands, SSE, prediction, LocalBackend, Clock (D51, D59, D64, D65) | Keep | Plus the slim tap path (13.4) |
| Backups (D54) | Keep, extend | Off-server copy in R0, before any wipe |
| Admin routes and season CLI (D114) | Rework | Admin grant and respec in R2 |
| Simulator, `pacing.json5`, RTP | Rework | Lifetime-of-runs simulator, pacing v2; RTP removed |
| Screenshot harness (D44) | Keep | `SHOTS` rebuilt; cinematic and tree pinnable |
| Formatter `abbrev`, modifiers aggregator | Rework | 13.1, 13.5 |
| `normalizeState` (D73) | Keep the pattern | A clean state version, with a wipe |
| Dock (D45, D88) | Rework | The shop drawer plus 5 nav items |
| Demo drawer | Keep (dev) | Nuke count, glass grant, flotsam spawn, pinned cinematic phases |

---

## 12. UX canon

### 12.1 Phone layout (390 × 844 first)

- **Top bar (at most 64 px):** Supplies in large tabular numerals with `/s` under it (tap for the
  Multipliers sheet); the glass chip (count and `×Glow`) and the scrap chip on the right. The
  running counter is written outside React, on the animation frame.
- **Scene (top 50-55%):** the target on the rise at about 40% height, at least 120 CSS px; the
  base and line buildings behind it; the Kettle on the slope; sea and flotsam on the left; Hustle
  as a thin arc around the target.
- **Shop drawer:** collapsed, **the crowned row plus the next two** (icon, name, count, cycle
  bar, "38/50 → speed ×2", buy button with cost). Expanded: Lines and Upgrades tabs, and the
  ×1 / ×10 / ×100 / Max toggle after the 2nd hand.
- **Nav row:** Island · Blast Map · Crew · Logbook · Friends (feed inside Friends, settings in a
  top-bar menu). A destination not yet unlocked shows disabled with its reason; one not yet
  shipped is hidden.
- **The Big Red chip** above the drawer when crowned; the **Toolbelt** on the right (from R5).
- Every touch target is at least 44 CSS px (today's close button, tabs and small buttons are
  fixed in R1); labels never wrap.

### 12.2 Desktop

The drawer becomes a permanent 420 px right column and the camera recentres in the free area
(MapView's HUD-inset pattern). Modals, sheets and the Blast Map are the same components.

### 12.3 Amendments to CLAUDE.md 6.3 (decisions in R0)

- **6.3.1:** exactly one *crowned* row per shop view; other affordable rows stay enabled and
  secondary. The primary token becomes **signal orange**. **The Big Red is never
  primary-styled.**
- **6.3.8:** "five dock actions" becomes the drawer plus five nav items.
- **6.3.9:** production cycles may be seconds. Idle timers (Night Shift, Magnet, Toolbelt
  cooldowns, Freighter) run on the game clock; active-play timers (Hustle, flotsam, buffs,
  felling, the cinematic) are real seconds and never speed up with the demo clock.
- **6.3.10:** welcome back's one primary is **Collect**, never the nuke.
- **6.3.11:** only "Night Shift over" is on by default.
- **New:** never tease unshipped content; locked things show only real, reachable reasons.

### 12.4 Feedback, sound and motion

- Every tap gives a floater within a frame: pooled `BitmapText`, at most 12 live, rapid gains
  merged into a running "+1.2k"; particles pooled and capped.
- **Sound:** procedural WebAudio, respecting device mute and a toggle (tap, buy, milestone and fell
  in R1; flotsam, siren and boom in R2); the owner can replace any sound. Android vibrates on
  fell, milestone and hold-to-launch.
- `prefers-reduced-motion`: no shake or flash, fades instead.

### 12.5 Advisor v2

The crown goes to exactly one thing, first match wins: the Big Red when recommended (5.2); the
next era; a hand for the top-earning unmanned line; the best-payback purchase; waiting Blowback
crates; a ready Toolbelt skill; otherwise the hint "Tap the {target}". Flotsam glows in the scene
but never takes the crown. Hints retire after two uses.

### 12.6 Welcome back

After an hour away, one card with one **Collect**:

> Away 2 d 3 h. Your hands worked the Night Shift (12 h of it): +4.2T supplies. The Magnet hauled
> up 2 scrap. 3 friends nuked their islands: 9 crates are waiting on your shore. Logbook +2.

Collect flies the gain into the counter and runs the Foreman's pass; the nuke is never its
primary.

### 12.7 Notifications

On by default: "Night Shift over" only. Off by default: Magnet full, friend nuked, Freighter tier.
"Expedition back" and "raided" go with their systems.

---

## 13. Architecture canon

### 13.1 Numbers

- **Finite doubles** behind one `Amount` alias, with a `Number.isFinite` guard in the domain and
  in `save()` (`JSON.stringify(Infinity)` writes `null`). Counts (owned, hands, nodes, nukes,
  scrap, ranks) stay integers. Content amounts become `z.number().finite().nonnegative()`;
  lines, milestones and costs are validated as **formulas**. "Integers in state" is amended.
- **Magnitude budget:** run 1 peaks around 1e12, the full tree around 1e36-1e45 lifetime; the
  simulator asserts **under 1e150** over 180 days. No Decimal library; a later switch would be a
  type change behind `Amount`.
- **One formatter** for web and bot: 3 significant digits; k, M, B, T, Qa, Qi, Sx, Sp, Oc, No,
  Dc, then `1.23e36`; a rate format (`0.4/s`); a scientific toggle.

### 13.2 State and meta

- **`state.meta`**, inside the base document, holds glass ever and held, nodes, keystones and
  loadout, Logbook, scrap, ranks, Pockets, the Magnet timestamp, the nuke count, records, lifetime
  stats, agenda progress, the Blowback cursor and the last World-derived catch-up factor. Tree
  buys are predicted instantly (D64).
- `nuke(state, now)` is a **pure domain function**: settle, compute the gain, fold the run into
  `meta`, return `newRun(meta, seed(base, nukes))`. The client plays the cinematic before the
  answer; the simulator plays lifetimes with the same function.
- The API **overwrites the same `bases` row** (`version` stays monotonic) and logs `nuked`. The
  `legacy` table keeps cosmetics, titles and the season-1 archive. Boards are computed from bases
  in JS, as `ranks()` already does.

### 13.3 Settle

- **Closed-form segments:** rates are piecewise constant between commands, split at the Night
  Shift window's end and at scheduled buff ends. Afterglow and Hustle multiply only taps, which
  arrive as commands, so they need no integral.
- **Nothing buys inside settle** (the Foreman and Dead Hand act through commands). Fractional
  remainders stay in state; there is no per-settle flooring.
- **Property tests in R0, before content:** path independence `settle(settle(s, t1), t2) ≈
  settle(s, t2)` within 1e-9; agreement with a one-second tick oracle within 1e-6; the bucket
  never over-credits; a nuke keeps exactly `meta` and grants exactly the formula's glass.
- `settleAll` loses its craft, mission, arrival, barrel, task, node, listing, Den, contract,
  wheel and raid settlers.

### 13.4 Taps transport

- The client merges taps into `{type: "taps", count, from, to}` every ~1 s or 30 taps, before a
  key is assigned; a retry resends the same content with the same key.
- A **token bucket in state** (15/s, burst 45) clamps silently, so prediction and server agree and
  no rollback toast fires for an honest tapper.
- Taps and pings store a **slim idempotency record** (no state, 1-hour TTL; D59 amended), write
  one aggregated stat and no `event_log` row, and push only `version` to other tabs.
- **Predicted taps are never dropped** on a network error (the queue wipe at `store.ts:475-479`
  goes); the `sentKeys` and `played` sets get pruning.

### 13.5 Effects as data

- An effect is `{stat, op: add | inc | more | set | unlock, value, scope?, per?, when?}`.
  `scope` is a line, an era or all. `per` counts owned units, hands, nukes, entries or sector
  nodes. `when` is one of: online, offline, afterglow, rain, night, `hustle_full`, `dare:<id>`.
- **One evaluator**, folded once in a fixed order and cached by identity: base → add →
  milestones → (1 + Σinc) → Πmore → Glow → Morale → transient buffs.
- Tests check monotonicity and a per-stat upper bound. They replace `legacy.test.ts`'s 12,288
  combinations and the 25% checks.

### 13.6 Commands and World

- **Commands**, all idempotent by key in one transaction: `taps`, `ping`, `buy_line`,
  `hire_hand`, `buy_upgrade`, `buy_era`, `claim_flotsam`, `nuke`, `buy_node` (node or path),
  `set_loadout`, `start_dare`, `abandon_dare`, `collect`, `claim_blowback`, `haul_magnet`,
  `rank_hand`, `set_pocket`, `use_tool`, `load_freighter`; admin `grant` and `respec_all`.
- **World inputs** are copied into `meta` on each server settle, so the client predicts with the
  last known value: friends' nukes past the Blowback cursor, the Late Tide factor, the Island
  Count and the Freighter's progress.

### 13.7 Events and storage

- New events: `nuked` (with the run summary), `era_reached`, `hand_hired`, `milestone`,
  `flotsam_claimed`, `logbook_entry`, `scrap_hauled`, `blowback_claimed`, `freighter_loaded`,
  `dare_done`.
- Feed kinds: nukes, first Armored, first finds, Freighter tiers, records.
- `event_log`'s sequence is never reset (the bot's cursor depends on it).

### 13.8 Content files

New in `packages/content/data`: `lines`, `eras`, `targets`, `upgrades`, `milestones`, `flotsam`,
`prestige`, `blastmap` (sector, ring, slot, type, effects, cost), `agenda`, `logbook`, `magnet`,
`toolbelt`, `dares`, `social`, `pacing` v2. Kept: `tools` and the tier ids. Deleted: `recipes`,
`crafting`, `furnaces`, `items`, `den`, `raids`, `sites`, `regions`, `events`, `active`, `nodes`
and `seasons` (its modifier ids move to `dares`).

### 13.9 Simulator v2

- **Lifetime-of-runs:** play a run, apply the archetype's nuke rule, `nuke()`, repeat, over 30,
  90 and 180 days. A group simulation supplies the medians for Late Tide and Blowback.
- **Archetypes:**
  - idler: 08:00 and 21:00, never taps, nukes at gain ≥ glass ever;
  - casual: 08:00, 13:00 and 21:00, 5 minutes at 4 taps/s, nukes when crowned;
  - active: 8 sessions of 10 minutes at 6 taps/s;
  - optimal: hourly, best nuke timing;
  - late joiner: casual from day 30.
- `pnpm sim check` asserts section 15 inside `pnpm test`.

### 13.10 Ops

One process, one SQLite writer, no new services; never touch tk-toolkit.

---

## 14. Guardrails (replacing CLAUDE.md section 8)

Each is a decision in R0; the numbers are in section 15.

1. **The first nuke comes on day 1** for everyone (N1-N3).
2. **Active play is a bonus, not a different game** (N8-N10).
3. **Friends stay in one race**, and late joiners catch up (N16, N17).
4. **There is always something to buy** (N5-N7).
5. **Every nuke feels faster** (N11-N13).
6. **The tree lasts for months** (N14, N15).
7. **Absence never hurts:** offline is 100% inside a window of at least 12 hours; a full window
   stops accrual and destroys nothing; nothing is taken away except by your own button.
8. **Precious things are never at risk:** glass and scrap are never traded, gifted, wagered,
   stolen or sold. There is no casino.
9. **Randomness is visible:** flotsam odds, the Magnet's chances and Dare rules are printed in
   the game. There is no hidden catch-up and no rubber band against the player ahead.
10. **Numbers stay meaningful** (N23).
11. **Respect the clock:** active timers are real seconds; idle timers run on the game clock
    (12.3).

Retired: the 25% legacy cap (four enforcements), "8 check-ins ≈ 1.6×", the day-14 and day-18
floors, storage caps as the check-in driver, the casino rules, the PvP rules.

---

## 15. Canon numbers (what the simulator and tests assert)

| # | Target | Value | Asserted by |
| --- | --- | --- | --- |
| N1 | First nuke, active (6 taps/s, greedy) | 40-60 min | sim |
| N2 | First nuke, any archetype | ≥ 25 min | sim |
| N3 | First nuke, casual (3 × 5 min check-ins) | by the day-1 21:00 check-in | sim |
| N4 | First hand, run 1 | ≤ 2 min | sim |
| N5 | Affordable purchase cadence, first 10 min of runs 1-5 | ≤ 30 s gaps | sim |
| N6 | Online with nothing affordable, runs 1-5 | ≤ 120 s | sim |
| N7 | Purchases per casual check-in | ≥ 1 | sim |
| N8 | Tap share of income: run 1 minute 0-1 / from minute 10 outside bursts | ≥ 50% / 5-25% | sim |
| N9 | Active hour vs idle online hour, mid-game | 1.5-3× | sim |
| N10 | Taps credited | ≤ 15/s, burst 45; hold = 4/s | domain test |
| N11 | Run N+1 passes run N's gain (early / mid / late) | ≤ 40% / 50% / 65% of run N's time | sim |
| N12 | Combined power per nuke (early / mid / late) | ×2-3 / ×1.5-2 / ×1.2-1.5 | sim |
| N13 | Flattening alarm | < ×1.3 for 5 nukes with nothing opening in the next 3 → fail | sim |
| N14 | Nodes bought: first nuke / later | 6-10 / 3-8 | sim |
| N15 | Tree horizon (optimal) | ≤ 45% by day 30; 100% not before day 90 | sim |
| N16 | Glass-ever gaps at days 30 and 90 | active ≤ 2×, optimal ≤ 2.5×, idler ≥ 0.5× casual | sim |
| N17 | Late joiner | reaches the day-30 casual's glass ever within 12 days | sim |
| N18 | Night Shift | 12 h at the start, 48 h ceiling, 100% inside | data check |
| N19 | Scrap income | casual 0.8-2 per day; ≥ 25 by day 30; never > 2.5/day for anyone | sim |
| N20 | Timers and meters | Magnet 20/23/24 h; flotsam every 4-10 min, 13 s; Afterglow ×3, half-life 5 min; Hustle ×1-×2 | domain tests |
| N21 | Prestige | `G = floor(cbrt(L / 1e8))`; Glow `1 + 0.25√G`; first nuke ≥ 10 glass | data (shape canon) |
| N22 | Agenda count rule | a nuke counts if it adds ≥ 10% to glass ever | domain test |
| N23 | Magnitude | run 1 peak about 1e12; < 1e150 over 180 days; always finite | sim + save guard |
| N24 | Settle path independence / tick oracle | 1e-9 / 1e-6 relative | property tests |
| N25 | Tap batch | ≤ 1 s or 30 taps; slim record TTL 1 h; ping every 5 min | domain/API tests |
| N26 | Blast Map | 361 nodes; ×10 per ring band; small ≤ 52%; never 3 small in a row | content check |
| N27 | Touch targets | ≥ 44 CSS px; target ≥ 120 px tall on a phone | shots review |

---

## 16. Build outline (R-phases)

Every phase: plan mode first; `pnpm check`, `pnpm web:shots` and `docs/ui-review.md` notes;
decisions logged; one phase per session block; a stop-and-report at the end.

| Phase | Goal | Scope | Sessions |
| --- | --- | --- | --- |
| **R0 Foundations** (architecture) | Engine and rules before content | Off-server backup; the `redesign` branch and the `pre-redesign` tag; decisions D127+; CLAUDE.md and `docs/game-design.md` rewritten from this canon; the cut systems deleted; `Amount` and the formatter; the effects evaluator; settle and its property tests; the taps transport; simulator v2; `SHOTS` pruned | 3 |
| **R1 The run** (balance, UI) | From the first tap to Sheet Metal | Lines, milestones, shelf, eras, targets, Grip, Hustle, hands, Night Shift, welcome back, 3 flotsam kinds; phone reframe, drawer and nav, orange primary, 44 px fixes, pooled floaters, tap sounds; advisor v2 | 5 |
| **R2 The Big Red** (architecture, UI) | **The full loop; friends play** | Glass, Glow, `nuke`, the Kettle, the cover card and hold, the cinematic, postcard and rebuild screen, Afterglow, Blast Map wave 1, agenda, nuke news, bot card v2, error reporting, admin grant and respec. **Cut-over (section 10)** | 4 |
| **R3 Blast Map wave 2** (balance) | Months of goals | Rings 4-6, keystones and loadout, filters, horizon asserts | 3 |
| **R4 Logbook** | Collection as power | About 120 entries, Morale, secrets, first finds, 2 flotsam kinds | 2 |
| **R5 Scrap and the check-in** | The slow layer | Magnet, ranks, Pockets, Sealed Locker, Toolbelt, Foreman, Dead Hand | 3 |
| **R6 Friends** | The social core | Blowback, Island Count, Freighter, Late Tide, boards, Visit, Discord postcards | 3 |
| **R7 Dares, wave 3, live ops** | Depth and the rest of W9 | 4 Dares, rings 7-9, admin panel, exports | 3 |
| Later, gated | When its trigger fires | The Crossing (section 9); creeds (at most 3: Scrappers, Bunker Folk, Tinkers) if runs feel samey; a sea layer if casual players need a slower overnight clock | 3-4 each |

**Total: about 26 sessions to R7.** Friends play the full loop at about session 12.

Decisions to log in R0, from D127, in this order: the redesign (citing this canon); seasons
removed as a reset; the guardrails; finite doubles; the three currencies; the prestige shape;
meta in the base document with `nuke` as a pure command; the slim taps transport (amending D59);
effects as data; no autobuyer inside settle; the cut list; the 6.3 amendments and orange primary;
the Blast Map; never teasing unshipped content; icon namespaces; the social rules; backups and
`event_log` safety; simulator v2; the redesign branch and the frozen old game.

---

## 17. Icons

**Conventions:** `icons/<kind>/<id>.svg` (ids collide across kinds: `stone`, `furnace`, `ore`,
`sulfur`); a square 48 viewBox; `currentColor` for tier colours; no raster; legible at 16 and 48
px. A content test checks every id has an icon, falling back to today's tile.

**Keep drawing now** (safe in every phase):

- resource `scrap` (**top priority**: the rare gold chip);
- the five tier badges (era badges) and the five tools (Grip);
- buildings `campfire`, `garden`, `loom`, `workbench`, `kiln`, `furnace`, `tannery`, `press`,
  `dock`, `generator`, `radio_mast` (lines 2-12);
- nodes `tree`, `stone`, `ore`, `sulfur` (era targets); item `crate` (the Drift Crate);
- the 12 crew portraits (hands); the 3 skins (low priority).

**Wait:**

- the 11 traits (decided in R5);
- the 4 season-modifier ids (Dare badges in R7);
- the 8 perk ids (now node ids, but nodes use sector glyphs, so unique art is optional);
- sites, regions, keycodes and trip events (only if a sea layer is built).

**Stop now:**

- every resource except scrap, and every item except `crate`;
- furnace types, and the `fibre` node;
- walls, traps, turret, watchtower; warehouse, bunkhouse and lights (scene props, no icon);
- casino symbols, Signal stages, contracts, Den lots, tasks, and the old dock letters.

**New, in order of need:**

1. **R1:** `supplies`, `hustle`, `hand`, `wreck`; lines `beachcomber`, `shipbreaker` and
   `reactor`; portraits `gus` and `vera`; flotsam `fuel_drum` and `adrenaline`; the five nav
   icons; shop icons `upgrade`, `roster` and `buy_max`.
2. **R2:** `glass`, `glow`, `big_red`, the four `kettle` stages, `afterglow`, `night_shift`,
   `ground_zero`, the 8 sector glyphs, the 5 node-type frames.
3. **R4-R5:** `morale`, `magnet`, `pocket`, `rank`, `foreman`, `dead_hand`, `rush`, `grit`,
   `flare`, `drowned_drone`, `sealed_locker`, `bottle`.
4. **R6-R7:** `blowback`, `island_count`, `freighter`, `pennant`, `late_tide`, the Dares; later
   `barge` and `sea_charts`.

---

## 18. Owner decisions (with the recommended default)

| # | Decision | Default |
| --- | --- | --- |
| 1 | Names (the glossary, section 20) | As listed. "Dredge", "Ashfall", "Exodus", "Ark" and "Keepsakes" were renamed because each is another game's title or item; "Blueprint Fragments", "Rads", "Fallout", "Vault", "Stash" and "Half-life" were rejected. The tier names sit close to Rust's; the owner may want to revisit them |
| 2 | The island's name | Saltmarsh |
| 3 | The lid on the Big Red | Toilet-seat lid (or a jam jar) |
| 4 | Seasons as a reset | Remove; "month" stays a board window |
| 5 | The cut list (section 11) | Accept all |
| 6 | Expeditions | Parked until the R6 playtest |
| 7 | Season 1 | Runs until R2, then ends as a ceremony |
| 8 | Founders' gift | Founder skin plus 5 glass |
| 9 | Prestige shape | Cube root with √ Glow (alternative: a square root, faster but steeper) |
| 10 | Offline | 100% inside 12 h, rising to 48 h |
| 11 | Primary colour | Signal orange |
| 12 | Toolbelt | Three skills, R5 |
| 13 | Creeds | Deferred, conditional, at most 3 |
| 14 | Dead Hand | Opt-in, online only, at nuke 25 |
| 15 | Sound | Procedural WebAudio from R1 |
| 16 | Freighter rewards | 1 scrap per tier per loader; a pennant at tier III |
| 17 | Visit | R6 stretch |
| 18 | Nuke from Discord | No |
| 19 | Hand traits | Fixed one-line perks or cut, decided in R5 |
| 20 | Notation | Suffixes to Dc, then scientific, with a toggle |

---

## 19. Risks and failure modes

| Risk | Mitigation |
| --- | --- |
| **Samey mid-game** (A's admitted weakness) | Agenda unlocks, keystone loadouts, Dares, secrets, era targets, the Crossing; creeds held in reserve with a trigger |
| **Prestige curve runaway or stall** (both seen in A's model) | Square-root Glow, nuke-gated rings, levers in data, N11-N13 asserted before every ship |
| **Multiplier bloat** | The magnitude budget; nodes that change the scene; the Crossing rescales |
| **Click fatigue, RSI, phone heat** | Hold to work; Hustle forgives 2 s; active ≤ 3× idle; no tap-count goals |
| **Autoclickers** | The bucket caps at 15/s, and taps are ≤ 25% of income mid-run, so a cheat gains about ×1.3 |
| **Lines that read as a spreadsheet** | Products drawn and voiced; redraws at 25 and 100; hands walk to their lines |
| **Unmanned-line crediting feels off** | Tune cycle times in demo mode in R1; fallback: unmanned lines run while Hustle > 0 |
| **Client and server settle drift** | Closed form only; no autobuy in settle; property tests in R0 |
| **A long-lived branch drifts from `main`** | `main` frozen to fixes, merged into `redesign` after each one |
| **Friends wait about 12 sessions** | Season 1 keeps running; demo screenshots; the founders' gift |
| **The UI bar** (priority 1) | Extra shot iterations in R1-R3; pinnable cinematic and tree; owner screenshots are bugs |
| **Writing volume** (361 nodes, 250 entries) | Small nodes templated in data; waves; only notables and keystones hand-written |
| **Sunk cost** (about 60% of W3-W7) | Tag `pre-redesign`; parked systems can return |
| **VPS build memory** | Procedural art and sound first; move the web build off the box if needed |

---

## 20. Glossary (every new term)

| Term | Meaning |
| --- | --- |
| Supplies | The one run currency |
| Crater Glass | The prestige currency: *glass ever* (never spent) and *glass held* (spent on nodes) |
| Glow / Morale | Global multipliers from glass ever / from Logbook entries |
| Scrap | The rare persistent currency, about 1-2 a day |
| Hustle | The tap meter, ×1 to ×2 on taps |
| Line / Hand | A countable generator / the named crew member who runs it forever |
| Unmanned line | A line without a hand; it runs only while you tap |
| Milestone / Roster milestone | An ownership threshold on one line / on every line |
| Shelf / Grip | The upgrades tab / its tool ladder for taps |
| Era / Target | A tier re-climbed every run / its one tap object |
| Fell | The target falling after N taps, with a bonus |
| Hold to work | A held finger counts as 4 taps per second |
| Flotsam / Rally | The golden event every 4-10 minutes / the Fuel Drum's ×6 buff |
| Night Shift | Offline production at 100% inside a 12-48 h window |
| Ping | The slim keep-alive an open tab sends every 5 minutes |
| The Kettle / The Big Red | The homemade missile / the button under the lid |
| Cover card / Postcard / Rebuild screen | Before the launch / the results / loadout and Dare choice |
| Wipe Day #N | The player-facing nuke count (command `nuke`, event `nuked`) |
| Flight variant / Crater sign | A seeded missile path / the "WIPE DAY #N" sign in a deepening crater |
| Afterglow | Taps ×3 after every nuke, halving every 5 minutes |
| Agenda | Nuke-count unlocks: "Next Wipe Day unlocks …" |
| Blast Map / Ground Zero | The 361-node permanent tree / its root |
| Sector / Ring | One of 8 themed wedges / one of 9 radial cost bands |
| Loadout / Path buying | Slotted keystones, re-picked each nuke / buying a whole path in one tap |
| Logbook / Secret / Shared first find | Achievements / a hinted hidden entry / the feed line for the first finder |
| The Magnet | The 24-hour scrap crane over the bay |
| Crew rank / Pocket | ×3 to one hand's line / a slot keeping one upgrade through nukes |
| Foreman / Dead Hand | Online autobuyer with a bulk pass at Collect / online opt-in auto-nuke |
| Toolbelt | At most three skills: Rush, Grit, Flare |
| Dare | An opt-in challenge run with a permanent reward |
| Blowback / Island Count | Crates on friends' shores after a nuke / the shared nuke counter |
| The Freighter / Load | The weekly co-op wreck / one hour of your own output delivered to it |
| Late Tide / Visit | Visible ×2 catch-up / a read-only view of a friend's island |
| The Barge / The Crossing / Sea Charts / Island trait | The second layer: its foreshadowing, the reset, its currency, what it buys |
| `Amount` / `meta` | Finite-double alias / the persistent layer inside the base document |
| Token bucket / Slim record | Tap credit limit (15/s, burst 45) / an idempotency record without state, 1-hour TTL |
