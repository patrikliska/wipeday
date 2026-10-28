/**
 * Settle: what production a base made between `settledAt` and `now`, in closed form
 * (docs/redesign/09-architecture.md 4). Rates are piecewise constant, so the interval is cut
 * where a rate can change (a buff ends, the player goes offline, the Night Shift window ends,
 * and, once an owned effect reads them, night falls or lifts, the weather block changes and
 * Afterglow fades under +10%) and each segment pays rate × length, evaluated at its start.
 * Unmanned lines pay each cycle in flight at its end (`readyAt`, busy-until); with Keep Swinging
 * (R4) their cycles chain on while Hustle is above zero. Nothing buys inside settle (D136), so
 * many small settles equal one big one (N24); remainders stay (D130).
 *
 * The Night Shift: manned lines run at 100% until `activeAt + nightShift`, then stop; a full
 * window destroys nothing.
 */
import type { Content } from "@wipe-day/content/schema";
import { finite } from "./amount";
import { hasFeature } from "./blastmap";
import {
  afterglowAt,
  afterglowHoldsUntil,
  type Conditions,
  conditionCode,
  cycleOf,
  foldStat,
  hasOnlineEffects,
  rates,
  unitRate,
} from "./effects";
import type { GameEvent } from "./events";
import { flotsamAt } from "./flotsam";
import { lineOf } from "./lines";
import type { BaseState } from "./state";
import { isNight, weatherAt, weatherBlock } from "./weather";

/** Seconds a command keeps a player "online" for effects: the 5-minute ping plus 30 s grace. */
export function onlineSeconds(content: Content): number {
  return content.run.nightShift.pingMinutes * 60 + 30;
}

/** When the Night Shift window ends: manned lines stop here until the next command. */
export function windowEnd(content: Content, state: BaseState): number {
  return state.run.activeAt + rates(content, state).nightShift;
}

/** The conditions effects see at second `t` (only the ones some effect in force reads). */
export function conditionsAt(content: Content, state: BaseState, t: number): Conditions {
  const { whens } = rates(content, state);
  const when: Conditions = { online: t < state.run.activeAt + onlineSeconds(content) };
  if (whens.night) when.night = isNight(content, t);
  if (whens.rain) when.rain = weatherAt(content, t) === "rain";
  if (whens.afterglow) when.afterglow = afterglowAt(content, state, t) >= 1.1;
  return when;
}

/** Supplies a second from manned lines at `t` (0 once the window has closed). */
export function mannedRate(content: Content, state: BaseState, t: number): number {
  const r = rates(content, state);
  if (t >= state.run.activeAt + r.nightShift) return 0;
  const when = conditionsAt(content, state, t);
  // Without a buff running the rate depends only on the state and the conditions.
  const key = state.run.buffs.some((buff) => buff.until > t) ? null : `m|${conditionCode(when)}`;
  const known = key === null ? undefined : r.totals.get(key);
  if (known !== undefined) return known;
  let total = 0;
  for (const id of state.run.hands) {
    const line = lineOf(content, id);
    const n = state.run.lines[id] ?? 0;
    if (line && n > 0) total += n * unitRate(content, state, line, t, when);
  }
  if (key !== null) r.totals.set(key, total);
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

/**
 * Keep Swinging (R4, Grip 2.3): unmanned lines keep running while Hustle is above zero. The
 * second Hustle drains to nothing after the last tap, or null without the node.
 */
export function swingingUntil(content: Content, state: BaseState): number | null {
  if (!hasFeature(content, state.meta, "keep_swinging")) return null;
  const r = rates(content, state);
  const { hustle } = content.tap;
  const hold = foldStat("hustle_hold", r.byStat.get("hustle_hold") ?? [], hustle.graceSeconds);
  const drain = foldStat("hustle_drain", r.byStat.get("hustle_drain") ?? [], hustle.drainPerSecond);
  const { value, at } = state.run.hustle;
  if (value <= 0) return null;
  return at + hold + (drain > 0 ? value / drain : 0);
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
  if (r.whens.night) {
    // Each edge of the island's night inside the span.
    const { from: nightFrom, to: nightTo } = content.islandClock.night;
    const offset = content.islandClock.utcOffsetMinutes * 60;
    for (const hour of [nightFrom, nightTo]) {
      const day = Math.floor((from + offset) / 86_400);
      for (let t = day * 86_400 + hour * 3600 - offset; t < to; t += 86_400)
        if (inside(t)) points.add(t);
    }
  }
  if (r.whens.rain) {
    // Weather block edges where rain starts or stops.
    const block = content.islandClock.weather.blockMinutes * 60;
    let rainy = weatherAt(content, from) === "rain";
    for (let t = (weatherBlock(content, from) + 1) * block; t < to; t += block) {
      const now = weatherAt(content, t) === "rain";
      if (now !== rainy && inside(t)) points.add(t);
      rainy = now;
    }
  }
  if (r.whens.afterglow) {
    const fade = afterglowHoldsUntil(content, state);
    if (fade !== null && inside(fade)) points.add(fade);
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * The chained cycles Keep Swinging runs on unmanned `id` from its cycle in flight: every cycle
 * end after `readyAt` up to `until`, in order. Empty without the node or a cycle in flight.
 */
function swungEnds(content: Content, state: BaseState, id: string, until: number): number[] {
  const line = lineOf(content, id);
  const ready = state.run.readyAt[id];
  if (!line || ready === undefined || (state.run.lines[id] ?? 0) <= 0) return [];
  const ends: number[] = [];
  let at: number = ready;
  // Bounded: Hustle lasts seconds, a cycle at least the floor.
  for (let i = 0; i < 10_000; i++) {
    const next: number = at + cycleOf(content, state, line, at);
    if (next > until) break;
    ends.push(next);
    at = next;
  }
  return ends;
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
  const swinging = swingingUntil(content, state);
  for (const [id, ready] of Object.entries(state.run.readyAt)) {
    if (state.run.hands.includes(id)) continue;
    if (ready > from && ready <= to) gain += cyclePayout(content, state, id, ready);
    if (swinging !== null && swinging > ready) {
      for (const end of swungEnds(content, state, id, swinging))
        if (end > from && end <= to) gain += cyclePayout(content, state, id, end);
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
  // Keep Swinging: the chained cycles that ended by now are paid; the one past `now` stays in
  // flight (`readyAt` moves to it), so a later settle continues the chain from there.
  let readyAt = run.readyAt;
  const swinging = swingingUntil(content, state);
  if (swinging !== null && swinging > run.settledAt) {
    for (const [id, ready] of Object.entries(run.readyAt)) {
      if (run.hands.includes(id) || swinging <= ready) continue;
      const ends = swungEnds(content, state, id, swinging);
      const next = ends.find((t) => t > now) ?? ends.at(-1);
      if (next !== undefined && next > ready) {
        if (readyAt === run.readyAt) readyAt = { ...run.readyAt };
        readyAt[id] = next;
      }
    }
  }
  const next: BaseState = {
    ...state,
    run: {
      ...run,
      supplies: run.supplies + gain,
      made: run.made + gain,
      settledAt: now,
      buffs: buffs.length === run.buffs.length ? run.buffs : buffs,
      flotsam,
      readyAt,
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
