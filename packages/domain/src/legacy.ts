/**
 * The legacy layer (W7): what a player keeps when the season resets, and what legacy points
 * buy. The server keeps one `Legacy` per player across seasons; a season's base gets a
 * `Carry` from it when it is created (`newBase`), and the reset folds the finished base back
 * in (`carryOver`).
 *
 * - Kept: blueprints found, each survivor's level and XP (they arrive the usual way, already
 *   at that level), the perks bought, titles and skins earned.
 * - Points: for playing a season, by place in each leaderboard category, and for a share of
 *   the Signal's gifts (`seasonPoints`). Spent any time; a perk applies at once
 *   (`buyPerk`, a server-only command: the points live in the server's legacy row).
 * - The cap: no perk tree makes a veteran more than `capPercent` stronger in any rate. The
 *   content check sums every perk at its top rank; a test walks every combination.
 */
import type { Content, Perk } from "@wipe-day/content/schema";
import { type BaseState, newSurvivor } from "./base";
import type { GameEvent } from "./events";
import type { Category } from "./leaderboard";
import { crewCap } from "./missions";

export interface Veteran {
  level: number;
  xp: number;
}

export interface Legacy {
  /** Points to spend, and points spent so far. */
  points: number;
  spent: number;
  /** Perk id -> rank bought. */
  perks: Record<string, number>;
  blueprints: string[];
  /** Survivor id -> the level and XP they come back with. */
  levels: Record<string, Veteran>;
  /** Earned: titles as `category:season` (or `signal:season`), skins by id. */
  titles: string[];
  skins: string[];
  /** Worn: one title, one skin (null: none, the plain holdfast). */
  title: string | null;
  skin: string | null;
  /** Seasons finished. */
  seasons: number;
}

export function newLegacy(): Legacy {
  return {
    points: 0,
    spent: 0,
    perks: {},
    blueprints: [],
    levels: {},
    titles: [],
    skins: [],
    title: null,
    skin: null,
    seasons: 0,
  };
}

/** Which season a base belongs to and its modifier. */
export interface SeasonInfo {
  number: number;
  startedAt: number;
  modifier: string | null;
}

/** What a new season's base starts with. */
export interface Carry {
  season: SeasonInfo;
  blueprints: string[];
  veterans: Record<string, Veteran>;
  perks: Record<string, number>;
  skin: string | null;
}

export function carryFor(legacy: Legacy, season: SeasonInfo): Carry {
  return {
    season,
    blueprints: [...legacy.blueprints],
    veterans: { ...legacy.levels },
    perks: { ...legacy.perks },
    skin: legacy.skin,
  };
}

export function perkOf(content: Content, id: string): Perk | undefined {
  return content.legacy.perks.find((perk) => perk.id === id);
}

/** What the next rank of `perk` costs, or null at the top. */
export function nextRankCost(perk: Perk, rank: number): number | null {
  return perk.cost[rank] ?? null;
}

/** The best veteran not in the crew yet: who an "old friend" brings home on day one. */
export function returningVeteran(
  content: Content,
  state: Pick<BaseState, "crew" | "veterans">,
): string | null {
  const best = Object.entries(state.veterans)
    .filter(([id]) => !state.crew.some((member) => member.id === id))
    .filter(([id]) => content.crew.some((member) => member.id === id))
    .sort((a, b) => b[1].xp - a[1].xp || a[0].localeCompare(b[0]))[0];
  return best ? best[0] : null;
}

// --- buying perks (server-only) ------------------------------------------------------

/** What the server knows of the player's legacy for one command. */
export interface LegacyView {
  points: number;
  titles: string[];
  skins: string[];
}

export type PerkStatus =
  | { code: "ok"; cost: number; rank: number }
  | { code: "unknown" }
  | { code: "perk_maxed" }
  | { code: "no_points"; need: number };

export function perkStatus(
  content: Content,
  state: BaseState,
  perkId: string,
  legacy: LegacyView,
): PerkStatus {
  const perk = perkOf(content, perkId);
  if (!perk) return { code: "unknown" };
  const rank = state.perks[perkId] ?? 0;
  const cost = nextRankCost(perk, rank);
  if (cost === null) return { code: "perk_maxed" };
  if (legacy.points < cost) return { code: "no_points", need: cost - legacy.points };
  return { code: "ok", cost, rank: rank + 1 };
}

/**
 * Buys the next rank of a perk; it applies at once. The options land now too: the old friend
 * walks in when there is room, the crate is in the yard. The server takes the points.
 */
export function buyPerk(
  content: Content,
  state: BaseState,
  perkId: string,
  legacy: LegacyView,
  now: number,
):
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<PerkStatus, { code: "ok" }> } {
  const status = perkStatus(content, state, perkId, legacy);
  if (status.code !== "ok") return { ok: false, status };
  const perk = perkOf(content, perkId);
  let next: BaseState = { ...state, perks: { ...state.perks, [perkId]: status.rank } };
  next = applyOptions(content, next, perk, now);
  return {
    ok: true,
    state: next,
    events: [{ type: "perk_bought", perk: perkId, rank: status.rank, cost: status.cost }],
  };
}

/** A perk's options, landing on `state` (at the season's start, or when bought). */
export function applyOptions(
  content: Content,
  state: BaseState,
  perk: Perk | undefined,
  now: number,
): BaseState {
  let next = state;
  if (perk?.crate) next = { ...next, items: { ...next.items, crate: (next.items.crate ?? 0) + 1 } };
  if (perk?.returning && next.crew.length < crewCap(content, next)) {
    const id = returningVeteran(content, next);
    if (id) next = { ...next, crew: [...next.crew, newSurvivor(content, id, now, next.veterans)] };
  }
  return next;
}

// --- cosmetics (server-only) -----------------------------------------------------------

export type CosmeticStatus = { code: "ok" } | { code: "not_earned" };

export function cosmeticStatus(
  legacy: LegacyView,
  change: { title?: string | null; skin?: string | null },
): CosmeticStatus {
  if (change.title && !legacy.titles.includes(change.title)) return { code: "not_earned" };
  if (change.skin && !legacy.skins.includes(change.skin)) return { code: "not_earned" };
  return { code: "ok" };
}

// --- the reset -------------------------------------------------------------------------

/** How a player finished a season, for the points and what was earned. */
export interface SeasonResult {
  season: number;
  /** Place in each category (1 = first); 0 when not ranked. */
  ranks: Partial<Record<Category, number>>;
  /** This player's share of the Signal's gifts, 0..1, and whether it was lit. */
  signalShare: number;
  signalLit: boolean;
  /** The biggest giver to the Signal. */
  signalTop: boolean;
}

export function seasonPoints(content: Content, result: SeasonResult): number {
  const { played, place, signal } = content.legacy.points;
  let points = played;
  for (const rank of Object.values(result.ranks)) {
    if (rank && rank > 0) points += place[rank - 1] ?? 0;
  }
  if (result.signalShare > 0) points += Math.max(1, Math.round(result.signalShare * signal));
  return points;
}

/** Folds a finished season into the legacy: what is kept, what was earned. */
export function carryOver(
  content: Content,
  legacy: Legacy,
  final: BaseState,
  result: SeasonResult,
): Legacy {
  const levels = { ...legacy.levels };
  for (const member of final.crew) {
    const kept = levels[member.id];
    if (!kept || member.xp > kept.xp) levels[member.id] = { level: member.level, xp: member.xp };
  }
  const titles = new Set(legacy.titles);
  for (const [category, rank] of Object.entries(result.ranks)) {
    if (rank === 1) titles.add(`${category}:${result.season}`);
  }
  if (result.signalTop) titles.add(`signal:${result.season}`);
  const seasons = legacy.seasons + 1;
  const skins = new Set(legacy.skins);
  for (const skin of content.legacy.skins) {
    if (skin.season !== undefined && seasons >= skin.season) skins.add(skin.id);
    if (skin.defended !== undefined && final.stats.defended >= skin.defended) skins.add(skin.id);
    if (skin.signal && result.signalLit) skins.add(skin.id);
  }
  return {
    ...legacy,
    points: legacy.points + seasonPoints(content, result),
    blueprints: [...new Set([...legacy.blueprints, ...final.blueprints])].sort(),
    levels,
    titles: [...titles],
    skins: [...skins],
    seasons,
  };
}
