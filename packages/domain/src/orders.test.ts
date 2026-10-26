/**
 * Work Orders (D255, D256): eight a run from the pools on the base's seed, five always reachable
 * without taps (N32), claimed once when met, a drop through the gate or scrap at once, the fifth
 * claim fuels the set exactly once.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { TIERS } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command, type CommandResult } from "./commands";
import {
  fuelled,
  orderMet,
  orderOf,
  orderProgress,
  ordersOf,
  readyOrders,
  rollOrders,
} from "./orders";
import { type BaseState, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const fresh = (seed = 1): BaseState => newBase(content, T0, seed);
const ok = (result: CommandResult): BaseState => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
};
const run = (state: BaseState, command: Command, now = T0) =>
  applyCommand(content, state, command, now);
const withRun = (state: BaseState, patch: Partial<BaseState["run"]>): BaseState => ({
  ...state,
  run: { ...state.run, ...patch },
});

/** The order ids of a run, met by patching the run to the state they ask for. */
function meeting(state: BaseState, id: string): BaseState {
  const order = orderOf(content, id);
  if (!order) throw new Error(id);
  const when = order.when;
  if (when.kind !== "state") throw new Error("orders are state predicates");
  const goal = when.gte ?? 0;
  const lines = content.lines.filter((line) => when.era === undefined || line.era === when.era);
  switch (when.state) {
    case "era":
      return withRun(state, { era: TIERS[goal] ?? "hqm" });
    case "hands_working": {
      const picked = lines.slice(0, goal).map((line) => line.id);
      return withRun(state, {
        era: "hqm",
        lines: Object.fromEntries(picked.map((id) => [id, 1])),
        hands: picked,
      });
    }
    case "lines_min_owned":
      return withRun(state, {
        era: when.era ?? "hqm",
        lines: Object.fromEntries(
          content.lines
            .filter((line) => TIERS.indexOf(line.era) <= TIERS.indexOf(when.era ?? "hqm"))
            .map((line) => [line.id, goal]),
        ),
      });
    case "line_max_owned":
      return withRun(state, { lines: { beachcomber: goal } });
    case "line_owned":
      return withRun(state, { era: "hqm", lines: { [when.line ?? "loom"]: goal } });
    case "run_taps":
      return withRun(state, { taps: goal });
    case "run_felled":
      return withRun(state, { target: { ...state.run.target, felled: goal } });
    case "run_flotsam":
      return withRun(state, { flotsam: { ...state.run.flotsam, caught: goal } });
    case "run_gulls":
      return withRun(state, { gulls: { ...state.run.gulls, caught: goal } });
    case "run_frenzies":
      return withRun(state, { frenzy: { ...state.run.frenzy, trips: goal } });
    case "run_made":
      return withRun(state, { made: goal });
    default:
      throw new Error(`no fixture for ${when.state}`);
  }
}

describe("the roll (D256)", () => {
  it("gives every run eight distinct orders, the spread per era in era order, the same for a seed", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const n = 1 + (seed % 7);
      const ids = rollOrders(content, seed, n);
      expect(ids).toHaveLength(content.orders.perRun);
      expect(new Set(ids).size).toBe(ids.length);
      expect(rollOrders(content, seed, n)).toEqual(ids);
      const orders = ids.map((id) => orderOf(content, id));
      let era = -1;
      for (const row of content.orders.spread) {
        const inEra = orders.filter((order) => order?.era === row.era);
        expect(inEra, `seed ${seed} era ${row.era}`).toHaveLength(row.count);
      }
      for (const order of orders) {
        const index = TIERS.indexOf(order?.era ?? "twig");
        expect(index).toBeGreaterThanOrEqual(era);
        era = index;
      }
      // N32's guarantee: at most `activeMax` need the player at the screen.
      expect(orders.filter((order) => order?.active).length).toBeLessThanOrEqual(
        content.orders.activeMax,
      );
      expect(orders.filter((order) => !order?.active).length).toBeGreaterThanOrEqual(
        content.orders.fuel,
      );
      expect(orders.filter((order) => order?.idle).length).toBeGreaterThanOrEqual(
        content.orders.idleMin,
      );
    }
  });

  it("differs between runs and between bases, and a fresh base carries run 1's", () => {
    const a = rollOrders(content, 11, 1);
    expect(rollOrders(content, 11, 2)).not.toEqual(a);
    expect(rollOrders(content, 12, 1)).not.toEqual(a);
    expect(fresh(11).run.orders).toEqual({ ids: a, claimed: [], fuelledAt: null });
  });
});

describe("claim_order", () => {
  it("pays scrap at once and a drop through the gate, once, and refuses what is not met", () => {
    const state = fresh(3);
    const [first] = ordersOf(content, state);
    if (!first) throw new Error("no orders");
    expect(orderMet(content, state, first)).toBe(false);
    const unmet = run(state, { type: "claim_order", run: 1, id: first.id });
    expect(unmet.ok).toBe(false);
    if (!unmet.ok) expect(unmet.refusal.reason).toBe("unmet");
    const met = meeting(state, first.id);
    expect(orderMet(content, met, first)).toBe(true);
    expect(readyOrders(content, met).map((order) => order.id)).toContain(first.id);
    const claimed = run(met, { type: "claim_order", run: 1, id: first.id });
    const next = ok(claimed);
    expect(next.run.orders.claimed).toEqual([first.id]);
    expect(next.meta.stats.orders).toBe(1);
    expect(claimed.events.map((event) => event.type)).toContain("order_claimed");
    for (const pay of first.pays) {
      if ("scrap" in pay) {
        expect(next.meta.scrap).toBe(pay.scrap);
        expect(next.meta.stats.scrap).toBe(pay.scrap);
      } else {
        // The mark is earned; the gate pays it on this very command (nothing paid yet today).
        expect(next.meta.drops.owed).toEqual({ earned: 1, paid: 1 });
        expect(next.meta.drops.held[1]).toBe(1);
        expect(claimed.events).toContainEqual({
          type: "drop_earned",
          tier: 1,
          count: 1,
          source: "claims",
        });
      }
    }
    // A second click: nothing happens.
    const again = run(next, { type: "claim_order", run: 1, id: first.id });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.refusal.reason).toBe("claimed");
    expect(again.state.run.orders).toEqual(next.run.orders);
    // An old run's order, and an order the run did not roll.
    const stale = run(met, { type: "claim_order", run: 2, id: first.id });
    if (!stale.ok) expect(stale.refusal.reason).toBe("stale_run");
    const foreign = content.orders.orders.find((order) => !state.run.orders.ids.includes(order.id));
    const unknown = run(met, { type: "claim_order", run: 1, id: foreign?.id ?? "nope" });
    if (!unknown.ok) expect(unknown.refusal.reason).toBe("unknown");
  });

  it("queues a second drop behind the hourly gate and pays it an hour later", () => {
    let state = fresh(5);
    const dropOrders = ordersOf(content, state).filter((order) =>
      order.pays.some((pay) => "drop" in pay),
    );
    const [a, b] = dropOrders;
    if (!a || !b) throw new Error("need two drop orders");
    state = ok(run(meeting(state, a.id), { type: "claim_order", run: 1, id: a.id }));
    expect(state.meta.drops.held[1]).toBe(1);
    state = ok(run(meeting(state, b.id), { type: "claim_order", run: 1, id: b.id }, T0 + 60));
    expect(state.meta.drops.owed).toEqual({ earned: 2, paid: 1 });
    expect(state.meta.drops.held[1]).toBe(1);
    const later = run(state, { type: "ping" }, T0 + 3601);
    expect(later.state.meta.drops.owed).toEqual({ earned: 2, paid: 2 });
    expect(later.state.meta.drops.held[1]).toBe(2);
    expect(later.events).toContainEqual({
      type: "drop_earned",
      tier: 1,
      count: 1,
      source: "claims",
    });
  });

  it("fuels the set at the fifth claim, exactly once, and never locks anything", () => {
    let state = fresh(7);
    const orders = ordersOf(content, state);
    const events: string[] = [];
    for (const [i, order] of orders.entries()) {
      const result = run(
        meeting(state, order.id),
        { type: "claim_order", run: 1, id: order.id },
        T0 + i,
      );
      state = ok(result);
      events.push(...result.events.map((event) => event.type));
      expect(fuelled(content, state)).toBe(i + 1 >= content.orders.fuel);
      expect(state.run.orders.fuelledAt).toBe(
        i + 1 >= content.orders.fuel ? T0 + content.orders.fuel - 1 : null,
      );
    }
    expect(events.filter((type) => type === "orders_fuelled")).toHaveLength(1);
    expect(state.run.orders.claimed).toHaveLength(content.orders.perRun);
    expect(state.meta.stats.orders).toBe(content.orders.perRun);
  });

  it("shows progress for counting orders and none for an era", () => {
    const state = withRun(fresh(2), { taps: 120 });
    const taps = content.orders.orders.find((order) => order.id === "twig_taps_300");
    const era = content.orders.orders.find((order) => order.id === "wood_era");
    if (!taps || !era) throw new Error("fixtures");
    expect(orderProgress(content, state, taps)).toEqual({ value: 120, goal: 300 });
    expect(orderProgress(content, state, era)).toBeNull();
  });
});
