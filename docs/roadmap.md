# Roadmap: from the visual prototype to the full web game

Companion to `docs/game-design.md` (what the game becomes) and `docs/decisions.md` (why things
are the way they are). This file says **what to build next, in which order, and how hard the
agent should think at each step**.

## Where we are (2026-09-26)

- Discord bot: phases 0, 1, 2 and 2b are live-tested or built (`src/`). It has a pure domain,
  a SQLite store, a simulator with pacing gates, 115 tests.
- Web: a visual, non-playable prototype in `apps/web` (Vite, React, PixiJS). Own-IP names,
  procedural art, day cycle, weather, five base tiers, HUD, headless screenshot review
  (`pnpm web:shots`). Nothing in it talks to the real domain yet.
- Decision: the web app becomes the main client, Discord becomes a companion (D40).

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

### W0. Re-baseline the project for the web

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

### W1. Real domain, API and login

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

### W2. Buildings that grow the base

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

### W3. The crafting web

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

### W4. Survivors and expeditions

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

### W6. Raids and defense

*Goal:* wealth attracts trouble; defense is a build choice.

Build:
- NPC raiders scaled to visible wealth and deterred by defenses; PvE raids on bandit camps as
  the main explosive sink.
- PvP raids exactly as specified: explosives up front, 10% loss cap, shields, one per day, same
  target once per 72 h, tier fences, revenge token, opt-out.
- Reports to the feed.

Done when: every PvP limit is covered by a test; a raided player can never lose more than the
cap (property test over random states).

### W7. Seasons and the legacy layer

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
