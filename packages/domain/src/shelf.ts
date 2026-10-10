/**
 * The shelf and the eras (docs/redesign/02-the-run.md 4.2, 5 and 6): what each row costs, what
 * keeps it shut, and the roster tiers a run has reached. The commands, the advisor and the
 * drawer share these, so a row's reason and the server's refusal never disagree.
 */
import type { Content, EraDef, UpgradeDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import { foldStat, rates } from "./effects";
import { eraOpen, lineOf } from "./lines";
import type { BaseState } from "./state";

/** What keeps a row shut, before the price (CLAUDE.md 6.3 rule 3: a real, reachable reason). */
export type Gate =
  /** The line's era is not reached yet. */
  | { kind: "era"; value: string }
  /** A Line Mk needs `value` of `line`; the run owns `have`. */
  | { kind: "owned"; value: number; line: string; have: number }
  /** The row before it on its ladder (D152). */
  | { kind: "previous"; value: string }
  /** Armored: opens after Wipe Day #`value`. */
  | { kind: "wipe_day"; value: number };

export function upgradeOf(content: Content, id: string): UpgradeDef | undefined {
  return content.upgrades.find((upgrade) => upgrade.id === id);
}

export const bought = (state: BaseState, id: string): boolean => state.run.upgrades.includes(id);

/** A shelf row's price after `upgrade_cost` discounts. */
export function upgradeCost(content: Content, state: BaseState, upgrade: UpgradeDef): Amount {
  return upgrade.cost * foldStat("upgrade_cost", rates(content, state).effects, 1);
}

/** Why `upgrade` cannot be bought yet, the price aside; null when only the price is left. */
export function upgradeGate(content: Content, state: BaseState, upgrade: UpgradeDef): Gate | null {
  if (upgrade.after !== undefined && !bought(state, upgrade.after))
    return { kind: "previous", value: upgrade.after };
  if (upgrade.line !== undefined) {
    const line = lineOf(content, upgrade.line);
    if (line && !eraOpen(state, line)) return { kind: "era", value: line.era };
    const have = state.run.lines[upgrade.line] ?? 0;
    const need = upgrade.needOwned ?? 0;
    if (have < need) return { kind: "owned", value: need, line: upgrade.line, have };
  }
  return null;
}

/** The era after the run's, if any. */
export function nextEra(content: Content, state: BaseState): EraDef | undefined {
  return content.eras[TIERS.indexOf(state.run.era) + 1];
}

/** An era's price after `era_cost` discounts. */
export function eraCost(content: Content, state: BaseState, era: EraDef): Amount {
  return era.cost * foldStat("era_cost", rates(content, state).effects, 1);
}

/** Why the next era cannot be bought yet, the price aside. */
export function eraGate(state: BaseState, era: EraDef): Gate | null {
  const need = era.requires?.wipeDays ?? 0;
  return state.meta.wipeDays < need ? { kind: "wipe_day", value: need } : null;
}

/**
 * Roster tiers reached: a tier counts when every line the era has opened owns its `at`, and
 * stays reached for the run (resolution 3.4), so buying an era never lowers income.
 */
export function rosterReached(content: Content, state: BaseState): number {
  const open = content.lines.filter((line) => eraOpen(state, line));
  const lowest = Math.min(...open.map((line) => state.run.lines[line.id] ?? 0));
  let reached = state.run.roster;
  const tiers = content.milestones.roster;
  while (reached < tiers.length && lowest >= (tiers[reached]?.at ?? Number.POSITIVE_INFINITY)) {
    reached += 1;
  }
  return reached;
}
