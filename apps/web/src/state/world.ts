/**
 * The web client's window onto the shared content: the same data files and
 * locale the server uses, validated on load, plus presentation only (colours,
 * placeholder initials, number and time formatting). No balance numbers and no
 * rules live here: those are `@wipe-day/content` data and `@wipe-day/domain`.
 */
import activeFile from "@wipe-day/content/data/active.json5";
import baseTiersFile from "@wipe-day/content/data/base_tiers.json5";
import buildingsFile from "@wipe-day/content/data/buildings.json5";
import crewFile from "@wipe-day/content/data/crew.json5";
import furnacesFile from "@wipe-day/content/data/furnaces.json5";
import itemsFile from "@wipe-day/content/data/items.json5";
import nodesFile from "@wipe-day/content/data/nodes.json5";
import pacingFile from "@wipe-day/content/data/pacing.json5";
import perksFile from "@wipe-day/content/data/perks.json5";
import recipesFile from "@wipe-day/content/data/recipes.json5";
import resourcesFile from "@wipe-day/content/data/resources.json5";
import toolsFile from "@wipe-day/content/data/tools.json5";
import { Locale, type LocaleArgs } from "@wipe-day/content/locale";
import en from "@wipe-day/content/locale/en.json";
import { parseContent } from "@wipe-day/content/parse";
import type { Amounts, Content, Item } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";

export { TIERS, type Tier };
export type ResourceId = string;
export type ItemId = string;
export type NodeKind = string;

/** Keys looked up but missing from the locale: shown as `⟦key⟧`, listed for the screenshot review. */
export const missingKeys = new Set<string>();

export const locale = Locale.fromObject(en, (key) => missingKeys.add(key));

/** The shared content, validated exactly as the server validates it. Throws on bad data. */
export const content: Content = parseContent(
  {
    "resources.json5": resourcesFile,
    "tools.json5": toolsFile,
    "base_tiers.json5": baseTiersFile,
    "furnaces.json5": furnacesFile,
    "items.json5": itemsFile,
    "buildings.json5": buildingsFile,
    "perks.json5": perksFile,
    "crew.json5": crewFile,
    "recipes.json5": recipesFile,
    "nodes.json5": nodesFile,
    "active.json5": activeFile,
    "pacing.json5": pacingFile,
  },
  locale,
);

/** A player-visible string. */
export const t = (key: string, args?: LocaleArgs): string => locale.t(key, args);

export const resourceName = (id: string): string => t(`resource.${id}.name`);
export const itemName = (id: string): string => t(`item.${id}.name`);
export const tierName = (id: string): string => t(`base_tier.${id}.name`);
export const toolName = (id: string): string => t(`tool.${id}.name`);
export const furnaceName = (id: string): string => t(`furnace.${id}.name`);
export const nodeName = (kind: string): string => t(`node.${kind}.name`);
export const taskName = (id: string): string => t(`task.${id}.name`);

export const itemById = new Map<string, Item>(content.items.map((item) => [item.id, item]));

/** Placeholder icon colours, until real art arrives. One per resource, used everywhere. */
const RESOURCE_COLOR: Record<string, string> = {
  timber: "#b07840",
  stone: "#9aa0a6",
  ore: "#8c6a4f",
  ingots: "#6c97bc",
  sulfur_ore: "#c9a227",
  sulfur: "#e3c04f",
  fibre: "#7fa043",
  hide: "#8a5a3c",
  fat: "#e8d9b0",
  fuel: "#c85a2b",
  scrap: "#a49e93",
};
export const resourceColor = (id: string): string => RESOURCE_COLOR[id] ?? "#a49e93";

/** Placeholder tile letters: fixed per resource, because "Iron Ore" and "Iron Ingots" share a word. */
const RESOURCE_INITIALS: Record<string, string> = {
  timber: "TI",
  stone: "ST",
  ore: "OR",
  ingots: "IN",
  sulfur_ore: "SO",
  sulfur: "SU",
  fibre: "FI",
  hide: "HI",
  fat: "FA",
  fuel: "FU",
  scrap: "SC",
};
export const resourceInitials = (id: string): string =>
  RESOURCE_INITIALS[id] ?? initials(resourceName(id));

/** Two letters for a placeholder tile: "Storage Crate" -> "SC". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
}

/** A crew member as the scene and the squad panel draw them. */
export interface Survivor {
  id: string;
  name: string;
  /** Hat colour, the one thing that tells them apart until portraits exist. */
  hat: string;
  perk: string;
  health: number;
}

const HATS: Record<string, string> = { mara: "#c85a2b", dax: "#4a7fb5", ivo: "#7fa043" };
export const SURVIVORS: Survivor[] = content.crew.map((member) => ({
  id: member.id,
  name: t(`crew.${member.id}.name`),
  hat: HATS[member.id] ?? "#a49e93",
  perk: member.perk,
  health: member.health,
}));

export const GAME_DAY = 86_400;

/** `12.4k`, `1.2M`: the one number formatter. Rounds toward zero. */
export function abbrev(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.trunc(Math.abs(amount));
  if (magnitude < 1000) return `${sign}${magnitude}`;
  const units = ["k", "M", "B"];
  let divisor = 1000;
  let unit = 0;
  while (magnitude / divisor >= 1000 && unit + 1 < units.length) {
    divisor *= 1000;
    unit += 1;
  }
  const whole = Math.floor(magnitude / divisor);
  const tenths = Math.floor((magnitude % divisor) / (divisor / 10));
  return whole >= 100 || tenths === 0
    ? `${sign}${whole}${units[unit]}`
    : `${sign}${whole}.${tenths}${units[unit]}`;
}

/** `2d 4h`, `3h 20m`, `45s`. */
export function duration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds / 3_600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

/** 0..1 through the day; 0 = midnight, 0.5 = noon. */
export function dayFraction(seconds: number): number {
  return (((seconds % GAME_DAY) + GAME_DAY) % GAME_DAY) / GAME_DAY;
}

export function clockLabel(seconds: number): string {
  const inDay = ((seconds % GAME_DAY) + GAME_DAY) % GAME_DAY;
  const hours = Math.floor(inDay / 3600);
  const minutes = Math.floor((inDay % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "+214 Timber" lines for the biggest few gains, biggest first. */
export function gainLines(gained: Amounts, limit: number): string[] {
  return Object.entries(gained)
    .filter(([, amount]) => amount >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, amount]) => `+${abbrev(amount)} ${resourceName(id)}`);
}

/** "2.1k stone" for the first missing resource, or null when nothing is missing. */
export function missingLabel(missing: Amounts): string | null {
  const first = Object.entries(missing).find(([, amount]) => amount > 0);
  if (!first) return null;
  return t("hud.need", { amount: abbrev(first[1]), what: resourceName(first[0]).toLowerCase() });
}
