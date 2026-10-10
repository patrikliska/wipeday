# Deploying Wipe Day

The game runs on the owner's VPS (Czechia `Vps3890`, 37.46.209.127) at
https://wipeday.patrikliska.dev, next to two other projects that must keep working (D68).

## Shape

- One Docker container, `wipeday`, built from this repo (`Dockerfile`): the API, which also
  serves the web build. Compose file: `deploy/compose.yml`, copied to `~/wipeday/compose.yml`.
- W8: a second container from the same image, `wipeday-bot`, runs the Discord bot once it is
  configured (see "The Discord bot" below). It keeps no state and talks only to the API.
- The existing Caddy (`tk-toolkit-caddy-1`, from `~/tk-toolkit`) owns ports 80/443 and TLS. The
  `wipeday` container joins its Docker network (`tk-toolkit_default`), and one block
  (`deploy/Caddyfile.wipeday`) appended to `~/tk-toolkit/Caddyfile` proxies the domain to
  `wipeday:8787`. Nothing in tk-toolkit is ever restarted or recreated: Caddy only reloads.
- State: `~/wipeday/var/wipeday.db` (SQLite) and `~/wipeday/var/backups/` (one online backup per
  day, the newest 14 kept, D54), copied off the server every night (see "Off-server backups").
- Secrets: `~/wipeday/.env` on the server, written by the owner (never in git):

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

  Without them the site runs and the login card says Discord login is not set up.
- Web Push (W4b, D96) needs nothing here: the VAPID key pair is generated on the first boot
  and kept in the database's `settings` table, so it survives deploys and is in every backup.
  Losing the database means new keys, and every device has to turn notifications on again.

## Deploy

```sh
pnpm check && git commit ...   # deploy ships the committed HEAD
scripts/deploy.sh              # copy, build, restart, add the Caddy block once, health check
```

The script needs SSH access as `vpsuser` (`DEPLOY_HOST`, `DEPLOY_KEY` override the defaults;
the default key is `~/.ssh/claude_temp_key`, which exists only on the first computer).

### The checklist (every deploy)

1. `pnpm check` passes and everything is committed (the script refuses a dirty tree).
2. Take a database copy first (the nightly backup may be hours old):

   ```sh
   ssh -i ~/.ssh/<key> vpsuser@37.46.209.127 'docker exec -w /app/apps/api wipeday node -e "const D=require(\"better-sqlite3\"); new D(\"/app/var/wipeday.db\").backup(\"/app/var/backups/wipeday-pre-<phase>.db\").then(()=>console.log(\"ok\"))"'
   ```

3. `DEPLOY_KEY=~/.ssh/<key> scripts/deploy.sh` and wait for `{"ok":true,...}`.
4. Check that all four sites answer 200 (the other three share the server or the DNS):

   ```sh
   for u in https://wipeday.patrikliska.dev/ https://patrikliska.dev/ https://daisingo.patrikliska.dev/ https://travian.patrikliska.dev/; do curl -s -o /dev/null -w "%{http_code} $u\n" "$u"; done
   ```

5. Glance at the log for errors: `docker compose logs --since 5m` in `~/wipeday` (on the server).
6. `git push`.

### From a new computer

The deploy key is per computer. On the new one:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/wipeday_deploy -C "wipeday deploy"   # no passphrase is simplest
cat ~/.ssh/wipeday_deploy.pub                                         # copy this one line
```

Then add that line to the server, from any place that can already log in (the old computer, or
the VPS console in the Czechia admin at admin.czechia.com, logged in as `vpsuser`):

```sh
echo "<the line>" >> ~/.ssh/authorized_keys
```

Test it: `ssh -i ~/.ssh/wipeday_deploy vpsuser@37.46.209.127 'echo OK'`. From then on deploy
with `DEPLOY_KEY=~/.ssh/wipeday_deploy scripts/deploy.sh` (in Git Bash on Windows).

## Working from two computers

Only the first computer has deploy access (the other plays and develops on localhost). `main`
is always what is live; each phase gets its own branch.

On the computer without deploy access (work and test locally):

```sh
git checkout main && git pull    # start from what is live
git checkout -b w4b              # once per phase (w4b, then w5, ...)
# ... work, pnpm check, commit ...
git push -u origin w4b           # the first time; afterwards just: git push
```

On the computer that deploys:

```sh
git checkout main && git pull
git fetch && git merge origin/w4b   # bring the branch's work in
pnpm install                        # in case dependencies changed
pnpm check                          # must pass before deploying
scripts/deploy.sh                   # ships the committed HEAD: deploy from main only
git push                            # main on GitHub now matches what is live
```

- Always push before switching computers: unpushed commits stay behind.
- To try the branch here before merging: `git checkout w4b`, `pnpm dev`, then `git checkout main`.
- Local test bases live in `var/` (not in git): each computer has its own; the live game's data
  is only on the server.
- After a phase is merged and deployed: `git branch -d w4b` and `git push origin --delete w4b`.

## Rules for the shared server (never break these)

- The server also runs the owner's other projects: **travian.patrikliska.dev** (tk-toolkit
  frontend and backend) and **daisingo.patrikliska.dev** (static files in `~/daisingo`). Their
  containers come from `~/tk-toolkit/docker-compose.yml`.
- Never restart, recreate or `docker compose up` anything in `~/tk-toolkit`. The only thing
  Wipe Day does there is append its block to `~/tk-toolkit/Caddyfile` (once, in place: the file
  is bind-mounted by inode) and then `caddy validate` + `caddy reload` inside
  `tk-toolkit-caddy-1`. The script does exactly that; a backup is `Caddyfile.bak-wipeday`.
- **patrikliska.dev** and www are on separate Czechia webhosting (217.198.114.187), not this
  server: never touch them. DNS is in the Czechia DNS manager; the owner adds records.
- `sudo` on the server needs the owner's password: never needed for Wipe Day.
- Never commit or print `.env` or its secrets; the server's `~/wipeday/.env` is written by the
  owner.
- The server is small (2 vCPU, 1.9 GB RAM, about 1 GB free): the game's container and its
  bot (capped at 320 MB in `compose.yml`), no other services.

## Discord developer portal (once)

Application (the bot's) -> OAuth2:
- Redirects: `https://wipeday.patrikliska.dev/api/auth/callback` and, for local development,
  `http://localhost:5173/api/auth/callback`.
- Client ID and Client Secret go into `~/wipeday/.env` on the server (and the local `.env`).

## The Discord bot (W8, D121-D126)

The bot is the same application as the login. It needs four lines in `~/wipeday/.env` (the
owner writes them; never in git):

```
DISCORD_TOKEN=...            # developer portal -> the application -> Bot -> Reset Token
DISCORD_GUILD_ID=718829849137119232
FEED_CHANNEL_ID=...          # where the island's feed and season news go (optional)
BOT_API_TOKEN=...            # 32+ random characters (openssl rand -hex 32); the API reads it too
```

- The bot must be in the server: developer portal -> OAuth2 -> URL Generator, scopes `bot` and
  `applications.commands`; in the feed channel it needs View Channel and Send Messages. It
  needs no privileged intent.
- `scripts/deploy.sh` starts the bot (`docker compose --profile bot up -d --build`) only when
  `DISCORD_TOKEN`, `DISCORD_GUILD_ID` and `BOT_API_TOKEN` are all set; otherwise it deploys
  the game alone and says so. After adding them, deploy again (or, on the server:
  `cd ~/wipeday && docker compose --profile bot up -d --force-recreate`, which also makes the
  API read the new token).
- On start it registers `/base` in the guild (replacing the old bot's commands) and logs
  "logged in" and "slash commands registered": `docker compose logs --tail=50 wipeday-bot`.
- It reaches the API at `http://wipeday:8787` on the Docker network. A restart loses
  nothing: the API remembers which feed items the channel has (`settings.discord_feed`) and
  sends the missed ones (at most 20, from the last day) when the bot reconnects.
- Stop it without touching the game: `docker compose stop wipeday-bot`.

## Seasons (W7, D114)

The season's end is announced, then run, from the server. Both talk to the running API from
inside the container (loopback is trusted; no secret needed):

```sh
docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/season-cli.ts announce 2026-11-04 --next storm_season
docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/season-cli.ts end
```

The end takes its own backup first (`var/backups/wipeday-pre-season-N.db`). Modifiers:
`long_nights`, `rich_tides`, `quiet_raiders`, `storm_season` (`packages/content/data/seasons.json5`).

## Starting over (wipe the game, keep logins)

Done once at the W7 deploy, at the owner's request. Take a copy first, then delete the game's
rows (players, sessions, push subscriptions and the VAPID keys stay), then restart:

```sh
docker exec -w /app/apps/api wipeday node -e "const D=require('better-sqlite3'); const db=new D('/app/var/wipeday.db'); db.backup('/app/var/backups/wipeday-pre-wipe.db').then(()=>{ db.transaction(()=>{ for (const t of ['commands','event_log','listings','trades','wheel_bets','season_archive','hall_of_fame','signal_gifts','signal','bases','legacy','seasons']) db.prepare('DELETE FROM '+t).run(); db.prepare(\"DELETE FROM settings WHERE key='jackpot'\").run(); db.prepare(\"DELETE FROM sqlite_sequence WHERE name='seasons'\").run(); })(); console.log('wiped'); })"
cd ~/wipeday && docker compose restart wipeday
```

## Useful commands on the server

```sh
cd ~/wipeday && docker compose logs -f --tail=100   # the game's log (and the bot's)
docker compose up -d --force-recreate wipeday       # after editing .env (restart does not re-read it)
ls ~/wipeday/var/backups                            # nightly backups
cat ~/wipeday/var/offsite.json; tail ~/wipeday/var/offsite.log   # the last off-server copy
```

## Off-server backups

The nightly copies and every `wipeday-pre-*.db` also leave the server, so losing the VPS (or a
mistake on it) never loses the game.

- **What runs:** `deploy/offsite.sh`, installed as `~/wipeday/offsite.sh` (`scripts/deploy.sh`
  refreshes it), from `vpsuser`'s crontab (no sudo):

  ```
  30 4 * * * $HOME/wipeday/offsite.sh >> $HOME/wipeday/var/offsite.log 2>&1
  ```

  04:30 server time (Europe/Prague) is after the API's nightly copy at 00:00 UTC.
- **Where to:** rclone (`~/bin/rclone`, v1.75.1) into the remote `wipeday-offsite:`, a `crypt`
  remote (file names and contents encrypted) over `gdrive:wipeday-backups` in the owner's Google
  Drive. The Drive remote uses the owner's own Google OAuth client (project `wipeday-backup`,
  published, scope `drive.file`: rclone sees only the files it wrote). The config with both
  crypt passwords (obscured, not encrypted) is `~/.config/rclone/rclone.conf` (mode 600); the
  owner keeps the two passwords elsewhere too. Nothing of it is in git.
- **Layout:** `pre/` holds every `wipeday-pre-*.db`, forever; `nightly/` the dated copies, the
  last 30 days. The script only copies, never syncs, so an emptied folder on the box cannot
  empty the remote.
- **Did it run:** `~/wipeday/var/offsite.json` is `{"ok":true,"at":<unix>,"files":<n on the
  remote>}` after every run (the API's status page reads it from R2); the log says why a run
  failed.
- **By hand:** `~/wipeday/offsite.sh` any time (it skips if a run is still going), e.g. right
  after a `wipeday-pre-<phase>.db` copy.

### Restoring

On the VPS (the remote is already configured):

```sh
~/bin/rclone lsl wipeday-offsite:            # what is there, decrypted names
mkdir -p ~/wipeday/var/drill && ~/bin/rclone copy wipeday-offsite:pre/wipeday-pre-r0.db ~/wipeday/var/drill/
```

On a new machine: install rclone, `rclone config` a Drive remote with the same Google client
(`client_id`, `client_secret`, scope `drive.file`, signed in as the owner) and a `crypt` remote
over `<drive>:wipeday-backups` with the two passwords (standard file name encryption, directory
names encrypted). Then copy as above. To put a copy back into the game, stop the container,
move `var/wipeday.db` and its `-wal`/`-shm` files aside, put the copy in as `var/wipeday.db`
(with no `-wal` or `-shm` beside it) and start it again.

### The restore drill (R0, 2026-10-10)

`wipeday-pre-r0.db` was taken by hand, the first run copied 23 files (13 nightly, 10 `pre`), and
two of them came back from the remote into `~/wipeday/var/drill/`, were opened read-only inside
the container and counted, then the drill folder was deleted:

```
$ cmp ~/wipeday/var/drill/wipeday-pre-r0.db ~/wipeday/var/backups/wipeday-pre-r0.db
pre-r0 identical to the box copy
wipeday-pre-r0.db integrity: ok players: 3 bases: 2 event_log: 195
wipeday-2026-10-10.db integrity: ok players: 3 bases: 2 event_log: 182
```

The command, to repeat it:

```sh
mkdir -p ~/wipeday/var/drill && ~/bin/rclone copy wipeday-offsite:pre/wipeday-pre-r0.db ~/wipeday/var/drill/
docker exec -w /app/apps/api wipeday node -e "const D=require(\"better-sqlite3\"); const db=new D(\"/app/var/drill/wipeday-pre-r0.db\",{readonly:true}); const n=t=>db.prepare(\"select count(*) n from \"+t).get().n; console.log(db.pragma(\"integrity_check\",{simple:true}), n(\"players\"), n(\"bases\"), n(\"event_log\"))"
rm -rf ~/wipeday/var/drill
```
