/**
 * The demo game clock (see `@wipe-day/domain/clock`), used by demo mode and
 * the screenshot script. The live game follows the server's clock instead
 * (`net/http.ts`).
 *
 * The demo season starts at the epoch, so a timestamp is also "seconds into
 * the season"; the clock opens on day 4 at 09:00 and runs 240× faster. The
 * demo drawer and the screenshot script pause, speed up and jump it. Node
 * regrow runs on this clock too, so in demo mode it passes as fast as the day.
 */
import { type ScaledClock, scaledClock } from "@wipe-day/domain/clock";

const DAY = 86_400;

/** When the demo season began: the epoch, so shot scripts can write times as `day * 86400 + ...`. */
export const DEMO_SEASON_START = 0;

export const demoClocks: { game: ScaledClock } = {
  game: scaledClock({ start: DEMO_SEASON_START + 3 * DAY + 9 * 3600, scale: 240 }),
};
