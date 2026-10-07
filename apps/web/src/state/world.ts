/**
 * The web client's window onto the shared content: the same data files and
 * locale the server uses, validated on load, plus presentation only (colours,
 * placeholder initials, number and time formatting). No balance numbers and no
 * rules live here: those are `@wipe-day/content` data and `@wipe-day/domain`.
 */
import activeFile from "@wipe-day/content/data/active.json5";
import baseTiersFile from "@wipe-day/content/data/base_tiers.json5";
import buildingsFile from "@wipe-day/content/data/buildings.json5";
import craftingFile from "@wipe-day/content/data/crafting.json5";
import crewFile from "@wipe-day/content/data/crew.json5";
import denFile from "@wipe-day/content/data/den.json5";
import eventsFile from "@wipe-day/content/data/events.json5";
import furnacesFile from "@wipe-day/content/data/furnaces.json5";
import itemsFile from "@wipe-day/content/data/items.json5";
import legacyFile from "@wipe-day/content/data/legacy.json5";
import nodesFile from "@wipe-day/content/data/nodes.json5";
import pacingFile from "@wipe-day/content/data/pacing.json5";
import raidsFile from "@wipe-day/content/data/raids.json5";
import recipesFile from "@wipe-day/content/data/recipes.json5";
import regionsFile from "@wipe-day/content/data/regions.json5";
import resourcesFile from "@wipe-day/content/data/resources.json5";
import seasonsFile from "@wipe-day/content/data/seasons.json5";
import sitesFile from "@wipe-day/content/data/sites.json5";
import toolsFile from "@wipe-day/content/data/tools.json5";
import traitsFile from "@wipe-day/content/data/traits.json5";
import { Locale, type LocaleArgs } from "@wipe-day/content/locale";
import en from "@wipe-day/content/locale/en.json";
import { initials, resourceInitials as lookInitials, resourceColor } from "@wipe-day/content/look";
import { parseContent } from "@wipe-day/content/parse";
import type { Amounts, Content, Item } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import { abbrev, duration, words as makeWords } from "@wipe-day/domain/words";

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
    "traits.json5": traitsFile,
    "regions.json5": regionsFile,
    "sites.json5": sitesFile,
    "events.json5": eventsFile,
    "crew.json5": crewFile,
    "recipes.json5": recipesFile,
    "crafting.json5": craftingFile,
    "nodes.json5": nodesFile,
    "active.json5": activeFile,
    "pacing.json5": pacingFile,
    "den.json5": denFile,
    "raids.json5": raidsFile,
    "legacy.json5": legacyFile,
    "seasons.json5": seasonsFile,
  },
  locale,
);

/** A player-visible string. */
export const t = (key: string, args?: LocaleArgs): string => locale.t(key, args);

/** Names, the feed's sentences and gain lines: shared with the Discord bot (W8). */
export const words = makeWords(locale, content);
export const { resourceName, itemName, tierName, outputName, regionName, siteName, survivorName } =
  words;
export const gainLines = words.gainLines;
export const toolName = (id: string): string => t(`tool.${id}.name`);
export const furnaceName = (id: string): string => t(`furnace.${id}.name`);
export const nodeName = (kind: string): string => t(`node.${kind}.name`);
export const taskName = (id: string): string => t(`task.${id}.name`);

export const itemById = new Map<string, Item>(content.items.map((item) => [item.id, item]));

/** Stations are buildings: the workbench, loom, campfire... */
export const stationName = (id: string): string => t(`building.${id}.name`);

export { initials, resourceColor };
export const resourceInitials = (id: string): string =>
  lookInitials(id) ?? initials(resourceName(id));

/** How a survivor looks, for the scene and the crew panel (their state is in the base). */
export interface SurvivorLook {
  id: string;
  name: string;
  /** Hat colour, the one thing that tells them apart until portraits exist. */
  hat: string;
  traits: string[];
  /** Fixed per survivor: clothes, hair and hat shape. */
  style: number;
}

const HATS: Record<string, string> = {
  mara: "#c85a2b",
  dax: "#4a7fb5",
  ivo: "#7fa043",
  rook: "#8a5ab0",
  sela: "#d8b24a",
  bram: "#6e5a3a",
  wren: "#3aa0a0",
  otto: "#b04a4a",
  juno: "#d87aa0",
  pike: "#4a6e4a",
  hale: "#e08a3a",
  tamsin: "#5a6ec8",
};

export function survivorLook(id: string): SurvivorLook {
  const index = content.crew.findIndex((member) => member.id === id);
  return {
    id,
    name: survivorName(id),
    hat: HATS[id] ?? "#a49e93",
    traits: content.crew[index]?.traits ?? [],
    style: Math.max(0, index),
  };
}

/** The wheel's segments and the slots' symbols (W5): one colour each, everywhere. */
const SEGMENT_COLOR: Record<string, string> = {
  gull: "#d8d2c4",
  crab: "#d9774a",
  anchor: "#4a7fb5",
  lighthouse: "#e3a32f",
  crown: "#45c2c0",
  tide: "#3b3832",
};
export const segmentColor = (id: string): string => SEGMENT_COLOR[id] ?? "#a49e93";

const SYMBOL_COLOR: Record<string, string> = {
  bolt: "#9aa0a6",
  gear: "#7d8a96",
  fish: "#6c97bc",
  anchor: "#4a7fb5",
  lantern: "#e3a32f",
  beacon: "#cd412b",
};
export const symbolColor = (id: string): string => SYMBOL_COLOR[id] ?? "#a49e93";

export const traitName = (id: string): string => t(`trait.${id}.name`);

export const GAME_DAY = 86_400;

export { abbrev, duration };

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

/** "2.1k stone" for the first missing resource, or null when nothing is missing. */
export function missingLabel(missing: Amounts): string | null {
  const first = Object.entries(missing).find(([, amount]) => amount > 0);
  if (!first) return null;
  return t("hud.need", { amount: abbrev(first[1]), what: outputName(first[0]).toLowerCase() });
}
