/**
 * Crows (id `gull`; 12-feel.md 9.3, D197, D238): flotsam's skill-based sibling in the sky. Slot
 * `j` starts `firstAfterSeconds + j × every` after the run's clock starts, plus a seeded offset
 * in [0, jitter]; whether it is a Magpie is seeded too. The schedule is a pure function of the
 * run, so the client draws the crow the server will accept, and nothing lives in settle: only
 * `claim_gull {run, k}` reads it (N24 untouched).
 */
import type { Content } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import { outputRate } from "./flotsam";
import { rng, SEED, seedOf } from "./rng";
import type { BaseState } from "./state";

/** One crossing: slot `k` enters at `at`, leaves at `at + cross`, claimable until `until`. */
export interface Crossing {
  k: number;
  at: number;
  cross: number;
  until: number;
  elite: boolean;
}

/** Slot `k`'s crossing for a run whose clock started at `startedAt`. */
export function crossing(
  content: Content,
  state: BaseState,
  startedAt: number,
  k: number,
): Crossing {
  const rules = content.flotsam.gulls;
  const roll = rng(seedOf(state.run.seed, SEED.gull, k));
  const offset = roll.next() * rules.jitter;
  const elite = roll.next() < rules.eliteOdds;
  const at = startedAt + rules.firstAfterSeconds + k * rules.every + offset;
  const cross = elite ? rules.eliteCrossSeconds : rules.crossSeconds;
  return { k, at, cross, until: at + cross + rules.graceSeconds, elite };
}

/** The crow a player can catch at `now`, or null: crossing, not caught, its window open. */
export function gullAt(content: Content, state: BaseState, now: number): Crossing | null {
  const startedAt = state.run.startedAt;
  if (startedAt === null) return null;
  const rules = content.flotsam.gulls;
  const k = Math.floor((now - startedAt - rules.firstAfterSeconds) / rules.every);
  if (k < 0 || k <= state.run.gulls.last) return null;
  const slot = crossing(content, state, startedAt, k);
  return now >= slot.at && now <= slot.until ? slot : null;
}

/** What catching crossing `slot` pays at `t`: its seconds of output, buffs aside. */
export function gullValue(content: Content, state: BaseState, elite: boolean, t: number): Amount {
  const rules = content.flotsam.gulls;
  return (elite ? rules.eliteSeconds : rules.seconds) * outputRate(content, state, t);
}

/** The printed odds (guardrail 9): the Magpie's share of crows. */
export const magpieOdds = (content: Content): number => content.flotsam.gulls.eliteOdds;
