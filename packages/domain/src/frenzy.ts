/**
 * Frenzy (D196, D237; docs/game-design.md 5.2): the second tap meter. It opens a fixed time into
 * the run's clock, fills by `perTap` a credited tap, holds `graceSeconds` after the last tap and
 * then drains. At its cap it trips the `frenzy` buff for `seconds` real seconds (taps and lines
 * ×mult), and stays empty until the buff ends. The taps batch steps it tap by tap
 * (`applyTaps`); the HUD reads it with `frenzyAt`. Nothing here runs inside settle.
 */
import type { Content } from "@wipe-day/content/schema";
import { foldStat, rates } from "./effects";
import type { BaseState } from "./state";

/** When Frenzy opens this run (unix seconds); null before the run's clock starts. */
export function frenzyOpensAt(content: Content, state: BaseState): number | null {
  const started = state.run.startedAt;
  return started === null ? null : started + content.tap.frenzy.opensAfterSeconds;
}

/** When the running Frenzy ends, or null when none runs at `t`. */
export function frenzyUntil(state: BaseState, t: number): number | null {
  let until: number | null = null;
  for (const buff of state.run.buffs) {
    if (buff.kind === "frenzy" && buff.until > t) until = Math.max(until ?? 0, buff.until);
  }
  return until;
}

/** The meter's rules after the state's effects (`frenzy_gain`, `frenzy_seconds`). */
export function frenzyRules(content: Content, state: BaseState) {
  const rules = content.tap.frenzy;
  const byStat = rates(content, state).byStat;
  return {
    perTap: foldStat("frenzy_gain", byStat.get("frenzy_gain") ?? [], rules.perTap),
    seconds: foldStat("frenzy_seconds", byStat.get("frenzy_seconds") ?? [], rules.seconds),
    cap: rules.cap,
    grace: rules.graceSeconds,
    drain: rules.drainPerSecond,
    mult: rules.mult,
  };
}

/** The stored meter decayed to `t` (0 while a Frenzy runs). */
export function frenzyMeter(content: Content, state: BaseState, t: number): number {
  if (frenzyUntil(state, t) !== null) return 0;
  const { value, at } = state.run.frenzy;
  const { graceSeconds, drainPerSecond } = content.tap.frenzy;
  return Math.max(0, value - drainPerSecond * Math.max(0, t - at - graceSeconds));
}

/** What the HUD draws under the target. */
export interface FrenzyView {
  /** Whether the meter is shown (the run's clock has passed the opening). */
  open: boolean;
  opensAt: number | null;
  /** 0..cap. */
  value: number;
  cap: number;
  /** The running Frenzy's end, or null. */
  until: number | null;
  /** The buff's full length, for the draining timer. */
  seconds: number;
  mult: number;
}

export function frenzyAt(content: Content, state: BaseState, t: number): FrenzyView {
  const opensAt = frenzyOpensAt(content, state);
  const rules = frenzyRules(content, state);
  return {
    open: opensAt !== null && t >= opensAt,
    opensAt,
    value: frenzyMeter(content, state, t),
    cap: rules.cap,
    until: frenzyUntil(state, t),
    seconds: rules.seconds,
    mult: rules.mult,
  };
}
