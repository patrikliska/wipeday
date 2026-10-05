/**
 * Leaderboards by category (W5), so more than one way of playing can come first,
 * and the season card that sums up one player's season. Pure: the server hands
 * in every base of the season.
 */
import type { Content } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import type { BaseState } from "./base";
import { defence } from "./crew";
import { refValue } from "./goods";

export const CATEGORIES = ["wealth", "builder", "explorer", "trader", "lucky", "guard"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Entry {
  playerId: number;
  name: string;
  state: BaseState;
}

export interface Row {
  playerId: number;
  name: string;
  value: number;
  rank: number;
}

/** Everything the base holds at reference prices, in scrap: stock, inventory, listings. */
export function wealthOf(content: Content, state: BaseState): number {
  let sum = state.stock.scrap ?? 0;
  for (const [good, amount] of Object.entries(state.stock)) {
    if (good !== "scrap") sum += refValue(content, good, amount);
  }
  for (const [good, amount] of Object.entries(state.items)) sum += refValue(content, good, amount);
  for (const listing of state.listings) sum += refValue(content, listing.good, listing.amount);
  return sum;
}

/** Tier first (×1000), then every building level: what a screenshot of the base shows. */
export function builderScore(state: BaseState): number {
  const levels = Object.values(state.buildings).reduce((sum, level) => sum + level, 0);
  return TIERS.indexOf(state.tier) * 1000 + levels;
}

export function scoreOf(
  content: Content,
  category: Category,
  state: BaseState,
  now: number,
): number {
  switch (category) {
    case "wealth":
      return wealthOf(content, state);
    case "builder":
      return builderScore(state);
    case "explorer":
      return state.stats.sites.length;
    case "trader":
      return state.stats.traded;
    case "lucky":
      return state.stats.biggestWin;
    case "guard":
      return defence(content, state, now);
  }
}

/** One category, best first; ties share a rank. */
export function rank(content: Content, category: Category, entries: Entry[], now: number): Row[] {
  const rows = entries
    .map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      value: scoreOf(content, category, entry.state, now),
    }))
    .sort((a, b) => b.value - a.value || a.playerId - b.playerId);
  let previous: number | null = null;
  let current = 0;
  return rows.map((row, index) => {
    if (row.value !== previous) current = index + 1;
    previous = row.value;
    return { ...row, rank: current };
  });
}

export type Leaderboards = Record<Category, Row[]>;

export function leaderboards(content: Content, entries: Entry[], now: number): Leaderboards {
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, rank(content, category, entries, now)]),
  ) as Leaderboards;
}

/** One player's season so far: the card on the Ranks tab (and at the reset, from W7). */
export interface SeasonSummary {
  tier: Tier;
  /** Season day each tier was reached (1-based), for the ones reached. */
  tierDays: Partial<Record<Tier, number>>;
  sites: number;
  bestHaul: number;
  crew: number;
  traded: number;
  wagered: number;
  won: number;
  biggestWin: number;
  contracts: number;
  wealth: number;
  /** Rank in each category, and how many players there are. */
  ranks: Record<Category, number>;
  players: number;
}

export function seasonSummary(
  content: Content,
  state: BaseState,
  boards: Leaderboards,
  playerId: number,
  seasonStartedAt: number,
): SeasonSummary {
  const tierDays: Partial<Record<Tier, number>> = {};
  for (const [tier, at] of Object.entries(state.stats.reached) as [Tier, number][]) {
    tierDays[tier] = Math.floor((at - seasonStartedAt) / 86400) + 1;
  }
  const ranks = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      boards[category].find((row) => row.playerId === playerId)?.rank ?? 0,
    ]),
  ) as Record<Category, number>;
  return {
    tier: state.tier,
    tierDays,
    sites: state.stats.sites.length,
    bestHaul: state.stats.bestHaul,
    crew: state.crew.length,
    traded: state.stats.traded,
    wagered: state.stats.wagered,
    won: state.stats.won,
    biggestWin: state.stats.biggestWin,
    contracts: state.stats.contracts,
    wealth: wealthOf(content, state),
    ranks,
    players: boards.wealth.length,
  };
}
