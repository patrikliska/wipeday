/**
 * One tick per minute. The world is lazy, so the only job here is to notice
 * things that have an *end time* (base builds) and show their result without
 * waiting for the player to click: settle the base and re-render its home
 * message. Restart-safe: the first tick runs at boot and resolves everything
 * that ended while the bot was down.
 *
 * Message edits happen only here and in interactions, never on a loop that
 * edits unchanged messages: a tick that finds nothing edits nothing.
 */
import type { App } from "../app";
import { loadById } from "../game/actions";
import { log } from "../log";
import { basesRepo, playersRepo } from "../store/repo";

export const TICK_MS = 60_000;

export interface SchedulerHooks {
  /** Re-render the player's home message after a settle changed their base. */
  refreshHome: (app: App, playerId: number, now: number) => Promise<void>;
}

/** One pass. Returns the ids of players whose base changed. */
export async function tick(app: App, hooks: SchedulerHooks, now: number): Promise<number[]> {
  const changed: number[] = [];
  for (const playerId of basesRepo.withPendingEndsBefore(app.db, now)) {
    const player = playersRepo.byId(app.db, playerId);
    if (!player) continue;
    try {
      const loaded = loadById(app, player, now);
      if (loaded.settled.length === 0) continue;
      changed.push(playerId);
      await hooks.refreshHome(app, playerId, now);
    } catch (error) {
      log.error("scheduler: could not settle a base", {
        playerId,
        error: (error as Error).message,
      });
    }
  }
  return changed;
}

/** Starts the loop. Returns a stop function. */
export function startScheduler(app: App, hooks: SchedulerHooks): () => void {
  const run = () => {
    void tick(app, hooks, Math.floor(Date.now() / 1000)).then((changed) => {
      if (changed.length > 0) log.info("scheduler: resolved builds", { players: changed.length });
    });
  };
  run();
  const handle = setInterval(run, TICK_MS);
  return () => clearInterval(handle);
}
