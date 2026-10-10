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
import { costFactor, costOf, eraOpen, handPriceOf, lineOf } from "./lines";
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

/** How the player is playing right now: what the crown weighs purchases by. */
export interface Player {
  /** Supplies a second, taps included. */
  income: number;
  /** The share of the time the player taps (0..1). */
  tapShare: number;
  /** Taps a second over the last minute. */
  tapRate: number;
}

/** Which rule of 02-the-run.md 11.1 crowned a purchase. */
export type CrownRule = "era" | "hand" | "payback";

/** The advisor's pick inside a run: a purchase, or the tap hint (rule 7). */
export type Pick = { kind: "purchase"; rule: CrownRule; choice: Choice } | { kind: "tap" };

/** Lower score first; a tie goes to the cheaper purchase (02 11.1). */
export function byScore(a: Choice, b: Choice): number {
  if (a.score !== b.score) return a.score < b.score ? -1 : 1;
  return a.cost - b.cost;
}

const payback = (choice: Choice): number =>
  choice.gain > 0 ? choice.cost / choice.gain : Number.POSITIVE_INFINITY;

/**
 * The crown inside a run (02-the-run.md 11.1; canon 12.5; first match wins). R1 has rules 2-4
 * and 7; the Big Red (R2), Blowback crates (R6) and the Toolbelt (R5) join with their phases.
 *
 * 2. The next era, when it is affordable within `saveSeconds` at the current income: it comes
 *    before the hand (Timber at 1.5k is crowned before Mara at 1.8k).
 * 3. The hand for the top-earning unmanned line, affordable within `saveSeconds`.
 * 4. The best-payback purchase affordable now: least price ÷ added income, where the income of
 *    an unmanned line or a Grip rung counts the player's own tapping, so an idle player is never
 *    crowned one. Ties go to the cheaper.
 * 7. Otherwise the tap hint.
 */
export function crown(
  content: Content,
  state: BaseState,
  now: number,
  player: Player,
  offered = choices(content, state, now, player.income, player.tapShare, player.tapRate),
): Pick {
  const within = state.run.supplies + player.income * content.run.advisor.saveSeconds;
  const era = offered.find((choice) => choice.command.type === "buy_era");
  if (era && era.cost <= within) return { kind: "purchase", rule: "era", choice: era };
  let hand: Choice | null = null;
  let top = 0;
  for (const choice of offered) {
    if (choice.command.type !== "hire_hand") continue;
    const line = lineOf(content, choice.command.line);
    if (!line) continue;
    const n = state.run.lines[line.id] ?? 0;
    const earns = n * unitRate(content, state, line, now, ONLINE);
    if (earns > top || (earns === top && hand && choice.cost < hand.cost)) {
      top = earns;
      hand = choice;
    }
  }
  if (hand && hand.cost <= within) return { kind: "purchase", rule: "hand", choice: hand };
  let best: Choice | null = null;
  for (const choice of offered) {
    if (!choice.affordable || payback(choice) === Number.POSITIVE_INFINITY) continue;
    if (!best || payback(choice) < payback(best)) best = choice;
    else if (payback(choice) === payback(best) && choice.cost < best.cost) best = choice;
  }
  return best ? { kind: "purchase", rule: "payback", choice: best } : { kind: "tap" };
}

/**
 * The expanded drawer's crown, a view of its own that always crowns one row (resolution 3.25):
 * the pick when it is a purchase, otherwise the best score (payback with the wait to afford it).
 */
export function sheetPick(pick: Pick, offered: readonly Choice[]): Choice | null {
  if (pick.kind === "purchase") return pick.choice;
  let best: Choice | null = null;
  for (const choice of offered) {
    if (choice.score === Number.POSITIVE_INFINITY) continue;
    if (!best || byScore(choice, best) < 0) best = choice;
  }
  return best;
}

/** Whether two commands buy the same row (a line's count aside). */
export function sameRow(a: Command, b: Command): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "buy_line":
    case "hire_hand":
      return "line" in b && a.line === b.line;
    case "buy_upgrade":
      return b.type === "buy_upgrade" && a.upgrade === b.upgrade;
    case "buy_era":
      return b.type === "buy_era" && a.era === b.era;
    default:
      return false;
  }
}
