/**
 * Scrap and the boosts (D182, D258, D259): scrap falls only by the owner's own buys; a buff boost
 * runs its effect on real seconds and is refused while it runs; the Lucky Tide drops its crates
 * on its own grid; a bought Supply Drop costs its printed scrap.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { boostOf, boostUntil, tideAt, tideSlot } from "./boosts";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { fullRate } from "./effects";
import { rng } from "./rng";
import { type BaseState, newBase } from "./state";
import { tapParts } from "./taps";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const ONLINE = { online: true } as const;

const fresh = (seed = 1): BaseState => newBase(content, T0, seed);
const ok = (result: CommandResult): BaseState => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
};
const run = (state: BaseState, command: Command, now = T0) =>
  applyCommand(content, state, command, now);
const rich = (state: BaseState, scrap: number): BaseState => ({
  ...state,
  meta: { ...state.meta, scrap },
});
/**
 * A started run with a manned line, so rates and tides have something to work on, after one
 * command (its badges and the day's quests are in, so a later command moves only what it buys).
 */
const working = (state: BaseState): BaseState =>
  ok(
    run(
      {
        ...state,
        run: {
          ...state.run,
          startedAt: T0 - 600,
          lines: { beachcomber: 10 },
          hands: ["beachcomber"],
        },
      },
      { type: "ping" },
    ),
  );

describe("buy_boost", () => {
  it("runs Overdrive as a ×3 buff on the lines for its seconds, and refuses while it runs", () => {
    const overdrive = boostOf(content, "overdrive");
    if (!overdrive) throw new Error("overdrive");
    const base = working(rich(fresh(), 40));
    const calm = fullRate(content, base, T0, ONLINE);
    const poor = run(rich(base, overdrive.cost - 1), { type: "buy_boost", boost: "overdrive" });
    expect(poor.ok).toBe(false);
    if (!poor.ok) expect(poor.refusal).toEqual({ reason: "scrap", need: overdrive.cost, have: 14 });
    const bought = run(base, { type: "buy_boost", boost: "overdrive" });
    const state = ok(bought);
    expect(state.meta.scrap).toBe(40 - overdrive.cost);
    expect(state.meta.stats.scrap).toBe(0);
    expect(state.run.buffs).toEqual([{ kind: "overdrive", until: T0 + overdrive.seconds }]);
    expect(bought.events).toContainEqual({
      type: "scrap_spent",
      n: overdrive.cost,
      what: "overdrive",
    });
    expect(bought.events).toContainEqual({
      type: "boost_bought",
      boost: "overdrive",
      until: T0 + 600,
    });
    expect(fullRate(content, state, T0 + 1, ONLINE) / calm).toBeCloseTo(3, 9);
    expect(fullRate(content, state, T0 + 601, ONLINE) / calm).toBeCloseTo(1, 9);
    expect(boostUntil(state, overdrive, T0 + 10)).toBe(T0 + 600);
    const again = run(state, { type: "buy_boost", boost: "overdrive" }, T0 + 10);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.refusal).toEqual({ reason: "running", until: T0 + 600 });
    expect(again.state.meta.scrap).toBe(state.meta.scrap);
    // After it ends it can be bought again; settle has dropped the spent buff.
    const later = run(state, { type: "buy_boost", boost: "overdrive" }, T0 + 601);
    expect(later.ok).toBe(true);
    expect(later.state.run.buffs).toEqual([{ kind: "overdrive", until: T0 + 1201 }]);
    const unknown = run(base, { type: "buy_boost", boost: "nope" });
    if (!unknown.ok) expect(unknown.refusal.reason).toBe("unknown");
  });

  it("runs Double Time as a ×5 tap buff that stacks with Frenzy's rules", () => {
    const base = working(rich(fresh(), 40));
    const calm = tapParts(content, base, T0).base;
    const state = ok(run(base, { type: "buy_boost", boost: "double_time" }));
    const hot = tapParts(content, state, T0 + 1);
    expect(hot.base / calm).toBeCloseTo(5, 9);
    expect(fullRate(content, state, T0 + 1, ONLINE)).toBeCloseTo(
      fullRate(content, base, T0 + 1, ONLINE),
      9,
    );
  });

  it("drops Lucky Tide crates on a seeded grid for its five minutes, each caught once", () => {
    const tide = boostOf(content, "lucky_tide");
    if (!tide?.tide) throw new Error("lucky_tide");
    const base = working(rich(fresh(9), 40));
    expect(tideAt(content, base, T0)).toBeNull();
    const state = ok(run(base, { type: "buy_boost", boost: "lucky_tide" }));
    expect(state.run.tide).toEqual({
      boost: "lucky_tide",
      from: T0,
      until: T0 + tide.seconds,
      last: -1,
    });
    expect(state.run.buffs).toEqual([]);
    const slots = [];
    for (let k = 0; ; k++) {
      const slot = tideSlot(content, state, k);
      if (!slot) break;
      slots.push(slot);
    }
    expect(slots.length).toBe(
      1 + Math.floor((tide.seconds - tide.tide.firstAfterSeconds) / tide.tide.every),
    );
    for (const [k, slot] of slots.entries())
      expect(slot.at).toBe(T0 + tide.tide.firstAfterSeconds + k * tide.tide.every);
    expect(slots.every((slot) => !("drop" in slot.kind.effect))).toBe(true);
    const [first] = slots;
    if (!first) throw new Error("no slot");
    expect(tideAt(content, state, first.at - 1)).toBeNull();
    expect(tideAt(content, state, first.at)?.k).toBe(0);
    const early = run(state, { type: "claim_tide", run: 1, k: 0 }, first.at - 1);
    if (!early.ok) expect(early.refusal).toEqual({ reason: "gone", at: first.at });
    const caught = run(state, { type: "claim_tide", run: 1, k: 0 }, first.at + 2);
    const next = ok(caught);
    expect(next.run.tide?.last).toBe(0);
    expect(caught.events[caught.events.length - 1]?.type).toBe("tide_claimed");
    const lump = "lump" in first.kind.effect;
    if (lump) expect(next.run.supplies).toBeGreaterThan(state.run.supplies);
    else if ("buff" in first.kind.effect) {
      const kind = first.kind.effect.buff;
      expect(next.run.buffs.some((buff) => buff.kind === kind)).toBe(true);
    }
    const again = run(next, { type: "claim_tide", run: 1, k: 0 }, first.at + 3);
    if (!again.ok) expect(again.refusal.reason).toBe("claimed");
    expect(tideAt(content, next, first.at + 3)).toBeNull();
    const late = run(next, { type: "claim_tide", run: 1, k: 1 }, first.at + 3);
    if (!late.ok) expect(late.refusal.reason).toBe("gone");
    const stale = run(next, { type: "claim_tide", run: 2, k: 1 }, first.at + 3);
    if (!stale.ok) expect(stale.refusal.reason).toBe("stale_run");
    // Running: no second tide until it ends.
    const twice = run(next, { type: "buy_boost", boost: "lucky_tide" }, T0 + 100);
    if (!twice.ok) expect(twice.refusal).toEqual({ reason: "running", until: T0 + tide.seconds });
    expect(run(next, { type: "buy_boost", boost: "lucky_tide" }, T0 + tide.seconds + 1).ok).toBe(
      true,
    );
  });
});

describe("buy_drop", () => {
  it("pays the printed scrap for a tier II or III drop, and refuses what it cannot pay", () => {
    const prices = content.scrap.drops;
    const base = rich(fresh(), prices[3]);
    const two = ok(run(base, { type: "buy_drop", tier: 2 }));
    expect(two.meta.scrap).toBe(prices[3] - prices[2]);
    expect(two.meta.drops.held[2]).toBe(1);
    const three = run(two, { type: "buy_drop", tier: 3 });
    expect(three.ok).toBe(false);
    if (!three.ok)
      expect(three.refusal).toEqual({
        reason: "scrap",
        need: prices[3],
        have: prices[3] - prices[2],
      });
    const bought = run(base, { type: "buy_drop", tier: 3 });
    expect(ok(bought).meta.drops.held[3]).toBe(1);
    expect(bought.events).toContainEqual({
      type: "drop_earned",
      tier: 3,
      count: 1,
      source: "scrap",
    });
  });
});

describe("scrap (guardrail 8)", () => {
  it("falls only by the owner's own buys over 10,000 random commands", () => {
    const random = rng(2026);
    let state = working(rich(fresh(2), 500));
    let t = T0;
    const kinds: Command["type"][] = [
      "taps",
      "ping",
      "buy_boost",
      "buy_drop",
      "claim_gull",
      "claim_flotsam",
      "collect",
      "claim_order",
      "claim_quest",
      "claim_tide",
    ];
    for (let i = 0; i < 10_000; i++) {
      t += random.int(0, 120);
      const kind = kinds[random.int(0, kinds.length - 1)] ?? "ping";
      const command: Command =
        kind === "taps"
          ? { type: "taps", count: random.int(1, 30), from: t, to: t }
          : kind === "buy_boost"
            ? {
                type: "buy_boost",
                boost: ["overdrive", "double_time", "lucky_tide"][random.int(0, 2)] ?? "overdrive",
              }
            : kind === "buy_drop"
              ? { type: "buy_drop", tier: random.next() < 0.5 ? 2 : 3 }
              : kind === "claim_gull"
                ? { type: "claim_gull", run: 1, k: random.int(0, 50) }
                : kind === "claim_flotsam"
                  ? { type: "claim_flotsam", run: 1, k: state.run.flotsam.k }
                  : kind === "claim_order"
                    ? {
                        type: "claim_order",
                        run: 1,
                        id: state.run.orders.ids[random.int(0, 7)] ?? "",
                      }
                    : kind === "claim_quest"
                      ? {
                          type: "claim_quest",
                          day: state.meta.quests.day,
                          id: state.meta.quests.ids[random.int(0, 2)] ?? "",
                        }
                      : kind === "claim_tide"
                        ? { type: "claim_tide", run: 1, k: random.int(0, 4) }
                        : kind === "collect"
                          ? { type: "collect" }
                          : { type: "ping" };
      const before = state.meta.scrap;
      const result = applyCommand(content, state, command, t);
      const spent = result.events
        .filter((event) => event.type === "scrap_spent")
        .reduce((sum, event) => sum + (event.type === "scrap_spent" ? event.n : 0), 0);
      const earned = result.events
        .filter((event) => event.type === "scrap_earned")
        .reduce((sum, event) => sum + (event.type === "scrap_earned" ? event.n : 0), 0);
      expect(result.state.meta.scrap, `step ${i} ${kind}`).toBe(before - spent + earned);
      if (spent > 0) expect(command.type === "buy_boost" || command.type === "buy_drop").toBe(true);
      expect(result.state.meta.scrap).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.state.meta.scrap)).toBe(true);
      state = result.state;
    }
    expect(state.meta.scrap).toBeLessThan(500);
  });
});
