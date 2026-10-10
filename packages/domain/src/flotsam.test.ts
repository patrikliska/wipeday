/**
 * Flotsam, felling and the island's weather (docs/redesign/02-the-run.md 7.5 and 8; errata E1;
 * N20): the schedule, run 1's guaranteed crates, claims and their refusals, buffs, the odds,
 * and the fell, all seeded.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { arrivalKind, gapBefore, outputRate } from "./flotsam";
import { mannedRate } from "./settle";
import { type BaseState, newBase } from "./state";
import { islandHour, weatherAt } from "./weather";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 9);
  return { ...base, run: { ...base.run, ...patch } };
};

function ok(result: CommandResult): BaseState {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
}

const tap = (at: number): Command => ({ type: "taps", count: 1, from: at, to: at });
const claim = (state: BaseState, k = state.run.flotsam.k): Command => ({
  type: "claim_flotsam",
  run: state.run.n,
  k,
});

describe("run 1's guaranteed crates (errata E1)", () => {
  it("wash up 3:00 after the first tap, then every 3:00 until one is caught", () => {
    let state = fresh({ lines: { beachcomber: 10 }, hands: ["beachcomber"] });
    // Time on the title screen costs nothing: the schedule starts at the first tap (D154).
    state = ok(applyCommand(content, state, tap(T0 + 500), T0 + 500));
    expect(state.run.flotsam).toEqual({ k: 0, at: T0 + 680, caught: 0, last: -1 });
    // Missed: the next crate is 3:00 after the first.
    state = ok(applyCommand(content, state, { type: "ping" }, T0 + 680 + 17));
    expect(state.run.flotsam).toMatchObject({ k: 1, at: T0 + 860 });
    expect(arrivalKind(content, state, 1).id).toBe("crate");
  });

  it("pay a flat 2 minutes of output, then the schedule turns random", () => {
    let state = fresh({ lines: { beachcomber: 10 }, hands: ["beachcomber"] });
    state = ok(applyCommand(content, state, tap(T0), T0));
    const at = T0 + 180;
    const before = applyCommand(content, state, { type: "ping" }, at + 2).state;
    const result = applyCommand(content, state, claim(state), at + 2);
    const caught = ok(result);
    const crate = 120 * outputRate(content, before, at + 2);
    expect(caught.run.supplies - before.run.supplies).toBeCloseTo(crate, 6);
    expect(result.events).toContainEqual({
      type: "flotsam_claimed",
      kind: "crate",
      k: 0,
      value: crate,
    });
    expect(caught.run.flotsam).toMatchObject({ k: 1, caught: 1, last: 0 });
    const gap = (caught.run.flotsam.at ?? 0) - at;
    expect(gap).toBeGreaterThanOrEqual(160);
    expect(gap).toBeLessThanOrEqual(600);
    expect(caught.meta.stats.flotsam).toBe(1);
  });
});

describe("claims", () => {
  const started = () => ok(applyCommand(content, fresh({ n: 2 }), tap(T0), T0));

  it("refuse a second claim, a later arrival, a closed window and another run's", () => {
    const state = started();
    const at = state.run.flotsam.at ?? 0;
    expect(applyCommand(content, state, claim(state), at - 1)).toMatchObject({
      refusal: { reason: "gone", at },
    });
    const caught = ok(applyCommand(content, state, claim(state), at + 13));
    expect(applyCommand(content, caught, claim(state, 0), at + 14)).toMatchObject({
      refusal: { reason: "claimed" },
    });
    expect(applyCommand(content, state, claim(state, 1), at + 1)).toMatchObject({
      refusal: { reason: "gone" },
    });
    // 13 s of float and 3 s of grace, then it has drifted off.
    expect(applyCommand(content, state, claim(state), at + 17)).toMatchObject({
      refusal: { reason: "gone" },
    });
    expect(
      applyCommand(content, state, { type: "claim_flotsam", run: 1, k: 0 }, at + 1),
    ).toMatchObject({ refusal: { reason: "stale_run" } });
  });

  it("start a buff that runs its seconds and restarts when caught again (D148)", () => {
    let state = fresh({ n: 2, lines: { beachcomber: 10 }, hands: ["beachcomber"] });
    state = ok(applyCommand(content, state, tap(T0), T0));
    // Walk the schedule to a Fuel Drum.
    let k = state.run.flotsam.k;
    let at = state.run.flotsam.at ?? 0;
    while (arrivalKind(content, state, k).id !== "fuel_drum") {
      k += 1;
      at += gapBefore(content, state, k, at);
    }
    const drum = { ...state, run: { ...state.run, flotsam: { ...state.run.flotsam, k, at } } };
    const base = mannedRate(content, drum, at + 1);
    const rallied = ok(applyCommand(content, drum, claim(drum, k), at + 1));
    expect(rallied.run.buffs).toEqual([{ kind: "rally", until: at + 61 }]);
    expect(mannedRate(content, rallied, at + 1)).toBeCloseTo(base * 4, 6);
    // Caught again while running: the timer restarts, it never stacks with itself.
    const again = {
      ...rallied,
      run: { ...rallied.run, flotsam: { ...rallied.run.flotsam, k, at: at + 30, last: -1 } },
    };
    const restarted = ok(applyCommand(content, again, claim(again, k), at + 31));
    expect(restarted.run.buffs).toEqual([{ kind: "rally", until: at + 91 }]);
  });

  it("pay a crate of max(1 min, min(15% held, 10 min)) after run 1", () => {
    const state = fresh({ n: 2, lines: { beachcomber: 10 }, hands: ["beachcomber"] });
    const crate = content.flotsam.kinds.find((kind) => kind.id === "crate");
    if (!crate) throw new Error("no crate");
    let k = 0;
    while (arrivalKind(content, state, k).id !== "crate") k += 1;
    const rate = outputRate(content, state, T0);
    const value = (supplies: number) => {
      const holding = { ...state, run: { ...state.run, supplies, startedAt: T0, settledAt: T0 } };
      const floating = {
        ...holding,
        run: { ...holding.run, flotsam: { k, at: T0, caught: 1, last: -1 } },
      };
      const result = ok(applyCommand(content, floating, claim(floating, k), T0));
      return result.run.supplies - supplies;
    };
    expect(value(0)).toBeCloseTo(60 * rate, 6);
    expect(value(50 * 60 * rate)).toBeCloseTo(0.15 * 50 * 60 * rate, 6);
    expect(value(1e12)).toBeCloseTo(600 * rate, 6);
  });
});

describe("the schedule and the odds (N20; 02 8.5)", () => {
  const state = {
    ...fresh({ n: 2 }),
    run: { ...fresh({ n: 2 }).run, flotsam: { k: 0, at: 0, caught: 1, last: -1 } },
  };

  it("draws gaps of 4-10 minutes, 2:40-6:40 in the rain", () => {
    let sum = 0;
    for (let k = 1; k <= 5000; k++) {
      const from = T0 + k * 1800;
      const gap = gapBefore(content, state, k, from);
      const rainy = weatherAt(content, from) === "rain";
      expect(gap).toBeGreaterThanOrEqual(rainy ? 160 : 240);
      expect(gap).toBeLessThanOrEqual(rainy ? 400 : 600);
      sum += gap;
    }
    // About 8.6 an hour with rain a fifth of the time.
    expect(3600 / (sum / 5000)).toBeGreaterThan(8);
    expect(3600 / (sum / 5000)).toBeLessThan(9.5);
  });

  it("draws kinds at their printed odds: crate 49.5%, Fuel Drum 44.0%, Adrenaline 6.6%", () => {
    const counts: Record<string, number> = {};
    const n = 20_000;
    for (let k = 0; k < n; k++) {
      const id = arrivalKind(content, state, k).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect((counts.crate ?? 0) / n).toBeCloseTo(45 / 91, 1);
    expect((counts.fuel_drum ?? 0) / n).toBeCloseTo(40 / 91, 1);
    expect((counts.adrenaline ?? 0) / n).toBeCloseTo(6 / 91, 1);
  });
});

describe("felling (02 7.5)", () => {
  it("fells the Lone Pine every 40 taps, paying 10 taps' worth", () => {
    let state = fresh();
    let at = T0;
    const results: CommandResult[] = [];
    for (let i = 0; i < 4; i++) {
      const result = applyCommand(
        content,
        state,
        { type: "taps", count: 10, from: at, to: at },
        at,
      );
      results.push(result);
      state = ok(result);
      at += 1;
    }
    expect(state.run.target).toEqual({ taps: 0, felled: 1 });
    expect(state.meta.stats.felled).toBe(1);
    const fell = results[3]?.events.find((event) => event.type === "felled");
    expect(fell).toMatchObject({ type: "felled", target: "tree", count: 1 });
    // The 40th tap's Hustle is 40: worth 1.4, so the fell pays 14.
    expect(fell && "value" in fell ? fell.value : 0).toBeCloseTo(14, 9);
  });
});

describe("the island's clock and weather (E9)", () => {
  it("keeps UTC+1 all year and draws one weather per 30-minute block", () => {
    expect(islandHour(content, Date.UTC(2026, 6, 1, 23, 30) / 1000)).toBe(0.5);
    expect(islandHour(content, Date.UTC(2026, 0, 1, 7, 0) / 1000)).toBe(8);
    const block = 1800 * 1_000_000;
    expect(weatherAt(content, block)).toBe(weatherAt(content, block + 1799));
    const counts = { clear: 0, rain: 0, fog: 0 };
    for (let i = 0; i < 20_000; i++) counts[weatherAt(content, i * 1800)] += 1;
    expect(counts.clear / 20_000).toBeCloseTo(0.7, 1);
    expect(counts.rain / 20_000).toBeCloseTo(0.2, 1);
    expect(counts.fog / 20_000).toBeCloseTo(0.1, 1);
  });
});
