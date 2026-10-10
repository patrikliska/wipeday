/**
 * Settle's property tests (N24; docs/redesign/09-architecture.md 4.8), seeded through `rng.ts`
 * like W6's property tests, so a failure names its seed and replays.
 *
 * 1. A generator of random states: up to 300 owned per line, a random manned subset, cycles in
 *    flight on unmanned lines, up to three buffs, the last command up to 20 h back, a Night Shift
 *    of 12-48 h, glass for Glow. The fixture content adds what R0's data lacks: buffs (a global
 *    ×4, a one-line ×12) and an effect that holds only while the player is away.
 * 2. Path independence: settling to t1 and then t2 equals settling to t2, within 1e-9, over
 *    10,000 states, with t1 placed around the window's end, buff ends and payouts; the same
 *    over 10,000 random command sequences (buys, hires, taps, pings) with extra settles between.
 * 3. A tick oracle: an independent loop over whole seconds (manned production that second, each
 *    unmanned cycle at its end second) agrees with settle within 1e-6 over 1,000 states × 48 h.
 * 4. `suppliesAt` equals the settled supplies at random times.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Content } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "./commands";
import type { GameEvent } from "./events";
import { type Rng, rng } from "./rng";
import { settle, suppliesAt } from "./settle";
import { type BaseState, type Buff, newBase } from "./state";

const shipped = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;

/** The buffs the fixture knows, with the factors the oracle uses on its own. */
const RALLY = 4;
const DRONE = 12;
const AWAY = 1.5;

/** R0's content plus buffs and an away-only effect, with a Night Shift of `hours`. */
function fixture(hours: number): Content {
  return {
    ...shipped,
    run: { nightShift: { ...shipped.run.nightShift, windowHours: hours } },
    buffs: {
      rally: [{ stat: "output", op: "more", value: RALLY }],
      drone: [{ stat: "output", op: "more", value: DRONE }],
      // Holds only while away: settle must cut where the player goes offline.
      lantern: [{ stat: "offline", op: "more", value: AWAY, when: "offline" }],
    },
  };
}

const rel = (a: number, b: number): number =>
  Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));

interface Case {
  content: Content;
  state: BaseState;
}

/** A random state, settled up to `now` = T0 (09-architecture.md 4.8's generator). */
function randomCase(random: Rng): Case {
  const hours = 12 + random.int(0, 36);
  const content = fixture(hours);
  const base = newBase(content, T0 - 30 * HOUR, random.int(1, 1e9));
  const lines: Record<string, number> = {};
  const hands: string[] = [];
  const readyAt: Record<string, number> = {};
  for (const line of content.lines) {
    if (random.next() < 0.4) continue;
    const owned = random.int(1, 300);
    lines[line.id] = owned;
    if (random.next() < 0.5) hands.push(line.id);
    else if (random.next() < 0.6) readyAt[line.id] = T0 + random.int(1, 3 * HOUR);
  }
  const buffs: Buff[] = [];
  const kinds = ["rally", "drone", "lantern"];
  for (let i = random.int(0, 3); i > 0; i--) {
    const kind = kinds[random.int(0, kinds.length - 1)] ?? "rally";
    const owned = Object.keys(lines);
    const line = owned[random.int(0, Math.max(0, owned.length - 1))];
    buffs.push({
      kind,
      until: T0 + random.int(1, 20 * HOUR),
      ...(kind === "drone" && line ? { line } : {}),
    });
  }
  const state: BaseState = {
    ...base,
    run: {
      ...base.run,
      era: TIERS[TIERS.length - 1] ?? "hqm",
      lines,
      hands,
      readyAt,
      buffs,
      supplies: random.next() * 1e6,
      made: random.next() * 1e7,
      settledAt: T0,
      activeAt: T0 - random.int(0, 20 * HOUR),
    },
    meta: { ...base.meta, glass: { ...base.meta.glass, ever: random.int(0, 5000) } },
  };
  return { content, state };
}

/** Seconds worth testing around: the window's end, buff ends, payouts, going offline. */
function edges(content: Content, state: BaseState): number[] {
  const window = state.run.activeAt + content.run.nightShift.windowHours * HOUR;
  return [
    window,
    state.run.activeAt + 330,
    ...state.run.buffs.map((buff) => buff.until),
    ...Object.values(state.run.readyAt),
  ];
}

const sorted = (events: GameEvent[]): string[] => events.map((e) => JSON.stringify(e)).sort();

function expectSame(a: BaseState, b: BaseState, label: string): void {
  expect(rel(a.run.supplies, b.run.supplies), `${label}: supplies`).toBeLessThanOrEqual(1e-9);
  expect(rel(a.run.made, b.run.made), `${label}: made`).toBeLessThanOrEqual(1e-9);
  expect(rel(a.meta.lifetime, b.meta.lifetime), `${label}: lifetime`).toBeLessThanOrEqual(1e-9);
  const strip = (s: BaseState) => ({
    ...s,
    run: { ...s.run, supplies: 0, made: 0, madeAtActive: 0 },
  });
  expect(strip(a), `${label}: the rest`).toEqual(strip(b));
}

describe("settle's path independence (N24)", () => {
  it("settles to t1 then t2 exactly as straight to t2, over 10,000 states", () => {
    let worst = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      const random = rng(seed);
      const { content, state } = randomCase(random);
      const points = edges(content, state);
      const pivot = points[random.int(0, points.length - 1)] ?? T0 + HOUR;
      const t1 = Math.max(T0 + 1, pivot + random.int(-60, 60));
      const t2 = Math.min(T0 + 60 * HOUR, t1 + random.int(1, 40 * HOUR));
      const once = settle(content, state, t2);
      const first = settle(content, state, t1);
      const twice = settle(content, first.state, t2);
      expectSame(twice.state, once.state, `seed ${seed}`);
      expect(sorted([...first.events, ...twice.events]), `seed ${seed}: events`).toEqual(
        sorted(once.events),
      );
      worst = Math.max(worst, rel(twice.state.run.supplies, once.state.run.supplies));
    }
    expect(worst).toBeLessThanOrEqual(1e-9);
  });

  it("holds over 10,000 random command sequences with extra settles between", () => {
    for (let seed = 1; seed <= 10_000; seed++) {
      const random = rng(seed * 7919);
      const { content, state } = randomCase(random);
      const ids = content.lines.map((line) => line.id);
      let a = state;
      let b = state;
      let t = T0;
      for (let step = random.int(2, 6); step > 0; step--) {
        t += random.int(1, 4 * HOUR);
        const line = ids[random.int(0, ids.length - 1)] ?? "beachcomber";
        const roll = random.next();
        const command: Command =
          roll < 0.3
            ? { type: "buy_line", line, count: random.next() < 0.5 ? 1 : 10 }
            : roll < 0.5
              ? { type: "hire_hand", line }
              : roll < 0.85
                ? { type: "taps", count: random.int(1, 30), from: t - random.int(0, 2), to: t }
                : { type: "ping" };
        // B settles somewhere in between first; A does not.
        const between = t - random.int(1, Math.max(1, t - b.run.settledAt));
        if (between > b.run.settledAt) b = settle(content, b, between).state;
        a = applyCommand(content, a, command, t).state;
        b = applyCommand(content, b, command, t).state;
      }
      const end = t + random.int(0, 30 * HOUR);
      expectSame(settle(content, b, end).state, settle(content, a, end).state, `sequence ${seed}`);
    }
  });
});

/**
 * The oracle: production second by second from first principles, sharing no code with settle.
 * Manned lines make owned × rate × Glow × the buffs running that second while the window is
 * open (× the away factor once the player has been gone 330 s); each unmanned cycle pays its
 * cycle's worth at its end second.
 */
function oracle(content: Content, state: BaseState, until: number): number {
  const { run } = state;
  const glow = 1 + content.prestige.glowK * Math.sqrt(state.meta.glass.ever);
  const windowEnd = run.activeAt + content.run.nightShift.windowHours * HOUR;
  const offlineFrom = run.activeAt + content.run.nightShift.pingMinutes * 60 + 30;
  const rates = new Map(content.lines.map((line) => [line.id, line]));
  let manned = 0;
  const mannedByLine = new Map<string, number>();
  for (const id of run.hands) {
    const line = rates.get(id);
    const per = (run.lines[id] ?? 0) * (line?.rate ?? 0) * glow;
    manned += per;
    mannedByLine.set(id, per);
  }
  const factorAt = (t: number, line?: string): number => {
    let factor = 1;
    for (const buff of run.buffs) {
      if (buff.until <= t) continue;
      if (buff.kind === "rally") factor *= RALLY;
      if (buff.kind === "drone" && (line === undefined || buff.line === line)) factor *= DRONE;
      if (buff.kind === "lantern" && t >= offlineFrom) factor *= AWAY;
    }
    return factor;
  };
  const drones = run.buffs.filter((buff) => buff.kind === "drone");
  let total = 0;
  for (let t = run.settledAt; t < until; t++) {
    if (t >= windowEnd) break;
    // Global buffs on everything; a drone only on its line.
    let global = 1;
    for (const buff of run.buffs) {
      if (buff.until <= t) continue;
      if (buff.kind === "rally") global *= RALLY;
      if (buff.kind === "lantern" && t >= offlineFrom) global *= AWAY;
    }
    // Buffs multiply, so two drones on one line make it ×144 there.
    let second = manned * global;
    const boosted = new Map<string, number>();
    for (const drone of drones) {
      if (drone.until > t && drone.line)
        boosted.set(drone.line, (boosted.get(drone.line) ?? 1) * DRONE);
    }
    for (const [line, factor] of boosted)
      second += (mannedByLine.get(line) ?? 0) * global * (factor - 1);
    total += second;
  }
  for (const [id, ready] of Object.entries(run.readyAt)) {
    if (ready <= run.settledAt || ready > until || run.hands.includes(id)) continue;
    const line = rates.get(id);
    if (!line) continue;
    const cycle = Math.max(content.formula.cycleFloor, line.cycle);
    total += (run.lines[id] ?? 0) * line.rate * glow * factorAt(ready, id) * cycle;
  }
  return total;
}

describe("the tick oracle (N24)", () => {
  it("agrees with settle within 1e-6 over 1,000 states × 48 h", () => {
    let worst = 0;
    for (let seed = 1; seed <= 1_000; seed++) {
      const { content, state } = randomCase(rng(seed * 31));
      const until = T0 + 48 * HOUR;
      const settled = settle(content, state, until).state.run.supplies - state.run.supplies;
      const expected = oracle(content, state, until);
      const error = rel(settled, expected);
      worst = Math.max(worst, error);
      expect(error, `seed ${seed}`).toBeLessThanOrEqual(1e-6);
    }
    expect(worst).toBeLessThanOrEqual(1e-6);
  });
});

describe("suppliesAt", () => {
  it("equals the settled supplies at any moment", () => {
    for (let seed = 1; seed <= 2_000; seed++) {
      const random = rng(seed * 101);
      const { content, state } = randomCase(random);
      const t = T0 + random.int(0, 60 * HOUR);
      const settled = settle(content, state, t).state.run.supplies;
      expect(rel(suppliesAt(content, state, t), settled), `seed ${seed}`).toBeLessThanOrEqual(
        1e-12,
      );
    }
  });
});
