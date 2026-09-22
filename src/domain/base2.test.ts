/** Phase 2 rules: builds, upkeep and decay, furnaces, crafting, boxes. */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { Locale } from "../ui/locale";
import type { Tier } from "../ui/theme";
import {
  accrued,
  type BaseState,
  buyFurnace,
  collectFurnaces,
  craft,
  furnaceReady,
  isDecaying,
  jobEndsAt,
  newBase,
  settle,
  smelt,
  startBuild,
  storageCap,
  tierOf,
  total,
  upkeepCoverHours,
  workbenchLevel,
} from "./base";

const paths = discoverPaths();
const content = loadContent(paths.data, Locale.load(join(paths.locale, "en.json")));
const T0 = 1_700_000_000;
const HOUR = 3600;
const wood = tierOf(content, "wood");
const stone = tierOf(content, "stone");

const rich = (extra: Record<string, number>, tier: Tier = "twig"): BaseState => ({
  ...newBase(content, T0),
  tier,
  stock: { wood: 0, stone: 0, ...extra },
});

describe("builds", () => {
  it("twig -> wood is instant and starts upkeep from now", () => {
    const result = startBuild(content, rich({ wood: 2000, stone: 1000 }), T0);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.state.tier).toBe("wood");
    expect(result.state.build).toBeNull();
    expect(result.state.stock).toMatchObject({ wood: 2000 - (wood.cost.wood ?? 0) });
    expect(result.state.upkeepPaidUntil).toBe(T0);
  });

  it("wood -> stone runs a timer that settle completes, once", () => {
    const start = startBuild(
      content,
      rich({ stone: 10000, metal_fragments: 2000, wood: 5000 }, "wood"),
      T0,
    );
    if (!start.ok) throw new Error("expected ok");
    expect(start.state.tier).toBe("wood");
    expect(start.state.build).toEqual({ tier: "stone", endsAt: T0 + stone.buildMinutes * 60 });
    expect(startBuild(content, start.state, T0 + 1)).toMatchObject({
      ok: false,
      reason: "building",
    });

    const early = settle(content, start.state, T0 + 60);
    expect(early.state.tier).toBe("wood");
    const done = settle(content, start.state, start.endsAt);
    expect(done.state.tier).toBe("stone");
    expect(done.events[0]).toEqual({ type: "build_done", tier: "stone" });
    expect(settle(content, done.state, start.endsAt).events).toEqual([]);
  });

  it("refuses when unaffordable and at the top", () => {
    expect(startBuild(content, rich({}), T0)).toMatchObject({ ok: false, reason: "unaffordable" });
    expect(startBuild(content, { ...rich({ hqm: 1e6 }), tier: "hqm" }, T0)).toEqual({
      ok: false,
      reason: "maxed",
    });
  });
});

describe("upkeep and decay", () => {
  it("costs nothing on twig", () => {
    const base = newBase(content, T0);
    const later = settle(content, base, T0 + 100 * HOUR);
    expect(later.state.stock).toEqual(base.stock);
    expect(isDecaying(content, later.state, T0 + 100 * HOUR)).toBe(false);
  });

  it("pays hour by hour from stock and stays healthy", () => {
    const base = rich({ wood: 1000, stone: 100 }, "wood");
    const later = settle(content, base, T0 + 5 * HOUR + 1800);
    expect(later.state.stock.wood).toBe(1000 - 5 * (wood.upkeep.wood ?? 0));
    expect(later.state.upkeepPaidUntil).toBe(T0 + 5 * HOUR);
    expect(later.events).toEqual([{ type: "upkeep_paid", hours: 5, paid: { wood: 150 } }]);
    // Paid in whole hours: a healthy base is never "decaying" between two payments.
    expect(isDecaying(content, later.state, T0 + 5 * HOUR + 1800)).toBe(false);
    expect(isDecaying(content, later.state, T0 + 6 * HOUR)).toBe(true);
    expect(upkeepCoverHours(content, later.state)).toBe(Math.floor(850 / 30));
  });

  it("pulls from the nodes when stock is short, then halves production while unpaid", () => {
    // Wood tier costs 30 wood/h; the rock gathers 120/h, so nodes cover it.
    const base = rich({ wood: 0, stone: 0 }, "wood");
    const later = settle(content, base, T0 + 10 * HOUR);
    expect(later.events[0]).toMatchObject({ type: "auto_collect" });
    expect(later.events[1]).toMatchObject({ type: "upkeep_paid", hours: 10 });
    expect(later.state.stock.wood).toBe(1200 - 300);
    expect(later.state.upkeepPaidUntil).toBe(T0 + 10 * HOUR);

    // Stone tier wants 100 stone/h; the rock's 80/h covers one of two hours.
    const broke = { ...rich({}, "stone"), toolId: "rock" };
    const settled = settle(content, broke, T0 + 2 * HOUR);
    expect(settled.state.upkeepPaidUntil).toBe(T0 + HOUR);
    expect(settled.events.map((event) => event.type)).toEqual(["auto_collect", "upkeep_paid"]);
    // Unpaid since T0: the first hour is a grace hour, the second produces at half rate.
    const healthy = accrued(
      content,
      { ...broke, upkeepPaidUntil: T0 + HOUR, lastCollectedAt: T0 },
      T0 + 2 * HOUR,
    );
    const decayed = accrued(
      content,
      { ...broke, upkeepPaidUntil: T0, lastCollectedAt: T0 },
      T0 + 2 * HOUR,
    );
    expect(total(decayed)).toBe(total(healthy) * 0.75);
  });

  it("drops one tier after 72 unpaid hours, then restarts the clock", () => {
    // Metal tier wants metal fragments, which no tool gathers: nothing can be paid.
    const broke = rich({}, "metal");
    const almost = settle(content, broke, T0 + 71 * HOUR);
    expect(almost.state.tier).toBe("metal");
    const lost = settle(content, broke, T0 + 72 * HOUR);
    expect(lost.state.tier).toBe("stone");
    expect(lost.events.at(-1)).toEqual({ type: "decayed", from: "metal", to: "stone" });
    expect(lost.state.upkeepPaidUntil).toBe(T0 + 72 * HOUR);
    expect(settle(content, lost.state, T0 + 72 * HOUR).events).toEqual([]);
  });
});

describe("furnaces", () => {
  const furnace = content.furnaces[0];
  if (!furnace) throw new Error("no furnaces");

  it("is bought, then smelts all ore the fuel allows, then hands out output over time", () => {
    const bought = buyFurnace(content, rich({ wood: 5000, stone: 1000, metal_ore: 500 }, "stone"));
    if (!bought.ok) throw new Error("expected ok");
    expect(bought.state.furnaceId).toBe(furnace.id);

    const job = smelt(content, bought.state, T0, "metal_ore");
    if (!job.ok) throw new Error(`expected ok, got ${job.reason}`);
    expect(job.job).toMatchObject({ input: "metal_ore", output: "metal_fragments", amount: 500 });
    expect(job.fuel).toBe(250);
    expect(job.state.stock.metal_ore).toBe(0);
    expect(job.state.stock.metal_fragments).toBe(0);
    expect(smelt(content, job.state, T0, "metal_ore")).toEqual({
      ok: false,
      reason: "nothing_to_smelt",
    });
    expect(smelt(content, job.state, T0, "wood")).toEqual({ ok: false, reason: "not_ore" });
    // Stone tier runs two slots: a second job fits, a third does not.
    const more = { ...job.state, stock: { ...job.state.stock, metal_ore: 100 } };
    const second = smelt(content, more, T0, "metal_ore");
    if (!second.ok) throw new Error("expected ok");
    const third = { ...second.state, stock: { ...second.state.stock, metal_ore: 100 } };
    expect(smelt(content, third, T0, "metal_ore")).toEqual({ ok: false, reason: "no_slot" });

    // 120 ore/h: half done after 2.5 h.
    expect(furnaceReady(content, job.state, T0 + 2.5 * HOUR)).toEqual({ metal_fragments: 300 });
    const half = collectFurnaces(content, job.state, T0 + 2.5 * HOUR);
    expect(half.gained).toEqual({ metal_fragments: 300 });
    expect(half.state.furnaceJobs[0]?.collected).toBe(300);
    expect(collectFurnaces(content, half.state, T0 + 2.5 * HOUR).gained).toEqual({});

    const endsAt = jobEndsAt(furnace, job.job);
    const done = collectFurnaces(content, half.state, endsAt);
    expect(done.gained).toEqual({ metal_fragments: 200 });
    expect(done.state.furnaceJobs).toEqual([]);
    expect(done.state.stock.metal_fragments).toBe(500);
  });

  it("is limited by fuel and refuses with nothing to smelt", () => {
    const bought = buyFurnace(content, rich({ wood: 750, stone: 1000, metal_ore: 5000 }, "stone"));
    if (!bought.ok) throw new Error("expected ok");
    // 350 wood left after buying -> 700 ore worth of fuel.
    const job = smelt(content, bought.state, T0, "metal_ore");
    if (!job.ok) throw new Error("expected ok");
    expect(job.job.amount).toBe(700);
    expect(job.state.stock.wood).toBe(0);
    expect(smelt(content, { ...job.state, furnaceJobs: [] }, T0, "sulfur_ore")).toEqual({
      ok: false,
      reason: "nothing_to_smelt",
    });
  });

  it("cannot be bought above the tier's furnace type", () => {
    const base = { ...rich({ stone: 1e6, metal_fragments: 1e6 }), furnaceId: "furnace" };
    expect(buyFurnace(content, base)).toEqual({ ok: false, reason: "maxed" });
    expect(buyFurnace(content, { ...base, tier: "stone" })).toMatchObject({ ok: true });
  });
});

describe("crafting", () => {
  it("needs the workbench level and pays the recipe", () => {
    const base = rich({ wood: 2000, stone: 500 });
    expect(workbenchLevel(content, base)).toBe(0);
    expect(craft(content, base, "wood_box")).toMatchObject({
      ok: false,
      reason: "workbench",
      needed: 1,
      have: 0,
    });

    const bench = craft(content, base, "workbench_1");
    if (!bench.ok) throw new Error("expected ok");
    expect(bench.state.items).toEqual({ workbench_1: 1 });
    expect(workbenchLevel(content, bench.state)).toBe(1);

    const box = craft(content, bench.state, "wood_box");
    if (!box.ok) throw new Error("expected ok");
    expect(box.state.items.wood_box).toBe(1);
    expect(storageCap(content, box.state)).toBe(1500 + 1000);
    expect(craft(content, bench.state, "ak47")).toMatchObject({ ok: false, reason: "workbench" });
    expect(craft(content, bench.state, "nope")).toEqual({ ok: false, reason: "unknown" });
  });

  it("caps boxes at the tier's slots and the workbench at the tier's level", () => {
    let state = rich({ wood: 100000, stone: 5000 });
    state = { ...state, items: { workbench_1: 1, workbench_3: 1 } };
    expect(workbenchLevel(content, state)).toBe(tierOf(content, "twig").workbenchLevel);
    for (let i = 0; i < tierOf(content, "twig").boxSlots; i++) {
      const result = craft(content, state, "wood_box");
      if (!result.ok) throw new Error("expected ok");
      state = result.state;
    }
    expect(craft(content, state, "wood_box")).toMatchObject({ ok: false, reason: "box_slots" });
    expect(storageCap(content, state)).toBe(1500 + 2 * 1000);
  });
});
