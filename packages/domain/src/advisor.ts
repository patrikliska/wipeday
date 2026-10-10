/**
 * What to buy next. The simulator's buyer (docs/redesign/10-balance.md 2.2) and, from R1, the
 * advisor's crown share this logic, so the crown and the simulator agree.
 *
 * Greedy best payback with waiting: every purchase scores
 * `wait until affordable + cost ÷ added income` and the best one wins; the player buys it when it
 * is affordable and otherwise saves. An unmanned line's income counts only the share of the day
 * the player taps (`tapShare`); a hand counts the rest. R1 adds the shelf, eras and milestones.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import type { Command } from "./commands";
import type { Conditions } from "./effects";
import { unitRate } from "./effects";
import { costFactor, costOf, eraOpen, handPriceOf } from "./lines";
import type { BaseState } from "./state";

export interface Choice {
  command: Command;
  cost: Amount;
  /** Supplies a second it adds, on average over the player's day. */
  gain: number;
  /** Seconds: wait until affordable plus payback. Lower is better. */
  score: number;
  affordable: boolean;
}

const ONLINE: Conditions = { online: true };

/**
 * Every purchase on offer with its score. `income` is the player's average supplies a second
 * (taps included), used for the wait; `tapShare` the share of the day they tap.
 */
export function choices(
  content: Content,
  state: BaseState,
  now: number,
  income: number,
  tapShare: number,
): Choice[] {
  const supplies = state.run.supplies;
  const out: Choice[] = [];
  const score = (cost: number, gain: number): number => {
    if (gain <= 0) return Number.POSITIVE_INFINITY;
    const wait = cost <= supplies ? 0 : (cost - supplies) / Math.max(income, 1e-9);
    return wait + cost / gain;
  };
  for (const line of content.lines) {
    if (!eraOpen(state, line)) continue;
    const n = state.run.lines[line.id] ?? 0;
    const manned = state.run.hands.includes(line.id);
    const unit = unitRate(content, state, line, now, ONLINE);
    if (n < line.maxOwned) {
      const cost = costOf(line, n, 1, costFactor(content, state, line));
      const gain = unit * (manned ? 1 : tapShare);
      out.push({
        command: { type: "buy_line", line: line.id, count: 1 },
        cost,
        gain,
        score: score(cost, gain),
        affordable: cost <= supplies,
      });
    }
    if (!manned && n > 0) {
      const cost = handPriceOf(content, state, line);
      const gain = n * unit * (1 - tapShare);
      out.push({
        command: { type: "hire_hand", line: line.id },
        cost,
        gain,
        score: score(cost, gain),
        affordable: cost <= supplies,
      });
    }
  }
  return out;
}

/** The best purchase by score, affordable or not; null when nothing is on offer. */
export function bestPurchase(
  content: Content,
  state: BaseState,
  now: number,
  income: number,
  tapShare: number,
): Choice | null {
  let best: Choice | null = null;
  for (const choice of choices(content, state, now, income, tapShare)) {
    if (!best || choice.score < best.score) best = choice;
  }
  return best;
}

/** Whether anything at all is affordable now (N5, N6). */
export function anythingAffordable(content: Content, state: BaseState, now: number): boolean {
  return choices(content, state, now, 1, 0).some((choice) => choice.affordable);
}
