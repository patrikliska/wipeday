# Code-domain report: what `packages/domain` does today, and what an incremental redesign means for it

Reader: the planning agent for the Wipe Day incremental redesign. Scope: `packages/domain/src`
(read in full), the data that drives it (`packages/content/data`), and the parts of `apps/api` and
`apps/web` that decide what a "click" costs. Read-only. Line numbers are as of commit `58533e4`.

Measurements were taken with throwaway scripts in this scratchpad (`research/measure/*.ts`), run
through the repo's `tsx` against the real domain and content. Nothing in the repo was changed.

---

## 0. Findings in one page

1. **Today's loop is a check-in game with a capped active layer.** The first advice for a new base
   is Gather (one tap, 10 min cooldown, +30 min of production). Clicking happens in the node
   mini-game: 5 timed hits per node, each hit worth 6 to 24 minutes of the tool's production,
   20 s to 120 s real-time respawn, and a **daily haul** of 180 production-minutes per UTC day at
   full pay, then 10%. Everything else (builds, furnaces, crafts, trips, crew shifts, raids,
   barrels) waits on timers of 10 minutes to 24 hours.
2. **Measured with a scripted hyperactive new player** (1 hit per second, Gather every 10 min, buys
   as soon as possible): the day's haul is gone **within the first 10 minutes**; timber hits the
   twig storage cap (1,500) by minute ~20; Timber tier lands at minute 44 (stone is the
   bottleneck); the Timber cap (5,000) stops timber by minute ~90. After the haul, the 10% share
   still pays about 25-30x the passive rate. **Storage caps, not the haul, are the real wall on
   clicking.** 2 hours of this = 7,333 commands (6,600 node hits).
3. **Lazy settling is closed-form linear accrual with constant rates per window.** Rates change only
   through commands, which bank first ("bank before change"). Timers that change rates (a building
   landing) do **not** split the window: they re-price it retroactively from `lastCollectedAt`
   (verified: a garden landing 10 min into a 10 h window pays 100 food instead of 98). Subsystems
   settle one after another to `now`, not interleaved in time (only raids split the window).
   This works for "constant rate, nothing auto-buys". It does **not** support compounding,
   chained generators, or automation that spends while offline.
4. **Modifiers are one flat struct of ~25 named additive fields** (`modifiers.ts:12-53`), summed
   from buildings, legacy perks and the season modifier, applied as integer percents. Every new
   effect kind needs code in 4-5 places. No multiplicative layers, no conditions, no unlock
   effects. Perks share buckets with buildings (they dilute). It will not scale to a 300-500 node
   tree as is; the representation must become data-driven (stat key + operation + value).
5. **The 25% legacy cap is enforced three times** (design rule CLAUDE.md section 8, a content check in
   `parse.ts:1001-1024`, and a brute-force test over every perk combination in
   `legacy.test.ts:63-101`, 12,288 combinations today). A prestige tree with meaningful
   multipliers is the opposite of this rule; the test approach (enumerate combinations) cannot
   survive a large tree anyway.
6. **Numbers are capped at 2^53 by construction**: zod `z.int()` (zod 4.6.5) rejects anything
   above `Number.MAX_SAFE_INTEGER` (verified), state amounts are integers by rule, percents are
   integers, and `abbrev()` only knows k / M / B (`words.ts:11-27`; 1e15 prints as `1000000B`).
   The base itself is one JSON text blob (`bases.state_json`), so doubles up to 1e308 would store
   fine; the side tables with `integer` columns (trades, hall of fame, signal gifts) would not
   hold big values precisely.
7. **A click is a full command round trip with heavy write amplification.** Each command: one
   SQLite transaction, parse ~6-14 KB of state, settle, apply, stringify-compare the whole state,
   write the whole state, insert one `event_log` row per event, insert the **whole response
   including the whole state** into `commands` (kept 7 days), and push the whole state over SSE.
   Domain CPU is negligible (`applyCommand` ~0.013 ms; `settleAll` ~0.005 ms on a day-20 base),
   so the cost is I/O and payload: at 10 taps/s that is ~140-280 KB/s of SQLite writes per player
   and ~0.25-0.5 GB per hour of clicking kept in the `commands` table for 7 days (stored
   responses of ~7-14 KB each). 5-15 taps/s needs a batched,
   budgeted "taps" command and a lighter command path.
8. **The client already predicts every command** with the same domain function and queues it
   (`store.ts:813-845`), but sends the queue strictly one at a time and replays the remaining queue
   after every answer (`store.ts:318-323, 427-485`). On a network error it drops the whole queue
   and reloads, so predicted taps would visibly vanish.
9. **Cleanly reusable**: the injected `Clock`, seeded `rng`, the command architecture
   (`applyCommand` = settle + step + typed refusal; idempotency keys; client prediction; `World`
   for server secrets), typed events feeding stats / feed / notifications / welcome-back, the
   recipe graph helpers, the expedition engine (odds fixed at departure, seeded resolution), and
   `newBase(carry)` + `carryOver` as the hook for a per-player reset.
10. **Tied to the check-in design and in direct conflict with an idle game**: storage caps that
    stop accrual, manual Collect (spending only counts banked stock), upkeep and decay, the daily
    haul, the Gather cooldown, crew tiredness and sleep, raids that only follow a player who acts,
    hand-authored 3-level buildings (no cost formulas), the season-wide (not per-player) reset,
    and server-only perk purchases.
11. **Removing seasons is cheap in code**: everything keys on the running season row; never
    calling `endSeason` leaves one perpetual season (caveat: the Signal opens on season day 21,
    `seasons.json5:20`, and would then stay open, and leaderboards would never close). A
    per-player "nuke" needs either a run
    counter in the `bases` key (`schema.ts:160`, PK is `(player_id, season_id)`) or an
    archive-and-replace of the player's base in place.

---

## 1. Map of the domain package

`packages/domain/src`: 11,167 lines including tests. Pure functions over one `BaseState`
document; no IO, no clock reads (CLAUDE.md section 3).

| Module | Lines | Role |
| --- | --- | --- |
| `base.ts` | 800 | `BaseState` shape, lookups, accrual, Gather/Collect, upkeep/decay settle, tools, furnaces |
| `settle.ts` | 94 | `settleAll`: the ordered pipeline of every subsystem's settler; `nextEventAt` |
| `commands.ts` | 511 | `Command` union, `Refusal` union, `applyCommand` |
| `modifiers.ts` | 150 | sums building, perk and season effects into one `Modifiers` struct (cached) |
| `active.ts` | 165 | barrels and daily tasks |
| `nodes.ts` | 269 | the "work the node" mini-game and the daily haul |
| `buildings.ts` | 158 | construction status and start (builder slots, tier gates) |
| `craft.ts` | 449 | per-station timed queues, salvage, meals |
| `recipes.ts` | 183 | recipe graph: sources, uses, needs tree, blueprint draws |
| `crew.ts` / `jobs.ts` | 247 / 152 | survivor jobs (node, station, guard), shifts, tiredness, sleep, bonds |
| `missions.ts` | 909 | arrivals, gear, scouting, trips with odds, seeded resolution, reports |
| `advisor.ts` | 238 | the one glowing next action and the onboarding hints |
| `legacy.ts` | 248 | season carry-over, legacy points, perks (server-only purchase) |
| `raids.ts` | 682 | NPC raids, defence, capped PvP |
| `market.ts`, `den.ts`, `contracts.ts`, `casino.ts`, `signal.ts`, `leaderboard.ts` | 277-330 each | the multiplayer economy and the season's shared project |
| `stats.ts` | 97 | season counters derived from events |
| `events.ts` | 180 | the `GameEvent` union |
| `normalize.ts` | 138 | migrates stored bases from older shapes on load |
| `words.ts` | 127 | the one number formatter and feed sentences |
| `wire.ts` | 217 | API response and push types |
| `clock.ts`, `rng.ts`, `world.ts`, `goods.ts`, `feed.ts` | small | infrastructure |

`BaseState` (`base.ts:78-168`) holds ~45 fields: stock, tool, tier, buildings, construction,
upkeep, furnace jobs, items, per-station production queues, blueprints, meal boost, crew, bonds,
missions, reports, node run/wear/depletion, haul, barrel, tasks, hints, the Den, contracts,
casino day, wheel bets, stats, raids, PvP, season info, perks, veterans, skin. Measured JSON
size for the simulator's `active` archetype: 6.6 KB on day 1, 9.2 KB day 5, 11.3 KB day 10,
13.5 KB day 20, 14.0 KB day 30 (reports are capped at 20 and raid reports at 10, so it plateaus).

---

## 2. The real moment-to-moment loop of a new player today

### 2.1 Starting state (`newBase`, `base.ts:179-239`)

- Tier `twig`, tool `rock`: **timber 120/h, stone 80/h** (`tools.json5:7-12`). Stock keys only for
  what the tool makes, at 0.
- Storage cap **1,500 per resource** at twig, 2 crate slots, 1 builder (`base_tiers.json5:14-18`).
- Crew of three (mara, dax, ivo), cap 4, next arrival in 24 h (`crew.json5:5-8`).
- First barrel scheduled at +15 min (`active.json5:18`).
- No upkeep on twig.

### 2.2 What the player taps

| Action | What it does | Numbers |
| --- | --- | --- |
| **Gather** (`base.ts:517-532`) | Banks what accrued, then adds `bonusMinutes` of production on top (storage-capped), starts the cooldown | +30 min of production every **10 min** (all tools, `tools.json5`). Rock: +60 timber, +40 stone per tap. A player who taps every 10 minutes earns 4x passive. A served meal adds its percent to the bonus. |
| **Collect** (`base.ts:491-501`) | Banks accrual into stock and restarts the window | Required to spend: affordability is judged on banked stock only (`base.ts:666-670`). |
| **Work the node** (`nodes.ts:134-234`) | Up to 5 timed hits per run; each hit banks a slice | See 2.4. |
| **Break barrel** (`active.ts:54-86`) | Two weighted rolls from the loot table, 8% chance of a blueprint | See 2.5. |
| **Build** (`buildings.ts:114-158`) | Pays, then a builder timer (or instant for 0-minute levels) | First workbench (500 timber, 100 stone), furnace L1 (400/300), campfire L1 (100/50, +2% all rates) are instant (`buildings.json5:20-42`). |
| **Upgrade tool** (`base.ts:671-689`) | Banks at old rates, pays, switches tool | Stone tools: 240 timber + 120 stone, doubles timber and adds ore, sulfur ore, fibre (`tools.json5:13-18`). |
| **Build tier** | Same as build | Timber tier: 1,500 timber + 500 stone, instant, then upkeep 30 timber/h (`base_tiers.json5:19-23`). Note: 1,500 timber is exactly the twig cap. |

### 2.3 What runs by itself (lazily, see section 3)

- Tool production plus buildings' flat production (`effectiveRates`, `base.ts:385-397`),
  piling up uncollected until the storage cap.
- Survivors with a node job: **15% of the tool's rate** for that node's yield per worker, plus
  trait bonuses (`crew.ts:99-151`, `crew.json5:22-29`). Full pace for 16 h after a rest, then
  50% until sent to bed for 8 h.
- Furnace jobs (ore to ingots at 120/400/1,200 ore per hour by furnace level,
  `furnaces.json5`), fuel burned up front; output must be taken out with a command.
- Craft queues per station (`craft.ts:297-337`), unit times fixed at queue time.
- Missions (trips/scouts) resolve when settling passes their end (`missions.ts:879-895`).
- Upkeep paid hour by hour from stock, pulling from the accrual when short (`base.ts:591-632`).
- Barrels spawn and drift off on a schedule; tasks roll each UTC day; raids land.

### 2.4 The node mini-game and the daily haul (`nodes.ts`, `active.json5:8-15`, `nodes.json5`)

- Seven nodes stand around the base: 4 trees, 1 stone, 1 ore, 1 sulfur (`nodes.json5:15-23`).
  A node whose yield the current tool does not produce refuses with `tool` (rock cannot work ore
  or sulfur).
- A run: tap the marker up to `maxHits` **5** times; each hit must come within
  `hitWindowSeconds` **4.5 s** of the previous one (server allows +3 s grace,
  `nodes.ts:81-84`). Hits are numbered by the node's total wear, sent as
  `{type: "hit_node", node, run, hit}`; a repeated hit number is a no-op, an out-of-order one is
  refused (`nodes.ts:155-174`). A run that stops short leaves wear; the next run continues
  (D76).
- **Slice per hit** (`nodeSlice`, `nodes.ts:47-57`): `hitMinutes` of the current effective rate
  for the node's yield. Trees and stone 6 min, ore 12, sulfur 24. Rock: tree hit = 12 timber,
  stone hit = 8 stone. Stone tools: tree hit = 24 timber.
- **Perfect run**: all 5 hits in one streak on an unworn node adds `perfectBonusHits` = 1 extra
  slice on the last hit (`nodes.ts:194-196`) and a 3% blueprint roll. A perfect tree run with rock
  = 72 timber.
- **Respawn**: real seconds from worked out to standing: tree/stone/fibre 20 s, ore 45 s, sulfur
  120 s (`nodes.json5:9-13`).
- **Daily haul** (`haulLeft`, `nodes.ts:30-38`; applied at `nodes.ts:199-213`): hits pay in
  full while the day's 180 production-minutes last (+30/60/90 from the bunkhouse); each full-pay
  hit consumes `hitMinutes x slices`. A perfect tree run consumes 36 minutes, so **five perfect
  tree runs use the whole day's haul**. After that a hit pays `afterHaulPercent` = **10%**,
  floored per resource: a rock stone-node hit after the haul pays `floor(0.8)` = **0 stone**.
  The haul resets at UTC midnight. Storage caps clamp every hit (`nodes.ts:207`).
- Measured (scripted, 1 hit per second, 50 s of tapping per minute): haul gone in the first
  10 minutes; afterwards tapping still added ~108 timber per minute against a passive 4 per
  minute (stone tools + campfire), until the 5,000 cap. Stone, the slower and floored resource,
  gated the tier.

### 2.5 Barrels (`active.ts:17-86`, `active.json5:17-29`)

- First at +15 min, then every **240 min** on a fixed schedule; each lives **45 min**. Missed
  ones are skipped, not stacked (`active.ts:30-35`). Radio mast brings them up to 90 min sooner
  (never more often than hourly), watchtower keeps them up to 45 min longer, season modifiers
  shift them.
- Two weighted rolls: scrap 2-8 (w30), fibre 10-30, hide 5-15, fat 3-8, food 10-30; clamped to
  the storage cap (including scrap, since `clampToCap` does not check kind). 8% blueprint chance.
- In genre terms this is a slow golden cookie (Cookie Clicker's appear every few minutes and last
  seconds).

### 2.6 Daily tasks (`active.ts:90-165`, `active.json5:30-43`)

- 3 per UTC day from a pool of 8, same picks for everyone (seeded by the day), skipping ones the
  base cannot do yet. Kinds: gather 4x, collect 3x, 10 node hits, 1 barrel, smelt 300, take out
  200, 1 trip, 1 craft. Rewards are small (5-10 scrap plus 20-300 of a resource); the craft task
  always draws a blueprint. Progress is recorded by `applyCommand` from a `task` tuple each step
  returns (`commands.ts:496-500`).

### 2.7 The advisor (`advisor.ts:210-230`)

A fixed priority list, first match wins: collect if storage is full and something waits; barrel;
defend; next tier affordable; next tool affordable; repair; furnace worth it (>= 100 ore);
cheapest affordable building (workbench first); crew (tired or idle); map; craft (a part the next
tier/tool needs, or a crate at 80% fill); Den contract; Gather if ready; else collect or Gather.
For a brand-new base every check fails until Gather, so **the first glowing action is Gather**
(confirmed by script). Hints retire after two uses (`HINT_RETIRE_AFTER`, `advisor.ts:51`);
`applyCommand` counts hint use per command type (`commands.ts:182-201, 501-509`).

### 2.8 Timers a player waits on (with the shipped numbers)

| Timer | Duration | Source |
| --- | --- | --- |
| Gather cooldown | 10 min | `tools.json5` |
| Node respawn | 20-120 s real | `nodes.json5` |
| Barrel cadence / life | 240 min / 45 min | `active.json5` |
| Building levels | 0-1,440 min (most 10-720) | `buildings.json5` |
| Tier builds | twig->wood 0, ->stone 240 min, ->metal 720, ->hqm 1,440 | `base_tiers.json5` |
| Craft units | 2-30 min per unit before speed-ups; queues 2-4 jobs, batches 10-50 | `recipes.json5`, `crafting.json5` |
| Furnace | 120-1,200 ore/h; job cap 1k-20k ore | `furnaces.json5` |
| Trips | 30 min (beach wreck) to 720 min (offshore platform) | `sites.json5` |
| Scouting | 30-240 min | `regions.json5` |
| New survivor | every 24 h while under cap | `crew.json5:8` |
| Crew shift | 16 h awake, 8 h sleep, 50% when tired | `crew.json5:22-29` |
| Upkeep | hourly; decay after 1 unpaid hour (50% production); a building level or tier lost after 72 h (+ walls' grace) | `base_tiers.json5:7-12`, `base.ts:634-654` |
| NPC raid | planned on each command, lands 2 UTC days later at night, 3 h warning, not before 72 h after reaching Stone | `raids.json5`, `raids.ts:218-239` |
| Season pacing | Stone day 3-4, Sheet Metal 12-14, Armored 15-28 (casual); optimal not before day 14 | `pacing.json5` |

The active layer is short and front-loaded; everything that moves the player forward over days is
timer-gated. That is the "check in three times a day" design from CLAUDE.md section 8, and it is
the opposite of "click like crazy, then automate".

---

## 3. Lazy settling

### 3.1 The pipeline (`settle.ts:23-74`)

`settleAll(content, state, now, world?)`:

1. While a planned raid's `at <= now`: settle everything up to `raid.at`, resolve the raid
   against the base as it stood, record stats (`settle.ts:33-39`). Only raids split the window.
2. `settleSpan` to `now`, in this fixed order: constructions + upkeep (`base.settle`) -> crafts
   -> missions -> arrivals -> barrel -> tasks -> nodes -> market listings -> Den counter and
   contracts -> wheel -> stats (`settle.ts:53-73`).
3. Raid warning (`settle.ts:41`).

Each subsystem settles itself to `now` independently. Nothing in one subsystem feeds another
inside the same settle (e.g. a furnace's output does not start a queued craft), so the order is
only correct because no subsystem automatically consumes another's output.

`nextEventAt` (`settle.ts:77-94`) is the earliest timer end (construction, craft unit, mission,
arrival, barrel, raid warning/landing, wheel, listing). The API stores it per base and a
60-second tick (`main.ts:21, 83`; `game.ts:1048-1076`) settles bases whose time has come, so
things land and push while nobody looks.

### 3.2 Accrual math (`base.ts:372-474`)

- `production(rates, seconds, percent)` = `floor(perHour x seconds x percent / (3600 x 100))`
  per resource: **closed-form and linear**.
- `accrued(state, now)` integrates from `lastCollectedAt` to `now` in at most three pieces:
  healthy time until upkeep went unpaid (+1 h grace), decayed time at 50%, plus `crewOutput`
  (`crew.ts:130-151`), which integrates each worker's overlap with full pace, tired pace, injury
  and meal windows (floats internally, floored at the end). The sum is clamped to the storage cap
  **once, at the end** (`base.ts:473`). Because stock only grows during a window and the cap is
  per resource, clamping at the end equals stopping at the cap.
- Rates come from `effectiveRates` (`base.ts:385-397`) evaluated **once for the whole window**.

### 3.3 The "bank before change" rule, and where it is broken

Every command that changes a rate banks the accrual first at the old rates: `upgradeTool`
(`base.ts:678`), `assign`/`rest`/`restTired` (`jobs.ts:89, 124, 144`), `serve` (`craft.ts:440`),
`treat` (`missions.ts:233`), trip departure (`missions.ts:509`). Furnace jobs and craft jobs freeze
their speed at start (`FurnaceJob.perHour`, `CraftJob.unitSeconds`) so later upgrades cannot
re-price them; `repriceStation` (`craft.ts:88-116`) re-lays a queue explicitly when a worker moves.

But **timers that land during settle do not bank first**: `settleConstruction`
(`base.ts:550-576`) sets the new building level, and the next `accrued` prices the whole window
since `lastCollectedAt` at the new rates and the new cap. Verified: Timber base, garden (10 food/h)
queued at T0, landing at T0+10 min, settled at T0+10 h: `accrued` = **100 food**, exact = 98.
Same for upkeep: `settle` charges the new buildings' upkeep for hours before they stood. Small
and player-friendly today; with automation buying hundreds of upgrades offline it becomes the
central correctness problem.

### 3.4 Caps, upkeep, decay

- Storage cap per resource: tier cap + biggest crates up to the slot count + warehouse, times the
  perks' `capPercent` (`base.ts:315-326`). Raw and refined goods are capped; parts, items and
  scrap mostly are not (`goods.ts` `isCapped`), though `clampToCap` is applied to whole loot
  tables in barrels, tasks and missions.
- Upkeep (`base.ts:591-656`): due whole hours are paid from stock; if stock is short the accrual
  is banked first (an implicit Collect, event `auto_collect`); still unpaid hours are decay.
  After `tierLossAfterHours` (72) + walls' grace, the dearest building loses a level (or the tier
  drops) and `upkeepPaidUntil` resets to now, so a long absence costs **one** level per settle,
  not one per 72 h.
- Accrual floors per call: "collecting twice within a second loses at most one unit per
  resource" (`base.ts:460-461`). Settling is therefore **not path-independent** under rounding
  (many small settles yield slightly less than one big one).

### 3.5 How it would cope with the redesign

**(a) Exponential growth.** Within a window, today's rates are constant, so accrual is linear and
exact. Incremental growth comes in three shapes:

- Geometric costs vs. income that rises at purchase events (AdVenture Capitalist, Cookie
  Clicker). Between purchases income is constant, so the existing linear integral still works;
  the growth is in the purchase events. Fine, if purchases are commands.
- Chained generators (gen N makes gen N-1; Egg, Inc. chickens -> eggs -> money). Income
  inside a window is a polynomial in time; needs new closed forms, or stepping.
- True compounding (income proportional to holdings): needs `exp` closed forms or stepping.

None of the last two exist; `production()` is linear only, and content has **no cost formulas**:
every building level, tool and tier is a hand-written row (`buildings.json5` has 18 buildings x
3 levels; tools and tiers 5 rows each). A redesign needs `cost(n) = base x growth^n`, "buy N" and
"buy max" in closed form (geometric series), and zod validating formulas rather than rows.

**(b) Hundreds of multiplicative modifiers.** See section 4. Evaluation cost is not the problem
(`modifiers()` is cached on object identity, `modifiers.ts:86-97`); the representation is.

**(c) Automation that buys while offline.** Today nothing spends during settle except upkeep.
Raids are planned only by commands "so raids only ever follow a player who plays"
(`commands.ts:15-16`, `raids.ts:218`): the codebase's stance is that absence has bounded effects.
Auto-buy needs:

- a deterministic, client-predictable policy (no `World` secrets) run **inside settle, in time
  order**, across all subsystems at once (one event queue, not one settler after another);
- window splitting at every rate change: next event time = min(timer ends, time until the next
  automated purchase is affordable `(cost - stock) / rate`, time a cap is hit, `now`);
- a step budget plus bulk closed forms (buy max of a geometric series) so a 24 h absence cannot
  take thousands of steps per request; or an explicit offline model (offline efficiency, max
  offline hours, as Egg, Inc.'s silos and most idle games do);
- fractional remainders kept in state (doubles), or per-step floors drift;
- a property test: `settle(settle(s, t1), t2) == settle(s, t2)` within tolerance. That test does
  not exist today because rounding makes it false.

The simulator's greedy `checkIn` (`packages/sim/src/sim.ts:194-...`) already encodes "spend the
most valuable first" policies; it is the nearest thing to automation rules, but lives outside the
domain and runs at check-in granularity.

**(d) Values beyond 2^53.**

- Content: `amounts = z.record(z.string(), z.int().min(0))` (`schema.ts:21`). zod 4.6.5's
  `z.int()` rejects anything above `Number.MAX_SAFE_INTEGER` (verified: `2**53` and `1e20` fail).
- State: amounts are JS numbers by convention "integers in state, no floats in the database"
  (CLAUDE.md section 4). Integer-percent maths (`floor(x x (100 + p) / 100)`) cannot express
  +0.5% or x1.07, and `x x (100 + p)` overflows safe integers long before x reaches 1e300.
- Storage: `bases.state_json` is TEXT; `JSON.stringify(1e300)` is `1e+300` and parses back, so
  doubles are fine there. `event_log.payload` is JSON text too. Integer columns that would carry
  big values: `trades.amount/price`, `hall_of_fame.value`, `signal_gifts.amount/worth`,
  `listings.amount/price` (better-sqlite3 returns JS numbers; precision lost above 2^53 unless
  `safeIntegers`).
- Wire: the command schema caps amounts at 10,000,000 (`commandSchema.ts:58-59, 90`).
- Display: `abbrev` knows k, M, B only (`words.ts:15`); 1e12 prints `1000B`.
- Options: plain doubles (enough up to ~1.8e308 if the economy is designed in log space; Cookie
  Clicker uses doubles), `break_infinity.js`-style mantissa/exponent beyond that, or BigInt
  (exact but no JSON support and awkward for multipliers). Doubles are the smallest change: the
  state blob already accepts them; the rule, the zod schemas, the percent maths and the formatter
  change.

---

## 4. Modifiers today

### 4.1 Representation (`modifiers.ts:12-150`)

One `Modifiers` struct with fixed fields: `rates` (per resource %), `allRates` %, `flat` (per
hour), `cap`, `fuelPer100Ore`, `smeltPercent`, `craftPercent`, `haulMinutes`,
`barrelLifeMinutes`, `barrelEveryMinutes`, `graceHours`, `crew`, `furnace` (max, not sum),
`scoutRange`, `defence`, `warnHours`, and from W7 `capPercent`, `tripSuccess`, `xpPercent`,
`tripLoot`, `raidStrength`, `raidDays`, `barrelRolls`, `flatPercent`.

`modifiers()` walks every building's current level's `effects` (levels hold totals, not deltas,
`buildings.json5:3`), then every perk's `bonus x rank`, then the season modifier; all **summed**.
Cached in a `WeakMap` keyed on the `buildings` object, checked against `perks` identity and the
season modifier id (`modifiers.ts:86-97, 148`).

### 4.2 How each stat stacks

| Stat | Formula | Where |
| --- | --- | --- |
| Gather rates | `floor(tool x (100 + allRates + rates[id]) / 100)` | `base.ts:388-390` |
| Flat production | `floor(flat x (100 + flatPercent[id]) / 100)` | `base.ts:391-395` |
| Storage | `floor((tierCap + crates + cap) x (100 + capPercent) / 100)` | `base.ts:325` |
| Crafting | `round(minutes x 60 x 100 / (100 + craftPercent + stationBoost))` | `craft.ts:76-81` |
| Smelting | `floor(orePerHour x (100 + smeltPercent) / 100)` | `base.ts:709-711` |
| Gather bonus | `production(rates, 30 min, 100 + mealPercent)` | `base.ts:523-524` |
| Node hit | `floor(slice x slices x hauledPercent x (100 + mealPercent) / 10000)` | `nodes.ts:203-206` |
| Crew node job | `floor(tool x share x (15 + traitJob) / 100)`, meal adds seconds | `crew.ts:108-113, 140-141` |
| Trip odds | site chance + companions + bonds + levels + traits + weapon + `tripSuccess`, clamped 5-95 | `missions.ts:366-417` |
| Raids | defence / (defence + attack), clamped | `raids.ts:127-136` |

So: additive percents inside a stat, a couple of incidental multiplications (meal x haul,
capPercent x cap sum), integer arithmetic everywhere. **Legacy perks feed the same additive
buckets as buildings** (e.g. `steady_hands` adds to `allRates` next to the campfire), so each
point is worth less the more buildings stand. Crew traits, gear and meals are applied ad hoc in
their own modules, not through `modifiers()`.

### 4.3 Does it scale to a 300-500 node tree?

No, not as a representation:

- **Every effect kind is code.** A new kind means: a field in `Modifiers` and `NONE`, a zod
  field in `schema.ts` (`buildingSchema` effects at `schema.ts:109-139`), a sum line in
  `modifiers()`, an application site in the rule that uses it, and usually locale effect lines.
  A big tree wants dozens of kinds (per-generator multipliers, click power, offline efficiency,
  automation unlocks, cost reductions, crit chance, prestige-gain multipliers).
- **No multiplicative layers or ordering.** Incremental trees need at least: base -> flat add ->
  additive "increased" -> multiplicative "more" (each node its own factor) -> global multipliers
  (prestige currency, achievements). Today's single additive bucket cannot express "x2 timber"
  next to "+10% timber" correctly.
- **No conditions or scaling effects** ("+1% per building owned", "x2 while a barrel is up",
  "x(1 + 0.01 x prestige points)"): these are the backbone of Realm Grinder / Clicker Heroes
  trees.
- **No unlock effects.** Automation (auto-collect, auto-gather, auto-buy, auto-smelt, managers)
  is a different effect type from a stat bonus: a boolean or a policy switch read by settle.
- **No graph.** Perks are a flat list with ranks (`legacy.json5:18-27`); a tree needs nodes with
  prerequisites, positions for the UI, cost formulas, respec rules, and content checks (no cycles,
  everything reachable, locale keys).
- **The cap rule and its tests do not survive.** `checkLegacy` sums every perk at top rank against
  25% (`parse.ts:1001-1024`); `legacy.test.ts:63-101` enumerates every combination (product of
  `ranks + 1`, 12,288 today). Exponential in node count; must become an upper-bound check, or go
  with the rule.
- Performance is fine: an O(nodes) fold with an identity cache is cheap for 500 nodes. Keep the
  "one place sums all effects" idea and the cache; change what an effect is (data: `stat`, `op`,
  `value`, optional `per`/`condition`), and make stacking order explicit in one evaluator.

---

## 5. The command model

### 5.1 `applyCommand` (`commands.ts:476-511`)

1. `settleAll(state, now, world)`.
2. `step()`: a switch over 35 command types (`commands.ts:66-116, 212-470`), each calling one rule
   and mapping its failure to a typed `Refusal` (`commands.ts:132-175`) that carries what is
   missing (the UI's "need 2.1k stone").
3. A refusal returns the settled state plus the reason (settling is always safe to keep).
4. On success: `recordStats` from the events, task progress, hint use, then `planRaid`.

`World` (`world.ts`) carries what only the server knows: a fresh seed (slots, dice, PvP), wheel
results, the jackpot, the listing being bought, the PvP target, legacy points, the Signal.
Commands that need it return `server_only` on the client (`SERVER_ONLY`, `commands.ts:121-129`:
market_buy, slots_spin, dice_roll, raid_player, **buy_perk**, set_cosmetic, signal_give).

### 5.2 Client path (`apps/web/src/state/store.ts`)

- `send(command)` (`store.ts:813-845`): predicts with the same `applyCommand` at the client's
  `floor(now)`, shows the predicted state and its events at once, enqueues with a fresh key.
  Server-only commands are queued unpredicted and shown as pending.
- `flush()` (`store.ts:427-485`): sends the queue **one command at a time**; after each answer
  sets `confirmed` and rebuilds `base` by re-applying every still-queued command
  (`rebase`, `store.ts:318-323`). A network failure after retries (500/1,500/4,000 ms,
  `http.ts:46, 86-103`) **empties the queue and reloads**.
- A node hit is `hitNode(hits)` -> `send({type: "hit_node", node, run, hit})`
  (`store.ts:904-908`); the scene calls it per tap (`scene/Scene.ts:171-178`).

### 5.3 Server path (`apps/api/src/game.ts:601-680`)

Inside one better-sqlite3 transaction (D59):

1. Look up `(player, key)` in `commands`; a replay returns the stored response verbatim.
2. Load the base: parse `state_json`, `normalizeState` (`game.ts:230-265`).
3. Build `World`; for market buys and PvP, settle the other base too.
4. `applyCommand`.
5. `JSON.stringify(result.state) !== JSON.stringify(loaded.state)` to decide whether to save
   (`game.ts:630`); save writes the whole state, `version + 1` and `nextEventAt`
   (`game.ts:267-288`).
6. `log()`: one `event_log` row per event, feed broadcast, Den tables (`game.ts:294-...`).
7. Insert the **whole response, state included**, into `commands` (`game.ts:656`); kept 7 days
   (`COMMAND_TTL`, `game.ts:98`; purged on the minute tick).
8. Update `players.last_seen_at`; queue an SSE push of the **whole state** with the origin key
   (`PushMessage`, `wire.ts:64`).

### 5.4 Measured cost of one command

| Measure (day-20 active base) | Value |
| --- | --- |
| `applyCommand({type: "collect"})` | ~0.013 ms |
| `settleAll` | ~0.005 ms |
| `advise` | ~0.006 ms |
| `JSON.stringify(state)` | ~0.019 ms |
| State JSON | 6.6 KB (day 1) to 14.0 KB (day 30) |
| Command response JSON (stored in `commands` and sent over HTTP) | ~13.8 KB |

CPU is irrelevant; bytes are not. Per command the server writes roughly 2x the state size (state
row + stored response) plus event rows, and pushes the state again over SSE. At 10 taps/s: about
140-280 KB/s written per player (the state row is overwritten in place, but the WAL takes every
write), **about 0.25-0.5 GB per hour of tapping retained in `commands` for 7 days**, plus thousands of `node_hit` rows in `event_log` (measured scripted run: 7,333 commands
and 6,600 hit events in 2 hours on a twig/Timber base). For a handful of friends SQLite can take
the transaction rate; the amplification and retention are what break.

### 5.5 What 5-15 taps per second needs

- **A batched tap command**: the client accumulates taps for ~0.5-1 s (or N taps) and sends
  `{type: "taps", target, count}` (optionally with client timestamps for animation). The domain
  pays `count x tapValue` in closed form and enforces a **budget in state** (a token bucket:
  `tapTokens`, `tapAt`; refill = max taps/s x elapsed, burst cap), so a forged count cannot
  exceed what a human could tap. Same function on client and server, so prediction stays exact.
  Idempotent by key like every command.
- **Coalesce on the client**: merge consecutive taps into the tail of the unsent queue instead of
  enqueuing one command per tap; keep `rebase` cheap.
- **Lighter hot path**: store a small response for tap batches (version + deltas, or a hash),
  not the whole state; push deltas or only `version` to other tabs; replace the double
  `JSON.stringify` compare with a dirty flag or version from the domain; aggregate tap events
  into one `tapped` event per batch and keep them out of the feed and `event_log` analysis noise
  (or sample them).
- **Never drop predicted taps on a network error**: today the queue is cleared and the state
  reloaded (`store.ts:475-479`), which would erase visible gains.
- The node mini-game's numbered-hit protocol (`hit_node` with `run` and `hit`) is good
  anti-replay for a rhythm game, but it is one round trip per tap by design; it does not fit
  rapid clicking.

---

## 6. Reusability: what survives an incremental redesign

### 6.1 Reuse as is

| Part | Why it fits |
| --- | --- |
| `clock.ts` (`Clock`, `manualClock`, `scaledClock`) | Time injection is genre-neutral; the scaled clock already drives demos and screenshots. |
| `rng.ts` (mulberry32, `seedOf`, `pickWeighted`) | Replayable randomness for drops, crits, golden-cookie events. |
| `World` pattern | Server secrets for the few unpredictable rolls; keep it small. |
| Idempotent command store (D59), client prediction + server authority | Exactly what a server-authoritative idle game needs; only the payload must shrink. |
| `GameEvent` -> `recordStats`, feed, notifications, welcome-back (`stats.ts:48-97`, `feed.ts`, API `eventsSince`) | "What happened while you were away" is a core idle-genre screen. |
| `recipes.ts` graph (`sourcesOf`, `usesOf`, `expandNeeds`, `partsToMake`) | Melvor-style production chains and "how do I get this" trees. |
| `missions.ts` expedition engine (odds fixed at departure, seeded resolution, reports, pity counter) | A ready sub-game (Melvor combat / Egg, Inc. missions analogue). |
| `words.ts` (minus `abbrev`), locale discipline | Same strings on web and Discord. |
| `Refusal` unions with "what is missing" | Rule 6.3.3/6.3.5 (disabled buttons explain themselves) carries over. |

### 6.2 Reuse the pattern, rewrite the content

| Part | Change needed |
| --- | --- |
| `settle.ts` pipeline + `nextEventAt` + API tick | Becomes one time-ordered event integrator across subsystems with window splits at every rate change, an automation step, and a step budget. |
| `modifiers.ts` | Keep "one fold, cached"; replace the struct with data-driven effects and an explicit stacking order (section 4.3). |
| `advisor.ts` | A hand-ordered list today. With dozens of buyables it becomes "best affordable by payback time" (AdVenture Capitalist style), plus the reveal-on-affordable rule. |
| `legacy.ts` (`Legacy`, `Carry`, `carryFor`, `carryOver`, `newBase(carry)`) | The shape of a prestige layer is there: currency, spent, ranks, what is kept. Needs a node graph, formulas, and per-player reset at will ("the nuke") instead of a season-wide admin reset. Move prestige state into the player's own document so tree purchases are predicted (today `buy_perk` is server-only because points live in the `legacy` table). |
| `craft.ts` queues | Discrete timed batches fit a crafting sub-game; core production in an incremental is usually continuous conversion rates. |
| `active.ts` barrels | Become golden-cookie events (minutes apart, seconds to claim) with multiplier buffs. |
| `active.ts` tasks | Daily tasks fit; rewards scale to the economy. |
| Crew jobs (`crew.ts`) | Workers on nodes are already automation (15% of tool rate each); the natural "manager" analogue. Drop tiredness/sleep. |
| `normalize.ts` | A redesign is a new state version; probably a wipe and a fresh `normalize` baseline. |

### 6.3 Tied to the check-in design (remove or replace)

| Part | Conflict with the idle genre |
| --- | --- |
| Storage caps that stop accrual (`accrued`, `clampToCap` everywhere) | CLAUDE.md section 8: "Storage caps drive check-ins". Idle games let income run; an offline cap (Egg, Inc. silos) is the genre's version. |
| Manual Collect; spending counts banked stock only (`base.ts:666-670`) | Income should land in the balance directly; Collect is a check-in ritual. |
| Upkeep and decay (`base.ts:427-453, 591-656`) | Punishes absence; idle games reward it. |
| Daily haul (`nodes.ts:30-38, 199-213`) | Caps clicking per day: the direct opposite of "click like crazy". |
| Gather with a 10-minute cooldown | A check-in button, not a click target. |
| Crew shifts, tiredness, sleep (`crew.ts:21-94`, `jobs.ts:106-152`) | Friction that requires returning to the base. |
| Raids planned only on commands, capped PvP | Built for bounded offline consequences; can stay as an optional side mode. |
| Hand-authored 3-level buildings, 5 tiers, 5 tools | Incremental content is formula-driven with long or unbounded purchase counts. |
| Season-wide reset (`game.ts:910-...`), `bases` PK `(player_id, season_id)` | A per-player nuke at will needs a run counter or in-place archive-and-replace. |
| Den, casino, contracts, Signal, leaderboards by season | Multiplayer side systems; their numbers assume a linear economy and per-season scrap. Can be kept as optional layers on top of a reworked currency. |

---

## 7. Spec rules a redesign would have to rewrite

These are not code bugs; they are written guardrails the domain enforces, and an incremental
redesign contradicts each one. Each needs a decision entry.

| Rule | Where it lives |
| --- | --- |
| Integers in state, no floats in the database | CLAUDE.md section 4; zod `z.int()` throughout `schema.ts` |
| Storage caps drive check-ins; reaching a cap stops accrual | CLAUDE.md section 8; `accrued`, `clampToCap` |
| 3 check-ins a day progress steadily; 8 a day at most 1.6x faster | CLAUDE.md section 8; `pacing.json5`, sim archetypes |
| Legacy never more than 25% stronger in any rate | CLAUDE.md section 8; `legacy.json5:9`; `parse.ts:1001-1024`; `legacy.test.ts:63-101` |
| Optimal play cannot reach the top tier before day 14 | CLAUDE.md section 8; `pacing.json5:43-48` |
| Idle timers 10 min to 24 h; active timers real seconds | CLAUDE.md 6.3 rule 9; `nodes.json5`, all timers |
| Seasons last a month; a legacy layer persists | CLAUDE.md section 1; `seasons.json5`, `legacy.ts`, API season reset |
| Casino is scrap only; scrap economy pacing (800-4,000 scrap by day 28 for casual) | CLAUDE.md section 8; `pacing.json5:25-27` |

Scrap today is already scarce (barrels 2-8, tasks 5-10, salvage 1-15 per item, raids and sites
small amounts; sinks are tools at 600/2,000, scouting 5-80, the Den and the casino). Making it
the run currency for big numbers and also the rare prestige-adjacent currency would conflict; a
separate prestige currency (the owner's "blueprint fragments" idea) leaves scrap's existing sinks
intact.

---

## 8. A domain shape that would fit the redesign (input for the plan)

Not code, just the structure the findings point to.

1. **Numbers**: doubles for run currencies with an explicit "big number" type alias and one
   formatter extended past B (T, Qa, Qi... then scientific); keep integers for counts (owned
   generators, levels, tree ranks). Drop `z.int()` for amounts; validate `finite` and `>= 0`.
2. **Effects as data**: `{stat, op: "add" | "inc" | "more" | "unlock", value, per?, when?}` on
   buildings, tree nodes, achievements, crew; one evaluator with a fixed order and an identity
   cache keyed on (owned, tree, run) objects. Tests: monotonicity and upper bounds per stat, not
   enumeration.
3. **Costs as formulas**: `base x growth^owned` with closed-form buy-N / buy-max; content
   validated as formulas.
4. **Settle as an event integrator**: one loop over all subsystems in time order; split at rate
   changes, timer ends, automation purchases and caps; bulk purchases in closed form; step budget;
   offline efficiency and max-offline-hours as tree upgrades; fractional remainders in state;
   path-independence property test.
5. **Clicking as a budgeted batch command**: token bucket in state; click value tied to the idle
   rate (e.g. base + x% of income per second) so clicking matters early and stays relevant;
   tap events aggregated.
6. **Prestige ("the nuke") as a per-player command**: `newBase(carry)` with the tree and the
   prestige currency inside the player's document (client-predictable), an archived run summary,
   and the `bases` key gaining a run number or the base being replaced in place. Seasons can stay
   as one perpetual row (no schema change) or be repurposed as an optional shared event.
7. **Lighter command path**: small stored responses and pushes for hot commands; dirty-flag
   instead of stringify-compare; queue coalescing on the client; no queue wipe on error.

---

## Appendix: measurement scripts and raw output

Scripts (scratchpad only): `research/measure/measure.ts` (state size, command cost),
`research/measure/clicker.ts` (hyperactive new player, 2 hours), `research/measure/retro.ts`
(retroactive re-pricing check).

```
day 1: tier wood stateJson 6595 bytes; crew 3; reports 13; raidReports 0
day 5: tier stone stateJson 9232 bytes; crew 4; reports 20; raidReports 0
day 10: tier stone stateJson 11273 bytes; crew 6; reports 20; raidReports 2
day 20: tier hqm stateJson 13479 bytes; crew 7; reports 20; raidReports 6
day 30: tier hqm stateJson 13983 bytes; crew 7; reports 20; raidReports 10
applyCommand collect: 0.013 ms each | settleAll: 0.005 ms | advise: 0.006 ms
JSON.stringify state: 0.019 ms | CommandResponse size: 13758 bytes
```

```
first advice: gather
min 10:  twig, stone_tools, timber 375,  stone 86,   haulLeft 0, cmds 611,  hits 550
min 20:  twig, timber 1500 (cap), stone 277, cmds 1223
min 50:  wood (reached at minute 44), timber 560, stone 50
min 80:  wood, timber 4286, stone 623
min 90:  wood, timber 5000 (cap), stone 814
min 120: wood, timber 5000, stone 1387, cmds 7333, hits 6600
```

```
garden queued at T0 (10 min build, 10 food/h), settled at T0+10h:
accrued food 100, exact 98  -> window re-priced retroactively at the new rates
```

Minor doc nit found while reading: `apps/api/src/store/schema.ts:7` cites D62 for "a base's
season state is one JSON document"; the decision is D61 (`docs/decisions.md:414`).
