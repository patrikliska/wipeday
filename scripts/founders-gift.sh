#!/usr/bin/env bash
# The founders' gift (R4 S3; D271; docs/deploy.md "The admin"): every player who had a season-1
# base gets the Founder skin and 5 crater glass held (never Glow), once. Runs on the VPS inside
# the API's container, over loopback with ADMIN_TOKEN from .env; each grant is keyed
# `founders:<player id>`, so running it twice changes nothing (the API replays the outcome).
#
#   ssh -i ~/.ssh/<key> vpsuser@37.46.209.127 'bash -s' < scripts/founders-gift.sh
#   DRY_RUN=1 ... prints the ids and stops.
#
# The ids come from the old game's last database, wipeday-pre-r2s7.db (`bases`), kept beside
# the live one in var/backups. A player who never had a season-1 base gets nothing.
set -euo pipefail

OLD_DB="${OLD_DB:-/app/var/backups/wipeday-pre-r2s7.db}"
CONTAINER="${CONTAINER:-wipeday}"

ids=$(docker exec -w /app/apps/api "$CONTAINER" node -e "
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1], { readonly: true });
  const rows = db.prepare('SELECT DISTINCT player_id AS id FROM bases ORDER BY player_id').all();
  console.log(rows.map((row) => row.id).join(' '));
" "$OLD_DB")

if [ -z "$ids" ]; then
  echo "no season-1 bases in $OLD_DB" >&2
  exit 1
fi
echo "season-1 players: $ids"
if [ "${DRY_RUN:-}" = "1" ]; then exit 0; fi

for id in $ids; do
  docker exec -w /app/apps/api "$CONTAINER" node_modules/.bin/tsx src/admin-cli.ts grant \
    --player "$id" --glass 5 --skin founder --note founders --key "founders:$id"
done
echo "done: $(echo "$ids" | wc -w) grants (each keyed founders:<id>, safe to run again)"
