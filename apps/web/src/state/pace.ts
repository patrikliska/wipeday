/**
 * The player's own pace over the last minute (02-the-run.md 11.1): the crown weighs a purchase
 * that pays only while tapping (an unmanned line, a Grip rung) by how this player taps, so an
 * idle player is never crowned one. Counted on the wall clock, per whole second.
 */
const WINDOW_SECONDS = 60;
/** A short session is measured over at least this long, so one tap is not "6 a second". */
const MIN_WINDOW_SECONDS = 5;

/** Taps per wall second, for the last minute. */
const perSecond = new Map<number, number>();
let firstSecond: number | null = null;

/** `count` taps landed at `nowMs` (wall). */
export function noteTaps(count: number, nowMs: number): void {
  if (count <= 0) return;
  const second = Math.floor(nowMs / 1000);
  firstSecond ??= second;
  perSecond.set(second, (perSecond.get(second) ?? 0) + count);
  for (const key of perSecond.keys()) if (key <= second - WINDOW_SECONDS) perSecond.delete(key);
}

export interface Pace {
  /** Taps a second over the window. */
  tapRate: number;
  /** The share of the window's seconds with a tap in them (0..1). */
  tapShare: number;
}

/** The pace at `nowMs` (wall). */
export function pace(nowMs: number): Pace {
  const second = Math.floor(nowMs / 1000);
  if (firstSecond === null) return { tapRate: 0, tapShare: 0 };
  const length = Math.min(WINDOW_SECONDS, Math.max(MIN_WINDOW_SECONDS, second - firstSecond + 1));
  let taps = 0;
  let active = 0;
  for (const [key, count] of perSecond) {
    if (key <= second - length || key > second) continue;
    taps += count;
    active += 1;
  }
  return { tapRate: taps / length, tapShare: Math.min(1, active / length) };
}

/** Shots and tests: as if the player had tapped `tapsPerSecond` for the last minute. */
export function seedPace(tapsPerSecond: number, nowMs: number): void {
  perSecond.clear();
  firstSecond = null;
  if (tapsPerSecond <= 0) return;
  const second = Math.floor(nowMs / 1000);
  firstSecond = second - WINDOW_SECONDS + 1;
  for (let key = firstSecond; key <= second; key++) perSecond.set(key, tapsPerSecond);
}
