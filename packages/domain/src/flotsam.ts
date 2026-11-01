/**
 * Flotsam (docs/redesign/02-the-run.md 8; 09-architecture.md 6.4): one arrival at a time on a
 * seeded schedule. `run.flotsam` is a cursor: arrival `k` washes up at `at`, floats for its
 * float, and may be claimed until `at + float + grace`. The gap to the next arrival is drawn
 * uniformly from `rng(seedOf(run.seed, SEED.flotsam, k))`, divided by the rain factor when it
 * rains at the arrival before it and by the `flotsam_rate` fold, so the schedule is a pure
 * function of the state and settle stays path independent.
 *
 * The schedule starts at the run's first tap or purchase (D154), never at page load. Run 1
 * (errata E1): until the first catch, every arrival is a Drift Crate, the first 3:00 after the
 * first tap and then every 3:00, paying a flat 2 minutes of output.
 */
import type { Content, FlotsamKind } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import { fullRate, statOf } from "./effects";
import { pickWeighted, rng, SEED, seedOf } from "./rng";
import type { BaseState, RunState } from "./state";
import { weatherAt } from "./weather";

type Cursor = RunState["flotsam"];

/** Run 1 before its first catch: the guaranteed crates. */
const guaranteed = (state: BaseState): boolean =>
  state.run.n === 1 && state.run.flotsam.caught === 0;

/** Seconds an arrival floats, after `flotsam_float`. */
export function floatSeconds(content: Content, state: BaseState): number {
  return statOf(content, state, "flotsam_float", content.flotsam.schedule.floatSeconds);
}

/** The last second arrival `at` may be claimed. */
export function claimUntil(content: Content, state: BaseState, at: number): number {
  return at + floatSeconds(content, state) + content.flotsam.schedule.graceSeconds;
}

/** The seconds from arrival `k − 1` (washed up at `from`) to arrival `k`. */
export function gapBefore(content: Content, state: BaseState, k: number, from: number): number {
  if (guaranteed(state)) return content.flotsam.firstRun.repeatSeconds;
  const { gapMinutes, rainFactor } = content.flotsam.schedule;
  const [shortest, longest] = gapMinutes;
  let minutes =
    shortest + (longest - shortest) * rng(seedOf(state.run.seed, SEED.flotsam, k)).next();
  if (weatherAt(content, from) === "rain") minutes /= rainFactor;
  minutes /= statOf(content, state, "flotsam_rate", 1);
  return minutes * 60;
}

/** When the first arrival washes up for a run started at `startedAt`. */
export function firstArrival(content: Content, state: BaseState, startedAt: number): number {
  if (guaranteed(state)) return startedAt + content.flotsam.firstRun.atSeconds;
  return startedAt + gapBefore(content, state, 0, startedAt);
}

/** Which kind arrival `k` is: the guaranteed crate, or a weighted draw over shipped kinds. */
export function arrivalKind(content: Content, state: BaseState, k: number): FlotsamKind {
  const { kinds, firstRun } = content.flotsam;
  const first = kinds.find((kind) => kind.id === firstRun.kind);
  if (guaranteed(state) && first) return first;
  const index = pickWeighted(
    rng(seedOf(state.run.seed, SEED.kind, k)),
    kinds.map((kind) => kind.weight),
  );
  const kind = kinds[index] ?? first;
  if (!kind) throw new Error("flotsam.json5 has no kinds");
  return kind;
}

/**
 * The cursor at `now`: started once the run is, and moved past every arrival whose claim
 * window closed (they drifted off). Returns the same object when nothing moved.
 */
export function flotsamAt(content: Content, state: BaseState, now: number): Cursor {
  const cursor = state.run.flotsam;
  const startedAt = state.run.startedAt;
  if (startedAt === null) return cursor;
  let { k, at } = cursor;
  if (at === null) at = firstArrival(content, state, startedAt);
  while (claimUntil(content, state, at) < now) {
    k += 1;
    at += gapBefore(content, state, k, at);
  }
  return k === cursor.k && at === cursor.at ? cursor : { ...cursor, k, at };
}

/** An arrival on the water: shown from `at` for `float` seconds, claimable until `until`. */
export interface Afloat {
  k: number;
  at: number;
  float: number;
  until: number;
  kind: FlotsamKind;
}

/**
 * The arrival a player can catch at `now`, or null: washed up, not caught, its claim window
 * (float plus the network grace) still open. The scene draws it; the claim names its `k`.
 */
export function afloat(content: Content, state: BaseState, now: number): Afloat | null {
  const cursor = flotsamAt(content, state, now);
  const at = cursor.at;
  if (at === null || now < at || cursor.k === cursor.last) return null;
  const until = claimUntil(content, state, at);
  if (now > until) return null;
  const kind = arrivalKind(content, state, cursor.k);
  return { k: cursor.k, at, float: floatSeconds(content, state), until, kind };
}

/** The printed odds (guardrail 9): each shipped kind's share of the draw, summing to 1. */
export function odds(content: Content): Array<{ kind: FlotsamKind; share: number }> {
  const total = content.flotsam.kinds.reduce((sum, kind) => sum + kind.weight, 0);
  return content.flotsam.kinds.map((kind) => ({
    kind,
    share: total > 0 ? kind.weight / total : 0,
  }));
}

/** Run 1 before its first catch: every arrival is the guaranteed crate (errata E1). */
export const guaranteedCrate = guaranteed;

/** How many minutes of output a crate's `value` is at `t` (the floater's "+2 min"). */
export function crateMinutes(content: Content, state: BaseState, value: Amount, t: number): number {
  const perMinute =
    outputRate(content, state, t) * 60 * statOf(content, state, "flotsam_effect", 1);
  return perMinute > 0 ? value / perMinute : 0;
}

/** Every owned line as if manned, all multipliers but buffs: what a crate's minutes are of. */
export function outputRate(content: Content, state: BaseState, t: number): number {
  const calm: BaseState = state.run.buffs.length
    ? { ...state, run: { ...state.run, buffs: [] } }
    : state;
  return fullRate(content, calm, t);
}

/** What a crate pays at `t` (02 8.1): run 1's flat minutes, else max(floor, min(share, cap)). */
export function crateValue(
  content: Content,
  state: BaseState,
  kind: FlotsamKind,
  t: number,
): Amount {
  if (!("lump" in kind.effect)) return 0;
  const rate = outputRate(content, state, t);
  const boost = statOf(content, state, "flotsam_effect", 1);
  if (guaranteed(state)) return content.flotsam.firstRun.flatMinutes * 60 * rate * boost;
  const { floorMinutes, heldShare, rateMinutes } = kind.effect.lump;
  const lump = Math.max(
    floorMinutes * 60 * rate,
    Math.min(heldShare * state.run.supplies, rateMinutes * 60 * rate),
  );
  return lump * boost;
}
