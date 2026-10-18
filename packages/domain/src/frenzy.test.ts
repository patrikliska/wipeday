/**
 * Frenzy (D196, D237): the meter opens on the run's clock, fills per credited tap, holds then
 * drains, and trips its buff inside the taps batch; the taps after the trip take the buff.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { choices, lasting } from "./advisor";
import { applyCommand, type Command } from "./commands";
import { frenzyAt, frenzyMeter } from "./frenzy";
import { mannedRate } from "./settle";
import { type BaseState, newBase } from "./state";

const shipped = loadContent(contentPaths.data, loadLocale());
// Badges raise Morale (D198); here only Frenzy's numbers count.
const content = { ...shipped, achievements: { ...shipped.achievements, moralePer: 0 } };
const T0 = 1_700_000_000;
const rules = content.tap.frenzy;
const OPEN = T0 - rules.opensAfterSeconds - 100;

/** A run past Frenzy's opening, Hustle full, the target fresh, with `meter` at `T0`. */
const fresh = (meter: number, patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0 - 4000, 5);
  return {
    ...base,
    run: {
      ...base.run,
      startedAt: OPEN,
      settledAt: T0,
      activeAt: T0,
      hustle: { value: content.tap.hustle.cap, at: T0 },
      frenzy: { value: meter, at: T0 },
      bucket: { tokens: content.tap.bucket.burst, at: T0 },
      ...patch,
    },
  };
};

const taps = (count: number, from: number, to: number): Command => ({
  type: "taps",
  count,
  from,
  to,
});

/** The direct value of 10 taps over [T0, T0 + 1] from `state`. */
function direct(state: BaseState) {
  const result = applyCommand(content, state, taps(10, T0, T0 + 1), T0 + 1);
  const tapped = result.events.find((event) => event.type === "tapped");
  return { result, direct: tapped?.type === "tapped" ? tapped.direct : 0 };
}

describe("Frenzy's trip inside a batch (D237)", () => {
  const calm = direct(fresh(0)).direct;
  const cases: [string, number, number][] = [
    // [where, taps short of the cap, expected direct ÷ calm]
    ["the first tap", 1, (1 + 9 * rules.mult) / 10],
    ["a middle tap", 5, (5 + 5 * rules.mult) / 10],
    ["the last tap", 10, 1],
  ];
  for (const [where, short, ratio] of cases) {
    it(`trips at ${where}; the taps after it take ×${rules.mult}`, () => {
      const meter = rules.cap - short * rules.perTap;
      const { result, direct: value } = direct(fresh(meter));
      expect(value / calm).toBeCloseTo(ratio, 9);
      const buff = result.state.run.buffs.find((b) => b.kind === "frenzy");
      expect(buff?.until).toBeGreaterThanOrEqual(T0 + rules.seconds);
      expect(buff?.until).toBeLessThanOrEqual(T0 + 1 + rules.seconds);
      expect(result.state.meta.stats.frenzies).toBe(1);
      expect(result.events).toContainEqual({ type: "frenzy_tripped", until: buff?.until });
      // The meter waits empty until the buff ends.
      expect(result.state.run.frenzy).toEqual({ value: 0, at: buff?.until });
    });
  }

  it("is over for a batch that arrives after it ended: calm taps that fill the meter again", () => {
    // Settle drops the buff at the command's second first, as the client's prediction does.
    const state = fresh(0, { buffs: [{ kind: "frenzy", until: T0 + 1 }] });
    const { result, direct: value } = direct(state);
    expect(value).toBeCloseTo(calm, 9);
    expect(result.state.run.frenzy).toEqual({ value: 10 * rules.perTap, at: T0 + 1 });
  });

  it("runs hot for a batch inside it, however late in the buff", () => {
    const state = fresh(0, { buffs: [{ kind: "frenzy", until: T0 + 2 }] });
    expect(direct(state).direct / calm).toBeCloseTo(rules.mult, 9);
  });

  it("does not fill before it opens, nor while a Frenzy runs", () => {
    const early = fresh(0, { startedAt: T0 - 10 });
    expect(direct(early).result.state.run.frenzy.value).toBe(0);
    const running = fresh(0, { buffs: [{ kind: "frenzy", until: T0 + 10 }] });
    expect(direct(running).result.state.run.frenzy).toEqual({ value: 0, at: T0 + 10 });
  });

  it("holds for its grace after the last tap, then drains", () => {
    const state = fresh(50);
    expect(frenzyMeter(content, state, T0 + rules.graceSeconds)).toBe(50);
    expect(frenzyMeter(content, state, T0 + rules.graceSeconds + 10)).toBeCloseTo(
      50 - 10 * rules.drainPerSecond,
      12,
    );
    expect(frenzyAt(content, state, T0)).toMatchObject({ open: true, value: 50, until: null });
    expect(frenzyAt(content, fresh(0, { startedAt: T0 }), T0).open).toBe(false);
  });

  it("makes manned lines ×mult while it runs", () => {
    const state = fresh(0, { lines: { beachcomber: 10 }, hands: ["beachcomber"] });
    const hot = { ...state, run: { ...state.run, buffs: [{ kind: "frenzy", until: T0 + 15 }] } };
    expect(mannedRate(content, hot, T0) / mannedRate(content, state, T0)).toBeCloseTo(
      rules.mult,
      9,
    );
  });

  it("never moves the crown: it scores lasting rates (D200)", () => {
    const state = fresh(0, {
      lines: { beachcomber: 10, campfire: 3 },
      hands: ["beachcomber"],
      supplies: 1e4,
    });
    const hot = { ...state, run: { ...state.run, buffs: [{ kind: "frenzy", until: T0 + 15 }] } };
    expect(lasting(hot).run.buffs).toEqual([]);
    const score = (s: BaseState) => choices(content, lasting(s), T0, 10, 1, 6).map((c) => c.score);
    expect(score(hot)).toEqual(score(state));
  });
});
