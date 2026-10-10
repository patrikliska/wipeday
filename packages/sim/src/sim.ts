/**
 * Simulator v2 (D144; docs/redesign/10-balance.md 7): lifetimes of runs played through the real
 * domain, so there is no second economy: if a number differs from the game, the domain is wrong.
 *
 * Each archetype (`pacing.json5`) checks in on its sessions, taps as the client sends taps
 * (batches of 1 s for the first 10 online minutes of a run, then 5 s, through the token bucket),
 * buys with the domain's greedy buyer (`advisor.ts`) and is away in between, where settle runs in
 * closed form. Deterministic: seeds only, no clock reads.
 *
 * R0: the run has the lines and hands; the shelf, eras and flotsam arrive in R1, the real `nuke`
 * in R2. Until then a stub nuke folds the run into `meta` by the prestige formula (`prestige.ts`)
 * and starts a fresh run, so the loop already plays lifetimes.
 */
import type { Archetype, Assertion, Content, Phase } from "@wipe-day/content/schema";
import { PHASES } from "@wipe-day/content/schema";
import { bestPurchase } from "@wipe-day/domain/advisor";
import { assertFiniteState } from "@wipe-day/domain/amount";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { glassLevel } from "@wipe-day/domain/prestige";
import { seedOf } from "@wipe-day/domain/rng";
import { mannedRate, settle } from "@wipe-day/domain/settle";
import { type BaseState, newBase, newRun } from "@wipe-day/domain/state";
import { tapParts } from "@wipe-day/domain/taps";

/** Day 1 starts at this UTC midnight. */
export const DAY0 = 1_699_920_000;
const DAY = 86_400;
/** Batches are 1 s for this long into a run's online time, then 5 s (`10-balance.md` 7.3). */
const FINE_SECONDS = 600;
/** A batch holds at most this many taps (the client's tail, D134). */
const MAX_BATCH = 30;

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

/** One archetype's life up to calendar day `days`, from its `startDay` (a late joiner: day 30). */
export function simulate(
  content: Content,
  name: string,
  archetype: Archetype,
  days: number,
  seed = 11,
): Life {
  const share = onlineShare(archetype);
  const sessions = sessionsOf(archetype);
  const startDay = archetype.startDay ?? 1;
  const baseSeed = seedOf(seed, ...[...name].map((char) => char.charCodeAt(0)));
  let state = newBase(content, DAY0 + (startDay - 1) * DAY, baseSeed);
  const life: Life = { name, days: [], runs: [], firstHandSeconds: null, largest: 0, steps: 0 };
  let runStart = 0;
  let runOnline = 0;

  const step = (command: Command, now: number): void => {
    const result = applyCommand(content, state, command, now);
    state = result.state;
    life.steps += 1;
    assertFiniteState(state);
    life.largest = Math.max(life.largest, largestOf(state));
    if (
      command.type === "hire_hand" &&
      result.ok &&
      life.firstHandSeconds === null &&
      state.meta.nukes === 0 &&
      state.run.startedAt !== null
    ) {
      life.firstHandSeconds = now - state.run.startedAt;
    }
  };

  const buy = (now: number, tapsPerSecond: number): void => {
    for (let i = 0; i < 100; i++) {
      const tapIncome = tapsPerSecond * tapParts(content, state, now).base * share;
      const income = mannedRate(content, state, now) + tapIncome;
      const best = bestPurchase(content, state, now, income, share);
      if (!best?.affordable) return;
      step(best.command, now);
    }
  };

  for (let day = startDay; day <= days; day++) {
    const midnight = DAY0 + (day - 1) * DAY;
    for (const session of sessions) {
      let t = midnight + session.start;
      const end = t + session.seconds;
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
        if (count > 0) step({ type: "taps", count, from: t, to }, to);
        buy(to, rate);
        const nuked = stubNuke(content, state, to, archetype.nuke);
        if (nuked) {
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
        }
        runOnline += length;
        t += length;
      }
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
export function simulateAll(content: Content, days: number, seed = 11): Life[] {
  const { archetypes, scenarios } = content.pacing;
  return [
    ...Object.entries(archetypes).map(([name, a]) => simulate(content, name, a, days, seed)),
    // A scenario is one long session: a single day covers it.
    ...Object.entries(scenarios).map(([name, a]) => simulate(content, name, a, 1, seed)),
  ];
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
};

export const phaseIndex = (phase: Phase): number => PHASES.indexOf(phase);

/** Runs the profile and judges every assertion of `pacing.json5`. */
export function checkPacing(content: Content, profile: "test" | "full" = "test"): Verdict[] {
  const { days, seeds } = content.pacing.profiles[profile] ?? { days: 90, seeds: [11] };
  const lives = seeds.flatMap((seed) => simulateAll(content, days, seed));
  const shipped = phaseIndex(content.pacing.shipped);
  return content.pacing.assertions.map((assertion): Verdict => {
    const base = { n: assertion.n, check: assertion.check, on: assertion.on };
    if (phaseIndex(assertion.on) > shipped) return { ...base, status: "pending", detail: "" };
    const check = CHECKS[assertion.check];
    if (!check) return { ...base, status: "missing", detail: "no implementation" };
    const { ok, detail } = check(assertion, { content, lives });
    return { ...base, status: ok ? "pass" : assertion.warn ? "warn" : "fail", detail };
  });
}
