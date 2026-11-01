/**
 * Scrap boosts (docs/redesign/12-feel.md 8; D258), on real seconds. Overdrive and Double Time
 * are timed buffs like Rally: `buy_boost` adds `{kind: boost id, until}` to `run.buffs`, so
 * settle's cut points, the rates and the tap folds already read them. The Lucky Tide is its own
 * airdrop grid, like the crows' (gulls.ts): slot `k` washes up `firstAfterSeconds + k × every`
 * after the buy while the tide runs, its kind drawn from the flotsam weights (never a locker),
 * claimed with `claim_tide {run, k}` for a crate's value or its buff. Nothing lives in settle.
 */
import type { BoostDef, Content, FlotsamKind } from "@wipe-day/content/schema";
import { claimUntil } from "./flotsam";
import { pickWeighted, rng, SEED, seedOf } from "./rng";
import type { BaseState } from "./state";

/** The boost with `id`, if the content lists it. */
export const boostOf = (content: Content, id: string): BoostDef | undefined =>
  content.scrap.boosts.find((boost) => boost.id === id);

/** When a running boost ends, or null: a buff of its kind, or its tide, still running at `now`. */
export function boostUntil(state: BaseState, boost: BoostDef, now: number): number | null {
  if (boost.tide) {
    const tide = state.run.tide;
    return tide && tide.boost === boost.id && tide.until > now ? tide.until : null;
  }
  const buff = state.run.buffs.find((row) => row.kind === boost.id && row.until > now);
  return buff ? buff.until : null;
}

/** One tide crate: slot `k` washes up at `at`, claimable until `until`. */
export interface TideSlot {
  k: number;
  at: number;
  until: number;
  kind: FlotsamKind;
}

/** The kinds a tide crate may be: the shipped flotsam without the ones that pay a drop. */
function tideKinds(content: Content): FlotsamKind[] {
  return content.flotsam.kinds.filter((kind) => !("drop" in kind.effect));
}

/** Slot `k` of the run's tide, or null when the tide has ended before it (or none runs). */
export function tideSlot(content: Content, state: BaseState, k: number): TideSlot | null {
  const tide = state.run.tide;
  if (!tide || !Number.isInteger(k) || k < 0) return null;
  const boost = boostOf(content, tide.boost);
  if (!boost?.tide) return null;
  const at = tide.from + boost.tide.firstAfterSeconds + k * boost.tide.every;
  if (at > tide.until) return null;
  const kinds = tideKinds(content);
  const index = pickWeighted(
    rng(seedOf(state.run.seed, SEED.tide, tide.from, k)),
    kinds.map((kind) => kind.weight),
  );
  const kind = kinds[index];
  if (!kind) return null;
  return { k, at, until: claimUntil(content, state, at), kind };
}

/** The tide crate a player can catch at `now`, or null: washed up, not caught, window open. */
export function tideAt(content: Content, state: BaseState, now: number): TideSlot | null {
  const tide = state.run.tide;
  if (!tide) return null;
  const boost = boostOf(content, tide.boost);
  if (!boost?.tide) return null;
  const k = Math.floor((now - tide.from - boost.tide.firstAfterSeconds) / boost.tide.every);
  if (k < 0 || k <= tide.last) return null;
  const slot = tideSlot(content, state, k);
  return slot && now >= slot.at && now <= slot.until ? slot : null;
}
