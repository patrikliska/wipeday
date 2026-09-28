/**
 * Nightly backups (D54): an online SQLite backup (consistent while the game
 * runs) into `backupDir/wipeday-YYYY-MM-DD.db`, keeping the newest 14. Copying
 * them off the server is a cron job on the host (docs/deploy.md; set up in W9).
 */
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./store/db";

export const KEEP_BACKUPS = 14;
const PATTERN = /^wipeday-\d{4}-\d{2}-\d{2}\.db$/;

/** The file name for the backup taken at `now` (UTC date). */
export function backupName(now: number): string {
  return `wipeday-${new Date(now * 1000).toISOString().slice(0, 10)}.db`;
}

/** Takes today's backup unless it exists, then prunes old ones. Returns the file written, if any. */
export async function backupOnce(db: Db, dir: string, now: number): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const name = backupName(now);
  const existing = readdirSync(dir)
    .filter((file) => PATTERN.test(file))
    .sort();
  let written: string | null = null;
  if (!existing.includes(name)) {
    written = join(dir, name);
    await db.$client.backup(written);
    existing.push(name);
    existing.sort();
  }
  for (const old of existing.slice(0, Math.max(0, existing.length - KEEP_BACKUPS))) {
    rmSync(join(dir, old), { force: true });
  }
  return written;
}
