# Code-meta report: the social and meta systems against an incremental / personal-nuke pivot

Read-only survey of the repo at `E:\Work\myprojects\wipe-day` (main @ 58533e4, 2026-10-07).
Scope: the Den (`den.ts`, `market.ts`, `contracts.ts`, `casino.ts`), raids and PvP (`raids.ts`),
leaderboards and stats (`leaderboard.ts`, `stats.ts`), the feed (`feed.ts`), the Signal
(`signal.ts`), the legacy layer (`legacy.ts`), the event union (`events.ts`), `World`
(`world.ts`), the data files `den.json5`, `raids.json5`, `seasons.json5`, `legacy.json5`,
`events.json5`, `pacing.json5`, the simulator (`packages/sim`), the Discord companion
(`apps/discord/src`), the API's season and shared-state code (`apps/api/src/game.ts`,
`apps/api/src/store/schema.ts`) and all of `docs/decisions.md` (D1-D126).

The pivot being evaluated: exponential, personal incremental runs ("click like crazy, then
automate"), a massive persistent tree bought with prestige points, prestige triggered by a
personal "red button" nuke that destroys the island.

---

## 0. Verdict at a glance

| System | Today depends on a shared economy? | Today depends on a shared clock? | Verdict |
| --- | --- | --- | --- |
| Den counter (`den.ts`) | Yes: fixed scrap prices (`refPer100`), same offers per tier | UTC day (same picks for everyone) | **Rework** into a per-run shop with prices relative to the run |
| Contracts (`contracts.ts`) | Yes: fixed amounts per tier, pay from `refPer100` | UTC day | **Rework** into scale-relative orders, ideally co-op contracts (Egg, Inc. model) |
| Player market (`market.ts`) | Fully: escrow, cross-base sale, floor at 50% of reference | 48 h listings, season-scoped rows | **Remove** |
| Casino (`casino.ts`) | Partly: shared jackpot pool in absolute scrap, caps by tier | UTC-day wager cap, global 30 s wheel rounds | **Rework or park**; the odds engine survives as is |
| Leaderboards + stats | Wealth valued at `refPer100`; absolute counters | Per season (bases keyed by season) | **Rework** categories to scale-fair metrics; split per-run vs lifetime stats |
| Feed + notifications | No (just events) | Feed filtered by season id | **Keep**; change the kinds |
| The Signal | Fully: absolute shared stages, gifts valued at `refPer100` | Opens on season day 21 | **Remove** (or replace by co-op contracts / a nuke counter) |
| Seasons (+ modifiers, reset) | Reset is global | Monthly, by owner command | **Remove the forced wipe**; optionally keep "season" as a leaderboard window; modifiers become run challenges |
| Legacy (`legacy.ts`) | Points from relative rank among friends | Earned only at season end | **Rework into the core prestige system**; the 25% cap is overturned |
| NPC raids + defence | Strength from scrap value at `refPer100`, tier tables | Planned 2 UTC days ahead, land 20:00-23:00 UTC | **Rework** (run-relative events, no resource loss) **or remove** |
| PvP | Cross-base take, tier fence, scrap ceilings by tier | 24 h / 72 h / 48 h windows | **Remove** |
| Bandit camps | No (personal PvE) | No | **Keep** as expedition content |
| Trip events (`events.json5`) | No (percent effects) | No | **Keep** |
| Discord companion | No (thin client) | Season news, season-day line | **Keep** the architecture; update card, feed sentences, news |

The single biggest structural fact: almost every shared system measures value with one fixed
table, `den.json5` `market.refPer100`, and compares players with the shared tier ladder
(Twig..Armored). Exponential personal runs break both yardsticks at once: two friends at the
same moment can be 10^3 and 10^12 apart, and tiers are re-climbed after every nuke.

---

## 1. How the meta layer is wired today

### 1.1 Three shared yardsticks

1. **One value table.** `packages/content/data/den.json5` `market.refPer100` (scrap per 100
   units of every tradeable good, e.g. timber 2, ingots 8, gears 400, charge 1200,
   brass_keycode 30000). Read by:
   - the Den counter price (`den.ts` `offerPrice`: reference x `markupPercent` 250%);
   - contract pay (`contracts.ts` `termsOf`: reference x `payPercent` 40%);
   - the market floor and suggested price (`market.ts` `priceFloor` 50%, `refPrice`);
   - the Wealth leaderboard (`leaderboard.ts` `wealthOf` via `goods.ts` `refValue`);
   - Signal gift ranking (`signal.ts` `giveToSignal`, `worth`);
   - NPC raider strength (`raids.ts` `raiderStrength`: 1 point per `scrapPerPoint` 40 scrap of
     value at risk, via `scrapWorth`);
   - the simulator's raid-loss and PvP columns (`sim.ts` `scrapWorth`).
   The content check enforces that every tradeable good has a price and that
   `payPercent < markupPercent` (no arbitrage, `packages/content/src/parse.ts` ~l.875-886).
2. **The tier ladder as a cross-player scale.** Den opens at Stone (`den.json5 open.tier`);
   counter offers have `minTier`; contracts have amounts per tier
   (`{ stone: 3000, metal: 10000, hqm: 25000 }`); casino limits per tier (Stone 10/50, Sheet
   Metal 25/150, Armored 50/250 scrap max bet / daily wager); raid scrap ceilings per tier
   (50/150/300), raider strength per tier (Stone base 4 max 16 ... Armored base 35 max 120),
   held-raid loot per tier, repair cost per tier; PvP opt-in at Sheet Metal, `maxTierGap` 1,
   charges and attack by target tier (`raids.json5`); Builder score = tier x 1000 + levels.
3. **Shared clocks.**
   - **UTC day**: Den counter rotation (`den.ts rollStock`, seeded by day), contracts
     (`contracts.ts rollContracts`), casino daily wager cap (`casino.ts casinoToday`), daily
     tasks (D37, `active.ts`), daily node haul (D63).
   - **UTC night**: NPC raids land in 20:00-23:00 UTC, `planDays` 2 ahead (`raids.ts planRaid`).
   - **Wall-clock 30 s rounds**: the Wheel of Salvage (`casino.ts roundOf`, D102).
   - **Season**: `bases` primary key is `(player_id, season_id)`
     (`apps/api/src/store/schema.ts`); `event_log`, `listings`, `trades`, `signal`,
     `signal_gifts`, `season_archive`, `hall_of_fame` are all season-scoped; the Signal opens on
     season day 21 (`seasons.json5 signal.opensOnDay`); pacing targets are season days
     (`pacing.json5`); the Discord card prints the season day (`apps/discord/src/ui/home.ts`
     uses `seasonDay` from `signal.ts`).

### 1.2 `World`: what only the server knows (D98)

`packages/domain/src/world.ts`: `seed` (casino rolls), `reveal(round)` (wheel, HMAC of a server
secret), `jackpot` (shared pool), `listing` (another player's listing), `self`/`selfName`,
`target` (PvP defender), `legacy` (points, titles, skins), `signal` (shared progress). Commands
needing it refuse `server_only` in the client and wait for the server (`market_buy`,
`slots_spin`, `dice_roll`, `raid_player`, `buy_perk`, `set_cosmetic`, `signal_give`; see
`packages/domain/src/commands.ts` l.388-460). This pattern is exactly what a `nuke` command
needs (it must read and write the player's legacy row on the server in the same transaction),
so it survives the pivot.

### 1.3 Settling pipeline coupling

`packages/domain/src/settle.ts` `settleSpan` runs base, crafts, missions, arrivals, barrel,
tasks, nodes, then **listings, Den counter, contracts, the wheel**, then `recordStats`;
`settleAll` splits at an NPC raid's landing time. `nextEventAt` includes listing expiry,
wheel rounds and raid times. Every meta system removed is a line removed here, in
`nextEventAt`, and in `advisor.ts` (which imports `deliverStatus` from contracts and
`npcOdds`/`raidWarned`/`repairStatus` from raids; advice kinds `den`, `defend`, `repair`).

---

## 2. System by system

### 2.1 The Den counter (`packages/domain/src/den.ts`, `den.json5 stock`)

**What it does.** From Stone, five offers a UTC day from a pool of 13 (parts, meals, first-aid
kits, one blueprint), the same picks for everyone at the same tier (seeded by the day),
sold in fixed lots at 250% of reference, `lotsPerDay` per player, blueprint at 150 scrap
(D100). A tier change mid-day re-picks the offers but keeps today's purchases.

**Shared economy dependency: high** (prices are absolute scrap from `refPer100`).
**Shared clock dependency: medium** (UTC-day rotation; it is just a seed, not a shared stock).

**Survives?** **Rework.** A fixed "50 planks for 125 scrap" means nothing once runs are
exponential and resets happen every few hours or days. What can survive: the daily rotating
"trader visits with a few odd offers" (a daily login hook in many idlers), deterministic
seeding, the per-player daily limit, the blueprint offer. What must change: price in a
run-relative way (e.g. "N minutes of your current production" or a fraction of the run's
lifetime earnings), and offers should be run boosts (timed multipliers, instant production
chunks, blueprint fragments) rather than specific intermediate parts. Never sell the prestige
currency.

### 2.2 Contracts (`contracts.ts`, `den.json5 contracts`)

**What it does.** Three buy orders per UTC day per base (same for everyone at that tier),
fixed amount per tier (e.g. `smithy_ingots`: 400 / 2,500 / 6,000), paying 40% of reference in
scrap, some with a 10-20% blueprint chance (D100). Closed at day end. Pay below the counter's
price is content-checked so nothing loops.

**Shared economy dependency: high** (absolute amounts by tier, pay from `refPer100`).
**Shared clock: UTC day.**

**Survives?** **Rework**, and it is the best candidate for the social core. Egg, Inc.'s
contracts (timed goals, solo or co-op with friends, rewards in persistent currency) are the
proven model for a friends-scale incremental. To make it scale-fair: the goal must be relative
to each participant's own run (e.g. "produce X% more than your current rate", "reach milestone
M within 6 h", "deliver 3 h worth of your production"), and the reward should be a
prestige-neutral token (blueprint fragments, cosmetic progress, a small persistent bonus).
The existing code's shape (daily roll, `done` list, terms, delivery command, blueprint roll
seeded by day) is reusable; `termsOf` becomes a function of the run, not the tier.

### 2.3 The player market (`market.ts`, API `listings`/`trades` tables)

**What it does.** Whole-lot listings held in escrow inside the seller's `BaseState`, 5% fee
(min 1) kept by the Den, floor at 50% of reference (no gifting), at most 4 open, 48 h expiry,
never your own; a sale is one SQLite transaction over two bases (D99); price history from
`trades`. Property test: goods conserved, scrap falls only by fees (`market.test.ts`).

**Shared economy dependency: total.** **Shared clock:** listing hours, season-scoped rows.

**Survives?** **Remove.**
- Cross-scale exploit: a player deep in run 20 can hand trivial-to-them amounts to someone in
  run 2, which is a massive boost to the receiver, and the anti-gifting floor is defined in
  absolute reference prices, so it cannot stop it.
- D100 already observed "a market with two players would mostly be empty"; the Den's own
  counter was built to compensate.
- It is the second item on the roadmap's own cut list ("If time runs short": W6 PvP, then W5
  market; `docs/roadmap.md`).
- What is worth keeping is the engineering pattern (two-base transaction, escrow inside the
  base, property test), useful for any future co-op contract where goods move between bases.

### 2.4 The casino (`casino.ts`, `den.json5 casino`, `packages/sim/src/rtp.ts`)

**What it does.** Scrap only; bets in 5-scrap chips; three games with odds in data and an
exact return computed by `@wipe-day/content/odds`, content-checked to 90-95%
(`RTP_RANGE`, `parse.ts` l.853): the Wheel of Salvage (global 30 s rounds, bets close 5 s
early, server reveal via HMAC, D102), the One-Armed Scavenger (slots, jackpot 200x the bet plus
a shared pool fed 1% of every spin, kept in hundredths of scrap, never house-seeded, D101),
Bones (dice). Limits by tier: max bet and daily wager (Stone 10/50, Sheet Metal 25/150,
Armored 50/250, about half a casual player's daily scrap, owner's choice). Big wins (10x) and
jackpots go to the feed. RTP verified over a million rounds per option (`rtp.test.ts`), wager
caps verified under 50 parallel commands (`apps/api/src/den.test.ts`).

**Shared economy dependency: medium.** The odds are scale-free (pays are percentages of the
bet), but the **shared jackpot pool is in absolute scrap** (a deep-run player's spins would
dwarf an early player's), and limits are **by tier**.
**Shared clock:** UTC-day cap; wall-clock wheel rounds (fine).

**Survives?** **Rework, or park until after the core loop.** Keep: odds-in-data, the exact
RTP check, chips with whole-scrap pays, the server-secret reveal, the RTP simulator. Change:
- currency: a run currency (or scrap if scrap stays a run currency), never the prestige
  currency (gambling the meta layer would let one bad night erase weeks; a guardrail must say
  "the prestige currency is never wagered, traded or at risk");
- limits relative to the run (e.g. max bet = 10 minutes of current production, daily cap =
  1-2 hours), not by tier, because tiers reset on every nuke;
- the shared jackpot: per player, or a pool counted in a scale-free unit (e.g. "jackpot
  multiplier" grows with everyone's spins, the winner gets their own bet x the multiplier).
A simpler incremental-native alternative: replace the tables with a "risk boost" (stake a
slice of production for a chance at a timed multiplier, Cookie Clicker's golden-cookie
gamble feel), still with odds shown.

### 2.5 Leaderboards, stats and the season card (`leaderboard.ts`, `stats.ts`, D103)

**What it does.** `stats` in `BaseState` counts sites cleared, best haul, player-trade
volume, wagered/won/biggest win, contracts, raids defended/breached/won, tier reach times;
`recordStats` updates them from every command's and settle's events. Six categories: Wealth
(holdings at `refPer100`, including listings), Builder (tier x 1000 + building levels),
Explorer (sites), Trader (trade volume), Lucky (biggest win), Guard (defence score). Ties
share a rank. `GET /api/ranks` settles every base of the season read-only. The season card
(`seasonSummary`) shows tier days, sites, best haul, crew, wealth, ranks.

**Shared economy dependency: medium** (Wealth uses the value table; Trader needs the market;
Lucky needs the casino; Guard needs raids).
**Shared clock: high** (everything is per season; stats live in the season's base).

**Survives?** **Rework.** The ranking code (pure, ties) is fine. The categories need to be
scale-fair or explicitly about lifetime progress, because a base's stats reset on every nuke:
- lifetime prestige earned; nukes launched; tree nodes owned; achievements;
- fastest run to a fixed milestone (minimum time, compares fairly across players);
- biggest blast (best single-run prestige gain, or log10 of peak production);
- co-op contracts completed.
Stats must be split into **per-run** (reset by the nuke, for the after-blast card) and
**lifetime** (persist on the player's legacy/meta row). Today they live only in
`BaseState.stats`, so they would be wiped by a nuke. `stats.reached` also feeds NPC raid
planning (`raids.ts reachedStart`), another coupling to cut.

### 2.6 The feed and notifications (`feed.ts`, D96, D111, D124)

**What it does.** `FEED_TYPES` (mission back with loot, rescues, new tier, level up,
blueprint, keycode, sale, big win, jackpot, NPC raid, PvP raid, Signal lit) are logged to
`event_log` and broadcast to the web and the bot's stream; `NOTIFY_KINDS` (party_back,
raided, raid_warning, arrivals, builds_done, sold), defaults on only for party_back and raided
(CLAUDE.md 6.3 rule 11). The bot posts the web feed's own sentence (`@wipe-day/domain/words`).

**Dependencies:** none on economy; the feed query is filtered by season id.

**Survives?** **Keep as is**, change the content. New feed kinds are the best social glue in
an incremental with personal runs: "Patrik pressed the red button: run 7 ended, +42 fallout",
first nuke, records (fastest run, biggest blast), milestones (first 1M, 1B), achievements,
co-op contract done. Drop `sold`, `raid_launched`/`raided` (PvP), maybe `raid_landed`. New
notification kinds: "offline cap full / production idle" (the incremental version of "storage
full"), "expedition back", "co-op contract needs you"; keep opt-in per kind.

### 2.7 The Signal (`signal.ts`, `seasons.json5 signal`, D119)

**What it does.** The island's shared tower for the last week: opens on season day 21 (or at
announcement); four stages with absolute needs (foundation stone 30,000 + planks 1,500;
tower frames 200 + plates 300; lamp gears 100 + springs 60; fuel 800). `signal_give` is
server-only; gifts are cut to what the stage still needs; gifts valued at `refPer100` rank on
their own board and give up to 10 legacy points by share; the lit Signal reaches the feed and
earns the Beacon skin.

**Shared economy dependency: total** (absolute amounts, reference-price ranking).
**Shared clock: total** (season day 21, season end).

**Survives?** **Remove.** With exponential runs one late-run player fills every stage in a
click, and an early-run player contributes nothing visible. If a cooperative finale is wanted,
two scale-free replacements:
- **co-op contracts** (2.2), where each member's contribution is normalized to their own
  production;
- a **shared nuke counter / fallout cloud**: every nuke anyone launches adds to an island-wide
  total that unlocks small global perks or cosmetics for everyone (counts events, not
  resources, so it is scale-free and it turns each friend's prestige into everyone's news).

### 2.8 Seasons, modifiers and the reset (D114, D115, D118, D120; `seasons.json5`; `apps/api/src/game.ts endSeason`)

**What it does.** Seasons end by owner command (`pnpm season announce|end`, D114), not by
timer. `Game.endSeason` backs up the database, then in one transaction settles every base,
computes leaderboards and season cards, writes `season_archive` and `hall_of_fame`, folds each
base into its player's `legacy` row (`carryOver`), closes listings, zeroes the jackpot, drops
wheel bets, and opens the next season with a modifier (D115). New bases start from
`newBase(..., carryFor(legacy, season))`. Four modifiers (Long Nights raiders +20%, Rich
Tides barrels sooner +1 roll, Quiet Raiders, Storm Season) touch existing `modifiers()` knobs
(D118). The client has a season-over card (D120); the bot posts season news (D124).

**Dependencies:** this is the shared monthly clock itself; it is the only reset in the game.

**Survives?** **Remove the forced monthly wipe.** Reasons:
- The personal nuke is the reset. A second, global wipe on top of it either destroys the
  massive tree (contradicting the pivot's long-term hook) or, if it keeps the tree, wipes
  only the current run, which a player can do themselves at will.
- The friends play at different times and paces; a calendar reset punishes whoever started
  late in the month, which is exactly what personal prestige avoids.
- Season 1 started on 2026-10-07 with two live players; nothing of value is lost by retiring
  the calendar.
What to keep and how:
- the reset machinery (one transaction, backup first, fold base into legacy, `carryFor`
  into a fresh base) is the template for the **per-player nuke** (2.9, section 4);
- optionally keep "season" as a **leaderboard/cosmetic window** (monthly titles, hall of
  fame, monthly records) that resets nobody's progress;
- modifiers become **opt-in run challenges** ("next run: Long Nights, +X% fallout") in the
  Clicker Heroes challenge / Realm Grinder style, reusing the `modifiers()` knobs;
- a deeper second prestige layer ("the tide", a personal transcendence) can come much later
  if the tree ever saturates; it should still be personal, not calendar-driven;
- one practical use left: the existing `pnpm season end` can serve once as the **migration
  tool** at the pivot's launch (archive season 1, convert legacy points into starting prestige
  currency as a thank-you), because old `BaseState`s cannot be normalized into the new game.

### 2.9 The legacy layer (`legacy.ts`, `legacy.json5`, D116, D117)

**What it does.**
- Kept across seasons: blueprints (union), each survivor's best level and XP (`veterans`),
  perks, titles, skins (D116).
- Points: 3 for playing, 5/3/2/1 for 1st-4th in each of six categories, up to 10 for a share
  of the Signal (`seasonPoints`). Maximum per season about 43 for a winner, about 21 + Signal
  for second place with two players.
- Eight perks costing 100 points in total (steady_hands +2% all rates/rank x3, deep_cellars
  +3% storage x3, quick_fingers +3% craft x3, hot_coals +3% smelt x3, old_maps +2 trip success
  x2, war_stories +6% XP x3, old_friend a veteran from day one, packed_crate a crate from day
  one). `buy_perk` is server-only (`World.legacy`); perks feed the one `modifiers()`
  aggregator (`modifiers.ts`), additively.
- The 25% cap: `checkLegacy` in `parse.ts` (~l.1001) sums every perk at top rank and fails
  the build above 25%; `legacy.test.ts` walks every rank combination (12,288) and holds every
  rate within 1.25x; the simulator's veteran must not beat optimal by more than 25%.

**Survives?** **Rework into the core prestige system.** Keep the plumbing, overturn the
economics:
- Keep: the per-player `legacy` row (JSON, `apps/api/src/store/schema.ts`), `carryFor` /
  `carryOver`, server-only purchases, perks feeding `modifiers()`, "options" perks (starting
  crew, starting crate are classic prestige nodes: start with X), titles and earned-only
  skins.
- Overturn: the 25% cap (prestige multipliers of x2, x10, x10^n are the genre's loop);
  points from **relative rank** (degenerate with two players, and it makes your prestige
  depend on others) must become points from **your own run** by formula (sublinear in run
  output: cube root as in Cookie Clicker heavenly chips, square root as in AdVenture
  Capitalist angels, or log); a 100-point, 8-perk tree must become a large graph (hundreds of
  nodes, branches, keystones, repeatables).
- Change `modifiers()`: today every bonus is an additive percent; a prestige tree needs
  multiplicative layers (global multiplier x per-building multiplier x milestone multiplier),
  so the aggregator needs a multiplicative channel and the "integers in state" question
  (section 4.3) must be settled first.
- Decide early whether unspent prestige currency also gives a passive bonus (AdCap angels,
  Clicker Heroes hero souls, Egg, Inc. soul eggs) or is spend-only (Cookie Clicker heavenly
  chips into the heavenly upgrades). It changes the formula, the simulator's nuke heuristic
  and the UI.

### 2.10 NPC raids, defence and bandit camps (`raids.ts`, `raids.json5`, D106-D109, D112-D113)

**What it does.** From Stone, a raid is planned only after a command when none is pending,
landing on the UTC day `planDays` (2) ahead at a seeded time in 20:00-23:00 UTC, never sooner
than 72 h after reaching Stone; warned 3 h ahead plus the watchtower's hours (D107). Strength
= tier base + 1 point per 40 scrap of value at risk, capped by tier. Hold chance = defence /
(defence + attack), clamped 10-95%. Held: loot by tier (scrap, sulfur, gunpowder, charges).
Breached: lose 5% (half the 10% cap) of each raw/refined resource and scrap up to the tier's
ceiling; building defence halved until a scrap-and-stone repair (D108). Defence = walls,
watchtower, traps, turret + guards. Bandit camps (Driftwood, Saltpan, Cinder Fort) are
repeatable sites paid in charges (D109). Pacing: first raid by day 8, casual holds 30%+ by day
28, first camp by day 16.

**Shared economy dependency: medium** (strength from `refPer100`, tier tables).
**Shared clock: high** (UTC nights, 2-day planning, 72 h after Stone).

**Survives?**
- **NPC raids as designed: rework or remove.** A raid planned two days ahead never lands in a
  run that lasts hours, and after a nuke the "72 h since Stone" timer restarts. Losing 5% of
  an exponentially growing stock is either trivial or, at the run's start, a punishment, and
  punishing absence contradicts pillar 4 of `docs/game-design.md`. If kept, make it
  incremental-native: "horde" or "boss" events tied to run milestones (Clicker Heroes boss
  zones), defence as a tree/building branch, failure delays progress or forfeits a bonus,
  never takes stock; success pays a scale-relative reward.
- **Defence buildings: rework** into whatever the event becomes, or into production/
  protection multipliers; the repair chore should go.
- **Bandit camps: keep** as PvE expedition content (they reuse the trip engine whole);
  their charge costs and loot must scale with the run. Charges and gunpowder are also a
  natural ingredient chain for **the nuke itself** (sulfur -> gunpowder -> charges -> ... ->
  the warhead), which would give the existing chain a new end-of-run purpose.

### 2.11 PvP (`raids.ts` PvP half, D106, D110, D111)

**What it does.** Opt-in from Sheet Metal; charges up front by target tier (6/10); one attack
per 24 h, same target once per 72 h, one-tier fence, 24 h shield after a breach, revenge token
(48 h, half cost, skips fence and 72 h rule), leave locked 48 h after your own raid; the take
is the full capped 10% slice of raw/refined plus scrap up to the ceiling, fitted to the
attacker's room; one transaction over two bases; property tests prove the cap and
conservation (`pvp.test.ts`, `apps/api/src/raid.test.ts`).

**Shared economy dependency: total. Shared clock: day-scale windows.**

**Survives?** **Remove.** Percent-of-stock theft between players at different exponential
scales is either worthless (early raids late: the take does not fit, or is pocket change) or
absurd (late raids early). The tier fence is meaningless when tiers are re-climbed every run,
and shields measured in hours do not map onto runs. It is the roadmap's first cut. If a
friendly interaction is wanted, use scale-free, non-destructive ones: **fallout drift** (when
you nuke, friends get a short percent boost), sending a timed boost, or co-op contracts.

### 2.12 Trip events (`events.json5`) and the event union (`events.ts`)

`events.json5` holds ambush (loot -30%, injury +50%), cache (+2 rolls), stranger (rescue), at
most two per trip, odds fixed at departure and shown on the confirm screen (D93). All effects
are percentages or roll counts, so they are **scale-free: keep**.
`packages/domain/src/events.ts` is the `GameEvent` union every command/settle returns (and
the feed, push, welcome-back and scene effects read). **Keep the pattern**; remove the Den,
PvP, Signal and season variants with their systems, add `nuked` (with points earned, run
number, run length), `milestone`, `achievement`, `clicked` (batched, see 4.2), offline-cap
events.

### 2.13 The Discord companion (`apps/discord/src`, D121-D126)

A thin client: `/base` (ephemeral card, Collect/Gather/link, advisor's one primary action),
DMs mirroring web push kinds, the feed channel (same `event_log` rows, acked cursor), season
news. `boundary.test.ts` forbids database drivers and value imports from `commands`, `settle`,
`nodes`, `missions`, `market`, `casino`, `raids` (only `raidWarned` is allowed). `home.ts`
imports `raidWarned` and `seasonDay` (from `signal.ts`) and prints the season's end.

**Survives?** **Keep the architecture unchanged.** Update the content: the card shows
production per second, offline cap fill, pending prestige ("Nuke now: +42 fallout"), the
advisor's primary action; Gather maps to a batched click burst or disappears; season news
becomes nuke/record news; remove the raid line and the season-day line if those systems go
(and the `raidWarned` allowance in `boundary.test.ts`).

---

## 3. Dependency matrix (what breaks first)

| System | `refPer100` value table | Tier ladder as cross-player scale | UTC day | Season id / day | Two bases in one transaction | `World` field |
| --- | --- | --- | --- | --- | --- | --- |
| Den counter | yes | yes (open, minTier) | yes | - | - | - |
| Contracts | yes | yes (amounts) | yes | - | - | - |
| Market | yes (floor) | yes (open) | - | rows per season | yes | `listing`, `self` |
| Casino | - | yes (limits) | yes (cap) | jackpot zeroed at reset | - | `seed`, `reveal`, `jackpot` |
| Leaderboards | yes (Wealth) | yes (Builder) | - | yes | - | - |
| Feed / push | - | - | - | feed per season | - | - |
| Signal | yes (ranking) | - | - | yes (day 21) | (shared row) | `signal` |
| Seasons / reset | - | - | - | is the clock | all bases | - |
| Legacy points | - (via ranks) | - | - | yes (end of season) | - | `legacy` |
| NPC raids | yes (strength) | yes (all tables) | yes (night window) | - | - | - |
| PvP | yes (report value) | yes (fence, cost) | rolling 24/72/48 h | - | yes | `target`, `self` |
| Trip events | - | site tier only | - | - | - | - |
| Discord | - | - | - | season day, news | - | - |

---

## 4. Cross-cutting implications for the pivot (meta and architecture)

### 4.1 The nuke as a per-player season end

The closest existing code to a prestige reset is `Game.endSeason` (D115) plus `carryFor` /
`carryOver` (`legacy.ts`). A `nuke` command fits the established shape:
- server-only (refuses `server_only` in the client like `buy_perk`, D98), because it writes the
  player's persistent row;
- one SQLite transaction: settle the base, compute the run summary and prestige gain, fold
  the run into the legacy/meta row (points, lifetime stats, blueprint fragments, achievements),
  write a run archive row, replace `state_json` with `newBase(..., carryFor(meta))`, log
  `nuked` (feed, Discord);
- idempotent by key (D59) so a double-tap on the red button cannot nuke twice or grant twice.
Schema impact: `bases` is keyed `(player_id, season_id)`; with personal runs either the row is
reset in place (simplest; add a `run` counter to the state or a column) or the key gains a run
number. Season-scoped tables (`event_log`, `listings`, `trades`, `signal*`) lose their reason
to be season-scoped once seasons go.

### 4.2 "Click like crazy" vs idempotent commands and the event log

Every mutation today is one `POST /api/commands` with a client key, stored for 7 days
(D59), one transaction, logged to `event_log` (CLAUDE.md section 4). Ten taps a second per
player cannot each be a command. The existing node game already shows the answer in
miniature (`hit_node` with a hit number the domain dedups, D59/D76). The pivot needs a
**batched click command** ("N clicks between t0 and t1", server clamps to a plausible rate,
dedups by key and sequence), client prediction for instant feedback (D64 stays essential), and
one `event_log` row per batch, not per click.

### 4.3 Exponential numbers vs "integers in state"

CLAUDE.md section 4: "Integers in state. Amounts are integers ... No floats in the database";
D19 drops sub-unit production. JavaScript numbers are exact integers only up to
2^53 (about 9.0e15). Cookie Clicker / AdVenture Capitalist / Egg, Inc. style numbers pass that
within weeks. A planning fork to settle before any code:
- **bounded scale** (Melvor-like: levels, modest numbers, prestige multipliers kept so a run
  stays under ~1e15): keeps `Amounts = Record<string, number>`, integer state, the current
  formatter;
- **unbounded scale**: a mantissa/exponent big-number type (break_infinity.js-class library),
  stored as strings or `{m, e}` in `state_json`, every `Amounts` operation, cost formula,
  content check and simulator column rewritten.
Also: D19's "drop the fraction" matters at a run's start (0.3/s rates); a fixed-point unit or
fractional carry is needed either way.

### 4.4 Automation vs lazy settling

Lazy settling (CLAUDE.md section 4, D17) integrates production between commands because rates
are piecewise constant (they only change on a command or a timer). Automation of the
AdVenture Capitalist kind (managers that keep a business running) is compatible. **Auto-buyers**
(automation that spends while you are away) break the closed form: settling would have to step
through purchases, bounded by a step limit. Plan automation as "production runs without
clicks" first; if auto-buy is wanted, design it as discrete steps in `settleAll` with a hard
cap per settle.

### 4.5 Fair comparison and catch-up

With personal exponential runs the social layer must compare players with scale-free metrics
(times, counts, logs, ratios) and give late joiners a catch-up (bigger prestige gain early in
the meta curve, or an "experienced player" fallout bonus, or co-op rewards weighted toward the
smaller contributor). The fixed `refPer100` table should shrink to whatever still prices
genuinely non-scaling goods, or disappear.

### 4.6 Prestige currency and scrap (meta point of view)

Scrap today is a run currency touched by almost every system: tools (D38, D87), scouting fees
(`regions.json5`), barrels and tasks (`active.json5`), site loot, raids (ceilings, held loot,
repairs), the whole Den and the casino. Turning scrap into the persistent prestige currency
would force a rewrite of every one of those and would put the meta layer at risk in the casino
and raids. From the meta systems' side the cleaner option is a **new** currency earned only by
the nuke formula (blueprint fragments, fallout, isotopes: owner names it), with hard rules:
never tradeable, never wagered, never at risk, never sold by the Den. Scrap can stay a rarer
run currency for special purchases.

---

## 5. Decisions: what the pivot overturns, modifies, keeps

Legend: **OVERTURN** (the decision's core no longer holds), **MODIFY** (keep the intent or
mechanism, change parameters or scope), **KEEP**, **HIST** (bot-era or superseded, no effect).

### 5.1 OVERTURN

| D | Gist | Why it falls |
| --- | --- | --- |
| D17 | Collect banks accrual; Gather is a cooldown active bonus | Incremental: clicking produces directly; production auto-banks; a gather cooldown contradicts "click like crazy" |
| D25 | Season-day targets are the pacing gate | Pacing becomes run-time and prestige-curve targets |
| D26 | Per-resource storage caps (check-in driver) | Exponential stocks; replace by an offline-window cap (silo-style) and/or capacity as an upgrade |
| D27 | Upkeep paid hourly; decay after unpaid hours | Punishes absence; incrementals have no decay (pillar 4 agrees) |
| D28 | Tier upgrades on 4 h / 12 h / 24 h timers | Tiers are re-climbed every run in minutes-hours |
| D33 | Wood base cannot afford Stone without boxes | Tied to per-resource caps |
| D63 | Daily node haul caps active play (180 min, then 10%) | Directly opposes "click like crazy"; click value should scale as a share of production instead |
| D72 | Decay takes the dearest building first | Decay removed |
| D91 | Tired after 16 h, half pace until a tap rests them | Maintenance chore that punishes idling |
| D99 | Market escrow, sale over two bases | Market removed (pattern kept for co-op) |
| D104 | W5 balance: Den as the scrap sink | Economy re-argued from scratch |
| D106 | What a raid can take: capped 10% slice | Raids no longer take stock (or are removed) |
| D107 | NPC raids planned 2 UTC days ahead, land 20-23 UTC | Wall-clock scheduling vs short runs |
| D110 | PvP opt-in, instant, two-base transaction | PvP removed |
| D112 | W6 balance targets | Systems removed or reworked |
| D114 | A season ends by owner command; announced | No forced calendar reset (optionally a leaderboard window only) |
| D117 | Legacy perks capped at 25%, points from ranks, 8 perks / 100 points | The tree is the core; multipliers far beyond 25%; points from own run |
| D119 | The Signal: shared absolute stages, season day 21 | Not scale-free; replace by co-op contracts or a nuke counter |

### 5.2 MODIFY

| D | Gist | What changes |
| --- | --- | --- |
| D19 | Sub-unit production dropped on collect | Needs fractional carry / fixed-point at low early rates |
| D24, D38, D62, D87, D97 | Content-specific balance (tool gating, scrap prices, fat->fuel stopgap, tool `minTier`, crew 15%) | Re-tuned for the new curve |
| D29 | Fuel burned up front; furnace job takes all ore | Furnaces become automated lines (hoppers, design 5.2) |
| D34, D48, D76 | Node marker reaction game; fixed tap size; node wear | The clicking mini-game becomes central and endless-ish; keep fixed tap targets |
| D36 | Barrels on a fixed schedule | Keep the idea (golden-cookie analogue) at minutes scale, rewards relative to the run |
| D37 | Daily tasks, same for everyone per UTC day | Fine as a login hook; rewards must be run-relative or prestige-neutral |
| D45 | Five phone dock actions | Rule stays; contents change (Buy, Upgrades, Tree, Map, Nuke?) |
| D59 | Idempotent commands by client key | Keep, add batched click commands |
| D61 | One `BaseState` JSON per player per season | Becomes per run; persistent meta in the legacy row |
| D69 | Buildings: 3 levels, additive effects, one `modifiers()` | Many levels with exponential costs and milestone multipliers; multiplicative channel |
| D71 | Builder slots, construction timers | Purchases instant or short; timers only for check-in content |
| D74, D82 | Simulator planner policies | Rewritten for runs and nukes |
| D77, D78, D83 | Parts, station queues, recipe browser | Chains stay (Melvor-like depth); queues become continuous automated throughput |
| D79 | Blueprints for extras, found | Blueprint fragments become a persistent unlock currency (owner's idea) |
| D80 | Meals as timed boosts | Timed buffs fit ("frenzy"); keep |
| D84, D90, D92 | Crew with traits, jobs at home, bonds | Crew as automation (AdCap managers); levels persistent through the tree or per run |
| D85, D95 | One island per season with per-player fog; far north/sea gates with 24 h timers | Island per run (fog resets on nuke) or partly persistent via the tree; 24 h gates too long for runs |
| D96, D111 | Feed and push kinds; raid notifications | New kinds (nuke, records, offline cap full), drop PvP/sale |
| D100 | Den counter and contracts priced from one table | Run-relative shop; scale-relative or co-op contracts |
| D101, D102 | Casino odds/limits/jackpot; global wheel rounds | Keep odds engine and RTP checks; limits relative to run; jackpot per player or scale-free; never prestige currency |
| D103 | Leaderboards from counters in the base | Scale-fair categories; lifetime stats moved off the base |
| D105 | Den as a skiff on the beach, flag on the map | Placement follows whatever the shop becomes |
| D108, D109, D113 | Defence score and repair; charges and bandit camps; defence UI | Rework or drop defence; camps stay; charges may feed the nuke chain |
| D115 | Season reset: one transaction after a backup, fold into legacy | Template for the per-player nuke (no backup per nuke, same transaction shape) |
| D116 | Kept across seasons: blueprints, crew levels, perks, titles, skins | Kept across nukes: prestige currency, tree, fragments, achievements, cosmetics, maybe crew levels |
| D118 | One modifier per season | Opt-in run challenges for extra prestige |
| D120 | Season-over card, Legacy and Hall of fame tabs | "After the blast" card: points gained, what carried over, "Begin run N", "Spend points" |
| D125 | `/base` private phone card | Card shows production/s, offline fill, pending prestige |
| D67, D89 | Advisor fallbacks; map advice from Timber | Advisor concept stays (best next buy); rules rewritten |

### 5.3 KEEP (must survive the pivot)

| D | Gist |
| --- | --- |
| D1, D2 | better-sqlite3 12.x pinned (prebuilt binaries); Node 24 dev, engines >= 22 |
| D3, D7, D11, D13, D23 | Bot rendering stack (satori without React), bundled Roboto Condensed, locked-label lint, guild commands, name glyph stripping |
| D14 | Balance numbers in data, never in code |
| D15 | Show only what the player has discovered (incrementals reveal the same way) |
| D21 | The hint and the primary button are one decision |
| D40 | Web is the main client, Discord the companion |
| D41, D42, D46, D47, D75 | Procedural flat-vector art (owner's SVG icons slot in), shore stage, screen-space text (floating `+delta` from clicks), lights above the night tint (the nuke flash), fixed building spots (the base tells the story, the nuke flattens it) |
| D43 | Own names and world; nothing from another game |
| D44 | Headless screenshot review loop |
| D49, D50, D58, D66 | Monorepo with source exports; tier ids and Locale in content; Hono; Vite JSON5 plugin with the same `parseContent` |
| D51 | One injected `Clock`; domain takes a plain `now` (offline progress depends on it) |
| D52, D53/D68, D54 | SQLite + drizzle with the API as the only writer; one container behind the owner's Caddy; nightly backups |
| D56 | The pacing check runs inside `pnpm test` (mechanism kept, targets replaced) |
| D59 | Idempotent commands (extended, not dropped) |
| D60, D122 | Discord login; one-time login links |
| D64, D65 | Client prediction with the same domain; demo mode runs the real rules |
| D70 | Stations are buildings |
| D73 | `normalizeState` on load (though the pivot itself is a clean break) |
| D81 | The content validator guards the crafting web |
| D86, D93, D94 | Seeded lazy trips; trip events fixed at departure and shown; keycodes with pity |
| D88 | Full-screen map |
| D98 | `World`: server-only commands (the nuke and tree purchases need it) |
| D121, D123, D124, D126 | Bot as an API client; DMs mirroring push; feed channel from the same event with an acked cursor; bot container profile |

### 5.4 HIST (bot-era or already superseded; no effect)

D4, D5, D6, D8, D9, D10, D12, D16, D18 (superseded by D26), D20 (by D125), D22, D30 (by D78),
D31, D32, D35, D39, D55, D57.

### 5.5 CLAUDE.md principles that are not D numbers

- Section 4 "Integers in state": **MODIFY or KEEP by design choice** (section 4.3 above).
- Section 4 "Every state change is logged to `event_log`": **KEEP** with batched clicks.
- Section 4 "No per-second server simulation, lazy settling": **KEEP**, with the auto-buyer
  caveat (4.4).
- Section 1 "once a month the tide resets everything except what they learned": **OVERTURN**
  (personal nuke).
- Section 9 archetypes "casual, active, optimal, gambler and the raider": **MODIFY** (section 6).
- Section 10 invariant tests "market cannot create resources (W5), raided player never loses
  more than the cap (W6), season reset keeps exactly the legacy layer (W7)": the first two go
  with their systems; the third becomes "a nuke keeps exactly the meta layer and grants
  exactly the formula's points" (snapshot + property test).

---

## 6. The simulator

### 6.1 What it is today (`packages/sim/src/sim.ts`, `cli.ts`, `rtp.ts`, tests)

- **Archetypes** (`ARCHETYPES`): `casual` (check-ins at 8, 13, 21 h), `active` (7, 9, 12, 15,
  17, 19, 21, 23 h; perfect node runs), `optimal` (every hour), `gambler` (casual schedule,
  plays slots/dice at max bet up to the daily cap), `raider` (active schedule, joins PvP,
  strikes a casual target at every allowed check-in via `simulatePair`), `veteran` (optimal
  hourly in "season 2" with every perk at top rank, every blueprint, crew level 5,
  `veteranCarry`). Default horizon 35 days, deterministic seeds, manual clock.
- **Policy per check-in** (`checkIn`): collect, join PvP if raider, serve best meal, gather,
  node run (non-casual), barrel, take out furnace; a spend loop (tier, repair, tool, furnace,
  workbench, cheapest other building after reserving half/all of the next tier's cost, parts
  for goals, meals, gear once, crates above 70% fill); charges up to the dearest camp; feed the
  Signal from surplus; expeditions (gear, treat, one scout, parties to the best site with >=
  50% success, rations); jobs (guard when an announced raid's hold chance < 80%, cook/tinkerer
  to stations, the rest on the node the next tier lacks most, rest the tired); the Den
  (deliver surplus contracts, buy parts the next goal lacks, comforts, gambler bets); smelt.
  A `house` object stands in for the server (casino seed and jackpot, the Signal).
- **Assertions** (`checkPacing`, `pacing.json5`; run in `pnpm test` by `sim.test.ts`, D56):
  1. Veteran: Armored not before day 14, Offshore Platform not before day 18, metal/Armored
     not more than 25% faster than optimal.
  2. Casual fills at least 1 Signal stage.
  3. Casual's first NPC raid by day 8; holds at least 30% by day 28; first bandit camp by
     day 16.
  4. Raider gets in at least 3 times; the raided casual reaches Armored by day 28.
  5. Casual holds 800-4,000 scrap on day 28; gambler's scrap never negative; no day's wagers
     above the tier cap; the gambler played.
  6. Casual tier windows: Stone day 3-4, Sheet Metal 12-14, Armored 15-28.
  7. Casual has 6+ buildings on day 7; first made planks 2, bow 4, leather 9, plates 10,
     springs 18; every station worked by day 14; first trip by day 2; tier-3 site by 14,
     tier-4 by 26, tier-5 by 31; 5 crew on day 10; Salvaged Tools by day 18; first job by
     day 3.
  8. Optimal: Offshore Platform not before day 18, tier-3 site not before day 7, Armored not
     before day 14.
  9. Tier cost ratio 3-6x in resource-hours: **warning only** (D25).
  Plus determinism (`sim.test.ts`, 7 days, every archetype), and the casino: every bet option
  within 1 point of its exact return over 1,000,000 rounds, exact returns inside 90-95%,
  slots jackpots 100-220 per million (`rtp.test.ts`).
- **Not asserted:** the "8 check-ins about 1.6x, never more" guardrail. `checkPacing` never
  runs the `active` archetype; D63 reports 1.35x from output only. If the pivot keeps any
  form of that guardrail, it must become an actual assertion.

### 6.2 What it needs to argue balance for an incremental game

The day-and-season frame (`SEASON_START`, 35 days, season-day targets) has to become a
**lifetime of runs**:

- **Multi-run loop.** The runner already supports `newBase(content, start, seed, carry)`; a
  lifetime sim plays a run, applies the archetype's nuke rule, folds the run into the meta
  state (the same `carryOver`-style function the server uses), starts the next base with
  `carryFor`, and repeats over 30 / 90 / 180 days.
- **Nuke timing rules per archetype.** Casual: nuke when pending prestige >= current total
  (doubling) or at the next check-in after that; optimal: nuke when prestige per hour of run
  peaks (pending / run time starts falling), the standard optimal-prestige heuristic; idle:
  only at a check-in. The sim must also report the sensitivity (how much worse a naive rule is).
- **Clicking.** Archetypes need a click model: clicks per second during an active session
  and session length (e.g. 2 minutes at 6 cps per check-in for casual, 10 minutes for
  active), applied as batched click commands like the client will send.
- **Archetypes to add or change.** `idler` (2-3 check-ins, never clicks), `clicker` (short
  frequent sessions, heavy clicking), `optimal` (hourly, best nuke timing), `late_joiner`
  (starts on day 30 against a day-30 casual's curve), a co-op pair if co-op contracts exist,
  `gambler` only if the casino survives. `raider` goes with PvP; `veteran` is replaced by the
  lifetime loop itself.
- **Metrics and candidate assertions** (`pacing.json5` v2, numbers to be argued from runs):
  - time to first nuke per archetype (e.g. casual in 2-4 days, active 1-2 days, optimal not
    under ~12 h of play);
  - replay speed: run N+1 reaches run N's peak production in at most X% of run N's time;
  - prestige growth: points per run and the total multiplier per run, with a target band
    (no walls: the gain of run N+1 never below Y% of run N's; no runaway: diminishing per-run
    multiplier growth);
  - upgrade cadence ("one more upgrade"): in a fresh run, an affordable purchase at least every
    15-30 s while clicking in the first 10 minutes; never more than N minutes online with
    nothing to buy; something to buy at every casual check-in;
  - click share arc: clicking provides most production in the first minutes of a run and
    under 10-20% after automation (the "click to get moving, then automate" promise);
  - offline efficiency: offline gains >= Z% of the online idle rate up to the offline cap;
  - archetype gaps (replacing the 1.6x rule): lifetime prestige at day 30 and 90, e.g. active
    <= 2x casual, optimal <= 3x casual, idler >= 0.5x casual;
  - late-joiner catch-up: reaches the day-30 casual's prestige total within K days;
  - tree horizon: optimal owns at most P% of the tree by day 30, the full tree not before
    day 90-180 (the "massive tree" has to last);
  - number range: the peak value stays inside the representation chosen in 4.3;
  - determinism, as today.
- **Performance.** Lazy settling keeps long horizons cheap as long as rates are piecewise
  constant; per-second auto-buyers would make the sim step through time (see 4.4).
- **RTP** (`rtp.ts`) survives unchanged if the casino stays: it is scale-free.

---

## 7. Guardrails: CLAUDE.md section 8, game-design section 2, CLAUDE.md 6.3 rule 9

| Guardrail | Where | Pivot verdict | Why / replacement |
| --- | --- | --- | --- |
| 3 check-ins a day make steady progress | CLAUDE.md 8, game-design 2 | **Keep (as a floor)** | Becomes "offline/idle progress is meaningful": offline earnings, offline cap, welcome-back summary |
| 8 check-ins a day about 1.6x faster, never more | CLAUDE.md 8, game-design 2 | **Fundamentally incompatible** in its per-day form | "Click like crazy" and prestige timing reward activity; prestige compounds the gap. Replace with a lifetime-gap band (e.g. active <= 2x, optimal <= 3x casual at day 30/90), a sublinear prestige formula, and catch-up. Note it was never asserted in `checkPacing` |
| Storage caps drive check-ins; a cap stops accrual, never destroys | CLAUDE.md 8, game-design 2 | **Modify** | Per-resource caps fight exponential stocks; keep the function with an offline-window cap (silo-style hours) and keep "never destroys" |
| Randomness bounded and visible: EV before risky actions, jackpots announced, no hidden odds | CLAUDE.md 8, game-design 2 | **Keep** | Scale-free; applies to golden-barrel style events, casino, trips |
| Casino scrap only, 5-10% edge, max bet by tier, daily wager cap, RTP within 1% over 1M spins | CLAUDE.md 8 | **Modify** | Edge and RTP checks keep; "by tier" becomes run-relative; currency never the prestige currency |
| PvP friendly and capped (charges, 10%, shields, 1/day, 72 h, one-tier fence, revenge, opt-out) | CLAUDE.md 8, game-design 5.9 | **Incompatible** (cross-scale, tier fence meaningless) | Remove PvP; non-destructive friend interactions instead |
| Legacy never more than 25% stronger in any rate | CLAUDE.md 8, game-design 5.12, D117 | **Fundamentally incompatible** | Prestige multipliers are the genre; replace with sim-asserted curve bands and catch-up |
| Optimal cannot reach the top tier before day 14 or the last site before day 18 | CLAUDE.md 8, `pacing.json5 optimal` | **Fundamentally incompatible** (season-day floors in a run game) | Replace with run-time floors (first nuke not under N hours) and tree-horizon floors |
| No timer shorter than 10 minutes except active mini-games; none longer than 24 h except season projects | game-design 2 | **Lower bound incompatible** for production cycles | Early production cycles are seconds (AdVenture Capitalist style). Keep 10 min-24 h for check-in content (expeditions, research, long crafts); drop "season projects" |
| Active-play timers are real seconds to a couple of minutes, never game hours, never sped by the demo clock | CLAUDE.md 6.3 rule 9, owner memory | **Keep** | Matches clicking and short cycles |
| Welcome back after hours with one summary and one collect action; catch-up bonus | CLAUDE.md 6.3 rule 10, game-design 2 | **Keep** | "While you were away: +1.2M" is the genre's core screen |
| Every unlock revealed when affordable, one-line hint gone after two uses | CLAUDE.md 6.3 rule 6, game-design 2 | **Keep** | Incrementals reveal the same way |
| Notifications opt-in per type | CLAUDE.md 6.3 rule 11, game-design 2 | **Keep** | New kinds, same rule |
| Losing never removes progress permanently within the season; nothing punishes a day away beyond full storage | game-design 1 pillar 4, game-design 2 | **Keep (strengthen)** | The nuke is voluntary; argues for removing decay (D27/D72), tiredness (D91), raid losses |
| A monthly reset of everything except the legacy | CLAUDE.md 1, game-design 1, 5.12 | **Overturn** | The personal nuke replaces it |

---

## 8. Recommendations from the meta side (for the plan)

1. **Remove seasons as a forced wipe.** Keep, at most, a monthly leaderboard/cosmetic window
   with titles and a hall of fame that resets nobody. Use `pnpm season end` once as the
   migration at the pivot's launch (archive season 1, convert legacy points into a starting
   gift of the new prestige currency).
2. **Remove PvP, the player market and the Signal.** They are the systems most tied to a
   shared absolute economy, and the roadmap already ranks PvP and the market as the first
   cuts.
3. **Make the legacy row the prestige system.** Keep its plumbing (server-only buys, carry,
   options perks, titles, earned skins), drop the 25% cap and rank-based points, add a
   multiplicative channel to `modifiers()`, decide spend-only vs passive-bonus currency.
4. **Implement the nuke as a per-player version of `endSeason`** in one idempotent,
   server-only transaction, with a snapshot test "a nuke keeps exactly the meta layer and
   grants exactly the formula's points".
5. **Introduce a new prestige currency rather than repurposing scrap**; it is never traded,
   wagered, stolen or sold.
6. **Social layer that survives scale divergence:** the feed (nukes, records, milestones),
   scale-fair leaderboards (fastest run, nukes, lifetime prestige, tree size), co-op
   contracts with normalized contributions, a shared nuke counter or "fallout drift" boost to
   friends, Discord news. All are counts, times or ratios, never absolute amounts.
7. **Settle the number representation (4.3) and the click transport (4.2) before any UI
   work**; both reach into `Amounts`, commands, `event_log`, the formatter and the sim.
8. **Rewrite `pacing.json5` and `checkPacing` around runs** (section 6.2) before tuning
   content, and make the archetype-gap guardrail an actual assertion this time.
9. **Rework or park the casino** (keep the odds engine, RTP test and wheel rounds; make limits
   run-relative; per-player or scale-free jackpot).
10. **NPC raids:** remove, or turn into milestone-driven boss/horde events that never take
    stock; keep bandit camps as expedition content; consider charges as part of the warhead
    chain for the nuke.

## 9. Open questions for the owner (meta-related)

1. Bounded numbers (Melvor-like) or unbounded exponential numbers (Cookie Clicker / AdCap /
   Egg, Inc.)? It decides the integer rule and much of the rewrite.
2. Prestige currency: spend-only into the tree, or does unspent currency also boost
   production?
3. Keep any monthly rhythm (leaderboard window, monthly titles, challenge of the month), or
   none?
4. Any friend-versus-friend interaction wanted at all (fallout drift, gifts, co-op contracts),
   or purely parallel solo play with a shared feed?
5. Casino now, later, or never?
6. The live season 1 (started 2026-10-07, two players): wipe at the pivot with a thank-you
   conversion of legacy points, or let it finish first?
