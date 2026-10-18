/**
 * Badges, the Logbook's first pages (12-feel.md 9.1; D198, D239). `earnBadges` runs at the end
 * of every successful command, on the client to predict and on the server for truth; never on a
 * refusal and never inside settle, so Morale changes only between settle's segments and settle
 * stays path independent (N24). A badge is earned once: `meta.badges[id]` keeps the second.
 */
import type { BadgeDef, BadgeWhen, Content } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { rates } from "./effects";
import type { GameEvent } from "./events";
import type { BaseState } from "./state";
import { isNight, weatherAt } from "./weather";

/** Badges earned that this content still lists (a removed badge stops counting). */
export function badgeCount(content: Content, state: BaseState): number {
  let n = 0;
  for (const badge of content.achievements.badges)
    if (state.meta.badges[badge.id] !== undefined) n++;
  return n;
}

/** Morale (D198): 1 + moralePer × badges earned; it multiplies every line and tap. */
export function moraleOf(content: Content, state: BaseState): number {
  return 1 + content.achievements.moralePer * badgeCount(content, state);
}

const eraIndex = (era: string): number => TIERS.indexOf(era as (typeof TIERS)[number]);

/** The lines a predicate looks at: the open ones, or only `era`'s (one list per content). */
const lineLists = new WeakMap<Content, Map<string, string[]>>();
function linesIn(content: Content, state: BaseState, era: string | undefined): string[] {
  let lists = lineLists.get(content);
  if (!lists) {
    lists = new Map();
    lineLists.set(content, lists);
  }
  const key = era === undefined ? `open:${state.run.era}` : era;
  let ids = lists.get(key);
  if (!ids) {
    const open = eraIndex(state.run.era);
    ids = content.lines
      .filter((line) => (era === undefined ? eraIndex(line.era) <= open : line.era === era))
      .map((line) => line.id);
    lists.set(key, ids);
  }
  return ids;
}

/**
 * Predicates that read only the units, hands and era, memoised on the `run.lines` object (a new
 * one each purchase): taps batches, the common command, reuse them.
 */
const lineMemo = new WeakMap<
  object,
  { hands: string[]; era: string; values: Map<object, number> }
>();
function linePredicate(state: BaseState, key: object, compute: () => number): number {
  const run = state.run;
  let memo = lineMemo.get(run.lines);
  if (!memo || memo.hands !== run.hands || memo.era !== run.era) {
    memo = { hands: run.hands, era: run.era, values: new Map() };
    lineMemo.set(run.lines, memo);
  }
  let value = memo.values.get(key);
  if (value === undefined) {
    value = compute();
    memo.values.set(key, value);
  }
  return value;
}
const researchMemo = new WeakMap<object, number>();

/** A named predicate's value on `state` (BADGE_STATES). */
export function stateValue(
  content: Content,
  state: BaseState,
  when: Extract<BadgeWhen, { kind: "state" }>,
): number {
  const run = state.run;
  switch (when.state) {
    case "era":
      // The run's era as its place on the ladder: Twig 0, Timber 1, Stone 2 ...
      return eraIndex(run.era);
    case "lines_min_owned":
      return linePredicate(state, when, () => {
        if (when.era && eraIndex(when.era) > eraIndex(run.era)) return 0;
        let least = Number.POSITIVE_INFINITY;
        for (const id of linesIn(content, state, when.era))
          least = Math.min(least, run.lines[id] ?? 0);
        return Number.isFinite(least) ? least : 0;
      });
    case "line_max_owned":
      return linePredicate(state, when, () => Math.max(0, ...Object.values(run.lines)));
    case "hands_working":
      return linePredicate(state, when, () => {
        const ids = linesIn(content, state, when.era);
        return run.hands.filter((line) => ids.includes(line) && (run.lines[line] ?? 0) > 0).length;
      });
    case "hustle":
      return run.hustle.value;
    case "supplies_digits":
      return Math.floor(run.supplies);
    case "made_ever":
      return state.meta.lifetime + run.made;
    case "research_maxed": {
      let maxed = researchMemo.get(run.research);
      if (maxed === undefined) {
        maxed = content.research.filter((def) => (run.research[def.id] ?? 0) >= def.levels).length;
        researchMemo.set(run.research, maxed);
      }
      return maxed;
    }
    case "window_hours":
      return rates(content, state).nightShift / 3600;
  }
}

/** Whether event `event` meets an event condition, read at second `now`. */
function eventMatches(
  content: Content,
  when: Extract<BadgeWhen, { kind: "event" }>,
  event: GameEvent,
  now: number,
): boolean {
  if (event.type !== when.event) return false;
  const fields = event as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(when.filters)) {
    if (key === "weather") {
      if (weatherAt(content, now) !== value) return false;
    } else if (key === "night") {
      if (isNight(content, now) !== value) return false;
    } else if (key.endsWith("Lte") || key.endsWith("Gte")) {
      const have = fields[key.slice(0, -3)];
      if (typeof have !== "number" || typeof value !== "number") return false;
      if (key.endsWith("Lte") ? have > value : have < value) return false;
    } else if (fields[key] !== value) return false;
  }
  return true;
}

/** Whether `badge` is met after a command that left `state` and reported `events`. */
export function badgeMet(
  content: Content,
  badge: BadgeDef,
  state: BaseState,
  events: readonly GameEvent[],
  now: number,
): boolean {
  const when = badge.when;
  if (when.kind === "stat") return state.meta.stats[when.stat] >= when.gte;
  if (when.kind === "state") {
    const value = stateValue(content, state, when);
    if (when.state === "supplies_digits") {
      const want = String(when.eq);
      return value >= (when.eq ?? 0) && String(value).startsWith(want);
    }
    return value >= (when.gte ?? Number.POSITIVE_INFINITY);
  }
  if (when.kind === "buffs")
    return when.buffs.every((kind) =>
      state.run.buffs.some((buff) => buff.kind === kind && buff.until > now),
    );
  return events.some((event) => eventMatches(content, when, event, now));
}

/** How far a counting badge has come (the Logbook's bar), or null for one-off conditions. */
export function badgeProgress(
  content: Content,
  badge: BadgeDef,
  state: BaseState,
): { value: number; goal: number } | null {
  const when = badge.when;
  if (when.kind === "stat") return { value: state.meta.stats[when.stat], goal: when.gte };
  if (
    when.kind === "state" &&
    when.gte !== undefined &&
    when.state !== "hustle" &&
    when.state !== "era"
  )
    return { value: stateValue(content, state, when), goal: when.gte };
  return null;
}

/** The badges grouped by what they read, once per content: every command asks. */
interface Plan {
  /** Counters and predicates, read after every command. */
  always: BadgeDef[];
  /** Event badges by the event type they wait for. */
  byEvent: Map<string, BadgeDef[]>;
  /** Badges on buffs running at once. */
  buffs: BadgeDef[];
}
const plans = new WeakMap<Content, Plan>();

function planOf(content: Content): Plan {
  let plan = plans.get(content);
  if (plan) return plan;
  const always: BadgeDef[] = [];
  const byEvent = new Map<string, BadgeDef[]>();
  const buffs: BadgeDef[] = [];
  for (const badge of content.achievements.badges) {
    const when = badge.when;
    if (when.kind === "event") byEvent.set(when.event, [...(byEvent.get(when.event) ?? []), badge]);
    else if (when.kind === "buffs") buffs.push(badge);
    else always.push(badge);
  }
  plan = { always, byEvent, buffs };
  plans.set(content, plan);
  return plan;
}

/** Earns every badge the command met; appends one `badge_unlocked` event each. */
export function earnBadges(
  content: Content,
  state: BaseState,
  events: readonly GameEvent[],
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const plan = planOf(content);
  const have = state.meta.badges;
  const found: BadgeDef[] = [];
  const consider = (list: readonly BadgeDef[]) => {
    for (const badge of list) {
      if (have[badge.id] !== undefined || found.includes(badge)) continue;
      if (badgeMet(content, badge, state, events, now)) found.push(badge);
    }
  };
  consider(plan.always);
  for (const event of events) {
    const list = plan.byEvent.get(event.type);
    if (list) consider(list);
  }
  if (state.run.buffs.length >= 2) consider(plan.buffs);
  if (found.length === 0) return { state, events: [] };
  const earned = { ...have };
  for (const badge of found) earned[badge.id] = now;
  return {
    state: { ...state, meta: { ...state.meta, badges: earned } },
    events: found.map((badge) => ({ type: "badge_unlocked", id: badge.id })),
  };
}
