# Wipe Day

A Rust-themed idle game played entirely inside Discord. Private, single-server.
The full specification is [CLAUDE.md](CLAUDE.md). Current state: **Phase 2 (base: tiers, upkeep, furnaces, crafting)**.

## Run it

Requires Node 22+ and pnpm.

```sh
pnpm install
cp .env.example .env      # then fill in DISCORD_TOKEN and DISCORD_GUILD_ID
pnpm start                # or: pnpm dev (restarts on change)
```

Creating the bot (once):

1. <https://discord.com/developers/applications> -> New Application -> **Bot** -> Reset Token.
   That token is `DISCORD_TOKEN`.
2. **OAuth2 -> URL Generator**: scopes `bot` and `applications.commands`; bot permissions
   `Send Messages`, `Attach Files`, `Create Public Threads`, `Send Messages in Threads`.
   Open the URL and add the bot to your server.
3. In Discord: Settings -> Advanced -> Developer Mode, then right-click the server ->
   Copy Server ID. That is `DISCORD_GUILD_ID`.

No privileged intents are needed. Optional: `ADMIN_ROLE_ID` in `.env` lets a role use the
admin commands besides server Administrators.

## Playing

| Command | What it does |
| --- | --- |
| `/start` | Builds your base and posts your home message |
| `/base` | Re-posts your home message where you are (the old one is removed) |
| `/help` | Three lines, never required |
| `/idle-debug card` | Admins: renders the base card's sample states to check the pipeline |

Everything else happens on the home message: **Collect** banks what piled up while you were
away, **Gather** gives a bonus on a cooldown, **Tools** upgrades your gathering tool, **Build**
upgrades the base (bigger storage, more furnace slots, higher workbench; costs upkeep every
hour), **Furnace** turns ore into metal, **Craft** makes boxes, workbenches and gear,
**Inventory** shows what you own. Buttons appear as the mechanic becomes relevant.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm start` / `pnpm dev` | Run the bot |
| `pnpm preview` | Render every card in every state to `preview/`, plus `preview/index.html` |
| `pnpm sim` / `pnpm sim check` | Simulate casual/active/optimal players for 35 days; `check` asserts `data/pacing.json5` |
| `pnpm assets check` | Regenerate the asset list and report missing or unusable files |
| `pnpm assets import <dir>` | Resize every known `name.png` in `<dir>` into each folder that needs it (128/256/512) |
| `pnpm assets sync` | Regenerate `assets/manifest.json` and `assets/ASSETS.md` only |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Must all pass before a phase is done |
| `pnpm format` | Apply formatting and safe lint fixes |
| `pnpm db:generate` | Create a migration after editing `src/store/schema.ts` |

## Supplying art

Everything the game wants is listed in [assets/ASSETS.md](assets/ASSETS.md), by folder, with
the Rust item shortname to source each picture from and the phase that first needs it. The
easy way: put full-size PNGs named like the manifest (`wood.png`, `tier_stone.png`) into one
folder, e.g. `assets/_inbox/`, and run `pnpm assets import assets/_inbox`; it writes every
size the game uses. Then `pnpm assets check` reports what is still missing. The bot
runs with nothing supplied: cards use tinted placeholder tiles, inline icons fall back to
Unicode emoji. Supplied files are gitignored and never committed.

## Where things are

```
src/domain      pure game rules (state + now in, state + events out)
src/game        transaction scripts: one player action = one SQLite transaction
src/sim         headless balance simulator (archetypes, pacing check)
src/scheduler   one tick per minute: lands finished builds, refreshes home messages
src/content     data file schemas, loading, validation
src/store       drizzle schema and migrations
src/ui          theme, locale, number format, Screen model + lint, customId router, screens
src/render      satori JSX cards -> PNG, fixtures, cache
src/assets      manifest generation, registry, checker, application emoji sync
src/bin         bot, idle-preview, idle-assets
data/           JSON5 content and balance      locale/   player-visible strings
docs/           decisions.md, ui-review.md, screens/*.md, reference/ (your screenshots)
```
