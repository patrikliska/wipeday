/**
 * The two clocks the prototype injects into its store (see `@wipe-day/domain/clock`).
 *
 * - `game` drives accrual, builds, furnaces, barrels and the day cycle. Here it
 *   is a demo clock: the demo season starts at the epoch (so a timestamp is also
 *   "seconds into the season"), the clock opens on day 4 at 09:00 and runs 240×
 *   faster. The demo drawer and the screenshot script pause, speed up and jump it.
 *   W1 replaces it with server time.
 * - `wall` is real time for active-play timers (node regrow), which must not
 *   speed up with the demo. Also a scaled clock (at 1×) so screenshots can pin it.
 */
import { type Clock, type ScaledClock, scaledClock, systemClock } from "@wipe-day/domain/clock";
import { GAME_DAY } from "./world";

export interface WorldClocks {
  game: Clock;
  wall: Clock;
}

/** When the demo season began: the epoch, so shot scripts can write times as `day * 86400 + ...`. */
export const DEMO_SEASON_START = 0;

export const demoClocks: { game: ScaledClock; wall: ScaledClock } = {
  game: scaledClock({ start: DEMO_SEASON_START + 3 * GAME_DAY + 9 * 3600, scale: 240 }),
  wall: scaledClock({ start: systemClock.now() }),
};
