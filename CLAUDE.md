# CLAUDE.md: Wipe Day (web incremental idle game)

This is the only spec. What the game becomes is in `docs/game-design.md`; what to build next, and
the acceptance criteria per phase, are in `docs/roadmap.md`; why things are the way they are is in
`docs/decisions.md`. The approved redesign plan behind all three is `docs/redesign/` (its
`README.md` first); `docs/redesign/09-architecture.md` is the engineering spec, and the numbers
come from `docs/redesign/10-balance.md`. The W-phase design is archived in `docs/archive/`.

## 1. What this is

Wipe Day (working title) is an incremental idle game played in the browser, on a wrecked island
called Saltmarsh *(proposal)*. You tap for **Supplies**, buy 14 production lines, hire a hand for
each so it runs by itself (also while you are away, inside the Night Shift window), climb five
eras, and when you choose, press **the Big Red** and nuke your own island for **Crater Glass**.
Glass you ever earned boosts everything (Glow); glass you hold buys nodes on the **Blast Map**, a
permanent 361-node tree. Every run is faster than the last. There are no seasons (D128). Discord
is a thin companion: status, Collect, DMs and the feed channel.

- Private use: a handful of friends on one server. Own world and names: nothing in `apps/web`
  or new content references another game's items, sites or icons (D43).
- Rust is the inspiration in mechanics and mood, never in names: the tool ladder, five tiers
  re-climbed every run, scrap as the precious currency, jank engineering, the wipe as a ritual.

### Priority order (when trade-offs appear)

1. **UI and UX quality.** Understandable with zero tutorial, and it must look great.
2. Long-term pacing and economy health.
3. Code simplicity and testability.
4. Feature count. Fewer polished features beat many rough ones.

### Non-goals

No real-money anything. No casino, no PvP, no trading or gifting between players. No public
launch, no multi-tenant or multi-server support, no sharding. No per-second server simulation:
the server settles lazily, in closed form. No native apps: the web client is mobile-first.

## 2. Working rules for the agent

- Work phase by phase (section 12). One phase per session or a few; plan mode first for phases
  marked architecture or balance in the roadmap. Stop and report at the end of every phase.
- **Branches (D145):** until the cut-over at the end of R2 the redesign is built on `redesign`.
  `main` is the frozen old game (season 1, live): nothing lands there except an emergency fix if
  the live server or the backup breaks, merged into `redesign` at once. Everything deleted is
  reachable at the `pre-redesign` tag. From R3 each phase gets its own branch again.
- A phase is done when `pnpm check` (typecheck + lint + test) passes, `pnpm sim check` passes
  every N-assertion switched on so far, every visual change has been reviewed with
  `pnpm web:shots` and noted in `docs/ui-review.md`, decisions are logged, and the docs are
  updated (`docs/redesign/11-roadmap.md` 1.3 is the common contract).
- **Balance numbers and formulas live in data files** (`packages/content/data`),
  **player-visible strings in locale files** (`packages/content/locale`), **rules in
  `packages/domain`**. Never in components.
- When the spec is ambiguous, pick the option with better UX, record it in `docs/decisions.md`
  (next free `D` number, newest last) and continue. Argue balance from `pnpm sim` output.
- Never claim a constraint (pinned version, toolchain, file) you cannot show in the repo. When a
  dependency is added, check npm for the latest stable release first.
- Never commit tokens, `.env`, the database, backups' passwords or third-party game assets.
- Owner screenshots (phone and desktop) are bugs with priority over new features.
- Stay inside the phase; nothing visible teases a later phase (D140).
- Where the project stands and the next phase's scope: `docs/roadmap.md` ("Where we are").
  Setting up a new computer: `README.md` ("Start here"). Deploying, the off-server backups and
  the rules for the shared VPS (never touch the tk-toolkit containers): `docs/deploy.md`.

## 3. Repository layout

A pnpm workspace. Packages are consumed as TypeScript source through `exports` (`"./*":
"./src/*.ts"`), so there is no build step between them: import `@wipe-day/domain/state`,
`@wipe-day/content/schema` and so on.

```
packages/
  domain/    pure rules: state + now + seed in, new state + events out. Clock interface.
  content/   data/*.json5 (lines, eras, prestige, ...), zod schemas, loader and cross-checks,
             locale/en.json, tier ids; icons/<kind>/<id>.svg (D141)
  sim/       headless simulator v2: lifetimes of runs per archetype, pacing check (in `pnpm test`)
apps/
  api/       game server: Discord login, idempotent commands, the taps path, lazy settle, SSE
  web/       the client: Vite + React 19 + PixiJS 8 + Zustand
  discord/   the Discord companion: a thin client of the API (section 11)
deploy/      compose file, Caddy block, the off-server backup script
docs/        game-design, roadmap, decisions, ui-review, web-prototype, deploy, redesign/, archive/
preview/     generated screenshots and bot previews (gitignored)
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

- **Lazy, closed-form settle.** State stores timestamps, counts and amounts (`settledAt`,
  `activeAt`, `readyAt`). Production is computed when someone looks, in closed form over
  segments where rates are constant, so many small settles equal one big one (N24). **Nothing
  buys inside settle** (D136): the Foreman and Dead Hand send ordinary commands while online.
- **Time is injected.** `Clock` (`@wipe-day/domain/clock`): `now()` in whole UTC unix seconds,
  `nowMs()` for animation. `systemClock` in servers, `manualClock` in tests and the simulator,
  the demo's `game` clock (1×, with time jumps) and `wall` clock in the web demo and
  screenshots (D138). Nothing reads `Date.now()` itself; domain functions take a plain `now`
  that the caller reads from its clock once per action (D51). The domain never reads `wall`.
- **Commands are idempotent.** Every mutation is a command with an idempotency key, validated
  against current state inside one database transaction. Every command keeps an outcome-only
  record (no state): 7 days, or 1 hour for taps and pings, which travel on the slim path
  (batches of at most 1 s or 30 taps through a token bucket, D134). Double clicks, refreshes,
  replays and stale tabs never duplicate a reward; a stale view re-renders, it never errors.
- **Restart-safe.** On boot the server settles everything that ended while it was down.
- **Finite numbers in state** (D130). Amounts are finite doubles behind `Amount`, guarded in the
  domain and in `save()`; counts are integers; times are unix seconds. Never `NaN` or `Infinity`.
- **Rare events are logged** to `event_log` (type, player, payload, time) for debugging, the feed
  and balance analysis; its id sequence is never reset (D143). Taps, pings and purchases roll up
  into stats and the run summary instead of a row each.

## 5. Storage and hosting

- SQLite through `better-sqlite3` + `drizzle-orm`, migrations with `drizzle-kit` (D52). One
  writer process: the API. The bot keeps no database; it talks to the API (D121). Postgres
  only if a real reason appears (several writer hosts, sustained write contention).
- One small VPS: Caddy in front (TLS, reverse proxy to the API, static web build), containers
  in our own compose project (D53, D68).
- Backups: the API takes a nightly online SQLite copy and keeps 14 (D54); a cron job copies them
  and every `wipeday-pre-*.db` off the box into the owner's encrypted Google Drive (D143,
  `docs/deploy.md`).

## 6. Web client

### 6.1 Rendering

- **Scene** in PixiJS: procedural flat-vector art from `apps/web/src/scene/palette.ts` (D41),
  layered so an illustrator can replace one layer at a time. **Panels** in React (HTML/CSS): the
  top bar, the shop drawer, sheets, the Blast Map (React DOM and SVG, D139), toasts.
- **Camera** (D42, D75): design stage 1600×900, ground line at y=560, sea left of x≈480. Wide
  screens fill the height; tall screens never show fewer than 880 units across. Sky and ground
  extend 800 units past the stage so no aspect ratio shows an edge. R1 reframes the phone view
  so the tap target stands on the rise at about 40% of the height, at least 120 CSS px (N27).
- **Text in the scene lives in screen space** (D46): anchor in the world, draw on the screen at
  the display resolution, sizes in CSS px. Never text inside the zoomed world.
- **Fire, glows and the fireball** draw on the `lights` layer above the night tint (D47).
- **Tap targets** in the scene have a fixed size on screen (D48), not in world units.
- The store is read with narrow selectors so the scene ticks at 60 fps without re-rendering
  React every frame. The supplies counter is written outside React (a rAF loop over
  `suppliesAt`). Animation reads the `wall` clock.

### 6.2 Visual language

- Colours are defined once: scene colours in `scene/palette.ts`, HUD tokens in
  `styles/tokens.css`. Each era (Twig, Timber, Stone, Sheet Metal, Armored) has one fixed colour
  used everywhere. The primary is signal orange (D138); the Big Red is never primary-styled.
- Font: Roboto Condensed (regular, bold). Numbers always go through one formatter
  (`@wipe-day/domain/words`): `12.4k`, `1.50Qa`, suffixes up to `999Dc`, then `1.23e36`; held
  amounts floor, costs and rates round; a scientific toggle in settings.
- Every currency, product, line, era, tool, target, flotsam kind, hand, node and action has
  exactly one icon (`packages/content/icons/<kind>/<id>.svg`, D141), used identically in the
  scene, panels, buttons and the bot; a missing icon falls back to the lettered tile.
- Progress bars for anything with a cycle, a cap or a duration: line cycles, milestones, the
  Night Shift window, the Kettle, the Magnet, cooldowns.
- The island tells the story: everything the player owns is visible in the scene.

### 6.3 Zero-tutorial UX rules (hard requirements, check them on every screen)

1. **One crowned thing per view** (D138). Exactly one primary-styled (signal orange) action per
   view: the most useful thing to do now (the advisor picks it). Other affordable rows stay
   enabled and secondary. While the crown is on the Big Red, flotsam, a Toolbelt skill or the tap
   hint, the collapsed drawer has no orange row; the expanded drawer always crowns one. The Big
   Red is never primary-styled; danger style only for destructive actions.
2. **Never a dead end.** Every panel closes or goes back; every result offers the natural
   follow-up.
3. **Disabled buttons explain themselves.** A locked action stays visible, disabled, with the
   reason (`need 2.1k`). No hidden features, and no reason that names unshipped content.
4. **Cost and outcome before commitment.** Any non-trivial spend shows cost, result and what is
   left afterwards. The nuke shows its glass, what this press unlocks, and whether it is a Wipe
   Day or a small blast, before the hold.
5. **Errors are helpful.** One sentence: what is missing, how much, and a button to where you
   get it.
6. **Onboarding is the game.** A new player sees the beach, one glowing pine and "Tap the tree."
   The next mechanic is revealed when it becomes affordable, with a one-line hint that disappears
   after two uses. No walls of text; help exists but is never needed.
7. **Feedback on everything.** Every tap changes something visible within a second, gains shown
   as deltas (`+214`) floating from where they came from, with the product's icon.
8. **Mobile first.** Designed at 390 px wide first. The shop drawer plus five nav items (Island,
   Blast Map, Crew, Logbook, Friends); the nav row is hidden at 0:00 and appears when its first
   destination unlocks. Labels never wrap over their buttons, touch targets at least 44 CSS px,
   the tap target at least 120 px tall (N27), legible text at arm's length.
9. **Respect the clock.** Production cycles may be seconds. Idle timers (the Night Shift, the
   Magnet, Toolbelt cooldowns, the Freighter) run on the game clock; active timers (Hustle,
   flotsam, buffs, felling, the cinematic) are real seconds and never speed up. The demo clock
   runs at 1× with time jumps.
10. **Welcome back.** Returning after hours shows what happened as one summary with one Collect,
    which is the primary; never the nuke.
11. **Notifications are opt-in per type**; on by default only "Night Shift over", and quiet hours
    22:00-08:00 (browser time) hold pushes until 08:00.
12. **Never tease unshipped content** (D140). Locked things show only real, reachable reasons.

### 6.4 Visual review loop (mandatory)

The agent cannot see the browser, but it can see PNGs.

- `pnpm web:shots` drives the running dev server (`pnpm web`) in headless Chromium through the
  dev-only `window.__wipeDay` hook (store, demo clocks `game` and `wall`, frame counter) and
  writes every state to `preview/web/` with a contact sheet `index.html` (D44). `--only <text>`
  renders a subset. New states get a new entry in `SHOTS` in `apps/web/scripts/shots.mjs` (the
  list per phase is `docs/redesign/08-screens.md` 8); a shot pins time with `time` (game clock)
  and `wall` (real clock).
- After any visual change: run the shots, open the PNGs (full size, phone, and the `__zoom`
  crops), critique them against this checklist, iterate at least twice for new visuals:
  1. Hierarchy: the most important number or status is where the eye lands first.
  2. Legibility at 390 px, including the smallest text.
  3. Spacing: consistent padding and grid; nothing touching edges, cramped or floating.
  4. Overflow: long names and `999Dc` / `1.23e36` numbers fit cleanly.
  5. Consistency: same icon, colour and number format for the same thing everywhere.
  6. Contrast in day, dusk, night, rain and fog.
  7. The UX rules in 6.3 (one crown, no dead end, locked reasons shown).
- Write what was wrong in iteration 1 and what changed in `docs/ui-review.md`. "Looks good"
  without specifics is not a review.
- Do not rely on a live browser window: a hidden window stops rendering.

## 7. Content and data

- `packages/content/data/*.json5`, validated with zod at startup with readable errors (unknown
  ids, non-finite or negative amounts, formulas whose costs do not rise, missing locale keys).
  Lines and costs are validated as formulas, not rows (`c × g^maxOwned < 1e200`). Every entity
  has an `id` that is its locale key and its icon name: lowercase `snake_case`, 2 to 32
  characters. Effects use the one vocabulary of `09-architecture.md` 5.1 (D135).
- The files and the phase that adds each: `09-architecture.md` 8.1. A feature ships when its
  data is there; the client shows nothing whose data is absent (D140).
- `packages/content/locale/en.json` holds every player-visible string, keyed; number suffixes
  are `format.suffixes`.
- The glossary of names is in `docs/game-design.md`; names marked *(proposal)* wait for the
  owner's passes (R1, R2, R4). A rename is a locale edit: ids and icons stay.

## 8. Guardrails

Eleven guardrails (D129), each asserted by the canon numbers N1-N27 (bands as amended in
`docs/redesign/10-balance.md` 4.9):

1. **The first nuke comes on day 1** (N1-N3).
2. **Active play is a bonus**, never a different game (N8-N10).
3. **Friends stay in one race**, and late joiners catch up (N16, N17).
4. **There is always something to buy** (N4-N7).
5. **Every nuke feels faster** (N11-N13).
6. **The tree lasts for months** (N14, N15).
7. **Absence never hurts:** 100% offline inside a Night Shift of 12 h rising to 48 h; a full
   window stops accrual and destroys nothing (N18).
8. **Precious things are never at risk:** glass and scrap are never traded, gifted, wagered,
   stolen or sold; no casino; scrap stays rare (N19).
9. **Randomness is visible:** odds printed in the game, no hidden catch-up (N20).
10. **Numbers stay meaningful:** the fifth-root prestige shape, always finite (N21-N23).
11. **Respect the clock:** active timers real seconds, idle timers on the game clock (6.3.9).

## 9. Simulator

`pnpm sim [days]` plays lifetimes of runs through the real domain (no second economy) and prints
per-run and per-day tables per archetype, with CSV into `var/sim/`; `pnpm sim check` asserts
`data/pacing.json5` v2, and `pnpm sim check --full` runs 365 days over three seeds (before R2, R3
and R7 ship). The `test` profile runs inside `pnpm test` (`packages/sim`) in under 10 s, so a
balance change that breaks pacing fails the build. Archetypes: idler, casual, active, optimal,
late joiner, plus the first-hour and autoclicker scenarios; from R6 a lockstep group of five.
`pacing.json5` marks each assertion with the phase that switches it on; warn-only ones print
WARN. Argue balance from simulator output (D144).

## 10. Testing

- Unit tests for every domain rule, with seeded RNG (`rng.ts`, one `SEED` table) and a manual
  clock.
- Idempotency tests for every command: same command twice, stale state, replay; no command
  record holds state.
- Property and invariant tests where money-like state moves: settle path independence (1e-9)
  and the tick oracle (1e-6, N24); the bucket never over-credits (N10); a nuke keeps exactly
  `meta` and grants exactly the formula's glass (R2); effects are monotonic and bounded per stat;
  glass and scrap fall only by the owner's own spend; no command writes another player's base.
- Tests live next to the code (`*.test.ts`), run per package with vitest.

## 11. Discord companion (`apps/discord`)

A thin client of the API (D121-D126): no game logic and no store of its own, checked by
`apps/discord/src/boundary.test.ts`. It reads bases through `/api/bot/*` with a service token
(`BOT_API_TOKEN`) and the player's Discord id. It may use the shared domain's read-only helpers
and `@wipe-day/domain/words` for every sentence and number, so Discord and the web say the same
thing.

- Surfaces: `/base` (ephemeral), DMs (the web push's notifications, opted into by using the
  bot), and the feed channel (feed items from the API's stream, acked so nothing is lost or
  posted twice). Until R2, `/base` only says "Open the game"; card v2 (rate, Night Shift fill,
  the Big Red's yield, Collect) comes in R2, and the bot's only command is then `collect` (no
  taps, no nuke from Discord, D142).
- Components V2 only; screens are plain data (`ui/screen.ts`) with one lint for the 6.3 rules;
  one router for the `idle:v2:{screen}:{action}:{owner}` customIds. Cards are rendered with
  satori + resvg on a 600-unit layout made for a phone's 290 px.
- Strings live in the `discord.*` keys of `packages/content/locale/en.json`.
- Review with `pnpm preview`: every message drawn from the payload the bot sends, at phone and
  desktop width, in `preview/discord/`. Note what was wrong and what changed in
  `docs/ui-review.md`, as for the web.

## 12. Phases

Acceptance criteria per phase are in `docs/roadmap.md` (detail: `docs/redesign/11-roadmap.md`).
W0-W8 built the old game (history in `docs/archive/roadmap-w.md`); W9's items are folded into
R0, R2 and R7.

| Phase | Goal |
| --- | --- |
| R0 Foundations | backup, branch, docs, the cut, state v2, effects, settle, taps, simulator v2 |
| R1 The run | from the first tap to Sheet Metal; looks great on a phone |
| R2 The Big Red | the full loop; cut-over, friends play |
| R3 Blast Map wave 2 | rings 4-6; months of goals |
| R4 Logbook | collection as power |
| R5 Scrap and the check-in | the Magnet, ranks, Pockets, Toolbelt, Foreman, Dead Hand |
| R6 Friends | Blowback, Late Tide, the Freighter, boards |
| R7 Dares, wave 3, live ops | Dares, rings 7-9, admin page, export |
| Later, gated | the Crossing; creeds; a sea layer, each when its trigger fires |

At the end of each phase report: what was built, decisions added, the N-assertions switched on
and their measured values (warnings too), screenshot paths (`preview/web/index.html`), the
`docs/ui-review.md` notes, and what the owner needs to supply.

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
| `pnpm api` / `pnpm api:dev` | the API process / with restart on change (if `pnpm dev`'s API part hangs, run `pnpm api` + `pnpm web`) |
| `pnpm sim [days]` / `pnpm sim check [--full]` | simulator v2 / pacing assertion |
| `pnpm start` / `pnpm bot:dev` | the Discord bot (reads `.env` at the repo root; needs the API) |
| `pnpm preview` | every bot message drawn at phone and desktop width into `preview/discord/` |
| `pnpm db:generate` | new drizzle migration after a change to `apps/api/src/store/schema.ts` |
