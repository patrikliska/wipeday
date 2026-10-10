# Incremental-game design patterns for the Wipe Day redesign

Researcher: ref-patterns. Scope: cross-cutting patterns (prestige math, huge trees, click to
automation, big numbers, offline and server authority, friends multiplayer, the nuke framing,
Rust as theme). Facts carry a source at the end; anything from memory or unverified is marked
*(unverified)*.

## 0. Why the current design fights the genre

Wipe Day today is a check-in game with integers in state, a monthly forced wipe, a legacy cap
("a veteran is never more than 25% stronger"), and "8 check-ins is at most 1.6x faster than 3"
(CLAUDE.md section 8, game-design section 2). Every incremental reference below does the
opposite on purpose: the veteran is 1e10x stronger, the player chooses when to reset, numbers
explode, and active play is visibly better than idle play for a while. The redesign has to
replace those guardrails, not bolt prestige onto them. Four collisions to resolve:

1. Monthly wipe vs player-chosen prestige (two resets competing for the same emotion).
2. The 25% legacy cap vs a prestige multiplier that should compound without limit.
3. Integers in SQLite vs numbers past 9e15 (`Number.MAX_SAFE_INTEGER` is 2^53 - 1).
4. A player-to-player market and PvP raids vs economies that drift apart by orders of
   magnitude between friends.

## 1. Prestige math

### 1.1 The engine that makes prestige necessary

Pecorella (Kongregate, AdVenture Capitalist producer) gives the canonical model:

- Cost of the next generator: `cost_next = base * r^owned`, with `r` typically 1.07 to 1.15
  (AdCap lemonade stand: base 4, r 1.07, 1.67/s).
- Production: `production = base_prod * owned * multipliers`, i.e. polynomial.
- Bulk cost of n: `b * r^k * (r^n - 1) / (r - 1)`; max affordable:
  `floor(log_r(c * (r - 1) / (b * r^k) + 1))` (k owned, c cash). These two give "buy x10 / max"
  buttons in constant time and are also what an offline settler needs.
- Exponential cost always beats polynomial production eventually, so every run hits a wall;
  prestige is the release valve. Ownership milestones (x2 at 25, 50, 100 owned) create local
  "one more" spikes inside a run.
- Derivative chains (generators that produce generators, Antimatter Dimensions, Derivative
  Clicker) give `t^n / n!` growth that approaches `e^t` as tiers are added, so exponential
  costs still balance; low tiers stay relevant through per-purchase bonuses (Derivative
  Clicker: each bought unit +0.05% to its tier).

### 1.2 Prestige currency formulas (verified, Pecorella part III unless noted)

| Game | Based on | Formula | To double the currency you need |
| --- | --- | --- | --- |
| AdVenture Capitalist | lifetime earnings | `150 * sqrt(L / 1e15)` | ~4x lifetime |
| Cookie Clicker | lifetime cookies | `cbrt(L / 1e12)` (prestige level; chips = new levels) | ~8x lifetime |
| Realm Grinder | max currency in a run | `(sqrt(1 + 8 * M / 1e12) - 1) / 2` | ~4x |
| Egg, Inc. | this run's earnings | `(R / 1e6)^0.14` (wiki says `^0.15` times a bonus) | ~128x |
| Clicker Heroes | upgrades bought | souls per ~2000 hero levels (log-like) | n/a |
| Clicker Heroes, layer 2 | souls sacrificed | ancient souls `floor(5 * log10(HS))` | +5 per 10x |
| Antimatter Dim., layer 2 | best IP this eternity | EP `= 5^(log10(IP) / 308 - 0.7)` | x5 per 1e308x |

What a point is worth: AdCap angel +2% profit each; Cookie Clicker prestige level +1% CpS each
(additive) and spending chips does not reduce the level; Egg, Inc. soul egg +10% each, and
prophecy eggs (earned from co-op contracts) multiply the soul-egg bonus by 1.05 each.

Design reading:

- **Lifetime-based with delta** (Cookie Clicker: gain = f(lifetime) - what you already have)
  cannot be farmed by resetting early again and again. **Run-based** (Egg, Inc.) can, which is
  why Egg, Inc. uses a tiny exponent. For Wipe Day, lifetime or best-run based is the safer
  choice.
- **sqrt vs cbrt vs log**: sqrt is generous and fast-feeling (good early); cbrt and log make
  each layer's growth slow down hard, which is what you want before a second layer opens.
- **Dual use without tension**: Cookie Clicker's split (a permanent level that gives a passive
  bonus, plus spendable chips) avoids the "spend or hoard" dilemma Clicker Heroes created by
  making unspent souls give DPS. For a casual friends game, copy Cookie Clicker.

### 1.3 How big each prestige should be

Pecorella's GDC talk (2016): players typically reset at **+50% to +200% of their prestige
currency**, and the formula (sqrt, fractional exponent, log) should be tuned so "players reach
a valuable prestige point regularly". Post-reset, "will their progress through the early part
be quick? This is an important feeling of growth of power." Community consensus
(r/incremental_games, dev write-ups): the next run must feel faster within the first 30
seconds, or the prestige has failed.

Worked target (illustrative, not data): fallout `F = sqrt(L / 1e6)`, each point +5% passive.
Runs ending at L = 1e8, 4e8, 1.6e9, 6.4e9 give F = 10, 20, 40, 80 and a passive multiplier of
1.5, 2, 3, 5: a 1.3x to 1.7x step per run from the passive alone. Tree purchases supply the
rest so the **combined** multiplier lands at **1.5x to 3x per nuke early, 1.2x to 1.5x late**.
When the ratio drops toward 1.2x, that is the signal to open new tree rings or the second
layer, not to make runs longer.

### 1.4 The optimal-prestige-time problem

Let `G(t)` be the currency a reset at time `t` into the run would give, and `t0` the overhead
of restarting. The long-run rate `G(t) / (t + t0)` peaks where `G'(t) = G(t) / (t + t0)`: reset
when the current gain per minute falls below the average gain per minute of the run. With a
sqrt formula and production that slows at a wall, the optimum sits just after the wall.

Making it legible without spreadsheets (proven UI): Antimatter Dimensions shows on the reset
button the gain, the current rate per minute and the **peak** rate this run *(from memory of the
game, unverified wording)*. For Wipe Day the red button should show "+43 fallout now",
"12/h now, peaked 15/h" and the advisor should promote it to the one primary action once the
rate has fallen below, say, 80% of the peak. Make the wall explicit (see Rust upkeep in
section 8) so "this is a good time to nuke" is visible in the scene, not only in a number.

### 1.5 Run-length targets

- Browser incrementals: first prestige in 5 to 20 minutes (dev reports: 25 to 35 min felt too
  long; some make the first prestige guided or forced so the player learns what it gives).
- Mobile idle (AdCap, Egg, Inc.): first reset in hours to a day *(typical, unverified)*.
- Proposal for a check-in friends game: the red button is **visible but locked from minute ~10**
  (a goal, with its reason shown), first nuke after **~60 to 90 minutes of active play or by the
  end of day 1 for a casual player**, runs 2 to 5 in 30 minutes to 4 hours each, a mid-game
  rhythm of roughly **one nuke per day** (a daily ritual that fits 3 check-ins), with optional
  faster "speed nukes" for active players. Second layer after 3 to 6 weeks.

### 1.6 Layered prestige

- **Antimatter Dimensions**: Infinity (at 1.79e308 antimatter, Infinity Points) -> Eternity (at
  1.8e308 IP, EP) -> Reality (e4000 EP plus the last time study; gives glyphs and an
  automator). Each layer is unlocked when the layer below runs out of room.
- **Eternity milestones** are the key pattern: the *count* of eternities unlocks automation of
  the lower layer: 1 eternity an IP autobuyer, 2 start with all normal challenges and
  autobuyers, 4 keep infinity upgrades, 6 offline EP generation, 11 to 18 infinity dimension
  autobuyers, 100 the eternity autobuyer itself. The second layer's job is to make the first
  layer's repetition disappear.
- **Clicker Heroes**: ascension (hero souls) -> transcendence (ancient souls
  `floor(5 * log10(souls sacrificed))`, spent on Outsiders; keeps rubies, relics, achievements).
- **Realm Grinder**: abdication (gems; each gem a few % production, sources say 3%) ->
  reincarnation (gem thresholds rising, unlocks factions and research) -> ascension
  *(thresholds unverified)*. Per-run faction choice makes runs feel different.
- **AdVenture Capitalist** adds parallel worlds (Moon, Mars) with their own prestige rather than a
  layer above *(unverified details)*: a "new island" variant.

Principles: the higher currency is a log or small power of the lower; each layer resets the one
below and then automates it; layer N+1 opens only when layer N's per-run gain ratio has
flattened. Ship one layer for Wipe Day, design the hook for a second.

## 2. Massive passive and skill trees

### 2.1 References

| Tree | Size and currency | Notable mechanics |
| --- | --- | --- |
| Path of Exile | ~1,300 nodes *(approx., version-dependent)*; ~123 points (99 levels, 23 quests, 1 bandit) | small, notable, keystone (rule-bending), 21 jewel sockets; click a far node to allocate the path; refund points |
| Grim Dawn devotion | 55 points; ~80 constellations *(count unverified)* | constellations need affinity from others; completing one grants a celestial power |
| Antimatter Dimensions time studies | studies cost 1 to 900 time theorems | mutually exclusive splits: dimension (3 ways) and pace (active / passive / idle); light / dark pairs; full refund respec on the next eternity |
| Cookie Clicker heavenly upgrades | 100+ *(count unverified)*; costs 1 chip to ~1.9e16 chips | a dependency tree from "Legacy"; five permanent upgrade slots carry a normal upgrade across ascensions |
| Melvor Idle | mastery 1 to 99 per item; pool checkpoints at 10/25/50/95%; skill trees per skill since the Into the Abyss expansion | checkpoints are active only while the pool stays above the threshold |
| Nodebuster (2024), Rock Crusher, Gnorp Apologue | one big tree, short timed sessions | praised: constant meaningful power; criticized: "overwhelming" tree UI, stat-maxing without build variety, late AFK grind |

Nodebuster's genre (a short active session, then spend in a big tree, repeat) is the closest
existing match to what the owner describes, including its failure mode: a big tree of plain
stat nodes gets boring and the UI overwhelms.

### 2.2 Node taxonomy (aim for this mix in a 300 to 500 node tree)

1. **Small stat** (~55%): +x% to one rate. Cheap, connective tissue.
2. **Notable** (~20%): a named effect with a mechanic, e.g. "furnaces also produce charcoal",
   "every 10th tap is a critical".
3. **Keystone** (~5%, 10 to 20 in total): rule-changing with a cost. "Doomsday prepper:
   offline production x3, taps x0.5", "Scorched earth: +1 fallout per nuke per building
   destroyed, start with nothing". Mutually exclusive splits like AD's 3-way choices.
4. **Unlock** (~10%): a new building, resource chain, site, event or mechanic. These are the
   "wow" nodes; they should be the ones the advisor points at.
5. **Automation and QoL** (~10%): auto-collect, auto-buy a building type, buy-max, keep X after
   a nuke, start with Timber, auto-nuke at gain >= X.
6. **Cluster completion** bonuses (Grim Dawn constellations, Melvor checkpoints): buying all
   nodes of a cluster grants an extra effect, which turns 10 dull nodes into one goal.
7. **Conditional and synergy** nodes: "+1% per crew member", "+5% per nuke this week",
   "x2 while it rains". They make the scene and other systems matter.

### 2.3 Costs and respec

- Cost by **distance from the start** (rings) is readable: ring 1 costs 1, each ring x3 to x5.
  Because fallout grows roughly geometrically across runs, geometric ring costs keep "nodes
  bought per nuke" roughly constant (3 to 8 per nuke is a good feel).
- Alternative: each purchase raises all costs by a small factor. Harder to read; avoid.
- Respec: AD refunds the whole study tree at the next reset; PoE uses scarce refund points.
  Recommended hybrid: the **permanent tree** (Cookie Clicker style, never refunded) plus a small
  **loadout** of keystones re-chosen free at every nuke. Experimenting stays cheap, permanence
  stays meaningful. Offer a free full respec once after any balance change.
- Presets and shareable build strings (AD has import/export of study trees *(unverified
  detail)*) are a cheap social feature among friends.

### 2.4 Readable on a phone (390 px)

- **Two zoom levels, not a free canvas**: an overview of 8 to 12 clusters (districts of the
  wasteland, each 25 to 50 nodes) and a cluster view that fits one portrait screen with at most
  ~35 nodes. Pinch-zoom optional, never required.
- Nodes at least 44 CSS px on screen in the cluster view (the existing D48 rule); labels only at
  the zoom where they are legible (semantic zoom); icons from the one-icon-per-thing set.
- **Path allocation** like PoE: tap a far node, see the path and the total cost, confirm once.
- **Search and filters** ("taps", "furnace", "automation") and a "what can I afford now" glow.
- Tap a node opens a bottom sheet: effect, cost, what it unlocks next, one primary Buy.
- The advisor's pick is the one glowing node; the overview shows a progress ring per cluster.
- Locked nodes stay visible with the reason ("needs 3 nodes in Salvage", "ring 4 opens after 5
  nukes"), matching the zero-tutorial rules.

### 2.5 Avoiding "every node is +2%"

Rules of thumb: no more than three small nodes in a row before a notable or unlock; small
nodes in a cluster all serve the cluster's theme; numbers in multiples that feel big (x2,
+25%) at notables; at least one node per cluster that changes what you see in the scene (a new
building, a new animation); keystones that create playstyles (clicker, idler, tinkerer,
gambler) so friends on different schedules all have a "best build".

## 3. From clicking to automation

### 3.1 How the references open

- **Cookie Clicker**: one big cookie; the first Cursor (an auto-clicker) is affordable in
  seconds; Grandma soon after; clicking stays relevant through mouse upgrades that add a
  percentage of CpS to each click (+1% each, *from the wiki, wording unverified*), "Thousand
  fingers" (+0.1 per non-cursor building), and golden cookies.
- **Universal Paperclips**: one "Make Paperclip" button and a price; auto-clippers within a
  couple of minutes; the UI grows panels as the business grows; three stages (business, Earth,
  space) each replace the interface *(from memory)*.
- **A Dark Room**: "light fire", "stoke fire"; the stranger becomes a builder; gather wood,
  traps, huts, villagers; jobs automate what you clicked. Mechanics reveal one at a time.
- **Kittens Game**: click catnip; fields automate it; huts bring kittens; jobs automate wood and
  more *(from memory)*.
- **Trimps**: manual food, wood, metal; traps for Trimps; jobs replace your clicks. Players
  famously wrote an automation script (AutoTrimps), a warning sign: if players script it, the
  game should have shipped the automation *(community knowledge, unverified)*.
- **Egg, Inc.**: tap the hatch button to release chickens; a running-chicken bonus rewards
  continuous tapping; "hold to hatch" (an epic research) automates it; drones fly by to tap for
  cash or golden eggs.
- **Idle Slayer**: an auto-running character; jumping and timing add bonus; random bonus stages
  and boxes reward attention *(from memory)*.

### 3.2 A template for Wipe Day's first ten minutes after any nuke

| Time | Beat |
| --- | --- |
| 0:00 | a crater, a crate, one glowing tap target: "Scavenge" (+1 scrap, floating delta) |
| 0:20 | first buy: a scavenger who taps once a second for you (automation 1) |
| 1:00 | a second resource (timber), a second generator; buy x1 / x10 / max appears |
| 2:00 | the first tap upgrade ("taps give 1% of your per-second income") |
| 3:00 | the first random flotsam floats in (a golden event, tap within ~13 s) |
| 5:00 | the first chain (timber -> charcoal) with a furnace that feeds itself |
| 8:00 | the first milestone (x2 at 25 owned), the first expedition or tree hint |
| 10:00 | the red button appears in the scene, locked, with its progress bar |

After the first nuke, tree nodes and nuke-count milestones compress this to 1 to 3 minutes
(start with N scavengers, keep the furnace), exactly the "visibly faster in 30 seconds" rule.

### 3.3 Keeping taps relevant all game

- **Taps scale with production**: tap value = base + p% of per-second income (Cookie Clicker
  mice). Without this, clicking dies by minute 20.
- **Active abilities with cooldowns** (Clicker Heroes, verified): Clickstorm 10 clicks/s for 30 s
  on a 10 min cooldown, Powersurge +100% DPS 30 s / 10 min, Lucky Strikes 30 min, Metal Detector
  +100% gold 30 s / 30 min, Golden Clicks 1 h, Dark Ritual x1.05 DPS for the run, stacking to 20,
  on 8 h. Pecorella: cooldowns of 5 minutes to several hours "increase player agency, letting
  them burst income or get over a hump".
- **Golden events** (Cookie Clicker, verified): spawn every 5 to 15 min (~446 s average), stay 13
  s; Frenzy x7 CpS for 77 s (~40%), Lucky = min(15% of bank, 15 min of CpS) (~40%), Click Frenzy
  x777 per click for 13 s (~3%), building special, cookie chain. Upgrades double spawn rate and
  duration.
- **Combos and heat**: a tap streak that builds a multiplier and decays when you stop (Egg,
  Inc.'s running chicken bonus is the reference).
- **Playstyle keystones** (Clicker Heroes idle vs active ancients, Realm Grinder factions, AD's
  active/passive/idle split): the clicker build and the idler build both exist.
- Cap the ratio: in the mid game an hour of frantic tapping should be worth roughly 2x to 3x an
  idle hour, not 50x, or idle friends fall hopelessly behind.

### 3.4 Automation by milestone

Copy AD's eternity milestones: the **count of nukes** unlocks automation and quality of life,
independent of the tree. Example ladder: 1 nuke auto-collect, 2 start with the furnace, 3 keep
the crew, 5 autobuy the first generator, 10 keep tier-1 blueprints, 15 start at Timber, 25
auto-nuke option, 50 offline fallout trickle. This is what makes the 30th run pleasant.

## 4. Big numbers

- **break_infinity.js 2.2.0** (npm, last published 2023-02): mantissa plus exponent, range up to
  1e9e15; versus decimal.js 2.5 to 2.9x faster add and multiply, ~121x faster log, ~400x faster
  pow; Antimatter Dimensions' script time dropped 4.5x when it switched.
- **break_eternity.js 2.1.3** (npm, updated 2025-12): sign, layer, mag; up to 10^^1e308; within
  0.5x to 2x the speed of break_infinity; a drop-in replacement. Only needed for tetration-scale
  games.
- **Plain doubles** reach 1.79e308; Cookie Clicker runs on native numbers *(from memory)*.
  Integers are exact up to 9.007e15; above that the relative error (~1e-16) is invisible in an
  idle game. SQLite `REAL` is an 8-byte IEEE double, so it round-trips a JS number exactly.
- **Server storage options**: (a) `REAL` columns (simplest; leaderboards sort natively);
  (b) mantissa `REAL` + exponent `INTEGER` (break_infinity's own split); (c) `TEXT` "1.2345e456"
  plus a `log10 REAL` column for sorting and leaderboards. Keep counts that stay small (buildings
  owned, crew, tree nodes, nukes) as `INTEGER`.
- **Determinism caveat**: ECMAScript leaves `Math.pow`, `Math.exp` and `Math.log`
  implementation-approximated, so the browser's prediction and the server's settlement can
  differ in the last bits. With the server as the only authority and the client reconciling to
  its snapshots, this is harmless; it does mean no client-computed totals are ever trusted.
- **Notation**: the existing formatter (12.4k, 1.2M) extends to the short scale K, M, B, T, Qa,
  Qi, Sx, Sp, Oc, No, Dc (1e33), then either letter notation (aa, ab, ...) or scientific
  (1.23e36), with a setting. Three significant digits everywhere, the same function in Discord.
  `swarm-numberformat` 0.4.0 exists but is unmaintained since 2022; a 40-line formatter is
  simpler.
- **Recommendation**: plan a magnitude budget (for example run 1 ends near 1e6, each run adds
  3 to 8 orders of magnitude, the second layer brings it back down). If the budget stays under
  ~1e300, use plain doubles and skip the library entirely.

## 5. Offline progress, server authority

- The existing architecture (store timestamps and rates, settle lazily) is already the right
  shape for an incremental game.
- **Closed form per segment**: with constant rates, `amount += rate * dt`. With a derivative
  chain, `amount(t) = sum g_k t^k / k!`. A decaying bonus (for example post-nuke radiation with
  half-life T) integrates exactly: `r * (t + B0 * T / ln 2 * (1 - 2^(-t/T)))`.
- **Autobuyers break the closed form**: use event stepping. Compute the earliest time any
  autobuyer can afford its next purchase (`(cost - amount) / rate`), jump there, buy (bulk with
  the max-affordable formula), recompute rates, repeat. Exponential costs keep the number of
  steps logarithmic in income; cap steps (say 10k) and finish the remainder in bulk.
- **Test it** with a property test: event-stepped settlement equals a one-second tick
  simulation within a relative 1e-9 over random states and gaps.
- **Offline caps**: Pecorella on Egg, Inc.'s 2-hour offline cap: "a mistake, I churned out myself
  largely because of this." Use a generous cap (24 to 48 h) or the existing storage caps, not
  both, and show a welcome-back summary with one collect.
- **Click plausibility among friends**: the client reports taps in batches ("n taps between
  t0 and t1"), the server credits `min(n, cap * (t1 - t0))` with a cap around 15 to 20 per second
  (humans sustain roughly 6 to 15 *(approximate)*; autoclickers do 100+); tap value is computed
  from server state; golden events are spawned server-side from the seeded RNG and must be
  claimed inside their window; idempotency keys (already built) stop replays. Server-side
  progress is immune to client speed hacks.

## 6. Multiplayer for 2 to 10 friends

- **Co-op contracts (Egg, Inc.)**: a timed goal; every member's output pools; joining adopts the
  group's remaining time; grades (C to AAA) set by each player's earnings bonus so mixed-level
  groups work; boost tokens are earned and gifted to teammates; rewards include prophecy eggs,
  a permanent multiplier. Lesson: the social layer should feed the prestige multiplier.
- **Clan bosses (Clicker Heroes Immortals, verified from the official blog)**: one shared boss
  per day; everyone contributes damage over the day; rewards by share; a daily class weakness
  (+25%). Simple, asynchronous, perfect for friends in different time zones.
- **Shared world events**: a timed event visible to everyone (Rust's cargo ship analogue, see
  section 8) where contributions are cooperative, never contested.
- **Leaderboards in relative units**: fastest nuke, biggest nuke ratio, most nukes this week,
  tree nodes owned, events joined. Weekly boards keep a newcomer in the race.
- **Gifting**: one capped gift a day where the giver also gains a little (positive sum).
- **Nuke news**: a feed and Discord post when someone nukes, plus "fallout drift": a small
  temporary bonus to everyone else. Turns one player's reset into a group moment.
- **What breaks**: anything that compares absolute amounts across players. A friend 10 runs
  ahead has 1e10x the economy, so a raw-resource market, percentage raids and shared absolute
  goals stop working. Trade only non-inflating goods (blueprint fragments, rare items,
  cosmetics), and scale co-op goals per participant (Egg, Inc. grades).

## 7. Staging the weird red button

References: Universal Paperclips makes stage changes dramatic by swapping the whole interface
("release the hypnodrones" ends stage one *(from memory)*); Cookie Clicker ascension leaves the
bakery for a separate heavenly screen and comes back to a fresh start; Antimatter Dimensions'
"Big Crunch" frames the reset as the universe collapsing; Fallout's atomic-age gallows humour is
the tone target (own mascot and names, no imitation).

Proposed sequence:

1. **Foreshadow**: from minute ~10 a sealed hatch in the scene with a taped "DO NOT" sign and a
   progress bar ("launch fuel 34%"). Disabled with its reason, never hidden.
2. **Escalate**: when a nuke would pay, the button twitches, the hatch steams, a crew member
   glances at it. Live readout: gain now, rate now vs peak.
3. **Commit in two physical steps**: tap to flip the glass cover (shows what you keep, lose and
   gain as one card, rule 6.3.4), then **hold to launch** for 2 to 3 s with a rising tone.
   Cancel is always there. A joke line from the crew ("I just fixed the roof").
4. **Countdown and cinematic** (5 to 8 s, skippable after the first time): crew run to the boat,
   10..1, missile arcs, white flash, mushroom cloud, screen shake (respect reduced motion).
5. **Afterglow**: the new run starts on a glowing crater with a green-tinted sky that clears as
   you rebuild. The crater's **radiation** decays with a half-life (say 20 to 30 minutes) and
   multiplies taps or yields a harvestable glowing resource, which is the "click like crazy"
   rush the owner wants, and it settles in closed form.
6. **Tell everyone**: feed and Discord ("[name] nuked their island for the 4th time this week:
   +43 fallout"), fallout drift to friends.
7. **First nuke is guided**: the advisor makes it the one primary action and the first tree
   purchase follows immediately, so the reward lands in the same minute.

## 8. Rust as theme: mechanics only (own names required)

Verified facts: monthly forced wipe on the first Thursday; a map wipe keeps learned blueprints,
blueprint wipes are rarer and announced; workbench levels cost 50 / 500 / 1,250 scrap; the tech
tree inside each workbench adds a 0 / 10 / 20% tax over researching a found item; researching a
found item costs 20 to 500 scrap by tier; upkeep grows with base size from about 10% to about 33%
of build cost per day; a hackable crate takes 15 minutes; the cargo-ship event spawns every 2 to
4 hours and stays about 50 minutes.

| Rust mechanic | Idle mechanic for Wipe Day |
| --- | --- |
| map wipe, blueprints kept | the nuke: the island resets, permanent unlocks stay |
| rare blueprint wipe | a second prestige layer, weeks apart |
| scrap as research currency | scrap becomes rarer and buys permanent recipe unlocks |
| research a found item vs tech-tree tax | found items unlock cheaply; buying blind through the tree costs more, so exploring pays |
| workbench tiers gate the tree | base tiers open tree rings |
| recycler: junk into components and scrap | a salvage building that turns overflow into components, so caps never waste |
| upkeep brackets rising with base size | a soft wall late in each run that makes the nuke attractive and visible |
| keycard puzzles at monuments | site access tokens (already in the game) |
| airdrops called by a crafted signal | a golden event the player can trigger with a crafted item |
| a ship that visits for ~50 min, timed crate | a shared world event every few hours, co-op not contested |
| patrol aircraft, armoured patrol | boss events that test the defence investment |
| radiation zones and protection | post-nuke radiation as a decaying bonus; deep sites need protection |
| industrial conveyors, electricity | automation nodes: hoppers, conveyors, power |
| wipe-day rush | the first minutes of every run: frantic, rewarding tapping |

## 9. Seasons and other systems

- **Monthly wipe**: remove it as a progress reset. The nuke is the reset; a second reset fighting
  it confuses. Keep the word "season" for leaderboard periods, rotating modifiers and cosmetic
  rewards. Turn the old season modifiers into **optional challenge runs** (AD and Realm Grinder
  challenges): a restricted nuke ("no taps", "Twig only") that grants a keystone.
- **Legacy 25% cap**: drop it. Replace fairness with catch-up: a newcomer gains extra fallout
  until they reach the group median, and co-op goals scale per player.
- **PvP raids and the player market**: keep only in relative terms or retire. The casino can stay
  if bets are a percentage of income or use a non-inflating currency.

## 10. Lessons for Wipe Day

1. Replace the three guardrails that contradict the genre (25% legacy cap, 1.6x active cap,
   monthly wipe) with explicit new ones before any balance work, and log them as decisions.
2. Prestige currency on lifetime or best-run value with a delta (Cookie Clicker style), sqrt
   early; a log-based second layer later. Never reward run-earnings alone.
3. Target a combined 1.5x to 3x speed-up per nuke early and 1.2x to 1.5x late; when the ratio
   flattens, open content or a layer instead of lengthening runs. Assert it in the simulator.
4. Show nuke gain, current rate and peak rate on the button; the advisor promotes the nuke when
   the rate falls below ~80% of peak.
5. First nuke: locked-but-visible from minute ~10, available after ~60 to 90 min active or day 1
   casual, and guided so the first tree purchase lands in the same minute.
6. Split the reward: a permanent prestige level (passive bonus) plus a spendable currency, so
   nobody agonises over spending.
7. Build the tree at 300 to 500 nodes in 8 to 12 themed clusters, with the mix in 2.2: small,
   notable, keystone, unlock, automation, cluster completion, synergy.
8. Ring-based geometric costs so each nuke buys 3 to 8 nodes; permanent tree plus a free
   per-nuke keystone loadout; a free respec after balance changes.
9. On the phone: overview of clusters, then one-screen cluster views; 44 px nodes, path
   allocation, search, an affordable glow, bottom-sheet details, the one glowing advisor pick.
10. Unlock automation by nuke count (AD eternity milestones) so repeated early runs shrink from
    ten minutes to one.
11. Keep taps relevant: tap value as a percentage of income, cooldown abilities (10 min to 8 h),
    flotsam golden events every 5 to 15 min, a tap-streak multiplier, playstyle keystones.
12. Cap active over idle at about 2x to 3x per hour mid-game so friends on different schedules
    stay in one race.
13. Use plain doubles stored as `REAL` with a magnitude budget under ~1e300; reach for
    break_infinity.js 2.2.0 only if the design needs more. Keep small counts as `INTEGER`.
14. Extend the one number formatter to short-scale suffixes through Dc, then scientific, with a
    setting; same function on the web and in Discord.
15. Settle offline with closed-form segments and event stepping for autobuyers, property-tested
    against a tick simulation; generous offline window, one welcome-back collect.
16. Credit taps in server-checked batches with a per-second cap; spawn golden events
    server-side from the seeded RNG; trust no client totals.
17. Make the nuke a show: foreshadowed hatch, two-step commit with hold-to-launch, a skippable
    cinematic, a radioactive afterglow that decays and powers the post-nuke tapping rush.
18. Make nukes social: feed and Discord posts, fallout drift to friends, weekly relative
    leaderboards (fastest nuke, most nukes, biggest ratio).
19. Make co-op the social core: Egg, Inc. style timed contracts with per-player scaled goals and
    a daily shared boss; rewards feed the permanent multiplier. Drop or relativise absolute-
    amount PvP and markets.
20. Take Rust's structure, not its names: wipe keeps blueprints, scrap buys permanent recipes
    (rarer), found items research cheaper than blind tree buys, recycler for overflow, upkeep
    as the visible late-run wall, a visiting-ship world event, radiation after the blast.

## Sources

- Pecorella, The Math of Idle Games part I: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- Part II: https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii
- Part III: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- Pecorella, Quest for Progress (GDC Europe 2016): https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507
- Cookie Clicker prestige: https://cookieclicker.wiki.gg/wiki/Prestige
- Cookie Clicker golden cookie: https://cookieclicker.wiki.gg/wiki/Golden_Cookie
- Antimatter Dimensions Eternity: https://antimatterdimensions.wiki.gg/wiki/Eternity
- AD Eternity milestones: https://antimatterdimensions.wiki.gg/wiki/Eternity_Milestones
- AD Time Studies: https://antimatterdimensions.wiki.gg/wiki/Time_Studies
- AD Reality: https://antimatterdimensions.wiki.gg/wiki/Reality
- Clicker Heroes ancient souls: https://blog.clickerheroes.com/ancient-souls-per-transcension-how-to-maximize-your-gain/
- Clicker Heroes clan raids: https://blog.clickerheroes.com/clicker-heroes-clan-raid-what-you-need-to-know/
- Clicker Heroes skills (walkthrough): https://www.arrpeegeez.com/2014/10/clicker-heroes-walkthrough.html
- Realm Grinder guide: https://www.pcgamer.com/realm-grinder-guide/
- Egg, Inc. prestige and contracts: https://egg-inc.fandom.com/wiki/Prestige?oldid=9210 , https://egg-inc.fandom.com/wiki/Contracts?oldid=9822
- Egg, Inc. tips (running chicken, drones): https://www.androidcentral.com/tips-and-tricks-egg-inc
- Path of Exile passive skill: https://pathofexile.fandom.com/wiki/Passive_skill
- Grim Dawn devotion: https://www.grimdawn.com/guide/character/devotion
- Melvor Idle mastery and skill trees: https://steamcommunity.com/app/1267910/discussions/0/3280318152184425446 , https://store.epicgames.com/p/melvor-idle-into-the-abyss-8dbc43
- Melvor Idle 2 announcement: https://www.dekudeals.com/items/melvor-idle-2
- Nodebuster review and player sentiment: https://mancunion.com/2025/05/08/nodebuster-review-a-short-and-sweet-incremental-game/ , https://vaporlens.app/app/3107330/nodebuster.md
- Rock Crusher (massive-tree incremental): https://gamespress.westeu-v2.propressroom.com/Rock-Crusher-an-incremental-game-with-massive-skill-tree-Launches-on-A
- First-prestige timing (dev write-up): https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f
- Universal Paperclips: https://en.wikipedia.org/wiki/Universal_Paperclips
- A Dark Room critical play: https://mechanicsofmagic.com/2026/05/15/critical-play-a-dark-room-3/
- break_infinity.js: https://github.com/Patashu/break_infinity.js (npm 2.2.0)
- break_eternity.js: https://github.com/Patashu/break_eternity.js (npm 2.1.3)
- Rust tech tree and workbench: https://xgamingserver.com/blog/rust-tech-tree-workbench-guide
- Rust wipe schedule: https://xgamingserver.com/blog/when-is-the-next-rust-wipe/
- Rust upkeep: https://supercraft.host/article/rust-decay-calculator/
- Rust cargo ship: https://xgamingserver.com/blog/rust-cargo-ship-guide
- Offline-first idle architecture: https://hostedgg.com/blog/signaldecay-offline-first-idle-games
