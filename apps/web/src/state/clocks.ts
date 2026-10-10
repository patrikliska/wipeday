/**
 * The client's two clocks (D138; docs/redesign/09-architecture.md 10.7).
 *
 * - `game`: the time the domain is given. Against the API it is the server-synced clock
 *   (`net/http.ts`); in demo mode it is `demoClocks.game`, which runs at 1× and jumps: +1 h,
 *   +6 h or to the next 08:00. A jump is time passing for everything the domain times (the
 *   Night Shift, Hustle, buffs), exactly as it would on the server.
 * - `wall`: real time at 1×, for animation only (sky drift, floaters, particles, later the
 *   cinematic). The domain never reads it, so a jump of the game clock never moves a
 *   real-second animation (rule 6.3.9). Shots pause and pin both separately.
 */
import { type ScaledClock, scaledClock } from "@wipe-day/domain/clock";

const HOUR = 3600;
const DAY = 86_400;

/** The demo starts on day 1 at 08:00 (UTC; shots render in UTC). */
export const DEMO_START = 8 * HOUR;

export const wall: ScaledClock = scaledClock({ start: Date.now() / 1000 });

export const demoClocks: { game: ScaledClock; wall: ScaledClock } = {
  game: scaledClock({ start: DEMO_START }),
  wall,
};

/** Seconds from `now` to the next 08:00 (UTC), never zero. */
export function untilNextMorning(now: number): number {
  const into = (((now - 8 * HOUR) % DAY) + DAY) % DAY;
  return DAY - into;
}

/** Moves the demo's game clock by `seconds`; the wall clock is untouched. */
export function jump(seconds: number): void {
  demoClocks.game.advance(seconds);
}

export const jumps = {
  hour: () => jump(HOUR),
  sixHours: () => jump(6 * HOUR),
  nextMorning: () => jump(untilNextMorning(demoClocks.game.now())),
};
