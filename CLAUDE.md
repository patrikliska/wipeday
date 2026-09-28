# CLAUDE.md: Wipe Day (web idle survival game)

This is the only spec. What the game becomes is in `docs/game-design.md`; what to build next, and
the acceptance criteria per phase, are in `docs/roadmap.md`; why things are the way they are is in
`docs/decisions.md`. The original Discord bot spec is kept for history in
`docs/archive/discord-bot-spec.md` and is not a spec any more.

## 1. What this is

Wipe Day (working title) is a long-term idle survival game played in the browser: a living,
side-on base on a wrecked island that fills with buildings, crew and chains of production. Check
in three times a day for two minutes, play for twenty if you like. Seasons last a month; a
legacy layer persists across them. Discord becomes a thin companion (status, gather,
notifications, feed) in W8.

- Private use: a handful of friends on one server. Own world and names: nothing in `apps/web`
  or new content references another game's items, sites or icons (D43). The Discord bot still
  uses its old Rust-themed data until W1/W8 replace it.
- Players gather, refine, build, craft, send crew on expeditions, trade, gamble a little scrap,
  defend, and once a month the tide resets everything except what they learned.

### Priority order (when trade-offs appear)

1. **UI and UX quality.** Understandable with zero tutorial, and it must look great.
2. Long-term pacing and economy health.
3. Code simplicity and testability.
4. Feature count. Fewer polished features beat many rough ones.

### Non-goals

No real-money anything. No public launch, no multi-tenant or multi-server support, no sharding.
No per-second server simulation: the server settles lazily. No native apps: the web client is
mobile-first instead.

## 2. Working rules for the agent

- Work phase by phase (section 12). One phase per session; plan mode first for phases marked
  architecture or balance in the roadmap. Stop and report at the end of every phase.
- A phase is done when `pnpm check` (typecheck + lint + test across the workspace) passes, every
  visual change has been reviewed with `pnpm web:shots` and noted in `docs/ui-review.md`,
  decisions are logged, and the docs are updated.
- **Balance numbers live in data files** (`packages/content/data`), **player-visible strings in
  locale files** (`packages/content/locale`), **rules in `packages/domain`**. Never in
  components. (The web prototype's `apps/web/src/state/world.ts` and `store.ts` break this on
  purpose: they are placeholders that W1 replaces with the domain, one function at a time.)
- When the spec is ambiguous, pick the option with better UX, record it in `docs/decisions.md`
  (next free `D` number, newest last) and continue.
- Never claim a constraint (pinned version, toolchain, file) you cannot show in the repo. When a
  dependency is added, check npm for the latest stable release first.
- Never commit tokens, `.env`, the database or third-party game assets.
- Owner screenshots (phone and desktop) are bugs with priority over new features.
- Stay inside the phase. Redesigning things outside it is how phases go over budget.

## 3. Repository layout

A pnpm workspace. Packages are consumed as TypeScript source through `exports` (`"./*":
"./src/*.ts"`), so there is no build step between them: import `@wipe-day/domain/base`,
`@wipe-day/content/schema` and so on.

```
packages/
  domain/    pure rules: state + now + seed in, new state + events out. Clock interface.
  content/   data/*.json5, zod schemas, loader and cross-checks, locale/en.json, tier ids
  sim/       headless simulator: archetypes, pacing check (runs inside `pnpm test`)
apps/
  api/       game server: Discord login, idempotent commands, lazy settling, SSE push
  web/       the client: Vite + React 19 + PixiJS 8 + Zustand
  discord/   the bot, frozen until W8 turns it into a companion (section 11)
docs/        game-design, roadmap, decisions, ui-review, web-prototype, archive/
preview/     generated screenshots and cards (gitignored)
var/         local runtime state: the SQLite database, simulator CSV (gitignored)
```

Dependency rules:

- `domain` depends only on `content` (types and tier ids). No IO, no clock reads, no randomness
  that is not seeded. Everything it does is reachable from a unit test and the simulator.
- `content` is browser-safe except `load.ts` and `paths.ts`, which read files (Node only).
- Apps depend on packages, never on each other. Shared code moves into a package.
- One `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
  extended by every package; one `biome.json` at the root.

## 4. Core principles

- **Lazy evaluation.** State stores timestamps and rates (`lastCollectedAt`, `endsAt`). Values
  are computed when someone looks. Timers only fire for things that end, to notify.
- **Time is injected.** `Clock` (`@wipe-day/domain/clock`): `now()` in whole UTC unix seconds,
  `nowMs()` for animation. `systemClock` in servers, `manualClock` in tests and the simulator,
  `scaledClock` for the web demo and screenshots. Nothing reads `Date.now()` itself; domain
  functions take a plain `now` that the caller reads from its clock once per action (D51).
- **Commands are idempotent** (from W1). Every mutation is a command with an idempotency key,
  validated against current state inside one database transaction. Double clicks, refreshes,
  replays and stale tabs never duplicate a reward; a stale view re-renders, it never errors.
- **Restart-safe.** On boot the server settles everything that ended while it was down.
- **Integers in state.** Amounts are integers, times are unix seconds. No floats in the database.
- **Every state change is logged** to `event_log` (type, player, payload, time) for debugging,
  the feed and balance analysis.

## 5. Storage and hosting

- SQLite through `better-sqlite3` + `drizzle-orm`, migrations with `drizzle-kit` (D52). One
  writer process: the API. The bot talks to the API from W8 on. Postgres only if a real reason
  appears (several writer hosts, sustained write contention).
- One small VPS: Caddy in front (TLS, reverse proxy to the API, static web build), systemd
  units (D53). Details land in W9.
- Nightly backups: the API takes an online SQLite backup, keeps 14 dated copies, and a cron job
  copies them off the box (D54).

## 6. Web client

### 6.1 Rendering

- **Scene** in PixiJS: procedural flat-vector art from `apps/web/src/scene/palette.ts` (D41),
  layered so an illustrator can replace one layer at a time. **Panels** in React (HTML/CSS):
  HUD, dock, side panel or bottom sheet, modals, toasts.
- **Camera** (D42, D75): design stage 1600×900, ground line at y=560, base at x=1000, sea left of
  x≈480. Wide screens fill the height (800 units); tall screens never show fewer than 880 units
  across. Sky and ground extend 800 units past the stage so no aspect ratio shows an edge.
- **Text in the scene lives in screen space** (D46): anchor in the world, draw on the screen at
  the display resolution, sizes in CSS px. Never text inside the zoomed world.
- **Fire and glows** draw on the `lights` layer above the night tint (D47).
- **Tap targets** in the scene have a fixed size on screen (D48), not in world units.
- The store is read with narrow selectors so the scene ticks at 60 fps without re-rendering
  React every frame. The scene calls `tick()` once per frame; the store reads its injected
  clocks.

### 6.2 Visual language

- Colours are defined once: scene colours in `scene/palette.ts`, HUD tokens in
  `styles/tokens.css`. Each base tier (Twig, Timber, Stone, Sheet Metal, Armored) has one fixed
  colour used everywhere.
- Font: Roboto Condensed (regular, bold). Numbers always go through one formatter (`12.4k`,
  `1.2M`).
- Every resource, item, building, site and action has exactly one icon, used identically in the
  scene, panels and buttons.
- Progress bars for anything with a cap or a duration: storage, builds, furnaces, regrow,
  health, durability.
- The base tells the story: everything the player owns is visible in the scene.

### 6.3 Zero-tutorial UX rules (hard requirements, check them on every screen)

1. **One obvious next action.** Exactly one primary-styled button per view: the most useful
   thing to do now (the advisor picks it). Everything else is secondary; danger style only for
   destructive or PvP actions.
2. **Never a dead end.** Every panel closes or goes back; every result offers the natural
   follow-up (send again, heal, collect).
3. **Disabled buttons explain themselves.** A locked action stays visible, disabled, with the
   reason (`need 2.1k stone`). No hidden features.
4. **Cost and outcome before commitment.** Any non-trivial spend shows cost, duration, result
   and what is left afterwards. Risky actions show chance, loot range and risk first.
5. **Errors are helpful.** One sentence: what is missing, how much, and a button to where you
   get it.
6. **Onboarding is the game.** A new player sees the base and one glowing action. The next
   mechanic is revealed when it becomes affordable, with a one-line hint that disappears after
   two uses. No walls of text; help exists but is never needed.
7. **Feedback on everything.** Every tap changes something visible within a second, gains shown
   as deltas (`+214 scrap`) floating from where they came from.
8. **Mobile first.** Designed at 390 px wide first. Five dock actions on phones (D45), labels
   that never wrap over their buttons, touch targets at least 44 CSS px, legible text at arm's
   length.
9. **Respect the clock.** Idle timers (builds, furnaces, expeditions) are 10 minutes to 24
   hours. Active-play timers (node regrow, mini-games) are real seconds to a couple of minutes,
   never game hours, and never speed up with the demo clock.
10. **Welcome back.** Returning after hours shows what happened as one summary with one collect
    action.
11. **Notifications are opt-in per type**; default on only for "expedition back" and "raided".

### 6.4 Visual review loop (mandatory)

The agent cannot see the browser, but it can see PNGs.

- `pnpm web:shots` drives the running dev server (`pnpm web`) in headless Chromium through the
  dev-only `window.__wipeDay` hook (store, demo clocks, frame counter) and writes every state to
  `preview/web/` with a contact sheet `index.html` (D44). `--only <text>` renders a subset. New
  states get a new entry in `SHOTS` in `apps/web/scripts/shots.mjs`; a shot pins time with
  `time` (game clock) and `wall` (real clock).
- After any visual change: run the shots, open the PNGs (full size, phone, and the `__zoom`
  crops), critique them against this checklist, iterate at least twice for new visuals:
  1. Hierarchy: the most important number or status is where the eye lands first.
  2. Legibility at 390 px, including the smallest text.
  3. Spacing: consistent padding and grid; nothing touching edges, cramped or floating.
  4. Overflow: long names and 7-digit numbers truncate or abbreviate cleanly.
  5. Consistency: same icon, colour and number format for the same thing everywhere.
  6. Contrast in day, dusk, night, rain and fog.
  7. The UX rules in 6.3 (one primary action, no dead end, locked reasons shown).
- Write what was wrong in iteration 1 and what changed in `docs/ui-review.md`. "Looks good"
  without specifics is not a review.
- Do not rely on a live browser window: a hidden window stops rendering.

## 7. Content and data

- `packages/content/data/*.json5`, validated with zod at startup with readable errors (unknown
  ids, negative costs, loot tables not summing, missing locale keys). Every entity has an `id`
  that is its locale key and its asset name: lowercase `snake_case`, 2 to 32 characters.
- `packages/content/locale/en.json` holds every player-visible string, keyed.
- The current files are the bot's Rust-themed data (D55). W1 introduces the own-IP content from
  the glossary in `docs/game-design.md` section 4; the names need the owner's final pass before
  W4 (sites) and W5 (casino) lock them in.
- Content volume and progression targets are in `docs/game-design.md` sections 6 and 7; the
  simulator enforces the numeric ones through `data/pacing.json5`.

## 8. Game design summary

Full design: `docs/game-design.md`. The guardrails that every phase must respect:

- 3 check-ins a day make steady progress; 8 a day is about 1.6× faster, never more.
- Storage caps drive check-ins; reaching a cap stops accrual, it never destroys.
- Randomness is bounded and visible: expected value before every risky action, jackpots
  announced, no hidden odds.
- Casino is scrap only, a sink with a 5–10% edge, max bet by tier, daily wager cap, RTP verified
  by the simulator within ±1% over a million spins.
- PvP is friendly and capped: charges up front, at most 10% of unboxed resources, shields, one
  attack a day, same target once per 72 h, one-tier fence, revenge token, full opt-out.
- Legacy never makes a veteran more than 25% stronger than a new player in any rate.
- Optimal play cannot reach the top tier before day 14 or the last site before day 18.

## 9. Simulator

`pnpm sim [days]` prints a per-day table per archetype and CSV into `var/sim/`; `pnpm sim check`
asserts `data/pacing.json5`. The same check runs in `pnpm test` (`packages/sim`), so a balance
change that breaks pacing fails the build. Archetypes grow with the game: casual, active,
optimal today; gambler and raider arrive with W5 and W6. Argue balance from simulator output.

## 10. Testing

- Unit tests for every domain rule, with seeded RNG and a manual clock.
- Idempotency tests for every command (from W1): same command twice, stale state, replay.
- Invariant and property tests where money-like state moves: the market cannot create resources
  (W5), a raided player never loses more than the cap (W6), a season reset keeps exactly the
  legacy layer (W7).
- Tests live next to the code (`*.test.ts`), run per package with vitest.

## 11. Discord companion (`apps/discord`)

Frozen until W8: only fixes that keep it running. In W8 it becomes a thin client of the API with
no game logic or store of its own. Until then its own rules still apply inside `apps/discord`:
Components V2 only, the `idle:v1:{screen}:{action}:{args}` customId scheme with one router, one
persistent home message per player, cards rendered with satori + resvg and reviewed with
`pnpm preview`, application emojis synced from `apps/discord/assets/emoji_128/` with Unicode
fallbacks, and the asset manifest `apps/discord/assets/ASSETS.md` regenerated by
`pnpm assets check`. Details: `docs/archive/discord-bot-spec.md`. `.env` and the database in
`var/` stay at the repo root.

## 12. Phases

Acceptance criteria per phase are in `docs/roadmap.md`.

| Phase | Goal |
| --- | --- |
| W0 Re-baseline | monorepo, this spec, storage and hosting decisions, injected `Clock` (done) |
| W1 Domain, API, auth | two people play the prototype's features for real, state on the server (done) |
| W2 Buildings | the base fills with buildings the player chose (done) |
| W3 Crafting web | chains, intermediates, blueprints, timed queues (done) |
| W4 Survivors, expeditions | crew, the map, confirm and report cards, the feed (W4a done) |
| W5 Economy | market, contracts, casino, leaderboards |
| W6 Raids and defense | NPC raiders, PvE raids, capped PvP |
| W7 Seasons and legacy | archive and reset, legacy perks with the 25% cap |
| W8 Discord companion | the bot calls the API; feed in both places from one event |
| W9 Live ops | VPS, backups, admin panel, exports, error reporting |

At the end of each phase report: what was built, decisions added, screenshot paths
(`preview/web/index.html`), the `docs/ui-review.md` notes, and what the owner needs to supply.

## 13. Commands

| Command | What it does |
| --- | --- |
| `pnpm check` | typecheck + lint + test across the workspace: must pass before a phase is done |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | the three parts on their own |
| `pnpm format` | apply formatting and safe lint fixes |
| `pnpm dev` | API (:8787) and web client (http://localhost:5173) together; login as test players 1-3 |
| `pnpm web` | web dev server alone (demo mode without the API; `?demo` forces it) |
| `pnpm web:shots [--only x]` | headless screenshots into `preview/web/` (needs `pnpm web` running) |
| `pnpm web:build` | production bundle into `apps/web/dist` |
| `pnpm api` / `pnpm api:dev` | the API process / with restart on change |
| `pnpm sim` / `pnpm sim check` | balance simulator / pacing assertion |
| `pnpm start` / `pnpm bot:dev` | the Discord bot (reads `.env` at the repo root) |
| `pnpm preview` / `pnpm assets check` | bot card previews / bot asset manifest check |
| `pnpm db:generate` | new drizzle migration after a schema change |
