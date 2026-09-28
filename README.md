# Wipe Day

An idle survival game for a handful of friends: a living base on a wrecked island, played in the
browser, with a Discord bot as a companion. Private, single-server.

- Spec: [CLAUDE.md](CLAUDE.md). Design: [docs/game-design.md](docs/game-design.md). Next phases:
  [docs/roadmap.md](docs/roadmap.md). Why things are the way they are:
  [docs/decisions.md](docs/decisions.md).
- Current state: **W4a** (crew, the fogged island, expeditions). Play at https://wipeday.patrikliska.dev
  (Discord login). Locally, `pnpm dev` runs the API and the web client with dev test players.
  The Discord bot (`apps/discord`) is frozen on its old rules until W8.

## Run it

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm dev                  # API + web on http://localhost:5173; log in as test player 1-3
pnpm check                # typecheck + lint + test, everything
scripts/deploy.sh         # ship the committed HEAD to the VPS (docs/deploy.md)
```

`http://localhost:5173/?demo` plays the whole game in the browser on a fast clock; its `✦`
drawer controls time speed, weather, base tier, barrels and "give everything".

## Where things are

```
packages/domain    pure game rules (state + now in, state + events out), Clock
packages/content   data/*.json5 balance and content, zod schemas, loader, locale/en.json
packages/sim       headless balance simulator (archetypes, pacing check)
apps/web           the client: PixiJS scene + React panels (docs/web-prototype.md)
apps/api           the game server: login, idempotent commands, lazy settling, push
apps/discord       the Discord bot (frozen until W8 makes it a companion)
docs/              game-design, roadmap, decisions, ui-review, web-prototype, archive/
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm check` | typecheck + lint + test across the workspace |
| `pnpm dev` | API and web client together, with dev test players |
| `pnpm web` / `pnpm web:build` | web dev server alone (demo mode) / production bundle |
| `pnpm web:shots [--only x]` | headless screenshots of the web client into `preview/web/` (needs `pnpm web` running) |
| `pnpm sim` / `pnpm sim check` | simulate casual/active/optimal players for 35 days; `check` asserts `data/pacing.json5` |
| `pnpm api` | the API process |
| `pnpm start` / `pnpm bot:dev` | run the Discord bot |
| `pnpm preview` | render every bot card in every state to `preview/`, plus `preview/index.html` |
| `pnpm assets check` | regenerate the bot's asset list and report missing or unusable files |
| `pnpm assets import <dir>` | resize every known `name.png` in `<dir>` into each bot asset folder that needs it |
| `pnpm format` | apply formatting and safe lint fixes |
| `pnpm db:generate` | create a migration after editing `apps/discord/src/store/schema.ts` |

## The Discord bot

```sh
cp .env.example .env      # then fill in DISCORD_TOKEN and DISCORD_GUILD_ID
pnpm start                # or: pnpm bot:dev (restarts on change)
```

`.env` and the database (`var/`) live at the repo root. Creating the bot (once):

1. <https://discord.com/developers/applications> -> New Application -> **Bot** -> Reset Token.
   That token is `DISCORD_TOKEN`.
2. **OAuth2 -> URL Generator**: scopes `bot` and `applications.commands`; bot permissions
   `Send Messages`, `Attach Files`, `Create Public Threads`, `Send Messages in Threads`.
   Open the URL and add the bot to your server.
3. In Discord: Settings -> Advanced -> Developer Mode, then right-click the server ->
   Copy Server ID. That is `DISCORD_GUILD_ID`.

No privileged intents are needed. Optional: `ADMIN_ROLE_ID` in `.env` lets a role use the
admin commands besides server Administrators.

| Command | What it does |
| --- | --- |
| `/start` | Builds your base and posts your home message |
| `/base` | Re-posts your home message where you are (the old one is removed) |
| `/help` | Three lines, never required |
| `/idle-debug card` | Admins: renders the base card's sample states to check the pipeline |

Everything else happens on the home message: **Collect**, **Gather** (opens the node
mini-game), **Tools**, **Build**, **Furnace**, **Craft**, **Inventory**, plus barrels and three
daily tasks. Buttons appear as the mechanic becomes relevant.

### Supplying bot art

Everything the bot wants is listed in
[apps/discord/assets/ASSETS.md](apps/discord/assets/ASSETS.md), by folder, with the item
shortname to source each picture from and the phase that first needs it. Put full-size PNGs
named like the manifest (`wood.png`, `tier_stone.png`) into `apps/discord/assets/_inbox/` and
run `pnpm assets import apps/discord/assets/_inbox`; it writes every size the bot uses. The bot
runs with nothing supplied (placeholder tiles, Unicode emoji). Supplied files are gitignored.
The web client needs no art: it draws everything procedurally.
