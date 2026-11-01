/**
 * What the island shows, as pure functions of the content and the run (so they are tested):
 * when an unowned line's plot appears, and which milestone a line just reached.
 */
import type { Content, LineDef } from "@wipe-day/content/schema";
import { costFactor, eraOpen } from "@wipe-day/domain/lines";
import type { BaseState } from "@wipe-day/domain/state";

/**
 * Whether an unowned line shows its staked plot: once its era is open. Twig's three appear one
 * by one, as the run first makes each price, so a new island is the beach and the pine
 * (rule 6.3.6); a later era's three appear together the moment it is bought (02-the-run.md 6.2).
 */
export function plotShown(content: Content, state: BaseState, line: LineDef): boolean {
  if (!eraOpen(state, line)) return false;
  return line.era !== "twig" || state.run.made >= line.cost * costFactor(content, state, line);
}

export interface Milestone {
  factor: number;
  /** A speed milestone (cycles twice as fast) rather than a payout one. */
  speed: boolean;
}

/** The milestone a line reaches at exactly `owned` units, or null (milestones.json5 `line`). */
export function milestoneAt(content: Content, owned: number): Milestone | null {
  for (const row of content.milestones.line) {
    if (row.at !== owned) continue;
    if (row.speed !== undefined) return { factor: row.speed, speed: true };
    return { factor: row.payout ?? 1, speed: false };
  }
  const every = content.milestones.lineEvery;
  if (owned >= every.from && (owned - every.from) % every.step === 0) {
    const special = every.special.find((row) => row.at === owned);
    return { factor: special?.payout ?? every.payout, speed: false };
  }
  return null;
}

/** The highest milestone crossed going from `before` to `after` owned, or null. */
export function milestoneCrossed(
  content: Content,
  before: number,
  after: number,
): Milestone | null {
  for (let n = after; n > before; n--) {
    const milestone = milestoneAt(content, n);
    if (milestone) return milestone;
  }
  return null;
}
