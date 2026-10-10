/**
 * Simulator v2 (D144; docs/redesign/10-balance.md 7): lifetimes of runs played through the real
 * domain, so there is no second economy: if a number differs from the game, the domain is wrong.
 *
 * Each archetype (`pacing.json5`) checks in on its sessions, taps as the client sends taps
 * (batches of 1 s for the first 10 online minutes of a run, then 5 s, through the token bucket),
 * buys with the domain's greedy buyer (`advisor.ts`: lines, hands, the shelf and eras), catches
 * its share of the flotsam that floats while it is online, and is away in between, where settle
 * runs in closed form. Deterministic: seeds only, no clock reads.
 *
 * Until R2's real `nuke`, a stub nuke folds the run into `meta` by the prestige formula
 * (`prestige.ts`) and starts a fresh run, so the loop already plays lifetimes.
 */
import type { Archetype, Assertion, Content, Phase } from "@wipe-day/content/schema";
import { PHASES } from "@wipe-day/content/schema";
import { choices } from "@wipe-day/domain/advisor";
import { assertFiniteState } from "@wipe-day/domain/amount";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { rates } from "@wipe-day/domain/effects";
import type { GameEvent } from "@wipe-day/domain/events";
import { claimUntil, flotsamAt } from "@wipe-day/domain/flotsam";
import { glassLevel } from "@wipe-day/domain/prestige";
import { rng, seedOf } from "@wipe-day/domain/rng";
import { mannedRate, settle } from "@wipe-day/domain/settle";
import { type BaseState, newBase, newRun } from "@wipe-day/domain/state";
import { tapParts } from "@wipe-day/domain/taps";
import { weatherAt } from "@wipe-day/domain/weather";

/** Day 1 starts at this UTC midnight. */
export const DAY0 = 1_699_920_000;
const DAY = 86_400;
/** Batches are 1 s for this long into a run's online time, then 5 s (`10-balance.md` 7.3). */
const FINE_SECONDS = 600;
/** A batch holds at most this many taps (the client's tail, D134). */
const MAX_BATCH = 30;
/** The runs N5 and N6 look at. */
const EARLY_RUNS = 5;

export interface Session {
  /** Seconds after midnight (UTC). */
  start: number;
  seconds: number;
}

/** "08:00+5m" → one session a day; "hourly+5m" → 24. */
export function sessionsOf(archetype: Archetype): Session[] {
  const out: Session[] = [];
  for (const spec of archetype.sessions) {
    const [when = "", length = "0m"] = spec.split("+");
    const seconds = Number.parseInt(length, 10) * 60;
    if (when === "hourly") {
      for (let hour = 0; hour < 24; hour++) out.push({ start: hour * 3600, seconds });
    } else {
      const [h = "0", m = "0"] = when.split(":");
      out.push({ start: Number(h) * 3600 + Number(m) * 60, seconds });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The share of the day the archetype is online (and so taps). */
export function onlineShare(archetype: Archetype): number {
  return Math.min(1, sessionsOf(archetype).reduce((sum, s) => sum + s.seconds, 0) / DAY);
}

export interface DayRow {
  day: number;
  run: number;
  supplies: number;
  made: number;
  lifetime: number;
  owned: number;
  hands: number;
  glassEver: number;
  nukes: number;
  taps: number;
}

export interface RunRow {
  n: number;
  /** Seconds after DAY0. */
  start: number;
  end: number | null;
  made: number;
  glass: number;
}

export interface Life {
  name: string;
  days: DayRow[];
  runs: RunRow[];
  /** Seconds from run 1's first tap to its first hand, if any. */
  firstHandSeconds: number | null;
  /**
   * Run 1's moments, in seconds after its first tap: `era_<tier>`, `hand` (the first),
   * `flotsam` (the first caught), each shelf row by id the first time, and `nuke`.
   */
  beats: Record<string, number>;
  /** Runs 1-5: the longest online stretch with nothing affordable, early (first 10 online minutes) and at all. */
  stuck: { early: number; online: number };
  /** Every check-in: its day and whether it bought anything. */
  checkIns: { day: number; bought: boolean }[];
  /**
   * Run 1's income: minute 0-1 (what taps drove, taps and the unmanned cycles they ran, against
   * all made), and from minute 10 outside buffs (the taps and fells alone, against all made).
   */
  income: {
    firstMinute: { tapDriven: number; made: number };
    later: { direct: number; made: number };
  };
  /** The state at the start of the days asked for (N9's hours). */
  snapshots: Record<number, BaseState>;
  /** The largest number any state held (N23). */
  largest: number;
  /** Commands applied. */
  steps: number;
}

/** The stub nuke (R0): the formula's glass for the run, then a fresh island. */
function stubNuke(content: Content, state: BaseState, now: number, rule: Archetype["nuke"]) {
  const { meta, run } = state;
  const lifetime = meta.lifetime + run.made;
  const level = glassLevel(content, lifetime);
  const gain = level - meta.glass.level;
  const first = meta.nukes === 0;
  if (gain < (first ? content.prestige.firstNukeGlass : 1)) return null;
  const counts = first || gain >= Math.ceil(content.prestige.countShare * meta.glass.ever);
  const press = rule === "double" ? gain >= Math.max(1, meta.glass.ever) : counts;
  if (!press) return null;
  const nextMeta = {
    ...meta,
    nukes: meta.nukes + 1,
    wipeDays: meta.wipeDays + (counts ? 1 : 0),
    lifetime,
    glass: {
      ...meta.glass,
      ever: meta.glass.ever + gain,
      held: meta.glass.held + gain,
      level,
    },
  };
  return { ...state, meta: nextMeta, run: newRun(content, nextMeta, state.seed, now) };
}

const largestOf = (state: BaseState): number =>
  Math.max(state.run.supplies, state.run.made, state.meta.lifetime, state.meta.glass.ever);

const PURCHASES = new Set<Command["type"]>(["buy_line", "hire_hand", "buy_upgrade", "buy_era"]);

/** Whether `archetype` catches flotsam arrival `k` of its run (a seeded share of them). */
function catches(archetype: Archetype, seed: number, run: number, k: number): boolean {
  if (archetype.catches >= 1) return true;
  return archetype.catches > 0 && rng(seedOf(seed, run, k)).next() < archetype.catches;
}

/** The flotsam floating at `t`, if the cursor's arrival is in its claim window. */
function floating(content: Content, state: BaseState, t: number): number | null {
  const cursor = flotsamAt(content, state, t);
  if (cursor.at === null || cursor.at > t || t > claimUntil(content, state, cursor.at)) return null;
  return cursor.k;
}

/** One archetype's life up to calendar day `days`, from its `startDay` (a late joiner: day 30). */
export function simulate(
  content: Content,
  name: string,
  archetype: Archetype,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
): Life {
  const share = onlineShare(archetype);
  const sessions = sessionsOf(archetype);
  const startDay = archetype.startDay ?? 1;
  const baseSeed = seedOf(seed, ...[...name].map((char) => char.charCodeAt(0)));
  let state = newBase(content, DAY0 + (startDay - 1) * DAY, baseSeed);
  const life: Life = {
    name,
    days: [],
    runs: [],
    firstHandSeconds: null,
    beats: {},
    stuck: { early: 0, online: 0 },
    checkIns: [],
    income: { firstMinute: { tapDriven: 0, made: 0 }, later: { direct: 0, made: 0 } },
    snapshots: {},
    largest: 0,
    steps: 0,
  };
  let runStart = 0;
  let runOnline = 0;
  let stuck = 0;
  let bought = false;

  /** Run 1's moments, from the events of each command. */
  const beat = (key: string, at: number) => {
    if (state.meta.nukes === 0 && life.beats[key] === undefined) life.beats[key] = at;
  };
  const since = (now: number) => now - (state.run.startedAt ?? now);
  const record = (events: GameEvent[], now: number) => {
    for (const event of events) {
      if (event.type === "era_reached") beat(`era_${event.era}`, event.at);
      if (event.type === "hand_hired") beat("hand", since(now));
      if (event.type === "flotsam_claimed") beat("flotsam", since(now));
      if (event.type === "upgraded") beat(event.upgrade, since(now));
    }
  };

  const step = (command: Command, now: number): ReturnType<typeof applyCommand> => {
    const result = applyCommand(content, state, command, now);
    state = result.state;
    life.steps += 1;
    assertFiniteState(state);
    life.largest = Math.max(life.largest, largestOf(state));
    if (result.ok) {
      record(result.events, now);
      if (PURCHASES.has(command.type)) bought = true;
    }
    if (
      command.type === "hire_hand" &&
      result.ok &&
      life.firstHandSeconds === null &&
      state.meta.nukes === 0 &&
      state.run.startedAt !== null
    ) {
      life.firstHandSeconds = now - state.run.startedAt;
    }
    return result;
  };

  /**
   * The last scoring, while it still holds: among purchases not yet affordable the ranking does
   * not depend on the supplies held (the wait term shifts every score alike), so the buyer only
   * scores again when prices or buffs change or the supplies reach the next price.
   */
  let scored: { rates: object; buffs: object; next: number; any: boolean } | null = null;

  /** Buys the best purchase while it is affordable; says whether anything at all was. */
  const buy = (now: number, tapsPerSecond: number): boolean => {
    const held = rates(content, state);
    if (
      scored &&
      scored.rates === held &&
      scored.buffs === state.run.buffs &&
      state.run.supplies < scored.next
    ) {
      return scored.any;
    }
    for (let i = 0; i < 100; i++) {
      const tapRate = tapsPerSecond * share;
      const income = mannedRate(content, state, now) + tapRate * tapParts(content, state, now).base;
      const offered = choices(content, state, now, income, share, tapRate);
      let best = offered[0];
      for (const choice of offered) if (best && choice.score < best.score) best = choice;
      if (!best?.affordable) {
        const supplies = state.run.supplies;
        let next = Number.POSITIVE_INFINITY;
        for (const choice of offered)
          if (choice.cost > supplies) next = Math.min(next, choice.cost);
        const any = offered.some((choice) => choice.affordable);
        scored = { rates: rates(content, state), buffs: state.run.buffs, next, any };
        return any;
      }
      step(best.command, now);
    }
    return true;
  };

  const wanted = new Set(snapshotDays);
  for (let day = startDay; day <= days; day++) {
    const midnight = DAY0 + (day - 1) * DAY;
    if (wanted.has(day)) life.snapshots[day] = settle(content, state, midnight).state;
    for (const session of sessions) {
      let t = midnight + session.start;
      const end = t + session.seconds;
      bought = false;
      step({ type: "ping" }, t);
      while (t < end) {
        const idle = state.run.hands.length === 0;
        const rate = archetype.tapsPerSecond + (idle ? (archetype.tapsWhileNothingRuns ?? 0) : 0);
        // As the client batches (D134): 1 s at first, then 5 s, never more than 30 taps.
        const wide = runOnline < FINE_SECONDS ? 1 : 5;
        const fits = Math.max(1, Math.floor(MAX_BATCH / Math.max(rate, 1)));
        const length = Math.min(wide, fits, end - t);
        const count = Math.round(rate * length);
        const to = t + length - 1;
        const before = state.run.made;
        const buffed = state.run.buffs.some((buff) => buff.until > t);
        // What the manned lines make over run 1's first minute: everything else the taps drove.
        const manned =
          state.meta.nukes === 0 && runOnline < 60 ? mannedRate(content, state, t) * length : 0;
        if (count > 0) {
          const result = step({ type: "taps", count, from: t, to }, to);
          const tapped = result.events.find((event) => event.type === "tapped");
          if (state.meta.nukes === 0 && tapped?.type === "tapped") {
            const made = state.run.made - before;
            if (runOnline < 60) {
              life.income.firstMinute.tapDriven += Math.max(0, made - manned);
              life.income.firstMinute.made += made;
            } else if (runOnline >= FINE_SECONDS && !buffed) {
              life.income.later.direct += tapped.direct;
              life.income.later.made += made;
            }
          }
        }
        const k = floating(content, state, to);
        if (k !== null && catches(archetype, baseSeed, state.run.n, k))
          step({ type: "claim_flotsam", run: state.run.n, k }, to);
        const affordable = buy(to, rate);
        if (state.run.n <= EARLY_RUNS) {
          stuck = affordable ? 0 : stuck + length;
          life.stuck.online = Math.max(life.stuck.online, stuck);
          if (runOnline < FINE_SECONDS) life.stuck.early = Math.max(life.stuck.early, stuck);
        }
        const nuked = stubNuke(content, state, to, archetype.nuke);
        if (nuked) {
          beat("nuke", since(to));
          life.runs.push({
            n: state.run.n,
            start: runStart,
            end: to - DAY0,
            made: state.run.made,
            glass: nuked.meta.glass.ever - state.meta.glass.ever,
          });
          state = nuked;
          runStart = to - DAY0;
          runOnline = 0;
          stuck = 0;
        }
        runOnline += length;
        t += length;
      }
      // A stretch with nothing affordable ends with the session.
      stuck = 0;
      life.checkIns.push({ day, bought });
    }
    // The day's end, settled in closed form.
    state = settle(content, state, midnight + DAY - 1).state;
    life.largest = Math.max(life.largest, largestOf(state));
    life.days.push({
      day,
      run: state.run.n,
      supplies: state.run.supplies,
      made: state.run.made,
      lifetime: state.meta.lifetime + state.run.made,
      owned: Object.values(state.run.lines).reduce((sum, n) => sum + n, 0),
      hands: state.run.hands.length,
      glassEver: state.meta.glass.ever,
      nukes: state.meta.nukes,
      taps: state.meta.stats.taps,
    });
  }
  life.runs.push({ n: state.run.n, start: runStart, end: null, made: state.run.made, glass: 0 });
  return life;
}

/** Every archetype and scenario of the pacing file, alone. */
export function simulateAll(
  content: Content,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
): Life[] {
  const { archetypes, scenarios } = content.pacing;
  return [
    ...Object.entries(archetypes).map(([name, a]) =>
      simulate(content, name, a, days, seed, snapshotDays),
    ),
    // A scenario is one long session: a single day covers it.
    ...Object.entries(scenarios).map(([name, a]) => simulate(content, name, a, 1, seed)),
  ];
}

/**
 * Supplies made in one online hour from `start`: tapping `tapsPerSecond` and catching every
 * flotsam, or idle (a ping every 5 minutes, so the player counts as online). Nothing is bought,
 * so the hour measures what activity adds, not what it compounds into (N9).
 */
export function hourMade(
  content: Content,
  from: BaseState,
  start: number,
  tapsPerSecond: number,
): number {
  let state = applyCommand(content, from, { type: "ping" }, start).state;
  const made = state.run.made;
  for (let t = start; t < start + 3600; t += 5) {
    const to = t + 4;
    if (tapsPerSecond > 0) {
      state = applyCommand(
        content,
        state,
        { type: "taps", count: Math.round(tapsPerSecond * 5), from: t, to },
        to,
      ).state;
      const k = floating(content, state, to);
      if (k !== null)
        state = applyCommand(
          content,
          state,
          { type: "claim_flotsam", run: state.run.n, k },
          to,
        ).state;
    } else if ((t - start) % 300 === 0) {
      state = applyCommand(content, state, { type: "ping" }, t).state;
    }
  }
  return settle(content, state, start + 3600).state.run.made - made;
}

type HourRatios = { weighted: number; clear: number; rain: number };

/** N9's hours per snapshot: its weighted and rain rows read the same hours. */
const hours = new WeakMap<BaseState, Map<number, HourRatios>>();

/**
 * N9 at a day's snapshot: active ÷ idle online hours, from six hour starts on six flotsam seeds,
 * three starting in rain and three not, weighted by the island's rain share (errata E13).
 */
export function activeHour(
  content: Content,
  snapshot: BaseState,
  tapsPerSecond: number,
): HourRatios {
  const known = hours.get(snapshot)?.get(tapsPerSecond);
  if (known) return known;
  const ratios = { clear: [] as number[], rain: [] as number[] };
  // Hours start at noon on the snapshot's day, then every 30-minute block after it.
  let start = snapshot.run.settledAt + 12 * 3600;
  for (let k = 0; ratios.clear.length < 3 || ratios.rain.length < 3; k++) {
    const rainy = weatherAt(content, start) === "rain";
    const list = rainy ? ratios.rain : ratios.clear;
    if (list.length < 3) {
      const seeded = { ...snapshot, run: { ...snapshot.run, seed: seedOf(snapshot.run.seed, k) } };
      const active = hourMade(content, seeded, start, tapsPerSecond);
      const idle = hourMade(content, seeded, start, 0);
      list.push(active / Math.max(idle, 1e-9));
    }
    start += content.islandClock.weather.blockMinutes * 60;
    if (k > 2000) break;
  }
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
  const rainShare = content.islandClock.weather.rain / 100;
  const clear = mean(ratios.clear);
  const rain = mean(ratios.rain);
  const result = { weighted: (1 - rainShare) * clear + rainShare * rain, clear, rain };
  const byRate = hours.get(snapshot) ?? new Map<number, HourRatios>();
  byRate.set(tapsPerSecond, result);
  hours.set(snapshot, byRate);
  return result;
}

// --- the assertions (`pacing.json5` v2) ----------------------------------------------------

export type Status = "pass" | "warn" | "fail" | "pending" | "missing";

export interface Verdict {
  n: string;
  check: string;
  on: Phase;
  status: Status;
  detail: string;
}

interface Context {
  content: Content;
  lives: Life[];
}

type Check = (assertion: Assertion, context: Context) => { ok: boolean; detail: string };

const num = (value: unknown, fallback: number): number =>
  typeof value === "number" ? value : fallback;
const str = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;
const pair = (value: unknown, fallback: [number, number]): [number, number] =>
  Array.isArray(value) && value.length === 2 ? [num(value[0], 0), num(value[1], 0)] : fallback;
const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** The lives of an archetype or scenario by name (one per seed). */
const named = (lives: Life[], name: string): Life[] => lives.filter((life) => life.name === name);

/** The checks implemented so far, by name. A shipped assertion without one fails. */
export const CHECKS: Record<string, Check> = {
  // N21: the prestige shape in data is the one the owner chose (decision 9).
  prestigeShape: (assertion, { content }) => {
    const p = content.prestige;
    const want = {
      exponent: num(assertion.exponent, Number.NaN),
      l0: num(assertion.l0, Number.NaN),
      glowK: num(assertion.glowK, Number.NaN),
      firstNukeGlass: num(assertion.firstNukeGlass, Number.NaN),
    };
    const ok =
      p.exponent === want.exponent &&
      p.l0 === want.l0 &&
      p.glowK === want.glowK &&
      p.firstNukeGlass === want.firstNukeGlass;
    return {
      ok,
      detail: `exponent ${p.exponent}, l0 ${p.l0}, glowK ${p.glowK}, first nuke ${p.firstNukeGlass}`,
    };
  },
  // N23: every number stays finite (the simulator asserts it every step) and below the ceiling.
  magnitude: (assertion, { lives }) => {
    const largest = Math.max(...lives.map((life) => life.largest));
    const max = num(assertion.max, 1e150);
    return {
      ok: Number.isFinite(largest) && largest < max,
      detail: `largest ${largest.toExponential(3)}`,
    };
  },
  // N4: the first hand comes within `max` seconds of the first tap, for everyone who plays.
  firstHandSeconds: (assertion, { lives }) => {
    const times = lives.map((life) => [life.name, life.firstHandSeconds] as const);
    const worst = Math.max(...times.map(([, s]) => s ?? Number.POSITIVE_INFINITY));
    return {
      ok: worst <= num(assertion.max, 120),
      detail: times.map(([name, s]) => `${name} ${s === null ? "never" : `${s}s`}`).join(", "),
    };
  },
  // N5: in runs 1-5's first 10 online minutes, never more than maxSeconds with nothing to buy.
  nothingAffordableEarly: (assertion, { lives }) => {
    const worst = Math.max(...lives.map((life) => life.stuck.early));
    return { ok: worst <= num(assertion.maxSeconds, 30), detail: `longest ${worst}s` };
  },
  // N6: online in runs 1-5, never more than maxSeconds with nothing affordable.
  nothingAffordableOnline: (assertion, { lives }) => {
    const worst = Math.max(...lives.map((life) => life.stuck.online));
    const who = lives.find((life) => life.stuck.online === worst)?.name ?? "";
    return { ok: worst <= num(assertion.maxSeconds, 120), detail: `longest ${worst}s (${who})` };
  },
  // N7: the casual buys something at (at least) `min` of their check-ins over the first days.
  casualCheckInsWithPurchase: (assertion, { lives }) => {
    const days = num(assertion.days, 1);
    const checkIns = named(lives, str(assertion.archetype, "casual")).flatMap((life) =>
      life.checkIns.filter((checkIn) => checkIn.day <= days),
    );
    const share =
      checkIns.filter((checkIn) => checkIn.bought).length / Math.max(1, checkIns.length);
    return {
      ok: share >= num(assertion.min, 1),
      detail: `${pct(share)} of ${checkIns.length} check-ins`,
    };
  },
  // N8: what taps drive in run 1's first minute, and the taps' own share from minute 10.
  tapShare: (assertion, { lives }) => {
    const scenario = named(lives, str(assertion.scenario, "firstHour"));
    const sum = (pick: (life: Life) => number) =>
      scenario.reduce((total, life) => total + pick(life), 0);
    const first =
      sum((l) => l.income.firstMinute.tapDriven) / sum((l) => l.income.firstMinute.made);
    const later = sum((l) => l.income.later.direct) / sum((l) => l.income.later.made);
    const [low, high] = pair(assertion.fromMinute10, [0.05, 0.25]);
    return {
      ok: first >= num(assertion.firstMinuteMin, 0.5) && later >= low && later <= high,
      detail: `minute 0-1 tap-driven ${pct(first)}, from minute 10 direct ${pct(later)}`,
    };
  },
  // N9: an active hour against an idle online hour, at the active archetype's checkpoints.
  activeHour: (assertion, { content, lives }) => {
    const days = Array.isArray(assertion.days) ? assertion.days.map((d) => num(d, 0)) : [];
    const life = named(lives, str(assertion.archetype, "active"))[0];
    const min = num(assertion.min, 1.5);
    const max = num(assertion.max, 3);
    const parts: string[] = [];
    let ok = true;
    for (const day of days) {
      const snapshot = life?.snapshots[day];
      if (!snapshot) {
        parts.push(`day ${day}: no snapshot`);
        ok = false;
        continue;
      }
      const hour = activeHour(content, snapshot, num(assertion.tapsPerSecond, 6));
      const value = assertion.rain === true ? hour.rain : hour.weighted;
      ok &&= value >= min && value <= max;
      parts.push(
        assertion.rain === true
          ? `day ${day}: rain ${hour.rain.toFixed(2)}`
          : `day ${day}: ${hour.weighted.toFixed(2)} (clear ${hour.clear.toFixed(2)}, rain ${hour.rain.toFixed(2)})`,
      );
    }
    return { ok, detail: parts.join("; ") };
  },
  // N23 (R1): run 1 ends between min and max supplies made.
  run1Made: (assertion, { lives }) => {
    const made = lives.flatMap((life) => {
      const first = life.runs[0];
      return first && first.end !== null ? [first.made] : [];
    });
    const low = Math.min(...made);
    const high = Math.max(...made);
    return {
      ok: made.length > 0 && low >= num(assertion.min, 0) && high <= num(assertion.max, 1e300),
      detail: `${made.length} run 1s, ${low.toExponential(2)} to ${high.toExponential(2)}`,
    };
  },
  // 10-balance.md 4.2 (errata E1): run 1's beats, each in its band.
  firstHourBeats: (assertion, { lives }) => {
    const scenario = named(lives, str(assertion.scenario, "firstHour"));
    const bands = (assertion.beats ?? {}) as Record<string, unknown>;
    const parts: string[] = [];
    let ok = scenario.length > 0;
    for (const [key, band] of Object.entries(bands)) {
      const [low, high] = pair(band, [0, 0]);
      const times = scenario.map((life) => life.beats[key]);
      const inside = times.every((s) => s !== undefined && s >= low && s <= high);
      ok &&= inside;
      const shown = times.map((s) => (s === undefined ? "never" : clock(s))).join("/");
      parts.push(`${key} ${shown}${inside ? "" : ` (want ${clock(low)}-${clock(high)})`}`);
    }
    return { ok, detail: parts.join(", ") };
  },
};

export const phaseIndex = (phase: Phase): number => PHASES.indexOf(phase);

/**
 * Runs the profile and judges every assertion of `pacing.json5` switched on by `upTo` (the
 * shipped phase unless asked for a later one, to see its numbers before it ships).
 */
export function checkPacing(
  content: Content,
  profile: "test" | "full" = "test",
  upTo: Phase = content.pacing.shipped,
): Verdict[] {
  const { days, seeds } = content.pacing.profiles[profile] ?? { days: 90, seeds: [11] };
  const limit = phaseIndex(upTo);
  const due = content.pacing.assertions.filter((assertion) => phaseIndex(assertion.on) <= limit);
  // Snapshots only for the days an N9 check due now reads.
  const snapshotDays = due.flatMap((assertion) =>
    assertion.check === "activeHour" && Array.isArray(assertion.days)
      ? assertion.days.map((day) => num(day, 0))
      : [],
  );
  const lives = seeds.flatMap((seed) => simulateAll(content, days, seed, snapshotDays));
  return content.pacing.assertions.map((assertion): Verdict => {
    const base = { n: assertion.n, check: assertion.check, on: assertion.on };
    if (phaseIndex(assertion.on) > limit) return { ...base, status: "pending", detail: "" };
    const check = CHECKS[assertion.check];
    if (!check) return { ...base, status: "missing", detail: "no implementation" };
    const { ok, detail } = check(assertion, { content, lives });
    return { ...base, status: ok ? "pass" : assertion.warn ? "warn" : "fail", detail };
  });
}
