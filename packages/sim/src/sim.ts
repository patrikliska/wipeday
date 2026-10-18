/**
 * Simulator v2 (D144; docs/redesign/10-balance.md 7): lifetimes of runs played through the real
 * domain, so there is no second economy: if a number differs from the game, the domain is wrong.
 *
 * Each archetype (`pacing.json5`) checks in on its sessions, taps as the client sends taps
 * (batches of 1 s for the first 10 online minutes of a run, then 5 s, through the token bucket),
 * buys what the crown picks (`advisor.ts` `crown()`, weighed by its own pace as the client
 * weighs the player's; D178), catches its share of the flotsam that floats while it is online,
 * and is away in between, where settle runs in closed form. Deterministic: seeds only, no clock
 * reads.
 *
 * Until R4's real `nuke`, a stub nuke folds the run into `meta` by the prestige formula
 * (`prestige.ts`) and starts a fresh run, so the loop already plays lifetimes.
 */
import type { Archetype, Assertion, Content, Phase } from "@wipe-day/content/schema";
import { PHASES } from "@wipe-day/content/schema";
import { choices, crown, lasting, type Player } from "@wipe-day/domain/advisor";
import { assertFiniteState } from "@wipe-day/domain/amount";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { fullRate, rates } from "@wipe-day/domain/effects";
import type { GameEvent } from "@wipe-day/domain/events";
import { claimUntil, flotsamAt } from "@wipe-day/domain/flotsam";
import { gullAt } from "@wipe-day/domain/gulls";
import { glassLevel } from "@wipe-day/domain/prestige";
import { workshopOpensAt } from "@wipe-day/domain/research";
import { rng, SEED, seedOf } from "@wipe-day/domain/rng";
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
   * `flotsam` (the first caught), each shelf row by id the first time, `research` (the first
   * Workshop level) and each Workshop item by id, and `nuke`.
   */
  beats: Record<string, number>;
  /** Runs 1-5: the longest online stretch with nothing affordable, early (first 10 online minutes) and at all. */
  stuck: { early: number; online: number };
  /**
   * Every check-in: its day, when it started (seconds after DAY0), the lifetime made when it
   * started (glass's measure) and whether it bought anything.
   */
  checkIns: { day: number; at: number; made: number; bought: boolean }[];
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

const PURCHASES = new Set<Command["type"]>([
  "buy_line",
  "hire_hand",
  "buy_upgrade",
  "buy_research",
  "buy_era",
]);
const ONLINE = { online: true } as const;

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

/**
 * When a life may stop before its last day: once calendar day `day` is played, run 1 has ended
 * and run `runs` has started (the quick profile, D236).
 */
export interface Stop {
  day: number;
  runs: number;
}

/** One archetype's life up to calendar day `days`, from its `startDay` (a late joiner: day 30). */
export function simulate(
  content: Content,
  name: string,
  archetype: Archetype,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
  stop: Stop | null = null,
): Life {
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
      if (event.type === "frenzy_tripped") beat("frenzy", since(now));
      if (event.type === "gull_caught") beat("gull", since(now));
      if (event.type === "badge_unlocked") beat("badge", since(now));
      if (event.type === "researched") {
        beat("research", since(now));
        beat(event.item, since(now));
      }
    }
  };

  const step = (command: Command, now: number): ReturnType<typeof applyCommand> => {
    const result = applyCommand(content, state, command, now);
    state = result.state;
    life.steps += 1;
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
   * The player as the client's crown sees them (`state/pace.ts`, D165): tapping all the time at
   * `tapsPerSecond` while they tap, not at all otherwise; income is what runs (unmanned lines
   * too while tapping) plus the taps.
   */
  const pace = (calm: BaseState, now: number, tapsPerSecond: number): Player => {
    const tapShare = tapsPerSecond > 0 ? 1 : 0;
    const manned = mannedRate(content, calm, now);
    const running = manned + tapShare * (fullRate(content, calm, now, ONLINE) - manned);
    const income = running + tapsPerSecond * tapParts(content, calm, now).base;
    return { income, tapShare, tapRate: tapsPerSecond };
  };

  /**
   * The crown's last pick while it still holds: it saves for a purchase out of reach, and among
   * those the ranking does not depend on the supplies held (the wait shifts every score alike;
   * what is affordable only falls behind), so the pick changes only when prices or the pace
   * change, the supplies reach the next price or the Workshop opens. The crown scores lasting
   * rates, so buffs never move it (D200).
   */
  let waiting: {
    rates: object;
    pace: number;
    next: number;
    until: number;
    any: boolean;
  } | null = null;

  /** Buys the crown's pick while it is affordable; says whether anything at all was. */
  const buy = (now: number, tapsPerSecond: number): boolean => {
    if (
      waiting &&
      waiting.rates === rates(content, state) &&
      waiting.pace === tapsPerSecond &&
      state.run.supplies < waiting.next &&
      now < waiting.until
    ) {
      return waiting.any;
    }
    for (let i = 0; i < 100; i++) {
      const calm = lasting(state);
      const player = pace(calm, now, tapsPerSecond);
      const offered = choices(content, calm, now, player.income, player.tapShare, player.tapRate);
      const pick = crown(content, calm, now, player, offered);
      if (pick.kind !== "purchase" || !pick.choice.affordable) {
        const supplies = state.run.supplies;
        let next = Number.POSITIVE_INFINITY;
        for (const choice of offered)
          if (choice.cost > supplies) next = Math.min(next, choice.cost);
        const any = offered.some((choice) => choice.affordable);
        const opens = workshopOpensAt(content, state);
        waiting = {
          rates: rates(content, state),
          pace: tapsPerSecond,
          next,
          until: opens !== null && opens > now ? opens : Number.POSITIVE_INFINITY,
          any,
        };
        return any;
      }
      step(pick.choice.command, now);
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
      const checkIn = { at: t - DAY0, made: settle(content, state, t).state };
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
        // Not tapping, the player still watches the counter rise: the state settles (D178).
        if (count === 0) state = settle(content, state, to).state;
        if (count > 0) {
          const result = step({ type: "taps", count, from: t, to }, to);
          const tapped = result.events.find((event) => event.type === "tapped");
          // A batch that trips a Frenzy is part of the burst too (N8's "outside bursts").
          const burst = buffed || result.events.some((event) => event.type === "frenzy_tripped");
          if (state.meta.nukes === 0 && tapped?.type === "tapped") {
            const made = state.run.made - before;
            if (runOnline < 60) {
              life.income.firstMinute.tapDriven += Math.max(0, made - manned);
              life.income.firstMinute.made += made;
            } else if (runOnline >= FINE_SECONDS && !burst) {
              life.income.later.direct += tapped.direct;
              life.income.later.made += made;
            }
          }
        }
        const k = floating(content, state, to);
        if (k !== null && catches(archetype, baseSeed, state.run.n, k))
          step({ type: "claim_flotsam", run: state.run.n, k }, to);
        // Crows, by the same share as flotsam on their own stream (D238).
        const crow = gullAt(content, state, to);
        if (crow && catches(archetype, seedOf(baseSeed, SEED.gull), state.run.n, crow.k))
          step({ type: "claim_gull", run: state.run.n, k: crow.k }, to);
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
      // Every number still finite (D130), checked once a session: `finite()` guards each gain.
      assertFiniteState(state);
      // A stretch with nothing affordable ends with the session.
      stuck = 0;
      life.checkIns.push({
        day,
        at: checkIn.at,
        made: checkIn.made.meta.lifetime + checkIn.made.run.made,
        bought,
      });
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
    if (stop && day >= stop.day && life.runs.length > 0 && state.run.n > stop.runs) break;
  }
  life.runs.push({ n: state.run.n, start: runStart, end: null, made: state.run.made, glass: 0 });
  return life;
}

/** Every archetype of the pacing file, alone (`stops`: each one's early stop, if any). */
export function simulateArchetypes(
  content: Content,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
  stops: Readonly<Record<string, Stop>> = {},
): Life[] {
  return Object.entries(content.pacing.archetypes).map(([name, a]) =>
    simulate(content, name, a, days, seed, snapshotDays, stops[name] ?? null),
  );
}

/**
 * The checks whose reach is known: what they read from each archetype is named by their `days`
 * (or `day`) and `archetype`, run 1's end, or runs 1-5. With any other check due, every life
 * plays to the profile's last day.
 */
const SHORT_CHECKS: ReadonlySet<string> = new Set([
  "prestigeShape",
  "magnitude",
  "firstHandSeconds",
  "nothingAffordableEarly",
  "nothingAffordableOnline",
  "casualCheckInsWithPurchase",
  "tapShare",
  "activeHour",
  "run1Made",
  "firstHourBeats",
  "casualFirstNuke",
]);

/** Each archetype's early stop for the due assertions, or null when one reaches further. */
export function earlyStops(
  content: Content,
  due: readonly Assertion[],
): Record<string, Stop> | null {
  if (due.some((assertion) => !SHORT_CHECKS.has(assertion.check))) return null;
  const stops: Record<string, Stop> = {};
  for (const [name, archetype] of Object.entries(content.pacing.archetypes)) {
    let day = archetype.startDay ?? 1;
    for (const assertion of due) {
      const reads =
        assertion.check === "activeHour"
          ? str(assertion.archetype, "active")
          : assertion.check.startsWith("casual")
            ? str(assertion.archetype, "casual")
            : null;
      if (reads !== name) continue;
      const days = Array.isArray(assertion.days)
        ? assertion.days.map((d) => num(d, 1))
        : [num(assertion.days ?? assertion.day, 1)];
      day = Math.max(day, ...days);
    }
    stops[name] = { day, runs: EARLY_RUNS };
  }
  return stops;
}

/** Every scenario of the pacing file: one long session, so a single day covers it. */
export function simulateScenarios(content: Content, seed = 11): Life[] {
  return Object.entries(content.pacing.scenarios).map(([name, a]) =>
    simulate(content, name, a, 1, seed),
  );
}

/** Every archetype and scenario of the pacing file, alone. */
export function simulateAll(
  content: Content,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
): Life[] {
  return [
    ...simulateArchetypes(content, days, seed, snapshotDays),
    ...simulateScenarios(content, seed),
  ];
}

/**
 * Supplies made in one online hour from `start`: tapping `tapsPerSecond` and catching every
 * flotsam and crow, or idle (a ping every 5 minutes, so the player counts as online). Nothing is bought,
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
      const crow = gullAt(content, state, to);
      if (crow)
        state = applyCommand(
          content,
          state,
          { type: "claim_gull", run: state.run.n, k: crow.k },
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
/** Seconds after DAY0 as "day 2 08:03". */
export const dayClock = (seconds: number): string => {
  const day = Math.floor(seconds / DAY) + 1;
  const inDay = seconds - (day - 1) * DAY;
  const hh = String(Math.floor(inDay / 3600)).padStart(2, "0");
  const mm = String(Math.floor((inDay % 3600) / 60)).padStart(2, "0");
  return `day ${day} ${hh}:${mm}`;
};

/** The lives of an archetype or scenario by name (one per seed). */
const named = (lives: Life[], name: string): Life[] => lives.filter((life) => life.name === name);

/** Values per name, in order of first appearance: "47s", or "45:39-51:24" over several seeds. */
function perName(
  rows: (readonly [string, number | undefined])[],
  show: (value: number) => string,
): string {
  const byName = new Map<string, (number | undefined)[]>();
  for (const [name, value] of rows) byName.set(name, [...(byName.get(name) ?? []), value]);
  return [...byName].map(([name, values]) => `${name} ${range(values, show)}`).join(", ");
}

function range(values: (number | undefined)[], show: (value: number) => string): string {
  if (values.some((value) => value === undefined)) return "never";
  const known = values as number[];
  const low = Math.min(...known);
  const high = Math.max(...known);
  return low === high ? show(low) : `${show(low)}-${show(high)}`;
}

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
      detail: perName(
        times.map(([name, s]) => [name, s ?? undefined] as const),
        (s) => `${s}s`,
      ),
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
  // N3 (guardrail 1): the casual's first nuke lands by the end of the check-in starting at `by`
  // on day `day`.
  casualFirstNuke: (assertion, { content, lives }) => {
    const name = str(assertion.archetype, "casual");
    const archetype = content.pacing.archetypes[name];
    const [h = "21", m = "0"] = str(assertion.by, "21:00").split(":");
    const start = Number(h) * 3600 + Number(m) * 60;
    const session = archetype
      ? sessionsOf(archetype).find((row) => row.start === start)
      : undefined;
    const by = (num(assertion.day, 1) - 1) * DAY + start + (session?.seconds ?? 0);
    const ends = named(lives, name).map((life) => life.runs[0]?.end ?? undefined);
    const ok = ends.length > 0 && ends.every((end) => end !== undefined && end <= by);
    return { ok, detail: `first nuke ${range(ends, dayClock)} (want by ${dayClock(by)})` };
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
      parts.push(
        `${key} ${range(times, clock)}${inside ? "" : ` (want ${clock(low)}-${clock(high)})`}`,
      );
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
  const { days, seeds, scenarioSeeds, early } = content.pacing.profiles[profile] ?? {
    days: 90,
    seeds: [11],
  };
  const limit = phaseIndex(upTo);
  const due = content.pacing.assertions.filter((assertion) => phaseIndex(assertion.on) <= limit);
  // Snapshots only for the days an N9 check due now reads.
  const snapshotDays = due.flatMap((assertion) =>
    assertion.check === "activeHour" && Array.isArray(assertion.days)
      ? assertion.days.map((day) => num(day, 0))
      : [],
  );
  const stops = early ? earlyStops(content, due) : null;
  const lives = [
    ...seeds.flatMap((seed) => simulateArchetypes(content, days, seed, snapshotDays, stops ?? {})),
    ...(scenarioSeeds ?? seeds).flatMap((seed) => simulateScenarios(content, seed)),
  ];
  return content.pacing.assertions.map((assertion): Verdict => {
    const base = { n: assertion.n, check: assertion.check, on: assertion.on };
    if (phaseIndex(assertion.on) > limit) return { ...base, status: "pending", detail: "" };
    const check = CHECKS[assertion.check];
    if (!check) return { ...base, status: "missing", detail: "no implementation" };
    const { ok, detail } = check(assertion, { content, lives });
    return { ...base, status: ok ? "pass" : assertion.warn ? "warn" : "fail", detail };
  });
}

// --- what the Night Shift's window costs (12-feel.md 15) ------------------------------------

/** One configuration of the window report: a name and the content it plays. */
export interface WindowVariant {
  name: string;
  content: Content;
}

/** R1's base output (`lines.json5` before R2 Feel S6 lowered it for the Workshop). */
const R1_RATE_BASE = 1.5;

/**
 * The variants `pnpm sim window` compares: R1 as it shipped (12 h, its base output, no Workshop
 * tiers), the shipped economy with a 12 h window, and the shipped content (2 h). Built in
 * memory, so the content checks of the shipped data do not refuse the 12 h windows.
 */
export function windowVariants(content: Content): WindowVariant[] {
  const window = (c: Content, windowHours: number, maxHours: number): Content => ({
    ...c,
    run: { ...c.run, nightShift: { ...c.run.nightShift, windowHours, maxHours } },
  });
  const scale = R1_RATE_BASE / content.formula.rateBase;
  const r1: Content = {
    ...content,
    formula: { ...content.formula, rateBase: R1_RATE_BASE },
    lines: content.lines.map((line) => ({ ...line, rate: line.rate * scale })),
    research: content.research.filter((def) => def.kind === "mk"),
  };
  return [
    { name: "R1: 12 h, no Workshop", content: window(r1, 12, 48) },
    { name: "12 h + Workshop", content: window(content, 12, 48) },
    { name: "2 h + Workshop", content },
  ];
}

export interface WindowRow {
  variant: string;
  archetype: string;
  /** Lifetime made at the start of each day-1 check-in, then at the end of day 1. */
  checkIns: { at: number; made: number }[];
  dayEnd: number;
  /** Seconds after DAY0, if run 1 ended inside the days played. */
  firstNuke: number | null;
}

/** Day 1 and the first nuke for each archetype under each variant (`days` played, one seed). */
export function windowReport(content: Content, days = 3, seed = 11): WindowRow[] {
  const rows: WindowRow[] = [];
  for (const variant of windowVariants(content)) {
    for (const name of ["idler", "casual", "active"]) {
      const archetype = variant.content.pacing.archetypes[name];
      if (!archetype) continue;
      const life = simulate(variant.content, name, archetype, days, seed);
      rows.push({
        variant: variant.name,
        archetype: name,
        checkIns: life.checkIns.filter((c) => c.day === 1).map(({ at, made }) => ({ at, made })),
        dayEnd: life.days[0]?.lifetime ?? 0,
        firstNuke: life.runs[0]?.end ?? null,
      });
    }
    for (const name of Object.keys(variant.content.pacing.scenarios)) {
      const archetype = variant.content.pacing.scenarios[name];
      if (!archetype || name !== "firstHour") continue;
      const life = simulate(variant.content, name, archetype, 1, seed);
      rows.push({
        variant: variant.name,
        archetype: name,
        checkIns: [],
        dayEnd: life.days[0]?.lifetime ?? 0,
        firstNuke: life.beats.nuke ?? null,
      });
    }
  }
  return rows;
}
