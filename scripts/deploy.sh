#!/usr/bin/env bash
# Deploys the committed HEAD to the VPS (D68). Safe to run again: it replaces ~/wipeday/src,
# rebuilds the image and restarts only the wipeday container. The shared Caddy (tk-toolkit) is
# touched once: the wipeday block is appended if missing, validated, then Caddy reloads in place.
set -euo pipefail

HOST="${DEPLOY_HOST:-vpsuser@37.46.209.127}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/claude_temp_key}"
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit first: deploy ships HEAD, not the working tree." >&2
  exit 1
fi

echo "==> copying $(git rev-parse --short HEAD) to $HOST:~/wipeday/src"
git archive --format=tar HEAD | "${SSH[@]}" \
  'rm -rf ~/wipeday/src && mkdir -p ~/wipeday/src ~/wipeday/var && tar -x -C ~/wipeday/src'

echo "==> building and starting the containers"
# The Discord bot (W8) starts only once the owner has put its secrets into ~/wipeday/.env.
"${SSH[@]}" 'set -e
  cd ~/wipeday && cp src/deploy/compose.yml compose.yml && touch .env
  install -m 755 src/deploy/offsite.sh offsite.sh   # the off-server copy, run by cron
  if grep -q "^DISCORD_TOKEN=." .env && grep -q "^DISCORD_GUILD_ID=." .env \
    && grep -q "^BOT_API_TOKEN=." .env; then
    docker compose --profile bot up -d --build
  else
    docker compose up -d --build
    echo "bot not started: DISCORD_TOKEN, DISCORD_GUILD_ID and BOT_API_TOKEN are not all in .env"
  fi
  docker image prune -f >/dev/null'

echo "==> Caddy"
"${SSH[@]}" 'set -e
  caddyfile=~/tk-toolkit/Caddyfile
  if ! grep -q "wipeday.patrikliska.dev" "$caddyfile"; then
    cp "$caddyfile" "$caddyfile.bak-wipeday"
    # Append in place (>>): the file is bind-mounted into the container by inode.
    cat ~/wipeday/src/deploy/Caddyfile.wipeday >> "$caddyfile"
    if ! docker exec tk-toolkit-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
      cp "$caddyfile" "$caddyfile.rejected"
      cat "$caddyfile.bak-wipeday" > "$caddyfile"
      echo "Caddy rejected the new block; the old Caddyfile is back." >&2
      exit 1
    fi
    docker exec tk-toolkit-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    echo "wipeday block added and Caddy reloaded"
  else
    echo "wipeday block already present"
  fi'

echo "==> health"
sleep 5
"${SSH[@]}" 'docker exec wipeday node -e "fetch(\"http://localhost:8787/api/health\").then((r) => r.text()).then(console.log)"'
echo "done: https://wipeday.patrikliska.dev"
