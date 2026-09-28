# Decisions

Where the spec (CLAUDE.md) was ambiguous or reality forced a choice. Newest last.
Each entry: what was decided, why, and what would make us revisit it.

## Phase 0

### D1. `better-sqlite3` is pinned to 12.x, not the latest 13.x
13.0.3 ships **no prebuilt binaries**: its GitHub release has no `win32-x64` asset
(HTTP 404) and its install step is a bare `node-gyp rebuild`, which needs a C++
toolchain (Visual Studio on Windows, build-essential on a VPS). 12.11.1 still
downloads a prebuilt binary for Node 24 (verified: install succeeds, SQLite 3.53.2).
The spec says "pick the latest stable"; the latest that installs without a compiler
is 12.x. *Revisit* when 13.x publishes prebuilds, or if we containerise with a
compiler anyway.

### D2. Node 24 in development; `engines` says `>=22`
The spec names Node 22 LTS. The dev machine has Node 24.14 (also LTS). Nothing in
the stack needs 24-only features except `process.loadEnvFile`, which exists in 22 too.

### D3. No React: a 40-line JSX runtime feeds satori
satori only needs `{ type, props }` objects. `src/render/jsx-runtime.ts` is wired in
via `jsxImportSource: "#jsx"` + the package.json `imports` map. Function components are
called eagerly, so a finished tree contains only intrinsic elements and snapshots
directly. Saves a dependency and its type baggage. *Revisit* never, unless satori starts
requiring real React elements.

### D4. `src/content/` exists although the spec's tree does not list it
Data-file schemas (zod), loading and cross-file validation need a home. `domain/` must
stay pure (no file IO), `store/` is the database. So: `src/content/`.

### D5. The asset manifest is derived from the data files, not hand-written
Every entity in `data/*.json5` implies its asset rows (resource -> emoji + card icon,
monument -> emoji + thumbnail, ...). Only assets that belong to no entity (fonts,
portraits, casino art, event thumbnails) are hand-listed, in
`assets/manifest.extra.json5`. Adding an item to `items.json5` and running
`pnpm assets sync` is the whole workflow; the list cannot drift from the game.

### D6. Asset names are prefixed for two entity kinds
All application emojis share one namespace, and the `wood` / `stone` base tiers collide
with the `wood` / `stone` resources. So base tiers are `tier_{id}` and perks are
`perk_{id}`; everything else uses its id unchanged. This bends "every entity has an id
that matches its asset file name" slightly, in one function (`entityAssetName`).

### D7. Roboto Condensed ships in `assets/_placeholders/fonts/` (committed)
satori cannot render text without a font, and "the bot must run with zero supplied
assets". Roboto Condensed is Apache-2.0 licensed, so it is not a third-party game asset
and may be committed. The registry prefers `assets/fonts/` (owner's copy) and falls back
to the bundled one; `pnpm assets check` reports the rows as `bundled`, which does not
count as missing. Source: `googlefonts/roboto-2`, `src/hinted/`.

### D8. Action icons use Unicode emoji; only game things get custom art
The spec wants "exactly one icon" per action. Actions (Gather, Collect, Back, Home...)
have no Rust item to take an icon from, so asking the owner for ~25 invented icons would
break "keep the list minimal". They will be fixed Unicode emoji defined in one place
(arrives with the first real screens in Phase 1). Resources, items, monuments, tiers and
perks get custom emojis with a Unicode fallback (`fallbackEmoji` in the data files).

### D9. "Typed emoji lookup" is typed by entity kind, not by name
The spec sketches `Emoji.sulfur`. Emoji names come from data files at runtime, so a
compile-time property per emoji would need codegen for little gain. `Emojis.text(kind,
entity)` / `Emojis.component(kind, entity)` are typed on `EntityKind`, take the entity
object, and have the Unicode fallback built in, so a caller cannot forget it.

### D10. The emoji sync only deletes what it uploaded
Uploaded emojis are recorded in the `app_emojis` table (name, Discord id, file hash;
Discord stores no hash, so we must). On sync, an emoji is removed only if that table says
we created it. Emojis added by hand in the developer portal are never touched.

### D11. Locked buttons may exceed the 20-character label limit
Rule 9 says labels under 20 chars; rule 3's own example (`Upgrade · need 2.1k stone`)
is 25. The lint allows 19 chars for enabled buttons and 38 for disabled ones, because the
reason is the point of a disabled label. *Revisit* if owner screenshots show truncation
on a phone.

### D12. Migrations cover Phase 0 tables only
`players`, `seasons`, `home_messages`, `event_log`, `app_emojis`. The other 18 tables of
section 6 are added by the phase that first uses them, each as its own drizzle migration.
Designing them now would mean guessing at shapes that the domain code has not defined
yet. Discord ids are `text` (snowflakes exceed `Number.MAX_SAFE_INTEGER`).

### D13. Slash commands are registered to the one guild, at startup
Guild commands update instantly (global ones can take an hour) and the bot is
single-server by design. `/idle-debug` is visible to everyone and checks Administrator at
runtime with a one-line notice: a `default_member_permissions` restriction hides the command
entirely, which during the live Phase 0 test looked exactly like "the bot is broken".

### D14. Spec wording: "never in Rust code"
Section 2 says balance numbers live in data files, "never in Rust code". Read as "never
in code" (the game is *themed* after Rust; the code is TypeScript).

### D15. Cards show only what the player has discovered
Found during the demo card's visual review: a new player's card with eleven `0` cells
reads as a broken dashboard. Card view models carry only discovered resources, so the
grid grows with the player. This is rule 6 ("the next mechanic is revealed only when it
becomes affordable") applied to cards. Carries into the Phase 1 base card.

## Phase 1

### D16. `src/game/` holds the transaction scripts
`domain/` must stay pure and `store/` only knows tables, so "load state, apply a domain
function inside one transaction, save, log" needs a home of its own: `src/game/actions.ts`.
Every player click maps to exactly one function there. Not in the spec's tree; recorded here.

### D17. Collect banks the accrual; Gather is the active bonus
Spec 5.1 lists both "accrues offline" and a manual Gather "with a cooldown". Model: resources
accrue lazily from `lastCollectedAt` at the tool's rates, capped by storage; **Collect**
banks them (the check-in moment, always available, never harmful); **Gather** grants
`bonusMinutes` of production on a `cooldownMinutes` timer and banks the accrual on the way.
Upgrading a tool also banks first, so an accrual window is never re-priced at the new
rates. Affordability is judged on banked stock only: what the card shows is what counts.

### D18. One storage cap for everything, including scrap
"Storage: boxes set the cap" could mean per resource or in total. One total cap gives one bar
and one number ("Storage 72%"), which is the whole point of the check-in driver. Accrual is
scaled down proportionally when it would overflow, so ratios are preserved. Scrap counts
toward the cap for now; revisit in Phase 4 when scrap flows from the casino.

### D19. Sub-unit production is dropped on collect
Amounts are integers (spec 6). Accrual rounds down per resource, so collecting twice within a
second loses at most one unit per resource. A fractional carry would need non-integer state;
not worth it. Documented in `domain/base.ts`.

### D20. `/base` reposts and deletes the previous home message
"Posts or refreshes": players expect their base where they just asked for it. `/base` (and
`/start`) post a fresh home message where the command was used and delete the old one, so
there is never more than one. Every button on it edits in place. Sub-screens (Tools) are
ephemeral; their Home button deletes the ephemeral and re-renders the home message.

### D21. Hints and the primary button are one decision
The onboarding hint explains whatever the advisor picked as primary (`ui/advisor.ts` ->
`ui/hints.ts`), so the glowing button and the sentence under the card can never disagree.
Hint use counts live in a small `hints` table (not in spec 6's list; three columns).

### D22. Rates are message text, not card pixels
The card shows what the player has; rates, cooldowns and "waiting" amounts are text in the
message. Text is free to change on every view, while the PNG only re-renders (and the cache
only misses) when stock changes. Rates in full live on the Tools screen, before vs after.

### D23. Names: unsupported glyphs are stripped, not boxed
Roboto Condensed covers Latin, Greek and Cyrillic. Emoji, CJK and symbols in a Discord
display name are removed before rendering (`ui/names.ts`); an empty result becomes
"Survivor". Message text keeps the original name. Cheaper than shipping a CJK fallback font
for a handful of friends; revisit if a real player's name comes out empty.

### D24. Metal tools need refined metal that Phase 1 cannot make
`metal_tools` costs 250 metal fragments; furnaces arrive in Phase 2. The upgrade shows as
locked with the reason (`Upgrade · need 250 metal frags`), which is honest, and the first
upgrade (stone tools, wood + stone) is reachable in one session as the acceptance requires.

## Phase 2

### D25. Day targets are the pacing gate; the 4-5x cost ratio is advisory
`pnpm sim check` fails on the casual/optimal day targets in `pacing.json5`. The "each tier
costs roughly 4-5x the previous" guideline is measured in resource-hours at the tool the
casual player has when buying, and printed as WARN: with real tool rates (HQM ore at 4/h),
the day targets and a strict 4-5x ratio cannot both hold, and the days are what players feel.

### D26. Storage caps are per resource, not one total
The first simulator run deadlocked every archetype: wood and stone filled a single total cap,
which stopped ore accrual and furnace output, so metal fragments never reached the next tier
and upkeep starved. Rust-style per-resource room fixes it and makes the storage bar say
*which* resource is full. Boxes add to every resource's cap.

### D27. Upkeep is paid in whole hours; decay needs a full unpaid hour
`settle` pays as many whole hours as stock covers, pulling from the nodes at the healthy rate
first when stock is short (the base was being fed all along). `upkeepPaidUntil` therefore lags
`now` by up to an hour on a healthy base; "decaying" starts with the first *full* unpaid hour,
and so does the production penalty. Tier loss after `tierLossAfterHours` unpaid, then the
clock restarts one tier down.

### D28. Twig -> wood is instant; every later tier has a timer
The spec says "twig instant, up to 24 h for HQM". Read as: the first upgrade has no timer so
a new player sees the mechanic work at once; wood -> stone 4 h, stone -> metal 12 h, metal ->
HQM 24 h. Builds land lazily on the next look *and* on the scheduler tick, so the home
message updates within a minute even if nobody clicks.

### D29. Fuel is burned up front; a job smelts all the ore the fuel allows
One select choice per ore, no amount picker: the job takes everything of that ore in stock,
limited by wood on hand and the furnace's per-job maximum, and the option's description
states exactly that (amount, output, fuel, time). Output accrues linearly and can be taken
out partially; a slot frees when its job is fully taken out.

### D30. Crafting is instant; no blueprint gating yet
Rust craft times are seconds to minutes, irrelevant at idle scale; timers belong to builds
and furnaces. Recipes are gated by workbench level only until Phase 6 adds the account-layer
blueprint tree.

### D31. The scheduler resolves builds only
Furnace jobs and accrual are computed lazily on view; a finished build is the one thing a
player should see land without clicking, so the tick (`scheduler/scheduler.ts`, once a
minute, first run at boot) settles bases whose build has ended and re-renders their home
message. A tick that finds nothing edits nothing.

### D32. Sub-screen navigation: Back = list view, Home = close and refresh
Every sub-screen is ephemeral. Back re-renders that screen's list view (from a result back
to the list), Home deletes the ephemeral and re-renders the home message so a change made on
a sub-screen is visible at once. On a list view Back is a refresh; the lint still requires it.

### D33. Wood base cannot afford the stone tier without boxes
A wood base holds 5000 of each resource; the stone tier costs 6000 stone. Four wood boxes
(+1000 each) make room. This is deliberate: the first boxes are the natural "why would I
craft?" moment, and the advisor points at Craft when storage is tight and a box is affordable.

## Phase 2b (active play)

### D34. The node marker is the primary button: a reaction game, not a guessing game
Rust's tree X rewards hitting a moving marker. In Discord a hidden marker would be a 1-in-4
guess; showing it makes the game "find and press the glowing button before it fades", which
is honest about what a phone can do and still needs attention (the marker jumps, the window
is a few seconds, one miss ends the run). It also satisfies rule 1 literally: the one primary
button is the one thing to press. Each hit banks a slice of the gather bonus immediately.

### D35. One follow-up per Gather, hits edit the ephemeral, the home message updates at the end
Gather edits the home message (deltas) and opens the run as an ephemeral follow-up. Hits edit
that ephemeral only; the home message is refreshed once, when the run ends, with a summary
line. Five quick clicks therefore cost five ephemeral edits and one public edit, well inside
Discord's limits for a handful of friends.

### D36. Barrels are scheduled, not random, and missed ones are skipped lazily
`nextBarrelAt` advances on a fixed interval from the data file; a barrel lives for a limited
time. Settling computes which scheduled barrel (if any) is still alive at `now`, so a player
who was away for a day finds at most one barrel, never a queue. Loot is seeded by the spawn
time: a double click cannot roll twice.

### D37. Tasks are the same for everyone each UTC day; rewards bank on completion
Seeded by the day index, so friends compare notes. Tasks a player cannot do yet (no furnace,
no workbench) are skipped at roll time. Progress is recorded by the action layer after each
successful action (`act(...)` takes a task hint), never by the domain functions themselves,
which keeps them focused; the simulator records progress the same way. Rewards are banked the
moment the target is reached, no claim button: fewer clicks, and the home message says
`Task done: …` on the click that did it.

### D38. Scrap-priced tools were re-priced for a world with a scrap trickle
The first pacing run with tasks and barrels put the optimal player on HQM on day 10: the
trickle bought Salvaged Tools (150 scrap) in a few days. Salvaged now costs 600 scrap and
Power Tools 2000, which keeps optimal at day 15 and casual at day 27. Phase 3 expeditions will
be the real scrap source and can be tuned against these prices.

### D39. Active state is one JSON column
Node run, barrel and daily tasks are small, transient, never queried, and change shape as the
mini-games evolve: `bases.active_json` holds them as JSON rather than three more tables. Rows
from before Phase 2b parse as "no run, no barrel, tasks not rolled yet".

## Web client (visual prototype)

### D40. The main client moves to the web; Discord becomes a companion
The owner asked for a "microcivilization"-style living base with a much deeper crafting web,
which Discord components cannot carry. `apps/web` is a Vite + React 19 + PixiJS 8 app in a pnpm
workspace next to the bot. The bot code stays untouched until the web client is playable; it
will later become the thin companion (gather, status, notifications).

### D41. Procedural flat-vector art, no bitmap assets yet
Every scene element (sky, hills, sea, base tiers, stations, trees, survivors) is drawn with
Pixi `Graphics` from a palette in `src/scene/palette.ts`. Zero assets are needed to run, the
whole look can be re-tuned by editing colours, and a real illustrator can replace one layer at a
time later. The bot's asset pipeline is not reused here.

### D42. Side-on shore composition with a fixed design stage
The world is a 1600×900 stage with the ground line at y=560, the sea on the left and the base
at x=1000; sky and ground extend 800 units past the stage so no screen shape shows an edge.
The camera fills the viewport height on wide screens and never shows fewer than 760 world
units across on phones, keeping the ground line at 66–72% of the viewport. This keeps the base
readable on a 390 px phone without any second layout.

### D43. Own names and rules in the web prototype
Base tiers are Twig, Timber, Stone, Sheet Metal and Armored; refined resources are ingots and
sulfur; fuel comes from an oil press (animal fat, seeds) and a charcoal kiln, never from
barrels of crude. No item, monument or icon from Rust is referenced in `apps/web`.

### D44. Headless screenshot review replaces `pnpm preview` for the web
`pnpm web:shots` drives the dev server in headless Chromium (Playwright) through a dev-only
`window.__wipeDay` hook, renders 26 states (times of day, weather, every tier, every panel,
phone/tablet/ultrawide) into `preview/web/` with a contact sheet. The review loop from section
4.6 applies unchanged: look at the PNGs, write the critique in `docs/ui-review.md`, iterate.
Reason: a live browser window stops rendering when it is hidden, so the loop cannot depend on
the desktop.

### D45. Five dock actions on phones
The dock shows Gather, Upgrade, Craft, Furnace, Squad, Inventory and Tasks on desktop, but only
the first five on phones; Inventory opens from the resource strip and Tasks from the identity
chip. Sub-labels under dock buttons are hidden on phones and clipped with an ellipsis on
desktop so no label ever wraps over its button.

### D46. Text in the scene lives in screen space, never inside the zoomed world
The camera scales the world 0.5–1.8× depending on the screen, and Pixi rasterises text once at the
renderer's resolution, so text inside the world is stretched by the camera: on a 1080p desktop the
floating gains came out visibly blurry (owner screenshot). Floating text is drawn in a
screen-space layer at the display's resolution, snapped to whole pixels; only its anchor point
follows the camera, and sizes are CSS pixels. Any future text in the scene (labels or timers over
buildings) follows the same rule: anchor in the world, draw on the screen.

### D47. Fire and glows draw above the night tint
Night is a multiply layer (`ambient`) over the whole world; with a tint of `0x4a5a8a`, orange
fire became olive and additive glows bleached stone white. Station fire (the furnace's lit
interior and flames) and station glows move to a world-aligned `lights` layer stacked after the
tint; each station gets a proxy container there at its own position and scale. Window and flood
glows still sit under the tint; move them too if they look washed out. Cost: a flame draws over
anything in front of it (a survivor walking past the campfire), which is rare and brief.

### D48. The node marker's hit area is a fixed size on screen
The marker used a 36-unit radius in world space, larger than the area the marker moves within
on a rock, so the mini-game needed no aim, and its size changed with the zoom. The hit radius is
now 18 CSS px for a mouse and 26 for touch (a fingertip; first tried 14 and 22, which the owner found too small), converted to world units through the
node's transform; the ring is drawn at exactly that radius, and each new spot lands at least 2.5
radii from the last. *Revisit* the numbers after the owner plays it on a phone.
The marker, its ring and its tap target live on a world-aligned layer stacked above everything
(effects, foreground, night tint, weather): nothing can cover the marker, and the target wins
the tap even where another node's hit area overlaps it.

## W0 (re-baseline for the web)

### D49. A pnpm monorepo; packages are consumed as TypeScript source
`packages/domain` (pure rules), `packages/content` (data, schemas, loader, locale), `packages/sim`
(the simulator), `apps/api`, `apps/web`, `apps/discord` (the bot, moved unchanged). Each package
exports `"./*": "./src/*.ts"`, so imports read `@wipe-day/domain/base` and there is no build step
between packages: tsx, Vite and vitest all compile workspace sources directly. One
`tsconfig.base.json` extended everywhere, one root `biome.json`, tests per package through
`pnpm -r test`. `pnpm check` runs typecheck, lint and test. *Revisit* if a package ever has to be
published or the API needs a compiled deploy artifact (then add a build step to that app only).

### D50. Tier ids and the Locale class live in `content`; `content` is split by environment
Domain and content imported `TIERS` from the bot's `ui/theme.ts` (the file with the hex colours),
which blocked extracting them. Tier ids are content, so `@wipe-day/content/tiers` owns them and
the bot's theme re-exports them next to its colours. `Locale` moved too, without its file read
and its logger: `Locale.fromObject(tree, onMissing)` is pure, and `loadLocale()` in
`content/load.ts` reads the file. `load.ts` and `paths.ts` are the only Node-only modules in
`content`, so a browser can import the schemas, tiers and Locale. The bot keeps its own
`ui/locale.ts` as a thin wrapper that logs missing keys.

### D51. One `Clock` interface, injected; domain functions keep a plain `now`
`@wipe-day/domain/clock`: `now()` (whole unix seconds, what state stores) and `nowMs()` (for
animation). Implementations: `systemClock`, `manualClock` (tests, simulator) and `scaledClock`
(faster, pausable, jumpable; the web demo and screenshots only). Domain functions still take
`now: number`: the caller reads its clock once per action, so one action sees one instant and
domain tests need no clock object. The bot's `App` carries `clock`, and its three `Date.now()`
reads (interactions, scheduler, emoji sync) go through it.
The web prototype's fake clock is gone from the store. The store is built by
`createWorld({ game, wall })` and stores only the readings from the last tick (`now`, `wallNow`).
The demo clocks live in `apps/web/src/state/clocks.ts`: the game clock is a `scaledClock` at 240×
over a demo season that starts at the epoch (so screenshot timestamps are "seconds into the
season"), and the wall clock is a 1× `scaledClock` so screenshots can pin regrow timers. The demo
drawer drives the game clock directly (speed, pause, +1 h / +6 h); `+N h` now accrues like real
time passing instead of silently skipping. `tick()` does nothing when neither clock moved, which
is what the old `paused` flag did for screenshots (without it, a clock jump spawned a barrel toast
in every shot).

### D52. SQLite + drizzle stays; the API is the one writer
A friends-scale game has a handful of concurrent players and one server. SQLite in WAL mode with
`better-sqlite3` is fast, transactional, zero-ops and trivially backed up; drizzle and its
migrations already work. From W1 the API is the only process that writes; the bot becomes an API
client in W8, so two processes never write the same file. *Revisit* (Postgres) if the game needs
more than one writer host, or write contention shows up in the `event_log` timings.

### D53. Hosting: one small VPS behind Caddy
Caddy terminates TLS automatically, reverse-proxies `/api` (and the SSE stream) to the API
process and serves the static web build. The API (and the bot, until W8) run as systemd units
with restart on failure. No containers until something needs them. The provider and sizing are
chosen in W9; a 1 vCPU / 1 GB machine is plenty.

### D54. Backups: a nightly copy job, not Litestream
Owner's choice. Each night the API takes an online SQLite backup (`better-sqlite3`'s `backup()`,
consistent while the game runs) into `var/backups/wipe-day-YYYY-MM-DD.db`, keeps the newest 14,
and a cron job copies the folder off the box (rclone or rsync to any storage the owner has).
Restore: stop the API, copy one file into place, start. Worst case loses up to a day of play, with
no extra daemon or bucket account. *Revisit* (Litestream to S3-compatible storage) if losing a day
ever becomes unacceptable.

### D55. The bot moves as it is; its Rust-themed data stays until W1
The bot's data and locale moved into `packages/content` unchanged, because the bot still reads
them and W0 must keep it running. W1 introduces the own-IP content for the web (the glossary in
`docs/game-design.md`), and W8 retires the bot's own rules. Other placements: bot assets moved
to `apps/discord/assets/` (the gitignore rules followed), `.env` and `var/` stay at the repo root
(one `.env` for every app, the live database keeps its path), bot previews still go to `preview/`.
The old CLAUDE.md is archived verbatim in `docs/archive/discord-bot-spec.md`; code comments that
cited its sections now cite that file. The new CLAUDE.md is the only spec.

### D56. The pacing check runs in the test suite; the API starts as a boot check
The bot spec wanted `pnpm sim check` in CI from Phase 2, but no test called it.
`packages/sim/src/sim.test.ts` asserts the pacing targets (about a second) and determinism, so
`pnpm test` fails on a pacing regression. `apps/api` exists so the layout is complete, and for now
it only loads and validates content with an injected clock. The HTTP framework (Hono or Fastify)
is W1's decision.

## W1 (the game on a server)

### D57. The bot runs on a frozen copy of its rules and data
The web game changes the shared domain and content (own names, node regrow, stations, timed
crafting), which the bot cannot follow without being rewritten. The bot's domain, content, locale
and data were copied into `apps/discord/src/legacy/` and its imports point there; it keeps running
exactly as before (owner's choice, so the pending live test of bot phases 2/2b stays possible).
W8 deletes `legacy/` when the bot becomes an API client.

### D58. Hono on @hono/node-server for the API
Small, typed, standard `Request`/`Response`, `app.request()` for tests without a port, built-in
cookie helpers and SSE streaming. Fastify would add a plugin system this app does not need. The
client is hand-written (`apps/web/src/net/http.ts`) against shared wire types in
`@wipe-day/domain/wire`, so apps still never import each other.

### D59. Commands are idempotent by client key, stored in `commands`
Every `POST /api/commands` carries a key the client generates per intent and reuses on every retry.
Inside one better-sqlite3 transaction the server returns the stored response for a known key, or
runs the command, saves, logs and stores the response. A replay therefore returns the identical
answer and changes nothing; a different key (a real second click) is judged by the state. Stored
responses expire after 7 days. The domain adds a second guard for node hits: a hit number already
counted is a no-op.

### D60. Discord login through arctic, sessions as hashed tokens
`identify` scope only, same Discord application as the bot. The cookie holds 32 random bytes; the
`sessions` table holds only their SHA-256, 30-day expiry sliding once a day. Owner's choice: any
Discord account may log in. A passwordless "test player 1-3" login exists only when the API runs
outside production (`/api/dev/login` is not even registered in production).

### D61. A base's season state is one JSON document
`bases.state_json` holds the domain's `BaseState` whole, with a `version` counter and an indexed
`next_event_at` for the scheduler. The bot spread the same state over five tables; but a command
always reads and writes all of it inside one transaction, the shape changes every phase, and
SQLite's JSON functions cover the few queries (leaderboards) that need to look inside. Analysis
reads `event_log`, not bases. *Revisit* if a phase needs to query or index inside bases often.

### D62. Fat is smelted into fuel until the oil press works
The first pacing run put optimal play on Armored at day 10: fuel accrued directly from tools and
was never the bottleneck, where the bot's top-tier resource (HQM) had to be smelted from a slow
ore. Now `fat` smelts into `fuel` in the furnace (fat 4/12/30 per hour with iron/salvaged/power
tools), which gives fat a purpose and restores the chain; the oil press takes the job over in W3.

### D63. The daily node haul bounds active play
Node runs are real-time active play (regrow in seconds), so unlimited tapping would outproduce
the idle economy many times over. Owner's choice: hits pay in full until they have brought in
`dailyHaulMinutes` (180) of tool production per UTC day, then `afterHaulPercent` (10%). The Tasks
panel shows the haul as a bar. With it, active play is about 1.35x casual (guardrail: at most 1.6x)
and optimal play reaches Armored on day 15 (floor: 14).

### D64. The client predicts with the same domain, then adopts the server's answer
`apps/web/src/state/store.ts` keeps `confirmed` (the last server state) and a queue of sent
commands; what the player sees is `confirmed` with the queue re-applied through `applyCommand`.
A tap updates the screen and plays its effects at once, the command goes out (one at a time, in
order, retried with its key), and the answer becomes the new `confirmed`. A refusal the prediction
missed rolls back with a one-line toast. Timers that end on screen are predicted by settling
locally; timed effects are keyed (build tier, craft landing time, barrel expiry, node regrow) so
the server's copy of the same moment never replays them. Pushes from the event stream update
`confirmed` (other tabs, the scheduler); the tab ignores echoes of its own keys.

### D65. Demo mode runs the real rules in the browser
`LocalBackend` implements the same `Backend` interface as the HTTP client with `applyCommand` over
the demo clock: `?demo`, the dev server without an API, and `pnpm web:shots` all use it, and the
screenshot script patches the base through `demoPatch`. The ✦ drawer exists only in demo mode.
Node regrow runs on the demo clock there, so at 240x it passes in a blink; in the real game both
are real time.

### D66. The web gets its data through a Vite JSON5 plugin and validates it on start
The browser imports the same `data/*.json5` and `locale/en.json` the server loads and runs the same
`parseContent` (split out of the Node-only loader for this). A bad data file fails loudly in both
places. `apps/web/src/state/world.ts` is now a presentation bridge (names, colours, placeholder
initials, number formatting); every player-visible string is in the locale.

### D67. The advisor's fallback no longer claims storage is full
Found in the end-to-end run: a new base with nothing to do and Gather cooling down showed
"Storage is full". The advisor's fallback was "collect" whatever was waiting. It now falls back to
Collect only when at least one unit is waiting, otherwise to Gather (whose button shows the
countdown), and the Collect hint no longer claims the store is full.
Also fixed in W1 (M1): a twig base can only afford the Timber tier exactly at its storage cap,
and "storage full" made Collect glow instead of Build although there was nothing to bank. Full
storage now advises Collect only when something is waiting behind the cap.

### D68. Deployment: one container behind the owner's existing Caddy
The VPS already runs Caddy in Docker (the `tk-toolkit` project) on ports 80/443 for two other
sites, so a second Caddy or systemd service is out (this replaces that part of D53). Wipe Day is
its own compose project in `~/wipeday`: one container (the API serving the web build), joined to
the Caddy's Docker network, with the database and backups on a host volume. `scripts/deploy.sh`
copies a `git archive` of HEAD over SSH (no GitHub key on the server), builds on the server,
restarts only `wipeday`, and appends one validated block to the shared Caddyfile once (in place,
because the file is bind-mounted by inode), then reloads Caddy without restarting it. Production
starts without Discord secrets (the login card says so), so the site can go up before the owner
adds them. Details: `docs/deploy.md`.

## W2 (buildings)

### D69. Buildings are data with levels; one modifier system applies them
`data/buildings.json5` holds 16 building types with 3 levels each (cost, build minutes, upkeep,
effects). A level's `effects` are totals, not increments, so the card can say "Now" and "Next"
without arithmetic. Effects are a small closed set (`rates`, `allRates`, `flat`, `cap`,
`fuelPer100Ore`, `smeltPercent`, `craftPercent`, `haulMinutes`, `barrelLifeMinutes`,
`barrelEveryMinutes`, `graceHours`, `workbench`, `furnace`). `modifiers(content, state)` in the
domain sums them once per `buildings` object, and every rule that a building touches (accrual,
gather, node slices, storage, furnace type, fuel and speed, craft time, barrels, haul, decay
grace) reads from it. The owner chose "a small real bonus now": the deeper roles (queues,
leather, crew, raid warnings) arrive with W3, W4 and W6 on the same ids.

### D70. The workbench and the furnace are buildings; station items are gone
Workbench levels 1 to 3 and the furnace type were items (`workbench_1..3`) or a purchase
(`buy_furnace`). Both are now building levels; the campfire, kiln, press and lantern (now
"lights") too. Items are only things you carry or store (crates, meds, gear). One `build`
command covers everything: `{ type: "build", what: "tier" | building id }`.

### D71. Construction runs on builders: one, a second from the Stone tier
`BaseState.construction` replaces the single `build` field: a list of jobs, each on a builder.
Builder slots are data per tier (`base_tiers.json5`: twig and wood 1, stone and up 2; the
owner's choice). A 0-minute level (the first workbench and furnace) lands at once. A building
already under construction cannot be started again; the refusal says when it lands, and
"every builder is busy" says when one is free.

### D72. Decay takes the dearest building level first, the tier last
When unpaid upkeep outlasts the grace (walls add hours), the most expensive building level goes
first (`building_decayed`), and the tier drops only when no buildings are left. Losing a level
of the warehouse hurts less than losing the tier with all its storage, and it is visible in the
scene. Upkeep is the tier's plus every building level's.

### D73. Old W1 bases convert on load (`normalizeState`)
The API and demo mode read every stored state through `normalizeState`: `workbench_1..3`, the
campfire, kiln, press and lantern items become building levels, `furnaceId` becomes the furnace
building, the old `build` becomes a construction job, and furnace jobs without `perHour` get
the rate of the furnace the base had. Live bases keep what they built; nothing is migrated
in SQL.

### D74. Simulated players save for the next tier before extra buildings
The simulator's archetypes build the tier first, then tools, the furnace and the workbench, then
the cheapest other building with what is left after reserving half the next tier's cost (all of
it once they can afford 70%). Building greedily starved the Armored target; always saving
blocked buildings entirely. Result: the casual player has 10 buildings on day 7 (gate: 6+),
reaches Stone on day 3, Sheet Metal on day 13 and Armored on day 28, the last day of its target
window. W3's intermediate costs will move this, so the gate stays in `pacing.json5`.

### D75. Scene layout: fixed spots in three rows, and a wider phone view
Each building has one spot, in world units from the door (`SPOTS` in `scene/base.ts`):
- the strip either side of the house: cupboard and furnaces left, workbench and campfire (a
  kitchen at level 3) right;
- up the slope behind, drawn smaller and peeking over the wall: watchtower, bunkhouse,
  warehouse, kiln and press on the left, radio mast, generator and loom on the right;
- the yard in front: tannery racks, garden beds, lamp posts, crates stacked by the door;
- the dock reaches out over the water past the phone's left edge on purpose.
A fully built Armored base spans about 880 world units, so the phone's minimum view grew from
760 to 880 units and its focus moved from x 845 to 915 (this amends D42): the barrel, the dock's
boathouse and the kitchen all fit at 390 px. The ore rock moved forward to the sand's edge
(660, +70) and the sulfur rock inside the phone view (1296, +100).

## W3 (the crafting web)

### D76. A node goes down only once it is worked all the way; misses leave wear
The owner found that missing the hit streak knocked the node down and made them wait for the
regrow. The domain ended every run that had any hit by depleting the node. Now a node keeps
the hits it has taken (`BaseState.wear`). A run that stops short leaves it standing. The next
run carries on from there and hit numbers count the node's hits, so a run on a node at 3 starts
at hit 4. The node goes down at `maxHits` hits in total. Not depleting on a miss alone would let
a player hit four times, miss on purpose and restart forever, skipping the regrow. With the
wear kept, what one node pays per lifetime is unchanged. The perfect bonus still needs every
hit in one streak. The scene shows wear as axe cuts in a trunk and cracks in a rock, and a miss
says "Missed · 3/5".

### D77. Parts are a resource kind, uncapped, and sit on the road to every tier
The owner chose "parts on the main road". Ten parts, each made at a station:
- planks (timber), rope and cloth (fibre), leather (hide), charcoal (timber);
- fuel (fat, at the oil press; this ends D62's furnace stopgap);
- plates, frames, gears and springs (ingots, planks, charcoal).

Parts are `kind: "part"` resources in `stock`, so every cost stays one `Amounts` table and W5's
market and W6's raids see them like anything else.
- They are not capped by storage. They are made from capped resources, and the queues are the
  throttle.
- The top bar leaves them out; the inventory lists them.

Where they enter:
- Stone needs planks. Sheet Metal needs plates, frames and leather. Armored needs plates,
  gears, springs and fuel.
- Iron tools need planks and rope; the later tools need gears and springs.
- Most building levels 2 and 3 need a fitting part.

Food is a new raw resource: the garden and the dock now grow food, not fibre and fat.

### D78. Every station runs its own queue of batches
The owner chose "each building runs its own queue". Stations are the workbench, loom,
tannery, kiln, oil press and campfire (the kitchen at level 3).
- Recipes name their station and level. The old `workbench` effect is gone: the station level
  is the building level.
- A job is a batch of runs, paid up front. Each run makes the recipe's `amount` and takes its
  `minutes`, sped up by the lights.
- Runs land one by one as settling passes them, with no collect step. The next job starts when
  the one before it ends.
- Station level sets queue slots (2/3/4) and the most runs per job (10/25/50), in
  `crafting.json5`.
- Cancelling refunds the runs not made yet in full, and the jobs behind move up.
- Queuing counts as one step toward the daily craft task, however big the batch.
- The UI speaks in outputs ("Planks ×200, 60 of 200 done"), never in runs.

### D79. Blueprints are for extras, found in barrels, perfect runs and a daily task
The owner chose "found, for optional recipes". Four recipes need a blueprint: the strongbox,
the first aid kit, the crossbow and the feast.
- The validator fails the build if a part ever needs one, so no blueprint stands between a
  player and a tier or a tool.
- A barrel holds one 8% of the time and a perfect node run 3%. The daily craft task always pays
  one while any are left to find.
- Draws are seeded per base and moment (replayable) and only draw recipes the base does not
  know.
- Locked recipes stay visible and say where blueprints come from.
- Found blueprints live in the base state; W7 moves them to the legacy layer.

### D80. A served meal boosts Gather and node hits, not accrual
The owner chose "meals give a timed boost". Roast (+10% for 4h), stew (+20% for 6h) and feast
(+30% for 8h) are cooked from food at the campfire.
- Serving one adds its percent to the Gather bonus and to node hits.
- Those are instant payouts. A boost on passive accrual would have to split every accrual
  window at the moment the boost ends; this keeps accrual one simple multiplication.
- A weaker meal cannot cut a stronger one short (the refusal says how long is left); an equal
  or better one replaces it.
- A "Well fed +20% · 3h" line shows in the clock chip. W4 adds meals as crew rations.

### D81. The content validator guards the crafting web, and a missing data file is an error
`checkRecipes` in `parse.ts` fails the build when:
- a recipe names no real station level;
- a part or item has no recipe;
- a part is made but used by nothing;
- anything cannot be reached from what the island gives (gathering, smelting, barrels, tasks);
- a part needs a blueprint.

`parseContent` now also reports any data file that did not arrive. The web bundle had silently
run on defaults twice (W2's `buildings.json5`, W3's `crafting.json5`).

### D82. The simulator makes parts for its goals; crafting targets join the pacing check
At each check-in the planner:
- works out the parts its next tier, next tool and cheapest part-blocked building need, deepest
  first;
- builds or upgrades whichever station blocks a part;
- queues batches without touching the upkeep reserve;
- cooks meals and serves the best one before gathering;
- makes each piece of gear once, like a curious player.

`pacing.json5` gains first-made days (planks 2, bow 3, leather 9, plates 10, springs 18) and
"every station works by day 14".

Results:
- Casual: Stone day 4, Sheet Metal day 12, Armored day 26, 9 buildings on day 7. First bow on
  day 2, leather and plates on day 5, springs on day 15. All six stations work by day 7.
- Active: Armored on day 20.
- Optimal: Armored on day 15 (the floor is 14).

The tier cost-ratio warning now prices parts by what they are made of.

### D83. The craft panel is a recipe browser; "Make planks" is one tap from anywhere
- Station tabs, with a dot on busy ones and unbuilt ones dimmed but open.
- Each station shows its queue (progress, cancel) and its recipes, with one primary button:
  the part the next tier or tool waits on, else the first thing makeable.
- A recipe opens into:
  - what it is for (the first six uses, then "and N more");
  - "what it takes" as a tree with have/need, where each input comes from, and a Make or
    Furnace button beside anything short;
  - a stepper with "All you can";
  - the cost, the time and what is left after.
- Missing parts in the build panel get "Make planks" buttons.
- A refusal toast for a missing part offers the same button.
- When the advisor picks crafting, the Craft dock button opens straight on that part.
- Pins are a per-device view preference in localStorage.
- In the scene, a working station shows an amber progress ring for the run in progress (fixed
  size on screen, D48), and the kiln and press smoke only while they work.
