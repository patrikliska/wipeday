#!/usr/bin/env bash
# The off-server copy of the database backups (D54; docs/deploy.md, "Off-server backups").
#
# Runs on the VPS from vpsuser's crontab at 04:30 server time, after the API's nightly copy
# (00:00 UTC). rclone copies ~/wipeday/var/backups into the owner's encrypted remote (an rclone
# `crypt` remote over Google Drive, configured in ~/.config/rclone/rclone.conf):
#
#   pre/      every wipeday-pre-*.db (phase, season and cut-over copies), kept forever
#   nightly/  the dated nightly copies; the remote keeps the last 30 days of them
#
# It only ever copies, never syncs, so a broken or emptied backup folder on this box can never
# empty the remote. The result goes to ~/wipeday/var/offsite.json ({ok, at, files}) for the
# API's status page; a failed run exits 1 and says why in ~/wipeday/var/offsite.log.
set -uo pipefail

RCLONE="${RCLONE:-$HOME/bin/rclone}"
REMOTE="${OFFSITE_REMOTE:-wipeday-offsite:}"
DIR="${OFFSITE_SOURCE:-$HOME/wipeday/var/backups}"
STATUS="${OFFSITE_STATUS:-$HOME/wipeday/var/offsite.json}"
KEEP_NIGHTLY="${OFFSITE_KEEP_NIGHTLY:-30d}"

# One run at a time (a slow upload must not overlap the next night's).
exec 9>"${STATUS}.lock"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) offsite: another run is still going, skipped"
  exit 0
fi

ok=true
step() {
  if ! "$@"; then
    echo "$(date -u +%FT%TZ) offsite: failed: ${*:2:2}" >&2
    ok=false
  fi
}

step "$RCLONE" copy "$DIR" "${REMOTE}pre" --max-depth 1 --include "wipeday-pre-*.db"
step "$RCLONE" copy "$DIR" "${REMOTE}nightly" --max-depth 1 \
  --include "wipeday-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].db"
# Copies keep their original times, so the age is the backup's own age.
step "$RCLONE" delete "${REMOTE}nightly" --min-age "$KEEP_NIGHTLY"

files=$("$RCLONE" lsf -R --files-only "$REMOTE" 2>/dev/null | wc -l)
[ "$files" -gt 0 ] || ok=false

printf '{"ok":%s,"at":%s,"files":%s}\n' "$ok" "$(date +%s)" "$files" > "${STATUS}.tmp"
mv "${STATUS}.tmp" "$STATUS"
echo "$(date -u +%FT%TZ) offsite: ok=$ok files=$files"
[ "$ok" = true ]
