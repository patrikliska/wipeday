/**
 * What to buy next. The simulator's buyer (docs/redesign/10-balance.md 2.2) and, from R1, the
 * advisor's crown share this logic, so the crown and the simulator agree.
 *
 * Greedy best payback with waiting: every purchase scores
 * `wait until affordable + cost ÷ added income` and the best one wins; the player buys it when it
 * is affordable and otherwise saves. An unmanned line's income counts only the share of the day
 * the player taps (their pace now, times the share of the day they are present); a hand counts
 * the rest. Shelf rows and eras are scored by what they add, in closed form: a Line Mk ×3 adds
 * twice its line's income; an island upgrade doubles every line and the flat tap; an era does too
 * and opens three lines, which count as much again (02 6.2 crowns the era before the hand); a
 * Grip rung doubles the flat tap and adds its share of the full rate. A Workshop level is scored
 * by what its one effect adds, in closed form per stat (`RESEARCH_GAINS`): every stat a Workshop
 * item may use has a gain, so every item can be crowned (game-design 5.12).
 * Rows still shut by a gate other than the price are not offered.
 */
import type { ScoredStat } from "@wipe-day/content/research";
import { isScored } from "@wipe-day/content/research";
import type { Content, LineDef, ResearchDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import type { Command } from "./commands";
import type { Conditions, Effect } from "./effects";
import { foldParts, rates, unitRate } from "./effects";
import { costFactor, costOf, eraOpen, handPriceOf, lineOf } from "./lines";
import { levelOf, levelsCost, workshopOpen } from "./research";
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
/** Each era's place on the ladder. */
const ERA_RANK: Readonly<Record<string, number>> = Object.fromEntries(
  TIERS.map((tier, i) => [tier, i]),
);
const AWAY: Conditions = { online: false };
const DAY = 86_400;

/**
 * Every purchase on offer with its score. `income` is the player's supplies a second now (taps
 * included), used for the wait; `pace` the share of the time they tap now, and `paceRate` their
 * taps a second (what a better tap is worth). What taps drive is scored over the player's day:
 * they are away `advisor.away` of it, when unmanned lines and taps stop and a hand still works
 * (D177), so a player tapping now is still crowned the hand for their best line.
 */
export function choices(
  content: Content,
  state: BaseState,
  now: number,
  income: number,
  pace: number,
  paceRate = 0,
): Choice[] {
  const present = 1 - content.run.advisor.away;
  const tapShare = pace * present;
  const tapRate = paceRate * present;
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
  /** Each owned line as if manned, a second (what a tap takes its share of). */
  const lineFull = new Map<string, number>();
  let lines = 0;
  for (const line of content.lines) {
    if (!eraOpen(state, line)) continue;
    const n = state.run.lines[line.id] ?? 0;
    const manned = state.run.hands.includes(line.id);
    const unit = unitRate(content, state, line, now, ONLINE);
    const earns = n * unit * (manned ? 1 : tapShare);
    lineIncome.set(line.id, earns);
    lineFull.set(line.id, n * unit);
    lines += earns;
    if (n < line.maxOwned) {
      const cost = costOf(line, n, 1, costFactor(content, state, line));
      // A line nobody owns or mans also counts as the way to its hand: its first unit plus the
      // hand earn a unit's income, so a player who does not tap is still led to new lines
      // (D177). Gain is scaled so the payback reads (unit + hand) ÷ income; the wait stays the
      // unit's own.
      const manning =
        n === 0 && !manned ? (unit * cost) / (cost + handPriceOf(content, state, line)) : 0;
      const gain = Math.max(unit * (manned ? 1 : tapShare), manning);
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
        : (lines + flatIncome) * (more - 1);
    offer(command, upgradeCost(content, state, upgrade), gain);
  }
  let fullNow = 0;
  for (const value of lineFull.values()) fullNow += value;
  const workshop: WorkshopContext = {
    content,
    state,
    now,
    lineIncome,
    lineFull,
    tapRate,
    tap,
    // The share of the full rate a tap takes, before Hustle (Grip's convention).
    tapShareOfFull: fullNow > 0 ? (tap.base - tap.flatValue) / fullNow : 0,
    open: [],
    inc: new Map(),
    away: null,
  };
  for (const line of content.lines) {
    if (eraOpen(state, line)) workshop.open.push({ line, weight: weightOf(workshop, line) });
  }
  // The gates of `researchGate`, inlined: this runs for every item on every call.
  const open = workshopOpen(content, state, now);
  const reached = ERA_RANK[state.run.era] ?? 0;
  for (const def of open ? content.research : []) {
    const n = levelOf(state, def.id);
    if (n >= def.levels || (ERA_RANK[def.era] ?? 0) > reached) continue;
    if (def.line !== undefined && (state.run.lines[def.line] ?? 0) < (def.needOwned[n] ?? 0))
      continue;
    offer(
      { type: "buy_research", item: def.id, count: 1 },
      levelsCost(def, n, 1),
      researchGain(workshop, def),
    );
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

/** What a Workshop level's gain is weighed against. */
interface WorkshopContext {
  content: Content;
  state: BaseState;
  now: number;
  lineIncome: ReadonlyMap<string, number>;
  lineFull: ReadonlyMap<string, number>;
  tapRate: number;
  tap: ReturnType<typeof tapParts>;
  tapShareOfFull: number;
  /** The open lines with their weight (`weightOf`), once per `choices` call. */
  open: { line: LineDef; weight: number }[];
  /** Memos for one `choices` call: each line's Σinc on output, and manned output while away. */
  inc: Map<string, number>;
  away: number | null;
}

/** Whether `effect`'s scope reaches `line`. */
const reaches = (effect: Effect, line: LineDef): boolean =>
  effect.scope === undefined ||
  effect.scope === "all" ||
  effect.scope === line.id ||
  effect.scope === line.era;

/** A line's income over the player's day, with the share a tap takes of it. */
function weightOf(ctx: WorkshopContext, line: LineDef): number {
  const own = ctx.lineIncome.get(line.id) ?? 0;
  const full = ctx.lineFull.get(line.id) ?? 0;
  return own + ctx.tapRate * ctx.tapShareOfFull * full;
}

/** Manned lines' production a second while the player is away. */
function mannedAway(ctx: WorkshopContext): number {
  if (ctx.away !== null) return ctx.away;
  let total = 0;
  for (const id of ctx.state.run.hands) {
    const line = lineOf(ctx.content, id);
    const n = ctx.state.run.lines[id] ?? 0;
    if (line && n > 0) total += n * unitRate(ctx.content, ctx.state, line, ctx.now, AWAY);
  }
  ctx.away = total;
  return total;
}

/** A line's Σinc on output now (what one more inc is shared with). */
function incOf(ctx: WorkshopContext, line: LineDef): number {
  const known = ctx.inc.get(line.id);
  if (known !== undefined) return known;
  const r = rates(ctx.content, ctx.state);
  const inc = foldParts("output", r.byStat.get("output") ?? [], { line }).inc;
  ctx.inc.set(line.id, inc);
  return inc;
}

/**
 * Supplies a second one more level adds, on average over the player's day, by stat. A `Record`
 * over every stat a Workshop item may use (`SCORED`), so a new one cannot ship without its gain.
 */
const RESEARCH_GAINS: Record<ScoredStat, (ctx: WorkshopContext, effect: Effect) => number> = {
  output(ctx, effect) {
    let gain = 0;
    for (const { line, weight } of ctx.open) {
      if (weight <= 0 || !reaches(effect, line)) continue;
      if (effect.op === "more") {
        gain += weight * (effect.value - 1);
        continue;
      }
      // An inc adds to the line's (1 + Σinc), shared with every other inc on it.
      gain += (weight * effect.value) / (1 + incOf(ctx, line));
    }
    return gain;
  },
  speed(ctx, effect) {
    let gain = 0;
    for (const { line, weight } of ctx.open) {
      if (reaches(effect, line)) gain += weight * (effect.value - 1);
    }
    return gain;
  },
  tap_flat(ctx, effect) {
    const { tap, tapRate } = ctx;
    if (effect.op === "more") return tapRate * tap.flatValue * (effect.value - 1);
    const r = rates(ctx.content, ctx.state);
    const parts = foldParts("tap_flat", r.byStat.get("tap_flat") ?? []);
    const base = (parts.best ?? ctx.content.tap.flat) + parts.add;
    return base > 0 ? (tapRate * tap.flatValue * effect.value) / base : 0;
  },
  hustle_max(ctx, effect) {
    const { hustle } = ctx.content.tap;
    const r = rates(ctx.content, ctx.state);
    const parts = foldParts("hustle_max", r.byStat.get("hustle_max") ?? []);
    const raw = ((parts.best ?? hustle.peak) + parts.add) * (1 + parts.inc) * parts.more;
    const lift =
      Math.min(hustle.peakCeiling, raw + effect.value) - Math.min(hustle.peakCeiling, raw);
    return (ctx.tapRate * ctx.tap.base * lift) / Math.max(1, ctx.tap.hustlePeak);
  },
  night_shift(ctx, effect) {
    const { content } = ctx;
    const { windowHours, maxHours } = content.run.nightShift;
    const r = rates(content, ctx.state);
    const parts = foldParts("night_shift", r.byStat.get("night_shift") ?? []);
    const hours = (add: number) =>
      Math.min(maxHours, ((parts.best ?? windowHours) + add) * (1 + parts.inc) * parts.more);
    // The player is away one stretch a day; a longer window pays only inside it.
    const stretch = content.run.advisor.away * DAY;
    const before = Math.min(hours(parts.add) * 3600, stretch);
    const after = Math.min(hours(parts.add + effect.value) * 3600, stretch);
    return (mannedAway(ctx) * (after - before)) / DAY;
  },
  offline(ctx, effect) {
    const r = rates(ctx.content, ctx.state);
    const stretch = ctx.content.run.advisor.away * DAY;
    return (mannedAway(ctx) * (effect.value - 1) * Math.min(r.nightShift, stretch)) / DAY;
  },
};

/** What the next level of `def` adds a second (0 for a stat the crown cannot score). */
function researchGain(ctx: WorkshopContext, def: ResearchDef): number {
  const effect = def.effect;
  return isScored(effect) ? RESEARCH_GAINS[effect.stat](ctx, effect) : 0;
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
export type CrownRule = "era" | "hand" | "best";

/** The advisor's pick inside a run: a purchase, or the tap hint (rule 7). */
export type Pick = { kind: "purchase"; rule: CrownRule; choice: Choice } | { kind: "tap" };

/** Lower score first; a tie goes to the cheaper purchase (02 11.1). */
export function byScore(a: Choice, b: Choice): number {
  if (a.score !== b.score) return a.score < b.score ? -1 : 1;
  return a.cost - b.cost;
}

/**
 * The crown inside a run (02-the-run.md 11.1; canon 12.5; first match wins). R1 has rules 2-4
 * and 7; the Big Red (R4), Blowback crates (R8) and the Toolbelt (R7) join with their phases.
 *
 * 2. The next era, when it is affordable within `saveSeconds` at the current income: it comes
 *    before the hand (Timber at 1.5k is crowned before Mara at 1.8k).
 * 3. The hand for the top-earning unmanned line, affordable within `saveSeconds`.
 * 4. The best purchase by score (the wait to afford it plus price ÷ added income), when it is
 *    affordable now. The income of an unmanned line or a Grip rung counts the player's own
 *    tapping, so an idle player is never crowned more of one (a new line's first unit, the way to
 *    its hand, may be). Ties go to the cheaper. While the best is
 *    still out of reach the player saves for it: the crown goes to the tap hint and nothing
 *    cheaper is crowned, or a crown-follower would spend every supply on small rows and never
 *    reach the next era (D177; 02 11.1 had "best payback affordable now").
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
  const best = bestScore(offered);
  return best?.affordable ? { kind: "purchase", rule: "best", choice: best } : { kind: "tap" };
}

/**
 * The expanded drawer's crown, a view of its own that always crowns one row (resolution 3.25):
 * the pick when it is a purchase, otherwise the best score (payback with the wait to afford it).
 */
export function sheetPick(pick: Pick, offered: readonly Choice[]): Choice | null {
  return pick.kind === "purchase" ? pick.choice : bestScore(offered);
}

/** The purchase with the best score, affordable or not; null when none adds anything. */
function bestScore(offered: readonly Choice[]): Choice | null {
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
    case "buy_research":
      return b.type === "buy_research" && a.item === b.item;
    case "buy_era":
      return b.type === "buy_era" && a.era === b.era;
    default:
      return false;
  }
}
