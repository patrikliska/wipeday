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
 * Sources from R1: the eras bought, each line's milestones (from its owned count), the roster
 * tiers reached, and the shelf (Grip rungs, Line Mks, island upgrades); Glow from glass ever;
 * and timed buffs from flotsam (`content.buffs`). Nodes, ranks and the Logbook join in their
 * phases through `activeEffects`.
 */
import { type Effect, STATS, type StatId } from "@wipe-day/content/effects";
import type { Content, LineDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { glow } from "./prestige";
import type { BaseState, Buff } from "./state";

export type { Effect, StatId };

/**
 * The effects that multiply the flat part of a tap as well as the lines (errata E23): eras,
 * island upgrades and roster tiers. Glow and Morale join them in `rates`; nothing else does, so a
 * Rally or a Line Mk never inflates the flat tap.
 */
export function globalEffects(content: Content, state: BaseState): Effect[] {
  const out: Effect[] = [];
  const era = TIERS.indexOf(state.run.era);
  for (const def of content.eras) if (TIERS.indexOf(def.id) <= era) out.push(...def.effects);
  for (const step of content.milestones.roster.slice(0, state.run.roster)) {
    out.push({ stat: "output", op: "more", value: step.payout });
  }
  for (const upgrade of content.upgrades) {
    if (upgrade.kind === "island" && state.run.upgrades.includes(upgrade.id))
      out.push(...upgrade.effects);
  }
  return out;
}

/** A line's milestone multipliers at `owned` units (02-the-run.md 4.1): payout and speed. */
export function milestoneFactors(
  content: Content,
  owned: number,
): { payout: number; speed: number } {
  let payout = 1;
  let speed = 1;
  const { line, lineEvery } = content.milestones;
  for (const step of line) {
    if (step.at > owned) break;
    payout *= step.payout ?? 1;
    speed *= step.speed ?? 1;
  }
  // Past the list, closed form: every step reached pays lineEvery's payout, a special its own.
  if (owned >= lineEvery.from) {
    let steps = Math.floor((owned - lineEvery.from) / lineEvery.step) + 1;
    for (const special of lineEvery.special) {
      if (special.at > owned) continue;
      payout *= special.payout;
      steps -= 1;
    }
    payout *= lineEvery.payout ** steps;
  }
  return { payout, speed };
}

/** The effects that hold for this state, from every source (conditional ones included). */
export function activeEffects(content: Content, state: BaseState): Effect[] {
  const out = globalEffects(content, state);
  for (const line of content.lines) {
    const n = state.run.lines[line.id] ?? 0;
    if (n <= 0) continue;
    const { payout, speed } = milestoneFactors(content, n);
    if (payout > 1) out.push({ stat: "output", op: "more", value: payout, scope: line.id });
    if (speed > 1) out.push({ stat: "speed", op: "more", value: speed, scope: line.id });
  }
  for (const upgrade of content.upgrades) {
    if (upgrade.kind !== "island" && state.run.upgrades.includes(upgrade.id))
      out.push(...upgrade.effects);
  }
  return out;
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
  /** What multiplies a tap's flat part (E23): eras × island upgrades × roster × Glow × Morale. */
  tapGlobal: number;
  glow: number;
  /** Morale (R4): 1 for now. */
  morale: number;
  /** Seconds the Night Shift lasts (N18: never past its ceiling). */
  nightShift: number;
  /**
   * Memo of each line's buff-free unit rate and speed, by line and conditions: settle, the tap
   * and the advisor ask for the same lines many times between commands.
   */
  memo: Map<string, number>;
  /** Memo of each line's buff-free unit rate, by line and conditions (`conditionCode`). */
  units: Map<string, number[]>;
  /** The effects in force by stat, so a fold scans only its own. */
  byStat: Map<StatId, Effect[]>;
  /** Memo of the production effects (output, speed, offline) that reach each line. */
  scoped: Map<string, Effect[]>;
}

const PRODUCTION: ReadonlySet<StatId> = new Set(["output", "speed", "offline"]);

/** The production effects of `rates` that reach `line`, memoised per state. */
function lineEffects(r: Rates, line: LineDef): Effect[] {
  const known = r.scoped.get(line.id);
  if (known) return known;
  const query = { line };
  const list = r.effects.filter(
    (effect) => PRODUCTION.has(effect.stat) && scopeMatches(effect, query),
  );
  r.scoped.set(line.id, list);
  return list;
}

/**
 * A stat's fold over the state's own effects (no buffs, no conditions), memoised per state:
 * prices and the flotsam schedule read these many times between commands.
 */
export function statOf(
  content: Content,
  state: BaseState,
  stat: StatId,
  base: number,
  line?: LineDef,
): number {
  const r = rates(content, state);
  const key = line ? `${stat}|${base}|${line.id}` : base === 1 ? stat : `${stat}|${base}`;
  const known = r.memo.get(key);
  if (known !== undefined) return known;
  const value = foldStat(stat, r.byStat.get(stat) ?? [], base, line ? { line } : {});
  r.memo.set(key, value);
  return value;
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
    old.run.era === state.run.era &&
    old.run.roster === state.run.roster &&
    old.run.upgrades === state.run.upgrades
  ) {
    return hit.rates;
  }
  const effects = activeEffects(content, state);
  const k = foldStat("glow_k", effects, content.prestige.glowK);
  const { windowHours, maxHours } = content.run.nightShift;
  const hours = Math.min(maxHours, foldStat("night_shift", effects, windowHours));
  const glowNow = glow(content, state.meta.glass.ever, k);
  const morale = 1;
  const result: Rates = {
    effects,
    tapGlobal: foldStat("output", globalEffects(content, state), 1) * glowNow * morale,
    glow: glowNow,
    morale,
    nightShift: Math.round(hours * 3600),
    memo: new Map(),
    units: new Map(),
    byStat: new Map(),
    scoped: new Map(),
  };
  for (const effect of effects) {
    const list = result.byStat.get(effect.stat);
    if (list) list.push(effect);
    else result.byStat.set(effect.stat, [effect]);
  }
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
  const buffs = state.run.buffs.length ? buffEffects(content, state.run.buffs, at, line.id) : [];
  // Without a buff on this line the fold depends only on the state and the conditions.
  let memo: number[] | undefined;
  const code = conditionCode(when);
  if (buffs.length === 0) {
    memo = r.units.get(line.id);
    if (!memo) {
      memo = [];
      r.units.set(line.id, memo);
    }
    const known = memo[code];
    if (known !== undefined) return known;
  }
  const own = lineEffects(r, line);
  const effects = buffs.length ? [...own, ...buffs] : own;
  const query = { line };
  const counts = { owned: state.run.lines[line.id] ?? 0, hands: state.run.hands.length };
  const output = foldStat("output", effects, line.rate, query, when, counts);
  const speed = foldStat("speed", effects, 1, query, when, counts);
  const away = when.online ? 1 : foldStat("offline", effects, 1, query, when, counts);
  const value = output * speed * r.glow * r.morale * away;
  if (memo) memo[code] = value;
  return value;
}

/**
 * Every owned line as if manned, a second at `at`, with every multiplier in force (buffs
 * included): what a tap takes its share of and a crate counts its minutes of.
 */
export function fullRate(
  content: Content,
  state: BaseState,
  at: number,
  when: Conditions = ALWAYS,
): number {
  const r = rates(content, state);
  const key = state.run.buffs.some((buff) => buff.until > at) ? null : `f|${conditionCode(when)}`;
  const known = key === null ? undefined : r.memo.get(key);
  if (known !== undefined) return known;
  let total = 0;
  for (const line of content.lines) {
    const n = state.run.lines[line.id] ?? 0;
    if (n > 0) total += n * unitRate(content, state, line, at, when);
  }
  if (key !== null) r.memo.set(key, total);
  return total;
}

/** The conditions as a small number, for memo keys. */
export const conditionCode = (when: Conditions): number =>
  (when.online ? 1 : 0) |
  (when.afterglow ? 2 : 0) |
  (when.rain ? 4 : 0) |
  (when.night ? 8 : 0) |
  (when.hustleFull ? 16 : 0);

/** Seconds per cycle of `line`, after speed, never under the floor (speed beyond pays out). */
export function cycleOf(content: Content, state: BaseState, line: LineDef, at: number): number {
  const r = rates(content, state);
  const buffs = state.run.buffs.length ? buffEffects(content, state.run.buffs, at, line.id) : [];
  const key = buffs.length === 0 ? `c|${line.id}` : null;
  const known = key === null ? undefined : r.memo.get(key);
  if (known !== undefined) return known;
  const own = lineEffects(r, line);
  const speed = foldStat("speed", buffs.length ? [...own, ...buffs] : own, 1, { line });
  const cycle = Math.max(content.formula.cycleFloor, line.cycle / speed);
  if (key !== null) r.memo.set(key, cycle);
  return cycle;
}
