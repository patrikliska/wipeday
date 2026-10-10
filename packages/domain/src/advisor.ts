/**
 * What to buy next. The simulator's buyer (docs/redesign/10-balance.md 2.2) and, from R1, the
 * advisor's crown share this logic, so the crown and the simulator agree.
 *
 * Greedy best payback with waiting: every purchase scores
 * `wait until affordable + cost ÷ added income` and the best one wins; the player buys it when it
 * is affordable and otherwise saves. An unmanned line's income counts only the share of the day
 * the player taps (`tapShare`); a hand counts the rest. Shelf rows and eras are scored by what
 * they add, in closed form: a Line Mk ×3 adds twice its line's income; an island upgrade doubles
 * every line and the flat tap; an era does too and opens three lines, which count as much again
 * (02 6.2 crowns the era before the hand); a Grip rung doubles the flat tap and adds its share of
 * the full rate.
 * Rows still shut by a gate other than the price are not offered.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import type { Command } from "./commands";
import type { Conditions } from "./effects";
import { unitRate } from "./effects";
import { costFactor, costOf, eraOpen, handPriceOf } from "./lines";
import { bought, eraCost, eraGate, nextEra, upgradeCost, upgradeGate } from "./shelf";
import type { BaseState } from "./state";
import { tapParts } from "./taps";

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
 * (taps included), used for the wait; `tapShare` the share of the day they tap, and `tapRate`
 * their taps a second over the whole day (what a better tap is worth).
 */
export function choices(
  content: Content,
  state: BaseState,
  now: number,
  income: number,
  tapShare: number,
  tapRate = 0,
): Choice[] {
  const supplies = state.run.supplies;
  const out: Choice[] = [];
  const score = (cost: number, gain: number): number => {
    if (gain <= 0) return Number.POSITIVE_INFINITY;
    const wait = cost <= supplies ? 0 : (cost - supplies) / Math.max(income, 1e-9);
    return wait + cost / gain;
  };
  const offer = (command: Command, cost: number, gain: number) =>
    out.push({ command, cost, gain, score: score(cost, gain), affordable: cost <= supplies });
  /** Each line's income over the player's day: a manned line always, an unmanned one while tapping. */
  const lineIncome = new Map<string, number>();
  let lines = 0;
  for (const line of content.lines) {
    if (!eraOpen(state, line)) continue;
    const n = state.run.lines[line.id] ?? 0;
    const manned = state.run.hands.includes(line.id);
    const unit = unitRate(content, state, line, now, ONLINE);
    const earns = n * unit * (manned ? 1 : tapShare);
    lineIncome.set(line.id, earns);
    lines += earns;
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
  const tap = tapParts(content, state, now);
  const flatIncome = tapRate * tap.flatValue;
  for (const upgrade of content.upgrades) {
    if (bought(state, upgrade.id) || upgradeGate(content, state, upgrade)) continue;
    const command: Command = { type: "buy_upgrade", upgrade: upgrade.id };
    let more = 1;
    let share = 0;
    for (const effect of upgrade.effects) {
      if (effect.op === "more") more *= effect.value;
      if (effect.stat === "tap_share" && effect.op === "add") share += effect.value;
    }
    const gain =
      upgrade.kind === "grip"
        ? tapRate * (tap.flatValue * (more - 1) + share * tap.fullValue)
        : upgrade.kind === "mk"
          ? (lineIncome.get(upgrade.line ?? "") ?? 0) * (more - 1)
          : (lines + flatIncome) * (more - 1);
    offer(command, upgradeCost(content, state, upgrade), gain);
  }
  const era = nextEra(content, state);
  if (era && !eraGate(state, era)) {
    let more = 1;
    for (const effect of era.effects) if (effect.op === "more") more *= effect.value;
    // The doubling, and as much again for the three lines it opens.
    offer(
      { type: "buy_era", era: era.id },
      eraCost(content, state, era),
      (lines + flatIncome) * more,
    );
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
  tapRate = 0,
): Choice | null {
  let best: Choice | null = null;
  for (const choice of choices(content, state, now, income, tapShare, tapRate)) {
    if (!best || choice.score < best.score) best = choice;
  }
  return best;
}

/** Whether anything at all is affordable now (N5, N6). */
export function anythingAffordable(content: Content, state: BaseState, now: number): boolean {
  return choices(content, state, now, 1, 0).some((choice) => choice.affordable);
}
