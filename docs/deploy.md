# Deploying Wipe Day

The game runs on the owner's VPS (Czechia `Vps3890`, 37.46.209.127) at
https://wipeday.patrikliska.dev, next to two other projects that must keep working (D68).

## Shape

- One Docker container, `wipeday`, built from this repo (`Dockerfile`): the API, which also
  serves the web build. Compose file: `deploy/compose.yml`, copied to `~/wipeday/compose.yml`.
- The existing Caddy (`tk-toolkit-caddy-1`, from `~/tk-toolkit`) owns ports 80/443 and TLS. The
  `wipeday` container joins its Docker network (`tk-toolkit_default`), and one block
  (`deploy/Caddyfile.wipeday`) appended to `~/tk-toolkit/Caddyfile` proxies the domain to
  `wipeday:8787`. Nothing in tk-toolkit is ever restarted or recreated: Caddy only reloads.
- State: `~/wipeday/var/wipeday.db` (SQLite) and `~/wipeday/var/backups/` (one online backup per
  day, the newest 14 kept, D54).
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
- The server is small (2 vCPU, 1.9 GB RAM, about 1 GB free): one container, no extra services.

## Discord developer portal (once)

Application (the bot's) -> OAuth2:
- Redirects: `https://wipeday.patrikliska.dev/api/auth/callback` and, for local development,
  `http://localhost:5173/api/auth/callback`.
- Client ID and Client Secret go into `~/wipeday/.env` on the server (and the local `.env`).

## Useful commands on the server

```sh
cd ~/wipeday && docker compose logs -f --tail=100   # the game's log
docker compose up -d --force-recreate wipeday       # after editing .env (restart does not re-read it)
ls ~/wipeday/var/backups                            # nightly backups
```

Copying the backups off the server (rclone or rsync from a cron job) is still to be set up (W9).
