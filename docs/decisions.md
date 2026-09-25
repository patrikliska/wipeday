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
