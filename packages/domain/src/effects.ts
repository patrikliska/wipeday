/**
 * The effects evaluator (D135; docs/redesign/09-architecture.md 5). Every bonus in the game is
 * an `Effect` from content, selected by state, and one fold turns them into numbers in a fixed
 * order:
 *
 *   base → set (the best one replaces the base) → + Σadd → × (1 + Σinc) → × Πmore
 *
 * and, for a line's production, then × Glow × Morale × the buffs running × offline (when the
 * player is away). Effects with a `when` apply only while their condition holds, so they are
 * evaluated per settle segment, never cached.
 *
 * Sources in R0: Glow (from glass ever) and timed buffs (`content.buffs`, empty until flotsam
 * ships). Eras, milestones, the shelf, nodes, ranks and the Logbook join in their phases
 * through `activeEffects`.
 */
import { type Effect, STATS, type StatId } from "@wipe-day/content/effects";
import type { Content, LineDef } from "@wipe-day/content/schema";
import { glow } from "./prestige";
import type { BaseState, Buff } from "./state";

export type { Effect, StatId };

/** The effects that hold for this state, from every source (conditional ones included). */
export function activeEffects(_content: Content, _state: BaseState): Effect[] {
  return [];
}

/** What a scoped stat is asked about: a line (and its era), or the whole island. */
export interface Query {
  line?: LineDef;
}

/** The moment an effect is evaluated at. */
export interface Conditions {
  /** The player sent a command in the last 330 s (a visible tab pings every 300 s). */
  online: boolean;
  afterglow?: boolean;
  rain?: boolean;
  night?: boolean;
  hustleFull?: boolean;
}

const ALWAYS: Conditions = { online: true };

/** Counts for `per` effects. */
export interface Counts {
  owned?: number;
  hands?: number;
  nukes?: number;
  entries?: number;
}

function scopeMatches(effect: Effect, query: Query): boolean {
  const scope = effect.scope;
  if (scope === undefined || scope === "all") return true;
  if (!query.line) return false;
  return scope === query.line.id || scope === query.line.era;
}

function holds(effect: Effect, when: Conditions): boolean {
  if (effect.when === undefined) return true;
  const state: Record<NonNullable<Effect["when"]>, boolean> = {
    online: when.online,
    offline: !when.online,
    afterglow: when.afterglow === true,
    rain: when.rain === true,
    night: when.night === true,
    hustle_full: when.hustleFull === true,
  };
  return state[effect.when];
}

/** An effect's value, scaled by what it counts and capped by its `max`. */
function strength(effect: Effect, counts: Counts): number {
  if (effect.per === undefined) return effect.value;
  const n = counts[effect.per] ?? 0;
  const max = effect.max ?? Number.POSITIVE_INFINITY;
  if (effect.op === "more") return Math.min(max, 1 + (effect.value - 1) * n);
  return Math.min(max, effect.value * n);
}

/**
 * Folds `stat` over `effects` from `base`: set, then add, then inc, then more. Effects of
 * other stats, other scopes or unmet conditions are skipped.
 */
export function foldStat(
  stat: StatId,
  effects: readonly Effect[],
  base: number,
  query: Query = {},
  when: Conditions = ALWAYS,
  counts: Counts = {},
): number {
  const def = STATS[stat];
  let value = base;
  let best: number | null = null;
  let add = 0;
  let inc = 0;
  let more = 1;
  for (const effect of effects) {
    if (effect.stat !== stat || !scopeMatches(effect, query) || !holds(effect, when)) continue;
    const amount = strength(effect, counts);
    switch (effect.op) {
      case "set":
        best =
          best === null
            ? amount
            : def.better === "lower"
              ? Math.min(best, amount)
              : Math.max(best, amount);
        break;
      case "add":
        add += amount;
        break;
      case "inc":
        inc += amount;
        break;
      case "more":
        more *= amount;
        break;
      case "unlock":
        break;
    }
  }
  if (best !== null) value = best;
  return (value + add) * (1 + inc) * more;
}

/** The effects of the buffs running at a moment, for `line` (a drone boosts one line only). */
export function buffEffects(
  content: Content,
  buffs: readonly Buff[],
  at: number,
  line?: string,
): Effect[] {
  const out: Effect[] = [];
  for (const buff of buffs) {
    if (buff.until <= at) continue;
    if (buff.line !== undefined && line !== undefined && buff.line !== line) continue;
    out.push(...(content.buffs[buff.kind] ?? []));
  }
  return out;
}

/** The parts of a state's fold that hold between commands: cached per state. */
export interface Rates {
  effects: Effect[];
  glow: number;
  /** Morale (R4): 1 for now. */
  morale: number;
  /** Seconds the Night Shift lasts (N18: never past its ceiling). */
  nightShift: number;
}

const cache = new WeakMap<object, { content: Content; state: BaseState; rates: Rates }>();

/**
 * The cached fold. Keyed on `run.lines` and checked against every other input by identity:
 * updates keep untouched sub-objects by reference, so a taps batch (a new `run`, the same
 * `run.lines`) hits the cache.
 */
export function rates(content: Content, state: BaseState): Rates {
  const hit = cache.get(state.run.lines);
  const old = hit?.state;
  if (
    hit &&
    old &&
    hit.content === content &&
    old.meta.glass === state.meta.glass &&
    old.meta.nodes === state.meta.nodes &&
    old.run.hands === state.run.hands &&
    old.run.era === state.run.era
  ) {
    return hit.rates;
  }
  const effects = activeEffects(content, state);
  const k = foldStat("glow_k", effects, content.prestige.glowK);
  const { windowHours, maxHours } = content.run.nightShift;
  const hours = Math.min(maxHours, foldStat("night_shift", effects, windowHours));
  const result: Rates = {
    effects,
    glow: glow(content, state.meta.glass.ever, k),
    morale: 1,
    nightShift: Math.round(hours * 3600),
  };
  cache.set(state.run.lines, { content, state, rates: result });
  return result;
}

/** Whether any effect in force depends on being online or away (settle then splits there). */
export function hasOnlineEffects(effects: readonly Effect[]): boolean {
  return effects.some((effect) => effect.when === "online" || effect.when === "offline");
}

/**
 * One unit of `line`'s production a second at a moment: base output through the fold, speed,
 * Glow, Morale, the buffs running, and the offline factor while the player is away.
 */
export function unitRate(
  content: Content,
  state: BaseState,
  line: LineDef,
  at: number,
  when: Conditions,
): number {
  const r = rates(content, state);
  const effects = state.run.buffs.length
    ? [...r.effects, ...buffEffects(content, state.run.buffs, at, line.id)]
    : r.effects;
  const query = { line };
  const counts = { owned: state.run.lines[line.id] ?? 0, hands: state.run.hands.length };
  const output = foldStat("output", effects, line.rate, query, when, counts);
  const speed = foldStat("speed", effects, 1, query, when, counts);
  const away = when.online ? 1 : foldStat("offline", effects, 1, query, when, counts);
  return output * speed * r.glow * r.morale * away;
}

/** Seconds per cycle of `line`, after speed, never under the floor (speed beyond pays out). */
export function cycleOf(content: Content, state: BaseState, line: LineDef, at: number): number {
  const r = rates(content, state);
  const effects = [...r.effects, ...buffEffects(content, state.run.buffs, at, line.id)];
  const speed = foldStat("speed", effects, 1, { line });
  return Math.max(content.formula.cycleFloor, line.cycle / speed);
}
