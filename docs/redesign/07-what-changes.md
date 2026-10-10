# 07. What changes, what stays, what goes

Status: a proposal for the owner, 2026-10-07. It expands `canon.md`, the orchestrator's
amendments and the design director's resolutions (canon v2), and never contradicts them. Nothing
in `CLAUDE.md`, `docs/game-design.md`, `docs/roadmap.md` or `docs/decisions.md` changes until the
owner approves; that rewrite is R0's first job. Names marked *(proposal)* wait for the owner's
naming pass. Paths are relative to the repo at `58533e4`; line counts come from `wc -l` at that
commit.

---

## 1. The big decision: one run currency, or Rust-style materials

This is decision 0. Every other section assumes its answer, so settle it first.

**The plan recommends one run currency: Supplies.** Each line sells what it makes as supplies.
Timber, stone, ore and parts stop being things you hold and spend. What a line makes stays
visible: every line has a **product** (amendment A1), drawn in the scene each cycle, shown as a
badge on its shop row and riding on the floater that flies into the counter ("+1.2k" with the
ingot icon). Products are never stocked or spent.

| | One currency (recommended) | Rust-style materials |
| --- | --- | --- |
| Phone at 390 px | One big number with `/s` under it | Several counters, or a strip that hides some |
| First ten minutes | "Tap the tree", buy, hire; no text (`02-the-run.md`) | Each material needs a source and a reason to learn |
| The buy decision | Best payback across 14 lines | That, plus "which material am I short of" |
| Rust feel | Tier ladder, gather verb, scrap, the wipe; products drawn and voiced | Strongest: piles you chopped yourself |
| Engine | One `Amount` per run, closed-form settle | One per material in settle, prediction, refusals, taps |
| Nuke formula | Lifetime supplies, one number | A value table to sum materials (today's `refPer100`) |
| Simulator | One curve per line | A curve per material, plus bottlenecks |

The honest trade: one currency gives up the pleasure of counting a pile of stone. The plan pays
it back with drawn products, a sound per line, the era ladder and the five tap targets. If R1's
screenshots read as "a number going up in a Rust skin" (canon section 19), the fallback can
still be added in R1.

**Fallback if you want materials: era materials** *(proposal)*

- Four materials, all existing ids: `timber`, `stone`, `ingots`, `plates`.
- Each gates one era purchase only: Timber costs supplies plus timber, Stone needs stone, Sheet
  Metal ingots, Armored plates. Nothing else ever costs a material: no ratios, chains or recipes.
- Felling the current target drops the next era's material; manned lines trickle it slowly, so
  an idler is never stuck.
- One small counter under Supplies, shown only while the next era needs it ("Stone 340 / 2k").
  Lost on every nuke.
- **Cost:** about +0.5 session in R0 (a second run amount, the simulator's material model) and
  +1 in R1 (data, drops, two-currency era rows, the counter, refusals, shots), plus a small tax
  on every later phase (Blast Map nodes, flotsam, Dares, the bot card and welcome back each gain
  a material line). Friends would play at about session 14 instead of 12. New assertions: era
  times per archetype, and "an idler never waits more than 2 h for a material" *(sim)*.
- It does not bring back the crafting web, 23 goods, storage caps or trading. Proposal D's full
  model (18 materials with converters) was judged below A: it keeps the check-in process and
  makes settle non-linear.

---

## 2. The direct answers

### 2.1 Seasons: remove the reset

- **No monthly wipe.** The nuke is the only reset, and each player chooses when.
- **What remains:** one season row forever (no SQL; nothing ends it). "Month" survives as a board
  window in the Hall, resetting nobody. Season 1 is archived as "the old world" with its winners
  and titles. The four modifiers return as Dares with the same ids (R7). The Signal goes; its
  spot on the slope becomes the Kettle's pad.
- **Why:** two resets fight for one emotion. A monthly wipe would either take the Blast Map,
  which is meant to last months (N15), or only the run, which players wipe themselves. A calendar
  also punishes whoever joins late, the opposite of Late Tide.
- If the tree ever saturates, the second layer is personal too: the Crossing (canon section 9).
  When it is built is the late-wall decision before R7 (section 10, decision 21).

### 2.2 "Remove other stuff": the cut list

| Cut | Why |
| --- | --- |
| Gather and its cooldown; the daily node haul | The tap replaces Gather; the token bucket caps taps |
| Storage caps; upkeep and decay | The Night Shift window drives check-ins; nothing punishes absence |
| Construction timers and builders | Purchases are instant; runs last hours |
| 23 resources | One run currency (section 1) |
| Crafting web, blueprints, items | Ratio homework; stations live on as lines, the Blast Map is what you keep |
| Crew needs: arrivals, levels, tiredness, injuries, gear, bonds | Chores; a hand simply runs its line |
| Expeditions and the map (parked) | A second time scale against "one glance"; may return as a sea layer |
| Daily tasks | The Logbook and the Magnet are the daily pull |
| Den counter, contracts, player market | Absolute prices and goods mean nothing across exponential scales; the Freighter takes the social job |
| Casino | A rare currency is never gambled (guardrail 8) |
| NPC raids, defence, bandit camps, PvP | Raids planned days out never land in hour-long runs; losses punish absence; theft across scales is absurd |
| Monthly seasons, the Signal, the 25% legacy cap | Section 2.1; prestige needs ×2 to ×10^n, so simulator bands replace the cap |

### 2.3 Scrap: rare

- Scrap leaves the run. It becomes a persistent currency in small integers, about 1-2 a day,
  never lost on a nuke, never traded, gifted, wagered, stolen or sold.
- **Sources:** the Magnet (one haul a day; sure from 23 h, 10% rich at 2-3; "haul early" from
  20 h at a shown 50%), Sealed Locker flotsam (1%, errata E15), +1 per 25 Logbook pages, the
  Freighter (at most 3 a week) and 3 for the first Wipe Day. Recorded in `meta` from R2; the chip shows
  from R5, with its sinks.
- **Sinks:** crew ranks (1, 2, 4, 8, 16 per hand, each ×2, rising together; 434 to max all 14,
  about 7-9 months) and three Pocket slots (5, 15, 40; slot 1 from Wipe Day #2, slots 2 and 3
  through Scrapyard nodes). Nothing else.
- **Asserted (N19):** casual 0.8-2 a day, at least 25 by day 30, never above 2.5 a day; "a day"
  is a 7-day average from day 2, one-offs excluded. The averages are asserted; a single 7-day
  window outside the band is a warning (errata E15).
- Today a casual player holds 800-4,000 scrap on day 28 (`pacing.json5`). The new scale is "7 in
  your pocket is a real choice". Details: `05-meta-layers.md`.

### 2.4 The nuke currency: Crater Glass

- **Crater Glass** (`glass`) is sand fused by the blast. *Glass ever* is never spent and drives
  Glow (`1 + 0.25√G`); *glass held* buys Blast Map nodes. Spending never lowers Glow.
- **Shape:** the glass level `G(L) = floor((L / 5e5)^(1/5))` over lifetime supplies, so 10 glass
  needs 50B supplies made and doubling glass takes 32× the lifetime. A nuke pays
  `(G(L) − level) × glass multipliers` (Bigger Payload, Late Tide) into ever and held
  (`03-the-big-red.md`, `10-balance.md`). Granted glass goes to held only and never
  moves Glow. Never traded, gifted, wagered, sold or at risk.
- **Wipe Day or small blast:** a nuke that adds at least 10% to glass ever is a counted Wipe Day
  (news, Blowback, the agenda, the counters); one below that is a small blast that pays its glass
  quietly. The cover card says which.
- **Why not "Blueprint Fragments":** a Rust item (D43: own world), and "blueprint" promises
  crafting, which is cut. Glass is what the button physically makes, in one word on a chip.

---

## 3. Systems disposition

Verdicts: **Keep**; **Rework** (same ids, new rules); **Remove** (deleted on the `redesign`
branch, history behind the `pre-redesign` tag); **Park** (deleted from the build, recorded as a
candidate to return). `main` keeps everything until the cut-over (section 9). Paths drop the
`packages/` and `apps/` prefixes.

### 3.1 The run

| System (decisions) | Verdict | Replaced by | Code |
| --- | --- | --- | --- |
| Accrual and Collect (D17, D19) | Rework | Auto-banking; Collect only on welcome back, running the Foreman's pass | `domain/src/base.ts` `accrued`, `collect` → closed-form `settle.ts` (`09-architecture.md`) |
| Gather and its cooldown | Remove | The tap | `base.ts` l.517-532; gather fields in `tools.json5`; GA/CO in `web/src/hud/Dock.tsx` |
| Node mini-game, marker, wear (D34, D76) | Rework | One era target that fells after 40-120 taps | `domain/src/nodes.ts`, `nodes.json5`, `nodes.test.ts` deleted; tree and rock fall and regrow art in `web/src/scene/nodes.ts` reused |
| Daily node haul (D63) | Remove | Token bucket, 15/s, burst 45 (N10) | `nodes.ts` `haulLeft`; haul fields in `active.json5` |
| Tools, 5 | Rework | Grip, same ids | `tools.json5` kept and reshaped |
| Base tiers, 5 | Rework | Eras re-climbed every run, same ids and colours | `base_tiers.json5` → `eras.json5`; `content/src/tiers.ts` and tier art in `scene/base.ts` kept |
| Buildings, 18 × 3 levels (D69, D70) | Rework | 11 lines redrawn at 1, 25, 100 owned; warehouse, bunkhouse, lights as props; 4 defences go | `buildings.json5` → `lines.json5`; `scene/buildings.ts` keeps 13 drawings, loses 4 (the furnace is drawn in `scene/base.ts`); `domain/src/buildings.ts` deleted; `hud/panels/Build.tsx` → the shop drawer |
| Construction, builders (D28, D71) | Remove | Instant purchases | `buildings.ts`; `base.ts` `settleConstruction` |
| Upkeep and decay (D27, D72) | Remove | Nothing | `base.ts` `upkeepOf` and the upkeep half of `settle` (l.428-461, 591-656); upkeep in `base_tiers.json5` |
| Storage caps, crates (D18, D26, D33) | Remove | Night Shift window, 12-48 h | `base.ts` `storageCap`, `clampToCap`; `goods.ts` |
| Resources, 23 (D62) | Remove | Supplies; rare scrap; product badges (A1) | `resources.json5` slimmed to the currencies and the 14 product ids (locale keys and icons survive); the tiles in `content/src/look.ts` stay the icon fallback |
| Furnaces and types (D29) | Rework | The Furnace is line 7 | `furnaces.json5`, `base.ts` l.694-800, `hud/panels/Furnace.tsx` deleted; drawing kept |
| Barrels (D36) | Rework | Flotsam every 4-10 min, 13 s afloat | Barrel half of `domain/src/active.ts` → `flotsam.json5` and a module; the barrel drawing as the Fuel Drum *(proposal)* |
| Daily tasks (D37) | Remove | Logbook, Magnet | Task half of `active.ts`; `hud/panels/Tasks.tsx` |
| Advisor, hints (D21, D67) | Keep, new rules | Canon 12.5's first-match list; one crown per view (section 5.1) | `domain/src/advisor.ts` rewritten; `HINT_RETIRE_AFTER` kept |
| Welcome back | Keep, central | One card, one Collect | `hud/AwayModal.tsx`; the summary in `/api/state` |
| Weather, day and night | Keep, as domain data | Rain: flotsam ×1.5, server-checked; ash in Afterglow | New `island.json5` (UTC offset +1, no daylight saving, errata E9; 30-minute weather blocks); `scene/sky.ts` draws it; the client-only `setWeather` in `store.ts` becomes a demo override |

### 3.2 Crafting, items, crew and the map

| System (decisions) | Verdict | Replaced by | Code |
| --- | --- | --- | --- |
| Crafting web: stations, queues, parts, salvage, recipe browser (D77, D78, D81-D83) | Remove | Stations as lines; chains only as a later island trait | `craft.ts`, `recipes.ts`, `craft.test.ts`, `recipes.json5`, `crafting.json5`, `hud/panels/Craft.tsx`, `scene/station.ts`; crafting checks in `content/src/parse.ts` |
| Blueprints (D79) | Remove | Blast Map; Pockets | `recipes.ts` l.149-183 and every blueprint roll |
| Items (D80) | Remove | Crate art → Drift Crate; `roast` → Campfire's product badge | `items.json5`, `hud/panels/Inventory.tsx` |
| Crew: arrivals, levels, jobs, tiredness, gear, bonds (D84, D90-D92) | Rework | Hands, one per line; ranks bought with scrap; traits per owner decision 19 | `crew.json5` slimmed to the 14 hand ids (adds `gus`, `vera`); `domain/src/crew.ts` rewritten; `jobs.ts`, `jobs.test.ts` deleted; `traits.json5` waits; `hud/panels/Squad.tsx` → Crew panel; `scene/actors.ts` kept (hands walk to their lines) |
| Expeditions: fog, sites, regions, keycodes, trip events, report cards, the map (D85-D95) | Park | A possible sea layer after R6 | `missions.ts`, `missions.test.ts`, `expeditions.test.ts`, `sites.json5`, `regions.json5`, `events.json5`, `web/src/map/MapView.ts`, `hud/panels/MapPanel.tsx`, `hud/ReportCard.tsx` |

### 3.3 The Den, raids and PvP (all Remove)

| System (decisions) | Replaced by | Code |
| --- | --- | --- |
| Den counter (D100, D105) | The skiff stays as the Upgrades shelf's home | `den.ts`, `den.test.ts`, `den.json5`, `api/src/den.ts`, `hud/panels/Den.tsx`; skiff in `scene/den.ts` reworked |
| Contracts (D100) | The Freighter (`06-friends.md`) | `contracts.ts` |
| Player market (D99) | Nothing | `market.ts`, `market.test.ts`; tables `listings`, `trades`; `/api/den`, `/api/den/history` |
| Casino, RTP tests (D101, D102) | Flotsam is the bounded luck | `casino.ts`, `content/src/odds.ts`, `hud/panels/Games.tsx`, `sim/src/rtp.ts`, `rtp.test.ts`, `api/src/den.test.ts`; table `wheel_bets`, setting `jackpot` |
| NPC raids, defence (D106-D108, D112, D113) | Nothing; absence never hurts | `raids.ts`, `raids.json5`, `raids.test.ts`, `hud/panels/Defence.tsx`, `hud/RaidAlert.tsx`, `scene/raids.ts`, `api/src/raid.test.ts` |
| Bandit camps, charges (D109) | Nothing | Camp rows in `sites.json5`; camp checks in `parse.ts` |
| PvP (D110, D111) | Blowback, which only gives | PvP half of `raids.ts`; `pvp.test.ts` |

### 3.4 Seasons, legacy and the social layer

| System (decisions) | Verdict | Replaced by | Code |
| --- | --- | --- | --- |
| Monthly seasons, reset (D114, D115) | Remove | One perpetual row; `season end` once at the cut-over, from the old build | `api/src/game.ts` `endSeason` (l.910-1018) is the template for `nuke`; `season-cli.ts`, `season.test.ts`, `/api/admin/season/*` deleted on `redesign` |
| Season modifiers (D118) | Rework | Dares, same ids (R7) | `seasons.json5` → `dares.json5` |
| The Signal (D119) | Remove | Island Count; the Kettle takes its spot | `signal.ts`, `scene/signal.ts`, `hud/panels/Signal.tsx`; tables `signal`, `signal_gifts` |
| Legacy points, perks, 25% cap (D116, D117) | Rework | Blast Map and `state.meta`; perk ids become node ids | `legacy.ts` → `meta` and `nuke`; `legacy.json5` → `blastmap.json5`; `legacy.test.ts` and `checkLegacy` (`parse.ts` l.1001-1046) give way to effect-bound tests; `api/src/legacyStore.ts` reworked |
| Season-over card, Legacy and Hall tabs (D120) | Rework | The postcard; the Hall keeps season 1 and monthly boards | `hud/SeasonOver.tsx`, `hud/panels/Legacy.tsx` |
| Leaderboards, stats (D103) | Rework | Scale-free boards; lifetime stats in `meta` | `leaderboard.ts` (ties kept), `stats.ts`, `hud/panels/Ranks.tsx`, `/api/ranks` |
| Skins and titles | Keep | Plus Founder, Island Count, pennant | Skins leave `legacy.json5`; the `legacy` table keeps titles |
| Feed, Web Push (D96, D111) | Keep | New kinds; feed lines never name a secret; only "Night Shift over" on by default; quiet hours 22:00-08:00 on by default, a row in Settings (errata E19) | `feed.ts` `NOTIFY_KINDS`, `api/src/push.ts`, `hud/panels/Feed.tsx` |
| Discord companion (D121-D126) | Keep the architecture | Card v2 at R2 (rate, window fill, yield, Open the game, Collect; no taps, no nuke); its command route accepts only `collect`, which runs the Foreman's pass when `meta.prefs.foreman` is on; postcards at R6 | `discord/src/ui/home.ts`, `render/cards/base.tsx`; `boundary.test.ts` becomes an allowlist (`06-friends.md`'s version, errata E18) |

### 3.5 Platform and tooling

| System (decisions) | Verdict | Change | Code |
| --- | --- | --- | --- |
| Commands, SSE, prediction, LocalBackend, Clock (D51, D59, D64, D65) | Keep | Plus the slim tap path; every command record outcome-only (7 days; taps and pings 1 h) | `commands.ts`, `api/src/game.ts`, `commandSchema.ts`, `hub.ts`, `web/src/state/store.ts` (its queue wipe at l.475-479 goes), `net/local.ts`, `clock.ts` |
| `World` (D98) | Keep the pattern | Inputs copied into `meta`; tree buys predicted; `World.lateTide` carries the median as a number, `World.islandCount` counts Wipe Days only (errata E18) | `domain/src/world.ts` |
| Backups (D54) | Keep, extend | Off-server copy in R0 | `api/src/backup.ts` plus a pull job |
| Admin, season CLI (D114) | Rework | Admin grant and respec in R2 | admin block in `api/src/app.ts`; `season-cli.ts` → `admin-cli.ts` *(proposal)* |
| Simulator (D56, D74, D82) | Rework | Lifetimes of runs; RTP removed | `sim/src/sim.ts`, `cli.ts`, `pacing.json5`; `sim.test.ts` stays the runner |
| Screenshots (D44) | Keep | `SHOTS` rebuilt; cinematic and tree pinnable | `web/scripts/shots.mjs` |
| Formatter, modifiers (D69) | Rework | Suffixes to Dc; effects as data | `domain/src/words.ts` `abbrev` (l.11-27); `modifiers.ts` replaced |
| Content validation (D66, D81) | Keep | Validates formulas and the Blast Map | `content/src/parse.ts`, `schema.ts` |
| `normalizeState` (D73) | Keep the pattern | A clean state version, with a wipe | `domain/src/normalize.ts` |
| The dock (D45, D88) | Rework | Shop drawer plus five nav items | `hud/Dock.tsx` |
| Demo drawer, demo clocks | Keep (dev) | 1× with jumps (+1 h, +6 h, next day), not 240×; the `wall` clock back; nuke count, glass grant, flotsam spawn, pinned cinematic | `hud/DemoDrawer.tsx`, `web/src/debug.ts`, `state/clocks.ts` |
| Events, wire types, web state | Rework | New events (canon 13.7); season, Den, raid, Signal fields go | `domain/src/events.ts`, `wire.ts`, `web/src/state/*` |

---

## 4. Decisions

### 4.1 Overturned

| D | Gist today | Replaced by |
| --- | --- | --- |
| D17, D19 | Collect banks accrual, Gather the bonus; fractions dropped | Auto-banking and the tap (D137); remainders kept (D130) |
| D25 | Season-day pacing targets | Pacing v2 (D144) |
| D26, D33 | Storage caps per resource | Night Shift window (D129, D137) |
| D27, D72 | Upkeep and decay | Removed (D137) |
| D28, D71 | Tier timers; builders | Instant purchases (D137) |
| D29 | Furnace jobs, fuel up front | The Furnace line (D137) |
| D34, D76 | The node marker game; wear | The era target (D137) |
| D37 | Daily tasks | Logbook, Magnet (D137) |
| D38, D62, D87 | Scrap-priced and tier-gated tools; fat into fuel; sites as scrap source | Grip costs supplies; resources gone; scrap rare (D131) |
| D63 | The daily node haul | Token bucket (D134) |
| D74, D82, D97, D104, D112 | Simulator policies; W4b-W6 balance | Simulator v2 (D144) |
| D77-D80, D83 | Parts, queues, blueprints, meals, recipe browser | Removed (D137) |
| D84, D90-D92 | The real crew: jobs, rest, bonds | Hands (D137) |
| D99-D102 | Market, Den counter and contracts, casino, wheel | Removed (D137) |
| D106-D111, D113 | Raids, defence, camps, PvP, their notifications and UI | Removed (D137, D142) |
| D114 | A season ends by command | No reset (D128); used once at the cut-over (D145) |
| D117 | Perks capped at 25%, points from ranks | Blast Map (D139), guardrails (D129) |
| D119 | The Signal | Island Count (D142) |

**Parked** (candidates to return with a sea layer): D85, D86, D88, D89 (its map half; the
dev-API half stays true), D93, D94, D95.

### 4.2 Modified

| D | What changes |
| --- | --- |
| D36 | Barrels become flotsam: seeded, minutes apart, only while the page is open (D137) |
| D42, D75 | Phone reframe: the target on the rise at about 40% height; lines on the fixed spots (D138) |
| D45 | Five dock actions become the drawer plus five nav items (D138) |
| D51 | The demo clock runs at 1× with time jumps, not 240×; the `wall` clock, gone since W1, returns in R0 (D138) |
| D54 | The off-server copy is done in R0 (D143) |
| D56 | Same pacing check in the test suite, new targets (D144) |
| D59 | Every command keeps an outcome-only record (no state): 7 days, 1 hour for taps and pings (D134) |
| D61 | One document per player, `meta` inside; a nuke overwrites the row (D133) |
| D67 | Advisor v2 (D138) |
| D69, D70 | Buildings and stations become lines with formulas; effects as data (D135) |
| D81 | The validator guards formulas and the Blast Map (D139) |
| D96 | New feed and push kinds; one default; quiet hours (D138, D142) |
| D98 | `World` inputs copied into `meta`; tree buys predicted (D133) |
| D103, D105 | Scale-free boards with lifetime stats in `meta`; the skiff hosts the shelf (D142) |
| D115, D116 | The reset's transaction becomes the template for `nuke`; what a nuke keeps is canon 5.5 (D133) |
| D118 | Modifiers become Dares, same ids (D137) |
| D120 | The season card becomes the postcard; the Hall keeps season 1 (D139) |
| D121, D125 | The bot's command route accepts only `collect`; `/base` becomes card v2 (D142) |

### 4.3 Kept, and history

- **Kept:** D1, D2, D3, D7, D11, D13, D14 (numbers in data), D15 (show only what is
  discovered), D21, D23, D40, D41, D43 (own world), D44, D46-D50, D52, D53, D58, D60, D64, D65,
  D66, D68, D73, D122-D124, D126.
- **History only:** D4, D5, D6 (its idea returns as D141), D8, D9, D10, D12, D16, D18, D20,
  D22, D24, D30, D31, D32, D35, D39, D55, D57.

### 4.4 New decisions to log in R0, from D127

In canon section 16's order. Old entries are never edited; D137 carries the tables of 4.1 and
4.2, so a reader of any old decision finds what replaced it.

| D | Title | Gist |
| --- | --- | --- |
| D127 | The redesign | An incremental idle game with a personal nuke; the plan lives in `docs/redesign/` and supersedes `game-design.md` and CLAUDE.md 1, 4, 6.3, 8 |
| D128 | Seasons are not a reset | One perpetual row; "month" is a board window; season 1 ends once, quietly, at the cut-over (decision 7) |
| D129 | The guardrails | Eleven guardrails replace CLAUDE.md 8, asserted as N1-N27 with the amended bands (section 6) |
| D130 | Finite doubles | An `Amount` alias with a finite guard in the domain and `save()`; counts stay integers; amends "Integers in state" and D19 |
| D131 | The currencies | Supplies, Crater Glass (ever, held), Scrap (rare), Sea Charts (reserved); products drawn, never stocked (A1) |
| D132 | The prestige shape | `G(L) = floor((L / L0)^(1/5))` paid as a delta times multipliers; granted glass held only; Glow `1 + k√(glass ever)`; +10% makes a Wipe Day, less a small blast; constants in data |
| D133 | Meta in the base; `nuke` is pure | `state.meta` in the base document; `nuke(state, now)`; the row overwritten, `version` rising |
| D134 | The slim taps transport | Batches ≤ 1 s or 30 taps; bucket 15/s, burst 45; outcome-only records (7 days; taps and pings 1 h, no `event_log` row); amends D59 |
| D135 | Effects as data | `{stat, op, value, scope?, per?, when?}` and one evaluator in a fixed order; replaces `modifiers()` |
| D136 | No autobuyer inside settle | The Foreman and Dead Hand send ordinary commands while online |
| D137 | The cut list | Section 3 and the overturned and modified decisions |
| D138 | 6.3 amendments, orange primary | Section 5.1's table; the 1× demo clock (amends D51); contrast fixes with the orange in R1 |
| D139 | The Blast Map | 361 nodes, 8 × 9; 73 in R2, 201 by R5, 361 in R7; three keystone slots; DOM and SVG; permanent; respec only after a tree patch |
| D140 | Never tease unshipped content | Only real, reachable reasons; the agenda lists shipped content only |
| D141 | Icon namespaces | `packages/content/icons/<kind>/<id>.svg` with section 8.1's kinds, 48 viewBox, `currentColor`, a content test with the tile fallback |
| D142 | The social rules | Counts, times, ratios and each player's own scale; no trading, gifting, PvP or shared absolute goals; the bot only collects; quiet hours on by default |
| D143 | Backups, `event_log` safety | Off-server copy before any wipe; the sequence never reset |
| D144 | Simulator v2 | Lifetimes of runs over 30, 90, 180 days; five archetypes (the idler taps only to start a run); pacing v2 inside `pnpm test` |
| D145 | The branch and the frozen old game | `redesign` branch, `pre-redesign` tag; `main` frozen: nothing lands beyond R0's backup, except an emergency fix if the live server or the backup breaks, merged forward; cut-over at the end of R2, tagged `season-1-final`, wiping run state only |

---

## 5. CLAUDE.md and the docs

### 5.1 CLAUDE.md, section by section

| Section | After the R0 rewrite |
| --- | --- |
| 1. What this is | An incremental idle game on Saltmarsh: tap, hire hands, climb five eras, nuke your own island for crater glass, spend it on the Blast Map. No seasons. Discord: status, Collect, DMs, the feed. Priorities unchanged; non-goals gain "no casino, no PvP, no trading between players" |
| 2. Working rules | Adds the `redesign` branch until the cut-over, `main` frozen, emergency fixes only, merged forward (D145); "numbers in data" includes formulas; the plan and engineering spec in `docs/redesign/` |
| 3. Layout | `content` gains the new data files and `icons/`; `sim` plays lifetimes of runs |
| 4. Core principles | Lazy closed-form settle, nothing buys inside it (D136); time injected, the demo at 1× with jumps; commands idempotent, outcome-only records, taps and pings on the slim path (D134); restart-safe; **finite numbers in state** (D130); `event_log` keeps rare events; taps, pings and purchases roll up into stats (`09-architecture.md` 7.3) |
| 6.1 Rendering | Phone reframe: target on the rise, at least 120 CSS px; Blast Map in React DOM and SVG; the fireball on the `lights` layer |
| 6.2 Visual language | Tier colours become era colours; the formatter runs to Dc, then scientific; one icon per currency, product, line, era, tool, target, flotsam, hand, node and action; bars for cycles, milestones, the Night Shift window, the Kettle, the Magnet, cooldowns |
| 6.3 UX rules | The table below |
| 7. Content | New data files (canon 13.8, plus `island.json5`); `crew.json5` and `resources.json5` slimmed; costs validated as formulas; the glossary moves to the new `game-design.md` |
| 8. Guardrails | The eleven of section 6, each with its N-numbers |
| 9. Simulator | Idler, casual, active, optimal, late joiner over 30/90/180 days; a group run for medians; RTP gone |
| 10. Testing | Unit and idempotency stay. Invariants become: settle path independence (1e-9) and the tick oracle (1e-6); the bucket never over-credits; a nuke keeps exactly `meta` and grants exactly the formula's glass; effects monotonic and bounded per stat; glass and scrap fall only by the owner's own spend; Blowback never writes another base |
| 11. Discord | Same architecture; card v2; no Gather; `collect` the only command; nuke news; postcards from R6 |
| 12. Phases | W0-W8 as history; R0-R7 and "Later, gated" (`11-roadmap.md`); W9 folded into R0, R2, R7 |
| 13. Commands | `sim rtp` and `season` go (`main` keeps `season end` for the cut-over); `pnpm sim` gains archetype and horizon options; admin grant and respec added (`09-architecture.md`) |

Sections 5 and 6.4 stay as they are (the off-server copy is simply done; the cinematic and the
Blast Map become pinnable shots). 6.4's `wall` pin is untrue today: `state/clocks.ts` has only
the 240× game clock since W1, and R0 adds the `wall` clock back.

**The 6.3 amendments (D138):**

| Rule | New wording |
| --- | --- |
| 6.3.1 | Exactly one **crowned** thing per view; other affordable rows stay enabled and secondary. While the crown is on the Big Red, crates, a Toolbelt skill or the tap hint, the collapsed drawer has no orange row; the expanded drawer always crowns one. The primary is signal orange; the Big Red is never primary-styled |
| 6.3.8 | The shop drawer plus five nav items: Island, Blast Map, Crew, Logbook, Friends. The nav row is hidden at 0:00 and appears when its first destination unlocks |
| 6.3.9 | Production cycles may be seconds. Idle timers (Night Shift, Magnet, Toolbelt cooldowns, Freighter) run on the game clock; active timers (Hustle, flotsam, buffs, felling, the cinematic) are real seconds and never speed up; the demo clock runs at 1× with time jumps |
| 6.3.10 | Welcome back's one primary is Collect, never the nuke |
| 6.3.11 | On by default: "Night Shift over" only, and quiet hours 22:00-08:00 (browser time), holding pushes until 08:00 |
| New | Never tease unshipped content; locked things show only real, reachable reasons |

### 5.2 The docs

| Doc | In R0 |
| --- | --- |
| `docs/redesign/` | New: a README plus the approved plan files, read by later sessions. `09-architecture.md` stays there as the engineering spec, and CLAUDE.md points to it |
| `docs/game-design.md` | Rewritten from `01`-`06` and `10`'s constants; the old one to `docs/archive/game-design-v1.md` |
| `docs/roadmap.md` | Rewritten from `11-roadmap.md`; the W-phase results to `docs/archive/roadmap-w.md` *(proposal)* |
| `docs/decisions.md` | D127-D145 appended; old entries untouched |
| `docs/web-prototype.md` | Scene and camera rules rewritten; the taps path added to "How state flows" |
| `docs/screens/` | Moved to `docs/archive/screens/` (the old bot's screens) |
| `docs/ui-review.md` | Kept; R-phase sections appended; open items of removed systems closed as "moot, D137" |
| `docs/deploy.md` | The seasons section and the W7 "Starting over" recipe give way to the cut-over runbook (`09-architecture.md`), the off-server copy and its restore drill (R0), then admin grant and respec |
| `README.md` | "Start here" names the `redesign` branch until the cut-over |
| `04b`, `05b` catalogs | Become `blastmap.json5`, `logbook.json5` and locale keys |

---

## 6. Guardrails, old and new

N-numbers as amended (`10-balance.md` 4.9).

| Today (CLAUDE.md 8, `game-design.md` 2) | New (D129) | Enforced by (canon 15) |
| --- | --- | --- |
| 3 check-ins make steady progress; 8 is about 1.6×, never more (never asserted) | 1. The first nuke comes on day 1 | N1 active 40-60 min; N2 any archetype ≥ 25 min; N3 casual by the day-1 21:00 check-in |
| (same) | 2. Active play is a bonus | N8 tap-driven income (taps and unmanned lines) ≥ 50% in run 1's first minute, direct taps 5-25% from minute 10 outside bursts; N9 active hour 1.5-3× an idle online hour, on the weather-weighted hour (rain hours warn; errata E13); N10 ≤ 15 taps/s, burst 45, hold 4/s |
| (same) | 3. Friends stay in one race | N16 glass ever at days 30 and 90: active ≤ 2×, optimal ≤ 2.5×, idler ≥ 0.5× casual, asserted in a group of five with Late Tide (solo gaps and the doubling idler's trough warn; late idler gaps for an idler following the crown; errata E11); N17 late joiner catches the day-30 casual within 12 days, asserted for two players (five warn; errata E16) |
| Storage caps drive check-ins | 4. Always something to buy | N5 nothing affordable for ≤ 30 s in the first 10 online minutes of runs 1-5; N6 ≤ 120 s with nothing affordable; N7 ≥ 90% of casual check-ins in days 1-30 contain a purchase |
| Legacy ≤ 25% stronger in any rate | 5. Every nuke feels faster | N11 run N+1 passes run N's gain in ≤ 65 / 95 / 100% of its time (medians, warn-only until R7); N12 ×1.5-2.5 / ×1.15-1.6 / ×1.1-1.5; N13 five consecutive nukes together below ×1.3, nothing opening in the next 3: fail |
| Optimal: top tier not before day 14, last site not before day 18 | 6. The tree lasts months | N14 6-10 nodes at the first nuke, later median ≥ 2; N15 optimal ≤ 45% by day 30, 100% not before day 90; casual ≥ 45% at day 180 (warning) |
| A cap stops accrual, never destroys | 7. Absence never hurts | N18 Night Shift 12 h to 48 h at 100%; a full window destroys nothing |
| Casino: scrap only, 5-10% edge, RTP ±1% | 8. Precious things never at risk; no casino | N19 scrap 0.8-2 a day (7-day average; single windows warn, errata E15), ≥ 25 by day 30, never > 2.5; a test that no command moves glass or scrap between players *(proposal)* |
| PvP friendly and capped | Gone; the social rules (D142) | `06-friends.md`; no command writes another base |
| Randomness bounded and visible | 9. Randomness visible; no hidden catch-up | N20 timers and odds; odds printed in the game (an Odds sheet in Settings from R1, in the Logbook from R4; errata E8); Late Tide labelled to its player only, never on boards or shared surfaces (errata E19) |
| (none) | 10. Numbers stay meaningful | N21 fifth root, `L0` 5e5, Glow `1 + 0.25√G`; N23 run 1 ends at 1e10-1e12 supplies made, < 1e150 over 180 days, always finite |
| Active timers in real seconds (6.3.9) | 11. Respect the clock | Amended 6.3.9; N20 |

**Retired:** the 25% cap and its four enforcements (CLAUDE.md 8, `checkLegacy`, the perk bonus
schema, `legacy.test.ts`), "8 check-ins ≈ 1.6×", the day-14 and day-18 floors, storage caps as
the check-in driver, the casino rules and the PvP rules.

---

## 7. Names and own IP

### 7.1 New and changed names

All *(proposal)* until the owner's pass. Ids stay fixed when a display name changes, so a rename
is a locale edit and never breaks an icon.

| Name | id | What | Note |
| --- | --- | --- | --- |
| Supplies | `supplies` | Run currency | Not "salvage", a near-synonym of scrap |
| Crater Glass; Glow; Morale; Hustle | `glass`, `glow`, `morale`, `hustle` | Prestige; its multiplier; the Logbook's; the tap meter | |
| Scrap; Saltmarsh | `scrap` | Rare currency; the island | Kept |
| Beachcomber, Ship Breaker, Reactor | `beachcomber`, `shipbreaker`, `reactor` | New lines 1, 13, 14 | The other 11 lines keep their names |
| Driftwood, Smoked Fish, Hemp ... Broadcasts, Steel Plates, Power Cells | `timber`, `roast`, `fibre` ... `broadcast`, `plates`, `cell` | The 14 products (`02-the-run.md` 1.1) | 11 reuse old ids; `broadcast` replaced `signal` |
| Gus, Vera | `gus`, `vera` | New hands | The 12 crew names are kept |
| Twig, Timber, Stone, Sheet Metal, Armored | `twig`, `wood`, `stone`, `metal`, `hqm` | Eras | Kept; four match Rust's building grades; `hqm` is internal |
| Rock ... Power Tools | tool ids | Grip rungs | Kept; close to Rust's tool ladder |
| Lone Pine, Outcrop, Ore Seam, Sulfur Vent, The Wreck | `tree`, `stone`, `ore`, `sulfur`, `wreck` | Tap targets | |
| Drift Crate, Fuel Drum (Rally), Adrenaline Kit, Drowned Drone, Sealed Locker, Message in a Bottle | `crate`, `fuel_drum`, `adrenaline`, `drowned_drone`, `sealed_locker`, `bottle` | Flotsam | |
| Night Shift; the Kettle; the Big Red | `night_shift`, `kettle`, `big_red` | Offline window; missile; button | "Big Red" is also a gum brand; low risk |
| Wipe Day #N, small blast, postcard, rebuild screen, Afterglow, agenda; Fizzle | `fizzle` | The nuke's beats; a small blast's flight variant | A small blast is a nuke under +10% |
| Blast Map, Ground Zero; sectors Grip, Crew, Works, Tide, Bunker, Blast, Logbook, Scrapyard | `ground_zero`, sector ids | The tree | "Ground Zeroes" is a game subtitle; the singular is a common phrase |
| Calloused Hands, Old Friends, Starter Kit | `steady_hands`, `old_friend`, `packed_crate` | Perks renamed as nodes | Were Steady Hands, Old Friend, Packed Crate. "Starter Kit" is a common phrase but also a Cookie Clicker upgrade name: on the naming-pass list, id kept (errata E27) |
| Lucky Swing, Old Crew, Glow Lamp, Union Rules, Bigger Payload; Wipe Day Rush, Bunker Mentality, Lone Wolf | node ids | Anchor nodes; keystones | |
| Deep Pockets, Sewn Lining, Flare Gun | `deep_pockets`, `sewn_lining`, `flare_gun` | Unlock nodes: Pocket slots 2 and 3; choosing a Flare's flotsam | |
| Logbook, Secret, Shared first find | | Achievements | |
| The Magnet, Crew rank, Pocket | `magnet`, `rank`, `pocket` | Scrap layer | Pocket replaced "Keepsake" |
| Foreman, Dead Hand | `foreman`, `dead_hand` | Automation | "Dead Hand" is a real-world term, not a game |
| Rush, Grit, Flare | `rush`, `grit`, `flare` | Toolbelt | |
| Long Night, Rich Tides, Storm Season, Quiet Hands | `long_nights`, `rich_tides`, `storm_season`, `quiet_raiders` | Dares | Were Long Nights, Quiet Raiders |
| Blowback, Island Count, the Freighter, Load, Late Tide, Visit; Founder skin, pennant | | Social, cosmetics | Blowback replaced "Ashfall" |
| The Barge, the Crossing, Sea Charts | `barge`, `sea_charts` | Second layer | Replaced "Ark", "Exodus"; "The Crossing" was also a cancelled game's title, low risk |
| Scrappers, Bunker Folk, Tinkers | | Creeds, deferred | |

### 7.2 Rejected names

| Name | Proposed for | Why rejected |
| --- | --- | --- |
| Blueprint Fragments | Nuke currency | A Rust item; promises crafting |
| Rads | Kept prestige level | Fallout's radiation unit |
| Fallout | Buffs | Another franchise's title |
| Vault | Kept relics | Fallout's shelters |
| Stash | A keep-supplies node | A Rust item |
| Half-life | Afterglow's decay | A Valve title (the spec says "halving") |
| Dredge | The Magnet | Another game's title |
| Ashfall | Blowback | Another post-apocalyptic game's title |
| Exodus | Second layer | In another game's title, and an announced game |
| Ark | The Barge | A survival game in Rust's own genre |
| Keepsakes | Pockets | An item category in another game |
| Glowheads | A creed | Echoes another franchise's irradiated "Glowing Ones" |
| Caps, Recycler | Currency, a machine | Fallout's currency; a strongly Rust machine |
| `signal` | The Radio Mast's product | The removed season system's id, with its own locale namespace and icons |

### 7.3 Before you lock names: a checklist

- [ ] Search the name with "game", "Rust" and "Fallout", and in the Steam and app stores. A
      title or item hit is a no (D43).
- [ ] Not a brand you would mind in a screenshot.
- [ ] Fits at 390 px: about 14 characters for a button, 20 for a row.
- [ ] Plain English, reads aloud, needs no explanation; the tone is jank homemade engineering.
- [ ] Two different things never share a name (a sector named for its theme, like Grip or
      Logbook, is the deliberate exception).
- [ ] Decide the eras: keep Rust's grades as the nod, or rename all five together.
- [ ] Edit only `packages/content/locale/en.json`; ids and icon files stay.

---

## 8. Icons

### 8.1 Conventions (D141)

- **Path:** `packages/content/icons/<kind>/<id>.svg`, in the shared content package, so web and
  bot draw the same files. The kind matters because ids collide: `stone` is an era and a
  target, `crew` a sector, a nav item and a kind.
- **Kinds:** `currency`, `product`, `line`, `tier`, `tool`, `target`, `flotsam`, `crew`,
  `toolbelt`, `sector`, `node_type`, `node`, `dare`, `skin`, `ui`, `nav`. `target` holds the era
  targets (today's `nodes.json5` ids), `node` optional unique Blast Map node art. An icon already
  drawn as a resource or item moves to its new folder unchanged; moving files is free.
- **File:** `viewBox="0 0 48 48"`, no width or height, no raster, `<text>`, filters, gradients
  or external references (flat vector, D41); no `id` attributes, which collide when inlined.
- **Colour:** main shapes in `currentColor`, so chips and era colours tint them; at most one
  fixed accent from `scene/palette.ts` or `styles/tokens.css` (scrap's gold, glass's green, the
  Big Red's red).
- **Legibility:** a 2-unit margin; lines at least 3 units (1 px at 16 px). Check at 16 px (chips,
  floaters) and 48 px (shop rows, Toolbelt): if the black silhouette at 16 px is not nameable,
  simplify.
- **Name:** the id, lowercase `snake_case`, exactly as in the data. A content test checks every
  id has an icon and falls back to today's lettered tile, so a missing icon never blocks a phase.

### 8.2 Keep drawing (safe in every phase), in priority order

- [ ] `currency/scrap`: **top priority**, the rare gold chip.
- [ ] Product badges (A1; mapping final in `02-the-run.md` 1.1), one object each since they show
      at 16-24 px: `timber` (Beachcomber), `roast` (Campfire), `fibre` (Garden), `rope` (Loom),
      `planks` (Workbench), `charcoal` (Kiln), `ingots` (Furnace), `leather` (Tannery), `fuel`
      (Oil Press), `food` (Dock), `plates` (Ship Breaker).
- [ ] Lines 2-12: `campfire`, `garden`, `loom`, `workbench`, `kiln`, `furnace`, `tannery`,
      `press`, `dock`, `generator`, `radio_mast`.
- [ ] Era badges `twig`, `wood`, `stone`, `metal`, `hqm`; Grip `rock`, `stone_tools`,
      `iron_tools`, `salvaged_tools`, `power_tools`.
- [ ] Targets `tree`, `stone`, `ore`, `sulfur` (a thing to tap, not a pile); `flotsam/crate`.
- [ ] The 12 crew portraits: `mara`, `dax`, `ivo`, `rook`, `sela`, `bram`, `wren`, `otto`,
      `juno`, `pike`, `hale`, `tamsin`.
- [ ] Skins, low priority: `driftwood`, `rust`, `beacon`.

### 8.3 Wait

- [ ] The 11 traits (decided in R5); the 4 season-modifier ids (Dare badges in R7).
- [ ] The 8 perk ids: now node ids, but nodes use sector glyphs, so unique art (`node/`) is
      optional.
- [ ] Sites (15), regions (13), keycodes (3; items, but they wait with the sea layer), trip
      events (3): only if a sea layer is built.

### 8.4 Stop now

- Resources that are not products (12): `stone`, `ore`, `sulfur_ore`, `sulfur`, `hide`, `fat`,
  `cloth`, `frames`, `gears`, `springs`, `gunpowder`, `charge`.
- Items (10): `large_crate`, `strongbox`, `bandage`, `first_aid_kit`, `bow`, `spear`,
  `crossbow`, `leather_vest`, `stew`, `feast`.
- `large_furnace`, `electric_furnace`; the `fibre` node; walls, traps, turret, watchtower;
  warehouse, bunkhouse and lights (props, no icon).
- Casino symbols (16), Signal stages (4), contracts (12), Den lots (13), tasks (8), old dock
  letters (11).

### 8.5 New icons, by phase, in order of need

**R1 (29)**
- [ ] `currency/supplies` (a lashed bundle), `ui/hustle`, `ui/hand`, `ui/night_shift`,
      `target/wreck`
- [ ] Lines `beachcomber`, `shipbreaker`, `reactor`; crew `gus`, `vera`
- [ ] New products `battery` (Generator), `broadcast` (Radio Mast), `cell` (Reactor)
- [ ] Flotsam `fuel_drum`, `adrenaline`
- [ ] Nav `island`, `blast_map`, `crew`, `logbook`, `friends`; `ui/upgrade`, `ui/roster`,
      `ui/buy_max`
- [ ] UI glyphs (`08-screens.md` 3.6): `ui/crown`, `ui/lock`, `ui/finger` (unmanned),
      `ui/chevron`, `ui/close`, `ui/menu`

**R2 (23)**
- [ ] `currency/glass`, `ui/glow`, `ui/big_red`; the Kettle stages `ui/kettle_pad`,
      `kettle_frame`, `kettle_warhead`, `kettle_fuel` (`03-the-big-red.md`)
- [ ] `ui/afterglow`, `ui/ground_zero`
- [ ] Sector glyphs `grip`, `crew`, `works`, `tide`, `bunker`, `blast`, `logbook`, `scrapyard`
- [ ] The 5 node-type frames (`04-blast-map.md`); `skin/founder` for the cut-over gift

**R4-R5 (12)**
- [ ] `morale`, `magnet`, `pocket`, `rank`, `foreman`, `dead_hand`; Toolbelt `rush`, `grit`,
      `flare`; flotsam `drowned_drone`, `sealed_locker`, `bottle`

**R6-R7 (9, then 2)**
- [ ] `blowback`, `island_count`, `freighter`, `skin/pennant`, `late_tide`; Dares
      `long_nights`, `rich_tides`, `storm_season`, `quiet_raiders`; later, only once the
      Crossing ships, `barge` and `currency/sea_charts`

---

## 9. The live game

### 9.1 Until the cut-over

- Season 1 (started 2026-10-07) runs untouched on `main`; nobody plays it now (decision 7).
  Nothing lands beyond R0's backup, except an emergency fix if the live server or the backup
  breaks, merged into `redesign` (D145).
- The old plan's announcement (about 2026-10-28) and end (about 2026-11-04) are cancelled; the
  season runs on until R2 lands.
- On the old build the Signal opens by itself on season day 21, about 2026-10-27
  (`seasons.json5` `opensOnDay`), and the boards keep counting. Both are harmless.
- The off-server backup moves from W9 into R0, protecting season 1 early.
- The old game's screens are not fixed, because they are going. Friends see the new game through
  demo screenshots after each R-phase.
- `season announce` is not used (errata E3) and nothing is announced; season 1 ends quietly at
  the cut-over. Nothing on frozen `main` changes for it.

### 9.2 The cut-over (end of R2; runbook in `09-architecture.md`)

1. Take an off-server backup (`wipeday-pre-cutover.db`), confirmed in the remote.
2. Tag the last old-game commit `season-1-final`.
3. Stop the bot and, while it stays stopped, run `pnpm season end` once, quietly: archive and Hall of
   fame written. The bot's season news is live-only, so its stock wording (old carry-overs, a
   season-2 modifier) is never posted; the owner may post the optional message by hand (9.3). No
   commit on `main` for this (errata E3). The new build ignores the `modifier` on the row
   `season end` opens.
4. Wipe run state only, with the runbook's recipe, never `docs/deploy.md`'s W7 "Starting over"
   (it deletes the old world and `event_log`). **Kept:** `players`, sessions, push
   subscriptions, settings (VAPID keys, casino secret, the Discord feed cursor), `seasons`,
   `season_archive`, `hall_of_fame`, `legacy`, and `event_log` with its sequence.
   **Deleted:** `bases`, `commands`, the jackpot, and the rows of `listings`, `trades`,
   `wheel_bets`, `signal` and `signal_gifts`, whose empty tables a migration drops in R7.
5. Merge `redesign` and deploy (migration `0005` adds `commands.expires_at`).
6. Grant everyone with a season 1 base a Founder skin and 5 glass (held only) through the admin
   grant (decision 8).

Within the first day a rollback (the pre-cut-over copy, `season-1-final`) is clean; then fix
forward.

### 9.3 What the season 1 players experience

- **Before:** nothing changes and nothing is announced; season 1 sits untouched.
- **On the day:** season 1 ends quietly (the owner may post the optional message below); the Hall keeps season 1 as "the old world" with
  its titles and cards; logins, the Discord link and push subscriptions survive; notifications start from
  the new defaults.
- **After:** dawn, three crew at a dead fire, "Tap the tree." The Founder skin is on, and 5 glass
  wait for the Blast Map, which opens at their first nuke on day 1 (N1-N3). The gift is glass
  held, so Glow stays ×1 until that nuke. Season-1 bases, perks, blueprints, crew levels and
  legacy points do not carry over; titles and skins do, and the gift is the thank-you.

An optional message the owner may post by hand at the cut-over, step 3 (errata E3; decision 7)
*(proposal)*:

> Season 1 is over. Thank you for playing. The winners: [names and titles]. They stay in the
> Hall as "the old world", with their cards. Titles and skins carry over; bases, perks,
> blueprints, crew levels and legacy points do not. The new Wipe Day is live: everyone starts
> fresh on Saltmarsh, with a Founder skin and 5 crater glass waiting for the Blast Map.

### 9.4 Sunk cost, honestly

| Phase | Stays | Reworked | Parked | Deleted |
| --- | --- | --- | --- | --- |
| W1 Domain, API, auth | Commands, idempotency, SSE, prediction, LocalBackend, login, backups | Settle, base state, advisor | | Gather, Collect as a ritual, caps, upkeep |
| W2 Buildings | 14 drawings, the fixed spots | Lines; levels into redraws at 1/25/100 | | Levels, builders, timers, decay, 4 defence drawings |
| W3 Crafting | Station and furnace art; tree and rock art | Node game into the era target | | Parts, queues, recipes, blueprints, meals, salvage, wear |
| W4 Crew, map, feed | Crew names and walkers; feed; Web Push | Crew into hands | Expeditions, map, fog, sites, keycodes, report cards | Jobs, tiredness, bonds, gear, injuries |
| W5 Den | `World`; ranking with ties | Boards | | Market, counter, contracts, casino, RTP tests |
| W6 Raids | Property-test know-how | | | All of it |
| W7 Seasons, legacy | The reset's transaction shape; carry plumbing; titles, skins | Legacy into `meta` and the Blast Map; modifiers into Dares; the card into the postcard | | Monthly reset (after one last use), the Signal, the 25% cap |
| W8 Discord | All of it | The card, the feed sentences | | Gather, raid and season-day lines |

In numbers: of about 7,600 lines of domain rules (tests excluded), about 3,200 in 13 files are
deleted outright and 909 parked (`missions.ts`); most of the rest is rewritten, while the clock,
RNG, `World`, command, event, feed and word plumbing survives. In the web client the files
`09-architecture.md` deletes or parks come to about 6,000 of 12,400 lines of HUD, panels, scene
and map, 1,200 of them the parked map. That matches the canon's estimate: about 60% of W3-W7.

**What can come back:** expeditions as a sea layer (3-4 sessions, if casual players need a
slower overnight clock), chains as an island trait after the Crossing, creeds if runs feel
samey. **What cannot, under the guardrails:** the casino, PvP, the market, stock-taking raids.

---

## 10. Open owner decisions

Canon section 18, with the big decision as 0 and the late wall as 21. The owner decided all 22 on
2026-10-10 (last column): every default except season 1 (decision 7), which ends quietly at the
cut-over with no ceremony required. Names (passes in R1, R2, R4), hand traits (R5) and the late
wall (before R7) are confirmed in their phases.

| # | Decision | Default | If you choose otherwise | Owner's choice (2026-10-10) |
| --- | --- | --- | --- | --- |
| 0 | Run currency | One currency with product badges | Era materials: about +1.5 sessions, a second counter, a material model in the simulator | **One currency, Supplies, with product badges** (default) |
| 1 | Names | Section 7 | A locale edit; ids and icons untouched | **Default passes** (R1, R2, R4). Eras: lean to keeping the five Rust grades; rename Starter Kit in R1 |
| 2 | Island | Saltmarsh; its clock UTC+1, no daylight saving (errata E9) | Locale only (nuke news, postcard, Island Count); the clock is one value in `island.json5` | **Saltmarsh, UTC+1, no daylight saving** (default) |
| 3 | The lid | Toilet-seat lid | The jam jar: art only, R2 | **Toilet-seat lid** (default) |
| 4 | Seasons as a reset | Remove; month as a board window | A monthly wipe takes the Blast Map (breaks N15) or only the run (pointless); reset code to maintain | **Remove**; month as a board window (default) |
| 5 | Cut list | Accept all | Each kept system needs a scale-free redesign; casino, PvP and stock-taking raids break guardrails 7 and 8 | **Accept all** (default) |
| 6 | Expeditions | Parked until the R6 playtest | A sea layer earlier: 3-4 sessions and a second time scale before the core loop is proven | **Parked until the R6 playtest** (default) |
| 7 | Season 1 | Runs until R2, then a ceremony | Ending on the old date (about 2026-11-04) means season 2 on a frozen build, or no game until R2 | **Changed:** nobody plays season 1 now, so it runs untouched (no announcement, no season 2, no work on `main` beyond R0's backup) and ends quietly at the cut-over with one `pnpm season end`, archived in the Hall as "the old world". The Discord message is optional, and the cut-over is no longer timed to season 1's old end date |
| 8 | Founders' gift | Founder skin plus 5 glass, held only | More glass skews the early Late Tide median (N16, N17); a skin alone gives no power | **Founder skin plus 5 glass, held only** (default), for everyone with a season 1 base |
| 9 | Prestige shape | Fifth root of lifetime (`L0` 5e5), √ Glow; never above 1/5 without a group-simulation proof | The cube root ran away in the model (first nuke at 22 min, the tree lit by day 12; `10-balance.md` 3); the square root, withdrawn, runs away faster | **Slow and steady** (default): fifth root of lifetime (`L0` 5e5), √ Glow |
| 10 | Offline | 100% inside 12 h, up to 48 h | Lower rates punish the casual night; no window loses the check-in driver (N18) | **100% inside the Night Shift, 12 h rising to 48 h** (default) |
| 11 | Primary colour | Signal orange, with the contrast fixes (`--muted` #b5afa4, panel alpha 0.86) in R1 | Today's red (`--accent: #cd412b`) blurs the Big Red, which must never look advised | **Signal orange**, with the contrast fixes in R1 (default) |
| 12 | Toolbelt | Three skills, R5 | Fewer loses Grit, the casual ritual; more crowds 390 px | **Three skills** (Rush, Grit, Flare), R5, never a fourth (default) |
| 13 | Creeds | Deferred, at most 3 | Now: 3-4 sessions and a far larger balance surface | **Deferred**, at most 3, only if the post-R7 trigger fires (default) |
| 14 | Dead Hand | Opt-in, online; presets 25 / 50 / 100 / 200% of glass ever, or "when crowned" (errata E12) | Offline auto-nukes need buying inside settle (against D136) and skip the show | **Opt-in, online**, presets and safety rules as written (default) |
| 15 | Sound | Procedural WebAudio, R1 | Silence until you supply sounds, which must be your own (D43) | **Procedural WebAudio, R1** (default) |
| 16 | Freighter rewards | 1 scrap per tier per loader; pennant at III | More scrap breaks N19 (≤ 2.5 a day) | **1 scrap per tier per loader; pennant at III** (default) |
| 17 | Visit | R6 stretch | Cut: a cheap social view lost; earlier: a read-only route before the core loop | **R6 stretch** (default) |
| 18 | Nuke from Discord | No | A chat card holds a destructive action and the cinematic is lost | **No**: web only; the bot may Collect and link to the Big Red (default) |
| 19 | Hand traits | One-line perks or cut, decided in R5 | Full traits bring back per-hand stats to balance | **Decide in R5**, leaning to one-line perks (default) |
| 20 | Notation | Suffixes to Dc, then scientific, toggle | Scientific only reads as homework early; suffixes past Dc stop being readable | **Suffixes to Dc, then scientific, with a toggle** (default) |
| 21 | The late wall, before R7 | Option 1: a slow outer tree, the Crossing's trigger lowered to "45% lit and N13 firing"; option 2 (a fair calendar-time power source, such as the deepening crater) designed in `05` and simulated before R7 | Option 3, stronger outer rings carried by Late Tide, splits the group (optimal 6.9×, idler 0.08× the casual at day 365, `10-balance.md` 5) unless the group simulation proves N16 | **Default approach**: option 1 as the working plan, option 2 designed and simulated alongside; the final option is chosen before R7 from R6's simulations and playtest |

---

## Open questions

None; settled by errata v3.
