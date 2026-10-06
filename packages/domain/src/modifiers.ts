/**
 * What the buildings add up to: one place that reads every building's level and
 * sums its effects (`buildings.json5`), so the rest of the domain asks
 * "how much room / how fast / which furnace" without knowing which building gives it.
 *
 * W7: the legacy perks bought (`legacy.json5`, capped at 25% in any rate) and the season's
 * modifier (`seasons.json5`) add their effects here too.
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
  /** Room for more survivors. */
  crew: number;
  /** Furnace type, 1-based; 0 = no furnace. */
  furnace: number;
  /** Rings a scout reaches beyond the base tier's range. */
  scoutRange: number;
  /** Defence points against raids (W6). */
  defence: number;
  /** Hours more warning before NPC raiders land (W6). */
  warnHours: number;
  // W7: perks and the season's modifier.
  /** Percent more room for every resource. */
  capPercent: number;
  /** Points of success on every trip. */
  tripSuccess: number;
  /** Percent more crew XP from trips. */
  xpPercent: number;
  /** Percent more loot from every trip. */
  tripLoot: number;
  /** Percent stronger (negative: weaker) NPC raiders, and days more between raids. */
  raidStrength: number;
  raidDays: number;
  /** Loot rolls more per barrel. */
  barrelRolls: number;
  /** Percent more (or less) of the buildings' own production, by resource. */
  flatPercent: Amounts;
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
  crew: 0,
  furnace: 0,
  scoutRange: 0,
  defence: 0,
  warnHours: 0,
  capPercent: 0,
  tripSuccess: 0,
  xpPercent: 0,
  tripLoot: 0,
  raidStrength: 0,
  raidDays: 0,
  barrelRolls: 0,
  flatPercent: {},
};

/**
 * Levels and perks are replaced, never mutated, so the levels object (with the perks object
 * and the season's modifier) identifies the result.
 */
const cache = new WeakMap<
  Record<string, number>,
  { content: Content; perks: unknown; modifier: string | null; value: Modifiers }
>();

type Source = Pick<BaseState, "buildings"> & Partial<Pick<BaseState, "perks" | "season">>;

export function modifiers(content: Content, state: Source): Modifiers {
  const modifier = state.season?.modifier ?? null;
  const hit = cache.get(state.buildings);
  if (hit && hit.content === content && hit.perks === state.perks && hit.modifier === modifier)
    return hit.value;
  const out: Modifiers = { ...NONE, rates: {}, flat: {}, flatPercent: {} };
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
    out.crew += effects.crew ?? 0;
    out.furnace = Math.max(out.furnace, effects.furnace ?? 0);
    out.scoutRange += effects.scoutRange ?? 0;
    out.defence += effects.defence ?? 0;
    out.warnHours += effects.warnHours ?? 0;
  }
  // Legacy perks (W7): each rank adds its bonus.
  for (const perk of content.legacy.perks) {
    const rank = state.perks?.[perk.id] ?? 0;
    if (rank <= 0) continue;
    const { bonus } = perk;
    out.allRates += (bonus.allRates ?? 0) * rank;
    out.capPercent += (bonus.capPercent ?? 0) * rank;
    out.craftPercent += (bonus.craftPercent ?? 0) * rank;
    out.smeltPercent += (bonus.smeltPercent ?? 0) * rank;
    out.tripSuccess += (bonus.tripSuccess ?? 0) * rank;
    out.xpPercent += (bonus.xpPercent ?? 0) * rank;
  }
  // The season's modifier (W7).
  const season = content.seasons.modifiers.find((candidate) => candidate.id === modifier);
  if (season) {
    out.raidStrength += season.raidStrength ?? 0;
    out.raidDays += season.raidDays ?? 0;
    out.barrelEveryMinutes += season.barrelEveryMinutes ?? 0;
    out.barrelRolls += season.barrelRolls ?? 0;
    out.tripLoot += season.tripLoot ?? 0;
    for (const [id, percent] of Object.entries(season.flatPercent ?? {})) {
      out.flatPercent[id] = (out.flatPercent[id] ?? 0) + percent;
    }
  }
  cache.set(state.buildings, { content, perks: state.perks, modifier, value: out });
  return out;
}
