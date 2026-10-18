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

## W4a (crew, the fogged island, scouting and expeditions)

### D84. The crew is real: arrivals, traits, levels, gear and injuries (injuries only, no death)
Survivors are state now, not scenery.
- The crew starts with Mara, Dax and Ivo. The rest of a pool of 12 named survivors arrive by
  boat every 24 hours while there is room.
- Room is 4, plus the bunkhouse's new `crew` effect (+1/+2/+3).
- Each survivor has two traits from `traits.json5`, with data effects on trips: success,
  hazard bonuses, loot, extra loot rolls, shorter trips, fewer injuries, faster recovery,
  rarer finds. Cook and tinkerer get their jobs in W4b.
- Levels come from trip XP and add success. W7 makes them persist across seasons.
- Gear: one weapon and one armour, moved out of the inventory while worn. Weapons add success
  at hostile sites; armour lowers injury risk.
- The owner chose injuries only. A hurt survivor rests by the fire for a few hours; the medic
  trait, bandages and first aid kits shorten it. Nobody dies.
- In the scene, survivors walk down to the shore when they leave, come back up from it, and
  arrivals step up from the boat.

### D85. One island per season, under each player's own fog; scouting is the fee to lift it
The owner chose one island for everyone, each with their own fog, and suggested the scouting
fee. The island is data (`regions.json5`, `sites.json5`): nine regions in rings round the
holdfast and eight ruins in tiers 1-3.
- A region can be scouted when it borders a known one and its ring is within the base tier's
  range: Timber reaches ring 1, Stone ring 2, Sheet Metal ring 3.
- Scouting costs a fee (food, scrap, fuel further out) and a survivor's time. On return the
  fog lifts and the region's ruins appear.
- Tier-1 ruins also drop map scraps that lift a neighbouring region for free.
- The far north and the sea are drawn under permanent cloud until W4b charts them.
- W7 varies the layout per season.

### D86. Trips are lazy and rolled from a seed; the confirm shows exactly what gets rolled
A mission stores its seed and the odds computed when it left (`tripOdds`): success,
at-least-partial, injury per member, time, loot rolls and rare chances. Settling at its end
rolls from those, so what the confirm screen promised is what happens, and a replay rolls the
same.
- A success brings every loot roll, a partial half, a failure none.
- Injuries double on a failure.
- XP is full, half or a quarter.
- Loot follows storage caps; parts come home whole.
- Every return writes a report (the last 20 are kept) and a `mission_back` event, which the
  welcome-back summary and the toasts read.

### D87. Tools have a minimum base tier; sites became the scrap source
- Site loot made scrap plentiful, and the optimal player bought Power Tools at a Sheet Metal
  base on day 8. Tools gain `minTier`: Salvaged Tools need Sheet Metal, Power Tools need
  Armored.
- Sheet Metal and Armored cost more ingots:
  - Sheet Metal: stone 48,000, ingots 38,000.
  - Armored: ingots 45,000, plates 900, gears 200, springs 150.

  This corrects Armored costing less in raw terms than the tier before it.
- Site loot and trip times were re-tuned from the simulator.

Results:
- Casual: Stone on day 4, Sheet Metal on day 13, Armored on day 26. First trip on day 1,
  tier 2 on day 5, tier 3 on day 13. Five survivors by day 10, Salvaged Tools on day 16.
- Optimal: Armored on day 14, the floor; tier 3 on day 8.
- Two first-made targets moved, with reasons:
  - the bow to day 4: early food and fibre now go to scouting fees and rations;
  - tier-3 sites to day 14: ring 3 opens with Sheet Metal on days 12-14, and a scout takes
    hours.
- Scrap piles up by week 3 (casual about 3.3k on day 21). W5's market and casino are the sinks.

### D88. The map is a full-screen chart; Map takes the fifth phone dock slot
- The owner chose a full-screen drawn map. `MapView` draws the island in PixiJS on the same app
  as the base, which rests while the map is open:
  - terrain patches and doodles per region;
  - drifting cloud over unknown regions, which snaps in on first show and parts slowly when a
    scout returns;
  - ruin markers at a fixed on-screen size with a bigger tap area (D48);
  - dashed routes with a dot walking out and back;
  - labels in screen space (D46);
  - pan, pinch and wheel zoom.
- The dock's fifth phone action is now Map (Holdfast while on the map), with the count away or
  the reports waiting. Squad moved to the desktop-only extras and opens from the map panel.
  This amends D45.
- A tap opens the map panel:
  - on a region: the fog, the fee, who goes;
  - on a ruin: the party picker, the four numbers (success, something, injury risk, time),
    what the hauls can be, rations and what is left, and one Send button;
  - with nothing tapped: who is away and the reports.
- The report card: the outcome, a story line per site and outcome, the loot, what was mapped,
  XP and level-ups, injuries, and "Send again" (or "See it on the map").

### D89. Map advice waits for the first tier; the dev API runs without `tsx watch`
- A brand-new base glowed Map instead of Gather, since the Beach Wreck needs no rations. The
  advisor now suggests the map only from Timber on; unread reports always count. The Map button
  is visible from the start (no hidden features).
- On this Windows machine `tsx watch` under `pnpm dev` hung before listening. For owner
  previews the API ran as a plain `tsx src/main.ts`, restarted by hand when rules change.

### D90. The crew works at home: nodes, stations, guard; a job is a standing order
- A survivor's job is a node kind, a station or guard; free means no job. It is kept while
  they are out on a trip and picks up again from the moment they are home, so a job can be
  given to someone who is away.
- A node worker adds `nodePercent` (15%) of the current tool's rate for that node's yields;
  the mule trait adds 15% more. It is lazy like everything else: each worker's output is
  integrated from their shift (since when they could work, when they tire), paused by trips
  and injuries, and added to the accrual before the storage cap.
- A station worker makes that station's crafting faster (15%, the cook +50% at the
  campfire, the tinkerer +30% anywhere), one worker per station. The speed is fixed per job
  like the lights' (D79), so assigning or moving a worker reprices the station's queue from
  that moment; landed units stay landed. Without the reprice, assigning the tinkerer would
  change nothing visible.
- A guard adds defence (5, marksman +5, brave +3). It is shown now and used by W6's raids.
- Every job change, rest, treatment and served meal banks what the crew made first, so time
  that already passed is never re-priced.

### D91. Rest is one tap; free time counts as rest; meals are morale
The owner chose tap to rest.
- A worker tires 16 hours after their last rest and then works at half pace.
- "Rest" puts them to bed for 8 hours, after which they go back to their job on their own.
  "Rest the tired" does it for everyone tired at home, and is the squad panel's primary
  action when anyone is tired.
- Someone free for a full rest's length starts a job rested, so a free survivor never needs a
  tap.
- Sending a sleeper on a trip wakes them; the rest they had counts in proportion.
- A served meal lifts the crew's work by its percent while it lasts (the "food lifts morale"
  need). Nothing starves.
- Advisor: a new "crew" advice when someone is tired or, from Timber on, free at home. It
  glows the Squad button on desktop and a new crew chip in the phone top bar (Squad has no
  phone dock slot, D88).

### D92. Bonds: pairs who go out together do better
Every trip adds one to each pair in the party. From three trips together, the pair adds 4
points of success; the confirm screen shows the bond as a tag.

### D93. Trip events are fixed at departure, rolled on return, and never re-roll old missions
- `events.json5` holds the events: ambush (loot −30%, injuries +50%), a hidden cache (+2
  hauls) and a stranger (a rescue). Each has a chance by site tier, hazard points, trait
  points, and points per armed member.
- The chances are part of the odds a mission leaves with, and the confirm shows them
  ("Might happen on the way"). At most two events happen per trip.
- A stranger shows 0% when no bunk is free, so the confirm never promises a rescue that cannot
  happen.
- Missions sent before W4b carry no event odds and roll exactly as before: events roll after
  the outcome and only when the odds have them.
- Map scraps stay each site's own chance (D85).

### D94. Keycodes gate the new sites only, are spent on the way in, and bad luck is capped
The owner chose to gate only the new sites.
- The chain: the Ferry Terminal and the Cannery drop tin; tin opens the Weather Station,
  which drops copper; copper opens the Rail Depot and the Power Station; the Power Station
  drops brass; brass opens the Submarine Pen and the Offshore Platform.
- A keycode is an item, spent when the party leaves (like rations). The content check makes
  sure every keycode some site needs drops somewhere.
- Finds roll on a success. After `findPity` (3) successes at a site without its find, the
  next success brings it (the design's "streaks capped"). The confirm says so ("Sure within 2
  successes").
- A locked site says which keycode it needs and where the likeliest one turns up, with a
  button there.

### D95. The far north by radio mast, the sea by boat
- Ring 4 north (Rail Yards, North Dam): the radio mast's new `scoutRange` effect adds one ring
  to the tier's range, and Armored now reaches ring 4 on its own.
- The sea: regions with `access: "sea"` need the dock (the Narrows level 2, Open Water level
  3), a navigator in the party (the scout must be one), and fuel in their fees. Their lanes
  are drawn white on the map, the regions as open water with a buoy.
- Open Water is ring 5: Armored plus the radio mast. Its dock level takes 24 hours to build
  and scouting it takes 24 hours, the longest idle timers there are. That is what keeps the
  Offshore Platform, the season's peak, at day 18 for the optimal player.
- The hard-coded cloud over the north is gone; each region's own fog covers it.

### D96. The feed and Web Push: one event log, two outlets
- `@wipe-day/domain/feed` decides both outlets, so W8's Discord channel can reuse them.
- The feed carries:
  - trips back with something;
  - rescues;
  - new tiers;
  - level-ups;
  - blueprints;
  - keycodes.
- The server reads the feed from `event_log` (the season, everyone, newest first) and
  broadcasts new items on the event stream as they are logged.
- On phones the feed opens from the clock chip, with a dot for news; on desktop from a dock
  button.
- Notifications: the owner chose real Web Push.
  - The VAPID key pair is generated on the first boot and kept in a `settings` table, so the
    server needs no secret set by hand.
  - The scheduler's tick sends a push for every settled event whose kind the player turned
    on. Party back and raided are on by default (raided fires from W6); newcomers and builds
    done are off.
  - Permission is asked only when the player taps "Turn on". Devices the push service
    reports gone are dropped.
- The service worker handles notifications only: no offline cache, which would fight the
  dev server and deploys. It shows nothing while the game is open and in front, and a tap
  opens the game on the report.
- A manifest and icons make the site installable. iPhones need this: push works there only
  for a site added to the Home Screen, which the settings say.

### D97. W4b balance: the crew's work is new production, and the simulator learnt keycodes
- The crew's work made every tier come sooner. To compensate:
  - node jobs went down from the 25% drafted to 15%;
  - Sheet Metal costs 12% more (stone 54,000, ingots 43,000).
- The simulator's archetypes now:
  - put everyone to work (the cook at the campfire, the tinkerer at the busiest station, the
    rest on the node the next tier lacks most);
  - rest the tired at every check-in;
  - value a site by the highest tier it opens (a keycode site counts half a tier above the
    site it unlocks);
  - prefer an unvisited site on a tie;
  - take a navigator to sea;
  - press the fuel a better site's rations wait on.
- Results (seed 1, 35 days):

  | | Casual | Active | Optimal |
  | --- | --- | --- | --- |
  | Stone | day 4 | day 2 | day 2 |
  | Sheet Metal | day 12 | day 11 | day 8 |
  | Armored | day 22 | day 18 | day 14 |
  | First trip, tier 3 | day 13 | day 11 | day 8 |
  | First trip, tier 4 | day 20 | day 14 | day 11 |
  | First trip, tier 5 | day 23 | day 17 | day 13 (the Submarine Pen) |
  | Offshore Platform | after day 35 | day 21 | day 18, the floor |

- New pacing targets:
  - casual has someone working by day 3;
  - casual's first tier-4 trip by day 26, tier 5 by day 31;
  - optimal reaches the Offshore Platform no earlier than day 18.

## W5 (the Den: market, contracts, casino, leaderboards)

### D98. What only the server knows is a `World`; three commands are server-only
Until W4 every command touched one base, and the client predicted it with the same
`applyCommand`. Two W5 commands cannot work that way:
- a purchase reads another player's base;
- a casino roll must be unknown to the player before the bet. Every seed in `BaseState` is
  visible to the client.

`applyCommand(content, state, command, now, world?)` and `settleAll(..., world?)` take a
`World`:
- `seed`: per slots spin or dice roll, from `crypto.randomInt`;
- `reveal(round)`: the wheel's result, from HMAC(secret, round);
- `jackpot`;
- `listing`: the row a buyer names;
- `self`.

Without a world, `market_buy`, `slots_spin` and `dice_roll` refuse `server_only`. The store
treats that as "wait for the server": the button shows pending, and the answer's events
play when it arrives. Everything else in the Den is deterministic and predicted as usual
(listing, cancelling, the Den's counter, contracts, placing a wheel bet). The casino secret
is generated on first boot and kept in `settings`, like the VAPID keys.
*Revisit* if a player can be shown to profit from timing (no case known).

### D99. Escrow lives in the seller's base; a sale is one transaction over two bases
- A listing is part of the seller's `BaseState` (`listings`): the goods leave the stock
  when listed, together with a 5% fee the Den keeps.
- A `listings` table is the board's index. It is written from the domain's events
  (`listed`, `listing_cancelled`, `listing_expired`) in the same transaction as the base.
- A purchase runs in one SQLite transaction:
  1. settle the seller (an expired listing goes home first);
  2. offer the listing to the buyer's `applyCommand` only if it is still up;
  3. on success, `takeListing` pays the seller (uncapped);
  4. save both bases, close the row and write a `trades` row;
  5. push to both players, and send the seller's "sold" notification (a new kind, off by
     default).
- Rules: whole listings only, at most four up, 48 hours, a price floor of 50% of the
  reference price (no gifting), never your own.
- A property test (`market.test.ts`) runs random lists, buys, cancels and expiries across
  three bases. Goods are conserved, and scrap falls by exactly the fees.

### D100. The Den trades too: a daily counter and daily contracts, priced from one table
The owner chose a Den that trades itself, since a market with two players would mostly be
empty. `den.json5` holds:
- `refPer100`: the scrap value of every tradeable good;
- the counter: five offers a day from a pool, the same for everyone at the same tier
  (seeded by the UTC day, like the tasks). Sold in lots at 250% of reference, with a daily
  limit per player. Parts, meals, med kits and one blueprint; no keycodes, which stay site
  finds and player trades;
- contracts: three a day, rolled for the base's tier at the day's start, paying 40% of
  reference and sometimes a blueprint.

Contract pay is below the counter's price for any good, and a content check enforces it,
so buying from the Den and delivering back never makes scrap. The Den opens at Stone, which
the casual player reaches on day 4 (the design says day 5).

### D101. The casino: odds in data, an exact check, chips, a player-funded jackpot
- Every bet option's return is computed exactly from `den.json5` (`@wipe-day/content/odds`).
  The content check fails the build outside 90-95%. Today:
  - wheel segments 91.2-92.8%;
  - slots 93.4% (the jackpot feed included);
  - dice 91.7-93.3%.
- Bets come in 5-scrap chips, and every pay is a whole number of scrap per chip (also
  checked), so integer payouts never skew a return.
- Limits by tier, about half a casual player's daily scrap income (the owner chose 50% over
  the design's 20%):

  | Tier | Biggest bet | Daily wager |
  | --- | --- | --- |
  | Stone | 10 | 50 |
  | Sheet Metal | 25 | 150 |
  | Armored | 50 | 250 |

- The jackpot pays 200× the bet plus the shared pool. Every spin feeds the pool 1% of its
  bet, kept in hundredths of scrap. The Den never seeds it: a house-seeded pool would return
  over 95% at small bets and pay less than three Lanterns at the biggest bet.
- `pnpm sim rtp` and `rtp.test.ts` play a million rounds of each option with the domain's
  rolls. All are within one point of the exact figure; slots, the noisiest, is +0.8.
- 50 parallel spins with distinct keys never pass the daily cap (`apps/api/src/den.test.ts`).
  better-sqlite3 transactions do not interleave.

### D102. The Wheel of Salvage: global 30-second rounds, spun on time
- Round `r` covers `[30r, 30r + 30)`. Bets close 5 seconds before the spin; a later bet
  rides on the next round.
- A bet is stake-and-wait in the base (`wheelBets`). It pays when settling passes the
  round's end with `reveal` known, so every bettor meets the same result.
- When the first bet of a round is logged, the server schedules one settle of all its
  bettors at the round's end (+250 ms). The minute tick settles any it missed, such as after
  a restart, because `nextEventAt` includes the round's end. The client's own tick leaves the
  wheel out (`nextEventAt(..., { wheel: false })`).
- The event stream's `den` messages carry new bets, results, the jackpot and "the board
  changed".
- In demo mode the wheel turns on the 240× demo clock, like node regrow (D65).

### D103. Leaderboards from counters kept in the base; the season card
- `stats` in `BaseState` counts:
  - sites cleared (a success or a partial, once each);
  - the best haul;
  - player-trade volume;
  - wagered, won and the biggest win;
  - contracts;
  - when each tier was reached.
- `recordStats` updates them from the events of every command and settle, so no rule has
  to remember to count.
- The categories are Wealth (holdings at reference prices), Builder, Explorer, Trader,
  Lucky (biggest win) and Guard (D90's defence). More than one way to play can come first.
  Ties share a rank.
- `GET /api/ranks` settles every base of the season read-only.
- The season card (tier days, sites, best haul, crew, worth, trades, best win, ranks) heads
  the Ranks tab; W7 shows it again at the reset.

### D104. W5 balance: the Den as a scrap sink, late site scrap trimmed, sea scouts not skippable
- The simulator's players now use the Den the way people would:
  - deliver contracts from surplus;
  - buy the parts their next goal lacks;
  - buy a meal when the cupboard is bare and a first-aid kit when someone is hurt.
- The new gambler archetype plays the cap at every check-in.
- The Den alone could not absorb late scrap: from day 15 to day 35, tier 3-5 sites gave the
  casual player about 10k scrap. Scrap loot at those sites is now 60% of before.
- Results (seed 1, 35 days; scrap on days 14 / 21 / 28 / 35):

  | | Casual | Active | Optimal | Gambler |
  | --- | --- | --- | --- | --- |
  | Armored | day 22 | day 18 | day 14 | day 21 |
  | Scrap | 1.0k / 2.1k / 1.8k / 5.2k | 1.3k / 2.2k / 4.4k / 6.8k | 3.3k / 7.1k / 12.2k / 17.4k | 1.2k / 2.3k / 3.3k / 4.9k |

  Before W5, casual held 6.1k on day 28.
- New pacing targets:
  - casual holds 800-4000 scrap on day 28;
  - the gambler's scrap never goes negative;
  - no day's wagers pass that day's cap.
- The gambler's casino net is not asserted. Over ~260 bets the spread is about ±1.1k
  against an expected loss of ~0.4k. This seed happened to win (wagered 5.2k, paid 6.5k),
  so the RTP tests carry the proof instead.
- Fixed: a map scrap could chart a sea region, which skipped the 24-hour boat scout that D95
  relies on. The Offshore Platform's day-18 floor held only by luck; W5's contracts shifted
  the dice and it fell to day 17. Map scraps chart land only now, and the platform is on
  day 18 in every Den variant tried.
- *Revisit* when W6 (charges) and W7 (the Signal) add late sinks: site scrap can go back up.

### D105. Where the Den lives: a skiff on the beach, a flag on the map, Ranks beside the feed
- The owner chose the skiff and the map marker for phones, where the five dock slots are
  taken. From Stone on, a smugglers' skiff lies on the beach beside the barrel:
  - its tap target never shrinks below 64 CSS px (D48);
  - its lantern is on the lights layer (D47);
  - it glows when a contract can be filled.
- The map shows the Den's flag from the start, dimmed with "opens at Stone" (no hidden
  features). Desktop gets a Den dock button, disabled with the same reason before Stone.
- A new advice, `den` (a contract is ready), ranks after craft and before gather.
- Ranks are a second tab of the feed panel, now titled "The island", which phones already
  reach from the clock chip.

## W6 (raids and defence)

### D106. What a raid can take: a capped slice of the yard, never parts, items or crew
The owner chose "resources plus a little scrap" (2026-10-06). The design's "unboxed resources"
means this slice, because crates add room but hold nothing of their own:
- At most `capPercent` (10%) of each raw and refined resource in stock, counting what is
  waiting to be collected (it is banked at the landing).
- At most 10% of the scrap, and never more than the tier's ceiling (50 / 150 / 300 scrap at
  Stone / Sheet Metal / Armored).
- Parts, items, gear, blueprints, crew and goods in escrow are never at risk.
- The cap holds per raid. Property tests over random bases (`raids.test.ts`, `pvp.test.ts`)
  check it for NPC and PvP raids.
- NPC breaches take `lossPercent` (5%), half the cap. At 10% the casual player's Sheet Metal
  slipped to day 16 (see D112). PvP takes the full cap.

### D107. NPC raids follow a player who plays, land on a planned night, and settle at their time
- **Planning.** `planRaid` runs after every command, refused ones included, when no raid is
  pending. A plain look, the server's tick and the client's frame never plan, so however long
  a player stays away, at most one raid lands meanwhile.
- **Landing time.** The raid lands on the UTC day `planDays` (2) ahead, at a seeded time in
  20:00–23:00 UTC. That is the scene's night and the Czech evening, so the "raided" push does
  not wake anyone at 3 am. It is never sooner than 72 hours after the base reached Stone.
  Bases that reached Stone before W6 count from their first command after the update.
- **Prediction.** The time depends on the day, not the second, so the client predicts the
  same plan as the server.
- **Settling.** `settleAll` splits at the landing: it settles everything else to `raid.at`,
  resolves the raid against the base as it stood then, and settles on to now. It never
  recurses. The warning flips once at `at - warnHours` and is a timer like the landing
  (`nextEventAt`).
- **Rolls.** Strength = the tier's base plus one point per 40 scrap at risk, capped by tier.
  Hold chance = defence / (defence + strength), clamped to 10–95%. Held: the raiders leave
  scrap and sulfur (gunpowder and charges higher up). Breached: the loss, and the defences
  are damaged (D108).

### D108. The defence score: buildings and guards; a breach halves the buildings until repaired
- Defence = the buildings' new `defence` effect plus the guards (D90):
  - walls: 10 / 20 / 35;
  - watchtower: 2 / 4 / 6, plus `warnHours` 5 / 9 / 15 on top of the base 3 hours;
  - new traps at Stone: 6 / 12 / 20;
  - new turret at Sheet Metal: 20 / 35 / 55.
- 18 building types now.
- After a breach (NPC or PvP) the buildings count `damagedPercent` (50%) until a `repair`,
  which costs scrap and stone by tier. That is the report card's follow-up, and another late
  scrap sink.
- The Guard leaderboard now ranks the full score.

### D109. Gunpowder, charges and three bandit camps
- Sulfur gets its first use:
  - gunpowder: 20 sulfur and 5 charcoal make 5, at the kiln;
  - a charge: 20 gunpowder and 4 cloth, at workbench level 2.
- Both are parts: uncapped, never at risk, tradeable.
- Three bandit camps are sites with `camp: true` and charges in their rations:
  - Driftwood Camp: tier 2, 2 charges;
  - Saltpan Camp: tier 3, 4 charges;
  - Cinder Fort: tier 4, 8 charges.
- They reuse the trip engine whole. They pay in parts, sulfur and high blueprint chances,
  with little scrap, and can be raided again and again.
- They stay out of the site chain: the simulator's site targets ignore them, and so does a
  keycode's worth.
- A `pin` places their map marker clear of the ruins' labels.

### D110. PvP: opt-in from Sheet Metal, one instant transaction over two bases
The owner chose instant raids from Sheet Metal (2026-10-06). The flow mirrors a market sale
(D99):
1. The server settles the defender.
2. It hands the defender to the attacker's `raid_player` as `World.target`.
3. The domain rolls on the server's seed.
4. `takeRaid` applies the defender's half with exactly what the attacker's report took.

Both bases are saved in the same SQLite transaction.

The limits, each with its own test:
- **Opt-in.** Joining needs Sheet Metal (`set_pvp`).
- **Leaving.** Locked for 48 hours after your own raid, so a victim's revenge can always land.
- **Charges.** Paid up front, by the target's tier (6 / 10), win or lose.
- **Shield.** 24 hours after being broken into. Attacking ends your own shield.
- **Frequency.** One attack per rolling 24 hours, and the same target once per 72 hours.
- **Tier fence.** At most one tier apart either way (the design doc's "within one tier"). With
  PvP opening at Sheet Metal it cannot bite today, but it is tested with a fence of 0.
- **Revenge.**
  - Any raid but a revenge raid gives the defender a 48-hour token.
  - It costs half, rounded up.
  - It skips the 72-hour rule and the fence, never the daily limit or a shield.
  - It is used up either way and gives no counter-token.
- **The take.** On a breach the attacker takes the full capped slice, fitted to its own
  storage room. The defender loses exactly what the attacker gains, so a raid creates
  nothing.

The API tests cover:
- two attackers racing for one target;
- a replayed key;
- 50 parallel attacks with distinct keys (exactly one gets through);
- an NPC raid due on the defender before the take.

No migration: all of it lives in the bases' JSON.

### D111. Raid notifications and the feed
- "Raided" (on by default since W4b) now fires for NPC landings and PvP raids, with what was
  lost.
- A new "Raiders sighted" kind is off by default (6.3 rule 11).
- The feed carries NPC raids (held or broken in) and every PvP raid, from the attacker's log
  line.
- Raids join the welcome-back summary. A push opens the game on the raid's report card
  (`?report=`), and the warning opens the Defence panel (`?defence`).

### D112. W6 balance: raids cost the casual player a day or two, and the targets say so
- The simulator's players:
  - build defence first once raided;
  - post their best guard when a raid is announced and the walls would likely not hold;
  - repair;
  - make gunpowder and charges up to their dearest known camp;
  - raid camps when nothing better is open (a camp is worth half a tier below its own).
- A new raider archetype (active) raids a casual player who opted in. `simulatePair` plays
  both halves.
- Results (seed 1, 35 days):

  | | Casual | Active | Optimal | Gambler | Raided casual |
  | --- | --- | --- | --- | --- | --- |
  | Sheet Metal | day 14 | day 12 | day 9 | day 16 | day 15 |
  | Armored | day 23 | day 18 | day 15 | day 22 | day 24 |
  | NPC raids held by day 28 | 3 of 7 | 5 of 9 | 5 of 12 | 3 of 7 | 5 of 8 |
  | Camp trips (35 days) | 14 | 71 | 128 | 19 | 13 |
  | Scrap on days 14 / 21 / 28 / 35 | 1.0k / 1.1k / 3.1k / 5.6k | 1.2k / 1.3k / 3.0k / 4.1k | 3.4k / 4.5k / 7.0k / 10.8k | 1.1k / 0.6k / 0.1k / 4.4k | 1.3k / 1.1k / 3.2k / 4.6k |

- The raider got in three times, and the raided casual still reached Armored on day 24.
- Before W6 the casual player reached Sheet Metal on day 12. Without NPC raids it still
  would; with them, day 14. The metal tier is ingot-bound, and a small loss pushes the build
  past a check-in.
- Tried and rejected:
  - a 10% NPC loss and a 48-hour grace: Sheet Metal on day 16;
  - stronger raiders: the casual player held under a third.
- New pacing targets:
  - the first raid by day 8;
  - casual holds at least 30% by day 28;
  - the first camp by day 16;
  - the raider gets in 3+ times;
  - the raided casual reaches Armored by day 28.
- Late scrap still rises (casual 5.6k on day 35). Camps and held raids add some. D104's
  site-scrap trim stays.

### D113. Where defence lives in the client
- **Desktop:** a Defence dock button (disabled with "Opens at Stone" before then).
- **Phones**, where the five dock slots are taken (D45):
  - a shield badge over the walls, fixed size (D48), showing calm, sighted, broken or
    shielded;
  - a full-width "Raiders sighted · land in 6h 30m · 82% to hold" banner under the top bar
    from the warning until the landing.
- The advisor's new `defend` and `repair` advice lights the button or the banner.
- **The panel:**
  - Defence tab: the score and its parts, the announced raid's odds and what is at risk,
    one tap to post the best free guard, the repair, and the history.
  - Raids tab: the rules come before "Join the raids"; the targets list follows.
- PvP buttons use a separate danger style, never the advisor's primary red (6.3 rule 1).
- **The scene:**
  - the raiders' torches gather on the ridge once sighted;
  - breaches show in the wall while damaged;
  - traps and the turret are drawn at three levels.

## W7 (seasons and the legacy layer)

### D114. A season ends by command; its end is announced in the game
The owner chose manual seasons (2026-10-07).
- **Announce:** `pnpm season announce <YYYY-MM-DD> [--next <modifier>]` sets the end date
  (20:00 UTC that day) and the next season's modifier. The clock chip shows "Season ends
  in …", and the announcement opens the Signal at once.
- **End:** `pnpm season end` runs the reset (D115).
- **How the CLI reaches the API:** both commands call `POST /api/admin/season/*` on the
  running API, so the API stays the database's only writer (D52).
- **Who may call it:**
  - with `ADMIN_TOKEN` set: the bearer token;
  - without one: requests from the server's own loopback. On the VPS the CLI runs inside the
    container with `docker exec`, while public traffic arrives from Caddy over the Docker
    network, never from loopback;
  - development servers take any request.

### D115. The reset is one transaction after an online backup
`Game.endSeason`:
1. Copies the database (`wipeday-pre-season-N.db`).
2. In one SQLite transaction:
   - settles every base of the season read-only;
   - computes the leaderboards and season cards;
   - writes `season_archive` (card, ranks, points) and `hall_of_fame` (every category's
     winners and the Signal's top giver);
   - folds every base into its player's `legacy` row;
   - closes the season and nulls the old bases' `nextEventAt`, so the tick never touches
     them again;
   - closes open listings, zeroes the jackpot and drops the wheel's bets;
   - opens the next season with the announced modifier, or one drawn from the season number.
3. Clients get a `season` message on the Den's stream and reload.

A player's new base is created on their first look. It starts from `newBase(…, carryFor(legacy,
season))`. The snapshot test (`apps/api/src/season.test.ts`) asserts that this base is exactly a
fresh base plus what was kept. The welcome-back summary reads only the current season.

### D116. What is kept: blueprints, the crew's levels, perks, titles and skins
- **Blueprints:** the union of every season's.
- **Crew levels:** each survivor's best level and XP. They arrive the usual way (the start
  crew on day one, the rest by boat) already at that level (`BaseState.veterans`).
- **Perks:** stay bought.
- **Titles:** won by coming first in a category ("Pathfinder · season 1"), or by being the
  Signal's biggest giver ("Keeper of the Signal").
- **Skins:** earned, never bought:
  - Driftwood: finish a season;
  - Rust: hold off 10 raids in one season;
  - Beacon: be on the island when the Signal is lit.
- Gear, stock, buildings and tiers reset.

### D117. Legacy points buy small perks, applied at once, capped at 25%
- **Points per season:** 3 for playing, 5 / 3 / 2 / 1 for 1st–4th in each category, and up to
  10 for a share of the Signal's gifts.
- **Spending:** points can be spent at any time, and a perk applies to the running base at once.
  `buy_perk` is server-only: the points live in the legacy row, passed in as `World.legacy`.
- **The eight perks:**
  - gathering +2% a rank;
  - storage, crafting and smelting +3% a rank;
  - +2 trip success a rank;
  - +6% crew XP a rank;
  - an old friend (the best veteran is home from day one);
  - a packed crate.
- **Where they apply:** perks and the season's modifier feed the one `modifiers()` aggregator.
- **The 25% cap:**
  - The content check sums every perk at its top rank (trip success counts against the
    weakest site's base chance) and fails the build above 25%.
  - `legacy.test.ts` walks every combination of ranks (12,288). In each one, every rate stays
    within 1.25× of the same base without perks: gathering, storage, craft and smelt speed,
    trip odds and XP.
- **The veteran in the simulator** plays optimally in a later season, with every perk, every
  blueprint and the crew at level 5:
  - It reached Armored on day 13 at the drafted 3–4% perks.
  - At today's numbers it reaches Armored on day 14 (the floor) and the Offshore Platform on
    day 18 (the floor), against optimal's day 15.
  - The pacing check holds it to the floors and to at most 25% faster.

### D118. Four season modifiers, one per season
All values live in `seasons.json5`:
- **Long Nights:** raiders +20%.
- **Rich Tides:** barrels 60 min sooner, +1 roll.
- **Quiet Raiders:** a raid every 3 days, −25% strength.
- **Storm Season:** barrels 90 min sooner, gardens −30% food, trips +10% loot.

Each touches knobs that already existed (D69). The first season has none, the live one
included.

### D119. The Signal: the island's shared tower for the last week
- **Opening:** on season day 21, or when the end is announced.
- **Stages:** foundation (stone, planks), tower (frames, plates), lamp (gears, springs), fuel.
  They are sized for a small island to light in a week of deliberate giving. In the
  simulator, a casual player giving only surplus fills the first stage.
- **Gifts:** `signal_give` is server-only (`World.signal`). A gift is cut to what the stage
  still needs and to what the base holds. The server adds it in the same transaction, so
  two players racing for the last units never overfill (tested).
- **Ranking:** gifts are valued at reference prices. The lit Signal reaches the feed, and
  its beam sweeps the scene at night.

### D120. Where seasons show in the client
- **The season-over card,** once per new season:
  - last season's card;
  - the legacy points it gave;
  - what carried over;
  - the new modifier;
  - "Begin season N" and "Spend points".
- **"The island" panel:** gains Legacy and Hall of fame tabs.
- **The clock chip:** shows the season's modifier, or when it ends. Short, because the chip is
  narrow on phones.
- **The Signal tower:** stands on the slope behind the holdfast once it opens, and is the way
  into its panel.
- **Skins:** recolour the holdfast's roof and trim, and keep the tier's walls so the tier
  still reads.

### D121. The bot is a client of the API, with a service token and the player's Discord id
The bot holds `BOT_API_TOKEN` (the same value in the API's environment) and calls `/api/bot/*`
for a player named by headers: `x-discord-id`, the URI-encoded `x-discord-name` and
`x-discord-avatar`. Every player route of the web is mounted there too, with the same
handlers, so the bot has no rules of its own: `/base` reads the base, Collect and Gather are
`POST /commands` keyed `discord:{interaction id}` (a retried click runs once). The first call
makes the player, like a first web login, so someone can start on Discord and find the same
base on the web. Bot calls never mark the player seen: the welcome-back summary stays the web's.
A development API takes the bot without a token; production refuses it. The bot keeps no
database: its store, scheduler and frozen rules (`legacy/`, D57) are gone, and a boundary
test keeps rules and databases out of `apps/discord`.

### D122. One-time login links from Discord
`/base`'s "Open the game" is a link with a fresh token (`GET /api/auth/link?t=`): it starts a
normal session and goes to the game. A link works once, for ten minutes (`login_links`, only
the token's hash stored, migration 0004). A spent or expired link just opens the game, where
the session already there or the Discord login takes over. A DM's link opens the right place
(a report) without a token, because a DM stays in the history.

### D123. DMs: the same notifications, opted into by using the bot
A DM carries what the web pushes (the same words, the same kinds and per-kind switches). A
player gets DMs once they have used the bot (`players.discord_dm`: null until then, then on),
and turns them off on `/base` or on any DM; test players never get one. Every DM has the
follow-ups: "Show my base" (the card, right there), "Open the game" at the report, and
"Turn DMs off". DMs are live only: a DM that falls while the bot is down is not sent later,
because the web push and the game itself already carry it.

### D124. The feed channel: one event, both places, and nothing lost while the bot is away
The API's bot stream (`GET /api/bot/stream`) sends the same feed items the web's tabs get,
from the same `event_log` row, and the bot posts them in the very sentence the web's feed
shows (`@wipe-day/domain/words`, moved there from the web). The bot acks what it posted
(`POST /api/bot/feed/ack`); the API keeps that cursor in `settings`, and a reconnect first
sends what came after it (at most 20 items from the last 24 hours, the late ones with their
time). The first connection starts at the newest item, so the channel never gets old history.
Season news rides the same stream: the end announced (with the next modifier) and the reset
(with the winners and their titles).

### D125. `/base` is private and designed for a phone
`/base` answers ephemerally: each player has their own card, updated in place by its buttons.
There is no persistent home message any more. On a phone Discord shows a card only about 290
px wide, so the card is laid out on 600 units (no text under 22, about 10.6 px), three
resources a row. The message reads top to bottom: the title, the status line (what the last
click did, or the one next step), the card, then one line each for what is waiting, the
builders, the stations, parties out, raiders sighted and the season's end, as Discord
timestamps that tick in each reader's language and time zone. The advisor picks the one
primary action: Collect or Gather when it says so and they would do something, otherwise the
link into the game, which leads its row and whose step is the status line (Discord draws every
link grey, so the words carry it). Locked buttons say why ("Gather · 8m", "Collect · store
full"). The customId scheme moved to `idle:v2`; an old v1 button answers with the base.

### D126. The bot's container: the same image, started only when it is configured
The image now installs the bot too; `deploy/compose.yml` runs it as `wipeday-bot` in the
`bot` profile (no health check, 320 MB at most, `API_URL=http://wipeday:8787`).
`scripts/deploy.sh` starts that profile only when `~/wipeday/.env` has `DISCORD_TOKEN`,
`DISCORD_GUILD_ID` and `BOT_API_TOKEN`, so a deploy before the owner's setup still works.
`pnpm preview` draws every message from the payload the bot sends, in Discord's dark theme at
phone and desktop width (`preview/discord/`), because the agent cannot open Discord.

## R0 (foundations: the redesign)

Approved by the owner on 2026-10-10. The plan is `docs/redesign/` (README, `01`-`11`, and
`working/` with the canon and, overriding it in this order, its amendments, resolutions and
errata v3). D127-D145 follow canon section 16's order. Old entries are never edited: D137 lists
every decision the redesign overturns or modifies, so a reader of an old entry finds what
replaced it.

### D127. The redesign: an incremental idle game with a personal nuke
Wipe Day becomes an incremental game on Saltmarsh *(proposal)*: tap for Supplies, buy 14
production lines, hire a hand per line, climb five eras, then press the Big Red and nuke your own
island for Crater Glass, which boosts everything (Glow) and buys nodes on the Blast Map, a
permanent 361-node tree. The owner's brief ("whole game should be idle", "MASSIVE tree", "funny
red button", "scrap more rare") and the evidence against the W-phase loop (a check-in game of
about 62 purchases a season against 84 check-ins, caps as the real wall) are in
`docs/redesign/01-vision.md`. The plan supersedes the old `docs/game-design.md` (archived as
`docs/archive/game-design-v1.md`) and CLAUDE.md sections 1, 4, 6.3 and 8, which R0 rewrote.
`docs/redesign/09-architecture.md` is the engineering spec. *Revisit* only through a new decision.

### D128. Seasons are not a reset
No monthly wipe: the nuke is the only reset and each player chooses when. One season row lives
forever; "month" survives as a board window that resets nobody. Season 1 runs untouched on the
old build (nobody plays it now, owner decision 7) and ends once, quietly, at the cut-over with one
`pnpm season end`; the Hall keeps it as "the old world". The four season modifiers return as
Dares with the same ids (R7). Two resets would fight for one emotion, a calendar punishes whoever
joins late, and a monthly wipe would take either the Blast Map (meant to last months) or only the
run (which players wipe themselves). *Revisit* only if the tree saturates; the answer then is the
Crossing (a personal second layer), not a calendar.

### D129. The guardrails
Eleven guardrails replace CLAUDE.md section 8, each asserted by canon numbers N1-N27 as amended
(`10-balance.md` 4.9, resolutions section 2, errata v3):

1. The first nuke comes on day 1: N1 first-hour archetype (6 taps/s) 40-60 min; N2 any
   archetype at least 25 min on the wall clock; N3 casual by the day-1 21:00 check-in.
2. Active play is a bonus: N8 tap-driven income (taps plus unmanned lines) at least 50% in run
   1's first minute, direct taps 5-25% from minute 10 outside bursts; N9 an active hour 1.5-3×
   an idle online hour on the weather-weighted hour (rain hours warn, E13); N10 taps credited at
   most 15 a second with a burst of 45, hold counts 4 a second.
3. Friends stay in one race: N16 glass ever at days 30 and 90, active at most 2×, optimal at
   most 2.5×, idler at least 0.5× the casual, asserted in the group of five with Late Tide (solo
   gaps and the doubling idler's trough warn, E11); N17 a late joiner reaches the day-30
   casual's glass ever within 12 days, asserted for two players (five warn, E16).
4. Always something to buy: N4 first hand by 2 min; N5 nothing affordable for at most 30 s in
   the first 10 online minutes of runs 1-5; N6 at most 120 s online with nothing affordable; N7
   at least 90% of casual check-ins in days 1-30 hold a purchase.
5. Every nuke feels faster: N11 run N+1 passes run N's gain in at most 65 / 95 / 100% of its
   time (medians; warn-only until R7); N12 combined power per nuke ×1.5-2.5 / ×1.15-1.6 /
   ×1.1-1.5; N13 five consecutive nukes together under ×1.3 with nothing opening in the next
   three fails.
6. The tree lasts months: N14 6-10 nodes at the first nuke, later median at least 2; N15 optimal
   at most 45% lit by day 30, 100% not before day 90; casual at least 45% at day 180 (warning).
7. Absence never hurts: N18 the Night Shift is 12 h at the start, 48 h at most, 100% inside; a
   full window stops accrual and destroys nothing.
8. Precious things are never at risk: glass and scrap are never traded, gifted, wagered, stolen
   or sold; no casino. N19 scrap: casual 0.8-2 a day (7-day averages from day 2, one-offs
   excluded), at least 25 by day 30, nobody above 2.5 (single windows warn, E15).
9. Randomness is visible: odds printed in the game (an Odds sheet in Settings from R1, the
   Logbook from R4); no hidden catch-up (Late Tide is labelled to its player); N20 timers and
   meters (flotsam every 4-10 min for 13 s, Afterglow, Hustle ×1-×2 on real seconds, the
   Magnet).
10. Numbers stay meaningful: N21 the prestige shape (D132) in data; N22 the 10% rule; N23 run 1
    ends at 1e10-1e12 supplies made, under 1e150 over 180 days, always finite.
11. Respect the clock: active timers are real seconds, idle timers run on the game clock (D138);
    N24 settle path independence 1e-9 and the tick oracle 1e-6; N25 tap batches of at most 1 s
    or 30 taps, slim records for 1 h, a ping every 5 min; N26 the Blast Map's bands and mix;
    N27 touch targets at least 44 CSS px, the tap target at least 120 px tall on a phone.

Retired: the 25% legacy cap and its four enforcements, "8 check-ins ≈ 1.6×", the day-14 and
day-18 floors, storage caps as the check-in driver, the casino and PvP rules. `pacing.json5` v2
marks each assertion with the phase that switches it on. *Revisit* a band only with simulator
output for every archetype and a decision.

### D130. Finite doubles behind `Amount`
Supplies reach about 1e39 in a year, far past 2^53, so amounts are finite doubles behind an
`Amount` alias (`packages/domain/src/amount.ts`): `finite()` wraps every sum that can grow
without bound, and `assertFiniteState` runs after every simulated step and in the API's `save()`
(where `JSON.stringify` would write `Infinity` as `null`). Counts (owned units, hands, nukes,
scrap, taps) stay integers; glass is a whole-valued double. Fractional remainders stay in state
(display floors), so many small settles equal one big one. Content amounts are
`z.number().finite().nonnegative()`. Amends CLAUDE.md 4's "Integers in state" and D19.
*Revisit* with a mantissa/exponent type behind `Amount` if numbers ever approach 1e300.

### D131. The currencies
Supplies, the one run currency (owner decision 0): each line sells what it makes; products are
drawn and badged (amendment A1) but never stocked or spent. Crater Glass (`glass`): glass ever
drives Glow and is never spent; glass held buys Blast Map nodes. Scrap: rare and persistent,
small integers, about 1-2 a day, never lost on a nuke (`05-meta-layers.md`). Sea Charts:
reserved for the Crossing. *Revisit* materials only if R1's screenshots read as "a number going
up in a Rust skin" (`07-what-changes.md` section 1's fallback).

### D132. The prestige shape
`G(L) = floor((L / L0)^(1/5))` with `L0` 5e5 over lifetime supplies; a nuke pays
`(G(L) − level) × multipliers` into glass ever and held (Late Tide applied after it, from R6).
Glow is `1 + k × √(glass ever)` with `k` 0.25. The first nuke needs 10 glass, later ones a gain
of 1. A nuke adding at least 10% to glass ever (the first always) is a counted Wipe Day; one
below is a small blast that pays quietly. Granted glass goes to held only and never moves Glow.
The constants live in `packages/content/data/prestige.json5`. The cube root of canon v1 ran away
in the model (first nuke at 22 min, the optimal player 287,000× the casual at day 30); the fifth
root (owner decision 9) holds N1-N3 and N16. *Revisit* the exponent last, and never above 1/5
without a group-simulation proof.

### D133. Meta in the base document; `nuke` is pure
`state.meta` (glass, nodes, Wipe Days, records, stats, scrap, Logbook) lives in the same
`bases.state_json` as the run, so one transaction, one version and one prediction cover a nuke.
`nuke(state, now)` is an ordinary command: settle, pay cycles in flight, fold the run into
`meta`, start `newRun`; the same `bases` row is overwritten and `version` keeps rising. `World`
inputs are copied into `meta.world`; tree buys and the nuke are predicted on the client. The
state carries canon 9's reserved `island` and `KEEP_ON_CROSSING`. A stored base with `v !== 2`
loads as fresh, saved in place with the version raised (the cut-over's safety net). Modifies
D61, D98, D115, D116. *Revisit* if a base outgrows 24 KB on day 180 (a simulator test).

### D134. The slim taps transport
Taps travel in batches of at most 1 s or 30 taps (`{count, from, to}`, whole seconds). The
server credits them through a token bucket of 15 a second with a burst of 45 (N10) and clamps
the times to its own clock, so over any interval it credits at most `45 + 15 × elapsed` whatever
a client claims; an honest tapper is never clamped. Every command stores an outcome-only record
(no state): taps and pings for 1 hour, with no `event_log` row and a version-only push to other
tabs; every other command for 7 days. A replay returns the stored outcome with the current
state. The client never drops a predicted tap: it retries with the same key. Amends D59.
*Revisit* if one tab's hour ever stores more than 3,700 slim records.

### D135. Effects as data
Every bonus is `{stat, op: add | inc | more | set | unlock, value, scope?, per?, max?, when?}`
with one registered vocabulary (`09-architecture.md` 5.1) and one evaluator folding in a fixed
order: base, add, milestones, (1 + Σinc), Πmore, Glow, Morale, transient buffs, offline. Each
stat has a direction, so tests prove monotonicity (adding a non-keystone source never makes a
stat worse) and per-stat bounds. Replaces `modifiers()` and the 25% cap's enforcements.
*Revisit* if a mechanic cannot be expressed; it then gets a `feature:<id>` unlock, budgeted per
phase.

### D136. No autobuyer inside settle
Settle never buys: it is closed-form and path-independent only because purchases happen in
commands. The Foreman buys through ordinary `buy_line` commands while a page is open, and its
one pass on Collect runs inside the `collect` command; Dead Hand sends `nuke` from the client.
The server never nukes. *Revisit* never: offline automation would need buying inside settle.

### D137. The cut list
Removed on `redesign` (history at the `pre-redesign` tag): Gather and its cooldown, the daily
node haul, construction timers and builders, upkeep and decay, storage caps, 22 of 23 stocked
resources, the crafting web, blueprints, items, crew jobs, tiredness, bonds and gear, daily
tasks, the Den counter, contracts, the player market, the casino, NPC raids, defence, bandit
camps, PvP, monthly seasons, the Signal, the 25% legacy cap. Parked (deleted from the build, may
return as a sea layer): expeditions, the map and fog, sites, regions, keycodes, trip events,
report cards. Reworked: buildings as lines, base tiers as eras, tools as Grip, crew as hands,
barrels as flotsam, the node game as the era target, legacy as `meta` and the Blast Map, the
season card as the postcard, leaderboards as scale-free boards. Kept: the advisor, welcome back,
weather (now domain data), the feed, Web Push, the Discord companion, commands, SSE, prediction,
the clock. Owner decision 5 accepted the whole list.

- **Overturned:** D17 and D19 (D130, D137), D25 (D144), D26 and D33 (the Night Shift), D27,
  D72, D28, D71, D29, D34, D76, D37, D38, D62, D87, D63 (D134), D74, D82, D97, D104, D112
  (D144), D77-D80, D83, D84, D90-D92, D99-D102, D106-D111, D113, D114 (D128, D145), D117 (D139,
  D129), D119 (D142).
- **Parked:** D85, D86, D88, D89 (its map half; the dev-API half stays true), D93, D94, D95.
- **Modified:** D36 (flotsam), D42 and D75 (the phone reframe, D138), D45 (the drawer and five
  nav items, D138), D51 (the 1× demo clock and `wall`, D138), D54 (the off-server copy, D143),
  D56 (D144), D59 (D134), D61 (D133), D67 (advisor v2), D69 and D70 (lines with formulas,
  D135), D81 (D139), D96 (D138, D142), D98 (D133), D103 and D105 (D142), D115 and D116 (D133),
  D118 (Dares), D120 (the postcard), D121 and D125 (D142).
- **Kept:** D1-D3, D7, D11, D13-D15, D21, D23, D40, D41, D43, D44, D46-D50, D52, D53, D58, D60,
  D64-D66, D68, D73, D122-D124, D126. The rest is history.

*Revisit* a removed system only with a scale-free design that keeps guardrails 7 and 8.

### D138. The 6.3 amendments and the orange primary
CLAUDE.md 6.3 changes: rule 1, exactly one crowned thing per view, signal orange, and the Big Red
is never primary-styled (today's red would blur it; owner decision 11, with the contrast fixes
in R1: `--muted` #b5afa4, panel alpha 0.86); rule 8, the shop drawer plus five nav items
(Island, Blast Map, Crew, Logbook, Friends), the nav row hidden until its first destination
unlocks; rule 9, production cycles may be seconds, idle timers (Night Shift, Magnet, cooldowns,
Freighter) run on the game clock and active timers (Hustle, flotsam, buffs, felling, the
cinematic) on real seconds; rule 10, welcome back's one primary is Collect, never the nuke; rule
11, only "Night Shift over" on by default, with quiet hours 22:00-08:00 in the browser's time
zone; new, never tease unshipped content (D140). The demo game clock runs at 1× with jumps
(+1 h, +6 h, the next 08:00), not 240×, and a `wall` clock returns beside it, so shots pin game
time and animation time separately (amends D51). A jump is time passing for everything the
domain times, and never moves a real-second animation. *Revisit* the 1× clock only if reviewing
idle timers by jumping proves too slow.

### D139. The Blast Map
361 permanent nodes in 8 sectors × 9 rings around Ground Zero, shipped in waves: 73 in R2 (rings
1-3), 178 / 191 / 201 across R3-R5 as their systems ship, 361 in R7 (rings 7-9 in data from R3,
hidden). Six node types (187 small, 70 notable, 16 keystone, 36 unlock, 36 automation, 16
completion), exactly three keystone slots (Wipe Days 10, 20, 40), drawn in React DOM and SVG, no
respec except a free one after a tree patch (`respec_all`, with a decision). The authoritative
power budget is `10-balance.md` section 6, checked per ring, column and sector. Replaces the
legacy perks and their cap (D117); modifies D81 and D120. *Revisit* the outer rings with the
late-wall choice before R7.

### D140. Never tease unshipped content
A locked thing shows only a real, reachable reason; nothing in the game names a system that has
not shipped. The client derives what to show from content (no data, no nav item); the agenda
lists shipped content only; the Blast Map's later waves are in data but hidden until their
phase. The common contract checks it every phase. *Revisit* never.

### D141. Icon namespaces
Icons live in `packages/content/icons/<kind>/<id>.svg`, shared by the web and the bot, with the
kinds `currency`, `product`, `line`, `tier`, `tool`, `target`, `flotsam`, `crew`, `toolbelt`,
`sector`, `node_type`, `node`, `dare`, `skin`, `ui`, `nav` (ids collide across kinds). A square
48 viewBox, `currentColor` with at most one fixed accent, no raster, text, filters, gradients
or `id`s, legible at 16 px. A content test fails on a malformed file, prints the missing ids and
falls back to today's lettered tile, so a missing icon never blocks a phase; the loader comes
with R1's icons. *Revisit* if the bot's renderer cannot inline a valid file.

### D142. The social rules
Players meet through counts, times, ratios and each player's own scale: nuke news, Blowback
(crates washed onto friends' shores, never taken from anyone), the Island Count, the Freighter
(each load costs the loader one hour of their own output), Late Tide (catch-up labelled to its
player only), scale-free boards and Visit. No trading, gifting, PvP or shared absolute goals;
no command writes another player's base. The bot only collects (owner decision 18: no nuke from
Discord). Notifications: only "Night Shift over" on by default, quiet hours on. Replaces D119
(the Island Count takes the Signal's job); modifies D96, D103, D105, D121, D125. *Revisit* with
the R6 playtest.

### D143. Backups and `event_log` safety
An off-server copy comes before any wipe. R0 set up `deploy/offsite.sh`: rclone into a `crypt`
remote over the owner's Google Drive (the owner's own OAuth client, scope `drive.file`), `pre/`
kept forever and the nightly copies for 30 days, copy only, from `vpsuser`'s crontab at 04:30,
with a restore drill in `docs/deploy.md`. Its status file is `var/offsite.json`, not
`var/backups/offsite.json` as planned, because the container owns the backups folder and the
host user cannot write there. The `event_log` id sequence is never reset, not even at the
cut-over (the bot's feed cursor and the Blowback cursors depend on it); rows are never updated,
and taps, pings and purchases write none (they roll up into the run summaries). Modifies D54.
*Revisit* the retention when the database passes 200 MB (R7).

### D144. Simulator v2
The simulator plays lifetimes of runs through the real domain (no second economy) over 30, 90
and 180 days (365 with `--full`), with five archetypes (idler, casual, active, optimal, late
joiner), the first-hour and autoclicker scenarios, and from R6 a lockstep group of five. The
idler taps only while nothing runs by itself. `pacing.json5` v2 holds the targets with the phase
that switches each on; the `test` profile runs inside `pnpm test` in under 10 s, and
`pnpm sim check --full` runs before R2, R3 and R7 ship. The casino's RTP check goes with the
casino. Overturns D25, D74, D82, D97, D104, D112; modifies D56. *Revisit* by dropping the test
horizon to 60 days, before any assertion is weakened, if the profile grows past 10 s.

### D145. The `redesign` branch and the frozen old game
The redesign is built on `redesign`, branched from the `pre-redesign` tag on `main` after R0's
backup landed (2026-10-10). `main` is frozen: nothing lands there beyond R0's backup except an
emergency fix if the live server or the backup breaks, which is committed, deployed and pushed
on `main` and merged into `redesign` at once (keeping deletions). The cut-over at the end of R2
tags the old game `season-1-final`, ends season 1 once, wipes run state only
(`09-architecture.md` 13) and merges `redesign` with `--no-ff`. After it `main` is live again
and each phase gets its own branch. *Revisit* never: shipping pieces early would mix two games
in one image.

### D146. R0's client: the land is the tap surface until the tree stands
R0 ships "no visuals beyond a bare island" (`11-roadmap.md` 6.1), yet the taps transport has to
be played end to end. So the island's land (on or below the ground line, east of the surf) counts
taps and holds (4 a second after 0.35 s), with a "+N" rising from the finger, and a pulsing "Tap
the island" pill is the one thing to do until the first tap. R1 replaces both with the era
target and "Tap the tree." The counter shows its `/s` line only once something runs by itself,
so a fresh island shows one number. The demo starts on day 1 at 08:00 UTC; shots render in UTC;
the sky follows the browser's time zone until R1's island clock (UTC+1, `island.json5`).
*Revisit* in R1, where all of it is replaced.

### D147. Outcomes on replay, saves on change, and a rate limit
A replayed key answers its stored outcome with the base as it is now, flagged `replay`; a record
past its time runs again (a taps batch then credits only tokens left; from R2 a `nuke` refuses
`stale_run`). `GET /state` and the scheduler save a base only when settling moved something
beyond time (an event, a buff that ran out, a new or reset base): settle is path-independent, so
pure accrual needs no write and no push. `POST /api/commands` allows 10 a second per player,
burst 30, then `429 slow_down` with the wait (`09-architecture.md` 9.7), which the client retries
under the same key. The bot's command route answers `403 not_on_discord` until R2 lets it
Collect. *Revisit* the limit if an honest client ever meets it.

### D148. The effect vocabulary lives in content; buffs are content
`packages/content/src/effects.ts` registers every stat, op, `per` and `when` (`09` 5.1), because
the data's validation needs it; the domain only folds. Timed buffs carry a kind, and what a kind
does is `content.buffs` (filled from `flotsam.json5` in R1, empty in R0), so Rally's ×4 and
Adrenaline's ×100 stay in data. Buffs multiply with everything, each other included (two drones
on one line make it ×144), and tap buffs count in a tap's value. *Revisit* if a buff ever needs a
rule an effect cannot express.

### D149. `pacing.json5` v2 is a list of assertions, each switched on by a phase
The pacing file holds the archetypes and scenarios as data and a flat list of assertions, each
with its canon number (`n`), the phase that switches it on (`on`), the check's name and its
numbers. `shipped` names the last shipped phase: an assertion switched on by then must pass, and
one without an implementation fails the test (`missing`); later ones print `pending`, so the
whole plan of targets is visible in one place. Until R2's `nuke`, the simulator presses a stub
that folds the run into `meta` by the prestige formula, and it batches taps as the client does
(1 s, then 5 s, never more than 30 taps). *Revisit* when R2's real `nuke` replaces the stub.

### D150. Icons: a half tone of `currentColor`, and no `<title>`
Icons may draw a second tone as `currentColor` at `opacity=".5"` (a crate's top and side, a
woodpile's log bodies, a plank's end grain, the back figure in `nav/friends`), so depth survives
any tint without spending the one fixed accent; overlapping half-tone shapes sit in one
`<g opacity>` so they never double up. Files carry no `<title>`: they are inlined next to a label,
where a title would only add a tooltip that repeats it, so the R1 loader sets `aria-hidden` or a
label; `biome.json` turns `noSvgWithoutTitle` off for `packages/content/icons` only. `pnpm icons`
lints each file against D141 and renders the review sheet into `preview/icons/` with resvg (the
bot's renderer, so a file the sheet draws is one the bot can draw). The string rules and the list
of allowed accents live in `@wipe-day/content/icons` (`lintIcon`, `ICON_ACCENTS`): the content
test fails on a malformed file and lists every id the content names without an icon as a todo;
a web test keeps each accent in `palette.ts` or `tokens.css`. Extends D141.

### D151. R2's icons are drawn ahead, with R2's two colours
The 24 R2 icons (`07-what-changes.md` 8.5) are drawn on `icons-r1`, where nothing shows them
(D140). `palette.ts` gains `BIG_RED` (`0xd8262b`) and `GLASS` (`0x6fd0a0`) now, the values
`03-the-big-red.md` 3.3 and 3.4 name, because an icon's accent must come from the palette or the
tokens (D141). There are six node-type frames, not five: `04-blast-map.md` 2.1 lists `stat`,
`notable`, `keystone`, `unlock`, `automation` and `completion`, and the frame file is named by the
type's data id. `sector/works` is a factory roof, so a works node in the automation frame is not
a cog inside a cog. *Revisit* if R2's Kettle art changes a stage's look.

### D152. R1's data: one next step per shelf ladder, and 09's names
R1's data files follow `02-the-run.md` 13 in content and `09-architecture.md` in names: effects
use the one vocabulary (`output`, `tap_share`, `tap`, not 02's drafts `line_output`,
`tap_rate_share`, `tap_value`), and a target fells after `fellTaps`. The shelf shows one next
step per ladder: a Grip rung needs the rung before, an island upgrade the one before, and Mk III
needs Mk II (02 only says "50 owned"; Mk II costs a ten-thousandth of Mk III, so nothing real is
lost and each line shows one Mk row). Out of order, the server refuses with a `previous` gate.
`content.upgrades` is the derived shelf (Grip after Rock, then the 28 generated Mk rows, then
the island upgrades); era names keep their `base_tier.*` keys. *Revisit* if Pockets (R5) want a
Mk III without its Mk II.

### D153. Eras, roster and the tap's global fold in the domain
`activeEffects` now gathers the run's sources: the eras reached, each line's milestones (one
payout and one speed effect per line, from its owned count; the every-100 tail in closed form),
the roster tiers in `run.roster`, and the shelf rows in `run.upgrades`. The flat part of a tap is
multiplied only by eras, island upgrades and roster tiers (× Glow × Morale, errata E23), cached as
`rates().tapGlobal`, so a Rally or a Line Mk never inflates it; R0 folded every `output` effect
there. A roster tier is checked after each `buy_line` and kept for the run, so buying an era (three
lines at 0) never lowers income. Buying an era resets the fell count to 0 for the new target; the
old target's last fall is the scene's animation and pays nothing (02 6.2 leaves it open).
`era_reached {era, at}` is logged, `at` in seconds after the run's first tap or purchase.
`commandSchema.ts` now fails the typecheck when a domain command has no wire shape (`satisfies`
alone accepted a shorter list).

### D154. Flotsam starts at the first tap, and its schedule is a cursor
The flotsam schedule starts with the run's clock (`startedAt`, the first taps or purchase), not at
`createdAt` as `09-architecture.md` 6.4 says: run 1's guaranteed crate is timed "3:00" from the
first tap (errata E1, `10-balance.md` 4.2), and time on the title or rebuild screen costs
nothing. Rain shortens the gap drawn at the arrival before it (`weatherAt` of that arrival's
second), so the schedule is a pure function of the state and settle stays path independent; settle
moves the cursor past arrivals whose window closed, and a claim moves it to the next arrival after
the caught one's own time, whenever it was caught. The cursor keeps `last` (the latest caught
index), so a double claim reads "already caught", not "drifted off". A crate's "output" is every
owned line as if manned, with every multiplier but buffs (02 8.1): 06's idle-rate reading would pay
almost nothing in run 1, where most lines are unmanned. `flotsam_claimed` is logged. Weather
(`weather.ts`) only times flotsam in R1; settle cuts at weather blocks once an effect with `when:
rain` exists. A fell pays `fellBonusTaps` taps at the felling tap's Hustle, without a crit.

### D155. Welcome back, Collect and quiet hours on the server
`GET /api/state` answers `welcomeBack` once the last command is at least `welcomeAfterMinutes`
(60) back: the seconds away, the gain since that command (`made − madeAtActive`), the Night Shift
worked against its window and whether it ran out, the hands manned (none: nobody was on shift),
and the events settle found. `collect` is a standard command that does nothing else, so it
restarts the window like any command and the card goes away; the welcome-back screen and its
copy are R1's S4. The "away" line stays at 330 s (the 5-minute ping plus 30 s grace, R0's code
and `09-architecture.md` 4.2), not 02's rounded "6 minutes". Quiet hours (errata E19): a
notification due between 22:00 and 08:00 the player's time is held, one per kind, on the player
row and sent by the scheduler at 08:00, Discord DMs included (a DM buzzes the same phone). The
player's offset comes from the browser with the push subscription (`tzOffsetMinutes`, migration
0006); until one arrives the island's clock (UTC+1) stands in. `quiet` is a notify preference,
on by default; its Settings row comes with R1's UI.

### D156. The R1 buyer, the simulator's R1 checks and their cost
The advisor (`advisor.ts`, the simulator's buyer and R1's crown) offers the shelf and the next era
alongside lines and hands, each scored in closed form by what it adds: a Line Mk ×3 twice its
line's income, an island upgrade every line and the flat tap once more, a Grip rung the flat tap
again plus its share of the full rate, and an era its doubling and as much again for the three
lines it opens (02 6.2 crowns the era before the hand). Rows shut by a gate other than the price
are not offered. Archetypes catch a share of the flotsam floating while they are online
(`catches` in `pacing.json5`: active, optimal and the scenarios all, casual and late joiner half,
idler none). The R1 checks are implemented (N4-N9, N23, and `firstHourBeats` for `10-balance.md`
4.2's E1 column); N9's rain hour is its own warn-only row (errata E13). `pnpm sim check --phase
R1` judges them before R1 ships; `shipped` stays R0 until S5 tunes them. To keep the simulator
inside `pnpm test`'s 10 s (errata E4) the domain memoises per state what does not change between
commands (each line's buff-free unit rate and cycle, the full and manned rates, price folds, a
tap's folds), and the buyer scores again only when prices or buffs change or the supplies reach
the next price (among purchases not yet affordable the ranking does not depend on the supplies).

### D157. Names pass 1, the first two: Go Bag and Tinned Fish
The owner approved two names on 2026-10-10. Works 1.1 (`packed_crate`) is the **Go Bag**, not
"Starter Kit", a Cookie Clicker upgrade name (errata E27); it ships with R2's Blast Map, so the
rename lives in the docs until then. The Dock's product (`food`) is **Tinned Fish**, not "Fish
Crates", so the two fish products read apart (Smoked Fish on the skewer, tins on the jetty); its
placeholder tile letters are `TF`. Ids and icons stay. The rest of names pass 1 is still open.

### D158. The target is tapped through a button over it, sized on screen
The era's target stands on a rise at world x 870 (`scene/target.ts`, replacing `nodes.ts`). Its
tap area is a transparent DOM button the scene keeps over it each frame: the drawn bounds on
screen padded by 12 px, never under 140 × 160 CSS px (D48, N27). Measured: 140-180 × 160-174 on a
390 px phone (the pine's box centred at 41% of the height), 209-421 × 235-405 on a 1600 × 900
desktop. Being a button, it carries the label ("Tap the Lone Pine"), takes Space and Enter
(holding Space is hold to work, `08-screens.md` 6.5) and is what the 44 px audit sees. A press
held still for 0.35 s counts 4 taps a second with a ring round the finger (02 7.5); moving more
than 12 px ends the hold. The tap hint sits under the box (`--target-bottom`). The scene no
longer takes taps on the bare land.

### D159. The island's layout: one table, three rows
Phones keep 880 world units across centred on x 870 with the ground line at 52% of the height
(`08-screens.md` 1.1's proposal). The waterline sits at about x 600, so a phone shows a sea strip
of about 75 px. The 14 lines stand in `LAYOUT` (`scene/lines.ts`): the dock, the beached Ship
Breaker and the Beachcomber on the shore; the Campfire, the Kiln and the Furnace left of the
rise; the Tannery, the Garden, the Workbench and the Loom round the house; the Press, the Radio
Mast, the Generator and the Reactor up the hill, each row smaller (0.75 to 0.42). The house is
drawn at 0.4 of the W-phase size. Count badges in screen space step up when they would cover one
already placed. Layout is presentation, so the table lives in the scene, not in `data/`.

### D160. Plots, products and line floaters
- A line not yet owned shows a staked plot with a price sign once its era is open. Twig's three
  appear one by one, as the run first makes each price, so run 1 opens on the beach and the pine
  alone (rule 6.3.6); a later era's three appear together when it is bought (02 6.2).
- Every completed cycle pops the line's product icon (`icons/product`, tinted its colour) onto a
  pile, at most twice a second; 3 to a stack, a second stack from 10 owned; a full pile is carted
  off in a puff of dust; 40 sprites at most across the island.
- Line floaters follow `08-screens.md` 4.2 rather than 02 1.2: the four lines with the biggest
  payout per cycle send one at most every 2 s, cycles merged, carrying the product icon on a dark
  badge, flying 700 ms into the counter, which bumps (at most four times a second). 02's "cycles
  of 2 s or more only" would leave the first minutes, where every line is fast, without any.
- The cycle bar under the badge: a manned line loops; a manned line under a second shows full
  and steady instead of flickering; an unmanned one fills only while a cycle is in flight.

### D161. Fells, milestones and other celebrations
The store predicts a taps batch's fells (the change in `target.felled`) and takes the fell's
bonus out of the tap's running number (estimated as fells × fellBonus × a tap at the batch's
Hustle), so "Timber! +17" and "+2" never count the same supplies twice. A milestone crossed by a
purchase floats "Beachcomber ×2" (or "×2 speed") over its line, at most two in one frame; the
roster floats "All lines ×2"; an era floats "Stone era · ×2" while the old target is felled one
last time and the new one pops up. A demo patch rewrites the run and is not celebrated (the
store counts patches), so shots and the demo drawer show no false milestones.

### D162. Sound and haptics until Settings exists
R1's procedural voices ship (`apps/web/src/sound`): tap (per target, rising with Hustle, at most
15 a second, louder rather than stacked), buy (a third note for bulk), milestone, fell (per
target), the UI ticks and refuse. One AudioContext from the first touch, a compressor, 8 voices
at most, suspended while hidden; `navigator.audioSession` set to ambient where it exists. An
owner file `public/sound/<cue>.ogg` replaces its cue once it decodes. Sound (on, 70%) and haptics
(on) are kept in localStorage (`wipeday.sound`, `wipeday.volume`, `wipeday.haptics`) until S3's
Settings shows them; reduced motion follows the device until then. Vibration: fell 20 ms,
milestone 15-40-15, era 30-50-30, never on taps.

### D163. Shots play time, audit, and the frame check runs on the GPU
- A demo patch now takes the backend's version (`LocalBackend.currentVersion`): before, an
  answer already in flight (a ping) carried the same version and overwrote the patch.
- `__wipeDay.fastForward(s)` plays the scene in 60 fps steps at once and moves the demo's game
  clock along, so a shot can show a hand mid-walk, a fell mid-fall or piles that have filled;
  shots pick their weather by moving whole days at the same hour (`weather: "rain"`).
- Each shot is audited: buttons and scene tap areas under 44 px on a phone, a target box under
  120 px (N27), more than one crowned element; any problem is listed on the contact sheet and
  fails the run.
- `pnpm web:perf` taps 15 a second for 30 s on a busy Stone run in Chromium on the machine's GPU
  and reads the frame counter: 60 fps (5th percentile 60) with 12 floaters and 126 particles at
  most on the dev PC, and 60 fps with the CPU slowed 4× (`--throttle 4`). The owner's phone stays
  the acceptance (`08-screens.md` 4.6).

### D164. Names pass 1 closes: the proposals stand
The owner kept every other pass-1 name as proposed (2026-10-10): Supplies; the Beachcomber, the
Ship Breaker and the Reactor; Gus and Vera; the five targets (Lone Pine, Outcrop, Ore Seam,
Sulfur Vent, the Wreck) and their fell cries; Hustle; Hold to work; the Night Shift; the Drift
Crate, the Fuel Drum, Rally and the Adrenaline Kit; the hands; Grip; the products (with D157's
Tinned Fish). The eras keep the five Rust grades: Twig, Timber, Stone, Sheet Metal, Armored. The
locale already holds these strings, so nothing in the game changes; their *(proposal)* marks go.
Passes 2 (R2) and 3 (R4) remain.

### D165. The crown on screen: the advisor's rules and the player's own pace
`crown()` (`packages/domain/src/advisor.ts`) is 02-the-run.md 11.1 in R1: the next era when it is
affordable within `advisor.saveSeconds` (30, `lines.json5`) at the current income, then the hand
of the top-earning unmanned line on the same terms, then the best payback affordable now (price ÷
added income; ties to the cheaper), otherwise the tap hint. The Big Red, Blowback crates and the
Toolbelt join with their phases. The client weighs taps by the player's own pace over the last
minute on the wall clock (`state/pace.ts`): taps a second, and the share of seconds with a tap
in them, so an idle player is never crowned an unmanned line or a Grip rung; its income for "in
42s" is the top bar's `/s` plus that pace times a tap's value. One store (`state/advisor.ts`)
recomputes the pick on every change of the base and once a second, and the drawer, the hint pill,
the target's glow and the keyboard's B all read it. The simulator keeps its own buyer (best score
with waiting) over the same `choices()`; whether it should follow the crown's rules is S5's
balance question.

### D166. The shop: three rows, two tabs, one crown per view
- The drawer appears when the run first holds the price of its first line; the collapsed drawer
  shows the crowned row and the next two by score (two under 740 px tall), reordered at most
  every 2 s and never within 600 ms of a touch.
- The expanded drawer is a view of its own (resolution 3.25): each tab crowns exactly one row,
  the island's pick when it is on that tab, otherwise the tab's best score. The desktop column
  has no collapsed mode but shares the island's view: it pins the island's crowned purchase
  over its tabs (and leaves it out of the list below), so the one crown is in sight whichever
  tab is open; while the crown is on the tap hint, nothing is pinned.
- Lines lists the era row first, then the open lines in order, each followed by its hand row
  until the hand is hired, then the next era's three lines locked with their real price and
  "Opens in the Stone era". The Armored era, gated by Wipe Day #2, is not listed in R1 (D140).
- Upgrades lists the next step of each ladder by price; a Line Mk shows once its line is owned
  (locked with "Needs 25 Furnaces (12 now)" until then), so a fresh era does not fill the tab
  with rows nobody can act on. "Bought this run" folds what was bought.
- The bulk toggle (×1, ×10, ×100, Max; kept per device) exists from the run's second hand and
  applies to line rows; the crown is scored per unit, and Max buys as many as the supplies
  allow (the button reads "Buy 37").
- A buy button is 104 × 56: its action over the price; short of it, the time to afford ("in
  42s", "in 3h 10m", "tap to earn" at zero income), disabled. A crowned purchase still saving
  up (the era within 30 s) keeps its orange.

### D167. Signal orange, the contrast fixes and the 44 px rule ship together
`--primary` (`#f27a1a`, a gradient from `#ff9a3c` to `#e46c12`, ink text) replaces the red
`--accent`; `--muted` is `#b5afa4` and the glass panel 0.86, so muted text stays above 4.5:1 over
the brightest sky (08-screens.md 6.3). Selected tabs and segments are neutral, so orange means
only the crown. `#cd412b` stays as `--red-band`, an icon accent (D141). Every HUD button is at
least 44 × 44 (toggles 76 × 44, the toast's button 44 tall, the panel close 44 × 44).

### D168. The layout: the drawer, the column, the nav row, the hint pill
- Phones: the top bar (the counter block, which opens the Multipliers sheet, and the menu,
  which opens Settings), buff pills under it, the drawer over the lower part of the island and
  the nav row at the foot. The camera is unchanged: the target already stands at about 40%.
- The column layout (`COLUMN_QUERY`, `state/layout.ts`; the same media query sets
  `--column-w` in `tokens.css`): 1024 px and wider at 6:5 or wider gets a 420 px right column;
  landscape phones 520 px tall or less get a 320 px one. The column measures itself into
  `insets.right` and the scene recentres the island in what is left.
- The nav row of an R1 build is Island and Crew; it appears with the first hand ever hired.
  Crew lists the hands of the eras reached and of the next one, with who is on shift.
- The hint pill sits under the target's tap box, never lower than 52 px above the drawer.
- Layers and back: the expanded drawer, a panel and a sheet each push a history entry, so
  Android's back closes the top one; Escape does too. Under a sheet the rest of the HUD is
  `inert`, and the shots' crown audit counts only what is not inert.

### D169. Settings, kept per device, and notifications back on the web
Sound, volume, vibration (Android), Numbers (`1.23Qa` or `1.23e15`) and Motion (Match device,
Reduced, Full) live in localStorage (D162's keys plus `wipeday.scientific`, `wipeday.motion`,
`wipeday.bulk`). The Numbers setting switches the one formatter everywhere at once
(`state/world.ts`). R0 cut the web's push code with the old systems; R1 restores it
(`net/push.ts`): the device switch, "Night Shift over" and quiet hours, each a real server
preference (`/api/notify`), the subscription carrying the browser's time-zone offset. Where push
cannot work the switch stays visible, disabled, with the reason (iPhone without the Home Screen
install, blocked, unsupported, demo mode). How it works shows lines 1-4 and 6; line 5 waits for
the Big Red (R2).

### D170. The Multipliers sheet and the top bar's rate
`glance.ts` (domain, read-only) takes the full rate apart in the evaluator's order: the lines'
base output, then milestones, the shelf (Line Mks and island upgrades), eras, roster tiers,
Glow and buffs. Each step's factor is the ratio of the total with and without it, so the steps
multiply out to `fullRate` exactly (a test over 1,000 seeded states, 1e-9), and a later phase's
source no step names lands in "Other" rather than vanishing. The sheet's header is the top bar's
`/s`, which now counts unmanned lines while a cycle runs (02-the-run.md 3.2), and the table ends
with "Every line running". Durations show seconds under 10 minutes (`2m 10s`), as 08-screens.md
3.5 asked of R0. A refusal's toast carries one button to the target ("Tap the ore seam"), which
closes every layer and makes the target blink (rule 6.3.5); toasts are two at most.

### D171. Flotsam on screen: the state's schedule, a button over it, quiet when missed
The scene draws the domain's `afloat()` of the base (`packages/domain/src/flotsam.ts`), so a
reload or a second tab shows the same arrival at the same age. It drifts in from the screen's
left edge over 2.5 s and rests at world (540, 576), just off the beach, bobbing; it is drawn in
screen space at a fixed 50 px with a glow above the night tint (D47), so it reads at night and in
fog, and caught through a 64 px round button kept over it (D48, 08-screens.md 1.3). A pie ring
drains its float, warm in the last 4 s. It sinks over 1.2 s after its float and can still be
caught meanwhile, inside the server's 3 s grace. The hint "Something's drifting in. Tap it before
it floats off." sits above it, over the sea and the sky where it hides no line, until two catches
(`meta.stats.flotsam`, 02-the-run.md 11.2). A catch is predicted: the icon pops with 16 coins and
a splash; a crate floats "+2 min of supplies" (the minutes are the domain's `crateMinutes`) and
its amount flies into the counter; a buff floats "Rally! All lines ×4 · 1m" (the pill's format).
A late claim is quiet, as 02 8.4 asks: no toast, "It drifted off." where it was, and it never
shows again. One that sinks while the page is visible says "It sank. More drifts in every few
minutes." (run 1: "...within 3 minutes."); one missed while hidden, or across a jump of the clock,
says nothing.

### D172. Flotsam's sounds ship with flotsam
`flotsam_in` (a bell panned toward the sea), `flotsam_claim` (a splash and the buy chime) and
`rally` (a saw revving 80 to 160 Hz with a tremolo) ship in R1, not R2 as 08-screens.md 5.2's
table has them: flotsam itself ships in R1, and every catch must answer (rule 6.3.7). The catch
vibrates 15 ms on Android (08 5.4). Owner files may replace all three, like R1's other cues.

### D173. The welcome-back card
- **What it says.** The gain is the card's big figure (the supplies icon and "+26.8B"), where the
  eye lands first; the Night Shift line under it no longer repeats the number ("Your hands
  worked the whole time." / "...the Night Shift (12 h of it)." with "They stopped yesterday at
  08:30." on this browser's clock). With nobody on shift the card still shows, with "Back to
  work" (08-screens.md 2.14's third case and its `phone_welcome_nohands` shot), not 02-the-run.md
  10.2's "no card": a player back after hours deserves to hear why nothing happened.
- **Where it comes from.** On load, from `GET /api/state` (D155); when a tab hidden for an hour
  shows again, from the client's own `welcomeBack()` over the settled base, before its next
  ping. While the card is up no ping is sent and the load's ping waits, so a ping never eats the
  card; Collect is the command that restarts the window. A push whose state has another
  `activeAt` (another tab acted) ends the card.
- **How it behaves.** One button; the backdrop and Escape collect too; the nav is hidden and the
  HUD behind is inert. The counter keeps its old value until Collect, then releases the gain
  over 0.9 s while it flies from the house into the counter.

### D174. The Odds sheet
`odds()` gives each shipped kind's share of the weights; the sheet prints it to one decimal
(49.5%, 44.0%, 6.6%) with what the kind gives, written from its data ("Rally: all lines ×4 for
1m"), then the schedule (every 4-10 minutes while the page is open, 1.5× as often in rain, 13 s
to catch, after `flotsam_float`), run 1's guaranteed crates while they last (guardrail 9: no
hidden catch-up), and that a missed one costs nothing. It opens from Settings ("Odds", under How
it works) and from the Multipliers sheet. One sheet at a time: a sheet opened from another
replaces it under the same history entry.

### D175. One crown per view, to the eye as well
Under a sheet or the welcome card the HUD is inert (D168) and now also loses its orange: the
drawer's crowned button turns secondary and the tap hint stops pulsing, so the dimmed view never
shows a second orange button beside the sheet's primary. Floaters keep 8 px inside the screen's
edges, so a sentence floated at the shore ("It sank...") is never cut off.

### D176. A taps batch covers its last second: unmanned lines run as if manned while tapped
Times are whole seconds, so a 1 s batch arrives with `from == to` and R1 S1's
`k = floor((to − start) / t) + 1` started one cycle a batch: a 0.6 s Beachcomber ran 60% of the
time at 6 taps a second, not "exactly as if manned" (02-the-run.md 3.1). The batch now covers
`[from, to + 1)`: `k = min(credited, ceil((to + 1 − start) / t))`, a line busy past `to + 1` takes
none. The state keeps one `readyAt` a line, so when new cycles follow one still in flight, every
cycle but the last is paid at once (at most a second early, valued at its own end, as a hire
finishes the cycle in flight) and only the last waits for settle. Tests: 60 s of 6 taps a second
runs and pays 100 Beachcomber cycles; a tap a second still runs the 19 s Kiln once per 19 s; over
500 seeded sequences a line takes cycles only if it was free before the batch's last second. The
client predicts with the same function, so the top bar's `/s` no longer flickers for unmanned
lines while tapping. Run 1: Timber 1:02 → 0:46 and Stone 7:07 → 6:21 with nothing else changed.

### D177. The crown saves, scores over the player's day, and leads to hands
Emulated, a player who follows R1 S3's crown never reached Sheet Metal in run 1: rule 4 crowned
the best payback *affordable now*, so every supply went on small rows and the era rule's "within
30 s" never fired for 2e10 (a longer `saveSeconds` only made it worse). Three changes in
`advisor.ts`, with 02-the-run.md 11.1 read as the intent:
- **Rule 4 is the best score** (the wait to afford it plus price ÷ added income, ties to the
  cheaper): crowned when affordable; while it is out of reach the crown goes to the tap hint and
  nothing cheaper is crowned, so the player saves. The collapsed drawer leads with that row
  unpainted ("in 2s"); the expanded drawer crowns it as before (S3's `sheetPick`). A fresh island
  still opens on "Tap the tree.", and Timber still comes before Mara.
- **Purchases are scored over the player's day** (`advisor.away`, 0.5 in `lines.json5`): the
  pace weighs what taps drive, times the half of the day the player is present, so unmanned lines
  and Grip count half and a hand counts the rest even while the player taps. With pace alone a
  tapping player scored every hand at zero; the active archetype left its Reactors unmanned and
  its active hour ran 3.92× an idle one at day 14 (N9's ceiling is 3). Swept: 0.25 still fails
  N9; 0.5 passes everything; 0.75 puts Sheet Metal at the band's edge; 0.9 fails the beats.
- **A line nobody owns or mans also counts as the way to its hand**: its first unit is scored at
  a unit's income for the unit's price plus the hand's (the better of that and the tapping
  value). Without it, a player who does not tap was never crowned a second line and could never
  hire a second hand; the idler made 22 glass by day 30 instead of 818.
Tests: a saving state crowns the hint with a cheaper row affordable; over 2,000 seeded states the
hint means the best score is out of reach, and rule 4 crowns exactly the best score; an idle
player is crowned a first Campfire (at unit plus hand) but never a fourth unmanned Beachcomber.
Playtest 1 asks whether saving feels dead (the longest gap between purchases in run 1 is about
10 minutes, information only in 10-balance.md 4.3).

### D178. The simulator plays what the crown says
The simulator's buyer is now `crown()` itself (D165 left this to S5), weighed by the archetype's
pace as the client weighs the player's (tapping now: pace 1 at its taps a second; not tapping:
0), so the simulator and the game cannot disagree about what a player is told to buy. Before, it
scored taps by the archetype's share of the whole day, 0.125 for the first-hour scenario's 3 h
session, so it never bought a Furnace in run 1 and bought Sheet Metal at 39B made. A batch with
no taps now settles the state: the idler, not tapping once Mara was hired, saw its supplies frozen
for the rest of the session, which was N5 and N6's 152 s (now 20 s). The scenarios play their own
seeds (`scenarioSeeds` per profile): 12 in `--full` (R1's "Done when"), 4 in the test profile,
which must stay inside `pnpm test`'s 10 s; checks print one range per archetype instead of a
value per seed.

### D179. Run 1's economy: Handcarts at 5e9; taps and flotsam unchanged
10-balance.md 8.1 in order, each from `pnpm sim check --full` over 12 scenario seeds after
D176-D178. **Run economy:** with 02's prices, Sheet Metal fell at 45:39-51:24 (3 of 12 seeds past
the band's 50:00) and the first nuke at 47:09-52:59. Single levers swept:

| Lever | Sheet Metal | First nuke | N9 weighted (days 14/30/60) |
| --- | --- | --- | --- |
| none | 45:39-51:24 | 47:09-52:59 | 2.62 / 2.70 / 2.56 |
| Sheet Metal 1.5e10 | 43:14-48:59 | 45:49-51:39 | 2.55 / 2.21 / 2.07 |
| Sheet Metal 1.2e10 | 38:29-46:34 | 47:44-56:54 | 2.62 / 2.81 / 2.31 |
| output ×4.85 per rung | 44:14-50:04 | 45:44-51:34 | 2.25 / 2.33 / 2.29 |
| output ×5 per rung | 38:59-47:34 | 40:14-48:09 | 2.23 / 2.36 / 2.26 |
| **Handcarts 5e9** | **40:24-48:14** | **42:54-49:04** | 2.66 / 2.23 / 2.22 |

A cheaper Sheet Metal comes earlier but slows the nuke (its three new lines soak up the spend);
output per rung moves every later phase. Handcarts (the second island upgrade, 02 5.4) at 5e9
instead of 1e10 centres both bands with one price. **Taps and flotsam:** N8 70.6% in minute 0-1
(≥ 50%) and 13.9% direct from minute 10 (5-25%), N9 2.22-2.66 weighted and 2.39-2.81 in rain
(1.5-3): mid-band, so p, Hustle, Rally, Adrenaline, the crate cap and the weather stay as they
are.

### D180. R1 ships in the pacing file
`pacing.json5` says `shipped: "R1"`; every R1 assertion passes (`pnpm sim check --full`: N4
47-54 s, N5 and N6 20 s, N7 100% on day 1, N8, N9 and N23 above, run 1's beats on 12 seeds: Timber
0:33, Mara 0:47, the crate 3:00, Sorting Tables 3:59, Stone 5:44). N18 and N20 are asserted
outside the simulator, as 10-balance.md 7.4's table has them: N18 by the content check (the Night
Shift 12-48 h) and the API's welcome-back tests; N20 by `flotsam.test.ts` (gaps of 4-10 minutes,
13 s afloat) and a new `taps.test.ts` case (a tap ×1 on an empty Hustle meter, ×2 on a full one;
the ceiling is a content check). R2's N7 over 30 days already reads 99.6%; its other rows have no
checks until R2 builds them.

### D181. Cards, Supply Drops and the Album (owner, 2026-10-17)
Survivor and gear cards collected from Supply Drops (chests) earned in play and bought with
scrap; an Album with sets, odds and pity printed; no pull is blank (duplicates pay shards). Crew
ranks go; stars from shards take their job. The run is never gated by a card: hands hire with
Supplies as before. Guardrail 8's blanket "no casino" is reworded to "randomness is paid for in
play and always printed". Detail: `docs/redesign/12-feel.md` 7.

### D182. Scrap is the premium currency; the purchase switch is the last phase (owner, 2026-10-17)
Scrap is earned in play (4-6 a day for a casual) and spent on drops, boosts and Pockets. A store
that sells scrap for money ships only in the last phase, with a payment provider and a legal
check on loot boxes first; nothing else changes when it flips. CLAUDE.md 1's "no real-money
anything" is deferred to that phase, not deleted now. `12-feel.md` 8.

### D183. The Night Shift starts at 2 h and grows to 24 h (owner, 2026-10-17)
2 h from the last command; Lamp Oil research +20 min × 6 per run; Bunker nodes, Wipe Days #10,
#20, #40 and Long Night to a ceiling of 24 h. The 48 h ceiling goes. N18 is rewritten; guardrail 1
(first nuke on day 1) is retuned around it. `12-feel.md` 6.

### D184. Taps stay relevant: active 4-6× idle, physical taps, Frenzy (owner, 2026-10-17)
Every tap chips a thing onto a visible stockpile; Hustle's meter becomes Frenzy with a visible
tripped state (×3 taps for 15 s at 100). N9's band becomes 4-6×, N8's from-minute-10 band 10-30%;
the bucket does not move. `12-feel.md` 3.

### D185. Research (the Workshop) from minute two (owner, 2026-10-17)
A per-run tree of 40 items in 8 tiers, 5-25 levels each, priced in Supplies (`b_k × 1.35^n`,
`b_k = 40 × 20^(k−1)`), reset by the nuke. The shelf's Mk II/III rows move into it. Hosts the
offline research. `12-feel.md` 5.

### D186. The shop never reorders (owner, 2026-10-17)
The owner hates the crowned purchase jumping to the top. Fixed order by rung forever; the crown
highlights its card in place; a Best buy chip scrolls to it. The advisor's rules are unchanged;
D165-D170's "the row leads the drawer" is withdrawn. `12-feel.md` 4.

### D187. One bottom dock on every device; painted 2D; salvaged HUD (owner, 2026-10-17)
Island, Research, Crew, Album, Logbook as one dock component on phone, tablet and desktop
(centred on desktop); panels open as sheets over the scene; the shop stays a right column on
desktop. The scene becomes painted 2D layers with procedural life (not pixel art, not 3D); the HUD
uses the Feel Board's tokens (plywood and steel panels, Big Shoulders Display and Barlow, signal
orange primary). Desktop 1440 designed first, 390 px right after. Paid assets allowed up to 100
USD total. The phases are reordered: R2 Feel, R3 Cards, R4 The Big Red (`12-feel.md` 12).

### D188. Pixel art, the HUD approved, the names fixed, the image model behind an API key (owner, 2026-10-17)
The owner approved the Feel Board's HUD direction and chose pixel art over D187's painted 2D,
anchored on 0-mem0ry's *Post Apocalyptic Workshop Set* (free, commercial use allowed, no
redistribution, no AI use). Side view stays; one grid (1 art px = 5 stage units, integer zoom 2-5
in device pixels, nearest-neighbour); one palette of at most 48 colours in `scene/palette.ts`;
text and HUD stay crisp CSS. D141 amended: item icons are 16×16 pixel PNGs, UI glyphs stay
currentColor SVG, one format per kind. Licensed packs are committed under
`packages/content/art/<pack>/` with their licence; CLAUDE.md 2's "third-party game assets" means
ripped assets (D43). Names fixed as recommended: Workshop, Supply Drop, Album, Frenzy, Lamp Oil.
The scene art is generated through a pay-per-image API (Gemini first) whose key lives in `.env`
and which the agent runs from a repo script; the owner only supplies the key. Figma's Weave is
not the path (no AI flag on the org, no linked Weave account). `12-feel.md` 2.1, 2.2, 14.

### D189. Chunky pixel confirmed; Retro Diffusion first, OpenAI as backup, Gemini dropped (owner, 2026-10-17)
Shown three looks under one HUD (chunky pixel, dense pixel, painted; the Pixel or Painted page,
private), the owner chose chunky pixel: D188's grid stands (1 art px = 5 stage units, zoom 2-5).
The image tooling in D188 changes: Retro Diffusion (pixel-specific, true grid, alpha, palettes,
animations, pay per image, hosted MCP server) generates sprites, props, tiles, targets, hands and
busts; OpenAI gpt-image-2.5 with `background: "transparent"` covers the large parallax layers;
Gemini is dropped (no alpha channel, poor past results). The owner supplies two keys in `.env`;
the agent runs everything through `pnpm art`. `12-feel.md` 2.2.

### D190. The art pipeline's shape, after the scene mock (owner, 2026-10-18)
The owner loaded 10 USD on Retro Diffusion, the key went into `.env` and the MCP server into
Claude Code, and the agent generated fifteen assets (2.16 USD) into one island scene under the
approved HUD, day, night and phone (the Saltmarsh Scene Mock, private; everything in
`docs/redesign/art/`). The owner approved the look. Fixed by it: `rd_pro__platformer` for every
sprite (targets, props, hands, busts), `rd_plus__low_res` for props under 40 px; bands from the
palette gradient plus small pieces or tiles, never from landscape renders; the 48-colour palette
and one light direction in every real prompt; characters animated from their finished sprite
with the advanced-animation styles (0.14 USD a cycle), PixelLab only if those disappoint. The
scripts stay in `docs/redesign/art/` until R2 Feel folds them into `pnpm art`. `12-feel.md` 2.2.

### D191. R2 Feel's plan: seven sessions, the pixel scene in the middle, the palette from the mock (owner, 2026-10-18)
The owner approved R2 Feel's plan in plan mode. S1 groundwork (docs, the phases renumbered, the
simulator's time, the new state fields; no balance change), S2 the Workshop and the 2 h Night
Shift, S3 Frenzy, gulls and badges, S4 the HUD (tokens, the dock, the card shop in fixed order),
S5 and S6 the pixel scene and the hero tap, S7 sound, juice and the finish. Asked where the pixel
scene goes, the owner chose the middle of the phase: after the rules and the HUD, before the
tap's juice, so nothing in the scene is drawn twice. Asked where the 48 colours come from, the
owner chose the approved Saltmarsh Scene Mock plus the five era colours, not 0-mem0ry's pack:
nothing to download, and D188's pack stays the inspiration only (no file of it is used). The art
pass needs about 25 USD more credit before S5. `docs/roadmap.md` R2 Feel.

### D192. The phases renumbered R0-R9 (agent, 2026-10-18)
`12-feel.md` 12's order is now the code's: `PHASES` runs R0-R9 and `pacing.json5` moved every
later tag (old R2→R4, R3→R5, R4→R6, R5→R7, R6→R8, R7→R9), as did the comments that name a phase. N19
moves to R3 Cards, where scrap becomes the premium currency, in `12-feel.md` 11's band (a casual
4-6 a day, 100 by day 30, nobody above 8); N30 (a casual opens a drop a day, days 1-30) joins it.
N16's friends' gaps keep their mechanical R5 tag until R8 Friends' plan revisits them. The plan
files `01`-`11` keep the numbers they were approved with, under a note at the top of
`11-roadmap.md` and the redesign README; `docs/roadmap.md` is the live copy. `12-feel.md` 12.

### D193. The simulator buys back time with two cache layers (agent, 2026-10-18)
`pnpm test`'s pacing check took 9.4-9.6 s of its 10 s. A profile showed every unit bought threw
away the whole effects cache, and the memo keys were built as strings on every hit. `rates()`
now has two layers: the effects in force (keyed per run on `run.upgrades`, checked against the
milestone factors, glass, nodes, era, roster, Workshop levels and badges), shared by every state
with the same effects, and the totals over units and hands (`totals`), one per `run.lines`.
Line-scoped folds have their own small memo per line; `eraOpen` reads a table; the simulator
checks finiteness once a session instead of after every command. Every verdict of
`pnpm sim check --phase R7` is identical before and after; the check takes 5.4-5.9 s.
`09-architecture.md` 5.

### D194. The Line Mks move into the Workshop, one item per line; Quick Count is dropped (agent, 2026-10-18)
`12-feel.md` 5 moves the shelf's Mk rows into research tier items, but tiers 1-4 open with Twig
and Timber only, so Stone, Sheet Metal and Armored lines would lose their ×9 until R3. Instead
each line gets one Workshop item `{line}_mk` of two levels (each `output more 3`, priced ×1e4 and
×1e8 of the line's cost, opened at 25 and 50 owned), listed under the line's era: real and
reachable, so nothing teases (D140). The shelf keeps Grip, the eras and the island upgrades.
Quick Count (buy ×10 unlocked) is dropped: it duplicates `bulkAfterHands`, and an unlock adds no
income the advisor could score, so it would never be crowned. `12-feel.md` 5.

### D195. The Workshop's offline item adds hours (agent, 2026-10-18)
`12-feel.md` 5 lists "`set` on offline hours" among research effects. A `set` would not stack with
the Bunker nodes (R4) and the Wipe Day steps that also lengthen the window, so the item (Spare
Wicks, D201) is `night_shift add 1/3` a level (six levels, +2 h, the window 2 h → 4 h per run).
`rates()` already caps the sum at the 24 h ceiling. `12-feel.md` 6.

### D196. Frenzy has its own meter; a trip is taps ×3 and lines ×1.5 for 15 real seconds (agent, 2026-10-18)
Hustle (×1 to ×2, capped at 2.25 by N9's guard) stays the tap's base. Frenzy is a second meter,
`run.frenzy`, filled by credited taps and draining while idle (it would trip in 17 s on Hustle's
gain; the first trip belongs near 12:00). At its cap it trips a `frenzy` buff for 15 real
seconds: taps `more 3` and lines `speed more 1.5`, so "the lines spin faster" on screen is true.
The trip is resolved in closed form inside its taps batch (the taps after the trip take the
buff); a content check `multCeiling` bounds the folded tap multiplier as `peakCeiling` bounds
Hustle. The simulator may drop the speed part or retune both in S3 (D144). `12-feel.md` 3.1.

### D197. Gulls fly on a seeded grid; an elite pays minutes of output until scrap has a use (agent, 2026-10-18)
A gull's slot `j` starts every 180 s from the run's first line, at a seeded offset in [0, 60 s],
so gaps fall in 2-4 minutes and none is under 120 s; whether it is elite (1 in 20) is seeded too.
No cursor, nothing in settle (N24 untouched): `claim_gull {run, k}` checks the slot and its
crossing window, and pays 30 s of output, 180 s for an elite. `12-feel.md` 9.3 pays an elite 1
scrap; scrap has no use until R3 Cards, and a currency that buys nothing would tease (D140), so
the elite pays output in R2 and gains its scrap in R3. The odds are printed with the flotsam's.
`12-feel.md` 9.3.

### D198. Badges are earned by commands, count only shipped things, and each is Morale +1% (agent, 2026-10-18)
The achievements wall's badges (`12-feel.md` 9.1) are checked after every successful command and
never inside settle: a badge raises Morale, and a rate that changed mid-interval would break
settle's path independence (N24). Their counters are the lifetime stats (taps, fells, crits,
flotsam, gulls, Frenzies, hands, units, Workshop levels, eras, supplies made); nothing counts
nukes or drops until those ship (D140). Each badge is Morale +1% (`05` 1's formula at 0.01 until
the Logbook phase raises it); `badge_unlocked` is logged. `12-feel.md` 9.1.

### D199. The dock in R2 Feel: Island, Workshop, Crew, Logbook (agent, 2026-10-18)
The dock (D187) shows what is shipped: Island from 0:00, Workshop when research opens (2:00),
Crew at the first hand, Logbook at the first badge. Album waits for R3 Cards, hidden, not
locked (D140). Workshop is one surface with two doors: the dock tab opens the shop on its
Research tab (the drawer expanded on a phone, the column's tab on desktop), so research is never
in two places. `12-feel.md` 4.

### D200. The crown ignores timed buffs (agent, 2026-10-18)
With Frenzy, Rally and the drone running much of an active player's time, a crown that weighed
the buffs would jump to another card every 15 s, which is D186's complaint in another form. The
advisor scores purchases on the state's lasting rates (from S3, with Frenzy); buffs still show in every number on
screen. `02` 11; D186.

### D201. The Workshop's offline item is Spare Wicks, not Lamp Oil (agent, 2026-10-18)
D188 named the Night Shift's research "Lamp Oil", but Lamp Oil is already the Oil Press's
product (`resource.fuel`), and one name for two things breaks the one-icon, one-name rule
(CLAUDE.md 6.2). Recommended: **Spare Wicks** (a spare wick keeps the lamp burning longer, the
Night Shift's lamp bar; no clash in the locale). The owner may veto it in the next report; a
rename is a locale edit. `12-feel.md` 5, 6.

### D202. The look first: R2 Feel's sessions reordered (owner, 2026-10-18)
After S1 the owner asked to see the game look like a real game first, to start showing it
around. The pixel scene (old S5-S6) becomes S2-S3, the HUD stays S4, sound and juice become S5,
then the Workshop and the 2 h window (S6), the active layer with Frenzy, gulls and badges (S7) and
the finish (S8). Nothing is drawn twice: the scene's grid, palette, targets, lines, house and
hands depend on no new rule, and the Frenzy meter, gulls, the Workshop tab and the badge wall are
drawn in the sessions that ship their rules. Advertising implies a public launch, which CLAUDE.md
1 lists as a non-goal; that change waits for the owner's explicit decision and its own plan.
`docs/roadmap.md` R2 Feel.

### D203. The terraced island (owner, 2026-10-18)
The pixel scene cannot keep the R1 island's wide strip: on a phone fourteen lines, the target
and the house on one ground line come out about 20 px tall, and the approved mock's props need
a row each. Asked, the owner chose a terraced island over a wide strip to swipe: a side view of
Saltmarsh rising from the beach in terraces, one per era. The Twig lines (beachcomber, campfire,
garden) stand on the beach either side of the target, with the sea lines (dock, shipbreaker) in
the shallows; Timber, Stone and Sheet Metal/Armored each build on the terrace above, and the
house stands at the right end of the first terrace. Everything owned is on screen at once (rule
6.2), and the island visibly grows up the hill as the run climbs. The layout is one table in
`apps/web/src/scene/island.ts` (art pixels, rows at 112, 94, 76 and 58). `docs/roadmap.md` R2
Feel S2.

### D204. The pixel camera: whole device pixels per art pixel, the island always in view (agent, 2026-10-18)
The camera picks the largest whole number of device pixels per art pixel that still shows the
island's 156 × 126 art px (`VIEW`), at most 5 CSS px (a 1440 desktop shows sky and sea around the
island, not bigger pixels); the world's position is rounded to whole device pixels, sprites stand
on whole art pixels (an odd width's anchor leans left), nearest-neighbour throughout. A 390 px
phone at DPR 2 gets exactly 5 device px (2.5 CSS px) per art pixel; the ground line sits at 53% of
a phone's height so the collapsed drawer never covers the beach row. The procedural stand-ins
stay as fallbacks for whatever has no art yet (the Stone and later eras until S3), so the island
never breaks while the art arrives. D188's "zoom 2 on a phone, 4 on a desktop" becomes this rule.
`apps/web/src/scene/Scene.ts`.

### D205. The art pipeline in the game: `pnpm art`, low-res lines, outlines, the picks on record (agent, 2026-10-18)
The scripts moved to `scripts/art/` behind `pnpm art` (palette, seed, plain, gen, sheet, clean,
install); the game's art is `packages/content/art/` (the 48-colour palette, extracted from the
Scene Mock with the era, fire, red, sea and ridge colours pinned, D191; and
`scene/<kind>/<id>.png`, loaded by `scene/pixel.ts`). Measured in S2: at 16-24 px the cheap
`rd_plus__low_res` draws clearer lines than the pro style, so the lines use it (0.06 a take)
with a 1-px dark outline added at install; heroes, houses and hands use `rd_pro__platformer`
with the mock's sprites as references. The hands are a 12×18 survivor (the mock's 23×40 one
dwarfed the 20-px lines) with 8-frame idle and walk cycles. Each session's choices live in
`scripts/art/picks/*.json`; the agent makes a first pass so the work never waits, and the owner
may swap any take by number from the contact sheet. S2 spent 4.52 USD; 3.45 is left.
`docs/redesign/art/README.md` 4.

### D206. The crafting lines work inside the house, which opens as a room (owner, 2026-10-18)
After the first pixel island the owner asked for less outside and the furnace and the workbench
inside the house, opened by tapping it. Asked, the owner chose all five crafting lines inside
(loom, workbench, furnace, tannery, press; outside stay the beachcomber, campfire, garden, kiln,
dock, generator, radio mast, ship breaker and reactor) and a pixel room cut-away over a panel.
The island loses a terrace (the beach, the yard with the kiln and the house, the hill). Tapping
the house opens its room (`scene/room.ts`) at the island's zoom over the dimmed island, its floor
on the island's ground line: the crafting lines on five floor slots in era order, their hands
working there (a second `Lines` and `Hands` inside the room). Back, Escape and a tap on the
dimmed island close it; it is a history layer like a panel (`useUi.house`). Closed, the room's
lines float their gains from the house and their milestones rise from it. The house is a door
from Timber on (the Twig tent has no crafting line) with the one-line hint "Tap the cabin to go
inside" until it has been opened twice (6.3 rule 6). The room's art per house tier is
`room/<tier>` (the cabin's generated in S2; a plank stand-in otherwise). A "smelt" action, if the
game gets one, opens the same room. `docs/game-design.md` 4.

### D207. A wide screen keeps a strip of sea and plain dirt below the beach (owner, 2026-10-18)
The owner's desktop screenshot showed the sea taking 40% of the width and the earth repeating the
tile's sand and grass in bands. The camera now centres the island but never shows more than 30
art px of sea left of it; the rest of a wide screen goes to the hill on the right. Below the beach
tile the earth is a seeded dirt texture in the tile's own colours, darkening in bands; the plain
tile's dirt rows lose the grass blades. The tap hint follows the target's x, since the island is
no longer centred on wide screens. `apps/web/src/scene/Scene.ts`, `landscape.ts`.

### D208. The ground is painted whole, never tiled; big screens zoom in (owner, 2026-10-18)
On the owner's 2k monitor the island's ground showed its repeat: one 176-px tile of sand and dirt
on every terrace (three identical waves stacked) and a 48-px dirt square whose five pebbles formed
a grid, under a screen that was half dirt. The ground is now painted once per piece
(`apps/web/src/scene/ground.ts`): each terrace, and the beach with the earth below it, from seeded
noise in the mock tile's own colours and layers (a sand edge, pale specked sand that thickens and
thins, its shadow, a reddish wet edge, a near-black lip, dirt darkening to bedrock by dithering,
scattered pebbles and a few embedded stones), so nothing has a period at any width. The ground
tiles are gone from the art folder. The zoom cap rises from 5 to 7 CSS px per art pixel, so a
large screen shows the island larger instead of more dirt and sky. New shots
`desktop_tall_rain` (1700×1340) and `desktop_2k` (2560×1440). `docs/ui-review.md`.

