/**
 * The news ticker's lines (12-feel.md 9.4): thirty one-liners in the locale under `ticker`, each
 * key naming when it is true: `any_*` always, `clear_*` on a clear day (sun lines: not at dusk
 * or night), `rain_*`, `fog_*` in that weather, `night_*` after dark, an era's id (`stone_1`) in that era, a hand's id (`mara_1`) while that
 * hand is on shift. Only true lines show, so the ticker never names what the player has not
 * reached (D140). Pure, so a test reads it without a browser.
 */
import type { Weather } from "@wipe-day/content/schema";
import type { BaseState } from "@wipe-day/domain/state";

/** Seconds each line stays. */
export const TICKER_SECONDS = 9;

/** The island's night for the ticker: 21:00 to 06:00. */
const isNight = (hour: number): boolean => hour >= 21 || hour < 6;
/** Daylight for the sun's lines: 07:00 to 19:00. */
const isDay = (hour: number): boolean => hour >= 7 && hour < 19;

/** The keys (`ticker.mara_1`) true now, in the locale's order. */
export function tickerKeys(
  keys: readonly string[],
  base: BaseState,
  weather: Weather,
  hour: number,
  hands: ReadonlyMap<string, string>,
): string[] {
  const on = new Set<string>(["any", base.run.era]);
  if (weather !== "clear" || isDay(hour)) on.add(weather);
  if (isNight(hour)) on.add("night");
  for (const line of base.run.hands) {
    const hand = hands.get(line);
    if (hand) on.add(hand);
  }
  return keys.filter((key) => on.has(key.replace(/_\d+$/, ""))).map((key) => `ticker.${key}`);
}

/**
 * The line shown in slot `slot` (the wall clock's 9-second count): each pass through the true
 * lines is a seeded shuffle, so no line repeats before the others have shown.
 */
export function tickerPick(lines: readonly string[], slot: number): string | null {
  const n = lines.length;
  if (n === 0) return null;
  const pass = Math.floor(slot / n);
  const order = lines.map((line, i) => ({ line, rank: hash(pass * 7919 + i * 104_729) }));
  order.sort((a, b) => a.rank - b.rank);
  return order[((slot % n) + n) % n]?.line ?? null;
}

/** A small integer hash (xorshift-multiply), stable across browsers. */
function hash(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}
