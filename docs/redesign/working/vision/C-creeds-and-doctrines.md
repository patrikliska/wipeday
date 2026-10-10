# Wipe Day redesign, proposal C: Creeds & Doctrines

Status: a proposal for the owner, 2026-10-07. No code. Names marked *(p)* are proposals for your
naming pass (D43: no name here comes from another game; "blueprint fragments" and anything vault- or
fallout-flavoured are avoided on purpose). Every number is a simulator target, not a promise.

Philosophy: runs that **feel different**, for hundreds of hours. Big numbers are the floor; the hook
is a different verb, skill bar and island every run, and a button that always opens something new.

---

## 1. Pitch and pillars

**Pitch.** Wipe Day becomes an idle game of short, different lives on Saltmarsh. Each run starts on a
beach with one tree. You tap like mad, hire pickers, raise the holdfast from Twig to Armored while
fifteen production lines fill the island, fire skills on cooldowns, and when the run slows you flip
the glass cover on the weird red button in your yard and nuke your own island. The blast pays
**Rads** (a level kept forever, +2% to everything each) and **Ash** (spent on the **Blast Map** *(p)*,
a 420-node tree drawn over your own crater). Run 40 does not feel like run 4 because at every launch
you also choose **who survives the blast**: a **creed** that changes your verbs, skill bar and base
(Scrappers smash, Tinkers wire drones onto lines, Bunker Folk seal the hatch and earn while
untouched, Tidecallers send boats) and optionally a **doctrine**, a visible handicap with a permanent
reward. Nearly every launch opens a new *system*, until in the second month the island is too hot to
live on and the **Exodus** to a new island opens.

**Pillars** (replacing game-design section 1):

1. **Every run has a creed.** It changes what you tap, what you wait for and what you see; a friend
   can tell your creed from a screenshot (the base still tells the story).
2. **Tap to start, automate to grow, choose your pace.** Frantic tapping, automated within minutes.
   Idle and active builds are both first-class.
3. **The button is the best moment of the game.** Funny, physical, previewed, and always shows what
   it pays and what it opens next.
4. **Each launch opens something new.** A visible agenda of systems, not "+5%".
5. **Nothing hidden, nothing taken.** Every requirement and odd is written in the game (hints for
   secrets). Only your own button takes things away; friends help, never hurt.

Kept from today's spec: zero tutorial, one primary per view, reasons on disabled buttons, welcome
back, mobile first, own IP, server authority, lazy settling. Retired: the monthly forced wipe, the
25% legacy cap, "8 check-ins at most 1.6x", "chains, not counters", storage caps as the check-in
driver, upkeep and decay.

---

## 2. The experience over time

### 2.1 The first 10 minutes (brand-new player, run 1, no creed: "Drifters")

Assumes 4-6 taps per second while tapping. Lines and formulas are in section 3.

| Time | What happens | Numbers |
| --- | --- | --- |
| 0:00 | Dawn on a beach. One big tree glows (the one primary action), hint "Tap the tree". Each tap shakes it, chips fly, "+1" rises. | tap = 1 supply |
| 0:04 | The shop drawer slides up one glowing row: **Pickers**, "a survivor who scavenges for you". | Picker 15, 0.1/s |
| 0:30 | Six pickers walk the beach. **Woodcutters** shows disabled: "need 180". | 0.6/s passive vs ~5/s tapping |
| 0:55 | First Woodcutter. The tree falls after 20 taps; the next pops up (today's fall, stump and regrow art, now endless). | |
| 1:10 | First **scrap**: gold "+1 scrap", a clink, hint "Scrap is rare. Keep it." | 1% per tap |
| 1:30 | **Heat** bar appears after 20 taps in a row: "Hot: everything x1.5 while you tap". | decays 3 s after the last tap |
| 2:00 | **Stone Tools** (400): taps x2, and each tap pays 1% of your supplies per second. | |
| 3:00 | 10 Pickers: first milestone "Pickers x2", the pickers get carts. | |
| 4:00 | Passive income passes tapping. | ~8/s |
| 4:30 | First **drift crate** washes ashore (guaranteed early in run 1). Tap within 13 s: **Surge**, x6 for 60 s. | |
| 5:30 | 25 lines owned unlocks **Rush** (taps x10 for 30 s, 10 min cooldown), a round button above the drawer. | |
| 6:30 | Rush + Heat + Surge stacked: a burst of numbers. | ~2.5k in 30 s |
| 8:30 | **Raise a Timber holdfast** (6,000): the card shows cost, result ("3 new lines, x1.5, a new skill") and what is left. The base pops to Timber; the tap target becomes a stone outcrop. | |
| 10:00 | A rusty **launch hatch** rises in the yard, taped sign "DO NOT. - Management". Its card: "Fuel cells 0/10. Your first launch opens at 100M supplies earned." Disabled with its reason. | |

### 2.2 The first hour

Timber era (lines 4-6, the **Second Shift** skill), Iron Tools, the first **Trade-in** *(p)* (20 scrap,
+10% this run), a milestone every few minutes, the Stone holdfast at minute 40-45 (12M). The hatch
fills cell by cell and is fuelled around minute 55-65 (10 Rads). Its card shows "Launch now: +10 Rads,
+10 Ash, rate 18/h, peak 22/h", and the advisor says "Worth waiting: x2 yield in about 20 min". At
minute 75-90 the yield is 25-30 and the rate dips below 80% of its peak: the launch becomes the one
primary action. Cinematic, first tree purchases in the same minute, first creed choice.

### 2.3 The first day

**Active:** 3-4 launches, Scrappers, Tinkers and Bunker Folk tried once each, ~15 nodes, the agenda
shows "Launch 2: Doctrines". **Casual (3 check-ins):** Timber in the morning; at lunch the welcome back
shows ~4 h of work at 50% and they buy to Stone; the hatch is fuelled by evening but the yield is
small, so the first launch lands at day 2's first check-in (~24 h, ~35 minutes of attention). The gap
to the clicker is intended and narrowed by catch-up (section 8).

### 2.4 The first week

Casual 5-8 launches, active 15-20. A launch counts toward the agenda only if it adds at least 10% to
the player's Rads (printed on the button), so micro-launches cannot rush it. By day 7 both have
doctrines, a keystone slot, persistent foremen, expeditions with the Tidecallers, a second keystone
slot and a relic slot. Tree: 12-18% of nodes, rings 1-3 nearly full. Week 1's goal: the first creed
**relic** (all 12 creed upgrades in one run).

### 2.5 The first month

Casual ~20-25 launches (Rads ~100k), active ~40-55 (Rads ~500k). All eight creeds open by launch 12;
Bloodline at 15, auto-launch at 20; at 25 the Ark's half-built hull appears on the shore, a week
before the Exodus opens. Runs stretch from 1 hour to 4-12 hours: one launch a day for the casual,
doctrine speed-runs for the active. Tree: casual ~40%, active ~50% of nodes by count, far less by cost.

### 2.6 A returning player after 2 days away

One card (rule 6.3.10): "You were away 2 days. The holdfast worked 16 h at 70% (your offline window):
+4.1T supplies. Mara and Dax bought 212 lines for you. 2 crews came back from the Narrows with 38
scrap and a schematic. Patrik launched twice: fallout drift x1.2 for 30 min is waiting." One primary,
**Back to work**, which starts the drift; under it, never primary: "Your hatch is fuelled: +1.2k Ash
ready." Nothing decayed or was stolen; the only loss is stated: "32 h past your window. The Night
Shift district extends it."

---

## 3. The run

### 3.1 Resource model: one bulk currency, one rare coin

| Currency | Role | Scale |
| --- | --- | --- |
| **Supplies** *(p)* | everything lines make; buys lines, tools, holdfast raises | exponential: 1 to ~1e60 per run before Exodus |
| **Scrap** | the rare coin of a run: creed gates, Trade-ins, the Den | tens to a few thousand per run |

One bulk currency because the top bar shows three chips at 390 px and exponential economies make
older materials irrelevant within an hour (today's 23 resources span x600 in value; here they would
span x1e30). The Rust feel comes from the lines (woodcutters, stone pit, furnace, kiln, sulfur
works), the five tiers rebuilt each run, the tap targets (tree, stone, ore, sulfur, a wrecked
container) and scrap as the precious currency, as in Rust.

**Scrap becomes rare** (the owner's ask) and plays the faction-coin role: 1% per manual tap, drift
crates, milestones (1-5), skills, and one scrap verb per creed so idle creeds reach their gates too.
It resets at the launch (the Stash node keeps 10-25%). A run-1 player sees ~100-150 scrap.

### 3.2 The lines (15 generators, 5 eras)

Each line is a building in the scene, drawn at levels 1/2/3 at 1/25/100 owned (today's three
drawings per building), with a count badge.

| # | Line *(p)* (id) | Era | Base cost | Base out/s | Growth r |
| --- | --- | --- | --- | --- | --- |
| 1 | Pickers (`pickers`, new) | Twig | 15 | 0.1 | 1.15 |
| 2 | Woodcutters (`woodcutters`, new) | Twig | 180 | 0.7 | 1.15 |
| 3 | Garden (`garden`) | Twig | 2,160 | 4.9 | 1.15 |
| 4 | Stone pit (`stone_pit`, new) | Timber | 25.9k | 34.3 | 1.14 |
| 5 | Loom (`loom`) | Timber | 311k | 240 | 1.14 |
| 6 | Workbench (`workbench`) | Timber | 3.73M | 1,681 | 1.14 |
| 7 | Furnace (`furnace`) | Stone | 44.8M | 11.8k | 1.13 |
| 8 | Kiln (`kiln`) | Stone | 537M | 82.4k | 1.13 |
| 9 | Tannery (`tannery`) | Stone | 6.45B | 576k | 1.13 |
| 10 | Press (`press`) | Sheet Metal | 77.4B | 4.04M | 1.11 |
| 11 | Generator (`generator`) | Sheet Metal | 929B | 28.2M | 1.11 |
| 12 | Dock (`dock`) | Sheet Metal | 11.1T | 198M | 1.11 |
| 13 | Radio mast (`radio_mast`) | Armored | 134T | 1.38B | 1.09 |
| 14 | Sulfur works (`sulfur_works`, new) | Armored | 1.6Qa | 9.7B | 1.09 |
| 15 | Reactor shed (`reactor`, new) | Armored | 19.3Qa | 68B | 1.09 |

Base cost x12 per line, base output x7, so base payback grows x1.71 per line (150 s for Pickers, ~4 h
for the Tannery): the cheapest "cost per supply/s" rotates between lines, and gentler growth for
higher eras lets late lines be owned in the hundreds.

**Era structures** (one-off per era, four reused ids): Campfire (Heat bonus +50%), Warehouse
(offline window +2 h), Bunkhouse (foreman slots +2), Lights (crates live +5 s, +10% at night).

### 3.3 Formulas

```
cost of the next unit   = base_i x r^owned x (1 - discount)
cost of n more          = base_i x r^owned x (r^n - 1) / (r - 1)
max affordable          = floor( log_r( S x (r - 1) / (base_i x r^owned) + 1 ) )
line output/s           = base_out_i x owned_i x 2^milestones_i x (1 + sum inc_i) x product more_i x G
G (global)              = (1 + 0.02 x Rads) x (1 + 0.01 x logbook) x era x creed x heat x buffs x (1 + 0.1 x trade-ins)
tap value               = (1 + tool flat) x tap_more x afterglow + tap% x supplies/s
heat multiplier         = 1 + 0.5 x heat/100   (Scrappers: 1 + 1.5 x heat/100)
```

Minute 30 of run 1: lines make ~870/s; an Iron Tools tap pays 4 + 2% of 870 = 21, so 5 taps/s with
Heat x1.5 adds ~160/s (18%): tapping matters but no longer dominates.

### 3.4 Milestones

- Per line: x2 at 10, 25, 50, 100, 150, 200, then every 100, with "38/50 -> x2" and a thin bar on
  the row. Milestones pay scrap (1, 2, 3, then 5).
- **Holdfast milestones** (own N of every unlocked line): 25 -> everything x2 and taps x2; 50 -> every
  cooldown -10%; 100 -> crates 20% more often. They reward broad buying.
- The building redraws at 25 and 100 owned: milestones are seen, not just read.

### 3.5 Eras inside a run (the five holdfast tiers)

| Era | Raise cost | Opens | Skill | Tap target |
| --- | --- | --- | --- | --- |
| Twig | start | lines 1-3 | Rush (at 25 lines) | trees |
| Timber | 6k | lines 4-6, x1.5 | Second Shift | stone outcrop |
| Stone | 12M | lines 7-9, x1.5, the hatch can launch | Sweep | ore seam |
| Sheet Metal | 20B | lines 10-12, x1.5 | Flare | sulfur vent |
| Armored | 35T | lines 13-15, x1.5 | Grit | wrecked container |

Tier ids, colours and base drawings stay. A raise is instant (no 4/12/24 h timers) and is the run's
chapter break: the pop, a new tap target, a new skill, three new rows.

### 3.6 The click verb

- **The target** is drawn large in the phone's empty sky band (camera re-framed: target at 40%
  height, at least 120 CSS px). It chips, wears, falls after N taps and the next one pops. The marker
  reaction game and the daily haul (D63) go: any tap on the target counts.
- **Tools are the tap ladder:** Rock (1 per tap), Stone Tools (400: x2, +1% of /s), Iron Tools (80k:
  x2, +1%), Salvaged Tools (8M + 50 scrap: x2, +1%, 5% crits x10), Power Tools (2B + 200 scrap: x3, +2%).
- **It stays relevant** because taps scale with production, Heat multiplies everything while tapping,
  skills and crates reward presence, and most scrap comes from taps.
- **Its cap:** mid-game, an hour of best active play is worth at most 3x the same build left open
  and idle (asserted). Taps are credited up to 15/s (bursts of 30); autoclickers gain nothing.

### 3.7 Active bursts

**Skills**: short effects, long real-time cooldowns, never sped by the demo clock; five 48 px round
buttons with cooldown rings above the drawer. They return every run as eras open.

| Skill *(p)* | Effect | Cooldown |
| --- | --- | --- |
| Rush | taps x10 for 30 s | 10 min |
| Second Shift | all lines x2 for 60 s | 15 min |
| Sweep | 15 minutes of production at once | 30 min |
| Flare | calls a drift crate now | 1 h |
| Grit | x1.05 for the rest of the run, stacks to 10 | 8 h |
| Second Wind (tree) | doubles the next skill | 1 h |
| Duct Tape (tree) | resets the last skill's cooldown | 1 h |
| creed skill | section 4.7 | 10 min-12 h |

The meta-skills turn a two-minute check-in into routing ("Second Wind, Second Shift, Duct Tape,
Second Shift again").

**Drift crates** *(p)* (today's barrel as a golden event): ashore every 5-15 min while the page is
open, 13 s to tap. Effects, weights listed in the logbook: Windfall (lesser of 15% of held supplies or
15 min of production, 45%), Surge (x6 for 60 s, 40%), Frenzy (taps x300 for 12 s, 4%), Line Rush (one
line x10 for 30 s, 8%), Scrap cache (5-15, 3%). Buffs multiply: the active player's skill ceiling.

### 3.8 The automation ladder

| When | What automates | By what |
| --- | --- | --- |
| ~0:05 | taps | Pickers (literally auto-scavengers) |
| ~4:00 | income passes tapping | lines are passive from purchase |
| run 1, Stone era | buying a line | **Foremen**: a crew member on a line gives x2 and auto-buys it each settle; traits become perks (scavenger +scrap, mule +25% bulk, tinkerer -5% cost); 2 slots, +2 per Bunkhouse |
| launch 3 | foremen keep their posts | agenda |
| tree | every line auto-buys by best payback; auto-cast one skill; auto-raise eras | Foreman's Ledger, Standing Orders, Survey Crew |
| launch 20 | the launch itself, at a yield you set | Auto-launch rig |
| Tinkers | drones: wired lines x2 and auto-buy | creed |

Active attention moves from rows to skills, crates, creeds and doctrines.

### 3.9 Offline progress

Lines run offline at **50% for up to 8 hours** at first (Warehouse +2 h per era); the Night Shift
district raises it to 100% and 48 h; Bunker Folk start at 100% and +16 h. Heat, skills and crates do
not run offline. Foremen buy offline in hourly slices (at most 48 steps per settle). Nothing decays or
is raided; only hours past the window are lost.

---

## 4. The nuke

### 4.1 Unlock

The hatch rises at the Timber holdfast, locked, showing "fuel cells x/10" (progress to 10 Rads). It can
launch once the Stone holdfast stands and the run pays at least 10 Rads (first time) or 1 Rad
(after). The advisor makes it the primary only when the yield is at least +50% of held Rads (or opens
an agenda item) and the yield rate is below 80% of the run's peak. The card always shows Rads now, the
yield, rate now and peak, "next Rad at" and what the launch opens.

### 4.2 Staging

The button must never look like the advisor's red primary (`--accent`): a physical dome under a
hinged glass cover in a yellow-black hazard frame.

1. **Foreshadow.** The hatch steams when a launch would be good; a crew member glances at it.
2. **Flip the cover.** One card (rule 6.3.4): **gain** +42 Rads (x1.84 -> x2.68 everything), +42 Ash,
   "opens: Doctrines"; **keep** tree, Rads, Ash, relics, logbook, crew; **lose** supplies, scrap,
   lines, era, Trade-ins. Then the next run's **creed** (a strip of cards, untried ones glow), an
   optional **doctrine** and the keystone loadout. Cancel is always there.
3. **Hold to launch** for 2.5 s while a hand-cranked siren rises. A random crew line: "I just fixed
   the roof." "Is that the good button?" "Somebody get the gull."
4. **Launch** (6-8 s, skippable after the first, a fade under reduced motion): the garden shed roof
   slides open, a dented missile nicknamed **Big Sunny** *(p)* wobbles up, arcs over the sea,
   hesitates, turns round. The crew watch from a dinghy in sunglasses. White flash, fireball on the
   `lights` layer (D47), camera shake, a mushroom cloud of the existing puff sprites, Ash falling into
   the top bar.
5. **Postcard.** "Greetings from Ground Zero", run stats on the back; primary **Spend Ash** (opens the
   Blast Map), secondary **Begin run 5**.
6. **Afterglow.** The new run starts on a glowing crater under a green sky that clears as you rebuild;
   taps x5 decaying with a 20-minute half-life (closed form): the "click like crazy" rush of every run.
7. **Tell everyone.** Feed and Discord: "Patrik pressed the red button. Run 7, 3 h 12 min, +420 Rads,
   now a Tinker." Friends get fallout drift (section 8).

### 4.3 Formula and value

```
Rads (kept, never spent)   = floor( sqrt( L / 1e6 ) )     L = lifetime supplies since the last Exodus
Ash gained at a launch     = (Rads after - Rads before) x (1 + Ash bonuses)
```

The first Rad needs 1M lifetime; doubling Rads needs 4x the lifetime (a square root: generous early,
right for friends). Lifetime with a delta cannot be farmed by repeated early launches. **1 Rad = +2% to
everything, forever** (30 = x1.6, 500 = x11, 5,000 = x101). **1 Ash**: ring-1 nodes cost 1-3, so the
first launch buys 6-10 nodes; later a node costs about one launch of Ash in the ring being worked.
The split (kept level, spent currency) means spending is never punished.

### 4.4 Kept and lost

| Kept | Lost |
| --- | --- |
| Rads, unspent Ash, tree nodes, keystones, relics, logbook, doctrine marks, crew levels and posts (launch 3+), agenda, lifetime stats, cosmetics, schematics | supplies, scrap (except Stash), lines, milestones, era, tools, Trade-ins, creed upgrades, cooldowns (all reset to ready), Heat, buffs |

Crews still out on expeditions come home to a crater; their haul waits in the next run.

### 4.5 Run lengths and acceleration

| Stage | Run length (active / casual) | Per-launch target |
| --- | --- | --- |
| First launch | 75-90 min / ~24 h | - |
| Launches 2-5 | 30 min-3 h / one a day | reach the last run's lifetime in <= 50% of its time; power x2-3 per launch |
| Mid (6-30) | 2-12 h / one per 1-2 days | <= 65%; x1.4-1.8 |
| Late (30+) | 12 h-3 days | x1.2-1.4: the signal to open the Exodus, not to stretch runs |

### 4.6 The launch-count agenda

A horizon list on the card ("Next launch opens: ..."); a launch counts if it adds 10% to your Rads.

| Launch | Opens |
| --- | --- |
| 1 | Rads, the Blast Map, creeds (Scrappers, Tinkers, Bunker Folk) |
| 2 | Doctrines; keystone slot 1 |
| 3 | Foremen keep their posts; per-line auto-buy |
| 4 | Expeditions and the island map; Tidecallers |
| 5 | Keystone slot 2; relic slot 1 |
| 6 | The Den; Smugglers |
| 8 | Turncoats; auto-raise eras |
| 10 | Glowheads; Duct Tape |
| 12 | Wardens and warlord nights |
| 15 | Bloodline (a second creed's passive); keystone slot 3 |
| 20 | Auto-launch rig; relic slot 2 |
| 25 | The Ark's hull on the shore |
| 30 | The Exodus (once gains flatten, 4.9) |

### 4.7 Creeds: chosen at the button, played for one run

Each creed has a passive, one skill, a scrap verb, a scene overlay and 12 upgrades in three tiers
(each tier: a scrap gate of 25 / 150 / 600 and three supply upgrades). All 12 in one run earns its
**relic**, a small perk usable with any creed: collecting relics drives rotation.

| Creed *(p)* | Verb | Passive | Skill | Scrap verb | Scene | Relic |
| --- | --- | --- | --- | --- | --- | --- |
| Drifters (run 1 / none) | tap | none; +10% Ash when picked later | - | taps | plain holdfast | - |
| **Scrappers** | smash | taps x3, Heat bonus x3, crits; lines x0.85 | Rampage: 12 auto-taps/s for 30 s counting as yours (15 min) | taps x2 | junk heaps, a crane over a giant wreck | Lucky Crowbar: taps +50%, scrap +25% |
| **Tinkers** | wire | 1 drone per 25 lines; a drone on a line: x2 + auto-buy; taps x0.5 | Overclock: wired lines x5 for 45 s, then idle 15 s (10 min) | 1 per wired line per 10 min | cables, conveyors, drones | Pocket Drone: a drone in any run |
| **Bunker Folk** | seal | offline 100%, +16 h; Quiet: +1%/min without a tap, to +120%; taps x0.5 | Lockdown: seal 1-8 h, x2, no taps or skills (12 h) | 1 per 10 min untouched | hatches, periscope, vents | Spare Canteen: offline +15% |
| Tidecallers (4) | send | +1 trip slot, trips -30%, crates also from the sea; lines x0.9 | Signal Flare: three crates (30 min) | trips | piers, nets, boats | Tide Charm: crates +20% |
| Smugglers (6) | deal | the Den's scrap tables; a line at -60% for 2 min every 20 min; scrap x1.5 | Grease Palms: next 5 buys free (1 h) | tables | the Den's skiff, lanterns | Loaded Die: Den limits x2 |
| Glowheads (10) | soak | afterglow never below 25%; Rads +3% each; lines x0.6 for the first hour | Meltdown: x10 for 20 s, then x0.5 for 5 min (2 h) | afterglow | green glow, mutant garden | Lead Lining: afterglow +10 min |
| Wardens (12) | hold | a warband every 30 min online / 4 h offline; walls, traps, turret replace line 3; each held raid +3% this run | Rally: next raid held, pays 30 min of production (1 h) | held raids | walls, spikes, turret | Old Banner: +1 stack |
| Turncoats (8) | mix | two skills and tier-1 upgrades from two creeds whose relics you hold | both | both | patchwork | - |

Acceptance rule (against "factions that feel the same"): a creed changes **what you tap or wait for**,
**the skill bar** and **the scene**, and the simulator finds a different best archetype for it.

### 4.8 Doctrines (challenge launches)

Picked on the launch card for the next run: a fully visible constraint, a goal with a progress bar,
three tiers and a permanent, often **cross-creed** reward. Abandoning costs nothing. Four reuse the
season-modifier ids; 12 at R4, examples:

| Doctrine *(p)* | Constraint | Goal (I) | Reward (I/II/III) |
| --- | --- | --- | --- |
| Bare Hands | no tools | Stone holdfast | taps +25/50/100%, all creeds |
| Long Nights (`long_nights`) | always night, lines x0.5 | 1e12 lifetime | offline +5/10/15% |
| Rich Tides (`rich_tides`) | lines x0.25, crates x4 as often | Sheet Metal | crate effects +20/40/60% |
| Storm Season (`storm_season`) | no skills | 1e15 | cooldowns -5/10/15% |
| Quiet Raiders (`quiet_raiders`) | no taps after minute 5 | Stone | Bunker Folk Quiet cap +20/40/60% (cross-creed) |
| Thirteen | at most 13 of each line | 1e9 | Ash +5/10/13% |
| Speed Wipe | launch within 30 min | +25% Rads | the hatch needs 8/6/5 fuel cells |
| Iron Gut | no afterglow, no Heat | Armored | Tinkers +1 drone (cross-creed) |

### 4.9 The second layer: the Exodus (designed now, shipped later)

After launch 30, when gains stay under x1.25 for three launches, a telegraphed wall appears in words:
"The fallout here is too thick. Time to leave." The player builds the **Ark** (each launch adds a
visible plank) and sails to **Ironreef** *(p)*, with its own tap targets, palette and three different
lines. **Resets** Rads, Ash, unflagged tree nodes, agenda items below 12. **Keeps** relics, logbook,
doctrine marks, crew, cosmetics, ~15 Exodus-ring nodes. **Pays** **Charts** *(p)* = floor(5 x
log10(total Ash ever earned)) for **Tide nodes** that amplify whole districts, plus a fourth keystone
slot and Exodus-only creeds. Each island rescales cost curves so numbers fall back to millions (the
magnitude budget stays under ~1e300). Data reserves `keepOnExodus` and `island` fields now.

---

## 5. The massive tree: the Blast Map *(p)*

### 5.1 Size and structure

420 nodes drawn as a radial map over your crater: **Ground Zero** at the centre, eight rings, wedge
districts. Shipped in waves (100 in R2, ~220 by R4, 420 by R7).

| District *(p)* | Nodes | Theme |
| --- | --- | --- |
| Core | 10 | the gate and the 8 old legacy perk ids |
| Hands | 45 | taps, Heat, tools, crits |
| Lines | 50 | line multipliers, milestones, costs |
| Night Shift | 40 | offline, idle bonuses |
| Skills | 40 | durations, cooldowns, meta-skills, auto-cast |
| Salvage | 40 | scrap, crates, Trade-ins, Stash |
| Crew | 35 | foremen, traits, auto-buy |
| Blast | 40 | Ash yield, afterglow, launch QoL |
| Wayfarers | 35 | expeditions, schematics (R6) |
| Creed halls | 70 | 7 x 10, active only while you play that creed (or its Bloodline) |
| Exodus ring | 15 | locked until the Exodus, kept through it |

### 5.2 Node types and mix

| Type | Share | Example | Rule |
| --- | --- | --- | --- |
| Small stat | ~52% | Twig lines +25% | never three in a row without a notable or unlock |
| Notable | ~20% | every 10th tap crits x10 | a named mechanic, big-feeling numbers |
| Keystone | ~6% (24) | Dead Hand | works only **slotted**: 1-3 slots, re-picked free at each launch |
| Unlock | ~9% | Duct Tape | new verbs and systems; the advisor's favourite |
| Automation / QoL | ~8% | buy-max, auto-raise | |
| Cluster completion | ~5% | the whole Hands wedge: +1 Heat tier | ten small nodes become one goal |

The **loadout** is the Philosophy C core: the tree is a collection that only grows, but keystones
and creed halls are chosen per run, so the same tree plays as an idle build on Monday and a clicker
build on Tuesday.

### 5.3 Costs and respec

Ring costs grow ~x7 so each launch buys 3-8 nodes in the ring being worked: ring 1: 1-3 Ash; 2: 6-15;
3: 40-100; 4: 1k-3k; 5: 10k-25k; 6: 80k-200k; 7: 600k-1.5M; Exodus: 5M+. Notables x2, keystones x3.
Fixed prices, never "each buy raises every price". **Respec:** permanent nodes are never refunded,
except one free full respec after any balance change (a logged decision) and one granted by a
doctrine's tier III (Scorched Start: a run with no tree effects); keystones and creed halls are re-chosen free every launch. Horizon: optimal owns at most 50%
of nodes by count on day 30 and the whole tree not before day 120.

### 5.4 Reading it on a 390 px phone

- A third Pixi view beside the base and the island map, reusing MapView's pan, pinch and tap code
  (D88), a render group, edges drawn once.
- **Two zoom levels:** an overview of wedges with progress rings and an affordable count; tap a
  wedge for a cluster view of at most ~40 nodes on one portrait screen, 44 px targets (D48), labels
  only at that zoom (D46).
- Filter chips (Taps, Idle, Skills, Automation, Creed, Affordable); the advisor's pick pulses.
- **Path buying:** tap a far node, the path lights with its total, one Buy.
- A bottom sheet per node: effect now -> after, cost, what it leads to, one primary Buy or the reason
  ("Need 12 more Ash", "Ring 4 opens after launch 5"); the camera keeps the node above the sheet.
  Locked nodes are always visible (rule 6.3.3).

### 5.5 Example nodes

| Node *(p)* | District, ring | Type | Effect | Ash |
| --- | --- | --- | --- | --- |
| Ground Zero | Core 0 | unlock | opens the map | free |
| Steady Hands (`steady_hands`) | Core 1 | small | all lines +10% | 1 |
| Quick Fingers (`quick_fingers`) | Core 1 | small | taps +1% of supplies/s | 1 |
| Packed Crate (`packed_crate`) | Core 1 | QoL | start runs with 10 Pickers | 2 |
| Deep Cellars (`deep_cellars`) | Core 1 | small | offline window +2 h | 2 |
| Hot Coals (`hot_coals`) | Core 1 | small | Heat decays 50% slower | 3 |
| Old Friend (`old_friend`) | Core 1 | QoL | one foreman slot filled free at run start | 3 |
| War Stories (`war_stories`) | Core 1 | small | crew levels 25% faster | 3 |
| Every Tenth Swing | Hands 3 | notable | every 10th tap crits x10 | 120 |
| Starter Kit | Lines 2 | QoL | start with 25 Woodcutters, 10 Gardens | 12 |
| Cold Storage | Night Shift 3 | notable | offline window +8 h | 140 |
| Second Wind | Skills 2 | unlock | the meta-skill | 15 |
| Standing Orders | Skills 4 | automation | auto-cast one skill on cooldown | 3k |
| Stash | Salvage 4 | QoL | keep 10% (rank 2: 25%) of scrap through the blast | 2k |
| Foreman's Ledger | Crew 4 | automation | every line auto-buys by best payback | 2.5k |
| Mushroom Photo | Blast 3 | joke | photo mode in the cinematic; +1% Ash for storm launches | 77 |
| Auto-launch Rig | Blast 6 | automation | launch at a yield you set (launch 20) | 120k |
| **Dead Hand** | Night Shift 4 | keystone | taps disabled; all lines x4 | 6k |
| **Berserker** | Hands 4 | keystone | Heat never below 50%; lines x0.7 | 6k |
| **Scorched Earth** | Blast 4 | keystone | no starter kits; Ash +40% | 7.5k |
| **Hoarder** | Salvage 5 | keystone | +10% per doubling of held supplies above 1 h of production; Windfall x3 | 60k |
| **Night Owl** | Night Shift 5 | keystone | x2 from 20:00-06:00 your time, x0.75 otherwise | 45k |

---

## 6. Currencies

| Currency | Kept? | Sources | Sinks |
| --- | --- | --- | --- |
| **Supplies** *(p)* | no | lines, taps, Sweep, Windfall, expeditions | lines, tools, raises, structures, creed upgrades, rations |
| **Scrap** | no (Stash 10-25%) | 1% per manual tap, milestones, crates, creed scrap verbs, trips, daily orders | creed gates (25/150/600), Trade-ins (20 x 1.1^n, +10% each), the Den, late tools |
| **Rads** *(p)* | yes, never spent | the launch formula | none: +2% each |
| **Ash** *(p)* | yes | each launch; doctrine tiers; Convoys | Blast Map nodes |
| **Relics** | yes (items, 8) | all 12 creed upgrades in one run | relic slots (1 at launch 5, 2 at 20) |
| **Schematics** *(p)* | yes (items) | expeditions, Wardens raids | cut one unlock node's Ash cost by 75% |
| **Charts** *(p)* | through the Exodus | the Exodus formula | Tide nodes |

**Scrap** stops being a monthly loot drip and becomes the precious coin of a run, the only gate on
creed tiers, scarce enough that "exactly 1,337 scrap" is a secret. It is never the prestige
currency, so it can be gambled at the Smugglers' tables without risking weeks of progress. **Ash and
Rads are never traded, wagered, stolen or sold** (a guardrail). The owner's "blueprint fragments"
idea becomes **Schematics** (Rust's "a found item researches cheaper than the tree", own name),
deliberately a discount rather than a second tree currency.

---

## 7. Systems disposition

| System | Verdict | How / why |
| --- | --- | --- |
| Seasons (monthly wipe) + modifiers | **Remove the wipe** | The launch is the reset; a calendar wipe would fight it. "Month" survives as a board window only. Modifiers become doctrines. `pnpm season end` runs once at R2 to archive season 1 |
| The Signal | **Remove** | Absolute shared goals break across 1e10 gaps; the Island Siren replaces it |
| Legacy perks and points | **Rework** | Into Rads, Ash and the Blast Map; points from your own run; the 25% cap retired; the 8 perk ids become Core nodes |
| PvP | **Remove** | Percent theft across exponential scales is meaningless or brutal; tier fences mean nothing |
| NPC raids, defence | **Rework** | Wardens' warlord nights only: a breach costs the stacking bonus, never stock; repair and UTC night planning go |
| Bandit camps | **Rework** | Wardens' warlord camps and expedition sites; charges become Wardens' ammo |
| Player market | **Remove** | Cross-scale gifting; mostly empty with 2-10 players (D100) |
| Den counter | **Rework** | Smugglers' shop: timed boosts priced in minutes of your production |
| Contracts | **Rework** | Weekly co-op Convoys (section 8) |
| Casino | **Rework** | Smugglers only; scrap only; odds data and RTP checks kept; limits relative to scrap earned this run; jackpot per player |
| Crew | **Rework** | Foremen: 12 survivors and 11 traits run lines; levels persist; tiredness, sleep, injuries, gear go |
| Expeditions, map, keycodes | **Keep, rework** | Same engine (odds fixed at departure, seeded, reports); costs supplies, pays minutes of production, scrap, schematics; reward ~ t^0.8; keycodes gate deeper sites within a run |
| Crafting web, stations | **Remove the web** | 23 resources and 22 recipes cannot survive exponential scales; stations live on as lines. The honest loss is the "chains" pillar; creeds and eras carry variety instead |
| Furnaces | **Rework** | Line 7; furnace types and fuel go |
| Buildings | **Rework** | 10 lines, 4 era structures, 4 to the Wardens; build timers and upkeep go |
| Tools | **Rework** | The tap ladder |
| Node mini-game | **Rework** | Endless tap targets; marker game and daily haul go |
| Barrels | **Rework** | Drift crates |
| Daily tasks | **Keep** | Three Daily Orders paying scrap and logbook progress |
| Weather, day and night | **Keep** | Visual plus small visible rules (storms +25% crates; Night Owl, Long Nights) |
| Leaderboards | **Rework** | Scale-free boards (section 8) |
| Feed | **Keep** | New kinds: launch, relic, doctrine, secret, convoy, Exodus |
| Notifications | **Keep, opt-in** | On by default: expedition back, offline window full; off: friend launched, skill ready, warlord night, convoy |
| Discord bot | **Keep** | Card v2: supplies/s, window fill, creed, hatch yield, skills ready; buttons Sweep and Open. Launching stays on the web, with the cinematic |
| Welcome back | **Keep, central** | Section 2.6 |
| Upkeep, decay, storage caps | **Remove** | They punish absence; the offline window drives check-ins |

---

## 8. The social layer (2-10 friends at very different progress)

Rule: **compare counts, times and ratios, never amounts.** A friend ten launches ahead has a 1e10x
economy, so everything shared is positive-sum or measured in each player's own scale.

1. **Launch news and creed census.** Launches, relics, doctrine tiers, secrets and the Exodus go to the
   feed and Discord with the creed ("Patrik is a Tinker this run"); the friends panel shows who plays what.
2. **Fallout drift.** A friend's launch gives everyone else x1.1 for 30 min (stacks to 3).
3. **Weekly Convoy** (replaces contracts and the Signal). Players ship **hours of their own output**, so
   a beginner and a veteran contribute equally per hour. Goal 6 h x players, three tiers, 7 days, no
   warnings or kicks. Reward: Ash +10% on the next launch and a relic shard.
4. **Island Siren** *(p)*. A counter of every launch anyone made; every 25 unlocks something small for
   all (a cosmetic, +5% crates, a postcard frame). It counts events, so it is scale-free.
5. **Doctrine of the week**, ranked by clear time within Rads brackets (x10 bands).
6. **Scale-free boards** (monthly, nobody reset): launches, relics, logbook, doctrines, fastest run to
   Stone within your bracket, Rads on a log scale.
7. **Postcards.** Once a day, send your launch postcard: the friend gets 10 min of their own
   production, you get 2 scrap.
8. **Catch-up.** Below 25% of the group's median Rads, Ash x1.5, shown openly ("Late arrival x1.5");
   crates pay a little more to players far behind their own stage.

---

## 9. Architecture implications and reuse

- **Numbers.** Doubles for supplies and rates behind one alias (`Qty`), a `Number.isFinite` guard
  before every save (one `Infinity` writes `null` into a base); counts stay integers; "integers in
  state" is narrowed by a decision. The Exodus value shift keeps magnitudes under ~1e300; a
  mantissa/exponent library later is a type change. `abbrev` gains T to Dc, then scientific, plus a
  rate formatter ("0.4/s"), shared with the bot.
- **Effects as data.** One evaluator replaces the fixed `modifiers.ts` struct: `{stat, op: add | inc |
  more | unlock, value, per?, when?}` from lines, structures, nodes, creeds, relics, doctrines and the
  logbook, folded in a fixed order (base, add, inc, more, global), cached by identity, tested for
  bounds and monotonicity rather than combinations.
- **Settling** stays lazy and closed-form: rates piecewise constant, split at buff ends, Lockdown ends
  and the window edge; afterglow is an exact decaying integral; foremen buy in bulk "max affordable"
  steps (hourly offline, at most 48 per settle) with the same policy as the simulator. Property test:
  `settle(settle(s, t1), t2) ~ settle(s, t2)`.
- **Click transport.** A batched `taps {count, from, to}` command each ~1 s (or 30 taps), coalesced in
  the client queue, clamped by a token bucket in state (15/s, burst 30) so prediction and server
  agree. Tap batches keep a slim idempotency record (no state, 1 h TTL), no per-tap `event_log` rows,
  and push a version instead of the state. Predicted taps survive network errors.
- **Drift crates** come from a seeded per-run schedule the client can draw; claims are checked against
  the 13 s window.
- **The meta layer lives in the player's document** (`state.meta`: Rads, Ash, tree, keystones, relics,
  logbook, agenda, crew, doctrine marks, lifetime stats), so tree buys are predicted instantly (D64).
  The **launch is a pure domain command** (`launch {creed, doctrine, keystones}`); the API overwrites
  the same `bases` row so `version` keeps rising, and mirrors lifetime figures into a small row for
  boards. Seasons stay one perpetual row.
- **Ops.** One process, one SQLite writer, no new services on the 2 vCPU VPS; 10 players tapping
  is ~10 small writes per second.

**Reuse estimate** (share of today's code surviving in some form):

| Package | Survives | What |
| --- | --- | --- |
| `domain` | ~25% | clock, rng, command pipeline, events, words, expeditions (R6), casino odds (R7), the reset shape |
| `content` | ~30% | loader, zod patterns, locale, ids; data files rewritten |
| `web` | ~50% | Pixi layers, camera, palette, drawings, effects, MapView (to the Blast Map), modals, prediction store, screenshots |
| `api` | ~75% | auth, commands, SSE, push, backups, admin, bot routes; Den, market, raid, season handlers go |
| `sim` | ~25% | harness, archetype runner, RTP |
| `discord` | ~65% | architecture, renderer, router; new card content |

Overall ~40-45%: infrastructure nearly whole, rules mostly new.

---

## 10. Build plan

Plan mode for every phase (all are architecture or balance); every phase keeps `pnpm check`,
screenshots and `docs/ui-review.md`.

| Phase | Goal | Scope | Sessions |
| --- | --- | --- | --- |
| **R0 Re-baseline** | rules and plumbing first | decisions (retire the wipe, the 25% cap, 1.6x; doubles; remove PvP, market, Signal, crafting web; new guardrails); off-server backups (W9's first item, before any wipe); `Qty` and formatter; effects evaluator; taps transport and queue coalescing; pacing v2 harness (lifetime runs, launch policies); CLAUDE.md and game-design rewrite | 2 |
| **R1 The Run** | a great 90-minute run | state v2; lines 1-9, eras 1-3; tap target, Heat, tools; milestones; scrap, Trade-ins; Rush, Second Shift, Sweep; crates; foremen v1; offline window, welcome back; new HUD (top bar, skill bar, shop drawer, 5 nav actions); demo backend; shots. Owner only; friends keep season 1 | 5 |
| **R2 The Button** | **friends play** | launch command, Rads and Ash, cinematic and postcard, Blast Map v1 (~100 nodes), Drifters + Scrappers + Tinkers + Bunker Folk with relics, keystone slot, agenda, launch news. End season 1, wipe game rows, grant founders a skin and 1 Ash per old legacy point | 4 |
| **R3 Full island** | the whole run | eras 4-5, Flare, Grit, meta-skills, Logbook (~120 entries, 25% secret with hints), tree ~200, automation nodes | 4 |
| **R4 Doctrines** | runs that differ on purpose | 12 doctrines x 3 tiers, agenda to 12, creed-parity and active/idle assertions | 2 |
| **R5 Together** | the friends layer | drift, Siren, Convoys, boards, postcards, catch-up, Discord card v2, notifications; W9 admin panel, exports, error reporting | 3 |
| **R6 Expeditions** | the sea and the map | trips reworked, keycodes, schematics, Tidecallers, Wayfarers | 3 |
| **R7 More creeds** | breadth for month two | Smugglers and the Den tables, Wardens and warlord nights, Glowheads, Turncoats, Bloodline; tree to 420 | 4 |
| **R8 Exodus** | the second layer | the Ark, Charts, Tide nodes, Ironreef, the value shift | 4-5 |

~31-32 sessions; **friends play from R2** (~11 sessions in). If R2 runs long, move Tinkers to R3 and
ship Scrappers and Bunker Folk: the clicker and the idler must exist on day one.

---

## 11. Risks, failure modes and open decisions

**Failure modes of this philosophy, and the guard for each:**

1. **Too many systems** (priority 4). The agenda doubles as the scope fence: a system ships only in
   its phase, and an unpolished one slips a phase rather than shipping rough.
2. **Creeds that feel the same.** The 4.7 acceptance rule plus one screenshot check per creed.
3. **Solved metas and calculators.** The advisor computes the best buy and launch moment; keystone
   slots force choices; doctrines rotate; the simulator asserts no creed's best archetype beats
   another's by more than 25% in Ash per day at days 14 and 30.
4. **Hidden requirements.** Every doctrine and agenda item is written in full; secrets get a one-line
   hint after the first is found ("The gulls are keeping score").
5. **Walls.** Asserted: never more than 2 minutes online without an affordable purchase in runs 1-5,
   a purchase at every casual check-in, the speed-up bands in 4.5.
6. **Number blow-up.** The magnitude budget and Exodus value shift, asserted.
7. **Combinatorics and art load.** One simulated archetype per creed, keystones with explicit
   downsides; creed overlays as separate procedural layers (D41).
8. **Active players racing ahead.** The 10% agenda rule, catch-up, Rads brackets, the 3x active cap.

**New guardrails** (replacing CLAUDE.md section 8, each a decision): an active hour is at most 3x an
idle hour of the same build; a pure idle build reaches each agenda item within 2x the active
player's days; no veteran cap but visible catch-up; randomness always visible; Ash and Rads never at
risk; nothing lost while away but hours past the window; skill cooldowns and taps in real time.

**Open decisions for the owner:**

1. Names: Supplies, Rads, Ash, the Blast Map, Big Sunny, the creeds, Ironreef, Charts.
2. Confirm removals: the monthly wipe, PvP, the market, the Signal and the **crafting web** (the
   biggest content loss; keeping it makes this a much heavier plan).
3. Creeds at R2: four (recommended) or two for an earlier launch.
4. Run 1 as Drifters, the teaching run (recommended), or a creed from the start.
5. Rads at +2% each (recommended) or +1% with a stronger tree.
6. Base offline: 50% for 8 h (recommended) or more generous.
7. Casino only with the Smugglers (recommended) or not at all.
8. Season 1: run it until R2, then end it with a founders' grant (recommended), or wipe now.
9. Exodus timing: week 6-8 for the most active friend, or later.

---

## 12. Icons: keep drawing, stop, new

File icons by kind (`resource/`, `tier/`, `line/`...) so colliding ids (`stone`, `furnace`, `ore`,
`sulfur`) never clash.

**Keep drawing now (used from R1-R2):**

| Ids | New role |
| --- | --- |
| `scrap` | the rare coin |
| `crate` (the art) | reused as **Supplies** (`supplies`) |
| `tier_twig`, `tier_wood`, `tier_stone`, `tier_metal`, `tier_hqm` | the five eras |
| `rock`, `stone_tools`, `iron_tools`, `salvaged_tools`, `power_tools` | the tap ladder |
| `garden`, `loom`, `workbench`, `furnace`, `kiln`, `tannery`, `press`, `generator`, `dock`, `radio_mast` | lines |
| `campfire`, `warehouse`, `bunkhouse`, `lights` | era structures |
| node kinds `tree`, `stone`, `ore`, `sulfur` | tap targets of eras 1-4 |
| the 8 `perk_*` ids | Core nodes |
| skins `driftwood`, `rust`, `beacon` | cosmetics |
| `long_nights`, `rich_tides`, `storm_season`, `quiet_raiders` | doctrine icons |
| crew portraits (12), traits (11) | foremen (lower priority than the rows above) |

**Park (later phases; keep any already drawn):** sites (12), regions (13), keycodes (3), trip events
(3) for R6; `watchtower`, `walls`, `traps`, `turret`, the three bandit camps, `gunpowder`, `charge`
for the Wardens (R7); casino segments and slot symbols for the Smugglers (R7); `timber`, `stone`,
`ore`, `sulfur`, `fuel` as resources (possible era emblems or Exodus island materials).

**Stop:** the other resources (`ingots`, `sulfur_ore`, `fibre`, `hide`, `fat`, `food`, `planks`, `rope`,
`cloth`, `leather`, `charcoal`, `plates`, `frames`, `gears`, `springs`); furnace types (3); items
`large_crate`, `strongbox`, `bandage`, `first_aid_kit`, `bow`, `spear`, `crossbow`, `leather_vest`,
`roast`, `stew`, `feast`; Signal stages (4); contracts (12); Den stock lots (13); the old dock letters.

**New, in order of need:**

1. R1: `supplies`, `heat`, `drift_crate`, `trade_in`, `foreman`; lines `pickers`, `woodcutters`,
   `stone_pit`; skills `rush`, `second_shift`, `sweep`; nav `island`, `blast_map`, `logbook`, `crew`,
   `friends`; the `container` tap target.
2. R2: `rads`, `ash`, `launch_hatch`; creeds `drifters`, `scrappers`, `tinkers`, `bunker_folk`; skills
   `rampage`, `overclock`, `lockdown`; relics `lucky_crowbar`, `pocket_drone`, `spare_canteen`; 10
   district emblems; node frames (small, notable, keystone, unlock, automation); `drone`.
3. R3-R5: lines `sulfur_works`, `reactor`; skills `flare`, `grit`, `second_wind`, `duct_tape`; 8 more
   doctrines; `schematic`, `convoy`, `island_siren`, `postcard`.
4. R6-R8: creeds `tidecallers`, `smugglers`, `glowheads`, `wardens`, `turncoats` with their skills and
   relics; `ark`, `charts`.

The "keep now" table is safe for today's drawing session: those ids exist in every version of this plan.
