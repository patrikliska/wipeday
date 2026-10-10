/**
 * Settle: what production a base made between `settledAt` and `now`, in closed form
 * (docs/redesign/09-architecture.md 4). Rates are piecewise constant, so the interval is cut
 * where a rate can change (a buff ends, the player goes offline, the Night Shift window ends)
 * and each segment pays rate × length, evaluated at its start. Unmanned lines pay each cycle in
 * flight at its end (`readyAt`, busy-until). Nothing buys inside settle (D136), so many small
 * settles equal one big one (N24); remainders stay (D130).
 *
 * The Night Shift: manned lines run at 100% until `activeAt + nightShift`, then stop; a full
 * window destroys nothing. Rain, night and Afterglow add cut points when their effects ship.
 */
import type { Content } from "@wipe-day/content/schema";
import { finite } from "./amount";
import { type Conditions, cycleOf, hasOnlineEffects, rates, unitRate } from "./effects";
import type { GameEvent } from "./events";
import { flotsamAt } from "./flotsam";
import { lineOf } from "./lines";
import type { BaseState } from "./state";

/** Seconds a command keeps a player "online" for effects: the 5-minute ping plus 30 s grace. */
export function onlineSeconds(content: Content): number {
  return content.run.nightShift.pingMinutes * 60 + 30;
}

/** When the Night Shift window ends: manned lines stop here until the next command. */
export function windowEnd(content: Content, state: BaseState): number {
  return state.run.activeAt + rates(content, state).nightShift;
}

/** The conditions effects see at second `t`. */
export function conditionsAt(content: Content, state: BaseState, t: number): Conditions {
  return { online: t < state.run.activeAt + onlineSeconds(content) };
}

/** Supplies a second from manned lines at `t` (0 once the window has closed). */
export function mannedRate(content: Content, state: BaseState, t: number): number {
  if (t >= windowEnd(content, state)) return 0;
  const when = conditionsAt(content, state, t);
  let total = 0;
  for (const id of state.run.hands) {
    const line = lineOf(content, id);
    const n = state.run.lines[id] ?? 0;
    if (line && n > 0) total += n * unitRate(content, state, line, t, when);
  }
  return total;
}

/** What one cycle of unmanned `id` pays when it ends at `t`: its rate then × its cycle. */
export function cyclePayout(content: Content, state: BaseState, id: string, t: number): number {
  const line = lineOf(content, id);
  const n = state.run.lines[id] ?? 0;
  if (!line || n <= 0) return 0;
  const when = conditionsAt(content, state, t);
  return n * unitRate(content, state, line, t, when) * cycleOf(content, state, line, t);
}

/** The seconds in (from, to) where a manned rate can change. */
function cutPoints(content: Content, state: BaseState, from: number, to: number): number[] {
  const points = new Set<number>();
  const inside = (t: number) => t > from && t < to;
  for (const buff of state.run.buffs) if (inside(buff.until)) points.add(buff.until);
  const r = rates(content, state);
  const buffed = state.run.buffs.flatMap((buff) => content.buffs[buff.kind] ?? []);
  if (hasOnlineEffects(r.effects) || hasOnlineEffects(buffed)) {
    const offline = state.run.activeAt + onlineSeconds(content);
    if (inside(offline)) points.add(offline);
  }
  const end = windowEnd(content, state);
  if (inside(end)) points.add(end);
  return [...points].sort((a, b) => a - b);
}

/** Supplies made in (from, to]: manned segments plus unmanned cycles ending in the span. */
export function madeBetween(content: Content, state: BaseState, from: number, to: number): number {
  if (to <= from) return 0;
  let gain = 0;
  let t = from;
  for (const cut of [...cutPoints(content, state, from, to), to]) {
    gain += mannedRate(content, state, t) * (cut - t);
    t = cut;
  }
  for (const [id, ready] of Object.entries(state.run.readyAt)) {
    if (ready > from && ready <= to && !state.run.hands.includes(id)) {
      gain += cyclePayout(content, state, id, ready);
    }
  }
  return finite(gain, "settle gain");
}

/** Supplies the base holds at `t` (≥ settledAt), without building a new state: for the HUD. */
export function suppliesAt(content: Content, state: BaseState, t: number): number {
  return state.run.supplies + madeBetween(content, state, state.run.settledAt, t);
}

export interface Settled {
  state: BaseState;
  events: GameEvent[];
  /** Something beyond time moved: an event, or a buff ran out. Pure accrual is not a change. */
  changed: boolean;
}

/**
 * Credits production up to `now` and moves the flotsam cursor past arrivals that drifted off.
 * Returns the same object when there is nothing to do.
 */
export function settle(content: Content, state: BaseState, now: number): Settled {
  const run = state.run;
  if (now <= run.settledAt) return { state, events: [], changed: false };
  const gain = madeBetween(content, state, run.settledAt, now);
  const events: GameEvent[] = [];
  const end = windowEnd(content, state);
  if (end > run.settledAt && end <= now && run.hands.length > 0) {
    events.push({ type: "night_shift_over", at: end });
  }
  const buffs = run.buffs.filter((buff) => buff.until > now);
  const flotsam = flotsamAt(content, state, now);
  const next: BaseState = {
    ...state,
    run: {
      ...run,
      supplies: run.supplies + gain,
      made: run.made + gain,
      settledAt: now,
      buffs: buffs.length === run.buffs.length ? run.buffs : buffs,
      flotsam,
    },
  };
  const changed = events.length > 0 || buffs.length !== run.buffs.length || flotsam !== run.flotsam;
  return { state: next, events, changed };
}

/** When the scheduler should look at this base again: the window's end, if still ahead. */
export function nextEventAt(content: Content, state: BaseState): number | null {
  if (state.run.hands.length === 0) return null;
  const end = windowEnd(content, state);
  return end > state.run.settledAt ? end : null;
}
