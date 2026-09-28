import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase, storageCap, tierOf, workbenchLevel } from "./base";
import { craftOptions, craftStatus, queueCraft, settleCrafts } from "./craft";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const rich = (
  extra: Record<string, number> = {},
  items: Record<string, number> = {},
): BaseState => ({
  ...newBase(content, T0, 1),
  stock: {
    timber: 100_000,
    stone: 100_000,
    ingots: 100_000,
    fibre: 1000,
    hide: 1000,
    fuel: 1000,
    ...extra,
  },
  items,
});

describe("crafting", () => {
  it("needs the workbench level; an instant recipe lands at once", () => {
    const base = rich();
    expect(workbenchLevel(content, base)).toBe(0);
    expect(craftStatus(content, base, "crate")).toEqual({ code: "workbench", needed: 1, have: 0 });

    const bench = queueCraft(content, base, "workbench_1", T0);
    if (!bench.ok) throw new Error(`expected ok, got ${bench.status.code}`);
    expect(bench.state.items).toEqual({ workbench_1: 1 });
    expect(bench.state.craftQueue).toEqual([]);
    expect(bench.events.map((event) => event.type)).toEqual(["craft_queued", "crafted"]);
    expect(workbenchLevel(content, bench.state)).toBe(1);

    const crate = queueCraft(content, bench.state, "crate", T0);
    if (!crate.ok) throw new Error("expected ok");
    expect(storageCap(content, crate.state)).toBe(1500 + 1000);
    expect(craftStatus(content, bench.state, "nope")).toEqual({ code: "unknown" });
  });

  it("queues timed recipes one after another and lands them on settle", () => {
    const base = rich({}, { workbench_1: 1 });
    const bow = queueCraft(content, base, "bow", T0);
    if (!bow.ok) throw new Error("expected ok");
    expect(bow.job.endsAt).toBe(T0 + 10 * 60);
    const vest = queueCraft(content, bow.state, "hide_vest", T0 + 60);
    if (!vest.ok) throw new Error("expected ok");
    // Starts when the bow is done, not when it was queued.
    expect(vest.job.endsAt).toBe(T0 + 20 * 60);

    const early = settleCrafts(vest.state, T0 + 10 * 60 - 1);
    expect(early.events).toEqual([]);
    const one = settleCrafts(vest.state, T0 + 10 * 60);
    expect(one.state.items.bow).toBe(1);
    expect(one.state.craftQueue.map((job) => job.item)).toEqual(["hide_vest"]);
    const both = settleCrafts(vest.state, T0 + 3600);
    expect(both.events).toEqual([
      { type: "crafted", item: "bow" },
      { type: "crafted", item: "hide_vest" },
    ]);
    expect(settleCrafts(both.state, T0 + 3600).events).toEqual([]);
  });

  it("refuses a second station, a full queue, full crate slots and short stock", () => {
    const base = rich({}, { workbench_1: 1, campfire: 1 });
    expect(craftStatus(content, base, "campfire")).toEqual({ code: "owned" });

    let state = base;
    for (let i = 0; i < content.baseRules.craftQueueSize; i++) {
      const result = queueCraft(content, state, "bow", T0);
      if (!result.ok) throw new Error("expected ok");
      state = result.state;
    }
    expect(craftStatus(content, state, "bow")).toEqual({
      code: "queue_full",
      size: content.baseRules.craftQueueSize,
    });
    // A station waiting in the queue already counts as owned.
    const kiln = queueCraft(content, rich({}, { workbench_1: 1 }), "kiln", T0);
    if (!kiln.ok) throw new Error("expected ok");
    expect(craftStatus(content, kiln.state, "kiln")).toEqual({ code: "owned" });

    const slots = tierOf(content, "twig").boxSlots;
    expect(craftStatus(content, rich({}, { workbench_1: 1, crate: slots }), "crate")).toEqual({
      code: "box_slots",
      slots,
    });
    expect(craftStatus(content, { ...rich({}, { workbench_1: 1 }), stock: {} }, "crate")).toEqual({
      code: "unaffordable",
      missing: { timber: 300 },
    });
  });

  it("lists every recipe with its status for the craft panel", () => {
    const options = craftOptions(content, rich({}, { workbench_1: 1 }));
    expect(options).toHaveLength(content.recipes.length);
    expect(options.find((option) => option.item.id === "workbench_1")?.status).toEqual({
      code: "owned",
    });
    expect(options.find((option) => option.item.id === "spear")?.status).toMatchObject({
      code: "workbench",
      needed: 2,
    });
  });
});
