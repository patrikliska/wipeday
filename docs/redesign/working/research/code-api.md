# Wipe Day API: what the incremental-game redesign has to know (code-api reader)

Read-only survey of `apps/api/src` (4,737 lines of TypeScript, about half of them tests), the
domain functions it calls, the web client's command path, and `docs/deploy.md`. Line numbers are
from `main` at 58533e4. Timings come from a throwaway script in the scratchpad that imported the
repo's sources and ran them unchanged (in-memory and on-disk SQLite, on the owner's dev PC). The
repo was not modified (`git status` clean afterwards).

---

## 0. The short version

1. **State is one JSON document per player per season** (`bases.state_json`, D61). A command
   reads it whole, runs the pure domain function `applyCommand`, and writes it whole, all in one
   synchronous better-sqlite3 transaction. The meta layer is a second JSON row (`legacy.json`).
   Changing the game's shape needs **no SQL migration** for anything inside those two
   documents.
2. **Commands are idempotent by a client key.** The stored response includes the full base
   state, about **8 to 14 KB per command** (measured). The responses are kept 7 days. That makes
   "one command per tap" unworkable for a clicker. At 10 taps/s for 20 minutes a day, one player
   would leave about 0.7 to 1.2 GB in `commands`, and the 14 nightly full-DB backups multiply
   that. **Taps must be batched**, and click batches need a slimmer idempotency record.
3. **CPU is not the problem.** A full command costs about 0.4 to 0.6 ms (0.64 ms on disk with
   WAL), and a replayed key about 0.04 ms. The single Node process serialises everything, which
   is what makes the races safe.
4. **A per-player "nuke" fits the existing machinery better than the season reset does.** It
   can be one ordinary idempotent command. The domain returns a fresh base plus a `nuked` event,
   and the API's existing `followLegacy` hook folds the points into the meta row in the same
   transaction. The red button cannot fire twice on a double-click. The feed, Discord channel
   and push come for free through the event pipeline. The season reset (`endSeason`) is global
   and admin-run, with leaderboards, a hall of fame, a new season row and a backup. Its parts
   (`carryOver`, `carryFor`, `newBase(carry)`, `saveLegacy`) are reusable, but its global shape
   is not.
5. **Watch out for `version`.** The client drops pushes whose `version` is not higher than its
   own (`apps/web/src/state/store.ts:419`), so a nuke must keep `bases.version` counting up:
   overwrite the row in place, don't delete and recreate it. A nuke must also close the player's
   open market listings and wheel bets, because escrow lives inside the base.
6. **Tree purchases are server-only today, so they would lag.** `buy_perk` is server-only
   because the points live in the `legacy` row and reach the domain as `World.legacy`
   (`packages/domain/src/commands.ts:121-129`, `431-440`). The client cannot predict such
   purchases, so they show as pending until the server answers. A MASSIVE tree bought in rapid
   clicks needs the points and owned nodes mirrored inside the base state, so the client can
   predict them (D64), as `state.perks` already half-does.
7. **Big numbers break "integers in state"** (CLAUDE.md §4, line 97):
   - content amounts are `z.int()` (`packages/content/src/schema.ts:21`, 199 `z.int()` uses);
   - `production()` multiplies before it divides (`packages/domain/src/base.ts:376`), so it
     loses exactness past 2^53 / (seconds × 100). For a day offline that is about 1e9 per hour;
   - command caps stop at 1e7 (`apps/api/src/commandSchema.ts:58-59, 90`);
   - `JSON.stringify(Infinity)` is `null`, which would silently corrupt a base.

   Plain doubles (up to 1.8e308, with a finite-number guard) are the cheapest change. A
   mantissa/exponent Decimal is needed only if the tree can push growth past 1e308.
8. **The live database is small and young.** Season 1 started from a wipe on 2026-10-07, with
   2 players. A wipe into the redesign is cheap and has a tested recipe (`docs/deploy.md:173-181`)
   that keeps logins, sessions, push devices and the VAPID, casino and Discord-cursor settings.
   I could not read the live DB; section 10 gives a read-only count command to confirm.
9. **Seasons can disappear without touching SQL.** `currentSeason()` creates one season row on
   first use and nothing ends it unless the admin runs `season end`, so one perpetual season is
   the zero-change path. Alternatively the existing season reset can become a slower second
   prestige layer ("Wipe Day" = Rust's monthly forced wipe).
10. **Ops limits:**
    - shared 2 vCPU, 1.9 GB VPS with about 1 GB free;
    - the web bundle is built on the VPS;
    - migrations run automatically at container start;
    - never touch the tk-toolkit containers (only append to the Caddyfile once, validate and
      reload);
    - all backups are still on the same disk.

---

## 1. The server at a glance

| File | Lines | Role |
| --- | --- | --- |
| `apps/api/src/main.ts` | 92 | Boot: config, content, DB, hub, notifier, `Game`, a 60 s scheduler that also runs at boot, HTTP. |
| `apps/api/src/app.ts` | 445 | Hono routes: web (cookie), bot (`/api/bot/*`, service token), admin (`/api/admin/*`), static web build. |
| `apps/api/src/game.ts` | 1159 | The game service: `look`, `command`, `tick`, feed, Den, ranks, raids, legacy, `endSeason`. |
| `apps/api/src/commandSchema.ts` | 98 | zod wire schema for every command (mirrors the domain's `Command`). |
| `apps/api/src/store/schema.ts` | 290 | drizzle schema (16 tables). |
| `apps/api/src/store/db.ts` | 24 | Opens SQLite (WAL, foreign keys on) and runs migrations **at every boot** (line 22). |
| `apps/api/src/legacyStore.ts` | 89 | Legacy row, Signal row and gifts. |
| `apps/api/src/den.ts` | 183 | Casino secret (HMAC per wheel round), jackpot, the board, price history. |
| `apps/api/src/push.ts` | 303 | Web Push (VAPID in `settings`) plus Discord DMs through the bot stream. |
| `apps/api/src/hub.ts` | 78 | In-process SSE fan-out: per player, feed, Den, bot. |
| `apps/api/src/auth.ts` | 150 | Discord OAuth (arctic), hashed session tokens, one-time bot login links. |
| `apps/api/src/backup.ts` | 36 | Nightly online backup, newest 14 kept. |
| `apps/api/src/season-cli.ts` | 46 | `announce` and `end`, which call the running API over loopback. |
| `apps/api/src/config.ts` | 81 | Env schema (`GAME_DATABASE_PATH`, `BACKUP_DIR`, `ADMIN_TOKEN`, `BOT_API_TOKEN`, ...). |

Stack: Hono on @hono/node-server (D58), better-sqlite3 12.x and drizzle-orm 0.45, drizzle-kit
0.31, zod 4, web-push, arctic (`apps/api/package.json`). The server runs TypeScript through
`tsx` at runtime; there is no build step (`Dockerfile`, last line).

---

## 2. How state is persisted

### 2.1 Tables (`apps/api/src/store/schema.ts`)

| Table | Key | What it holds | Scope |
| --- | --- | --- | --- |
| `players` (20-37) | `id` autoincrement; `discord_id` unique | name, avatar, `last_seen_at` (welcome-back), `notify_json`, `discord_dm` | per player, permanent |
| `sessions` (40-51) | `token_hash` | SHA-256 of the cookie token, 30-day sliding expiry | per player |
| `login_links` (54-60) | `token_hash` | the bot's one-time links (10 min) | per player |
| `seasons` (62-72) | `id` autoincrement | `started_at`, `ended_at` (null = running), `ends_at` (announced), `modifier`, `next_modifier` | **global** |
| `legacy` (75-81) | `player_id` | the domain's `Legacy` as JSON (points, perks, blueprints, crew levels, titles, skins, seasons count) | per player, survives resets |
| `season_archive` (84-96) | (season, player) | the season card, ranks and points as JSON | per player per season |
| `hall_of_fame` (99-112) | (season, category, player) | category winners, `value` INTEGER | global history |
| `signal` (115-121) | `season_id` | the shared tower's progress as JSON | **global** per season |
| `signal_gifts` (124-140) | `id` | each gift (good, amount, worth) | per player per season |
| `bases` (143-163) | **(player_id, season_id)** | **`state_json` = the whole `BaseState`**, `version`, `next_event_at` (indexed), `updated_at` | per player per season |
| `commands` (166-180) | (player_id, key) | the stored response for idempotency; index on `at` | per player |
| `event_log` (183-198) | `id` autoincrement | every domain event: `type`, JSON `payload`, `player_id`, `season_id`, `at`; indexes (player, at) and (type, at) | append-only, **never pruned** |
| `settings` (201-204) | `key` | `vapid` keys, `casino_secret`, `jackpot`, `discord_feed` cursor | global |
| `push_subscriptions` (207-219) | `endpoint` | one per device | per player |
| `listings` (228-254) | `id`; unique (seller, season, local_id) | the Den board; the goods themselves are escrow **inside the seller's base** | global board |
| `trades` (260-275) | `id` | price history | global |
| `wheel_bets` (278-290) | `id` | bets per 30 s round, pruned after 120 rounds | global |

Conventions (schema header, lines 1-10): times are UTC unix seconds; amounts are INTEGER;
Discord ids are TEXT.

### 2.2 One JSON blob per base (D61)

- `BaseState` (`packages/domain/src/base.ts:78-168`) holds about 50 fields: stock, buildings,
  construction, furnace jobs, items, per-station craft queues, crew, missions, reports, node
  runs, barrel, tasks, hints, listings (escrow), Den day, contracts, casino day, wheel bets,
  stats, raid, PvP, season info, perks, veterans, skin.
- **Measured size** (the `optimal` archetype from `packages/sim`): 8.8 KB on day 1, 12.2 KB on
  day 9, 14.3 KB on day 28.
- `load()` (`game.ts:230-265`) reads the row for (player, current season), then
  `normalizeState()` (`packages/domain/src/normalize.ts:45-138`) upgrades older shapes on read.
  That function is how every phase so far evolved the state without SQL migrations. With no row,
  `load()` builds `newBase(content, now, seed, carryFor(legacy, season))` lazily. Nothing is
  written until the first save.
- `save()` (`game.ts:267-288`):
  - writes the whole JSON;
  - sets `version = loaded.version + 1`;
  - sets `next_event_at = nextEventAt(state)` (`packages/domain/src/settle.ts:77-94`: the
    earliest of construction, craft, mission, arrival, barrel, raid, listing expiry and wheel);
  - sets `updated_at`.
- Change detection compares the whole JSON before and after
  (`JSON.stringify(a) !== JSON.stringify(b)`, `game.ts:523`, `629-630`).

### 2.3 The meta layer is a separate row

`legacyOf()` and `saveLegacy()` (`legacyStore.ts:13-24`) read and write `legacy.json`, merged
over `newLegacy()` defaults. New fields need no migration.

Perks are kept twice:

- in `legacy.perks` (the server's truth);
- in `state.perks`, copied in by `carryFor` (`packages/domain/src/legacy.ts:76-84`) and updated
  by `buyPerk` (`legacy.ts:141-160`).

`followLegacy` (`game.ts:796-841`) keeps the two in step.

### 2.4 Migrations

- There are five migrations in `apps/api/src/store/migrations` (0000 to 0004; journal in
  `meta/_journal.json`).
- `openDb()` runs `migrate()` on every boot (`store/db.ts:22`), so **a deploy applies schema
  changes when the container starts**.
- New migrations come from `pnpm db:generate` after editing `schema.ts`. drizzle-kit rebuilds
  SQLite tables for changes such as a primary key change.

---

## 3. A command, end to end

### Client (`apps/web`)

1. A tap builds a `Command` and gets a fresh key from `crypto.randomUUID()`
   (`apps/web/src/net/backend.ts:98-100`).
2. The store predicts the result with the same `applyCommand`, shows it at once and queues the
   command (`apps/web/src/state/store.ts`, header lines 1-19; D64).
3. `flush()` sends **one command at a time, in order** (`store.ts:426-485`).
4. `HttpBackend.command()` POSTs `{key, command}` and retries **with the same key** after
   500 ms, 1.5 s and 4 s on a network error or 5xx (`apps/web/src/net/http.ts:46`, `86-103`).
5. The answer becomes `confirmed`, and what is still queued is replayed on top of it. A refusal
   the prediction missed rolls back with a toast.

Server-only commands cannot be predicted (`SERVER_ONLY`: `market_buy`, `slots_spin`,
`dice_roll`, `raid_player`, `buy_perk`, `set_cosmetic`, `signal_give`; `commands.ts:121-129`).
They show as pending until the answer arrives.

### Server

1. `POST /api/commands` goes through the cookie middleware (`app.ts:399-408`). For the bot it
   goes through the service token plus the `x-discord-id` middleware (`app.ts:318-397`). Both
   end at the same handler (`app.ts:217-227`).
2. zod validation (`commandSchema.ts:94-98`): the key is 8 to 64 characters, and the command is
   one of 36 strict shapes. A malformed request gets a 400.
3. `Game.command()` (`game.ts:601-675`) does all of the following inside **one**
   `db.transaction(...)`:
   - Looks up `commands` by (player, key). A hit returns the stored JSON verbatim (lines
     605-610).
   - `load()` reads and normalises the base, or makes a new one (line 612).
   - `world()` (lines 216-228) gathers what only the server knows: the legacy view, the Signal,
     the wheel's `reveal`, the jackpot, a random `seed` and `self`.
   - For a market buy or a PvP raid, the **other** base is settled and saved inside the same
     transaction (`saleOf` 682-705, `raidOf` 750-772).
   - `applyCommand()` (`packages/domain/src/commands.ts:476-511`) settles to `now`, applies
     the command, records stats, task progress and hints, and plans the next NPC raid. It is
     pure.
   - It saves if the state changed (line 631).
   - `log()` (lines 294-315) writes **one `event_log` row per event**. Feed-worthy events are
     collected, and the Den's tables are updated from events (lines 318-419).
   - `followLegacy()` (lines 796-841) applies the persistent side effects: perk bought, cosmetic
     set, a Signal gift that may light the Signal.
   - It completes the other half of a sale or raid (`completeSale` 708-743, `completeRaid`
     775-790).
   - It inserts the `commands` row with the **full response, state included** (lines 644-657).
   - `seen()` updates `players.last_seen_at` (web only; the bot passes `seen=false`).
   - It queues a push (`origin: key`) to the player's other tabs (lines 659-670).
4. After the commit, `flush(out)` (lines 422-427) publishes the SSE pushes, the feed broadcast,
   the Den messages, and phone or Discord notifications. This is an outbox pattern: nothing
   leaves the process before the commit.

The response is `{ok, serverNow, version, state, events, refusal?}`
(`packages/domain/src/wire.ts:52-61`). The client always adopts `state` whole.

---

## 4. Transaction boundaries and concurrency

- **better-sqlite3 is synchronous.** A transaction runs to the end without yielding the event
  loop, so two requests never interleave (`game.ts` header, lines 1-5). The race tests rely on
  this: 50 parallel spins never pass the wager cap (`den.test.ts:99`), and 50 parallel PvP
  attacks get exactly one through (`raid.test.ts:168`).
- Units of work:

  | Operation | Transactions |
  | --- | --- |
  | `look()` (`GET /state`) | one (`game.ts:550-575`); it **writes** when settling changed something |
  | `command()` | one, including the second base of a sale or raid |
  | `tick()` | one per due base (`game.ts:1056-1065`), then prunes old commands and wheel bets |
  | `settleRound()` | one per bettor (`game.ts:1031-1042`) |
  | `endSeason()` | an awaited online backup first, then **one** transaction for the whole reset (`game.ts:910-1002`) |

- **One writer process** (D52). The bot keeps no DB (D121). The season CLI calls the API over
  loopback instead of opening the file (`season-cli.ts:24-36`). The only exception is the
  `docs/deploy.md` wipe recipe, which opens the file from a second process inside the
  container while the API runs, then restarts it.
- SQLite runs in WAL mode (`db.ts:19`). The measured `synchronous` pragma is 1 (NORMAL):
  commits do not fsync; checkpoints do.

---

## 5. Idempotency (D59) and what it costs

- The key: the client picks one per intent and reuses it on every retry. The bot uses the
  Discord interaction id (`bot.test.ts:235`).
- Storage: `commands(player_id, key)` primary key, `result_json` = the full `CommandResponse`.
  Refusals are stored too: a replayed refused key stays refused even if the base could afford
  it now, while a new key is judged by the state.
- TTL: `COMMAND_TTL = 7 days` (`game.ts:98`), pruned by the minute tick (`game.ts:1066-1069`).
- A second guard exists for node hits: a hit number already counted is a no-op
  (`packages/domain/src/nodes.ts:156`). This is the one existing "tap" command
  (`hit_node {node, run, hit 1..100}`, `commandSchema.ts:47-52`), bounded by `maxHits: 5` per
  run and a 4.5 s window plus 3 s grace (`packages/content/data/active.json5:8-15`).

**Measured** (scratchpad script, repo code unchanged):

| What | Result |
| --- | --- |
| Domain round trip (parse, normalize, settle, collect, 3× stringify), day-28 base | 0.21 ms |
| `Game.command(collect)`, fresh base, in-memory DB | 0.40 ms |
| `Game.command(collect)`, day-28 optimal base, in-memory DB | 0.58 ms |
| `Game.command(collect)`, fresh base, on-disk WAL DB | 0.64 ms |
| Replay of a stored key | 0.04 ms |
| `commands.result_json` after 4,000 commands | **31.7 MB (about 7.9 KB per command)** |
| `event_log` after 4,000 collects | 4,004 rows, 250 KB of payload (about 62 B per event) |

The VPS (2 vCPU, shared) is probably 1.5 to 3 times slower than the dev PC.

---

## 6. The other runtime pieces (brief)

- **Settle on read.** `GET /api/state` runs `look()` (`game.ts:547-578`): it settles, saves if
  changed, and adds a welcome-back summary after 1 hour away (`WELCOME_BACK_AFTER`, line 96).
  The summary uses `event_log` rows of the `WHILE_AWAY` types (lines 102-121) since
  `max(lastSeenAt, seasonStartedAt)`.
  - `settleAll` (`packages/domain/src/settle.ts:23-74`) handles construction, upkeep, crafts,
    missions, arrivals, barrel, tasks, nodes, listings, Den, contracts and wheel. A due raid
    splits the span.
  - Accrual is closed-form: `accrued()` (`base.ts:463-474`) is rate × elapsed, capped by
    storage, with nothing stored per second (CLAUDE.md §4).
- **Scheduler.** `setInterval(tick, 60_000)`, which also runs at boot (`main.ts:21`, `69-83`).
  `tick()` (`game.ts:1048-1076`):
  - settles every base with `next_event_at <= now`;
  - pushes over SSE and sends notifications;
  - prunes commands older than 7 days and wheel bets older than 120 rounds.

  In production the same tick takes the daily backup (`main.ts:76-80`). Wheel spins also get a
  precise `setTimeout` (`main.ts:47-49`).
- **SSE.** `GET /api/events` (`app.ts:289-314`) carries `state` (a `PushMessage`: version, full
  state, events, origin key), `feed`, `den`, `ready`, and `ping` every 25 s. The hub is
  in-process only (`hub.ts`).
  - The client ignores its own echoes by key, and **any push whose `version` is not higher than
    its own** (`store.ts:417-421`).
  - The bot has its own stream (`app.ts:327-348`): feed items (missed ones replayed after the
    `settings.discord_feed` cursor, `game.ts:474-498`), DMs and season news.
  - Caddy proxies with `flush_interval -1` (`deploy/Caddyfile.wipeday`).
- **Bot routes.** `/api/bot/*` reuses the same player handlers (`app.ts:395`). That means **any
  new command (a nuke, a click batch) is automatically reachable from the bot**; today the bot
  only sends `collect` and `gather` (`apps/discord/src/ui/interactions.ts:123-125`). The bot
  describes bases with the domain's read-only helpers and `words`, so a new `BaseState` shape
  means reworking the bot's card too.
- **Auth.**
  - Discord OAuth `identify` scope (`auth.ts:39-68`).
  - The `wd_session` cookie is httpOnly, Secure in production and SameSite=Lax, and lasts 30
    days with a daily slide. The database stores only its SHA-256 (`auth.ts:17-23`, `93-122`).
  - Dev test players 1 to 3 exist only outside production (`app.ts:181-195`).
  - Admin routes take the `ADMIN_TOKEN` bearer token, or loopback when no token is set
    (`app.ts:105-137`, `437-445`).
  - **There is no rate limiting anywhere.**
- **Backups.** `backupOnce()` writes `var/backups/wipeday-YYYY-MM-DD.db` and keeps 14
  (`backup.ts:10-36`). `endSeason` takes `wipeday-pre-season-N.db` first (`main.ts:51-54`,
  `game.ts:914`). **Every copy is a full database copy on the same disk.** Off-server copying
  is still a W9 to-do (`docs/deploy.md:191`).

---

## 7. A per-player prestige reset (the "nuke") compared with the season reset

### 7.1 What the season reset does (`Game.endSeason`, `game.ts:910-1018`; D115)

1. It is an admin call (`POST /api/admin/season/end`, `app.ts:130-136`, through
   `season-cli.ts`) and **awaits a full online backup** first (line 914).
2. One transaction:
   - Settles **every** base of the season read-only (lines 919-931).
   - Builds global leaderboards (line 932) and computes the Signal shares (lines 933-935).
   - For each player:
     - computes the season summary;
     - computes `seasonPoints` (rank-based, competitive: `legacy.ts:205-213`);
     - inserts the `season_archive` row;
     - runs `carryOver` (keep blueprints, best crew levels, titles, skins, add points;
       `legacy.ts:216-248`);
     - saves the legacy row with `saveLegacy` (lines 936-963).
   - Writes the hall of fame for every category plus the Signal (lines 964-985).
   - Closes the season row and nulls the old bases' `next_event_at` so the tick ignores them.
     The old bases stay as history rows (lines 986-987).
   - Closes all open listings, zeroes the jackpot and deletes every wheel bet (lines 988-994).
   - Inserts the next season row with its modifier (lines 995-1000).
3. After the commit:
   - it broadcasts `den: season` and every client reloads;
   - it sends bot `news` with the winners (lines 1003-1016).
4. A player's new base is created **lazily** on their next look, by `load()` →
   `newBase(..., carryFor(legacy, season))` (`game.ts:247-264`). The test checks that it equals
   a fresh base plus the carry (`season.test.ts:127`).

### 7.2 What is global and what is per player

| Global (shared by everyone) | Per player |
| --- | --- |
| the `seasons` row and number, modifier, announced end | the `bases` row (keyed by player **and season**) |
| the Signal and its stages | the `legacy` row (meta layer) |
| leaderboards (computed live by `ranks()`, `game.ts:1091-1117`) and `hall_of_fame` | the `season_archive` row |
| the Den board (`listings`), `trades`, wheel rounds, the `jackpot` setting | the `commands` and `event_log` rows |
| the feed (filtered by `season_id`, `game.ts:443`) | sessions, push devices, notify prefs |

### 7.3 What a nuke can reuse

- **The command pipeline unchanged.** `nuke` is a command: idempotent by key, in one
  transaction, pushed to the player's other tabs, logged. **The double-click guard is free**
  (the replay returns the stored response). The two-tap confirmation (CLAUDE.md 6.3 rule 4) is
  client-side.
- **`followLegacy` (`game.ts:796-841`).** This is the exact hook for "the domain emitted an
  event; now update the persistent row in the same transaction". `perk_bought` is the template
  for a `nuked` handler: `legacy.points += earned`, `legacy.runs += 1`, lifetime records, and so
  on.
- **`carryFor`, `newBase(carry)`, `carryOver`, `applyOptions`** (`legacy.ts:76-84`, `163-176`,
  `216-248`; `base.ts:179-239`). They express "fresh island plus what you kept". `carryOver`
  takes a ranked `SeasonResult`; a nuke needs a variant whose points come from the run's own
  progress (Cookie Clicker style: f(lifetime production) rather than a rank).
- **`World`** (`packages/domain/src/world.ts:22-41`) supplies the server's view of the meta
  layer and a seed for the new island.
- **The event and feed pipeline.** Add `nuked` to `FEED_TYPES`
  (`packages/domain/src/feed.ts:14`) and a sentence in `words`. Then "Patrik pressed the red
  button: +42 fragments" reaches every web tab and `#wipe-day-idle` through the existing bot
  stream. A notify kind could DM friends.
- **`event_log` as the run archive.** A `nuked` event whose payload is the run summary is
  queryable by the existing indexes (player, at) and (type, at). A separate `runs` table is only
  needed if the UI pages through run history often.

### 7.4 What a nuke must handle that the season reset handles globally

- **Keep `version` monotonic.** Overwrite the same `bases` row through `save()` so the version
  keeps counting. If the row is deleted and `load()` lazily recreates it at version 0, the
  player's other tabs ignore every push until they reload (`store.ts:419`). The season reset
  gets away with it only because it broadcasts a reload.
- **Escrow inside the base.** Open listings hold their goods in the seller's base
  (`schema.ts:223-227`), so a nuke would destroy them while the board rows stay `open`.
  `saleOf` would refuse buyers (`game.ts:693-696` checks the seller's state), but the board
  would show ghosts. The handler must close this player's open `listings` rows, or the domain
  must return the goods first and the row then closes as `cancelled`.
- **Wheel bets.** These live in `state.wheelBets` and the `wheel_bets` table. Refund them or
  drop them, and delete the rows for unsettled rounds.
- **Raids.** A pending NPC raid lives in the base and goes with it. A PvP raid is instant
  (one transaction), so there is no cross-base state in flight; the defender's shield and
  revenge token sit in the defender's own base.
- **Welcome-back** uses `max(lastSeenAt, seasonStartedAt)`. A nuke happens while the player is
  present, so `lastSeenAt` is later than the nuke; no change is needed. A per-run start time in
  state would make it exact.
- **Seeds.** The new island needs a seed: `World.seed`, or derive it from base seed + run number
  so the client can predict the nuke.
- **No backup per nuke.** The nightly backup plus the archived event are enough. The season
  reset's backup is for a once-a-month global operation.

### 7.5 Recommended shape (two options for the planner)

- **A. Smallest change.**
  - Keep `bases` (one row per player in a perpetual season) and `legacy` (meta).
  - `nuke` is server-only: points come from `World.legacy`. The domain returns
    `newBase(carryFor(legacy'))` and a `nuked` event; `followLegacy` writes the legacy row and
    closes listings and bets.
  - Downside: like today's perks, everything bought with prestige points is server-only and
    shows as pending.
- **B. Better feel for a massive tree.** Mirror the meta layer into the per-player document,
  either as `state.meta` or by merging `legacy` into the base row, so that:
  - buying tree nodes is predicted instantly on the client (D64), with no pending wait while
    clicking through a huge tree;
  - `nuke` is a **pure** domain function: `{meta, run} → {meta', newRun(meta')}`, with the seed
    derived. The client can play the explosion before the server answers, and the simulator can
    play prestige loops (the simulator is the only way to argue balance, CLAUDE.md §9).

  The server stays authoritative because the domain function is the same on both ends. The
  separate `legacy` row is then needed only if seasons remain as a second reset layer.

### 7.6 Seasons: keep, remove or repurpose (code view)

- **Remove (zero SQL).**
  - Never run `season end`. `currentSeason()` (`game.ts:191-195`) keeps the single running row
    forever.
  - Feed, ranks, Den, Signal and `event_log` are all scoped by that one id and keep working.
  - Remove or hide the admin routes, the CLI, the Signal, the season chip and the modifiers
    (`packages/content/data/seasons.json5`).
  - `bases`' primary key (player, season) becomes effectively (player).
- **Repurpose as a second prestige layer.** `endSeason` is already a correct, tested,
  all-players "reset everything except the persistent layer". Changing what `carryOver` keeps
  (for example, reset the tree but keep a third-tier currency or cosmetics and titles) turns the
  monthly wipe into the "transcendence" layer. The hall of fame and archive give it a
  ceremony. Its per-player half would then become the nuke's helper.
- **Guardrails that block a massive tree.** These are enforced in code, not just in docs, and
  each needs a decision entry if retired:
  - "Legacy never makes a veteran more than 25% stronger" (CLAUDE.md §8, line 215). The content
    check refuses a perk tree above `capPercent` (`packages/content/src/parse.ts:996-1022`;
    `load.test.ts:194`), and `legacy.test.ts` walks 12,288 perk-rank combinations.
  - "Optimal play cannot reach the top tier before day 14" (line 216) is asserted by
    `pnpm sim check` inside `pnpm test` (`packages/sim/src/sim.test.ts`, `data/pacing.json5`).

  A prestige game multiplies rates by orders of magnitude, so these checks would fail the
  build until they are replaced.

---

## 8. High-frequency clicking through commands

### 8.1 What happens if every tap is a command (current pipeline)

- **`commands` table.** About 8 to 14 KB per tap, kept 7 days.
  - At 10 taps/s for 20 minutes a day, that is 12,000 commands, or about 95 to 170 MB per player
    per day, and **0.7 to 1.2 GB per heavy clicker** at steady state.
  - The 14 nightly backups are full copies on the same disk, so that multiplies again.
  - Disk, not CPU, is the binding limit on the shared VPS.
- **`event_log`.** At least one row per tap (about 62 B of payload plus row and index
  overhead). It is never pruned, so growth is unbounded.
- **SSE.** Each changed command pushes the **full state** to every open tab of the player,
  including the sender, which drops it by origin key after parsing. At 10 taps/s that is about
  140 KB/s per tab.
- **CPU.** 10 players × 10 taps/s = 100 commands/s × about 1 to 2 ms on the VPS, or 10 to 20%
  of a core. Feasible, but wasteful.
- **Latency.** The client sends sequentially (`store.ts:426-485`), so a burst of taps queues
  behind each other's round trips. Prediction hides it, but the queue keeps growing.

### 8.2 Recommended: batch taps, clamp in the domain

- **Coalesce on the client.** While a command is in flight, merge adjacent queued taps into one
  `{type: "click", target, count}` command, and flush every 1 to 2 s or when the tab is hidden.
  Merging is safe only **before** a command gets its key; once sent, a retry must resend
  identical content with the same key. The existing sequential queue makes this natural.
- **Clamp in the domain, not the API.** Keep a small budget in state, for example
  `clicks: {lastAt, bank}` (a token bucket). Credit at most
  `maxCps × (now − lastAt) + burst` taps and silently clamp the rest, rather than refuse. Then
  the client's prediction and the server agree for any honest tapper and no rollback toast ever
  fires. Domain time is whole seconds (`now`, D51), so the server can check counts against
  elapsed seconds, not per-tap timing. That is enough.
- **Anti-cheat for friends.** Every purchase and production rule already runs on the server, so
  the only spoofable input is the tap rate. A generous cap (15 to 20 taps/s with a few seconds
  of burst) makes autoclickers pointless.
  - D63 (the daily node haul) is the precedent: a data-file ceiling on active income.
  - Design so clicks matter early and automation outgrows them, as in Cookie Clicker. Then
    cheating loses value as the run grows.
  - Optionally add a coarse per-player HTTP limit. None exists today.
- **A slim idempotency record for click batches.** Either:
  - store `{ok, version, events, refusal}` without `state`, and on replay return the current
    state (the client adopts the state anyway). This changes D59's "identical answer" wording
    and needs a decision entry. Or:
  - give click commands a short TTL (minutes instead of 7 days).
- **Log aggregates.** Log one `clicked {count}` event per batch, or none: clicks are not
  feed-worthy and can roll up into stats. If `event_log` gets pruning, exclude prestige and
  feed events.

With batches every 2 s: 10 players → 5 commands/s. The current infrastructure handles that with
room to spare.

### 8.3 Offline progress for an incremental economy

Closed-form accrual (rate × elapsed) fits the lazy model perfectly. Two cases need care:

- **Automation that buys things** (auto-buyers, managers à la AdVenture Capitalist) needs
  settle to step through purchases. `settleAll` runs inside **every** command
  (`commands.ts:483`), so it must stay cheap when little time has passed. Use chunked or
  bounded iteration and an offline cap (for example 8 to 24 h of credited time). That is also a
  pacing lever.
- **The scheduler only needs events that notify** ("expedition back", "raided"). Continuous
  production never needs a timer.

---

## 9. Big numbers

### 9.1 Where the code assumes safe integers

- **CLAUDE.md §4 (line 97):** "Integers in state. Amounts are integers... No floats in the
  database."
- **Content schema:** `const amounts = z.record(z.string(), z.int().min(0))`
  (`packages/content/src/schema.ts:21`); 199 `z.int()` in the schema overall.
- **`production()`** computes `Math.floor(perHour * seconds * percent / (3600*100))`
  (`base.ts:373-379`).
  - The product is exact only up to 2^53 ≈ 9.0e15. Exactness is lost from about 1.0e9 per hour
    over a day offline, or 1.5e8 per hour over a week.
  - Results stay approximately right as doubles, but "integer" invariants and conservation
    property tests stop meaning anything.
  - The same pattern appears in node slices (`nodes.ts:205`), gather, upkeep and clamping.
- **Wire caps:**
  - `market_list` amount and price ≤ 1e7, `signal_give` ≤ 1e7 (`commandSchema.ts:58-59`, `90`);
  - `craft`/`salvage` count ≤ 1000 (lines 25, 31);
  - casino bets ≤ 1e5 (lines 68-74).
- **SQLite INTEGER columns** holding amounts: `listings.amount`/`price`,
  `trades.amount`/`price`, `signal_gifts.amount`/`worth`, `hall_of_fame.value`,
  `wheel_bets.amount`. INTEGER is 64-bit, but better-sqlite3 returns JS numbers, which are
  lossy above 2^53 unless `safeIntegers` (BigInt) is turned on.
- **JSON:** `JSON.stringify(Infinity)` and `JSON.stringify(NaN)` both give `null`. One overflow
  would persist `null` into `state_json` and break the next load. Values of 1e21 and above
  serialise as `1e+21`, which round-trips fine.

### 9.2 Options

| Option | JSON / `state_json` | SQLite columns | Cost |
| --- | --- | --- | --- |
| **Plain doubles** (`number` up to 1.8e308) | native | REAL for any amount columns kept | Lowest: drop the "integer" rule for amounts and keep `Math.floor` for display. Needs one guard (`Number.isFinite`) in `save()` or the domain, and a formatter for 1e15+ (suffixes or scientific notation). Enough if growth is tuned to stay under about 1e300 even after many prestiges. |
| **Mantissa/exponent Decimal** (break_infinity.js-style; check npm for the latest stable before adding, per CLAUDE.md) | serialise as a string (`"1.23e456"`) or `[m, e]`; zod-parse on load | TEXT for display; REAL `log10` for sorting | Every arithmetic site in the domain changes (`Amounts` becomes `Record<string, Decimal>`), roughly 10 to 50 times slower math (irrelevant at 5 commands/s), and the content schema accepts strings or exponents. Needed only if the tree's multipliers compound past 1e308. |
| **Log storage** (store `log10(x)`) | compact doubles | REAL | Sums need log-sum-exp, which is awkward for costs and production. Best used only as a sort key for leaderboards and the hall of fame. |

**Recommendation from the code's view:**

- Use doubles plus a finite-number guard first. Design costs as formulas in data
  (`base × growth^owned`), computed rather than stored.
- Keep the domain's amount type behind one alias so a later switch to a Decimal is a type
  change, not a hunt.
- Any cross-player number queried in SQL (leaderboards, hall of fame) gets a REAL `log10`
  column or is computed in JS. `ranks()` already parses every base in JS (`game.ts:1091-1117`).

---

## 10. The live database and the move into a redesign

### 10.1 What it contains now (from docs and code; not read directly)

I could not inspect `~/wipeday/var/wipeday.db` from here, and SSH to the shared VPS was out of
scope. What the docs establish:

- The game was **wiped at the W7 deploy on 2026-10-07** at the owner's request, using the
  recipe in `docs/deploy.md:173-181`. Season 1 started fresh that day, and W8 was deployed the
  same day.
- **Two live players**: the owner and a friend (roadmap "Where we are"; project memory).
- Backups on the VPS: `wipeday-pre-w7.db`, `wipeday-pre-wipe.db`, `wipeday-pre-w8.db`, earlier
  `wipeday-pre-*.db` copies and the nightly ones.

Expected rows:

| Table | Expected contents |
| --- | --- |
| `players` | at least 2 (kept through the wipe; any Discord user who logged in or used the bot is upserted) |
| `sessions`, `login_links` | live |
| `push_subscriptions` | probably 0 (the roadmap asks the owner to turn notifications on again) |
| `settings` | `vapid`, `casino_secret`, `discord_feed` cursor; `jackpot` only once someone played slots |
| `seasons` | 1 row (id 1, `sqlite_sequence` was reset by the wipe) |
| `bases` | 2 rows at most, day 0-1 of play |
| `commands`, `event_log` | rows since the wipe |
| `legacy` | most likely empty: rows are written only by `buy_perk`, `set_cosmetic` and `endSeason`, and nobody has points yet |
| `season_archive`, `hall_of_fame`, `signal`, `signal_gifts` | empty: no season has ended, and the Signal opens only in the last week or once announced |
| `listings`, `trades`, `wheel_bets` | probably empty: the Den opens at Stone |

A read-only check for the owner to run on the server:

```sh
docker exec -w /app/apps/api wipeday node -e "const D=require('better-sqlite3'); const db=new D('/app/var/wipeday.db',{readonly:true}); for (const t of ['players','sessions','push_subscriptions','settings','seasons','bases','commands','event_log','legacy','season_archive','hall_of_fame','signal','signal_gifts','listings','trades','wheel_bets','login_links']) console.log(t, db.prepare('select count(*) c from '+t).get().c); console.log('bases bytes', db.prepare('select coalesce(sum(length(state_json)),0) b from bases').get().b); console.log('db bytes', db.pragma('page_count',{simple:true})*db.pragma('page_size',{simple:true}))"
```

### 10.2 Options

1. **Wipe (recommended; tested once already).**
   - Delete the game rows: `commands`, `event_log`, `listings`, `trades`, `wheel_bets`,
     `season_archive`, `hall_of_fame`, `signal_gifts`, `signal`, `bases`, `legacy`, `seasons`,
     plus `settings.jackpot` and the `seasons` sequence.
   - Keep `players`, `sessions`, `login_links`, `push_subscriptions`, `settings.vapid`,
     `settings.casino_secret` and `settings.discord_feed`.
   - Players keep their login and land on a fresh island from the redesign's `newBase` the
     first time they look (lazy creation, `game.ts:247-264`).
   - Optional: grant both founders a cosmetic or some starting prestige currency through a
     one-off admin grant (the W9 roadmap already plans admin "grant" commands).
2. **End season 1 first, then wipe the run state but keep history.** Run `season-cli end`. It
   writes the archive, hall of fame and legacy points with its own backup. Then convert the
   `legacy` points into the new prestige currency in a one-off step, and keep
   `season_archive`/`hall_of_fame` as "the old world" history. This costs a converter and keeps
   two meta formats around; worth it only if the owner wants the season-1 hall of fame to
   matter.
3. **Convert bases in place** with `normalizeState`. Not worth it: a redesigned `BaseState`
   shares little with today's, there are only 2 players, and season 1 is days old.

### 10.3 Pitfalls for the wipe and migration

- **Never reset `event_log`'s AUTOINCREMENT sequence.** The bot's feed cursor
  (`settings.discord_feed`) is an `event_log.id`, and `feedMissed()` only replays items with a
  higher id (`game.ts:474-492`). If ids restart from 1, the channel stays silent until they
  pass the old cursor. Today's recipe resets only the `seasons` sequence, which is correct.
  Alternatively delete `settings.discord_feed` so it re-initialises.
- **Schema changes ship as drizzle migrations and run at container start** (`store/db.ts:22`).
  - A failed migration means the container does not come up. The health check fails, but
    Caddy and the other sites are unaffected.
  - Take the pre-deploy copy (`docs/deploy.md:43-47`) before every migration.
  - Dropping the Den, Signal or season tables is optional. Leaving them dormant costs nothing
    and keeps history readable.
- **Keep the wipe a single writer.** The current wipe recipe opens the DB from a second
  process while the API runs. W9's planned admin commands are the natural place to make "wipe"
  or "grant" an API route instead (D52: the API is the only writer).
- **Tests to rewrite or retire:**
  - `season.test.ts` (reset snapshot);
  - `den.test.ts` and `raid.test.ts` (if those systems go);
  - `app.test.ts` (the idempotency and time tests stay valid as patterns);
  - `bot.test.ts`;
  - the simulator's pacing assertions in `pnpm test`.
- **`players.notify_json`** is keyed by `NOTIFY_KINDS` (`packages/domain/src/feed.ts:64`) and
  merged over defaults (`push.ts:192-197`). New kinds (for example "your friend nuked") slot in;
  removed kinds are ignored.

---

## 11. Operational constraints a plan must respect (`docs/deploy.md`)

- **The shared VPS** (`deploy.md:109-124`):
  - 2 vCPU, 1.9 GB RAM, about 1 GB free.
  - It also serves travian.patrikliska.dev (tk-toolkit) and daisingo.patrikliska.dev.
  - **Never restart, recreate or `docker compose up` anything in `~/tk-toolkit`.** The only
    contact is appending the Wipe Day block to `~/tk-toolkit/Caddyfile` once, in place (the
    file is bind-mounted by inode), then `caddy validate` and `caddy reload` inside
    `tk-toolkit-caddy-1` (`scripts/deploy.sh:34-51`).
  - `patrikliska.dev` and www are on other hosting: never touch them.
  - `sudo` is never needed.
  - Secrets live only in `~/wipeday/.env`, written by the owner.
- **The containers** (`deploy/compose.yml`):
  - `wipeday` (API plus web build) has **no memory limit**;
  - `wipeday-bot` is capped at 320 MB (`--max-old-space-size=192`);
  - both are on the external network `tk-toolkit_default`.

  Any new process (a separate game server, a worker, Redis, Postgres) competes for that 1 GB.
  The plan should stay at one process.
- **The image is built on the VPS** (`Dockerfile`: `pnpm install` plus `vite build` inside the
  build stage). A much bigger web bundle (huge tree data, a big-number library, new art) raises
  build memory on the 1.9 GB box. Watch it, or move the web build off the server.
- **The deploy checklist** (`deploy.md:40-57`):
  1. `pnpm check` passes and the tree is committed (the script refuses a dirty tree);
  2. take a DB copy first;
  3. run `scripts/deploy.sh`;
  4. check that all four sites answer 200;
  5. glance at the logs;
  6. `git push`.

  `main` is always what is live; each phase gets its own branch.
- **Backups:**
  - 14 nightly full copies plus pre-phase copies, **all on the same disk**;
  - off-server copying is not set up yet (W9, item 1 of "the plan from here").

  A redesign wipe is the moment that most needs an off-server copy first. DB growth (section 8)
  multiplies by the number of copies.
- **Runtime facts:**
  - one Node process;
  - the SSE hub is in memory, so a restart drops streams and clients reconnect and reload;
  - the scheduler runs at boot, so anything that ended during downtime lands at once;
  - the admin CLI runs through `docker exec` on loopback.
- **Discord:**
  - the bot shares the API's image;
  - it reaches the API at `http://wipeday:8787`;
  - a restart loses nothing (the feed cursor is in `settings`);
  - season news goes to `#wipe-day-idle`. A nuke announcement would ride the same feed path.

---

## 12. Open questions the planner should settle

1. Should taps reach the server at all (batched and clamped, recommended), or should early
   clicking be purely client-side and credited as a flat rate?
2. Does the meta layer move into the per-player document (option 7.5 B: predictable tree,
   pure nuke) or stay a server-only row (option A: less change, laggy tree buys)?
3. Doubles or Decimal: what is the designed ceiling after N prestiges?
4. Do seasons go (one perpetual row) or become the slow second reset layer on top of nukes?
5. Do the Den (market, casino), PvP and the Signal survive? Each one that goes removes tables,
   tests and cross-base transactions. Each one that stays must be made nuke-safe (escrow,
   bets).
6. Wipe season 1 outright, or end it first so its hall of fame and points carry into the new
   world?
7. Which CLAUDE.md guardrails are retired (the 25% legacy cap, the day-14 and day-18 floors,
   "integers in state", the 7-day identical-replay semantics), each with a D-number?
