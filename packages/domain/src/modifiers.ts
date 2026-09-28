/**
 * What the buildings add up to: one place that reads every building's level and
 * sums its effects (`buildings.json5`), so the rest of the domain asks
 * "how much room / how fast / which furnace" without knowing which building gives it.
 */
import type { Amounts, Content } from "@wipe-day/content/schema";
import type { BaseState } from "./base";

export interface Modifiers {
  /** Percent more of a resource from gathering (building-specific). */
  rates: Amounts;
  /** Percent more of every gathered resource. */
  allRates: number;
  /** Per hour, whatever the tool. */
  flat: Amounts;
  cap: number;
  fuelPer100Ore: number;
  smeltPercent: number;
  craftPercent: number;
  haulMinutes: number;
  barrelLifeMinutes: number;
  barrelEveryMinutes: number;
  graceHours: number;
  /** Highest crafting level any building gives; 0 = none. */
  workbench: number;
  /** Furnace type, 1-based; 0 = no furnace. */
  furnace: number;
}

const NONE: Modifiers = {
  rates: {},
  allRates: 0,
  flat: {},
  cap: 0,
  fuelPer100Ore: 0,
  smeltPercent: 0,
  craftPercent: 0,
  haulMinutes: 0,
  barrelLifeMinutes: 0,
  barrelEveryMinutes: 0,
  graceHours: 0,
  workbench: 0,
  furnace: 0,
};

/** Levels are replaced, never mutated, so the levels object identifies the result. */
const cache = new WeakMap<Record<string, number>, { content: Content; value: Modifiers }>();

export function modifiers(content: Content, state: Pick<BaseState, "buildings">): Modifiers {
  const hit = cache.get(state.buildings);
  if (hit && hit.content === content) return hit.value;
  const out: Modifiers = { ...NONE, rates: {}, flat: {} };
  for (const building of content.buildings) {
    const level = state.buildings[building.id] ?? 0;
    const effects = building.levels[level - 1]?.effects;
    if (!effects) continue;
    for (const [id, percent] of Object.entries(effects.rates ?? {})) {
      out.rates[id] = (out.rates[id] ?? 0) + percent;
    }
    for (const [id, perHour] of Object.entries(effects.flat ?? {})) {
      out.flat[id] = (out.flat[id] ?? 0) + perHour;
    }
    out.allRates += effects.allRates ?? 0;
    out.cap += effects.cap ?? 0;
    out.fuelPer100Ore += effects.fuelPer100Ore ?? 0;
    out.smeltPercent += effects.smeltPercent ?? 0;
    out.craftPercent += effects.craftPercent ?? 0;
    out.haulMinutes += effects.haulMinutes ?? 0;
    out.barrelLifeMinutes += effects.barrelLifeMinutes ?? 0;
    out.barrelEveryMinutes += effects.barrelEveryMinutes ?? 0;
    out.graceHours += effects.graceHours ?? 0;
    out.workbench = Math.max(out.workbench, effects.workbench ?? 0);
    out.furnace = Math.max(out.furnace, effects.furnace ?? 0);
  }
  cache.set(state.buildings, { content, value: out });
  return out;
}
