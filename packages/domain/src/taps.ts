/**
 * The taps batch on the server (D134; docs/redesign/09-architecture.md 6.3). The client sends
 * `{count, from, to}` (whole seconds) for at most 1 s or 30 taps; the server:
 *
 * 1. clamps the times to its own clock and the bucket's last refill, so they never run ahead
 *    of `now` and never move back;
 * 2. refills the bucket (perSecond a second, at most `burst`) and credits at most its whole
 *    tokens, so over any interval at most burst + perSecond × elapsed taps count (N10);
 * 3. raises Hustle per credited tap (after its grace and drain);
 * 4. values each tap: (flat × global + p × fullRate) × T × Hustle × Afterglow × crit, crits
 *    seeded by the tap's index so the client predicts them;
 * 5. fells the era's target every `fellTaps` credited taps: each fell pays `fellBonusTaps`
 *    taps' worth at the felling tap's Hustle, without a crit (02-the-run.md 7.5);
 * 6. starts a cycle on each unmanned line that is idle (busy-until): the cycles that ended by
 *    `now` pay at once, the one still in flight pays when settle passes its `readyAt`.
 *
 * Pure: state and `now` in, state and events out.
 */
import type { Content } from "@wipe-day/content/schema";
import { finite } from "./amount";
import {
  buffEffects,
  type Conditions,
  cycleOf,
  foldStat,
  fullRate,
  type Rates,
  rates,
  type StatId,
} from "./effects";
import type { GameEvent } from "./events";
import { rng, SEED, seedOf } from "./rng";
import { cyclePayout } from "./settle";
import type { BaseState } from "./state";

export interface TapsBatch {
  count: number;
  from: number;
  to: number;
}

/** Hustle's multiplier at meter value `h` (0..cap). */
export function hustleFactor(h: number, cap: number, peak: number): number {
  return 1 + (Math.min(h, cap) / cap) * (peak - 1);
}

/** Afterglow on taps at `t`: 1 in run 1, then ×start halving every halfSeconds (N20). */
export function afterglowAt(content: Content, state: BaseState, t: number): number {
  const from = state.run.afterglowFrom;
  if (state.meta.nukes === 0 || from === null) return 1;
  const { start, halfSeconds, holdSeconds, endsAfterSeconds } = content.prestige.afterglow;
  const elapsed = t - from;
  if (elapsed >= endsAfterSeconds) return 1;
  return 1 + (start - 1) * 2 ** (-Math.max(0, elapsed - holdSeconds) / halfSeconds);
}

/** The folds of a tap that change only with the state's effects and the buffs running. */
interface TapFolds {
  flat: number;
  share: number;
  tapMult: number;
  target: string | null;
  fellEvery: number;
  fellBonus: number;
  hustlePeak: number;
  hold: number;
  drain: number;
  gain: number;
  critChance: number;
  critMult: number;
}

/** Buff-free folds per state (keyed on its `rates`), which taps and the advisor ask for often. */
const foldsMemo = new WeakMap<Rates, TapFolds>();

function tapFolds(content: Content, state: BaseState, t: number): TapFolds {
  const r = rates(content, state);
  // Tap buffs (Adrenaline, Rush) count while they run at `t`.
  const buffs = state.run.buffs.length ? buffEffects(content, state.run.buffs, t) : [];
  const known = buffs.length === 0 ? foldsMemo.get(r) : undefined;
  if (known) return known;
  const when: Conditions = { online: true };
  const fold = (stat: StatId, base: number): number =>
    foldStat(stat, [...(r.byStat.get(stat) ?? []), ...buffs], base, {}, when);
  const { hustle } = content.tap;
  const target = content.targets.find((row) => row.era === state.run.era);
  const folds: TapFolds = {
    flat: fold("tap_flat", content.tap.flat),
    share: fold("tap_share", content.tap.share),
    tapMult: fold("tap", 1),
    target: target?.id ?? null,
    fellEvery: target
      ? Math.max(1, Math.round(fold("fell_taps", target.fellTaps)))
      : Number.POSITIVE_INFINITY,
    fellBonus: fold("fell_bonus", content.tap.fellBonusTaps),
    hustlePeak: Math.min(hustle.peakCeiling, fold("hustle_max", hustle.peak)),
    hold: fold("hustle_hold", hustle.graceSeconds),
    drain: fold("hustle_drain", hustle.drainPerSecond),
    gain: fold("hustle_gain", hustle.perTap),
    critChance: fold("crit_chance", 0),
    critMult: fold("crit_mult", 1),
  };
  if (buffs.length === 0) foldsMemo.set(r, folds);
  return folds;
}

/** The parts of a tap's value that hold for a whole batch evaluated at `t`. */
export function tapParts(content: Content, state: BaseState, t: number) {
  const r = rates(content, state);
  const folds = tapFolds(content, state, t);
  const full = fullRate(content, state, t, { online: true });
  const scale = folds.tapMult * afterglowAt(content, state, t);
  return {
    /** The era's target, felled every `fellEvery` credited taps. */
    target: folds.target,
    fellEvery: folds.fellEvery,
    fellBonus: folds.fellBonus,
    /** A tap's value before Hustle and crits. */
    base: (folds.flat * r.tapGlobal + folds.share * full) * scale,
    /** Its flat part (Grip × the global fold), and the full rate it takes its share of. */
    flatValue: folds.flat * r.tapGlobal * scale,
    fullValue: full * scale,
    hustleCap: content.tap.hustle.cap,
    hustlePeak: folds.hustlePeak,
    hold: folds.hold,
    drain: folds.drain,
    gain: folds.gain,
    critChance: folds.critChance,
    critMult: folds.critMult,
  };
}

/**
 * Applies a taps batch to a settled state (`settledAt === now`). Never refuses: a batch the
 * bucket cannot cover is clamped, down to nothing.
 */
export function applyTaps(
  content: Content,
  state: BaseState,
  batch: TapsBatch,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const run = state.run;
  const { perSecond, burst } = content.tap.bucket;
  // 1. Times: never ahead of the server, never before the last refill.
  const to = Math.max(run.bucket.at, Math.min(batch.to, now));
  const from = Math.max(run.bucket.at, Math.min(batch.from, to));
  // 2. The bucket.
  const tokens = Math.min(burst, run.bucket.tokens + perSecond * (to - run.bucket.at));
  const credited = Math.max(0, Math.min(Math.floor(batch.count), Math.floor(tokens)));
  const bucket = { tokens: tokens - credited, at: to };
  if (credited === 0) {
    return { state: { ...state, run: { ...run, bucket } }, events: [] };
  }

  // The run's first credited batch starts Afterglow's clock.
  const afterglowFrom = run.afterglowFrom ?? from;
  const started: BaseState = { ...state, run: { ...run, afterglowFrom } };

  // 3-4. Hustle and the value of each tap.
  const parts = tapParts(content, started, to);
  const idle = Math.max(0, from - run.hustle.at - parts.hold);
  const h0 = Math.max(0, run.hustle.value - parts.drain * idle);
  let value = 0;
  let crits = 0;
  let fells = 0;
  let fellValue = 0;
  for (let k = 1; k <= credited; k++) {
    const h = Math.min(parts.hustleCap, h0 + parts.gain * k);
    let tap = parts.base * hustleFactor(h, parts.hustleCap, parts.hustlePeak);
    if ((run.target.taps + k) % parts.fellEvery === 0) {
      fells += 1;
      fellValue += parts.fellBonus * tap;
    }
    if (parts.critChance > 0) {
      const roll = rng(seedOf(run.seed, SEED.crit, run.taps + k)).next();
      if (roll < parts.critChance) {
        tap *= parts.critMult;
        crits += 1;
      }
    }
    value += tap;
  }
  const hustle = { value: Math.min(parts.hustleCap, h0 + parts.gain * credited), at: to };

  // 5. Unmanned lines: start cycles on idle ones; pay the ones that already ended.
  let payouts = 0;
  let cycles = 0;
  const readyAt = { ...run.readyAt };
  // The player is tapping, so online throughout (the pipeline sets activeAt right after).
  const afterTaps: BaseState = {
    ...state,
    run: { ...run, afterglowFrom, hustle, bucket, activeAt: now },
  };
  for (const line of content.lines) {
    const n = run.lines[line.id] ?? 0;
    if (n <= 0 || run.hands.includes(line.id)) continue;
    const start = Math.max(from, readyAt[line.id] ?? from);
    if (start > to) continue;
    const length = cycleOf(content, afterTaps, line, start);
    const k = Math.min(credited, Math.floor((to - start) / length) + 1);
    if (k <= 0) continue;
    for (let j = 1; j <= k; j++) {
      const end = start + j * length;
      if (end <= now) payouts += cyclePayout(content, afterTaps, line.id, end);
    }
    readyAt[line.id] = start + k * length;
    cycles += k;
  }

  const gain = finite(value + fellValue + payouts, "taps gain");
  const fellTaps = Number.isFinite(parts.fellEvery)
    ? (run.target.taps + credited) % parts.fellEvery
    : run.target.taps + credited;
  const next: BaseState = {
    ...state,
    run: {
      ...run,
      supplies: run.supplies + gain,
      made: run.made + gain,
      afterglowFrom,
      hustle,
      bucket,
      readyAt,
      taps: run.taps + credited,
      target: { taps: fellTaps, felled: run.target.felled + fells },
    },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        taps: state.meta.stats.taps + credited,
        felled: state.meta.stats.felled + fells,
      },
    },
  };
  const events: GameEvent[] = [
    { type: "tapped", credited, value: gain, direct: value + fellValue, crits, cycles },
  ];
  if (fells > 0 && parts.target)
    events.push({ type: "felled", target: parts.target, count: fells, value: fellValue });
  return { state: next, events };
}
