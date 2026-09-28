/** Builds, upkeep and decay, furnaces. */

import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Tier } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import {
  accrued,
  type BaseState,
  buyFurnace,
  collectFurnaces,
  furnaceReady,
  isDecaying,
  jobEndsAt,
  newBase,
  settle,
  smelt,
  startBuild,
  tierOf,
  total,
  upkeepCoverHours,
} from "./base";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;
const wood = tierOf(content, "wood");
const stone = tierOf(content, "stone");

const rich = (extra: Record<string, number>, tier: Tier = "twig"): BaseState => ({
  ...newBase(content, T0, 1),
  tier,
  stock: { timber: 0, stone: 0, ...extra },
});

describe("builds", () => {
  it("twig -> wood is instant and starts upkeep from now", () => {
    const result = startBuild(content, rich({ timber: 2000, stone: 1000 }), T0);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.state.tier).toBe("wood");
    expect(result.state.build).toBeNull();
    expect(result.state.stock).toMatchObject({ timber: 2000 - (wood.cost.timber ?? 0) });
    expect(result.state.upkeepPaidUntil).toBe(T0);
  });

  it("wood -> stone runs a timer that settle completes, once", () => {
    const start = startBuild(
      content,
      rich({ stone: 10000, ingots: 2000, timber: 5000 }, "wood"),
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
    expect(startBuild(content, { ...rich({ fuel: 1e6 }), tier: "hqm" }, T0)).toEqual({
      ok: false,
      reason: "maxed",
    });
  });
});

describe("upkeep and decay", () => {
  it("costs nothing on twig", () => {
    const base = newBase(content, T0, 1);
    const later = settle(content, base, T0 + 100 * HOUR);
    expect(later.state.stock).toEqual(base.stock);
    expect(isDecaying(content, later.state, T0 + 100 * HOUR)).toBe(false);
  });

  it("pays hour by hour from stock and stays healthy", () => {
    const base = rich({ timber: 1000, stone: 100 }, "wood");
    const later = settle(content, base, T0 + 5 * HOUR + 1800);
    expect(later.state.stock.timber).toBe(1000 - 5 * (wood.upkeep.timber ?? 0));
    expect(later.state.upkeepPaidUntil).toBe(T0 + 5 * HOUR);
    expect(later.events).toEqual([{ type: "upkeep_paid", hours: 5, paid: { timber: 150 } }]);
    // Paid in whole hours: a healthy base is never "decaying" between two payments.
    expect(isDecaying(content, later.state, T0 + 5 * HOUR + 1800)).toBe(false);
    expect(isDecaying(content, later.state, T0 + 6 * HOUR)).toBe(true);
    expect(upkeepCoverHours(content, later.state)).toBe(Math.floor(850 / 30));
  });

  it("pulls from the nodes when stock is short, then halves production while unpaid", () => {
    // Timber tier costs 30 timber/h; the rock gathers 120/h, so nodes cover it.
    const base = rich({ timber: 0, stone: 0 }, "wood");
    const later = settle(content, base, T0 + 10 * HOUR);
    expect(later.events[0]).toMatchObject({ type: "auto_collect" });
    expect(later.events[1]).toMatchObject({ type: "upkeep_paid", hours: 10 });
    expect(later.state.stock.timber).toBe(1200 - 300);
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
    // Metal tier wants ingots, which no tool gathers: nothing can be paid.
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
    const bought = buyFurnace(content, rich({ timber: 5000, stone: 1000, ore: 500 }, "stone"));
    if (!bought.ok) throw new Error("expected ok");
    expect(bought.state.furnaceId).toBe(furnace.id);

    const job = smelt(content, bought.state, T0, "ore");
    if (!job.ok) throw new Error(`expected ok, got ${job.reason}`);
    expect(job.job).toMatchObject({ input: "ore", output: "ingots", amount: 500 });
    expect(job.fuel).toBe(250);
    expect(job.state.stock.ore).toBe(0);
    expect(job.state.stock.ingots).toBe(0);
    expect(smelt(content, job.state, T0, "ore")).toEqual({
      ok: false,
      reason: "nothing_to_smelt",
    });
    expect(smelt(content, job.state, T0, "timber")).toEqual({ ok: false, reason: "not_ore" });
    // Stone tier runs two slots: a second job fits, a third does not.
    const more = { ...job.state, stock: { ...job.state.stock, ore: 100 } };
    const second = smelt(content, more, T0, "ore");
    if (!second.ok) throw new Error("expected ok");
    const third = { ...second.state, stock: { ...second.state.stock, ore: 100 } };
    expect(smelt(content, third, T0, "ore")).toEqual({ ok: false, reason: "no_slot" });

    // 120 ore/h: half done after 2.5 h.
    expect(furnaceReady(content, job.state, T0 + 2.5 * HOUR)).toEqual({ ingots: 300 });
    const half = collectFurnaces(content, job.state, T0 + 2.5 * HOUR);
    expect(half.gained).toEqual({ ingots: 300 });
    expect(half.state.furnaceJobs[0]?.collected).toBe(300);
    expect(collectFurnaces(content, half.state, T0 + 2.5 * HOUR).gained).toEqual({});

    const endsAt = jobEndsAt(furnace, job.job);
    const done = collectFurnaces(content, half.state, endsAt);
    expect(done.gained).toEqual({ ingots: 200 });
    expect(done.state.furnaceJobs).toEqual([]);
    expect(done.state.stock.ingots).toBe(500);
  });

  it("is limited by fuel and refuses with nothing to smelt", () => {
    const bought = buyFurnace(content, rich({ timber: 750, stone: 1000, ore: 5000 }, "stone"));
    if (!bought.ok) throw new Error("expected ok");
    // 350 timber left after buying -> 700 ore worth of fuel.
    const job = smelt(content, bought.state, T0, "ore");
    if (!job.ok) throw new Error("expected ok");
    expect(job.job.amount).toBe(700);
    expect(job.state.stock.timber).toBe(0);
    expect(smelt(content, { ...job.state, furnaceJobs: [] }, T0, "sulfur_ore")).toEqual({
      ok: false,
      reason: "nothing_to_smelt",
    });
  });

  it("cannot be bought above the tier's furnace type", () => {
    const base = { ...rich({ stone: 1e6, ingots: 1e6 }), furnaceId: "furnace" };
    expect(buyFurnace(content, base)).toEqual({ ok: false, reason: "maxed" });
    expect(buyFurnace(content, { ...base, tier: "stone" })).toMatchObject({ ok: true });
  });
});
