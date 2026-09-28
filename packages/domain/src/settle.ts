/**
 * Brings a base up to `now`: builds land, upkeep is paid (or decay starts),
 * crafts land, the barrel washes up or drifts off, the task day rolls over, an
 * abandoned node run ends and worked-out nodes stand again. Every command runs
 * this first, and a plain look at the base (`GET /state`) runs only this.
 * Idempotent: settling twice at the same instant changes nothing the second time.
 */
import type { Content } from "@wipe-day/content/schema";
import { settleBarrel, settleTasks } from "./active";
import { type BaseState, settle } from "./base";
import { settleCrafts } from "./craft";
import type { GameEvent } from "./events";
import { settleNodes } from "./nodes";

export function settleAll(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const base = settle(content, state, now);
  events.push(...base.events);
  const crafts = settleCrafts(base.state, now);
  events.push(...crafts.events);
  const barrel = settleBarrel(content, crafts.state, now);
  events.push(...barrel.events);
  const tasks = settleTasks(content, barrel.state, now);
  const nodes = settleNodes(content, tasks, now);
  events.push(...nodes.events);
  return { state: nodes.state, events };
}

/** The next moment settling would change something on its own, for the server's timer. */
export function nextEventAt(state: BaseState): number | null {
  const times = [
    state.build?.endsAt,
    state.craftQueue[0]?.endsAt,
    state.barrel ? state.barrel.expiresAt : state.nextBarrelAt,
  ].filter((time): time is number => time !== undefined);
  return times.length > 0 ? Math.min(...times) : null;
}
