# Wipe Day

An idle survival game for a handful of friends: a living base on a wrecked island, played in the
browser, with a Discord bot as a companion. Private, single-server.

- Spec: [CLAUDE.md](CLAUDE.md). Design: [docs/game-design.md](docs/game-design.md). Next phases:
  [docs/roadmap.md](docs/roadmap.md). Why things are the way they are:
  [docs/decisions.md](docs/decisions.md).
- Current state: **W8** (the Discord companion); see the roadmap for what is deployed. Play at
  https://wipeday.patrikliska.dev (Discord login). Locally, `pnpm dev` runs the API and the
  web client with dev test players. The Discord bot (`apps/discord`) is a thin client of the
  API: `/base`, DMs and the feed channel.

## Start here (a new computer)

Where the project stands and what comes next: **[docs/roadmap.md, "Where we are"](docs/roadmap.md)**.
The rules for working on it (for you and for Claude Code): [CLAUDE.md](CLAUDE.md).

1. Install **Node 24** (the server runs `node:24`; 22+ works), **Git**, and on Windows **Git
   Bash** (the deploy script is bash).
2. Get the code and the tools:

   ```sh
   git clone https://github.com/patrikliska/wipeday.git
   cd wipeday
   corepack enable                 # gives the pinned pnpm (package.json: pnpm@10.33.0)
   pnpm install
   pnpm --filter @wipe-day/web exec playwright install chromium   # for pnpm web:shots
   ```

3. Check everything is green: `pnpm check` (typecheck, lint, all tests, the balance check).
4. Run the game locally:

   ```sh
   pnpm dev          # API (:8787) + web (http://localhost:5173); log in as test player 1-3
   ```

   If the API part stays silent (seen on the old Windows machine: `tsx watch` hung before
   listening, D89), use two terminals instead: `pnpm api` (plain, restart it by hand after
   rule changes) and `pnpm web`. `http://localhost:5173/?demo` needs no API at all.
   No `.env` is needed for local play; copy `.env.example` to `.env` only for Discord login or
   the bot.
5. Deploying needs SSH access to the VPS from this computer: see
   [docs/deploy.md, "From a new computer"](docs/deploy.md). The old computer's key stays there.
   Working on one computer and deploying from the other: work on a branch per phase and merge
   it into `main` where you deploy ([docs/deploy.md, "Working from two computers"](docs/deploy.md)).

Continuing with Claude Code: open the repo and ask it to read `CLAUDE.md`, `docs/roadmap.md`
and `docs/decisions.md`, then start the next phase (the kickoff prompt is in the roadmap). The
session memory of the old computer does not come along: everything that matters is in these
files.

## Run it

```sh
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
apps/discord       the Discord companion: a thin client of the API (no rules, no database)
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
| `pnpm api` / `pnpm api:dev` | the API process / with restart on change (`tsx watch`) |
| `pnpm start` / `pnpm bot:dev` | run the Discord bot (needs the API running) |
| `pnpm preview` | draw every bot message in every state into `preview/discord/`, plus `index.html` |
| `pnpm format` | apply formatting and safe lint fixes |
| `pnpm db:generate` | create a migration after editing `apps/api/src/store/schema.ts` |

## The Discord bot

A companion to the web game (W8): it has no rules and no database of its own, and does
everything through the API, like the web client.

```sh
pnpm dev                  # the API (and the web client)
pnpm bot:dev              # the bot, against http://localhost:8787 (restarts on change)
```

`.env` lives at the repo root (`.env.example` lists every key). The bot needs `DISCORD_TOKEN`,
`DISCORD_GUILD_ID`, optionally `FEED_CHANNEL_ID`, and `API_URL` if the API is elsewhere. A
development API lets the bot in without `BOT_API_TOKEN`; production needs it on both sides.
Creating the bot (once):

1. <https://discord.com/developers/applications> -> the game's application (the one the web
   login uses) -> **Bot** -> Reset Token. That token is `DISCORD_TOKEN`.
2. **OAuth2 -> URL Generator**: scopes `bot` and `applications.commands`. Open the URL and add
   the bot to your server. In the feed channel it needs View Channel and Send Messages.
3. In Discord: Settings -> Advanced -> Developer Mode, then right-click the server ->
   Copy Server ID (`DISCORD_GUILD_ID`) and the feed channel -> Copy Channel ID
   (`FEED_CHANNEL_ID`).

No privileged intents are needed.

| Where | What |
| --- | --- |
| `/base` | Your holdfast, privately: the card, what is waiting, timers, **Collect**, **Gather**, a one-time link into the game, DMs on or off |
| DMs | "Your party is back", "Raiders!" and the other kinds you turned on in the game, with your base and the game one tap away |
| The feed channel | What happens on the island, in the web feed's words, and the season's end and reset |

The bot needs no art: the card draws the same placeholder tiles as the web.
