/**
 * The island's clock and weather (docs/redesign/09-architecture.md 6.5; resolution 3.17). Pure
 * functions of a unix second and `island.json5`, so every friend on Saltmarsh sees the same sky
 * and the server checks rain's effect on flotsam. In R1 rain shortens the gap before the next
 * flotsam; effects with `when: rain` or `when: night` arrive with their nodes, and settle cuts
 * at weather blocks only once such an effect exists.
 */
import type { Content, Weather } from "@wipe-day/content/schema";
import { rng, SEED, seedOf } from "./rng";

/** The weather block `t` falls in: blocks start on whole multiples of blockMinutes (UTC). */
export function weatherBlock(content: Content, t: number): number {
  return Math.floor(t / (content.islandClock.weather.blockMinutes * 60));
}

/** The weather at second `t`: one seeded draw per block, by the island's shares. */
export function weatherAt(content: Content, t: number): Weather {
  const { seed, weather } = content.islandClock;
  const roll = rng(seedOf(seed, SEED.weather, weatherBlock(content, t))).next() * 100;
  if (roll < weather.clear) return "clear";
  if (roll < weather.clear + weather.rain) return "rain";
  return "fog";
}

/** The island's hour at `t` (0 ≤ h < 24): UTC plus its fixed offset, no daylight saving (E9). */
export function islandHour(content: Content, t: number): number {
  const seconds = t + content.islandClock.utcOffsetMinutes * 60;
  return (((seconds % 86_400) + 86_400) % 86_400) / 3600;
}
