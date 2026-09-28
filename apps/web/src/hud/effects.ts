/**
 * A building level's effects as short lines ("+15% fibre", "+2000 room for
 * everything"), from the locale's `effect.*` templates. The same words on every
 * card, now and at the next level.
 */
import type { Effects } from "@wipe-day/content/schema";
import { abbrev, content, furnaceName, resourceName, t } from "../state/world";

export function effectLines(effects: Effects | undefined): string[] {
  if (!effects) return [];
  const lines: string[] = [];
  for (const [id, value] of Object.entries(effects.rates ?? {})) {
    lines.push(t("effect.rates", { value, what: resourceName(id).toLowerCase() }));
  }
  for (const [id, value] of Object.entries(effects.flat ?? {})) {
    lines.push(t("effect.flat", { value: abbrev(value), what: resourceName(id).toLowerCase() }));
  }
  const simple = [
    "allRates",
    "cap",
    "fuelPer100Ore",
    "smeltPercent",
    "craftPercent",
    "haulMinutes",
    "barrelLifeMinutes",
    "barrelEveryMinutes",
    "graceHours",
    "workbench",
  ] as const;
  for (const key of simple) {
    const value = effects[key];
    if (value !== undefined) {
      lines.push(t(`effect.${key}`, { value: key === "cap" ? abbrev(value) : value }));
    }
  }
  if (effects.furnace !== undefined) {
    const furnace = content.furnaces[effects.furnace - 1];
    if (furnace) lines.push(furnaceName(furnace.id));
  }
  return lines;
}
