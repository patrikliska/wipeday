/**
 * Brings a base up to `now`: builds land, upkeep is paid (or decay starts),
 * crafts land, the barrel washes up or drifts off, the task day rolls over, an
 * abandoned node run ends, worked-out nodes stand again and raiders land (W6). Every
 * command runs this first, and a plain look at the base (`GET /state`) runs only this.
 * Idempotent: settling twice at the same instant changes nothing the second time.
 */
import type { Content } from "@wipe-day/content/schema";
import { settleBarrel, settleTasks } from "./active";
import { type BaseState, settle } from "./base";
import { nextWheelAt, settleWheel } from "./casino";
import { settleContracts } from "./contracts";
import { nextCraftAt, settleCrafts } from "./craft";
import { settleDen } from "./den";
import type { GameEvent } from "./events";
import { nextListingAt, settleListings } from "./market";
import { nextMissionAt, settleArrivals, settleMissions } from "./missions";
import { settleNodes } from "./nodes";
import { nextRaidAt, resolveRaid, settleRaidWarning } from "./raids";
import { recordStats } from "./stats";
import type { World } from "./world";

export function settleAll(
  content: Content,
  state: BaseState,
  now: number,
  world?: World,
): { state: BaseState; events: GameEvent[] } {
  // W6: a raid that landed since the last settle meets the base as it stood at that moment,
  // so settling splits there. Only commands plan raids, so this runs at most once.
  const events: GameEvent[] = [];
  let current = state;
  while (current.raid && current.raid.at <= now) {
    const at = current.raid.at;
    const before = settleSpan(content, current, at, world);
    const landed = resolveRaid(content, before.state);
    events.push(...before.events, ...landed.events);
    current = recordStats(landed.state, landed.events, at);
  }
  const rest = settleSpan(content, current, now, world);
  const warned = settleRaidWarning(content, rest.state, now);
  events.push(...rest.events, ...warned.events);
  return { state: warned.state, events };
}

/** Everything but the raids, brought up to `now`. */
function settleSpan(
  content: Content,
  state: BaseState,
  now: number,
  world?: World,
): { state: BaseState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const base = settle(content, state, now);
  events.push(...base.events);
  const crafts = settleCrafts(content, base.state, now);
  events.push(...crafts.events);
  const missions = settleMissions(content, crafts.state, now);
  events.push(...missions.events);
  const arrivals = settleArrivals(content, missions.state, now);
  events.push(...arrivals.events);
  const barrel = settleBarrel(content, arrivals.state, now);
  events.push(...barrel.events);
  const tasks = settleTasks(content, barrel.state, now);
  const nodes = settleNodes(content, tasks, now);
  events.push(...nodes.events);
  // The Den (W5): listings run out, the counter restocks, contracts roll, the wheel spins.
  const listings = settleListings(content, nodes.state, now);
  events.push(...listings.events);
  const den = settleContracts(content, settleDen(content, listings.state, now), now);
  const wheel = settleWheel(content, den, now, world?.reveal);
  events.push(...wheel.events);
  return { state: recordStats(wheel.state, events, now), events };
}

/** The next moment settling would change something on its own, for the server's timer. */
export function nextEventAt(
  content: Content,
  state: BaseState,
  options: { wheel?: boolean } = {},
): number | null {
  const times = [
    nextListingAt(state) ?? undefined,
    // The client leaves the wheel out: it cannot spin, it waits for the server's push.
    options.wheel === false ? undefined : (nextWheelAt(content, state) ?? undefined),
    ...state.construction.map((job) => job.endsAt),
    nextCraftAt(state) ?? undefined,
    nextMissionAt(state) ?? undefined,
    state.nextArrivalAt,
    state.barrel ? state.barrel.expiresAt : state.nextBarrelAt,
    nextRaidAt(content, state) ?? undefined,
  ].filter((time): time is number => time !== undefined);
  return times.length > 0 ? Math.min(...times) : null;
}
