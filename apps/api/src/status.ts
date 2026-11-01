/**
 * The server's health (R4; docs/redesign/11-roadmap.md R2 "error reporting and /status"): what
 * `/api/status` reports and the owner's error DMs. A command that throws is counted and told to
 * the owner once per signature per hour; an off-site copy older than `STALE_COPY_HOURS` is told
 * once a day. The DM goes through the Discord bot's stream like a player's (`hub.broadcastBot`),
 * to the owner's Discord id, so nothing new reaches the bot.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const STALE_COPY_HOURS = 26;
const DAY = 86_400;

export interface StatusReport {
  version: string;
  uptimeSeconds: number;
  /** The newest nightly backup's name and time, if any. */
  lastBackup: { file: string; at: number } | null;
  /** The last off-site copy (`var/offsite.json`): when, and whether it succeeded. */
  lastOffsite: { at: number; ok: boolean; files: number } | null;
  /** Command errors in the last 24 h, with the newest few. */
  errors: { count: number; recent: { at: number; message: string }[] };
}

export interface StatusDeps {
  version: string;
  backupDir: string;
  /** The off-site job's status file (`deploy/offsite.sh` writes it). */
  offsiteFile: string;
  startedAt: number;
  /** Sends a DM to the owner; a no-op without an owner id. */
  tellOwner: (title: string, body: string) => void;
}

export class Status {
  private readonly errors: { at: number; message: string }[] = [];
  /** The last DM per error signature (a message with its numbers stripped). */
  private readonly told = new Map<string, number>();
  private staleToldAt = 0;

  constructor(private readonly deps: StatusDeps) {}

  /** A command threw: count it, and tell the owner once an hour per signature. */
  error(message: string, now: number): void {
    this.errors.push({ at: now, message });
    while (this.errors.length > 200) this.errors.shift();
    const signature = message.replace(/\d+/g, "#");
    const last = this.told.get(signature) ?? 0;
    if (now - last < 3600) return;
    this.told.set(signature, now);
    this.deps.tellOwner("Wipe Day: a command failed", message.slice(0, 500));
  }

  /** The scheduler's minute: a stale off-site copy is told once a day. */
  watch(now: number): void {
    const copy = this.offsite();
    const stale = copy === null || now - copy.at > STALE_COPY_HOURS * 3600;
    if (!stale || now - this.staleToldAt < DAY) return;
    this.staleToldAt = now;
    const when = copy ? `${Math.floor((now - copy.at) / 3600)} h ago` : "never";
    this.deps.tellOwner("Wipe Day: the off-site copy is stale", `The last copy was ${when}.`);
  }

  report(now: number): StatusReport {
    const since = now - DAY;
    const recent = this.errors.filter((row) => row.at >= since);
    return {
      version: this.deps.version,
      uptimeSeconds: now - this.deps.startedAt,
      lastBackup: this.lastBackup(),
      lastOffsite: this.offsite(),
      errors: { count: recent.length, recent: recent.slice(-5) },
    };
  }

  private lastBackup(): StatusReport["lastBackup"] {
    try {
      const files = readdirSync(this.deps.backupDir).filter((name) => name.endsWith(".db"));
      let best: StatusReport["lastBackup"] = null;
      for (const file of files) {
        const at = Math.floor(statSync(join(this.deps.backupDir, file)).mtimeMs / 1000);
        if (!best || at > best.at) best = { file, at };
      }
      return best;
    } catch {
      return null;
    }
  }

  private offsite(): StatusReport["lastOffsite"] {
    try {
      const parsed = JSON.parse(readFileSync(this.deps.offsiteFile, "utf8")) as {
        ok?: unknown;
        at?: unknown;
        files?: unknown;
      };
      const at =
        typeof parsed.at === "number"
          ? parsed.at
          : typeof parsed.at === "string"
            ? Math.floor(Date.parse(parsed.at) / 1000)
            : Number.NaN;
      if (!Number.isFinite(at)) return null;
      return {
        at,
        ok: parsed.ok === true,
        files: typeof parsed.files === "number" ? parsed.files : 0,
      };
    } catch {
      return null;
    }
  }
}
