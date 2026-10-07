# Roadmap: from the visual prototype to the full web game

Companion to `docs/game-design.md` (what the game becomes) and `docs/decisions.md` (why things
are the way they are). This file says **what to build next, in which order, and how hard the
agent should think at each step**.

## Where we are (2026-10-07, after W8)

- W0 done: the monorepo, the web spec in `CLAUDE.md`, an injected `Clock` everywhere.
- W1 done and live at https://wipeday.patrikliska.dev (Discord login confirmed from the owner's
  phone): own-IP content and rules in `packages/domain`, the API (`apps/api`: Discord login,
  idempotent commands, lazy settling, SSE, nightly backup), and the web client playing on it with
  client prediction (D57-D68).
- W2 done: 16 building types with 3 levels each, builders, decay by building, the scene's
  fixed spots and a wider phone view (D69-D75).
- W3 done: parts on the road to every tier, a queue per station, blueprints for extras, meals,
  salvage, the recipe browser; worn nodes instead of lost ones (D76-D83).
- W4a done, live and pushed (commit 7675567): a real crew (arrivals, traits, levels, gear,
  injuries, no death), the fogged island with scouting for a fee, trips to eight ruins in tiers
  1-3, report cards (D84-D89).
- W4b done (branch `w4b`, merged and deployed 2026-10-05): the crew works at home (nodes,
  stations, guard) and rests on a tap; bonds; trip events; keycodes (tin, copper, brass) gating
  the weather station, the far north and the sea; four tier 4-5 sites; the island feed and Web
  Push notifications (D90-D97). The optimal player reaches the Offshore Platform on day 18.
- W5 done, merged into main and pushed 2026-10-06, not deployed yet. The Den opens at Stone
  (D98-D105):
  - the market: player listings held in escrow in the seller's base, and a sale as one
    transaction over both bases;
  - the Den's own daily counter and contracts;
  - three games (the Wheel of Salvage with shared 30-second rounds, the One-Armed
    Scavenger with a player-funded jackpot, Bones) with odds in data, an exact 90-95% check
    and million-round RTP tests;
  - leaderboards in six categories and the season card.
  - Late site scrap is trimmed, and a map-scrap loophole that let the sea skip its scout is
    closed.
- W6 done, merged and deployed with W7 (D106-D113):
  - **Defence:** walls, the watchtower (warning hours), new traps and turret, and guards. A
    breach halves the buildings until a scrap-and-stone repair.
  - **NPC raids:** planned only while the player plays, landing on an evening two days
    ahead. They are warned hours before and take at most 5% (scrap capped).
  - **Charges:** gunpowder and charges, and three bandit camps paid in charges.
  - **PvP:** opt-in from Sheet Metal, instant, one transaction over both bases, with every
    limit tested and the 10% cap proved by property tests.
  - **The client:** the Defence panel with its Raids tab, raid report cards, the raid
    banner, the shield badge, torches on the ridge and breached walls.
- W7 done, merged and deployed 2026-10-07 (D114-D120):
  - **Seasons:** end by command (`pnpm season announce|end`). The reset archives the season
    and folds every base into its player's legacy in one transaction.
  - **Legacy:** blueprints, crew levels, perks, titles and skins carry over. Points buy eight
    small perks, capped at 25% in any rate.
  - **Modifiers:** four season modifiers.
  - **The Signal:** the island's shared tower for the last week.
  - **The client:** the season-over card, the Legacy and Hall of fame tabs.
  - The live database was wiped on the owner's request at this deploy: everyone starts season
    1 from zero (logins and push subscriptions kept).
- W8 done, merged and deployed 2026-10-07 (D121-D126; the bot posts to `#wipe-day-idle`).
  The bot is a thin client
  of the API:
  - **`/base`:** a private card with Collect, Gather, a one-time link into the game and the
    DM switch, made for a phone. The advisor picks the one primary action.
  - **DMs:** the notifications the web pushes (party back, raided, and the kinds turned on),
    with the base, the game and "DMs off" on each.
  - **The feed channel:** the web feed's own sentences, from the same events, caught up after
    the bot was away; the season's end announced and the reset with its winners.
  - **Gone:** the bot's own database, scheduler, frozen rules and asset pipeline.
- Two live players on https://wipeday.patrikliska.dev (the owner and a friend).

### Next: W9 (Live ops)

Scope as in the phase list below. Things W8 leaves for it:
- The bot's first live run: the owner's setup (below), then screenshots of `/base` on a phone.
- Titles still show only in the web's Legacy tab, not beside names in the feed (from W7).
- Late scrap still rises (D112); the Signal took some of it. Watch the live economy at the
  first real reset.

### W8 results (acceptance)

- **The bot has no game logic of its own.** `apps/discord/src/boundary.test.ts` fails if the
  bot imports a rule that changes a base or a database driver. Collect and Gather go through
  the API's commands, idempotent by the interaction's id (`apps/api/src/bot.test.ts`, and a
  live run of the bot's client against a local API).
- **The feed appears in both places from one event.** `bot.test.ts` lands a party and checks
  that the web's `/api/feed` and the bot's stream carry the same item ids. The bot posts
  them with the web feed's own sentence (`@wipe-day/domain/words`). A reconnect catches up
  after the bot's last ack.
- **The rest of the API side** (`bot.test.ts`): the token, acting for a Discord id, login
  links (one use, ten minutes), DMs only for players who used the bot and for the kinds
  turned on, season news.

### W7 results (acceptance)

- **A reset keeps exactly the persistent layer.** `apps/api/src/season.test.ts` seeds three
  players (stocks, blueprints, crew levels, raids held, a listing, Signal gifts) and resets.
  It asserts:
  - the legacy rows, the archive and the hall of fame;
  - the closed listing and the stopped timers;
  - that the new base equals a fresh base plus the carry.
- **The cap holds over every perk combination.** `packages/domain/src/legacy.test.ts` walks
  12,288 rank combinations, and the content check refuses a tree over 25%.
- **The veteran stays inside the floors.** The simulator's veteran (every perk, every
  blueprint, crew level 5) reaches Armored on day 14 and the Offshore Platform on day 18.

### W6 results (acceptance)

- **Every PvP limit is a test** (`packages/domain/src/pvp.test.ts`):
  - opt-in and the tier;
  - self;
  - the shield;
  - one raid a day;
  - the same target once in 72 h;
  - the fence;
  - charges;
  - what revenge costs and skips, and that it gives no counter-token;
  - the opt-out lock.
- **The API tests** (`apps/api/src/raid.test.ts`):
  - two attackers on one target;
  - a replayed key;
  - 50 parallel attacks (exactly one gets through);
  - an NPC raid due on the defender before the take;
  - the offline push;
  - the tick.
- **A raided player never loses more than the cap.** Property tests over random bases,
  defences and seeds, for NPC raids (`raids.test.ts`) and PvP raids (`pvp.test.ts`), check:
  - no resource loses more than 10%;
  - scrap stays under its ceiling;
  - parts, items, blueprints, crew and escrow are untouched;
  - what the attacker gains is exactly what the defender loses.

### W5 results (acceptance)

- RTP: every bet option is within one point of its exact return over a million rounds
  (`rtp.test.ts`, `pnpm sim rtp`); the content check keeps every option between 90 and 95%.
- Wager caps: 50 parallel spins with distinct keys never pass the daily cap
  (`apps/api/src/den.test.ts`); the gambler archetype never does either (`pnpm sim check`).
- The market cannot create resources: a property test over random lists, buys, cancels and
  expiries across three bases conserves every good and loses scrap only to fees
  (`market.test.ts`). The API tests cover two buyers racing for one listing, a replay, own
  listings and expiry.

### What the owner needs to do (as of 2026-10-07, after W8)

0. **Try the bot:** `/base` in Discord on your phone (Collect, Gather, Open the game), and
   send screenshots. The bot is set up and running since 2026-10-07.
1. **Pick and announce season 1's end.** Season 1 started fresh on 2026-10-07 (the live game
   was wiped at the W7 deploy). Announce the end a week ahead; the game shows it and the
   Signal opens:
   `docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/season-cli.ts announce <YYYY-MM-DD> --next <modifier>`
   On that day: `... season-cli.ts end` (it backs up first). Details in `docs/deploy.md`.
2. **Name pass** on `packages/content/locale/en.json`:
   - W4b: the Rail Yards, North Dam, the Narrows, Open Water, their four ruins, the keycodes
     and the trip events.
   - W5: the Den, the Wheel of Salvage (Gull, Crab, Anchor, Lighthouse, Crown, Tide), the
     One-Armed Scavenger (Bolt, Gear, Fish, Anchor, Lantern, Beacon), Bones, the contract
     lines and the demo seller "Hollis".
   - W6: Traps, Turret, Gunpowder, Charges, Driftwood Camp, Saltpan Camp, Cinder Fort and the
     raid lines.
   - W7:
     - perks: Steady Hands, Deep Cellars, Quick Fingers, Hot Coals, Old Maps, War Stories,
       Old Friend, Packed Crate;
     - skins: Driftwood, Rust, Beacon;
     - modifiers: Long Nights, Rich Tides, Quiet Raiders, Storm Season;
     - titles: Wealthiest, Master Builder, Pathfinder, Merchant, Lucky Hand, Wallkeeper,
       Keeper of the Signal;
     - the Signal's stages.
3. **Turn notifications on again** on every device. The wipe kept logins but no device was
   subscribed. iPhone: add the site to the Home Screen, open it from there, then the clock
   chip, then "Turn on". Confirm a "party back" or "raided" push arrives.
4. **Play and send screenshots** of anything that looks wrong, the bot's `/base` and DMs
   included. Phone screenshots are bugs with priority over W9.

### Open items (small, carried over)

- UI polish noted in `docs/ui-review.md`:
  - the map has no night look;
  - on desktop the side panel covers the island's east coast (it pans);
  - crew faces are placeholders;
  - station tabs past the fifth scroll sideways without a hint;
  - the Signal draws only finished stages;
  - titles show only in the Legacy tab.
- Off-server backup copies (rclone or rsync from a cron job) are still to do (W9).
- The bot's old phases 0-2b are retired: W8 rebuilt it as a client of the API (D121).
- Decision: the web app is the main client, Discord becomes a companion (D40).

## How to run a phase with an agent

Rules that worked so far and should stay:

1. **One phase per session.** Start a fresh session per phase, paste the kickoff prompt below.
   Ask for a report at the end (what was built, decisions, screenshots path, what is next).
2. **Plan mode first** for any phase marked *architecture* or *balance*. Approve the plan, then
   let it build. For *UI* phases skip plan mode and iterate on screenshots instead.
3. **Acceptance criteria are the contract.** A phase is not done until the listed checks pass:
   `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm web:shots` reviewed with notes in
   `docs/ui-review.md`, decisions logged, docs updated.
4. **Balance lives in data files, strings in locale files, logic in `packages/domain`.** Never in
   components.
5. **Screenshots are the review tool.** The agent cannot see your browser; it can see PNGs. If
   you see something wrong on your phone, paste the screenshot: it beats any description.
6. **Commit per phase**, push when green. Never commit tokens or third-party game assets.

### Kickoff prompt (paste at the start of each session)

```
Read CLAUDE.md, docs/roadmap.md, docs/game-design.md, docs/decisions.md and docs/web-prototype.md.
We are starting phase W<n>. Work in plan mode first, show me the plan, then build it phase by
phase against the acceptance criteria. Keep balance in data files and strings in locale files.
Review every visual change with `pnpm web:shots` and write the critique into docs/ui-review.md.
Finish with a report: what was built, decisions added, screenshot paths, what I need to supply.
```

### Effort guide

"Effort" here means the model plus the reasoning-effort setting in Claude Code. Rough rule:
architecture, concurrency, balance and anything with money-like state gets **high**; UI
iteration gets **medium** (visual judgement matters more than deep reasoning); porting,
boilerplate and doc chores get **low** or a smaller model.

| Phase | Kind | Model | Effort | Plan mode | Sessions |
| --- | --- | --- | --- | --- | --- |
| W0 Re-baseline | architecture | Opus | high | yes | 1 |
| W1 Domain, API, auth | architecture | Opus | high | yes | 2–3 |
| W2 Buildings | UI + domain | Opus | medium–high | short plan | 2 |
| W3 Crafting web | balance + UI | Opus (design), Sonnet ok for UI grind | high for design, medium for UI | yes | 2 |
| W4 Survivors, expeditions | domain + UI | Opus | high | yes | 2–3 |
| W5 Economy, casino, market | balance | Opus | high | yes | 2 |
| W6 Raids and defense | domain | Opus | high | yes | 2 |
| W7 Seasons and legacy | domain | Opus | medium–high | yes | 1–2 |
| W8 Discord companion | integration | Opus or Sonnet | medium | no | 1–2 |
| W9 Live ops | chores | Sonnet | low | no | ongoing |

Total: roughly 16–22 sessions of a few hours. The estimate is rough; W1 and W4 are the ones
most likely to grow.

Tips on effort:

- High effort is worth it where a wrong decision is expensive to undo: the domain model, the
  command/transaction shape of the API, the recipe graph, RTP and PvP guard rails.
- Medium effort with many small screenshot rounds beats one long high-effort UI session.
- If a session drifts (the agent redesigns things outside the phase), stop it and restate the
  acceptance criteria. Scope creep is the main way phases go over budget.
- Ask for the simulator before asking for balance changes. Numbers argued from `pnpm sim` output
  are worth ten intuitions.

## Phases

### W0. Re-baseline the project for the web (done)

*Goal:* the repo is shaped for the web game and the spec says so.

Build:
- Rewrite `CLAUDE.md` for the web direction: keep the UX rules (one primary action, never a
  dead end, disabled buttons explain themselves, cost and outcome before commitment, mobile
  first), replace the Discord rendering rules with the web ones (Pixi scene + HTML panels, the
  camera rules from D42, the screenshot review loop from D44), list these phases, point to
  `docs/game-design.md` for content.
- Monorepo layout: `packages/domain` (pure logic, moved from `src/domain` and extended),
  `packages/content` (JSON5 data, zod schemas, `en.json`), `apps/api`, `apps/web`,
  `apps/discord` (the current bot, moved). Shared tsconfig and biome config. Everything stays
  green while moving.
- Decide storage and hosting (record as decisions): SQLite + drizzle stays for a friends-scale
  game; one small VPS behind Caddy; nightly backups (litestream or a copy job). Postgres only if
  a real reason appears.
- Delete the mock store's fake clock in favour of a `Clock` interface injected everywhere.

Done when: `pnpm -r typecheck lint test` pass; the bot still starts; the prototype still runs;
the new `CLAUDE.md` is the only spec.

### W1. Real domain, API and login (done)

*Goal:* two people can play the current prototype's features for real, from a phone and a
desktop, with the state on the server.

Build:
- Domain (pure, tested): player and season, base tiers, resources with per-resource caps, lazy
  accrual, tools, gather cooldown and active bonus, furnace jobs, timed crafting queue, daily
  tasks, barrel and node runs (ported from the bot).
- API: Hono (or Fastify) with typed routes (tRPC or a hand-written typed client), Discord OAuth
  login (same identity as the bot), cookie sessions, `GET /state` that settles lazily, mutations
  as **commands with idempotency keys**, one DB transaction per command, an `event_log`, and a
  push channel (SSE is enough) for timers ending and the feed.
- Web: swap the Zustand mock for a server-backed store with optimistic updates and rollback;
  real "welcome back" from the settled delta; stale-state handling (re-render, never error).
- Dev ergonomics: seed script with three test accounts, `pnpm dev` starting api + web together.

Done when: two test accounts play at the same time; a refresh mid-action never duplicates a
reward (tests: double click, stale message, replayed command); offline accrual equals the
simulator's number; login works from a phone on the LAN.

### W2. Buildings that grow the base (done)

*Goal:* the "microcivilization" feel: the base fills with buildings the player chose.

Build:
- Buildings as entities with levels and placement slots around the core (see the building list
  in the design doc): storage, furnace, kiln, oil press, workbench, tannery, loom, kitchen,
  garden plots, rain collector, generator, lights, watchtower, walls, traps, bunkhouse, radio
  mast, dock. Build queue with timers, scaffolding, upkeep per building.
- Scene: one drawn structure per building and level, a slot layout that reads on a phone, night
  lights per building, a "what's new" pulse when something lands.
- Build panel: costs, effects, "why locked", queue.

Done when: at least 14 building types render at 2+ levels each; the simulator shows the casual
player has 6+ buildings by day 7; screenshots pass the review checklist at 390 px.

Result: 16 types render at levels 1 to 3 (`buildings_level1`, `buildings_level3`,
`buildings_night`, `phone_buildings_full`); the casual player has 10 buildings on day 7. The
kitchen is the campfire's level 3. The rain collector and traps wait for the phases that give
them a job (water in W3, defense in W6).

### W3. The crafting web (done)

*Goal:* crafting is a hobby in itself: chains, intermediate goods, blueprints, queues.

Build:
- The recipe graph from the design doc (raw → refined → components → items), fuels from plants
  and fat, textiles, food. A validator that fails the build on orphan items, unreachable
  recipes or missing locale keys.
- Timed crafting with per-workbench queues and batch sizes; blueprint discovery; salvage.
- UI: recipe browser with "how do I get this" trees, favourites, "craft all you can", a queue
  card in the scene (the workbench shows what it is making).

Done when: every item is reachable; `pnpm sim check` hits the crafting throughput targets; a
new player can find and craft a bow without reading anything.

Result:
- The validator proves every part and item reachable (D81), and `sim check` asserts the
  first-made days and "every station works by day 14" (D82).
- The bow sits on the workbench tab from the start. Its recipe shows planks (made at the
  Workbench) and rope (made at the Loom), each with a Make button (`phone_recipe_bow`).
- Deferred:
  - the design doc's full graph (sulfur and gunpowder, electronics, HQ metal) waits for the
    sites and raids that use it;
  - pins are per device, not per account.

### W4. Survivors and expeditions (done)

*Goal:* the second big loop: send people out, get stories and loot back.

Build:
- Survivors: arrival, perks, levels, gear loadouts, gentle needs (rest, food), injuries and
  recovery, assignments (node, station, guard, expedition).
- The map with sites in tiers, access items gating the upper half, travel time, success roll,
  loot tables, wounds, rare death; boat sites once the dock exists.
- Expedition confirm (chance, loot range, risk) and report (rendered card with a narrative
  line); the feed (web and later Discord); notifications opt-in.

Done when: the full site chain is playable in the simulator by day 18 for the optimal player
and not before; reports read well at 390 px; every screen has one primary action.

### W5. Economy: market, casino, leaderboards

*Goal:* scrap has somewhere to go and players start looking at each other.

Build:
- Market listings with fees, contracts (deliver X for Y), price history.
- The casino (own theme): wheel with shared rounds, slots with progressive jackpot, dice; all
  odds in data; guard rails (max bet by tier, daily wager cap, scrap only); RTP verified within
  ±1% over a million spins in tests.
- Leaderboards by category, season summary card.

Done when: RTP tests pass; wager caps hold under concurrent clicks (test with 50 parallel
commands); the market cannot create resources from nothing (invariant test).

### W6. Raids and defense (done)

*Goal:* wealth attracts trouble; defense is a build choice.

Build:
- NPC raiders scaled to visible wealth and deterred by defenses; PvE raids on bandit camps as
  the main explosive sink.
- PvP raids exactly as specified: explosives up front, 10% loss cap, shields, one per day, same
  target once per 72 h, tier fences, revenge token, opt-out.
- Reports to the feed.

Done when: every PvP limit is covered by a test; a raided player can never lose more than the
cap (property test over random states).

### W7. Seasons and the legacy layer (done)

*Goal:* the monthly reset feels like a fresh start with a longer story underneath.

Build: season archive and reset in one transaction; blueprints and survivor levels persist;
legacy points and the perk tree with the 25% cap; hall of fame; titles; base skins; season
modifiers; the season finale project from the design doc.

Done when: a reset on a seeded database keeps exactly the persistent layer (snapshot test);
the cap is enforced by a test over every perk combination.

### W8. Discord companion

*Goal:* the bot becomes a thin remote for the web game.

Build: `/base` status card, gather and collect, expedition and raid notifications, feed
posting, a login link. It calls the same API as the web client. Remove the bot's own store.

Done when: the bot has no game logic of its own; the feed appears in both places from one
event.

### W9. Live ops (ongoing)

Hosting on one VPS (Caddy, systemd, SQLite with nightly backups), an admin panel (reload data,
spawn world events, grant, ban), `event_log` exports to CSV for balance analysis, error
reporting, a status page. Low effort, small sessions, whenever needed.

## Parallel tracks (owner-driven)

- **Art.** Decide between keeping the procedural style and commissioning layered illustrations
  (per tier, per building, portraits). The scene is layered so either drops in one layer at a
  time. If commissioning, the manifest from W2 lists exact sizes.
- **Playtesting.** From W1 on, two friends on the LAN build every week. Their screenshots go
  straight into the next session as bugs with priority over features.
- **Names.** The own-IP glossary in the design doc needs a final pass by you before W4 (sites)
  and W5 (casino) lock them into locale files.

## If time runs short

Cut in this order: W6 PvP (keep NPC raids), W5 market (keep casino), W7 cosmetics (keep the
reset and blueprints), W8 (keep only notifications). Never cut W1's idempotency work or the
simulator gates: they are what keeps a month-long game from breaking in week two.
