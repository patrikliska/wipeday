# Wipe Day game design: a deep idle game about rebuilding on a wrecked island

This is the long-term design. The prototype covers about a tenth of it. Every system here is
meant to be added in the phase order of `docs/roadmap.md`, and every number in it is a target
for the simulator, not a promise. Names marked *(proposal)* need your final pass.

## 1. Vision and pillars

A survival-flavoured idle game you check three times a day for two minutes, and could play for
twenty if you feel like it. You run a small holdfast on a wrecked island: gather, refine, build,
craft, send your crew to ruins, trade, gamble a little, defend, and once a month the tide
resets everything except what you have learned.

Pillars, in priority order:

1. **Always a decision.** Every check-in offers a real choice, not a button to press: what to
   queue, whom to send where, what to bet, what to sell.
2. **Chains, not counters.** Progress comes from connecting things (ore → ingots → gears →
   turret), never from one number going up.
3. **The base tells the story.** Everything you own is visible in the scene. A stranger should
   read your progress from a screenshot.
4. **Respect the clock.** Nothing needs more than two minutes; nothing punishes a day away
   beyond a full storage.
5. **Own world.** Own names, own sites, own items. Nothing lifted from another game.

## 2. The idle contract (guardrails)

These hold for every system, and the simulator asserts the numeric ones.

- A session of 3 check-ins a day makes steady progress; 8 check-ins is about 1.6× faster,
  never more. Active play is a bonus, not a requirement.
- No timer shorter than 10 minutes except the active mini-games; no timer longer than 24 hours
  except season-scale projects.
- Storage caps are the check-in driver. Reaching the cap wastes nothing that is not obviously
  excess; overflow never destroys items, only stops accrual (food spoils, but slowly).
- Coming back after days gets a "welcome back" summary and a catch-up bonus (an extra
  expedition report, a grace period on upkeep). Nobody logs in to a ruin.
- Every unlock has a one-line hint and is revealed only when it is affordable. Hints disappear
  after two uses. No tutorial, no help dependency.
- Notifications are opt-in per type, off by default except "expedition back" and "raided".
- Randomness is bounded: expected value visible before every risky action, streaks capped,
  jackpots announced. Losing never removes progress permanently within the season except the
  rare survivor death, which is telegraphed.

## 3. Time scales and loops

| Scale | Loop | What the player does |
| --- | --- | --- |
| seconds | node mini-game, barrels, casino spins | tap, hit markers, bet |
| 10–30 min | gather cooldown, short crafts, short expeditions | queue, send, collect |
| 1–8 h | furnaces, builds, mid expeditions, market listings | plan the next check-in |
| a day | tasks, upkeep, weather, night raids, contracts | assign the crew, trade |
| a week | tiers, research branches, site chain | pick a specialisation |
| a month | season arc, finale project, reset | compete, finish, prestige |
| forever | legacy tree, blueprints, hall of fame | come back next season |

The rule for a healthy design: each scale feeds the next. Seconds produce the resources that
hours refine, hours produce the components that days assemble, days produce the standing that
weeks rank, and the month leaves a legacy.

## 4. World and names (own IP)

*(proposal)* The island is **Saltmarsh**, a wrecked resort-and-industry island after "the
Quiet" (the collapse). Players run a **holdfast**. Their people are the **crew**. Ruins are
**sites**. The neutral trading post is **the Den**, run by smugglers; it hosts the market and the
games. Explosives are **charges**. Scrap is scrap. Access items for deeper sites are
**keycodes** (green, blue, red replaced by tin, copper, brass tokens *(proposal)*).

Base tiers: Twig, Timber, Stone, Sheet Metal, Armored (already in the prototype).

Sites, low to high tier *(proposal, deliberately not a copy of any other game's list)*:

| Site | Tier | Flavour | Typical loot |
| --- | --- | --- | --- |
| Beach wreck | 1 | a fishing boat on the rocks | cloth, rope, fat, scrap |
| Old campground | 1 | tents, a shop shell | food, fibre, bandages |
| Quarry | 2 | flooded pit, machines | stone, ore, gears |
| Cannery | 2 | rusted lines, cold store | food, fuel drums, springs |
| Ferry terminal | 2 | cars, ticket halls | scrap, wiring, tin keycode |
| Observatory | 3 | hilltop dome | lenses, wiring, blueprints |
| Weather station | 3 | the first electric loot | batteries, copper keycode |
| Flooded mine | 3 | sulfur veins, gas | sulfur, HQ ore, charges |
| Rail depot | 4 | locomotives, cranes | plates, engines |
| Old power station | 4 | turbines | generators, brass keycode |
| Submarine pen | 5 | the deep site | rare blueprints, armour |
| Offshore platform | 5 | boat only, the season's peak | everything, at risk |

## 5. Systems

Each system: what it is, when it unlocks (casual player), the decisions it adds, why it fits
idle play, and how deep it goes over the tiers.

### 5.1 Gathering and nodes

- Passive rate from tool tier and crew assignments; nodes near the base (trees, rocks, fibre,
  a sulfur seam, a tide pool, later a mine shaft and a garden).
- Nodes have **quality** (rich/normal/poor) that shifts weekly with weather and events; the
  player picks which node each crew member works.
- The active mini-game (hit five markers) gives a burst; a perfect run gives a rare drop.
- Depth ladder: rock → stone tools → iron tools → salvaged tools → power tools (fuel) →
  automated rigs (electricity, W2/W3), each adding new resources (HQ ore, sulfur, hide).
- Unlocks: day 1. Idle fit: rates and caps, decisions only at check-in.

### 5.2 Storage and logistics

- Per-resource caps from the core tier plus crates and a warehouse building; food spoils
  slowly past the cap.
- **Logistics upgrades** are the idle-game automation ladder: wheelbarrow (bigger active
  bonus), cart (crew carry more), auto-collect (accrual banks itself every hour), hoppers
  (furnaces feed themselves from storage), conveyor (crafting pulls inputs automatically).
- Unlocks: crates day 1, warehouse week 1, automation from week 2.

### 5.3 The base and its buildings

The core (Twig → Armored) gates everything; around it, buildings with 3–5 levels each:

| Building | Does | Unlock |
| --- | --- | --- |
| Storage crate / warehouse | caps | day 1 / week 1 |
| Campfire → kitchen | meals: crew morale and output | day 1 / day 4 |
| Furnace (up to 4) | ore → ingots, sulfur ore → sulfur | day 2 |
| Charcoal kiln | timber → charcoal (fuel, gunpowder) | day 4 |
| Oil press | fat, seeds → oil → fuel | day 5 |
| Workbench 1–3 | crafting tiers, queues | day 2 |
| Tannery | hide → leather | day 5 |
| Loom | fibre → cloth, rope | day 3 |
| Garden plots | seeds, food, fibre; weather-sensitive | day 3 |
| Rain collector / well | water for kitchen and garden | day 3 |
| Bunkhouse | crew cap (3 → 8) | day 4 |
| Infirmary | recovery speed, fewer deaths | week 1 |
| Watchtower | raid warning, scouting range | week 1 |
| Walls, gate, traps, turret | defense score | week 1–3 |
| Generator | fuel → electricity for lights, rigs, radio | week 2 |
| Radio mast | site range, feed, boat calls | week 2 |
| Dock | boats: fishing, sea sites | week 2 |
| Market stall | listings without travelling to the Den | week 2 |
| Signal tower (finale) | the season project | week 3–4 |

Each level changes the drawing. Upkeep scales with what stands; unpaid upkeep slows output
first and only after 72 hours starts decaying the highest building.

### 5.4 Processing chains and the crafting web

The heart of "complex but idle". Chains with real intermediate goods:

```
timber ──► planks ──► frames        fibre ──► rope ──► nets, bowstrings
timber ──► charcoal ─┐               fibre ──► cloth ──► bandages, sails, clothing
sulfur ore ─► sulfur ┴► gunpowder ──► charges, ammunition
ore ──► ingots ──► plates, gears, springs ──► tools, traps, turret parts, engine
HQ ore ──► HQ ingots ──► armour plate ──► Armored tier, vault
fat, seeds ──► oil ──► fuel ──► generator, power tools, boats
food raw (forage, fish, garden) ──► meals ──► morale, expedition rations
hide ──► leather ──► armour, packs (carry capacity)
scrap + wiring + batteries ──► electronics ──► radio, turret brain, keycode readers
```

- ~140 items over five workbench/tier bands; roughly 45 are intermediates. Each late item needs
  three chains to meet, which is what makes the base feel like a factory without a factory UI.
- **Blueprints** unlock recipes; found at sites, bought at the Den, or researched. They
  persist across seasons (the legacy layer), so a veteran's second season starts richer in
  options, not in resources.
- Crafting is timed and queued; higher workbenches shorten times and allow batches. Salvage
  turns unwanted items into scrap and a component or two.
- Durability on tools and gear creates a steady mid-game demand loop.
- Unlocks: day 2; the graph opens fully by week 3.

### 5.5 Research (the tech tree)

- Currency: **notes** *(proposal)* found at sites and earned from tasks. Five branches with
  6–8 nodes each: Industry (rates, chains), Survival (crew, food, medicine), Defense, Expedition
  (range, loot, safety), Trade (fees, contracts, casino limits).
- Each node is a small passive or an unlock, never more than +10% on one rate. Research resets
  with the season, but legacy perks discount it.
- Decision it adds: specialisation. A trader's base looks and plays differently from a raider's.
- Unlocks: week 1.

### 5.6 Crew (survivors)

- Arrive by boat every few days or are rescued at sites; cap set by the bunkhouse (3 → 8).
- Each has 2 traits (scavenger, medic, demolition, marksman, mule, cook, tinkerer, navigator,
  lucky, brave, cautious ...), a level, a loadout (weapon, armour, pack, tool), and gentle needs:
  rest (they sleep at night, output halves if you never let them), meals (morale bonus, never a
  starvation penalty beyond morale).
- Assignments: node, station (a cook makes meals, a tinkerer speeds crafting), guard (defense
  score), expedition, rest. Bonds: pairs that go on trips together gain a small synergy.
- Injuries recover in hours (infirmary halves it); death is rare (< 3% at red sites with full
  gear), telegraphed in the confirm screen, and remembered in the hall of fame.
- Levels persist across seasons (legacy); gear does not.
- Unlocks: first crew member day 1, assignments day 2, expeditions day 3.

### 5.7 Expeditions and the map

- A map of the island with sites in tiers; the radio mast and the dock extend range. Each site:
  duration (20 min → 8 h), difficulty, loot table, hazard type, keycode requirement.
- Confirm screen shows success chance, loot range, injury risk, rations needed. Reports come
  back as a card with a two-line story ("Dax jimmied the cold store; the floor gave way ...").
- Events inside expeditions (bounded RNG): ambush, hidden cache, a stranger who joins, a map
  fragment revealing a site. Convoys and shared world events (a stranded freighter, a storm
  surge) open timed sites for everyone.
- Boat sites need fuel and a navigator; the offshore platform is the season's peak.
- Unlocks: day 3; the chain is finishable around day 18 for the optimal player.

### 5.8 Weather, day and night, world events

- Weather (clear, rain, fog, storm, heatwave) changes rates: rain fills collectors and slows
  gathering, fog hides raids, storms wash up barrels and wreck garden plots, heat dries fuel
  presses faster. Forecast one day ahead on the top bar.
- Night: crew rest, night raids possible without lights, lantern and generator lights extend
  the working day.
- Weekly island events (admin- or schedule-triggered): supply drop, wandering trader with odd
  recipes, raider tide (defense test with warning), migration (rich nodes), the Den's festival
  (casino promos, scrap only).
- Unlocks: weather day 1, events week 1.

### 5.9 Defense and raids

- **Defense score** from walls, traps, turrets, guards, watchtower. Visible in the scene.
- **NPC raiders** scale with visible wealth and are deterred by score; a successful defense
  yields loot and a story, a failed one costs a capped slice of unboxed resources. Warning via
  the watchtower gives a window to react (buy a repair kit, assign guards).
- **PvE raids** on bandit camps: the main charge sink, big loot bursts, tiers.
- **PvP raids** (friendly, low stakes, exactly as specified): pay charges up front, roll against
  defense, win at most 10% of unboxed resources and never gear, blueprints, crew or capped
  scrap; 24 h shield after being hit, one attack per day, same target once per 72 h, only
  within one tier; revenge token at half cost within 48 h; full opt-out.
- Unlocks: NPC week 1, PvE week 2, PvP week 3 (and only with opt-in).

### 5.10 The Den: market, contracts, games

- **Market**: listings with a fee, bids, price history per resource; the stall building lets
  you list without travelling. Anti-abuse: listing caps, no gifting below a price floor.
- **Contracts**: NPC requests ("deliver 400 rope by tomorrow for 60 scrap and a blueprint");
  player contracts later.
- **Games** (scrap only, a sink with a 5–10% edge): the Wheel of Salvage (shared rounds every
  30 s, everyone bets, one result), the One-Armed Scavenger (solo slots with a progressive
  jackpot fed by 1% of losses), Bones (fast dice, tiny stakes). Max bet by tier, daily wager cap
  around 20% of expected daily scrap, RTP verified by the simulator.
- Unlocks: market week 1, games day 5, contracts week 2.

### 5.11 Social layer

- Feed: expedition reports, raids, jackpots, milestones, events. Web feed and Discord channel
  from the same event.
- **Crews' alliances** *(proposal: "wards")*: 2–5 players share a project board (the Signal
  tower, a bridge to a new site), a shared warehouse with limits, and a chat pointer. Alliances
  cannot pool combat power; PvP stays 1:1.
- Leaderboards by category (wealth, sites cleared, defense, trade volume, casino luck), so
  more than one play style can be first.

### 5.12 Season arc and the legacy layer

- Seasons last a month. Week 1: settle and refine. Week 2: metal, boats, the Den. Week 3: deep
  sites, PvP window opens, alliances start the finale. Week 4: the **Signal**: a big
  cooperative-optional project (build and power the signal tower, fuel it for 72 hours) that
  ends the season with a story and ranks who contributed.
- Reset archives the season and keeps the **legacy**: blueprints, crew levels, titles, skins,
  hall-of-fame entries, and **legacy points** by rank spent in a perk tree. Hard cap: a maxed
  veteran is never more than 25% stronger than a new player in any rate. Legacy buys options
  (recipes, cosmetics, a returning crew member), not power.
- Season modifiers keep months different: "long nights", "rich tides", "quiet raiders",
  "storm season". One modifier per season, announced a week ahead.

## 6. Progression timeline (casual player, 3 check-ins a day)

| Day | What happens | New system |
| --- | --- | --- |
| 1 | gather, first crafts, Twig → Timber, campfire, first crew member arrives | tasks, nodes |
| 2 | furnace, ingots, workbench 1, loom | crafting queue, assignments |
| 3 | garden, rain collector, first short expedition (beach wreck) | expeditions |
| 4 | Stone tier lands, kiln, bunkhouse (4 crew), kitchen | meals |
| 5 | oil press → fuel, the Den opens (games, small market) | casino |
| 6–7 | research unlocks, watchtower, first NPC raider warning, weekly event | research, defense |
| 8–10 | tannery, leather armour, quarry and cannery cleared, contracts | contracts |
| 11–14 | Sheet Metal tier, generator, lights, dock, radio mast, boats | electricity, sea |
| 15–18 | observatory and mine, blue-band keycodes, alliances, market stall | alliances |
| 19–24 | Armored tier, turrets, rail depot and power station, PvP window | PvP |
| 25–28 | submarine pen, offshore platform, the Signal | finale |
| 29–31 | season summary, hall of fame, legacy spending, reset | legacy |

The optimal player reaches each tier roughly 30% sooner and never earlier than day 14 for
Armored or day 18 for the platform (simulator gates).

## 7. Content volume targets (first full season)

| Content | Target | Notes |
| --- | --- | --- |
| Resources | 22 | 11 raw, 8 refined/components, food, water, scrap |
| Items | 140 | 45 intermediates, 30 gear, 25 consumables, 40 building parts and misc |
| Buildings | 20 types, 3–5 levels | each level drawn |
| Sites | 12 | plus 3 event sites |
| Crew traits | 14 | 2 per crew member |
| Research nodes | 34 | 5 branches |
| Blueprints | 90 | persistent |
| Events | 8 island events, 12 expedition events | bounded RNG |
| Casino games | 3 | odds in data |
| Season modifiers | 6 | one per month |
| Legacy perks | 24 | capped at 25% total power |

## 8. Economy: sources and sinks

| Sources | Sinks |
| --- | --- |
| passive gathering, mini-game bursts, barrels | building costs and upkeep |
| furnace and press output | crafting inputs and durability |
| expedition loot, NPC raid defense loot | charges (PvE raids), rations, fuel |
| market sales, contracts | market fees, listing caps |
| tasks and events | casino edge and jackpot feed |
| legacy discounts (options, not resources) | raid losses (capped), spoilage past the cap |

Scrap enters only through loot, tasks and the market, and leaves through the Den. The
simulator checks that the casual player's scrap balance rises slowly and the gambler archetype
ends near zero, never negative.

## 9. What is deliberately not in the game

Real-money anything, energy systems, forced timers under ten minutes, loot boxes with paid
keys, unbounded PvP loss, hidden odds, punishment for days away beyond a full storage.

## 10. Open questions for you

1. Names: keep "Wipe Day" as the title? The world glossary in section 4 needs your pass.
2. Alliances: do you want them in season one, or solo play first?
3. Death: keep rare permadeath within a season (memorable) or injuries only (safer)?
4. Season length: a calendar month, or 28 days so it always starts on the same weekday?
5. Art: procedural vector (extend what exists) or commissioned layered illustrations?
