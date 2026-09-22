# CLAUDE.md — Wipe Day (Rust-themed idle game as a Discord bot)

## 1. What this is

Wipe Day is a long-term idle/incremental game played entirely inside Discord, themed after the survival game Rust (by Facepunch). It is a standalone Discord bot written in TypeScript. Nothing else exists yet: no host project, no existing code, no pinned dependencies. Do not invent any.

- Private use only: one Discord server, a handful of friends. Rust item names, icons and monuments are used as-is. The repo stays private and the bot is never made public.
- Players: gather resources, build and upgrade a base, craft gear, send squads to monuments, raid NPC and player bases, gamble scrap at Bandit Camp.
- Seasons are monthly, mirroring Rust's force wipe cadence. Account progression persists across seasons.

### Priority order (when trade-offs appear)

1. **UI and UX quality.** This is the most important thing in the project. The game must be understandable with zero tutorial and must look great.
2. Long-term pacing and economy health.
3. Code simplicity and testability.
4. Feature count. Fewer polished features beat many rough ones.

### Non-goals

- No web dashboard.
- No real-money anything. No multi-server support. No sharding.
- No per-second simulation loop.

## 2. Working rules for the agent

- Greenfield project. Set up the stack in section 3 exactly; if a dependency is missing or a version does not exist, check npm and pick the latest stable release. Never claim a constraint (pinned version, toolchain, existing file) that you cannot show in the repo.
- Work strictly phase by phase (section 11). Do not start a phase until the previous one meets its acceptance criteria. Stop and report at the end of every phase.
- All balance numbers live in data files (section 8), never in Rust code.
- Every player-visible string lives in `locale/en.json` (keyed). No string literals in UI code.
- `pnpm typecheck` (strict), `pnpm lint`, `pnpm test` must pass before a phase is reported done.
- When something in this spec is ambiguous, pick the option that gives better UX, note the decision in `docs/decisions.md`, and continue.
- Never commit third-party game assets or tokens. `assets/` content folders are gitignored except for `.gitkeep`, the manifest and placeholders.

## 3. Architecture

**Stack:** Node 22 LTS, TypeScript strict, pnpm, `discord.js` (latest, Components V2 support required), `better-sqlite3` with `drizzle-orm` + `drizzle-kit` migrations, `satori` + `@resvg/resvg-js` for card rendering, `zod` for data file validation, `vitest`, `biome` for lint/format, `tsx` for dev. Verify each package's current version on npm before pinning.

```
src/
  domain/        pure game logic, no Discord, no DB, no clock (time and RNG injected)
  store/         drizzle schema, repositories, migrations
  ui/            screens, components, customId routing, locale
  render/        JSX card templates (satori) -> PNG, fixtures, cache
  assets/        asset registry, manifest generation, application emoji sync
  scheduler/     one tick per minute: expeditions, upkeep, builds, events
  sim/           headless balance simulator (pnpm sim)
  bin/           idle-preview, idle-assets, idle-sim entry points
data/            JSON5 balance and content files
locale/          en.json (cs.json optional later)
assets/          see section 7
```

Core principles:

- **Lazy evaluation.** State stores timestamps and rates (`last_collected_at`, `ends_at`). Values are computed on interaction. The scheduler only resolves things that have an end time and posts results.
- **Domain is pure.** `domain` functions take state + `now` + RNG seed and return new state + events. This is what the simulator and unit tests drive.
- **Idempotent interactions.** Every button click is validated against current state inside one DB transaction. Double clicks and stale messages must never duplicate rewards.
- Restart-safe: on boot the scheduler resolves everything that ended while offline.

## 4. UI and UX specification (highest priority)

### 4.1 Rendering stack

- **Components V2** for every screen (Container, Section, TextDisplay, Separator, MediaGallery, Thumbnail, plus buttons and select menus). No classic embeds anywhere. All messages sent with the `IsComponentsV2` flag. Build screens through one `ui/Screen` abstraction that returns a typed component tree, so the rules in 4.3 can be linted automatically.
- **Rendered image cards** are the main visual tool. `render/` defines cards as JSX (satori: flexbox, absolute positioning, custom fonts loaded from `assets/fonts/`) and rasterises them with resvg to PNG. Used for: base overview, inventory grid, squad loadout, expedition report, raid report, slot machine reels, roulette wheel result, leaderboard, season summary.
  - Cache rendered PNGs by a hash of their input data. Never re-render identical state.
  - Render budget: under 150 ms per card. Defer the interaction first if a render is needed (3 s ack limit).
- **Application emojis** (bot-owned, up to 2000, no server slots needed) are used for inline icons in text and on buttons. `assets/emojiSync` uploads everything in `assets/emoji_128/` at startup, diffing by name + file hash, and exposes a typed lookup (`Emoji.sulfur`).
- **Live timers** always use Discord timestamps (`<t:UNIX:R>`), which count down client-side with zero message edits. Never edit a message on a timer just to update a countdown.

### 4.2 Visual language

- Rust-inspired palette defined once in `src/ui/theme.ts`, shared by cards and component colours: dark charcoal background, off-white text, rust-orange accent (`#CD412B`), muted green for success, amber for warning, red for danger. Rarity/tier colours: twig, wood, stone, metal, HQM each get one fixed colour used everywhere.
- Font: Roboto Condensed (regular + bold) for cards, loaded into satori. Numbers always abbreviated consistently (`12.4k`, `1.2M`) through one formatter.
- Every resource, item, monument and action has exactly one icon, used identically in cards, text and buttons.
- Progress bars for anything with a cap or a duration: storage fill, build progress, upkeep remaining, squad health, gear durability.
- Layout consistency: title line, one-line status, main card image, details, then actions. Same order on every screen.

### 4.3 Zero-tutorial UX rules

These are hard requirements, test them in review of every screen:

1. **One obvious next action.** Each screen has exactly one primary-styled button: the most useful thing the player can do right now (computed by `ui::advisor`). All other buttons are secondary. Danger style only for destructive or PvP actions.
2. **Never a dead end.** Every sub-screen has a Back button and a Home button. Every result screen offers the natural follow-up (Send again, Heal, Collect).
3. **Disabled buttons explain themselves.** A locked action stays visible, disabled, with the reason in the label (`Upgrade · need 2.1k stone`). No hidden features.
4. **Show cost and outcome before commitment.** Any spend over a trivial threshold goes through a confirm screen showing cost, duration, result, and resources after the spend. Expeditions show success chance, loot range and risk before sending.
5. **Errors are helpful and private.** Ephemeral, one sentence: what is missing, how much, and a button that takes the player to where they get it.
6. **Onboarding is the game itself.** `/start` creates the player and shows the base screen with a single glowing action (Gather). The next mechanic is revealed only when it becomes affordable, with a one-line hint under the card. Hints disappear permanently once the action has been used twice. No walls of text, no `/help` dependency (a `/help` exists but must not be needed).
7. **One persistent home message per player.** `/base` posts or refreshes it. All navigation edits that message. Sub-menus that only concern the player are ephemeral. The channel must never fill with bot spam.
8. **Feed channel** gets public, story-worthy events only: expedition reports, raids, jackpots, season milestones, admin-triggered world events. Each is a rendered card with a short narrative line.
9. **Mobile first.** Every screen must read well on a phone: max 5 buttons per row, max 3 rows, labels under 20 characters, card images legible at 400 px width (minimum 22 px font at 800 px card width).
10. **Feedback on everything.** Every click changes something visible within 1 second (deferred update, then final state). Gains are shown as deltas (`+214 scrap`).
11. Select menus for choices over 5 options (craft list, monument list), with icon emoji and a short description per option, sorted by relevance, unaffordable ones marked.
12. Notifications are opt-in per type via a Settings screen (storage full, expedition back, raided, build done). Delivered as a ping in a personal thread or DM, player's choice. Default: expedition back + raided only.

### 4.4 Interaction plumbing

- `customId` scheme: `idle:v1:{screen}:{action}:{args}`, parsed by one router into a typed enum. Max 100 chars. Include the owner's player id for non-ephemeral messages and reject clicks from other users with a friendly ephemeral note.
- Stale message handling: if state changed since render, re-render the screen instead of erroring.
- Rate limits: edits happen only in response to interactions or scheduler resolutions. Never on a loop.

### 4.5 Screen list

Home (base), Gather/nodes, Storage and furnaces, Build/upgrade, Workbench and blueprints, Craft, Inventory, Squads, Squad loadout, Monument picker, Expedition confirm, Expedition report, Raid picker (NPC / player), Raid confirm, Raid report, Defense, Market, Bandit Camp (roulette, slots), Leaderboard, Profile (account layer), Settings, Season summary.

For each screen, create `docs/screens/{screen}.md` with: purpose, states (empty, normal, locked, error), primary action rule, buttons, and card template name. Write this doc before implementing the screen.

### 4.6 Visual self-review loop (mandatory)

The agent cannot see Discord, but it can see PNGs. Use that.

- **Preview binary:** `pnpm preview` renders every card template with sample data into `preview/` (gitignored). For each card produce several states: `{card}__empty.png`, `{card}__normal.png`, `{card}__full.png` (long names, max values, 7-digit numbers), `{card}__locked.png` where relevant. Also emit each card downscaled to 400 px width as `{card}__normal@mobile.png`, and `preview/index.html`, a contact sheet of all cards on a Discord-dark background (`#313338`).
- Sample data lives in `src/render/fixtures/` and must include worst cases: longest item name, longest player name (32 chars), zero resources, everything capped.
- **Review rule:** after creating or changing any card template, run the preview, open the resulting PNGs (full size and mobile), and critique them against this checklist before moving on:
  1. Hierarchy: the most important number or status is the first thing the eye lands on.
  2. Legibility: all text readable in the 400 px mobile version, nothing under the minimum font size.
  3. Spacing: consistent padding and grid, nothing touching edges, nothing cramped or floating.
  4. Overflow: long names and large numbers truncate or abbreviate cleanly, no clipping or overlap.
  5. Consistency: same icon, colour and number format for the same thing as on every other card.
  6. Contrast: readable on Discord dark and light themes (cards carry their own background, check the edges).
  7. Placeholder safety: still looks acceptable when assets are missing.
- Iterate at least twice per new card. Write a short note per card in `docs/ui-review.md`: what was wrong in iteration 1, what changed. "Looks good" without specifics is not an acceptable review.
- **Component screens** (buttons, selects, text) cannot be rendered locally. For these, `idle-preview` also writes `preview/screens/{screen}.txt`: a plain-text outline of title, text blocks, button rows with labels, styles and disabled reasons. Check it against the rules in 4.3 (one primary button, max 5 per row, labels under 20 chars, Back/Home present).
- **Owner screenshots:** the owner will paste phone and desktop screenshots of real Discord messages. Treat every issue visible in them as a bug with priority over new features.

### 4.7 Reference material

- `docs/reference/` holds screenshots supplied by the owner of the real Rust UI (inventory, crafting, TC, Bandit Camp wheel, slot machine, map) and any Discord bots whose look the owner likes. Read everything in this folder before designing templates and match the feel: layout density, icon framing, tier colours, typography.
- If the folder is empty at Phase 0, list in the phase report exactly which reference screenshots would help most, then continue with the theme in 4.2.

## 5. Game design

### 5.1 Season layer (resets on wipe)

- **Resources:** wood, stone, metal ore, metal fragments, sulfur ore, sulfur, HQM ore, HQM, cloth, leather, low grade fuel, scrap.
- **Gathering:** passive rate from tool tier (rock, stone tools, metal tools, salvaged tools, jackhammer/chainsaw) and assigned nodes. Accrues offline up to the storage cap. Manual "Gather" click gives a small active bonus with a cooldown.
- **Storage:** boxes set the cap. Hitting the cap is the main check-in driver.
- **Furnaces:** ore to refined, consumes wood, limited slots and throughput. Upgradable (small furnace, large furnace, electric).
- **Base:** TC tier twig, wood, stone, metal, HQM. Tier gates storage, furnace count, workbench level, defense slots and casino max bet. Upgrades have build timers (twig instant, up to 24 h for HQM).
- **Upkeep:** hourly resource drain scaled by tier. Unpaid upkeep causes decay: production penalty first, tier loss only after 72 h unpaid.
- **Workbench 1/2/3** and **crafting:** tools, weapons, armor, meds, explosives, traps, keycards are found not crafted. Gear has durability.
- **Squads:** 2 to 5 survivors. Monuments by duration/risk: Supermarket, Gas Station, Lighthouse, Dome, Harbor, Satellite Dish, Airfield, Train Yard, Water Treatment, Power Plant, Military Tunnels, Launch Site, Small Oil Rig, Large Oil Rig. Green/blue/red keycard chain gates the upper half. Success roll = squad gear score + perks vs. monument difficulty. Outcomes: loot, wounds (recovery timer), gear wear, rare death (out for the season, kit lost).
- **PvE raids:** NPC bases in tiers, cost explosives, big loot bursts. Main sulfur sink.

### 5.2 PvP raids (friendly, low stakes)

- Attacker pays explosives up front. Success roll: explosive power vs. defender base tier + traps/turrets.
- Loot: max 10% of the defender's unboxed season resources. Never gear, blueprints, survivors or scrap above a cap. No tier loss, only a cheap repair cost.
- 24 h shield after being raided. One PvP raid per attacker per day. Same target at most once per 72 h.
- Cannot raid players below wood tier or more than one tier under the attacker.
- Defender receives a revenge token: counter-raid at half explosive cost within 48 h.
- Players can opt out of PvP entirely in Settings (then they also cannot raid others).
- Every PvP raid posts a report card to the feed.

### 5.3 Bandit Camp casino (scrap only, a sink, never an income)

- **Roulette wheel:** Rust's wheel, bets on 1, 3, 5, 10, 20 with matching payouts, house edge 5 to 8%. Shared spins: a wheel message opens for 30 s, anyone bets via buttons, one result for all, result rendered as a card.
- **Slot machine:** 3 reels of Rust item icons, solo, about 90% RTP. Spin shown by 2 to 3 message edits, final reels as a rendered card. Progressive jackpot fed by 1% of all casino losses, announced in the feed.
- Guard rails: max bet scales with base tier, daily wager cap about 20% of expected daily scrap income at that tier, payouts in scrap only. All odds in data files. The simulator must verify RTP within ±1% over 1M spins.

### 5.4 Account layer (permanent)

- **Blueprints** persist across wipes. About 120 total, top tiers expensive enough that the full tree takes many seasons.
- **Survivors** keep level and perks (scavenger, medic, demolition, marksman, mule) across seasons.
- **Season rank** grants skill points for small passives. Hard cap: a maxed veteran is never more than 25% stronger than a new player in any rate.
- Hall of fame, titles, cosmetic base skins (card template variants).

### 5.5 Pacing targets (enforced by the simulator)

- Casual player (3 check-ins/day): stone tier by day 3 to 4, metal around day 12 to 14, HQM in week 3 to 4.
- Optimal play cannot reach HQM tier before day 14, cannot clear Large Oil Rig before day 18.
- Each base tier costs roughly 4 to 5x the previous.
- No single session should need more than 2 minutes of clicking to be "done".

### 5.6 Rust+ integration (optional, last phase, may never happen)

- Behind a `WorldEvents` interface with a manual implementation first: admin `/idle-admin wipe` starts a season, `/idle-admin event cargo|heli|crate` spawns a shared timed expedition in the feed.
- Only if the owner asks for it later: a Rust+ companion API adapter that fires the same interface from the real server (wipe detection, map events). Do not add Rust+ dependencies before that.

## 6. Data model (SQLite, drizzle migrations)

Tables (minimum): `players`, `account_progress`, `blueprints`, `survivors`, `seasons`, `bases`, `resources`, `inventory_items`, `furnace_jobs`, `build_jobs`, `squads`, `squad_members`, `expeditions`, `raids`, `shields`, `revenge_tokens`, `casino_rounds`, `casino_bets`, `jackpot`, `market_listings`, `notifications_prefs`, `home_messages`, `event_log`.

- All time columns are UTC unix seconds. All amounts are integers (no floats in the DB).
- `event_log` records every state-changing event (type, player, payload JSON, timestamp) for debugging, feed narration and balance analysis.
- Season reset = archive season rows to `*_archive` tables, then clear season-layer tables in one transaction.

## 7. Assets

The project owner supplies all image assets manually. The agent's job is to make that painless.

### 7.1 Required deliverable: asset manifest

At the end of **every phase** (and first of all in Phase 0 for the complete planned list), generate or update:

- `assets/ASSETS.md`: human-readable checklist, grouped by folder, one table per folder.
- `assets/manifest.json`: machine-readable version of the same list, used by the asset registry and by `pnpm assets check`.

Each entry must contain:

| Field | Example |
| --- | --- |
| File name (exact) | `sulfur_ore.png` |
| Format | PNG, transparent background |
| Folder | `assets/emoji_128/` |
| Pixel size | 128x128 |
| What it depicts | Sulfur ore item icon |
| Rust reference | item shortname `sulfur.ore` (or monument name) to make sourcing easy |
| Used in | emoji, inventory card |
| Phase needed | 1 |
| Status | missing / present (filled by the check command) |

Rules:

- If the same picture is needed in several sizes, list it once per size with the **same file name** in each size folder. The owner drops one file per folder. The agent never asks for a size it does not actually use.
- File names: lowercase `snake_case`, ASCII, 2 to 32 characters, because emoji names are derived from them.
- Formats: PNG for everything with transparency, JPG only for large opaque backgrounds, TTF/OTF for fonts. Emoji files must be under 256 KB.
- Keep the list minimal per phase. Do not request assets for features that are not in the current or next phase, except in the full planned list which is clearly marked by phase.

### 7.2 Folder structure (create all folders up front with `.gitkeep`)

```
assets/
  ASSETS.md
  manifest.json
  emoji_128/         128x128 PNG   inline icons and button emojis (auto-uploaded as application emojis)
  icons_256/         256x256 PNG   item and resource icons used inside rendered cards
  portraits_256/     256x256 PNG   survivor portraits
  thumbs_512/        512x512 PNG   monument and base-tier thumbnails
  banners_1600x600/  1600x600 JPG or PNG   card backgrounds, season banners, Bandit Camp
  ui/                mixed, exact size per manifest   wheel, slot frame, progress bar caps, tier badges
  fonts/             TTF   RobotoCondensed-Regular.ttf, RobotoCondensed-Bold.ttf
  _placeholders/     generated by the agent, committed
```

Add a new size folder only if a real need appears, and record why in `docs/decisions.md`.

### 7.3 Behaviour with missing assets

- The bot must run with zero supplied assets. The asset registry falls back to generated placeholders (tier-coloured rounded square with the item's initials) for cards, and to a Unicode emoji fallback for inline icons.
- `pnpm assets check` prints a table of missing files, wrong dimensions, wrong format and oversize emoji files, and exits non-zero if anything required for the current phase is missing.
- On startup, log one summary line: `assets: 143/160 present, 17 placeholders`.

## 8. Data files (`data/*.json5`)

`resources.json5`, `tools.json5`, `base_tiers.json5`, `furnaces.json5`, `items.json5`, `recipes.json5`, `blueprints.json5`, `monuments.json5`, `loot_tables.json5`, `survivor_perks.json5`, `npc_bases.json5`, `pvp.json5`, `casino.json5`, `account.json5`, `pacing.json5` (simulator targets).

- Every entity has an `id` that matches its asset file name and locale key.
- Validate all files at startup with zod, with clear error messages (unknown ids, negative costs, loot tables not summing, missing locale keys).
- Hot reload via `/idle-admin reload-data` for fast balance iteration.

## 9. Simulator (`pnpm sim`)

- Drives `domain` with a fake clock. Archetypes: casual (3 check-ins/day), active (8/day), optimal (greedy planner), gambler, raider.
- Outputs per-day table and CSV: base tier, resources, scrap, blueprints, monuments cleared, casino net.
- `pnpm sim check` asserts the pacing targets in `pacing.json5` and casino RTP. Runs in CI/tests from Phase 2 on.

## 10. Testing

- Unit tests for all domain rules (accrual with caps, upkeep decay, success rolls with seeded RNG, PvP limits, shield/revenge timing, casino payout tables).
- Snapshot tests for rendered cards (SVG string from satori) and for screen component trees (JSON).
- Interaction tests for idempotency: same click twice, stale message, click by non-owner.

## 11. Phases and acceptance criteria

**Phase 0: foundations.** Project skeleton, bot login and slash command registration, migrations, data loading and validation, locale, theme, render pipeline with one demo card, asset registry with placeholders, emoji sync, `pnpm assets check`, full planned `ASSETS.md`. *Done when:* `/idle-debug card` posts a rendered demo card; the bot runs with an empty assets folder; manifest lists every planned asset by phase; `pnpm preview` produces the contact sheet and the demo card has a two-iteration entry in `docs/ui-review.md`.

**Phase 1: core loop.** `/start`, `/base` home message, gathering, storage cap, collect, tool tiers, advisor primary button, onboarding hints. *Done when:* a new user can go from `/start` to their first tool upgrade with no instructions; home message never duplicates; offline accrual is correct across restarts.

**Phase 2: base.** Tiers with build timers, upkeep and decay, furnaces, workbench, crafting, inventory card. Simulator with casual/active/optimal archetypes. *Done when:* pacing targets for tiers pass in `pnpm sim check`.

**Phase 3: squads.** Survivors, loadouts, monuments, keycards, expedition confirm and report cards, feed channel, notifications. *Done when:* full monument chain is playable in the simulator and reports render correctly on mobile width.

**Phase 4: Bandit Camp and social.** Shared roulette, slots with jackpot, guard rails, market, leaderboard card. *Done when:* RTP checks pass; wager caps cannot be bypassed by concurrent clicks.

**Phase 5: raids.** NPC raids, defenses, then PvP with shields, limits, revenge tokens, opt-out. *Done when:* all PvP limits are covered by tests and a raided player can never lose more than the cap.

**Phase 6: seasons and account layer.** Season archive/reset, blueprint persistence, survivor levels, skill points with the 25% cap, hall of fame, season summary card.

**Phase 7: world events.** Manual admin-triggered season start and shared map events through the `WorldEvents` interface. Rust+ adapter only on explicit request.

At the end of each phase report: what was built, decisions made, updated `ASSETS.md` with what the owner needs to supply next, the path to the refreshed `preview/index.html`, and the `docs/ui-review.md` notes for every new or changed card. A phase is not done if any new card lacks a review entry.
