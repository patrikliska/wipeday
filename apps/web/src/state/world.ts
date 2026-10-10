/**
 * The shared content and words for the browser: the same data files and locale the server
 * loads, validated by the same `parseContent`, imported through Vite (JSON5 plugin) instead of
 * read from disk. Plus presentation helpers that belong to no rule: colours, time of day.
 *
 * Every data file must be imported here: a missing one is a `ContentError` at load.
 */
import crewFile from "@wipe-day/content/data/crew.json5";
import erasFile from "@wipe-day/content/data/eras.json5";
import flotsamFile from "@wipe-day/content/data/flotsam.json5";
import islandFile from "@wipe-day/content/data/island.json5";
import linesFile from "@wipe-day/content/data/lines.json5";
import milestonesFile from "@wipe-day/content/data/milestones.json5";
import pacingFile from "@wipe-day/content/data/pacing.json5";
import prestigeFile from "@wipe-day/content/data/prestige.json5";
import resourcesFile from "@wipe-day/content/data/resources.json5";
import targetsFile from "@wipe-day/content/data/targets.json5";
import toolsFile from "@wipe-day/content/data/tools.json5";
import upgradesFile from "@wipe-day/content/data/upgrades.json5";
import { Locale, type LocaleArgs } from "@wipe-day/content/locale";
import en from "@wipe-day/content/locale/en.json";
import { initials, resourceInitials as lookInitials, resourceColor } from "@wipe-day/content/look";
import { parseContent } from "@wipe-day/content/parse";
import type { Content } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import { duration, words as makeWords } from "@wipe-day/domain/words";

export { TIERS, type Tier };

/** Keys looked up but missing from the locale: shown as `⟦key⟧`, listed for the screenshot review. */
export const missingKeys = new Set<string>();

export const locale = Locale.fromObject(en, (key) => missingKeys.add(key));

/** The shared content, validated exactly as the server validates it. Throws on bad data. */
export const content: Content = parseContent(
  {
    "resources.json5": resourcesFile,
    "crew.json5": crewFile,
    "tools.json5": toolsFile,
    "lines.json5": linesFile,
    "prestige.json5": prestigeFile,
    "targets.json5": targetsFile,
    "eras.json5": erasFile,
    "upgrades.json5": upgradesFile,
    "milestones.json5": milestonesFile,
    "flotsam.json5": flotsamFile,
    "island.json5": islandFile,
    "pacing.json5": pacingFile,
  },
  locale,
);

/** A player-visible string. */
export const t = (key: string, args?: LocaleArgs): string => locale.t(key, args);

/** Names and numbers, shared with the Discord bot (W8). Scientific notation arrives in R1. */
export const words = makeWords(locale, content);
export const { fmt, fmtRate, fmtCount, resourceName, crewName, lineName, tierName } = words;

export { duration, initials, resourceColor };
export const resourceInitials = (id: string): string =>
  lookInitials(id) ?? initials(resourceName(id));

/** How a hand looks in the scene (their state is in the base). */
export interface SurvivorLook {
  id: string;
  name: string;
  /** Hat colour, the one thing that tells them apart until portraits exist. */
  hat: string;
  traits: string[];
  /** Fixed per hand: clothes, hair and hat shape. */
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
  gus: "#8c6a4f",
  vera: "#9be564",
};

export function survivorLook(id: string): SurvivorLook {
  const index = content.crew.findIndex((member) => member.id === id);
  return {
    id,
    name: crewName(id),
    hat: HATS[id] ?? "#a49e93",
    traits: [],
    style: Math.max(0, index),
  };
}

export const GAME_DAY = 86_400;

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
