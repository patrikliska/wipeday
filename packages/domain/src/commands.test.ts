import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { assertFiniteState, finite } from "./amount";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { costOf, lineOf, maxAffordable } from "./lines";
import { normalizeState } from "./normalize";
import { glassLevel, glow, lifetimeFor } from "./prestige";
import { type BaseState, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 1);
  return { ...base, run: { ...base.run, ...patch } };
};

const ok = (result: CommandResult): BaseState => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
};

const run = (state: BaseState, command: Command, now = T0): CommandResult =>
  applyCommand(content, state, command, now);

describe("buy_line", () => {
  it("buys one, ten or the most supplies allow, at the closed-form price", () => {
    const beach = lineOf(content, "beachcomber");
    if (!beach) throw new Error("no beachcomber");
    let state = ok(
      run(fresh({ supplies: 10_000 }), { type: "buy_line", line: "beachcomber", count: 1 }),
    );
    expect(state.run.lines.beachcomber).toBe(1);
    expect(state.run.supplies).toBeCloseTo(10_000 - 6, 9);
    state = ok(run(state, { type: "buy_line", line: "beachcomber", count: 10 }));
    expect(state.run.lines.beachcomber).toBe(11);
    expect(state.run.supplies).toBeCloseTo(10_000 - costOf(beach, 0, 11), 6);
    const max = maxAffordable(beach, 11, state.run.supplies);
    state = ok(run(state, { type: "buy_line", line: "beachcomber", count: "max" }));
    expect(state.run.lines.beachcomber).toBe(11 + max);
    expect(state.run.supplies).toBeGreaterThanOrEqual(0);
    expect(costOf(beach, 11 + max, 1)).toBeGreaterThan(state.run.supplies);
  });

  it("matches the plan's worked example: owning 10 Looms, ×10 costs 1.58M", () => {
    const loom = lineOf(content, "loom");
    if (!loom) throw new Error("no loom");
    expect(costOf(loom, 10, 10) / 1.58e6).toBeCloseTo(1, 2);
    expect(maxAffordable(loom, 10, 1e6)).toBe(7);
  });

  it("refuses with what is missing", () => {
    const short = run(fresh({ supplies: 3 }), { type: "buy_line", line: "beachcomber", count: 1 });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.refusal).toEqual({ reason: "supplies", need: 6, have: 3 });
    const locked = run(fresh({ supplies: 1e9 }), { type: "buy_line", line: "loom", count: 1 });
    if (!locked.ok)
      expect(locked.refusal).toEqual({ reason: "locked", gate: { kind: "era", value: "wood" } });
    else throw new Error("loom should be locked in the Twig era");
    const none = run(fresh(), { type: "buy_line", line: "beachcomber", count: "max" });
    if (!none.ok) expect(none.refusal.reason).toBe("supplies");
  });

  it("starts the run's clock and the first purchase, and restarts the Night Shift", () => {
    const state = ok(
      run(fresh({ supplies: 10 }), { type: "buy_line", line: "beachcomber", count: 1 }, T0 + 50),
    );
    expect(state.run.startedAt).toBe(T0 + 50);
    expect(state.run.firstBuyAt).toBe(T0 + 50);
    expect(state.run.activeAt).toBe(T0 + 50);
  });
});

describe("hire_hand", () => {
  it("needs a unit, the price, and one hand per line", () => {
    const empty = run(fresh({ supplies: 1e6 }), { type: "hire_hand", line: "beachcomber" });
    if (!empty.ok) expect(empty.refusal.reason).toBe("no_units");
    const state = ok(
      run(fresh({ supplies: 1e6, lines: { beachcomber: 1 } }), {
        type: "hire_hand",
        line: "beachcomber",
      }),
    );
    expect(state.run.hands).toEqual(["beachcomber"]);
    expect(state.run.supplies).toBe(1e6 - 1800);
    const again = run(state, { type: "hire_hand", line: "beachcomber" });
    if (!again.ok) expect(again.refusal.reason).toBe("hired");
  });

  it("makes the line run by itself, also while away, until the Night Shift ends", () => {
    const state = ok(
      run(fresh({ supplies: 2000, lines: { beachcomber: 2 } }), {
        type: "hire_hand",
        line: "beachcomber",
      }),
    );
    const later = ok(run(state, { type: "ping" }, T0 + 100));
    // 2 units × 1.5 a second × 100 s; Glow is 1 with no glass.
    expect(later.run.supplies - state.run.supplies).toBeCloseTo(300, 9);
    const window = content.run.nightShift.windowHours * 3600;
    const end = applyCommand(content, later, { type: "ping" }, T0 + 100 + window + 5000);
    expect(end.state.run.supplies - later.run.supplies).toBeCloseTo(3 * window, 6);
    expect(end.events.some((event) => event.type === "night_shift_over")).toBe(true);
  });
});

describe("taps", () => {
  it("credits each tap, at most the bucket's burst and refill (N10)", () => {
    const one = ok(run(fresh(), { type: "taps", count: 10, from: T0, to: T0 }));
    expect(one.run.taps).toBe(10);
    expect(one.run.supplies).toBeGreaterThan(10);
    const flood = ok(run(fresh(), { type: "taps", count: 120, from: T0, to: T0 }));
    expect(flood.run.taps).toBe(45);
    const ahead = ok(run(fresh(), { type: "taps", count: 30, from: T0, to: T0 + 3600 }, T0));
    expect(ahead.run.bucket.at).toBe(T0);
  });

  it("starts the run's clock and Afterglow's", () => {
    const state = ok(run(fresh(), { type: "taps", count: 3, from: T0 + 2, to: T0 + 3 }, T0 + 3));
    expect(state.run.startedAt).toBe(T0 + 3);
    expect(state.run.afterglowFrom).toBe(T0 + 2);
  });
});

describe("normalizeState (D133)", () => {
  it("returns null for any other version, so the API starts afresh", () => {
    expect(normalizeState(content, { tier: "twig", stock: {} })).toBeNull();
    expect(normalizeState(content, { v: 1 })).toBeNull();
    expect(normalizeState(content, null)).toBeNull();
  });

  it("fills missing fields, drops unknown lines, and is idempotent", () => {
    const base = newBase(content, T0, 7);
    expect(normalizeState(content, base)).toEqual(base);
    const stored = JSON.parse(JSON.stringify(base));
    delete stored.run.hustle;
    stored.run.lines = { beachcomber: 3, gone: 2 };
    stored.run.hands = ["beachcomber", "gone"];
    const once = normalizeState(content, stored);
    expect(once?.run.hustle).toEqual(base.run.hustle);
    expect(once?.run.lines).toEqual({ beachcomber: 3 });
    expect(once?.run.hands).toEqual(["beachcomber"]);
    expect(normalizeState(content, once)).toEqual(once);
  });
});

describe("numbers (D130)", () => {
  it("throws on NaN and Infinity", () => {
    expect(() => finite(Number.NaN, "x")).toThrow(/non-finite x/);
    expect(finite(1e300, "x")).toBe(1e300);
    const bad = fresh({ supplies: Number.POSITIVE_INFINITY });
    expect(() => assertFiniteState(bad)).toThrow(/state\.run\.supplies/);
    expect(() => assertFiniteState(fresh())).not.toThrow();
  });

  it("refuses to settle into a non-finite amount", () => {
    const state = fresh({ supplies: 1e308, lines: { beachcomber: 1 }, hands: ["beachcomber"] });
    const huge = { ...state, run: { ...state.run, lines: { beachcomber: 1e308 } } };
    expect(() => applyCommand(content, huge, { type: "ping" }, T0 + 3600)).toThrow(/non-finite/);
  });
});

describe("prestige (N21)", () => {
  it("is the fifth root over 5e5, exact at its boundaries", () => {
    expect(glassLevel(content, 0)).toBe(0);
    expect(glassLevel(content, 5e5)).toBe(1);
    expect(glassLevel(content, 5e5 * 32)).toBe(2);
    expect(glassLevel(content, 5e5 * 32 - 1)).toBe(1);
    // 10 glass needs about 50 billion supplies made.
    expect(lifetimeFor(content, 10)).toBe(5e10);
    expect(glassLevel(content, 5e10)).toBe(10);
    expect(glow(content, 100)).toBeCloseTo(3.5, 12);
  });
});
