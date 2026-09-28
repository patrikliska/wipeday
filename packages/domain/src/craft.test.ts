import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { breakBarrel } from "./active";
import { type BaseState, gather, newBase, storageCap, tierOf } from "./base";
import { applyCommand } from "./commands";
import {
  boostPercent,
  cancelCraft,
  craftStatus,
  maxBatch,
  nextCraftAt,
  queueCraft,
  salvage,
  salvageValue,
  serve,
  settleCrafts,
  unitSeconds,
} from "./craft";
import { normalizeState } from "./normalize";
import { expandNeeds, partsToMake, recipeFor, sourcesOf, usesOf } from "./recipes";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;

const rich = (
  buildings: Record<string, number> = { workbench: 1 },
  extra: Record<string, number> = {},
): BaseState => ({
  ...newBase(content, T0, 1),
  tier: "stone",
  stock: {
    timber: 100_000,
    stone: 100_000,
    ingots: 100_000,
    fibre: 10_000,
    hide: 10_000,
    fat: 10_000,
    food: 10_000,
    ...extra,
  },
  buildings,
});

function recipe(output: string) {
  const found = recipeFor(content, output);
  if (!found) throw new Error(`no recipe for ${output}`);
  return found;
}

function queued(state: BaseState, output: string, count: number, now = T0): BaseState {
  const result = queueCraft(content, state, output, count, now);
  if (!result.ok) throw new Error(`${output}: ${result.status.code}`);
  return result.state;
}

describe("stations", () => {
  it("need their building, its level, and the blueprint when the recipe has one", () => {
    expect(craftStatus(content, rich({}), "planks")).toEqual({
      code: "station",
      station: "workbench",
    });
    expect(craftStatus(content, rich(), "plates")).toEqual({
      code: "workbench",
      station: "workbench",
      needed: 2,
      have: 1,
    });
    expect(craftStatus(content, rich({ workbench: 2 }), "strongbox")).toEqual({
      code: "blueprint",
    });
    const found = {
      ...rich({ workbench: 2 }, { planks: 1000, plates: 1000, frames: 100 }),
      blueprints: ["strongbox"],
    };
    expect(craftStatus(content, found, "strongbox")).toEqual({ code: "ok" });
  });

  it("pays a batch up front and lands its units one by one, parts into stock", () => {
    const planks = recipe("planks");
    const state = queued(rich(), "planks", 3);
    expect(state.stock.timber).toBe(100_000 - 3 * 60);
    const unit = unitSeconds(content, state, planks);
    expect(unit).toBe(planks.minutes * 60);
    expect(nextCraftAt(state)).toBe(T0 + unit);

    const one = settleCrafts(content, state, T0 + unit + 5);
    expect(one.state.stock.planks).toBe(10);
    expect(one.events).toEqual([
      {
        type: "crafted",
        recipe: "planks",
        station: "workbench",
        amount: 10,
        at: T0 + unit,
        done: false,
      },
    ]);
    expect(one.state.production.workbench?.[0]?.done).toBe(1);
    // Settling again at the same moment changes nothing.
    expect(settleCrafts(content, one.state, T0 + unit + 5).state).toBe(one.state);

    const all = settleCrafts(content, one.state, T0 + 3 * unit);
    expect(all.state.stock.planks).toBe(30);
    expect(all.state.production).toEqual({});
  });

  it("runs every station at once, and jobs at one station end to end", () => {
    let state = queued(rich({ workbench: 1, loom: 1 }, { planks: 100, rope: 50 }), "planks", 2);
    state = queued(state, "bow", 1);
    state = queued(state, "rope", 2);
    const plank = unitSeconds(content, state, recipe("planks"));
    expect(state.production.workbench?.[1]?.startedAt).toBe(T0 + 2 * plank);
    expect(state.production.loom?.[0]?.startedAt).toBe(T0);
    const later = settleCrafts(content, state, T0 + 10 * HOUR).state;
    expect(later.items.bow).toBe(1);
    expect(later.stock.rope).toBe(50 - 5 + 10);
  });

  it("level sets queue slots and batch size; the lights speed units up", () => {
    const slots = content.crafting.queueSlots[0] ?? 1;
    let state = rich();
    for (let job = 0; job < slots; job++) state = queued(state, "planks", 1);
    expect(craftStatus(content, state, "planks")).toMatchObject({
      code: "queue_full",
      size: slots,
    });
    const size = content.crafting.batchSize[0] ?? 1;
    expect(craftStatus(content, rich(), "planks", size + 1)).toEqual({
      code: "batch",
      station: "workbench",
      size,
    });
    expect(maxBatch(content, rich(), "planks")).toBe(size);
    expect(maxBatch(content, rich({ workbench: 1 }, { timber: 125 }), "planks")).toBe(2);
    const lit = rich({ workbench: 1, lights: 1 });
    expect(unitSeconds(content, lit, recipe("bow"))).toBe(Math.round((600 * 100) / 110));
  });

  it("counts queued crates against the crate slots", () => {
    const slots = tierOf(content, "stone").boxSlots;
    const state = rich({ workbench: 1 }, { planks: 100_000 });
    expect(maxBatch(content, state, "crate")).toBe(
      Math.min(slots, content.crafting.batchSize[0] ?? 0),
    );
    const crates = { ...state, items: { crate: slots - 1 } };
    expect(craftStatus(content, crates, "crate", 2)).toEqual({ code: "box_slots", slots });
    const after = settleCrafts(content, queued(crates, "crate", 1), T0 + HOUR).state;
    expect(storageCap(content, after)).toBe(storageCap(content, crates) + 1000);
  });

  it("cancel refunds the units not made and moves the jobs behind up", () => {
    let state = queued(rich({ workbench: 1 }, { planks: 100, rope: 50 }), "planks", 4);
    state = queued(state, "bow", 1);
    const unit = unitSeconds(content, state, recipe("planks"));
    const settled = settleCrafts(content, state, T0 + unit + 1).state;
    const cancelled = cancelCraft(content, settled, "workbench", 0, T0 + unit + 1);
    if (!cancelled.ok) throw new Error("expected ok");
    expect(cancelled.refunded).toEqual({ timber: 3 * 60 });
    expect(cancelled.state.stock.planks).toBe(100 - 10 + 10);
    expect(cancelled.state.production.workbench).toMatchObject([
      { recipe: "bow", startedAt: T0 + unit + 1 },
    ]);
    expect(cancelCraft(content, cancelled.state, "workbench", 5, T0)).toEqual({
      ok: false,
      reason: "no_job",
    });
  });
});

describe("the web", () => {
  it("says where things come from and what they are for", () => {
    expect(sourcesOf(content, "planks")[0]).toMatchObject({ kind: "recipe" });
    expect(sourcesOf(content, "ingots")).toContainEqual({ kind: "furnace", ore: "ore" });
    expect(sourcesOf(content, "food")).toContainEqual({ kind: "building", building: "garden" });
    expect(usesOf(content, "planks")).toContainEqual({ kind: "tier", tier: "stone" });
    expect(usesOf(content, "rope")).toContainEqual({ kind: "recipe", output: "bow" });
  });

  it("breaks a cost down into parts to make, deepest first, counting stock once", () => {
    // Frames need planks: 4 frames = 2 units = 20 planks (10 in stock) + 16 ingots.
    const needs = expandNeeds(content, { planks: 10, ingots: 100 }, { frames: 4 });
    expect(needs[0]).toMatchObject({ id: "frames", need: 4, have: 0, make: { units: 2 } });
    expect(needs[0]?.parts).toMatchObject([
      { id: "planks", need: 20, have: 10, make: { units: 1 } },
      { id: "ingots", need: 16, have: 100 },
    ]);
    const order = partsToMake(content, { planks: 10, ingots: 100 }, { frames: 4 });
    expect(order.map((step) => [step.recipe.output, step.units])).toEqual([
      ["planks", 1],
      ["frames", 2],
    ]);
  });
});

describe("salvage and meals", () => {
  it("salvage returns a share of the recipe plus scrap, parts uncapped", () => {
    const value = salvageValue(content, "bow", 2);
    expect(value).toEqual({ planks: 8, rope: 4, scrap: 4 });
    const state = { ...rich(), items: { bow: 2 } };
    const result = salvage(content, state, "bow", 2);
    if (!result.ok) throw new Error("expected ok");
    expect(result.state.items.bow).toBeUndefined();
    expect(result.state.stock.planks).toBe(8);
    expect(salvage(content, state, "bow", 3)).toEqual({ ok: false, reason: "not_owned" });
  });

  it("a served meal boosts Gather for its hours; a weaker one cannot cut it short", () => {
    const base: BaseState = { ...rich({}), stock: {}, items: { roast: 1, stew: 1 } };
    const plain = gather(content, base, T0);
    const fedStew = serve(content, base, "stew", T0);
    if (!fedStew.ok) throw new Error("expected ok");
    expect(boostPercent(fedStew.state, T0 + 1)).toBe(20);
    expect(boostPercent(fedStew.state, T0 + 6 * HOUR)).toBe(0);
    const boosted = gather(content, fedStew.state, T0);
    if (!plain.ok || !boosted.ok) throw new Error("expected ok");
    expect(boosted.bonus.timber).toBe(Math.floor(((plain.bonus.timber ?? 0) * 120) / 100));
    expect(serve(content, fedStew.state, "roast", T0 + 60)).toEqual({
      ok: false,
      reason: "fed_better",
      until: T0 + 6 * HOUR,
    });
    expect(serve(content, base, "bow", T0)).toEqual({ ok: false, reason: "not_meal" });
  });
});

describe("blueprints", () => {
  it("barrels sometimes hold one the base does not know, the same roll every replay", () => {
    let found = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const state: BaseState = {
        ...newBase(content, T0, seed),
        barrel: { spawnedAt: T0, expiresAt: T0 + 600, seed },
      };
      const result = breakBarrel(content, state, T0);
      if (!result.ok) throw new Error("expected ok");
      expect(breakBarrel(content, state, T0)).toEqual(result);
      if (result.blueprint) {
        found++;
        expect(result.state.blueprints).toEqual([result.blueprint]);
        expect(recipeFor(content, result.blueprint)?.blueprint).toBe(true);
      }
    }
    const percent = content.crafting.blueprints.barrelPercent;
    expect(found).toBeGreaterThan(percent);
    expect(found).toBeLessThan(percent * 4);
  });
});

describe("commands", () => {
  it("craft, cancel, salvage and serve go through applyCommand; a retry is idempotent", () => {
    const craft = applyCommand(content, rich(), { type: "craft", recipe: "planks", count: 2 }, T0);
    if (!craft.ok) throw new Error("expected ok");
    expect(craft.events.map((event) => event.type)).toContain("craft_queued");
    expect(craft.state.tasks.progress.craft_1).toBe(1);
    const cancel = applyCommand(
      content,
      craft.state,
      { type: "cancel_craft", station: "workbench", index: 0 },
      T0 + 10,
    );
    expect(cancel.ok && cancel.state.stock.timber).toBe(100_000);
    const again = applyCommand(
      content,
      cancel.state,
      { type: "cancel_craft", station: "workbench", index: 0 },
      T0 + 11,
    );
    expect(again).toMatchObject({ ok: false, refusal: { code: "no_job" } });
    const tooMany = applyCommand(
      content,
      rich(),
      { type: "craft", recipe: "planks", count: 999 },
      T0,
    );
    expect(tooMany).toMatchObject({ ok: false, refusal: { code: "batch" } });
    const eat = applyCommand(
      content,
      { ...rich(), items: { roast: 1 } },
      { type: "serve", meal: "roast" },
      T0,
    );
    expect(eat.ok && eat.state.wellFed).toEqual({ percent: 10, until: T0 + 4 * HOUR });
  });

  it("an old single-item queue lands at once when a W2 state loads", () => {
    const { production: _p, blueprints: _b, wellFed: _w, ...old } = rich();
    const stored = {
      ...old,
      items: { hide_vest: 1 },
      craftQueue: [
        { item: "bow", endsAt: T0 + 60 },
        { item: "hide_vest", endsAt: T0 + 120 },
      ],
    };
    const state = normalizeState(content, stored);
    expect(state.items).toEqual({ bow: 1, leather_vest: 2 });
    expect(state.production).toEqual({});
    expect(state.blueprints).toEqual([]);
    expect(state.wellFed).toBeNull();
    expect("craftQueue" in state).toBe(false);
  });
});
