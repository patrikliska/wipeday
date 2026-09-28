import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { settleBarrel } from "./active";
import {
  type BaseState,
  effectiveRates,
  fuelFor,
  furnaceOf,
  newBase,
  settle,
  smelt,
  storageCap,
  upkeepOf,
  workbenchLevel,
} from "./base";
import { buildingCount, buildStatus, startConstruction } from "./buildings";
import { craftSeconds } from "./craft";
import { haulLeft } from "./nodes";
import { normalizeState } from "./normalize";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;
const RICH = { timber: 1e6, stone: 1e6, ingots: 1e6, fibre: 1e6, fat: 1e6, fuel: 1e6, hide: 1e6 };

const at = (tier: BaseState["tier"], buildings: Record<string, number> = {}): BaseState => ({
  ...newBase(content, T0, 1),
  tier,
  buildings,
  stock: { ...RICH },
});

/** Builds `what` and lands it at once (settles past its timer). */
function built(state: BaseState, what: string): BaseState {
  const result = startConstruction(content, state, T0, what);
  if (!result.ok) throw new Error(`${what}: ${result.status.code}`);
  return settle(content, result.state, T0 + 30 * 24 * HOUR).state;
}

describe("construction", () => {
  it("builds a level on a builder and lands it when the time is up", () => {
    const base = at("wood");
    const started = startConstruction(content, base, T0, "warehouse");
    if (!started.ok) throw new Error("expected ok");
    expect(started.state.construction).toEqual([
      {
        target: { kind: "building", building: "warehouse", level: 1 },
        startedAt: T0,
        endsAt: T0 + 20 * 60,
      },
    ]);
    expect(buildStatus(content, started.state, "warehouse")).toEqual({
      code: "in_progress",
      endsAt: T0 + 20 * 60,
    });
    const landed = settle(content, started.state, T0 + 20 * 60);
    expect(landed.state.buildings).toEqual({ warehouse: 1 });
    expect(landed.events).toContainEqual({
      type: "building_done",
      building: "warehouse",
      level: 1,
    });
    expect(buildingCount(landed.state)).toBe(1);
  });

  it("has one builder, two from the Stone tier, and the tier shares them", () => {
    const wood = startConstruction(content, at("wood"), T0, "warehouse");
    if (!wood.ok) throw new Error("expected ok");
    expect(buildStatus(content, wood.state, "loom")).toEqual({
      code: "builders",
      endsAt: T0 + 20 * 60,
    });
    expect(buildStatus(content, wood.state, "tier")).toMatchObject({ code: "builders" });

    const stone = startConstruction(content, at("stone"), T0, "warehouse");
    if (!stone.ok) throw new Error("expected ok");
    expect(buildStatus(content, stone.state, "loom")).toEqual({ code: "ok" });
  });

  it("says which tier a building or level needs", () => {
    expect(buildStatus(content, at("twig"), "warehouse")).toEqual({ code: "tier", tier: "wood" });
    expect(buildStatus(content, at("wood", { workbench: 1 }), "workbench")).toEqual({
      code: "tier",
      tier: "stone",
    });
    expect(buildStatus(content, at("hqm", { workbench: 3 }), "workbench")).toEqual({
      code: "maxed",
    });
    expect(buildStatus(content, at("hqm"), "castle")).toEqual({ code: "unknown" });
  });
});

describe("effects", () => {
  it("room, flat and percent gathering", () => {
    const base = at("stone");
    expect(storageCap(content, built(base, "warehouse"))).toBe(storageCap(content, base) + 2000);
    const tool = { ...base, toolId: "stone_tools" };
    expect(effectiveRates(content, built(tool, "garden")).fibre).toBe(30 + 10);
    expect(effectiveRates(content, built(tool, "loom")).fibre).toBe(Math.floor(30 * 1.15));
    expect(effectiveRates(content, built(tool, "campfire")).timber).toBe(Math.floor(240 * 1.02));
  });

  it("furnace type from the furnace building, fuel from the kiln, speed from the generator", () => {
    const base = at("metal", { furnace: 1 });
    expect(furnaceOf(content, base)?.id).toBe("furnace");
    expect(furnaceOf(content, at("metal", { furnace: 2 }))?.id).toBe("large_furnace");
    const furnace = furnaceOf(content, base);
    if (!furnace) throw new Error("no furnace");
    expect(fuelFor(content, base, furnace, 100)).toBe(50);
    expect(fuelFor(content, built(base, "kiln"), furnace, 100)).toBe(40);
    const job = smelt(
      content,
      { ...built(base, "generator"), stock: { ...RICH, ore: 100 } },
      T0,
      "ore",
    );
    expect(job.ok && job.job.perHour).toBe(144);
  });

  it("workbench level, crafting speed, node haul and barrel life", () => {
    const base = at("stone");
    expect(workbenchLevel(content, base)).toBe(0);
    expect(workbenchLevel(content, built(base, "workbench"))).toBe(1);
    const bow = content.recipes.find((recipe) => recipe.item === "bow");
    if (!bow) throw new Error("no bow");
    expect(craftSeconds(content, built(base, "lights"), bow)).toBe(Math.round((600 * 100) / 110));
    expect(haulLeft(content, built(base, "bunkhouse"), T0).of).toBe(
      content.active.node.dailyHaulMinutes + 30,
    );
    const lookout = built(base, "watchtower");
    const barrel = settleBarrel(content, lookout, lookout.nextBarrelAt).state.barrel;
    expect(barrel && barrel.expiresAt - barrel.spawnedAt).toBe(
      (content.active.barrels.expiresMinutes + 15) * 60,
    );
  });

  it("adds building upkeep to the tier's", () => {
    const base = at("stone", { warehouse: 2 });
    expect(upkeepOf(content, base)).toEqual({ timber: 45, stone: 100 });
  });
});

describe("decay", () => {
  it("costs the dearest building a level before the tier", () => {
    // Metal tier wants ingots per hour, which no tool gathers: nothing can be paid.
    const base: BaseState = { ...at("metal", { walls: 1, garden: 2 }), stock: {} };
    const grace = content.baseRules.tierLossAfterHours + 12;
    expect(settle(content, base, T0 + (grace - 1) * HOUR).state.buildings).toEqual({
      walls: 1,
      garden: 2,
    });
    const lost = settle(content, base, T0 + grace * HOUR);
    expect(lost.state.tier).toBe("metal");
    expect(lost.state.buildings).toEqual({ garden: 2 });
    expect(lost.events.at(-1)).toEqual({ type: "building_decayed", building: "walls", level: 0 });
  });
});

describe("normalizeState", () => {
  it("turns W1 station items, the furnace and a tier build into buildings and a construction", () => {
    const { buildings: _b, construction: _c, ...w1 } = newBase(content, T0, 1);
    const stored = {
      ...w1,
      tier: "wood",
      items: { workbench_1: 1, campfire: 1, lantern: 1, crate: 2 },
      furnaceId: "furnace",
      build: { tier: "stone", endsAt: T0 + 4 * HOUR },
      furnaceJobs: [{ input: "ore", output: "ingots", amount: 100, startedAt: T0, collected: 0 }],
    };
    const state = normalizeState(content, stored);
    expect(state.buildings).toEqual({ workbench: 1, campfire: 1, lights: 1, furnace: 1 });
    expect(state.items).toEqual({ crate: 2 });
    expect(state.construction).toEqual([
      { target: { kind: "tier", tier: "stone" }, startedAt: T0, endsAt: T0 + 4 * HOUR },
    ]);
    expect(state.furnaceJobs[0]?.perHour).toBe(120);
    expect("furnaceId" in state).toBe(false);
    expect(normalizeState(content, state)).toEqual(state);
  });
});
