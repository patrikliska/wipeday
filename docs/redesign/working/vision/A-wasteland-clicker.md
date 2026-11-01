# Wipe Day redesign, philosophy A: "Wasteland Clicker"

One proposal among several. This one optimises for **instant clarity and the strongest possible
tap, automate, nuke loop**, in the tradition of Cookie Clicker and AdVenture Capitalist: one run
currency, a ladder of countable lines, crew as managers, golden flotsam, a logbook that
multiplies, one slow real-time currency and a giant blast-map tree. It argues openly for cutting
most of what W3-W7 built. Every name is a *proposal*. Every number is a starting point for the
simulator. The run-1 timings come from a quick model with these exact constants: a greedy
buyer, 6 taps/s, no flotsam (section 3.9).

---

## 1. Pitch and pillars

**Pitch.** You wash up on Saltmarsh with nothing. There's a pile of junk on the beach. Tap it, and
salvage pours out. Spend it on beachcombers, a campfire, a garden, a loom and so on up a 14-rung
ladder to a ship-breaking yard and a pre-war reactor. Everything you haven't put a crew member
in charge of only works while you tap. Hire a hand and it runs forever, even while you sleep.
Numbers climb from 6 to the quadrillions in an afternoon. Then the
silo hatch on the hill starts steaming. Under a hinged lid sits a fat red button. You press
it, and your own missile flattens your own island. The crater glass it leaves behind is the only
thing that matters. Spend it on the Blast Map, a 361-node scorch pattern around Ground Zero, and
the next island goes up faster. One verb (tap), one number (salvage), one button (the red one).

**Pillars (they replace the five in `docs/game-design.md` section 1):**

1. **One glance, one number, one tap.** At any moment the screen has one big number going up,
   one thing to tap, and one crowned purchase. If a mechanic needs a sentence to explain,
   it goes in the tree as a node, not in the run.
2. **Tap to start it, hire to keep it.** Every rung starts manual and becomes automatic. Clicking is
   how a run gets moving; automation is the reward for clicking.
3. **Boom is progress.** The nuke is the only reset, chosen by the player, always showing what it
   gives. Losing everything is the funniest and best moment of the game.
4. **The island tells the story.** Each line, milestone, era and hand is drawn in the scene.
   The crater, the crew in the rowboat and the rebuilt shack are the same story told every run.
5. **Friends cheer, never compete for stock.** Social features count events (nukes, taps,
   records), never amounts. A friend 20 nukes ahead is good news for you.

---

## 2. The experience over time

### 2.1 The first 10 minutes of a brand-new player (phone, 390 px)

| Time | What happens |
| --- | --- |
| 0:00 | Dawn. A twig lean-to, three crew huddled at a dead fire, and in the middle of the screen a big glowing **Junk Pile**. The only text: "Tap the pile." Each tap pops "+1" and shoots junk sparks. |
| 0:05 | 6 salvage. The shop drawer slides up one row: **Beachcomber, 6**, crowned. Buy: a figure walks to the tideline. The row and the figure show a cycle bar (0.6 s) and the label "Runs while you tap". |
| 0:12 | **Stone Tools** (60) appears on the upgrade shelf: each tap is doubled and adds 1% of your salvage per second. The first upgrade bought. |
| 0:25 | 10 Beachcombers: milestone toast "**Beachcombers ×2**", and the figures grow a sorting table. The next milestone shows under the row: "17/25: speed ×2". |
| 0:40 | **Campfire** (96), a slower bar; tapping the pile keeps both lines moving. |
| 1:42 | **Hire Mara (1.8k)**, the first hand. She walks to the tideline and the Beachcomber bar keeps looping while the player rests their thumb. Hint: "Hands keep a line running, even while you're away." |
| 2:00 | **Timber era (1.5k)**: the lean-to pops into a timber cabin (the existing `setTier` pop), and Garden, Loom and Workbench rows appear, locked with their prices. Every line produces ×2. |
| 3:00 | The first **flotsam** (guaranteed): a crate bobs in from the left for 13 s. Tap it for "+15 min of salvage". The hint retires after two crates. |
| 3:18 | Hire Dax on the Campfire. The **×10 / ×100 / Max** buy buttons appear (after the second hand). |
| 6:42 | **Sorting Tables** (1M), the first island upgrade: everything ×2. |
| 7:06 | Third hand (Ivo, Garden). Tapping is now 11% of income, down from 59% at 0:20. |
| 8:42 | **Stone era (3M)**: stone base, ×2, and the Kiln, Furnace and Tannery rows appear. |
| 10:00 | A rusty **silo hatch** rises on the slope behind the base with "DO NOT" tape. Tap it to see "Crater glass yield: 0. First glass at 100M salvage made (now 31M)", with a progress bar. Locked, with its reason, never hidden. |

### 2.2 The first hour (active)

From the model: first glass at about 13 min (lifetime salvage 1e8). The 5th hand comes at 18 min,
the 6th at 32. **Sheet Metal era** arrives at about 38 min. About 6-8 flotsam have been
caught and the Logbook holds about 25 entries (each +2% morale). At about 40 min the
lifetime passes 1e11, the hatch steams and the advisor moves its crown to the red button: "Nuke
now: +10 glass, Glow ×1.0 → ×1.79, the Blast Map opens". **First nuke at 40-50 min.** Run 2
starts with Afterglow (taps ×3, fading over 15 min) and a Starter Kit node. It should pass run
1's total in under a third of the time (an asserted target, not yet modelled).

### 2.3 The first day (casual: three 6-minute check-ins at 08:00, 13:00 and 21:00)

The model with Night Shift at 60% for 8 h: 1e8 inside the first session, 1e9 by the 13:00
check-in and **1e11 at the 21:00 check-in**. So the casual player's first nuke is on the evening
of day 1, with the same +10 glass. Run 2 runs overnight on the hands kept by Old Friends
(a ring-1 node).

### 2.4 The first week

Nukes 2-8 (casual about one a day, active 2-4 a day). The **Armored era** (opens at nuke 2) is
first reached around nuke 3. The Dredge drops the first **scrap** on day 2, and the first crew
rank is bought on day 3. **Dares** open at nuke 5. Blast Map rings 1-3 are about half lit;
glass ever is about 300-2,000; the Logbook holds 70-90 entries.

### 2.5 The first month

About 25-40 nukes, with runs settling at a day (casual) or 2-6 h (active). Rings 4-6 open, and
the first **keystone** choice comes at nuke 10. Glass ever is about 1e5-1e6, the Logbook holds
150+ entries, and every hand has rank 1-2. The weekly **Freighter** co-op runs, and the
**Exodus** horizon shows, locked ("Opens when 70% of the Blast Map is lit").

### 2.6 A returning player after 2 days away

The welcome-back card shows one primary, **Collect**:

> Away 2 d 3 h. Your hands worked the Night Shift (24 h of it at 85%): +4.2T salvage. The
> Dredge hauled up 2 scrap (one ripened by itself; nothing is lost). 3 friends nuked their islands, and
> their debris washed up on your shore: 3 crates waiting (tap them). Logbook +2.

The run stalled at the Night Shift cap, so the advisor crowns the red button ("+34 glass, Glow
×2.7 → ×3.1"). Two minutes later the island is a crater, three nodes are bought and Afterglow
is running. A 2-day gap never hurts; it becomes one satisfying nuke.

---

## 3. The run

### 3.1 The resource model: one currency, on purpose

**Salvage** is the only run currency. Timber, stone, ore and the 12 parts are gone as
resources: each extra currency on a 390 px screen costs clarity, and Cookie Clicker and AdCap
show one number with many sources is enough. The flavour moves into the **lines** (the furnace
still glows, the loom still clacks), each selling what it makes as salvage. Scrap leaves the run
and becomes the rare persistent currency (section 6). In a run the player watches three numbers:
salvage per second, the Hustle meter and the pending glass on the hatch.

### 3.2 The 14 lines (generators)

Formulas (all in `packages/content/data/lines.json5`; `i` = rung, 1-14):

- base cost `c_i = 6 × 16^(i-1)`;
- base output `r_i = 1.5 × 5.5^(i-1)` salvage/s per unit;
- cycle `t_i = 0.6 × 2^(i-1)` s;
- growth `g_i = 1.15 − 0.006 (i−1)`;
- hand price `h_i = 300 × c_i`.

Cost of the n-th unit: `c_i × g_i^n`. Buy-k and buy-max use the closed-form geometric series
(Pecorella). Output per second = `owned × r_i × milestones × upgrades × era × roster × glow ×
morale × rank`.

| # | Line (id) | Era | Base cost | Base /s | Cycle | Growth | Hand (crew) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Beachcomber (`beachcomber`, new) | Twig | 6 | 1.5 | 0.6 s | 1.150 | Mara 1.8k |
| 2 | Campfire (`campfire`) | Twig | 96 | 8.25 | 1.2 s | 1.144 | Dax 28.8k |
| 3 | Garden (`garden`) | Twig | 1.54k | 45 | 2.4 s | 1.138 | Ivo 461k |
| 4 | Loom (`loom`) | Timber | 24.6k | 250 | 4.8 s | 1.132 | Rook 7.37M |
| 5 | Workbench (`workbench`) | Timber | 393k | 1.37k | 9.6 s | 1.126 | Sela 118M |
| 6 | Charcoal Kiln (`kiln`) | Timber | 6.29M | 7.55k | 19 s | 1.120 | Bram 1.89B |
| 7 | Furnace (`furnace`) | Stone | 101M | 41.5k | 38 s | 1.114 | Wren 30.2B |
| 8 | Tannery (`tannery`) | Stone | 1.61B | 228k | 77 s | 1.108 | Otto 483B |
| 9 | Oil Press (`press`) | Stone | 25.8B | 1.26M | 2.6 min | 1.102 | Juno 7.73T |
| 10 | Dock (`dock`) | Sheet Metal | 412B | 6.91M | 5.1 min | 1.096 | Pike 124T |
| 11 | Generator (`generator`) | Sheet Metal | 6.6T | 38M | 10 min | 1.090 | Hale 1.98Qa |
| 12 | Radio Mast (`radio_mast`) | Sheet Metal | 106T | 209M | 20 min | 1.084 | Tamsin 31.7Qa |
| 13 | Ship Breaker (`shipbreaker`, new) | Armored | 1.69Qa | 1.15B | 41 min | 1.078 | Gus (new) 507Qa |
| 14 | Reactor (`reactor`, new) | Armored | 27Qa | 6.32B | 82 min | 1.072 | Vera (new) 8.11Qi |

Costs rise ×16 per rung and output ×5.5, so base payback roughly triples per rung (4 s → 49
days) and the cheapest output keeps rotating between lines, the core buy decision. High-rung
growth is gentler (AdCap), so the top lines are owned in the hundreds. The top cycle bars double
as check-in clocks. Eleven lines reuse buildings the scene already draws with three levels
(`scene/buildings.ts`), shown at 1, 100 and 300 owned plus a count badge.

### 3.3 Ownership milestones

- **Per line:**
  - 10 owned: payout ×2;
  - 25 and 50: **speed ×2** (the bar visibly halves, AdCap's best feeling);
  - 100: ×2; 200 and 300: ×3; 400: ×4;
  - then ×2 every 100, and ×5 at 1,000.

  Each row shows "38/50 → speed ×2" under the bar. Below 0.1 s a cycle becomes a solid
  running stripe and further speed-ups add payout.
- **Roster** (every unlocked line): 25 each → all ×2; 100 each → all ×2; 250 each → all ×3.
  This rewards buying broadly and is shown as one bar in the shop header.

### 3.4 Upgrades (the shelf), about 50 per run

- **Grip** (the 5 tool ids reused): Rock (start, 1 per tap), Stone Tools 60, Iron Tools 6k,
  Salvaged Tools 6M, Power Tools 6B. Each doubles the base tap and adds +1% of salvage/s per tap.
- **Line Mk II / Mk III** (28): line ×3, priced at base × 10^4 (needs 25 owned) and base × 10^8
  (needs 50 owned).
- **Island upgrades** (8): everything ×2 at 1M, 10B, 100T, 1e18 and every ×10^4 after
  (Sorting Tables, Handcarts, Rope Lift, Rail Spur, Diesel Crane ...).
- **Eras** (4 purchases): Timber 1.5k, Stone 3M, Sheet Metal 20B, Armored 400T (needs 2 nukes).
  Each era is ×2 to all lines, redraws the base and reveals three rungs with their prices
  (disabled with their reason before then, rule 6.3.3).

A run is a few thousand line units plus about 55 upgrades, against today's ~62 purchases a
month.

### 3.5 The click verb

**One verb: tap the Junk Pile.** It sits centre-screen (the empty phone sky in the current
framing becomes its home, and the camera reframes so the pile takes about 45% of the width).
Each tap pays and keeps every unmanned line cycling.

- **Tap value** = `(2^grip + p × salvage/s) × Hustle × glow`, where `p` = 1% per Grip upgrade
  (4% at Power Tools) plus Blast Map nodes (up to +25%).
- **Hustle** is a meter filled by tapping (+1 per tap, max 100) that drains 10 per second
  after 2 s without a tap. It multiplies tap value from ×1 to ×2 (×5 with Grip nodes). It is
  real seconds, never the demo clock (rule 9).
- **Unmanned lines** run only while you tap: any tap starts every idle unmanned cycle. This
  is AdCap's "tap to run a cycle" folded into the same single gesture, so there is no second
  tap target.
- **The click share arc** (model): taps are 59% of income at 0:20, 33% at 1:00 and 7-15%
  from minute 3, rising to about 20% by the end of the run as the Grip upgrades land. Clicking dominates
  the first minute of every run, matters all run, and never beats automation.
- **Target ratio:** an active hour (taps + Hustle + flotsam) is worth about **2-3×** an idle
  online hour mid-game, never 10×. The simulator asserts this band, replacing the old 1.6×
  rule (which was never asserted).

### 3.6 Active bursts: flotsam

While the page is open, something drifts in from the sea (left of x≈480) **every 4-10 min** and
floats for **13 s**. The schedule is seeded per player server-side. It is claimed with an
idempotent `claim_flotsam` command inside its window, and rain spawns 1.5× more often.

| Flotsam (proposal) | Weight | Effect |
| --- | --- | --- |
| Supply Crate (`crate`) | 45% | instant `min(15% of bank, 15 min of salvage/s)` (bank cap prevents farming) |
| Signal Flare | 40% | **Rally**: all output ×6 for 60 s |
| Adrenaline Shot | 6% | taps ×300 for 12 s |
| Drowned Drone | 7% | one random line ×12 for 30 s |
| Sealed Locker | 1.5% | **1 scrap** |
| Message in a Bottle | 0.5% | a Logbook secret's hint + a crate |

Buffs multiply, so Rally × Adrenaline × Hustle is the combo active players hunt. The **Flare Gun**
(a Blast Map node) calls one on demand every hour, so players can set combos up.

### 3.7 The automation ladder

| Stage | What automates | By what |
| --- | --- | --- |
| minute 1-30 of run 1 | one line at a time | **hands**: hire a named crew member per line (AdCap managers); lost on a nuke unless kept |
| run 1, after the 2nd hand | buying in bulk | ×10 / ×100 / Max buttons |
| nuke 1 | the start of a run | Starter Kit, Old Friends (Mara kept), Afterglow |
| nuke 3 | early hands | milestone: hands for lines 1-3 survive nukes; Old Crew nodes extend it to 6, 10, all |
| nuke 7 | buying | the **Foreman** buys the best-payback line while you watch, and does one greedy buy-max pass when you return |
| nuke 15 | flotsam | Flare Gun; then "Beachcomber's Net" auto-catches crates (not flares) |
| nuke 25 | the nuke itself | **Dead Hand** (opt-in): nukes automatically when the yield reaches X% of glass ever, no cinematic |

### 3.8 Offline progress: the Night Shift

Managed lines keep producing offline at **60% for up to 8 h** (the Night Shift). Bunker
nodes and milestones raise this to **100% and 36 h**. When the window fills, accrual stops and
nothing is destroyed. The opt-in notification "Night Shift over" is on by default. Unmanned
lines, Hustle and flotsam do nothing offline. Settling is closed-form: rates are piecewise
constant between purchases, the Foreman's return pass is one deterministic bulk step, and
Afterglow is a closed-form decaying integral.

### 3.9 Calibration notes (rough model, for the simulator to own)

- **Active run 1** (6 taps/s, greedy buyer, no flotsam): hand 1 at 1:42, Timber at 2:00,
  Stone at 8:42, 1e9 at 17 min, Sheet Metal at 38 min, 1e11 at ~40 min, 1e12 at 52 min,
  1e13 at 77 min.
- **Casual:** 1e11 at the 21:00 check-in of day 1, 1e12 at ~24 h, 1e13 at ~37 h.
- **Over several runs:** with linear Glow (+2-3% per glass) the model **ran away** to ×18-55
  glass per nuke in runs 4-7, when the high rungs open. With square-root Glow (below) it
  flattened to ×1.2 by run 9 unless new content arrived. Both lessons are built in: Glow is
  square-root, eras and rings are gated by nuke count, and the Blast Map's notables carry
  mid- and late-game growth.

---

## 4. The nuke

### 4.1 Unlock and formula

- **Crater glass ever** `G = floor(cbrt(L / 1e8))`, where `L` is lifetime salvage across all
  runs. A nuke pays `G − glass_already_earned` (Cookie Clicker's delta), so nuking early again
  and again cannot farm it. Doubling your glass needs 8× the lifetime salvage.
- Reference points:

  | Lifetime salvage | 1e8 | 1e11 | 1e12 | 1e15 | 1e18 | 1e24 | 1e30 | 1e36 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Glass ever | 1 | 10 | 21 | 215 | 2,154 | 215k | 21.5M | 2.15B |

- **What one glass is worth.** Glass ever earned powers **Glow** = `1 + 0.25 × √G` (×1.79 at 10,
  ×4.7 at 215, ×117 at 215k). The UI shows Glow as one multiplier, before → after. **Spending
  glass on the tree never lowers Glow**, so there is no spend-or-hoard dilemma (Cookie, not
  AdCap). Glow-factor nodes raise 0.25 toward 1.0.
- **The hatch is visible from minute 10** with its yield and progress. It is pressable at
  yield ≥ 1. The advisor promotes it when the yield is at least the glass already earned
  (the doubling rule) or when the glass-per-hour rate falls below 80% of its peak for this run.
  The hatch shows all three numbers: "+12 now · 9/h now · peak 14/h".

### 4.2 Staging (UX and comedic beats)

1. **Foreshadow** (minute 10): the hatch rises out of the slope, taped shut, "DO NOT"
   hand-painted on it.
2. **Ready:** steam curls out and a crew member keeps glancing at it. When recommended, the
   hatch glows and the crown moves to it.
3. **The cover card** (rule 6.3.4, danger style, never the red primary gradient):
   - **Gain:** +12 glass, Glow ×1.79 → ×2.35, and what the next nuke unlocks.
   - **Kept:** glass, Blast Map, Logbook, scrap, crew ranks, keepsakes.
   - **Lost:** salvage, lines, hands (except kept ones), upgrades, era.
   - Two actions: "Flip the lid" and "Not yet".
4. **The weird button:** a fat red dome bolted to an oil drum, under a hinged **toilet-seat
   lid** wrapped in hazard tape, with a smiley sticker half peeled off. Hold for 2 s with a
   rising whine. Release early to cancel. Crew one-liners rotate: "I *just* fixed the roof."
   "Is that ours?" "Somebody grab the kettle."
5. **The cinematic** (7 s real time, skippable from the second nuke; reduced motion gets a
   fade): the crew sprint to a rowboat (one runs back for the kettle); the missile climbs out
   of *your own* silo, arcs up, hesitates and comes back down; a white flash (CSS overlay, 80 ms
   rise, 600 ms decay), a fireball on the `lights` layer (D47), a puff-sprite mushroom cloud and
   camera shake; a crater of green glass, and a gull landing on the rowboat.
6. **Results:** glass shards fly from the crater into the counter. The card reads "Nuke #4 ·
   run 3 h 12 m · +12 glass · Glow ×2.35 · Next nuke unlocks: Dares". Its primary is "Open the
   Blast Map" the first time, then "Rebuild".
7. **Rebuild:** the rowboat lands, the tide washes in a new Junk Pile ("the sea always brings
   junk") and a twig lean-to pops up. **Afterglow** gives taps ×3, halving every 5 min: the
   wipe-day rush.
8. **The news:** "Patrik pressed the red button. Saltmarsh is a crater again (nuke #4). +12
   crater glass." goes to the feed and `#wipe-day-idle`; friends get Ashfall (section 8).

### 4.3 Kept and lost

| Kept forever | Lost every nuke |
| --- | --- |
| crater glass (spent and unspent), Glow, every Blast Map node | salvage, every line unit, upgrades, era |
| Logbook entries and morale | hands (except those kept by milestones and nodes) |
| scrap, crew ranks, keepsake slots and their contents | Hustle, active buffs, pending flotsam |
| nuke count, records, cosmetics, Island Count | the Night Shift window (it refills) |

### 4.4 Run lengths and acceleration targets (asserted by sim v2)

| Phase | Run length (active / casual) | Glass per nuke vs glass ever | Run N+1 passes run N's lifetime in |
| --- | --- | --- | --- |
| First nuke | 40-50 min / evening of day 1 | 10 (first) | n/a |
| Runs 2-5 | 15-60 min / half a day | ≥ ×2 | ≤ 30% of run N's time |
| Mid (weeks 2-4) | 2-6 h / one day | ×1.5-2 | ≤ 45% |
| Late (month 2+) | 1-3 days | ×1.2-1.5, a new ring or unlock every 5-10 nukes | ≤ 60% |

Floors replace the old day-14 rule: first nuke never under 25 min of perfect play; the
optimal archetype owns at most 40% of the tree by day 30 and the whole tree not before day 90.

### 4.5 The nuke-count agenda

Shown on every results card as "Next nuke unlocks ...":

| Nuke | Unlock |
| --- | --- |
| 1 | the Blast Map (rings 1-2), Glow, the Dredge starts dredging scrap |
| 2 | the Armored era; keepsake slot 1 (bought with scrap) |
| 3 | hands for lines 1-3 survive nukes; ring 3 |
| 5 | **Dares** (challenge nukes); ring 4 |
| 7 | the Foreman (lines 1-6) |
| 10 | ring 5 and the first keystone pair; Night Shift +4 h |
| 15 | Flare Gun; Logbook secret hints |
| 20 | ring 6; the Foreman covers all lines |
| 25 | Dead Hand (opt-in auto-nuke) |
| 30 / 40 / 50 | rings 7 / 8 / 9 |
| 70% of the tree lit | Exodus |

### 4.6 The second layer (design hook only): Exodus

When the tree flattens (glass ratio below ×1.3 for 5 nukes and 70% of nodes lit), the player can
**sail away**:

- **Reset:** glass, the Blast Map, Glow.
- **Kept:** the Logbook, scrap and ranks, cosmetics.
- **Pays Sea Charts** = `floor(5 × log10(glass ever / 1e6))`.
- **Charts buy island traits** for every later island (Sulfur Flats: Furnace line ×100;
  Fogbound: flotsam ×3, offline −50%), plus a permanent glass-gain multiplier.

It is a new island with a new curve (AdCap's Moon and Mars lesson), not the same island again.

---

## 5. The Blast Map (the massive tree)

### 5.1 Structure

The tree is drawn as the scorch pattern of a blast: **Ground Zero** at the centre,
**9 concentric rings** (blast radii) and **8 sectors** (wedges). Ring sizes per sector grow
outward: 2, 3, 4, 5, 5, 6, 6, 7, 7 nodes, so 45 per sector, **360 + Ground Zero = 361
nodes**.

| Sector | Theme |
| --- | --- |
| **Grip** | tap value, Hustle, crits, Afterglow |
| **Crew** | hands, traits, keeping hands |
| **Works** | lines, milestones, discounts, starting eras |
| **Tide** | flotsam frequency, duration, new kinds |
| **Bunker** | Night Shift efficiency and window |
| **Blast** | glass gain, Glow factor, nuke tricks |
| **Logbook** | morale factors, secrets |
| **Dredge** | scrap ripening, keepsakes, ranks |

Rings open by nuke count (section 4.5) *and* by cost.

### 5.2 Node types and their mix

| Type | Share | Count | Example |
| --- | --- | --- | --- |
| Small stat | 52% | ~188 | +25% tap value |
| Notable (named mechanic) | 19% | ~70 | 5% of taps crit ×10 |
| Keystone (rule-bending, mutually exclusive pairs) | 4% | 16 | Wipe Day Rush vs Bunker Mentality |
| Unlock (new toy or system) | 10% | ~36 | Flare Gun, Dares board, keepsake slot |
| Automation and QoL | 10% | ~36 | Old Crew, Foreman scope, Dead Hand |
| Sector completion and synergy | 5% | ~15 | "Works ring 3 lit: all lines ×2"; "+1% per hand hired" |

**Layout rule:** never more than three small nodes in a row before a notable or an unlock. Every
sector has at least one node per three rings that **changes the scene** (a new prop on the
island, a flotsam kind, a crew animation).

### 5.3 Cost scheme and respec

- **Cost bands by ring:** ring *r* costs `10^(r−1) × {1, 2, 3, 5}` glass (ring 1: 1-5;
  ring 5: 10k-50k; ring 9: 100M-500M). Glass ever grows roughly geometrically across nukes, so
  each nuke buys about **3-8 nodes**. Buying out the whole tree needs about 2e10 glass earned,
  lifetime salvage around 1e40, which lands at months 3-6.
- **Permanent, no refunds** (Cookie Clicker). **Keystones are a loadout**: re-pick them free at
  every nuke. **A free full respec** follows any owner balance patch (one D-entry per patch).
- **Glass is never** traded, gifted, wagered, sold or at risk.

### 5.4 Reading it on a 390 px phone

- **Overview:** the scorch disk fills the screen; each wedge shows its fill and glows if
  something in it is affordable ("Ring 4 opens at nuke 5").
- **Sector view:** a tapped wedge **unrolls into a vertical ladder**, ring 1 at the bottom and
  ring 9 at the top, at most 7 nodes per row, 44 px nodes (D48) with labels. One portrait screen
  shows about 3 rings; no pinch needed.
- **Tap a node:** a bottom sheet with icon, effect now → next, cost and "Buy" (the one primary),
  or the locked reason ("Ring 5 opens at nuke 10"). A far node offers "Buy path: 4 nodes, 1,240
  glass". Filter chips: Affordable · Taps · Offline · Automation. The advisor's pick pulses.
- **Desktop:** the whole disk with pan and zoom, reusing `MapView`'s input code (D88).

### 5.5 Example nodes

| Node (id) | Sector, ring, type | Effect | Cost |
| --- | --- | --- | --- |
| Ground Zero (`ground_zero`) | centre, root | opens the map; Glow active | free at nuke 1 |
| Calloused Hands (`steady_hands`, perk id reused) | Grip 1, stat | tap value +50% | 1 |
| Afterglow (`afterglow`) | Grip 1, unlock | taps ×3 after a nuke, halving every 5 min | 2 |
| Second Wind (`second_wind`) | Grip 1, notable | Hustle max ×1.5, drains half as fast | 3 |
| Lucky Swing (`lucky_swing`) | Grip 3, notable | 5% of taps crit ×10 (gold floater) | 200 |
| Hiring Board (`hiring_board`) | Crew 1, stat | hands cost −50% | 2 |
| Old Friends (`old_friend`, perk id reused) | Crew 1, automation | Mara's hire survives nukes | 3 |
| Old Crew I (`old_crew_1`) | Crew 2, automation | hands for lines 1-6 survive nukes | 30 |
| Second Nature (`second_nature`) | Crew 3, notable | hand traits count double | 300 |
| Starter Kit (`packed_crate`, perk id reused) | Works 1, unlock | start runs with 10 Beachcombers and 5 Campfires | 2 |
| Prefab Walls (`prefab_walls`) | Works 3, unlock | start runs in the Timber era | 150 |
| Union Rules (`union_rules`) | Works 4, notable | every milestone ×2 becomes ×2.5 | 2,000 |
| Lucky Tide (`lucky_tide`) | Tide 1, stat | flotsam every 3-8 min | 2 |
| Flare Gun (`flare_gun`) | Tide 4, unlock | call a flotsam, 1 h recharge | 3,000 |
| Rogue Wave (`rogue_wave`) | Tide 5, notable | 10% of flotsam arrive in pairs | 20k |
| Thick Blankets (`thick_blankets`) | Bunker 1, stat | Night Shift 60% → 75% | 1 |
| Deep Pantry (`deep_cellars`, perk id reused) | Bunker 2, stat | Night Shift +4 h | 30 |
| Sleepwalkers (`sleepwalkers`) | Bunker 4, notable | the first 2 h offline count at 100% | 2,000 |
| Bigger Payload (`bigger_payload`) | Blast 1, stat | +10% glass per nuke | 4 |
| Glow Lamp (`glow_lamp`) | Blast 2, notable | Glow factor 0.25 → 0.30 | 40 |
| Double Tap (`double_tap`) | Blast 7, notable | a second nuke within 30 min of the last pays +25% glass | 2M |
| Dead Hand (`dead_hand`) | Blast 6, automation | opt-in auto-nuke at a chosen yield | 200k |
| Campfire Stories (`war_stories`, perk id reused) | Logbook 1, stat | morale +3% per entry instead of +2% | 3 |
| Keepsake Shelf (`keepsake_shelf`) | Dredge 3, unlock | +1 keepsake slot | 300 |
| **Keystone: Wipe Day Rush** | Grip 5 | Afterglow lasts 60 min at ×5; Night Shift −50% | 20k |
| **Keystone: Bunker Mentality** | Bunker 5 | offline 150%; no flotsam while Hustle < 50 | 20k |
| **Keystone: Scavenger's Eye** | Tide 8 | every flotsam is a Rally; crates gone | 30M |
| **Keystone: Lone Wolf** | Crew 8 | no hands at all; each tap ×1,000 | 30M |

---

## 6. Currencies

| Currency | Scope | Sources | Sinks | Display |
| --- | --- | --- | --- | --- |
| **Salvage** | one run | the Junk Pile, lines, flotsam, Afterglow | lines, hands, upgrades, eras | big smooth counter, `12.4Qa`, plus `/s` |
| **Crater glass** | forever | the nuke only (`cbrt` formula, +% nodes, Late Tide catch-up) | Blast Map nodes only | chip, `2,154`; Glow shown as ×4.67 |
| **Scrap** (rare) | forever | the Dredge (1 per ~23 h), Sealed Locker flotsam (1.5%), +1 per 25 Logbook entries, Freighter goals (2-5 a week), 3 for the first nuke | crew ranks, keepsake slots | gold chip, `7`. Never more than about 2 a day. |

Derived values, not currencies:

- **Glow:** from glass ever.
- **Morale:** +2% per Logbook entry, multiplied by Logbook nodes.
- **Hustle:** a meter.

**What happens to scrap.** It leaves the run economy completely and becomes Wipe Day's sugar lump.
**The Dredge** is a magnet crane over the bay; it costs nothing and runs from nuke 1:

- 20 h in: haul early, with a 50% chance of 1 scrap;
- 23 h: a sure haul, and 10% of hauls are "rich" (2-3 scrap);
- 24 h: it hauls by itself, so nothing is lost.

What scrap buys:

- **Crew ranks**, AdCap gilding reborn: 5 ranks per hand at 1/2/4/8/16 scrap, each ×3 to that
  hand's line, permanent. Maxing all 14 hands takes 434 scrap, about a year.
- **Keepsake slots** at 5/15/40 scrap: keep one in-run upgrade through nukes.

No other sink exists, so seven scrap in your pocket always means a real choice. It answers the
owner's "make scrap RARE" literally.

**Names (own IP check):**

- **Salvage**, **Crater glass**, **Scrap**, **Dredge**, **Hustle**, **Flotsam**, **Night Shift**,
  **Logbook**, **Morale**, **Blast Map**, **Ground Zero**, **Ashfall** and **Dares** are generic
  words.
- Rejected:
  - "Blueprint Fragments" (a Rust item);
  - "Fallout", "Vault", "Rads" and "Caps" (another franchise);
  - "Stash" (a Rust item);
  - "Recycler" (strongly Rust);
  - "Half-Life" (a Valve title).

---

## 7. Systems disposition

| System | Verdict | How or why |
| --- | --- | --- |
| Seasons and the monthly reset | **Remove** | The nuke is the reset; two resets fight for the same emotion. One perpetual season row, never ended (zero SQL). |
| Season modifiers (4) | **Rework → Dares** | Opt-in challenge nukes from nuke 5, constraint shown in full (Long Night: no Night Shift, flotsam ×2; Dead Calm: no flotsam, reach Stone in 25 min). Each pays a Logbook page and a permanent +5-25%. |
| The Signal | **Remove** | Absolute shared stages are meaningless across 1e10× scale gaps. Replaced by the Island Count. |
| Legacy perks (8, 25% cap) | **Remove → Blast Map** | Perk ids become node ids. The 25% cap and its four enforcements are retired by decision. |
| PvP | **Remove** | Cross-scale theft is either worthless or absurd. It was the roadmap's first cut anyway. |
| NPC raids and defence | **Remove** | Wall-clock raids two days out never land inside hour-long runs, and losses punish absence. Walls, traps, turret and watchtower are gone. |
| Bandit camps | **Remove** | No map; charges are gone. |
| Player market | **Remove** | Exponential goods cannot be traded between friends at different scales. Its escrow pattern stays in git history. |
| The Den counter | **Remove (the skiff stays)** | The skiff becomes the scene's home of the upgrade shelf: tap it and the shop opens on Upgrades. |
| Contracts | **Remove** | Their social job moves to the scale-free Freighter (section 8). |
| The casino | **Remove** | Gambling a currency the owner wants rare makes no sense; flotsam is the bounded-luck layer. The odds engine and RTP test stay in history. |
| Crew (12, traits, levels) | **Rework → hands** | One named hand per line (12 existing + Gus, Vera). Traits become line perks (mule +25% payout, tinkerer cycle −20%, lucky: flotsam sometimes drifts from their line). Ranks are bought with scrap. Tiredness, sleep, injuries, gear and bonds are gone. |
| Expeditions, map and keycodes | **Remove** | The biggest cut: a second time scale and UI that fight the one-glance pillar. `MapView`'s pan and zoom lives on as the Blast Map; an Exodus island could bring back one-tap trips. |
| Crafting web and stations | **Remove** | Stations become lines with the same ids and drawings. Parts, queues, recipes and blueprints go. The "chains" pillar is deliberately dropped (section 11). |
| Furnaces | **Rework** | The Furnace is rung 7; furnace types are gone. |
| Buildings (18) | **Rework** | 11 become lines. Warehouse, bunkhouse and lights stay as scene props that change with Bunker and Crew nodes. Walls, traps, turret and watchtower are removed. |
| Tools (5) | **Rework → Grip** | The tap upgrade ladder, same ids. |
| Base tiers (5) | **Rework → eras** | Same ids, colours and drawings, re-climbed every run. |
| Nodes mini-game | **Remove** | Replaced by the Junk Pile; trees and rocks become scenery (their regrow art reused after a nuke). |
| Barrels | **Rework → flotsam** | Minutes apart instead of hours, effects relative to the run. |
| Daily tasks | **Remove** | The Logbook (about 250 entries, permanent) and the Dredge are the daily pull. |
| Weather and day-night | **Keep** | Ambience as today. Rain: flotsam ×1.5. The night tint makes the nuke flash land harder. |
| Leaderboards | **Rework** | Scale-free categories (section 8). |
| Feed | **Keep** | New kinds: nuked, first era reached, records, Logbook milestones, Freighter. Drop raid, sale and jackpot. |
| Notifications | **Keep, new kinds** | Night Shift over (default on), scrap ready (default on), friend nuked, Freighter goal (both opt-in). Raid and party kinds go. |
| Discord bot | **Keep the architecture** | `/base` shows salvage/s, Night Shift fill, the Dredge's pie, the nuke yield and recommendation, and "Open the game". No nuking from Discord: the button deserves its show. The feed channel posts nukes and records. |
| Welcome back | **Keep, central** | One card, one Collect (section 2.6). |
| Advisor and retiring hints | **Keep, rewrite rules** | Crowns the best-payback buy, a hand, the era, flotsam or the nuke. Hints retire after two uses. |

---

## 8. Social layer for 2-10 friends at very different levels

Every social feature counts **events, taps or ratios, never amounts**.

1. **Nuke news.** Every nuke posts to the feed and to Discord. First Armored, nuke #10 and
   records get their own lines.
2. **Ashfall** (positive sum). When a friend nukes, debris washes up on everyone else's shore:
   3 Supply Crates over the next hour, each `min(15% of bank, 15 min of output)`, so they scale
   to each receiver. It is computed lazily from `nuked` events in `event_log` since the last
   settle, with no cross-base writes. The nuker sees "Your blast washed 9 crates onto 3 islands".
3. **The Island Count.** Everyone's nukes add up: "Saltmarsh has been nuked 214 times". At
   10/50/100/250/500/1,000 the whole group gets a cosmetic (a scorched flag, a glass gull) or
   a tiny shared perk (+1 s flotsam float time).
4. **Boards** (monthly window and all-time; ties share; no progress reset):
   - Fastest run to 1T this month;
   - Nukes this month;
   - Best blast ratio (glass gained ÷ glass held before);
   - Logbook entries;
   - Blast Map nodes lit;
   - Flotsam caught.

   A newcomer can top three of the six in their first week.
5. **The Freighter** (weekly co-op, R6). A wreck grounds offshore for 48 h and taps on its hull
   count for everyone (goals 40k/120k/300k taps for 3 players, 1/2/2 scrap each). A hull tap
   still pays the tapper's own salvage. Taps are scale-free, so a day-1 friend counts as much
   as a veteran.
6. **Late Tide** (catch-up). A player below half the group's median glass ever earns ×2 glass
   per nuke until they reach it. The cube-root formula already front-loads big relative jumps.
7. **Gone:** gifting, trading, PvP, absolute shared projects.

---

## 9. Architecture implications and reuse

- **Numbers.** Plain JS doubles behind one `Amount` alias, with a `Number.isFinite` guard in
  `save()` and the domain; counts (owned, hands, nodes, nukes, scrap) stay integers. The
  magnitude budget is ≤ 1e45 for a full tree and ≤ 1e100 with Exodus, and the sim asserts the
  peak stays under 1e150, so break_infinity is never needed. The shared formatter gains Qa
  through Dc, then `1.23e36`, plus rates (`0.4/s`). `z.int()` amounts become
  `z.number().finite().nonnegative()`, lines are validated as formulas, and "integers in state"
  (CLAUDE.md section 4) is amended by decision.
- **Settle.** Rates are piecewise constant between commands, so production is closed-form per
  segment.
  - Windows split only at purchases (commands), buff start and end (seeded flotsam), the Night
    Shift cap and the Afterglow integral (closed form).
  - There is no continuous autobuyer: the Foreman buys through client commands while online,
    plus one deterministic greedy pass on return.
  - New property test: `settle(settle(s, t1), t2) ≈ settle(s, t2)` within 1e-9 relative.
  - `settleAll` loses about 10 settlers (crafts, missions, arrivals, barrel, tasks, nodes,
    listings, Den, contracts, wheel, raids).
- **Click transport.** The client coalesces taps into `{type: "taps", count, from, to}` every
  ~1 s or 30 taps, before a key is assigned. The domain silently clamps the count to a token
  bucket in state (15/s, burst 45), so prediction and server agree; unmanned lines are credited
  for `[from, to + cycle]`. Tap commands store a slim response (no state, 1 h TTL) and log one
  `tapped` event per batch, outside the feed. A network error never drops predicted taps.
- **Where the meta layer lives.** Inside the base document (`state.meta`: glass, glass ever,
  nodes, keystones, Logbook, scrap, ranks, keepsakes, nukes, records). Tree buys are predicted
  instantly (D64), and `nuke(state, now)` is a pure domain function, so the client plays the
  cinematic before the answer arrives and the sim plays whole lifetimes. The server overwrites
  the same `bases` row (`version` stays monotonic); the `legacy` row keeps only cosmetics and
  records; seasons stay as one perpetual row.
- **Ops.** One process, no new service; the idempotent `nuke` cannot fire twice.

**Honest reuse estimate (lines that survive):**

| Package | Survives | What survives |
| --- | --- | --- |
| `packages/domain` | ~25-30% | clock, rng, World, the command/refusal/idempotency shape, events → stats/feed/words, advisor shell, carry/newBase pattern. Craft, missions, raids, market, den, casino, signal and most of base go. |
| `apps/web` | ~45-50% | Pixi app, camera, layers, sky/terrain/palette, 11 building drawings, actors, effects (pooled), MapView input (→ Blast Map), Panel/Toast/AwayModal/SeasonOver patterns, store prediction, LocalBackend, demo clock, shots harness. Dock, panels and HUD are mostly rewritten. |
| `apps/api` | ~70-75% | auth, sessions, commands, SSE, push, backups, scheduler, bot routes. Den, raid and Signal code go; the slim tap path is new. |
| `packages/content` | ~20% | loader, zod plumbing, locale checks, `look.ts`. Data files rewritten. |
| `packages/sim` | ~20% | harness, manual clock, determinism. Policies and pacing rewritten as a lifetime-of-runs sim. |
| `apps/discord` | ~60-65% | everything but the card's content and season news. |
| **Overall** | **~40%** | |

---

## 10. Build plan

| Phase | Goal | Scope | Sessions |
| --- | --- | --- | --- |
| **R0** Clean slate (plan mode) | Decisions before code | See R0 list below | 1-2 |
| **R1** The Pile and the lines | Friends can play the climb | Domain (Amount, lines, milestones, hands, eras, shelf, taps, Night Shift, settle), phone layout (Pile, crowned shop drawer, smooth counters, pooled floaters, sound for taps), welcome back, sim v2 run-1 targets, the hatch visible but "Coming soon" | 4 |
| **Ship 1** | **Wipe and play** | Wipe season 1 (2 players, days old) via the tested recipe. The founders get the Driftwood skin and 3 scrap later. **Lifetime salvage counts from day one**, so the first nuke rewards R1 play. | n/a |
| **R2** The red button | The core loop is complete | Glass, the `nuke` command, cover card, button, cinematic (pinnable for shots), results, Afterglow, Blast Map overview + sector ladder with rings 1-3 (~73 nodes), agenda 1-5, nuke feed/Discord, minimal sound | 3-4 |
| **R3** Flotsam and the Logbook | The active layer | 6 flotsam kinds, Hustle, ~150 Logbook entries, morale | 2 |
| **R4** Scrap and crew | The slow layer | The Dredge, crew ranks, traits on hands, keepsakes, the Foreman | 2 |
| **R5** The whole Blast Map | Months of goals | Rings 4-9 (361 nodes), keystones and loadout, path buying, filters, label LOD, sim tree-horizon asserts | 3 |
| **R6** Friends | The social core | Ashfall, Island Count, boards, Freighter, Late Tide, `/base` card and DMs | 2 |
| **R7** Dares and Exodus | The second layer | Four Dares from the modifiers, Exodus and Sea Charts | 3 |

**R0 scope:**

- Take the off-server backup first (W9 item 1 pulled forward).
- Log decisions D127-D140:
  - retire the 25% cap, the 1.6× rule, the day-14/18 floors, monthly seasons and storage-cap
    check-ins;
  - amend "integers in state";
  - set the new shop rule: one crowned row per view;
  - record the cuts and the names.
- Rewrite CLAUDE.md sections 1, 4, 8 and 6.3 rules 1, 9 and 11.
- Delete the cut systems on a branch (tag `pre-redesign` first).
- Prune `SHOTS`.

Total about 20-22 sessions. Friends play after about 5 (R0 + R1), and the full loop lands at about
9. The W9 live-ops items interleave: error reporting in R1, admin grant in R2, CSV export in R3.

---

## 11. Risks, failure modes and open decisions

**Failure modes of this philosophy**

1. **Shallow after week 3.** Critics called AdCap "a pointless waste of time", and this design
   trades the owner's Melvor chains and Realm Grinder choices for clarity. *Mitigation:* the
   agenda adds a system every few nukes, Dares change the verbs, keystones create builds. If
   friends still drift, a crafting layer can return as an Exodus island trait, not in run 1.
2. **Prestige curve runaway or stall.** The model showed both. *Mitigation:* square-root Glow,
   gated eras and rings, all levers in data, and the sim asserts the per-nuke band before every
   ship.
3. **Multiplier bloat** (Cookie Clicker's late game: "the numbers stop meaning anything").
   *Mitigation:* the magnitude budget, Exodus as a value reset, and unlock nodes that change what
   you *see*, not just ×2.
4. **Click fatigue and phone heat.** 6-10 taps/s is tiring. *Mitigation:* active play is worth
   2-3× idle, not more; Hustle forgives 2 s pauses; Afterglow front-loads the frenzy; holding
   a finger on the pile counts as 4 taps/s (accessibility).
5. **Autoclickers.** The bucket caps at 15/s and a friends game does not need more. Clicking's
   share is ≤ 25%, so a cheat gains at most ×1.3.
6. **Sunk cost.** About 60% of the code written in W3-W7 goes. Tag it, archive the docs, and
   state the trade in the decisions.
7. **The UI bar is high** (priority 1). The cinematic, a 361-node tree on a phone and a 60 fps
   pile under spam need pooling, LOD and extra shot iterations in R2 and R5.
8. **Writing volume:** 361 nodes and 250 Logbook entries. Small stat nodes are templated in
   data; only notables are hand-written.
9. **Fourteen lines that all pay salvage may feel samey.** Each needs its own animation, sound
   and hand personality.

**Open decisions for the owner**

1. Names: Salvage, Crater glass, Scrap (rare), Junk Pile, Hands, Flotsam, Hustle, Night Shift,
   Dredge, Logbook, Blast Map, Ashfall, Dares, Exodus. And does Saltmarsh stay the island?
2. Accept the hard cuts (map and expeditions, crafting, raids, Den, casino, contracts), or
   park the map for an Exodus island?
3. Wipe season 1 at the R1 ship (recommended), or let it run until then?
4. Cube root plus square-root Glow (recommended), or AdCap's square root for a faster-feeling
   but steeper meta?
5. Dead Hand auto-nuke at nuke 25: yes or no? (It removes the show for those who opt in.)
6. Sound in R1-R2 (the nuke is half sound)? Who supplies it: procedural WebAudio, or the owner?
7. The Freighter in R6, or later?
8. The toilet-seat lid: funny or too silly? Alternatives: a cake dome, a bin lid.

---

## 12. Icons: what to keep drawing, what to stop, what is new

Namespace files by kind (`line/furnace.svg`, `tier/stone.svg`); D6 already prefixes tiers and
perks.

**Safe, keep drawing (about 50):**

- **Scrap:** top priority, now the precious gold chip.
- **5 tier badges** (`tier_twig`, `tier_wood`, `tier_stone`, `tier_metal`, `tier_hqm`): the eras.
- **5 tools** (rock, stone_tools, iron_tools, salvaged_tools, power_tools): the Grip upgrades.
- **11 buildings that become lines:** campfire, garden, loom, workbench, kiln, furnace,
  tannery, press, dock, generator, radio_mast.
- **12 crew portraits:** the hands.
- **11 traits:** hand perks.
- **`crate`:** the Supply Crate flotsam.
- **3 skins** (driftwood, rust, beacon): cosmetics, low priority.

**Stop drawing (about 150):**

- **22 resources:** every one except scrap (timber through charge).
- **14 items:** every one except crate.
- **7 buildings:** warehouse, bunkhouse, lights, watchtower, walls, traps, turret.
- **Map content:** furnace types (3), node kinds (5), sites (15), regions (13), trip events (3).
- **Perks (8):** their ids live on as nodes, but nodes use sector and type glyphs, not unique
  art.
- **Season and Den content:** Signal stages (4), contracts (12), Den stock (13), casino symbols
  (16), tasks (8), the old dock actions (11).
- **Wait until R7:** season modifiers (4). They may become Dare badges.

**New icons needed (about 45):**

- Currencies and meters: salvage, crater_glass, glow, morale, hustle, the junk_pile.
- Lines and hands: 3 new lines (beachcomber, shipbreaker, reactor), 2 new portraits (gus, vera),
  a hand badge (manager), the foreman.
- The nuke: red_button, silo_hatch, afterglow.
- Slow layer: dredge, logbook, night_shift, keepsake.
- Flotsam: signal_flare, adrenaline, drowned_drone, sealed_locker, bottle.
- Blast Map: ground_zero, 8 sector glyphs (grip, crew, works, tide, bunker, blast, logbook,
  dredge), 4 node-type badges (stat, notable, keystone, unlock).
- Shop: island upgrade, roster, buy ×10/Max.
- Navigation: island, blast_map, crew, friends.
- Social: ashfall, island_count, freighter (R6).
- Second layer: dares and exodus (R7).
