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

## Deploy

```sh
pnpm check && git commit ...   # deploy ships the committed HEAD
scripts/deploy.sh              # copy, build, restart, add the Caddy block once, health check
```

The script needs SSH access as `vpsuser` (`DEPLOY_HOST`, `DEPLOY_KEY` override the defaults).

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
