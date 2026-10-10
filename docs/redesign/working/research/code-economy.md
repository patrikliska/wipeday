# Code-economy report: the current Wipe Day economy, mapped for an incremental redesign

Reader: "code-economy". Read-only pass over `packages/content/data/*.json5` (all 20 files),
`packages/content/src/*` (schema, parse/cross-checks, load, tiers, odds, look, locale),
`docs/game-design.md` sections 5-8, the domain functions that apply the numbers
(`packages/domain/src/base.ts`, `modifiers.ts`, `nodes.ts`, `goods.ts`, `legacy.ts`), the
economy decisions (D62, D63, D77, D79, D87, D104, D112, D117) and the web client's icon code.
All derived numbers below were computed from the live data with scratch scripts that import
the repo's own loader and simulator (nothing was written into the repo). "Value" means the
Den's reference price (`den.json5` `refPer100`, in scrap per unit), the only common unit of
worth the code has. "Raw-expanded" means parts recursively replaced by their recipe inputs
(the simulator's `rawCost`, `packages/sim/src/sim.ts:960`).

---

## 1. Headline findings (for the redesign)

1. **The whole season is ~62 purchases.** 4 tier upgrades + 4 tool upgrades + 18 buildings x 3
   levels (54) is every permanent upgrade a player can buy in a month. Three check-ins a day
   over 28 days is 84 check-ins: fewer than one upgrade per visit. Incremental games give
   dozens of purchases per session. This is the single biggest structural gap.
2. **In-season growth is about x30, not x1e6+.** Production rises from 200 units/h (rock) to
   3,270 units/h (power tools): x16 in units, x30 in value (4 -> 121 scrap-equivalent/h).
   Buildings add only +6% to everything (campfire), +50-60% to fibre/hide/fat, perks +6%.
   Every curve is hand-tuned with 3-5 steps; none is a formula.
3. **Content runs out around day 18-22 for engaged players.** Re-running the simulator today:
   active reaches Armored on day 18 and optimal on day 15, then both sit at **100% storage**
   from about day 22-27 with ingots piling up (optimal: 365k ingots, 8.4k scrap on day 31).
   Everything purchasable in a season (tiers 9.8k + tools 3.2k + all 54 building levels 8.5k =
   **~21.5k scrap-equivalent**) equals about one week of end-game production. There is no
   unbounded sink: the exact thing an exponential cost curve fixes.
4. **Costs are irregular, not geometric.** Tier costs in value: 40 -> 208 -> 4,840 -> 4,747
   (x5.2, x23.3, x0.98). In the simulator's own "resource-hours" metric: 9.0 -> 27.1 -> 259 ->
   129 h (x3.0, x9.6, x0.5): `pnpm sim check` prints three WARN lines against its 3-6x
   guideline today. Building levels rise by a geometric mean of x3.1 per level (range
   x0.73-x7.49) while their effects rise linearly (2/4/6, 15/30/50...), so every level is worse
   value than the one before: the opposite of incremental milestones.
5. **Storage caps drive check-ins only in week 1.** Base cap fills in 12.5 h at Twig with the
   rock, 20.8 h at Timber with stone tools, then 50 h, 114 h and 250 h. Later the real check-in
   drivers are furnace jobs (8-17 h), station queues (40 min to 20 h), builds (0-24 h), trips
   (30 min-12 h), the 4-hourly barrel (45 min life), the 10-minute Gather and nightly raids.
6. **Clicking is deliberately capped.** Gather = 30 min of production every 10 min (no daily
   cap); node hits = 6-24 min of production per hit, but only 180 min/day pays in full (+30/60/90
   from the bunkhouse), then 10% (D63). The design target is active <= 1.6x casual (CLAUDE.md
   section 8). The owner's "click like crazy at the start" directly contradicts D63 and that
   guardrail.
7. **Scrap is already scarce and small-numbered.** All sources are drip-fed loot: barrel EV
   3.2 scrap, tasks ~24/day, sites 3-130 per success, held raids 10-120. Sinks: tools 2,600,
   scouting 515, Den purchases/fees, casino edge, raid repair. Casual holds ~1.0k / 1.1k / 3.0k /
   3.2k scrap on days 14/21/28/35 (target 800-4,000 on day 28). Scrap is uncapped and can only
   be lost to a raid up to a 50/150/300 ceiling. It is a good candidate for a rare meta
   currency as-is; it is a bad candidate for an exponential soft currency.
8. **Blueprints are almost empty.** Only 4 recipes need one (strongbox, first_aid_kit,
   crossbow, feast). Seven sources (barrels 8%, perfect runs 3%, the daily craft task, Den
   150 scrap, contracts 10-20%, sites 0-35%, camps 25-45%) all draw from that pool of 4, so a
   player exhausts it in days. The schema already has a site field `fragment` (0-15%), which
   today is a *map* scrap. A "blueprint fragments" prestige currency can reuse every one of
   those source hooks.
9. **The legacy layer is tiny and hard-capped by design.** 8 perks, 21 ranks, 100 points to max,
   at most 43 points per season (3 + 6 categories x 5 + 10 Signal). It is capped at **+25% in
   any rate**, enforced in four places: CLAUDE.md:215, `parse.ts` `checkLegacy`
   (1001-1024), `perkBonusSchema` (max 25 per rank, `schema.ts:603-610`) and
   `domain/src/legacy.test.ts` (12,288 combinations), plus the simulator's veteran floor. A
   "MASSIVE tree" with x2/x10 prestige multipliers needs a logged decision that retires the
   25% guardrail, and those four checks rewritten.
10. **The reset machinery is reusable for the nuke.** `newBase(content, now, seed, carry)`
    (`base.ts:179`) plus `carryOver` (`legacy.ts:216`) and the one-transaction reset after a
    backup (D115) is exactly a prestige reset. Today it is owner-triggered and monthly; a
    player-triggered "red button" reset can sit on the same carry plumbing.
11. **The explosives chain is the natural nuke chain.** sulfur_ore -> sulfur -> gunpowder ->
    charge exists (W6) and today feeds only raids/camps/turret L3. The raw-expanded cost of
    one charge is 80 sulfur + 100 timber + 40 fibre at 10 workbench minutes. A warhead built on
    top of it gives the red button a cost players can see coming.
12. **Code constraints an exponential economy hits immediately.** All amounts are zod `z.int()`
    (`schema.ts:21`). "Integers in state" (CLAUDE.md:97) applies, with `Math.floor` on every
    accrual (`base.ts:373-379`), in one JSON document per base (D61). JS numbers are exact only
    to 2^53 (about 9e15). The shared formatter `abbrev` (`domain/src/words.ts:11-26`) stops at
    "B" (1e9), so 1e12 would print as "1000B". `pacing.json5` is asserted inside `pnpm test`, so
    any rebalance fails the build until its targets are replaced. Five tiers are fixed in code
    (`tiers.ts`) and checked to be exactly `[twig, wood, stone, metal, hqm]` (`parse.ts:383-390`).
13. **No SVG icons exist in the repo yet.** Every icon is a two-letter placeholder tile:
    resources via `packages/content/src/look.ts`, items via tier colour + initials
    (`apps/web/src/hud/Icon.tsx`), buildings/tiers/tools in `Build.tsx`, and dock actions as
    letters (`Dock.tsx` glyphs GA/CO, UP, CR, FU, MA, SQ, IN, DE, DF, FE, TA). Several ids
    **collide across kinds** (`stone` = resource + tier + node kind; `furnace` = building +
    furnace type; `ore`, `sulfur`, `anchor`, `gear`/`gears`). The owner's files must be
    namespaced by kind (D6 already prefixes `tier_` and `perk_`).

---

## 2. Entity inventory (every id; names from `locale/en.json`)

Counts first, then every id. "Survives" is my estimate of whether the id has a natural home
in an incremental redesign (see section 11). It tells the owner which icons are safe to draw now.

| Kind | Count | File | Survives a redesign? |
| --- | --- | --- | --- |
| resource | 23 | resources.json5 | yes (all; parts may merge) |
| tool | 5 | tools.json5 | yes (click-power ladder) |
| base_tier | 5 | base_tiers.json5, ids fixed in `tiers.ts` | yes (eras / colours) |
| furnace type | 3 | furnaces.json5 | yes (as furnace building tiers) |
| building | 18 | buildings.json5 | yes (as generators/upgrades) |
| item | 15 | items.json5 | partly (crates, meals, keycodes yes; gear depends on crew) |
| node kind / placed node | 5 / 7 | nodes.json5 | yes (click targets) |
| trait | 11 | traits.json5 | likely (manager/hero bonuses) |
| crew | 12 | crew.json5 | likely (managers) |
| region | 13 | regions.json5 | likely (expedition map) |
| site | 15 (12 ruins + 3 bandit camps) | sites.json5 | ruins yes; camps only if raids stay |
| trip event | 3 | events.json5 | likely |
| task | 8 | active.json5 | yes (quests) |
| perk | 8 | legacy.json5 | names yes, numbers no |
| skin | 3 | legacy.json5 | yes (cosmetics) |
| season modifier | 4 | seasons.json5 | only if seasons stay |
| Signal stage | 4 | seasons.json5 | only if seasons stay |
| contract | 12 | den.json5 | maybe (quests) |
| Den stock offer | 13 | den.json5 | maybe |
| casino: wheel / slots / dice | 6 / 6 / 4 | den.json5 | only if the Den stays |
| leaderboard category | 6 | domain `leaderboard.ts`, locale `ranks.*` | yes |
| dock action | 11 | `apps/web/src/hud/Dock.tsx` | yes (they change) |

### 2.1 Resources (23), `resources.json5`, with reference value per unit

| id | name | kind | value/unit |
| --- | --- | --- | --- |
| timber | Timber | raw | 0.02 |
| stone | Stone | raw | 0.02 |
| ore | Iron Ore | raw, smelts into ingots | 0.05 |
| ingots | Iron Ingots | refined | 0.08 |
| sulfur_ore | Sulfur Ore | raw, smelts into sulfur | 0.06 |
| sulfur | Sulfur | refined | 0.10 |
| fibre | Fibre | raw | 0.06 |
| hide | Hide | raw | 0.25 |
| fat | Animal Fat | raw | 0.30 |
| food | Food | raw | 0.06 |
| scrap | Scrap | currency | (the unit) |
| planks | Planks | part | 0.10 |
| rope | Rope | part | 0.25 |
| cloth | Cloth | part | 0.25 |
| leather | Leather | part | 0.80 |
| charcoal | Charcoal | part | 0.08 |
| fuel | Fuel | part | 0.60 |
| plates | Metal Plates | part | 1.20 |
| frames | Frames | part | 1.50 |
| gears | Gears | part | 4.00 |
| springs | Springs | part | 5.00 |
| gunpowder | Gunpowder | part | 0.50 |
| charge | Charges | part | 12.00 |

The value column spans x600 (timber to charge). It is the only existing "relative worth" table,
and it can seed exchange/conversion ratios in any redesign.

### 2.2 The other ids

- **tools (5):** rock (Rock), stone_tools (Stone Tools), iron_tools (Iron Tools),
  salvaged_tools (Salvaged Tools), power_tools (Power Tools).
- **base tiers (5, fixed in `packages/content/src/tiers.ts`):** twig (Twig), wood (Timber),
  stone (Stone), metal (Sheet Metal), hqm (Armored). These double as the rarity/colour scale for
  items, tools and site markers.
- **furnace types (3):** furnace (Stone Furnace), large_furnace (Large Furnace),
  electric_furnace (Electric Smelter).
- **buildings (18):** workbench, furnace, campfire, warehouse, garden, loom, bunkhouse,
  lights, tannery, kiln (Charcoal Kiln), press (Oil Press), watchtower, walls, traps, turret,
  generator, radio_mast, dock. Seventeen are drawn procedurally in the Pixi scene
  (`apps/web/src/scene/buildings.ts:728-771`); the furnace is placed separately.
- **items (15):** storage: crate (Storage Crate), large_crate, strongbox; med: bandage,
  first_aid_kit; weapon: bow (Hunting Bow), spear (Iron Spear), crossbow; armor: leather_vest;
  meal: roast, stew (Hearty Stew), feast; keycode: tin_keycode, copper_keycode, brass_keycode.
- **node kinds (5):** tree, stone, ore (Iron Ore), sulfur (Sulfur Ore), fibre. **Placed
  nodes (7):** tree_1..tree_4, ore_1, stone_1, sulfur_1. Fibre has a kind but no placed node.
- **traits (11):** scavenger, mule, navigator, marksman, demolition, medic, cautious, brave,
  lucky, cook, tinkerer.
- **crew (12):** mara, dax, ivo (start), rook, sela, bram, wren, otto, juno, pike, hale, tamsin.
- **regions (13):** landing, tidal_flats, pine_ridge, ferry_point, rust_bay, quarry_hills,
  stormcap, sulfur_springs, signal_hill, rail_yards, north_dam, the_narrows, open_water.
- **sites (15):** beach_wreck, old_campground, quarry, cannery, ferry_terminal, observatory,
  weather_station, flooded_mine, rail_depot, power_station, submarine_pen, offshore_platform;
  camps: driftwood_camp, saltpan_camp, cinder_fort.
- **trip events (3):** ambush, cache (Hidden cache), stranger (A stranger).
- **tasks (8):** gather_4, collect_3, node_hits_10, barrel_1, smelt_300, furnace_out_200,
  trip_1, craft_1.
- **perks (8):** steady_hands, deep_cellars, quick_fingers, hot_coals, old_maps, war_stories,
  old_friend, packed_crate. **skins (3):** driftwood, rust, beacon.
- **season modifiers (4):** long_nights, rich_tides, quiet_raiders, storm_season. **Signal
  stages (4):** foundation, tower, lamp, fuel.
- **contracts (12):** jetty_timber, seawall_stone, smithy_ingots, net_fibre, galley_food,
  rigging_rope, sail_cloth, hull_planks, lamp_fat, powder_sulfur, boots_leather, engine_gears.
- **Den stock (13):** planks_lot, rope_lot, cloth_lot, leather_lot, fuel_lot, plates_lot,
  frames_lot, gears_lot, springs_lot, stew_lot, feast_lot, first_aid_lot, blueprint_lot.
- **casino:** wheel gull, crab, anchor, lighthouse, crown, tide; slots bolt, gear, fish, anchor,
  lantern, beacon; dice over, under, seven, doubles.
- **leaderboard categories (6):** wealth, builder, explorer, trader, lucky, guard (titles:
  Wealthiest, Master Builder, Pathfinder, Merchant, Lucky Hand, Wallkeeper, Keeper of the
  Signal).
- **weather (visual only, not in the economy):** clear, rain, fog (locale `weather.*`; no
  data file; only `apps/web` reads it).
- **domain event types (58, `packages/domain/src/events.ts`):** feed/notification kinds such as
  gathered, collected, node_hit, barrel_broken, blueprint_found, build_done, building_done,
  crafted, salvaged, mission_back, raid_landed, raided, jackpot_won, signal_lit,
  perk_bought... They do not need icons, but the feed may want a few.

### 2.3 Locale/data drift to fix before reusing blurbs

- `building.garden.blurb` says "grow fibre"; the data grows **food** (D77 changed it).
- `building.dock.blurb` says "fishing brings in fat"; the data gives **food**.
- `building.furnace.blurb` says it turns "fat into fuel"; since D77 fuel comes from the **press**.

---

## 3. How a number goes up today (the production engine)

All lazy: state stores timestamps; values are computed on read (`base.ts` header).

- **Passive accrual** (`base.ts:463-474` `accrued`): `effectiveRates x seconds`, rounded down
  per resource, clamped to the storage cap per resource (`clampToCap`, 400-406). It runs at 50%
  (`decayProductionPercent`) for hours with unpaid upkeep. Node workers' output is added
  (`crewOutput`, `crew.ts:130`).
- **Effective rate** (`base.ts:385-397`): `tool.rates[r] x (100 + allRates + rates[r]) / 100`,
  plus the buildings' `flat` per hour (garden, dock food), scaled by the season's `flatPercent`.
  Every bonus is **additive percent**: no multiplicative stacking exists anywhere.
- **Modifiers aggregator** (`modifiers.ts:93-150`): sums every building level's effects, the
  legacy perks (rank x bonus) and the season modifier into one object. It is the single place
  a redesign's multipliers would plug in.
- **Gather (the click)** (`base.ts:517-532`): banks accrual, then adds `bonusMinutes` (30) of
  production at effective rates, +meal percent, capped by storage. Cooldown 10 min. Same
  30/10 for all five tools (`tools.json5:10-34`). **No daily cap.** Spamming every 10 min =
  passive x4; a casual 3 Gathers/day = +6%; hourly = +50%.
- **Node mini-game** (`nodes.ts`, `active.json5:8-15`): tap up to 5 markers, each within
  4.5 s (+3 s server grace). Each hit banks `hitMinutes` of the tool's rate for that resource
  (tree/stone/fibre 6 min, ore 12, sulfur 24). A perfect run pays +1 extra slice
  (`nodes.ts:194-196`). Respawn 20/20/45/120/20 real seconds. **Daily haul:** 180 min of
  production per UTC day pays in full (+30/60/90 from the bunkhouse), then 10% (`nodes.ts:30-36,
  197-213`; D63). A perfect run also rolls a 3% blueprint.
- **Furnaces** (`base.ts:694-800`): one job per slot takes all smeltable ore (capped by
  `maxOrePerJob` and fuel), burns fuel up front, outputs 1:1 over time, and output is capped by
  storage on collect.
- **Stations** (`craft.ts`, `crafting.json5`): each of the 6 stations runs a queue of batch
  jobs, paid up front. Parts are uncapped (`goods.ts:19-22`); the queues are their throttle.
- **Upkeep** (`base.ts:591-656`): every hour, the tier's upkeep + every building level's
  upkeep is taken from stock, with an implicit collect when short. Unpaid: production at 50%;
  after 72 h (+walls' graceHours 12/24/48) the dearest building loses a level, and when none is
  left the tier drops.
- **Scrap and parts are never lost to a full store** (`goods.ts:35-71`, `giveScrap`).

---

## 4. Resource-by-resource sources and sinks

Generated mechanically from the data (every table that names a resource). `L1..L3` = building
level; `/h` = per hour.

| Resource | Produced by | Consumed by |
| --- | --- | --- |
| **timber** | tools 120/240/400/700/1200 per h; tasks gather_4 (200), craft_1 (300) | tool costs (stone 240, iron 800); tier wood 1,500; **upkeep** wood 30, stone 40, metal 60, hqm 80/h; workbench/furnace/campfire/garden/loom/kiln L1; upkeep of campfire, warehouse, bunkhouse L2-3 (2-10/h); **furnace fuel** 50 (stone furnace) / 35 (large) per 100 ore, 0 for electric; recipes planks (60 per 10), charcoal (50 per 10); contract jetty_timber |
| **stone** | tools 80/180/320/560/1000 per h; task collect_3 (200); quarry loot 150-300 | tool costs; tiers wood 500, stone 6,000, metal 54,000; **upkeep** stone 100, metal 150, hqm 200/h; 25 building levels (walls L3 20,000, warehouse L3 12,000...); raid repair 800/3,000/8,000; Signal foundation 30,000; contract seawall_stone |
| **ore** | tools 0/60/150/300/560 per h; quarry 80-200, flooded_mine 150-400 | furnace only (-> ingots 1:1) |
| **ingots** | furnace from ore; task smelt_300 (50) | the main bottleneck: tiers stone 800, **metal 43,000, hqm 45,000**; upkeep metal 60, hqm 100/h; tools iron 250, salvaged 1,200, power 2,500; 20 building levels (generator L3 10,000, radio_mast/dock L3 8,000); recipes plates, frames, gears, springs, spear; contract smithy_ingots |
| **sulfur_ore** | tools 0/20/60/130/260 per h | furnace only (-> sulfur) |
| **sulfur** | furnace; flooded_mine 60-150; camps 60-140 / 120-260; NPC raid held 20-60/60-150/150-300 | recipe gunpowder (20 per 5); contract powder_sulfur. Nothing else: a dead-end chain apart from raids |
| **fibre** | tools 0/30/50/90/160 per h; loom +15/30/50%; barrel 10-30; task barrel_1 (20); old_campground 30-60 | garden L1-2, loom L1; recipes rope, cloth, stew; contract net_fibre |
| **hide** | tools iron 12, salvaged 30, power 60 per h; tannery +20/40/60%; barrel 5-15 | recipe leather only |
| **fat** | tools iron 4, salvaged 12, power 30 per h; press +20/40/60%; barrel 3-8; beach_wreck 5-15 | lights L1; recipes leather, fuel (10 per 5), first_aid_kit; contract lamp_fat |
| **food** | garden flat 10/25/50 per h; dock flat 8/20/40 per h; barrel 10-30; task trip_1 (40); beach_wreck, old_campground, cannery loot | meals (roast 30, stew 60, feast 120); **trip rations** (10-140 per trip); **scout fees** (20-200, total 1,060); contract galley_food |
| **scrap** | see section 7 | see section 7 |
| **planks** | workbench (10 per 2 min); ferry_terminal, driftwood_camp loot; Den stock | most widely used part: tier stone 200, iron tools, 21 building levels, crates, bow/spear/crossbow, frames, Signal 1,500 |
| **rope** | loom; beach_wreck, driftwood_camp; Den | iron tools 20, garden L3, loom L2, traps L1, dock L1-3, bow, crossbow |
| **cloth** | loom; three sites; Den | loom L3, bunkhouse L2-3, dock L2, charge, bandage, first_aid_kit, leather_vest |
| **leather** | tannery (2 per 6 hide + 1 fat); Den | tier metal 40, tannery L3, first_aid_kit, leather_vest |
| **charcoal** | kiln (10 per 50 timber); flooded_mine | springs, gunpowder only |
| **fuel** | press (5 per 10 fat); 4 sites; Den | tier hqm 400, **upkeep hqm 2/h**, lights L3 and generator upkeep 1-2/h; power tools 40; workbench/furnace L3, lights, generator (30/80/200); feast; **rations** at tier 3-5 sites (5-40); scouts in rings 3-5 (5-60); Signal 800 |
| **plates** | workbench L2 (5 per 40 ingots); 7 sites; Den | tiers metal 300, hqm 900; 17 building levels; large_crate, strongbox; Signal 300 |
| **frames** | workbench L2 (2 per 10 planks + 8 ingots); 2 sites; Den | tier metal 100; 11 building levels; strongbox; Signal 200 |
| **gears** | workbench L2 (2 per 20 ingots); 9 sites; Den | tools salvaged 40, power 80; tier hqm 200; 13 building levels; Signal 100; contract engine_gears |
| **springs** | workbench **L3** (2 per 16 ingots + 10 charcoal); 8 sites; Den | tools 20/60; tier hqm 150; 9 building levels; crossbow; Signal 60 |
| **gunpowder** | kiln (5 per 20 sulfur + 5 charcoal); cinder_fort; NPC raid held (metal) | traps L3, turret L2, charge (20 each) |
| **charge** | workbench L2 (1 per 20 gunpowder + 4 cloth, 10 min); NPC raid held (hqm) 1-2 | camp rations 2/4/8; turret L3 4; PvP 6/10 per attack (`raids.json5:68`) |

Items: crates and boxes are kept (they add cap while within the tier's `boxSlots`), meals are
served (consumed), bandage/first aid are consumed treating injuries (2 h / 6 h off), gear is
equipped (no durability, so never consumed), keycodes are spent on the way into their site.
Any item can be salvaged for 40% of its recipe + 1/2/4/8/15 scrap by tier (`crafting.json5:9-11`).

Keycode chain: tin (cannery 15%, ferry_terminal 40%) -> weather_station -> copper (50%; also
rail_depot 20%) -> rail_depot, power_station -> brass (40%) -> submarine_pen,
offshore_platform. Bad luck is capped at 3 dry successes (`regions.json5:20`).

---

## 5. Cost and rate curves

### 5.1 Tools (`tools.json5`): near-geometric rates (~x1.8), irregular costs

| Tool | Tier colour / minTier | timber | stone | ore | sulfur_ore | fibre | hide | fat | units/h | value/h | Cost (as listed) | Raw-expanded cost value |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rock | twig / - | 120 | 80 | - | - | - | - | - | 200 | 4.0 | free | 0 |
| stone_tools | wood / - | 240 | 180 | 60 | 20 | 30 | - | - | 530 | 14.4 | timber 240, stone 120 | 7.2 |
| iron_tools | stone / - | 400 | 320 | 150 | 60 | 50 | 12 | 4 | 996 | 32.7 | timber 800, stone 600, ingots 250, planks 60, rope 20 | 62.4 |
| salvaged_tools | metal / metal | 700 | 560 | 300 | 130 | 90 | 30 | 12 | 1,822 | 64.5 | ingots 1,200, **scrap 600**, gears 40, springs 20 | 750.8 |
| power_tools | hqm / hqm | 1,200 | 1,000 | 560 | 260 | 160 | 60 | 30 | 3,270 | 121.2 | ingots 2,500, fuel 40, **scrap 2,000**, gears 80, springs 60 | 2,356 |

- Units/h ratios step to step: **x2.65, x1.88, x1.83, x1.79**. Per resource, timber goes
  x2.00/1.67/1.75/1.71 and stone x2.25/1.78/1.75/1.79. Rarer resources grow faster: ore
  x2.5/2.0/1.87, sulfur_ore x3.0/2.17/2.0, fat x3.0/2.5. Close to geometric at ~x1.8 after the
  first step.
- Cost value ratios: x8.7, x12.0, x3.1. Payback at the new tool's value rate: 0.5 h, 1.9 h,
  11.6 h, 19.4 h. Most of the last two is scrap (600 and 2,000), deliberately (D87). `minTier`
  gates the last two tools behind the tier.
- Every tool: Gather bonus 30 min, cooldown 10 min (identical, so tools only scale the base rate).

### 5.2 Base tiers (`base_tiers.json5`): storage x3.3-4 per tier, costs irregular

| Tier | Cap | x prev | Crate slots (max with strongboxes) | Furnace slots | Builders | Build time | Cost | Raw-expanded value | x prev | Resource-hours (sim) | x prev | Upkeep/h (value/day) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| twig | 1,500 | - | 2 (+18k) | 1 | 1 | 0 | - | 0 | - | - | - | - |
| wood | 5,000 | 3.33 | 4 (+36k) | 1 | 1 | 0 | timber 1,500, stone 500 | 40 | - | 9.0 | - | timber 30 (14) |
| stone | 20,000 | 4.00 | 8 (+72k) | 2 | 2 | 4 h | stone 6,000, ingots 800, planks 200 | 208 | 5.2 | 27.1 | 3.0 | timber 40, stone 100 (67) |
| metal | 80,000 | 4.00 | 12 (+108k) | 3 | 2 | 12 h | stone 54,000, ingots 43,000, plates 300, frames 100, leather 40 | 4,840 | **23.3** | 259 | **9.6** | timber 60, stone 150, ingots 60 (216) |
| hqm | 300,000 | 3.75 | 16 (+144k) | 4 | 2 | 24 h | ingots 45,000, plates 900, gears 200, springs 150, fuel 400 | 4,747 | **0.98** | 129 | **0.50** | timber 80, stone 200, ingots 100, fuel 2 (355) |

- Raw units: 2,000 -> 8,000 -> 102,940 -> 59,950. Armored is cheaper than Sheet Metal in raw
  units (it is ingot-heavy instead of stone-heavy). The simulator flags all three steps
  (`sim.ts:1172-1198`; the guideline is `pacing.json5` `tierCostRatio` 3-6).
- Sheet Metal and Armored are both **ingot walls** (~45-55k ingots each). D112: "the metal
  tier is ingot-bound". At iron tools' 150 ore/h, 43k ingots is ~12 days of tool ore alone; crew
  node jobs and quarry/mine loot fill the gap.
- Rules: unpaid upkeep -> 50% production; 72 h unpaid -> lose the dearest building level, then
  a tier (`base_tiers.json5:7-12`).

### 5.3 Buildings (`buildings.json5`): 3 levels each, cost x3.1 per level, effects linear

Value = raw-expanded reference value. Every level needs one builder for `minutes`.

| Building | Unlock | L1 value / L2 / L3 | Level ratios | Build min | Effect L1 / L2 / L3 | Upkeep |
| --- | --- | --- | --- | --- | --- | --- |
| workbench | twig | 12 / 39 / 66 | 3.27, 1.69 | 0/30/120 | station levels (recipes, queue 2/3/4, batch 10/25/50) | - |
| furnace | twig | 14 / 105 / 402 | 7.49, 3.84 | 0/60/240 | furnace type 1/2/3 | - |
| campfire | twig | 3 / 13 / 85 | 4.27, 6.62 | 0/30/120 | allRates +2/4/6% (and kitchen) | timber 0/2/4 |
| warehouse | wood | 15 / 82 / 352 | 5.42, 4.27 | 20/120/360 | cap +2,000/6,000/15,000 | timber 0/5/10 |
| garden | wood | 7 / 11 / 25 | 1.50, 2.33 | 10/30/90 | food +10/25/50 per h | - |
| loom | wood | 16 / 25 / 130 | 1.59, 5.26 | 20/60/180 | fibre +15/30/50% | - |
| bunkhouse | wood | 16 / 73 / 214 | 4.69, 2.93 | 30/120/360 | crew +1/2/3, haul +30/60/90 min | timber 0/3/6 |
| lights | wood | 8 / 12 / 90 | 1.48, 7.26 | 10/30/120 | craft +10/20/35% | fuel 0/0/1 |
| tannery | stone | 22 / 56 / 242 | 2.59, 4.31 | 30/120/360 | hide +20/40/60% | - |
| kiln | stone | 24 / 81 / 192 | 3.38, 2.36 | 30/120/360 | furnace fuel -10/20/30 per 100 ore | - |
| press | stone | 11 / 58 / 184 | 5.18, 3.17 | 30/120/360 | fat +20/40/60% | - |
| watchtower | stone | 28 / 78 / 241 | 2.80, 3.07 | 60/180/480 | barrel life +15/30/45 min, warn +5/9/15 h, defence 2/4/6 | - |
| walls | stone | 40 / 151 / 496 | 3.77, 3.29 | 60/240/720 | grace +12/24/48 h, defence 10/20/35 | - |
| traps | stone | 34 / 55 / 153 | 1.59, 2.79 | 30/120/360 | defence 6/12/20 | - |
| turret | metal | 162 / 118 / 246 | 0.73, 2.08 | 180/360/720 | defence 20/35/55 | - |
| generator | metal | 60 / 439 / 1,084 | 7.36, 2.47 | 120/360/720 | smelt +20/40/60% | fuel 1/1/2 |
| radio_mast | metal | 111 / 346 / 772 | 3.12, 2.23 | 120/360/720 | barrels every -30/60/90 min, scout range +1 | - |
| dock | metal | 98 / 314 / 786 | 3.21, 2.51 | 120/360/1,440 | food +8/20/40 per h (dock L2/L3 reach the sea) | - |

- 36 level-to-level ratios: geometric mean **x3.10**, median x3.15, range x0.73-x7.49. Hand-tuned.
- Effects are totals per level and rise roughly linearly (x2, then x1.5). So marginal benefit
  per scrap falls ~2-4x per level. An incremental game wants the inverse: cheap repeated buys
  with periodic multiplicative milestones.
- Equivalence for planning: one current level step (x3.1 cost) = about 8 purchases at a 1.15
  growth rate (ln 3.1 / ln 1.15 = 8.1), or about 17 purchases at 1.07.
- Total value of all 54 levels: 8,497. Tiers 9,835. Tools 3,177. **Whole season ~21.5k.**

### 5.4 Furnaces (`furnaces.json5`)

| Type | Building level | Ore/h per slot | x prev | Fuel per 100 ore (timber) | Max ore per job | Job length at max |
| --- | --- | --- | --- | --- | --- | --- |
| furnace | furnace L1 | 120 | - | 50 | 1,000 | 8.3 h |
| large_furnace | furnace L2 (Stone) | 400 | 3.33 | 35 | 5,000 | 12.5 h |
| electric_furnace | furnace L3 (Sheet Metal) | 1,200 | 3.00 | 0 | 20,000 | 16.7 h |

Slots 1/1/2/3/4 by tier. Speed: generator +20/40/60%, perk hot_coals +3/6/9%. Fuel: kiln
-10/20/30. Max throughput at Armored: 4 x 1,200 x 1.69 = ~8.1k ore/h, and that is the late-game
ingot pile seen in the simulator.

### 5.5 Recipes (`recipes.json5`): value added is inconsistent, several parts destroy value

Per output unit, at reference prices (`in` = input value, `out` = output's ref value).

| Output | Station L | Minutes per unit | In | Out | x | Raw per unit |
| --- | --- | --- | --- | --- | --- | --- |
| planks (x10) | workbench 1 | 0.2 | 0.12 | 0.10 | **0.83** | timber 6 |
| rope (x5) | loom 1 | 0.6 | 0.36 | 0.25 | **0.69** | fibre 6 |
| cloth (x5) | loom 1 | 0.8 | 0.48 | 0.25 | **0.52** | fibre 8 |
| leather (x2) | tannery 1 | 2.5 | 0.90 | 0.80 | 0.89 | hide 3, fat 0.5 |
| charcoal (x10) | kiln 1 | 0.4 | 0.10 | 0.08 | 0.80 | timber 5 |
| fuel (x5) | press 1 | 0.8 | 0.60 | 0.60 | 1.00 | fat 2 |
| plates (x5) | workbench 2 | 1.0 | 0.64 | 1.20 | 1.88 | ingots 8 |
| frames (x2) | workbench 2 | 2.5 | 0.82 | 1.50 | 1.83 | timber 30, ingots 4 |
| gears (x2) | workbench 2 | 3.0 | 0.80 | 4.00 | **5.00** | ingots 10 |
| springs (x2) | workbench 3 | 4.0 | 1.04 | 5.00 | **4.81** | ingots 8, timber 25 |
| gunpowder (x5) | kiln 1 | 0.6 | 0.48 | 0.50 | 1.04 | sulfur 4, timber 10 |
| charge | workbench 2 | 10 | 11.0 | 12.0 | 1.09 | sulfur 80, timber 100, fibre 40 |
| crate | workbench 1 | 5 | 3.0 | 20 | 6.67 | timber 180 (+1,000 cap) |
| large_crate | workbench 2 | 15 | 18 | 60 | 3.33 | timber 360, ingots 80 (+4,000 cap) |
| strongbox (bp) | workbench 2 | 30 | 39 | 150 | 3.85 | timber 300, ingots 200 (+9,000 cap) |
| bandage | loom 1 | 2 | 0.5 | 4 | 8.0 | fibre 40 |
| first_aid_kit (bp) | workbench 2 | 10 | 4.3 | 15 | 3.49 | fibre 80, fat 5, hide 6 |
| bow | workbench 1 | 10 | 2.25 | 15 | 6.67 | timber 60, fibre 30 |
| spear | workbench 2 | 10 | 3.0 | 10 | 3.33 | timber 60, ingots 25 |
| leather_vest | tannery 1 | 15 | 7.4 | 25 | 3.38 | hide 24, fat 4, fibre 40 |
| crossbow (bp) | workbench 3 | 30 | 24.5 | 40 | 1.63 | timber 220, ingots 32, fibre 60 |
| roast | campfire 1 | 10 | 1.8 | 3 | 1.67 | food 30 (+10% for 4 h) |
| stew | campfire 2 | 20 | 4.2 | 8 | 1.90 | food 60, fibre 10 (+20% for 6 h) |
| feast (bp) | campfire 3 | 30 | 10.2 | 20 | 1.96 | food 120, fat 10 (+30% for 8 h) |

Rules: `queueSlots` [2,3,4], `batchSize` [10,25,50] by station level; lights +10/20/35%,
station worker +15%, tinkerer +30% (any station), cook +50% (campfire), perk quick_fingers
+3/6/9%. Queue depth sets the check-in rhythm: planks at L1 = 2 jobs x 10 runs x 2 min = 40 min;
gears at L2 = 3 x 25 x 6 = 7.5 h; at L3 = 4 x 50 x 6 = 20 h.

### 5.6 Crew, sites and regions

- **Crew** (`crew.json5`): 3 start, cap 4 + bunkhouse 1/2/3 = 7 max (the simulator reaches 7 by
  day 17-19), one arrival per 24 h. Cumulative XP 100, 250, 450, 700, 1,000, 1,400, 1,900,
  2,500, 3,200 (levels 2-10; mostly +50 to +100 per step, near-quadratic). +3 success per level,
  +5 per companion, +4 for a bonded pair (3 trips). Jobs: a node worker adds 15% of the tool's
  rate for that node (+15 mule); a station worker +15% speed; a guard 5 defence; tired after
  16 h awake -> 50% until an 8 h rest.
- **Sites** (`sites.json5`): trip 30 -> 720 min (x24), base chance 85 -> 35%, rolls 2 -> 6,
  XP 20 -> 220, injury 8 -> 32%. Scrap EV per success 3.3 -> 129.6 (x39) but **per hour only
  2.3-10.8 scrap**. Non-scrap loot value per success 2 -> 119. Rations 0 -> food 140 + fuel 40.
  Camps cost charges (2/4/8) and pay the richest non-scrap loot (26/62/110 value) and blueprint
  chances 25/35/45%.
- **Regions** (`regions.json5`): 13 regions in rings 0-5. Scout reach by tier 1/1/2/3/4 (+1
  radio mast). Total scout fees: scrap 515, food 1,060, fuel 135; scout time 1 min -> 24 h
  (open water). Sea regions need the dock (L2, L3) and a navigator.

---

## 6. Storage caps and the check-in rhythm

Cap per resource = (tier cap + biggest crates up to `boxSlots` + warehouse) x (100 +
deep_cellars %) / 100 (`base.ts:315-326`). Parts, scrap and items are uncapped. Reaching the cap
stops accrual and never destroys anything (CLAUDE.md section 8).

Hours to fill the bare tier cap with timber:

| Tier \ tool | rock | stone_tools | iron_tools | salvaged | power |
| --- | --- | --- | --- | --- | --- |
| twig 1,500 | **12.5** | 6.3 | 3.8 | 2.1 | 1.3 |
| wood 5,000 | 41.7 | **20.8** | 12.5 | 7.1 | 4.2 |
| stone 20,000 | 167 | 83 | **50** | 28.6 | 16.7 |
| metal 80,000 | 667 | 333 | 200 | **114** | 66.7 |
| hqm 300,000 | 2,500 | 1,250 | 750 | 429 | **250** |

(bold = the pairing a player normally has.) With crates and the warehouse, the simulator's caps
are 24k-62k at Stone, 122k-161k at Sheet Metal and 381k-483k at Armored. So **storage only bites
in the first two days**. After that it is a late-game ceiling for players with nothing left to
buy (active/optimal at 100% from about day 22-27). What actually sets the check-in rhythm:

| Driver | Period |
| --- | --- |
| Gather cooldown | 10 min |
| Node respawn | 20-120 real seconds (daily haul 180-270 min of production) |
| Barrel | every 240 min (radio mast -30/60/90, rich_tides -60), lives 45 min (+15/30/45 watchtower) |
| Station queue | 40 min (L1 planks) to 20 h (L3 gears) |
| Furnace job | 8.3 / 12.5 / 16.7 h at max |
| Builds | 0-24 h (tiers 0/0/4/12/24 h; levels 0-1,440 min) |
| Trips / scouts | 30 min-12 h / 1 min-24 h |
| Daily | tasks (3), Den counter and contracts (UTC day), upkeep cover |
| Nightly | NPC raid window 20:00-23:00 UTC, every ~2 days from Stone |

---

## 7. The scrap economy

### 7.1 Sources (expected values)

| Source | Amount | Notes |
| --- | --- | --- |
| Barrel | EV **3.16** per barrel (2 rolls; scrap weight 30/95, 2-8) | max 6/day at 240 min; casual catches a few; 8% blueprint |
| Daily tasks | 5-10 each, mean 7.9; 3/day -> **~24/day** | `active.json5:31-43`; probably the biggest steady source for casual players |
| Sites (success) | t1 3.3-3.5; t2 9-26; t3 18-38; t4 54-59; t5 81-130 | per trip-hour only 2.3-10.8. D104 cut late-site scrap to 60% |
| Camps (success) | 6 / 12 / 21.6 | charges in, parts and sulfur out |
| NPC raid held | 10-25 / 25-60 / 50-120 by tier | about every 2 nights from Stone |
| Contracts | 40% of reference value: stone tier 6-24, metal 13-80, hqm 38-200 per contract | 3/day, delivering resources |
| Salvage | 1/2/4/8/15 per item by tier + 40% of its recipe | |
| Market sales | player to player (zero-sum minus fees) | |
| Casino | negative EV | |

### 7.2 Sinks

| Sink | Amount |
| --- | --- |
| Tools | salvaged 600, power 2,000 (**2,600**, the big two) |
| Scouting | 515 total over 11 paid regions (5-100 each) |
| Den counter | lots at 250% of reference: 12.5-62.5 scrap; blueprint 150 |
| Market fee | 5% of the asking price (min 1) |
| Casino edge | RTP: wheel 91.2-92.8%, slots 93.4%, dice 91.7-93.3%; jackpot 1 in 6,332 spins, pays 200x + the pool (1% feed). Daily wager cap 50 / 150 / 250 by tier (max bet 10/25/50) |
| Raid repair | 30 / 80 / 150 (+ stone) |
| Raid loss | 5% of yard and scrap, scrap ceiling 50 / 150 / 300 |

### 7.3 Balances (simulator today, 35 days)

Casual scrap on days 14/21/28/35: **962 / 1,091 / 2,953 / 3,214** (Den spent 1,092, earned 848;
10 NPC raids, 5 held; 12 camp trips). Gambler: 1,101 / 558 / 1,611 / 3,754, wagered 5,000 and
won 5,840 on this seed (D104 explains the variance). Optimal 31 days: 8,383. Pacing target:
casual 800-4,000 on day 28 (`pacing.json5:27`).

**Reading:** scrap is a slow, loot-driven currency in the hundreds-to-thousands, owned by the
loot tables and the Den. "Make scrap rarer" would mean trimming sites/tasks/barrels further. A
cleaner move for a prestige economy: keep scrap as a mid-run hard currency and add a separate
prestige currency (blueprint fragments / fallout) computed from run progress, not from loot.

---

## 8. Blueprints

- 4 blueprint recipes (strongbox, first_aid_kit, crossbow, feast); D79 forbids blueprints on
  parts, enforced by `parse.ts:547-549`. Kept across seasons (D116).
- Sources: barrel 8% (`crafting.json5:16`), perfect node run 3% (`:18`), daily `craft_1` task
  always pays one while any are left (`active.json5:41`), Den `blueprint_lot` 150 scrap 1/day,
  contracts rigging_rope/sail_cloth 10%, boots_leather 15%, engine_gears 20%, sites 0-35% on
  success, camps 25/35/45%. All draw only from blueprints the base does not know yet
  (`recipes.ts:152-183`).
- There is also a separate per-site `fragment` field (map scrap, 0-15%) that reveals a land
  region (`missions.ts:640-734`).
- Implication: the hooks for a collectible meta currency already exist at every source. The
  pool behind them is what is missing.

---

## 9. Legacy and seasons

- **Points** (`legacy.json5:6`): 3 for playing, 5/3/2/1 for 1st-4th in each of 6 categories,
  up to 10 for a share of the Signal. Max 43 per season; on a 2-player server about 21-43.
- **Perks** (all `cost` per rank; cap check at `parse.ts:1001-1024`):

| Perk | Per rank | Ranks | Cost | Total | At top |
| --- | --- | --- | --- | --- | --- |
| steady_hands | allRates +2% | 3 | 3/5/8 | 16 | +6% |
| deep_cellars | cap +3% | 3 | 3/5/8 | 16 | +9% |
| quick_fingers | craft +3% | 3 | 3/5/8 | 16 | +9% |
| hot_coals | smelt +3% | 3 | 3/5/8 | 16 | +9% |
| old_maps | trip success +2 | 2 | 4/6 | 10 | +4 points (11.4% of the weakest site's 35%) |
| war_stories | crew XP +6% | 3 | 3/5/8 | 16 | +18% |
| old_friend | best veteran home day 1 | 1 | 6 | 6 | |
| packed_crate | a crate on day 1 | 1 | 4 | 4 | |

  100 points max out the whole tree: 3-5 seasons. Effect: veteran Armored on day 14 vs optimal
  day 15 (D117; the simulator today: veteran Stone d2, Metal d8, Armored d14).
- **Kept across a reset (D116):** blueprints, crew levels/XP, perks, titles, skins. **Lost:**
  everything else (`season.test.ts` asserts that a new base = a fresh base + carry).
- **Season modifiers (4):** long_nights raid strength +20%; rich_tides barrels -60 min and +1
  roll; quiet_raiders +1 raid day, -25% strength; storm_season barrels -90 min, food flat -30%,
  trip loot +10%.
- **The Signal (4 stages):** foundation stone 30,000 + planks 1,500 (750 value); tower frames
  200 + plates 300 (660); lamp gears 100 + springs 60 (700); fuel 800 (480). ~2,590 value in
  all; opens day 21 or at the announcement. The casual target is to fill 1 stage from surplus.

---

## 10. Pacing targets (`pacing.json5`) and the rhythm they encode

| Target | Value | Implies |
| --- | --- | --- |
| Casual tiers | Stone d3-4, Sheet Metal d12-14, Armored d15-28 | one tier per ~week; a month-long arc |
| Buildings | 6 standing by day 7 | slow fill |
| First made | planks d2, bow d4, leather d9, plates d10, springs d18 | the crafting web opens over 3 weeks |
| Stations | all used by day 14 | |
| Trips | first by d2; tier 3 by d14, tier 4 by d26, tier 5 by d31 | the map lasts the whole month |
| Jobs | crew on a job by d3; 5 crew by d10 | |
| Tool | salvaged_tools by d18 | site scrap pays for it |
| Scrap | 800-4,000 on d28 | scrap scarce on purpose |
| Raids | first by d8; >= 30% held by d28; first camp by d16 | |
| Signal | casual fills 1 stage | |
| PvP | raider gets in 3+ times; raided casual still Armored by d28 | |
| Optimal floors | Armored not before d14; tier 3 not before d7; offshore_platform not before d18 | anti-rush ceilings, the opposite of incremental speed-ups |
| Tier cost ratio | 3-6x per tier (advisory) | currently violated (x3.0, x9.6, x0.5) |

The simulator schedules (`sim.ts:83-91`): casual at hours 8/13/21, active 8 times a day,
optimal and veteran every hour. **Today's run (31 days):** casual Stone d4, Metal d14, Armored
d23, power tools d31; active d2/d12/d18; optimal d2/d9/d15; veteran d2/d8/d14. First trips by
tier for casual: t1 d1, t2 d5, t3 d14, t4 d20, t5 d27.

These targets describe a **slow monthly arc with anti-rush floors**. In an incremental design
the equivalent targets are run-based: time to the first prestige, the speed-up of the Nth run
over the first, multiplier per prestige, and session yield. The simulator harness
(archetypes, `manualClock`, `checkPacing`, inside `pnpm test`) is reusable. The targets are not.

---

## 11. Reuse classification for an exponential, multiplicative incremental design

Assumed target model (from the brief): many repeatable purchases with cost
`base x r^n` (r 1.07-1.15), multiplicative upgrades, click power that scales with production,
automation (managers), a player-triggered reset (the red button) granting prestige currency,
and a large tree.

### 11.1 Reuse as-is (ids, structure and most fields)

| Table | Why it fits |
| --- | --- |
| `resources.json5` ids, kinds, `smeltsInto` | the resource graph (raw -> refined -> part) is a ready Melvor-style chain; names/icons stay |
| `den.market.refPer100` | the only relative-value table; use it to set conversion ratios and to price new resources |
| `nodes.json5` kinds/placements | click targets on the scene; respawn seconds already active-play scale |
| `crew.json5` ids + `traits.json5` | crew = managers/heroes; traits are ready bonus archetypes (loot, speed, craft, guard) |
| `regions.json5` graph + `sites.json5` ids, hazards, loot-table format | idle expeditions (Egg Inc ships, Melvor dungeons); the weighted loot format and keycode chain work at any scale |
| `events.json5` | bounded expedition events |
| `items.json5` categories (storage, meal, keycode) | meals = timed boosts (Cookie Clicker buffs); keycodes = gate items |
| tiers (`tiers.ts`) as colours/rarity and era names | five eras per run, the visual scale everywhere |
| `odds.ts` + casino RTP checks | if a scrap casino stays, it is already correct and tested |
| `legacy.json5` perk/skin **ids and names** | seed nodes for the tree; skins as cosmetics |
| reset plumbing (`newBase` + `carryOver`, D115) | the prestige reset |
| `crafting.json5` salvage + blueprint source hooks | reuse every source for fragments |

### 11.2 Keep the ids, rescale or reshape the numbers

| Table | Today | Needed |
| --- | --- | --- |
| `tools.json5` | 5 rungs, rates x~1.8, flat 30-min Gather on a 10-min cooldown | click-power ladder: click = % of production per second (Cookie Clicker), no cooldown early (owner's "click like crazy"), automation later |
| `buildings.json5` | 18 x 3 hand-tuned levels, linear effects, build timers | 18 generators/upgrades with `baseCost`, growth `r`, per-unit effect, milestone multipliers (x2 at 10/25/50/100...). L1 cost can seed `baseCost`; L2/L3 are dropped |
| `base_tiers.json5` | 5 tiers, caps x3.3-4, irregular costs, upkeep | era gates inside a run (unlock new chains), costs on one geometric curve; storage -> offline-time cap (Egg Inc silos) or removed |
| `furnaces.json5` / `recipes.json5` | fixed rates, batch/queue throttles, inconsistent value-add (0.52-5.0) | converters that scale with level/automation; normalise value-add so every step is worth automating (no value-destroying parts) |
| `active.json5` | daily haul cap 180 min then 10%; barrels 4 h; tasks 3/day | lift the caps early in a run (or replace with combo/frenzy mechanics); barrels as golden-cookie style random bonuses; tasks as quests |
| `legacy.json5` | 8 perks, +25% cap, 100 points | the MASSIVE tree: hundreds of nodes, multiplicative, points from the nuke formula. Requires retiring the 25% guardrail (CLAUDE.md:215 and checks) |
| `crew.json5` levels | XP to level 10, +3 success per level | manager levels with multiplicative effects |
| `den.json5` contracts | fixed amounts by tier | quests scaled to current production (amount = k x rate) |
| `pacing.json5` | monthly tier days and anti-rush floors | run-based targets (first nuke at ~X h, Nth run faster, etc.) |

### 11.3 Likely dead weight in an incremental model

| System | Why |
| --- | --- |
| **Upkeep and decay** (`base_tiers` upkeep, `rules`, building upkeep, walls `graceHours`) | punishes idling; no incremental game does it |
| **Build timers on every level** (`minutes`, `buildMinutes`, builders 1-2) | incremental purchases are instant; keep timers only for rare big projects |
| **Per-resource storage caps** as the main check-in driver | replace with an offline-production cap |
| **Raids and PvP** (`raids.json5`, defence effects, traps/turret, camps' charge sink, D106-D113) | % losses are meaningless against exponential numbers, and PvP between a fresh player and a 10-prestige veteran is broken. A possible future is an "event" layer |
| **Player market** (`den.market` listings, escrow, fees) | exchanging exponential goods between players at different prestige levels breaks; the Den counter can survive as a shop |
| **Monthly seasons, modifiers and the Signal** (`seasons.json5`, D114-D120) | the nuke replaces the monthly reset as the prestige loop; seasons could survive only as an optional leaderboard/event cadence |
| **Anti-rush pacing floors** (Armored >= d14, platform >= d18) and the 1.6x active cap | contradict "the more you play, the faster you go" |
| **Gear on crew** (bow, spear, crossbow, leather_vest) | only matters if expeditions keep success/injury rolls |

### 11.4 Code constraints (economy-relevant) a plan must budget for

- Integers everywhere: `amounts` is `z.int().min(0)` (`schema.ts:21`), "Integers in state"
  (CLAUDE.md:97), `Math.floor` accrual (`base.ts:373-379`), one JSON document per base (D61).
  An exponential economy needs a big-number type (mantissa + exponent, e.g. a break_infinity-style
  Decimal), stored as strings or pairs, and a decision record replacing the integer rule.
- Formatter `abbrev` (`domain/src/words.ts:11-26`): only k/M/B. It needs T, Qa, Qi... or
  scientific/engineering notation, shared by web and bot.
- Additive percent stacking (`base.ts:389`, `modifiers.ts`): every bonus is summed. Incremental
  progression needs multiplicative buckets (additive within a bucket, multiplied across).
- Content validators that will reject a redesign: the tier list and increasing caps
  (`parse.ts:383-398`); the legacy 25% cap (`parse.ts:1001-1024`, `schema.ts:603-610`);
  "every part has a recipe and a use" (`parse.ts:551-593`); "every tradeable good has a price"
  (`parse.ts:874-879`); the camp/charge and raids checks (`parse.ts:949-993`). Also
  `pacing.json5` runs inside `pnpm test` (`packages/sim`).
- Lazy settlement is compatible: closed-form production over time works for exponential models
  as long as growth inside a settle window is closed-form (generators bought by the player are
  step changes, so it stays piecewise linear).

### 11.5 Translating today's numbers (orientation only)

- Cost of the n-th unit = `base x r^(n-1)`; cost of n units = `base x (r^n - 1)/(r - 1)`.
  At r = 1.15 the 100th unit costs ~1.0e6 x base; at r = 1.07 ~811 x base. So a single
  generator line covers more range than the whole current season (x30).
- The current season's purchase count (62) vs a typical incremental run: hundreds of purchases
  per run, plus upgrades. The redesign's 18 buildings x (say) 100-400 levels each fills that
  without new ids.
- Ref value per hour at the end of a season (121/h) vs everything purchasable (21.5k): ~178 h.
  The redesign needs sinks that grow faster than income (exponential costs) and a reset that
  converts the surplus (the nuke) into the meta currency.

---

## 12. Icons: what exists, what is needed, what to watch

**In the repo today: no SVG game icons at all.** `apps/web/public` holds only the app icons
(`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, drawn by `apps/web/scripts/icons.mjs`).
Every in-game icon is a placeholder `Tile` (tinted square + two letters):

| Where | Placeholder source |
| --- | --- |
| resources (23) | colour + fixed initials in `packages/content/src/look.ts:5-56`, used by `ResourceIcon` (`apps/web/src/hud/Icon.tsx:33-49`) and the bot's cards |
| items (15) | tier colour + initials of the name (`Icon.tsx:51-62`) |
| buildings, tiers, tools | tier colour + initials in `hud/panels/Build.tsx:151, 256, 304` |
| dock actions (11) | letters GA/CO, UP, CR, FU, MA, SQ, IN, DE, DF, FE, TA (`hud/Dock.tsx:118-259`) |
| casino symbols | lettered tiles (`hud/panels/Games.tsx:333, 404`; `docs/ui-review.md:695`) |
| top bar | "you" and SQ tiles (`hud/TopBar.tsx:72, 123`) |
| scene | buildings, nodes, the Den skiff, barrels, the Signal are procedural Pixi drawings (`apps/web/src/scene/*`), not icons |

CLAUDE.md 6.2 asks for exactly one icon per resource, item, building, site and action.
D8 says actions may use Unicode, and only game things get custom art.

**Id collisions the icon files must survive** (name them by kind, e.g. `resource/stone.svg`,
`tier/stone.svg`; D6 already prefixed `tier_` and `perk_` for the old bot's emoji namespace):

- `stone`: resource, base tier, node kind
- `furnace`: building and furnace type
- `ore`: resource and node kind; `sulfur`: refined resource and node kind (the node yields
  `sulfur_ore`); `fibre`: resource and node kind
- `anchor`: wheel segment and slot symbol; `gear` (slot symbol) vs `gears` (resource)
- `beacon`: slot symbol and skin; `fuel`: resource and Signal stage

**Suggested drawing priority** (safe under any redesign first):

1. Resources (23), especially scrap, the five raw basics and the ingots; tools (5); the five
   tier badges.
2. Buildings (18) as panel icons (the scene keeps its own drawings).
3. Items: crates (3), meals (3), keycodes (3).
4. Crew portraits (12) and traits (11), if managers/heroes are adopted.
5. Sites (15) and regions (13), if expeditions stay.
6. **Wait for the plan:** casino symbols (16), raid-only ids (traps, turret, three camps,
   charge/gunpowder unless they become the nuke chain), season modifiers (4), Signal stages (4),
   contracts (12), Den stock (13), dock actions (they will change).

New ids the redesign will probably need icons for: the prestige currency (e.g. blueprint
fragments / fallout), the red button / warhead, tree-node categories, and automation/manager
badges.

---

## 13. File index (for the planner)

- Data: `E:\Work\myprojects\wipe-day\packages\content\data\` (resources, tools, nodes, active,
  base_tiers, furnaces, crafting, items, recipes, buildings, den, sites, regions, crew, traits,
  events, raids, legacy, pacing, seasons `.json5`)
- Schemas and checks: `packages/content/src/schema.ts` (801 lines), `parse.ts` (1,046 lines),
  `odds.ts`, `tiers.ts`, `look.ts`, `load.ts`, `load.test.ts`
- Rules applying the numbers: `packages/domain/src/base.ts`, `modifiers.ts`, `nodes.ts`,
  `goods.ts`, `craft.ts`, `crew.ts`, `missions.ts`, `raids.ts`, `legacy.ts`, `words.ts`
- Simulator: `packages/sim/src/sim.ts` (archetypes, schedule line 83, rawCost 960, checks
  979-1200), `cli.ts`
- Decisions on economy tuning: `docs/decisions.md` D62, D63, D77, D79, D87, D97, D104, D112, D117
- Icons: `apps/web/src/hud/Icon.tsx`, `apps/web/src/hud/Dock.tsx`,
  `apps/web/src/hud/panels/Build.tsx`, `packages/content/src/look.ts`,
  `apps/web/scripts/icons.mjs`
