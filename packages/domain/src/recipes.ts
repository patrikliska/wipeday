/**
 * The crafting web as a graph: which recipe makes what, where anything comes
 * from, what it is for, and what a cost comes down to once parts are broken
 * into what they are made of. The craft panel's "how do I get this" tree, the
 * advisor's "make planks first" and the simulator's planner all read this.
 */
import type { Amounts, Content, Recipe } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import type { BaseState } from "./base";
import { type Rng, rng, seedOf } from "./rng";

export function recipeFor(content: Content, output: string): Recipe | undefined {
  return content.recipes.find((recipe) => recipe.output === output);
}

/** The level a station building stands at; 0 = not built. */
export function stationLevel(state: Pick<BaseState, "buildings">, station: string): number {
  return state.buildings[station] ?? 0;
}

/** Stations in the order the craft panel shows them: the order recipes first name them. */
export function stations(content: Content): string[] {
  return [...new Set(content.recipes.map((recipe) => recipe.station))];
}

/** Whether the base knows `recipe`: no blueprint needed, or the blueprint was found. */
export function knows(state: Pick<BaseState, "blueprints">, recipe: Recipe): boolean {
  return !recipe.blueprint || state.blueprints.includes(recipe.output);
}

/** Whether `id` is a part (made at a station, kept in stock, not capped). */
export function isPart(content: Content, id: string): boolean {
  return content.resources.some((resource) => resource.id === id && resource.kind === "part");
}

// --- where things come from ---------------------------------------------------------

export type Source =
  /** Gathered: the first tool that produces it. */
  | { kind: "tool"; tool: string }
  /** Grown or caught by a building on its own (garden, dock). */
  | { kind: "building"; building: string }
  /** Smelted from an ore. */
  | { kind: "furnace"; ore: string }
  | { kind: "recipe"; recipe: Recipe }
  | { kind: "barrel" }
  | { kind: "task" };

/** Every way to get `id`, the most direct first. */
export function sourcesOf(content: Content, id: string): Source[] {
  const out: Source[] = [];
  const recipe = recipeFor(content, id);
  if (recipe) out.push({ kind: "recipe", recipe });
  const ore = content.resources.find((resource) => resource.smeltsInto === id);
  if (ore) out.push({ kind: "furnace", ore: ore.id });
  const tool = content.tools.find((candidate) => (candidate.rates[id] ?? 0) > 0);
  if (tool) out.push({ kind: "tool", tool: tool.id });
  const building = content.buildings.find((candidate) =>
    candidate.levels.some((level) => (level.effects.flat?.[id] ?? 0) > 0),
  );
  if (building) out.push({ kind: "building", building: building.id });
  if (content.active.barrels.loot.some((entry) => entry.resource === id))
    out.push({ kind: "barrel" });
  if (content.active.tasks.pool.some((task) => (task.reward[id] ?? 0) > 0))
    out.push({ kind: "task" });
  return out;
}

export type Use =
  | { kind: "tier"; tier: Tier }
  | { kind: "tool"; tool: string }
  | { kind: "building"; building: string; level: number }
  | { kind: "recipe"; output: string };

/** Everything `id` goes into: tiers, tools, building levels and other recipes. */
export function usesOf(content: Content, id: string): Use[] {
  const out: Use[] = [];
  for (const tier of content.baseTiers) {
    if ((tier.cost[id] ?? 0) > 0) out.push({ kind: "tier", tier: tier.id });
  }
  for (const tool of content.tools) {
    if ((tool.cost[id] ?? 0) > 0) out.push({ kind: "tool", tool: tool.id });
  }
  for (const building of content.buildings) {
    for (const [index, level] of building.levels.entries()) {
      if ((level.cost[id] ?? 0) > 0)
        out.push({ kind: "building", building: building.id, level: index + 1 });
    }
  }
  for (const recipe of content.recipes) {
    if ((recipe.cost[id] ?? 0) > 0) out.push({ kind: "recipe", output: recipe.output });
  }
  return out;
}

// --- what a cost comes down to ------------------------------------------------------

export interface Need {
  id: string;
  /** How much the cost asks for. */
  need: number;
  have: number;
  /** When short and there is a recipe: how many units of it cover the gap. */
  make?: { recipe: Recipe; units: number };
  /** What those units cost, broken down the same way. */
  parts: Need[];
}

/**
 * `cost` as a tree: each entry with what the base has, and, for anything short
 * that a recipe makes, the units to make and what they need in turn. Stock is
 * shared down the tree (planks counted once for frames are not counted again).
 */
export function expandNeeds(content: Content, stock: Amounts, cost: Amounts): Need[] {
  const left: Amounts = { ...stock };
  const walk = (table: Amounts, depth: number): Need[] =>
    Object.entries(table).map(([id, need]) => {
      const have = Math.max(0, left[id] ?? 0);
      const used = Math.min(have, need);
      left[id] = have - used;
      const missing = need - used;
      const recipe = recipeFor(content, id);
      if (missing <= 0 || !recipe || depth > 6) return { id, need, have, parts: [] };
      const units = Math.ceil(missing / recipe.amount);
      const inputs: Amounts = {};
      for (const [input, amount] of Object.entries(recipe.cost)) inputs[input] = amount * units;
      return { id, need, have, make: { recipe, units }, parts: walk(inputs, depth + 1) };
    });
  return walk(cost, 0);
}

/** The parts to make for `cost`, deepest first (planks before the frames that use them). */
export function partsToMake(
  content: Content,
  stock: Amounts,
  cost: Amounts,
): { recipe: Recipe; units: number }[] {
  const order: { recipe: Recipe; units: number }[] = [];
  const visit = (needs: Need[]) => {
    for (const need of needs) {
      visit(need.parts);
      if (need.make) order.push(need.make);
    }
  };
  visit(expandNeeds(content, stock, cost));
  return order;
}

// --- blueprints ---------------------------------------------------------------------

/** Blueprint recipes this base has not found yet, in data order. */
export function unknownBlueprints(
  content: Content,
  state: Pick<BaseState, "blueprints">,
): string[] {
  return content.recipes
    .filter((recipe) => recipe.blueprint && !state.blueprints.includes(recipe.output))
    .map((recipe) => recipe.output);
}

/** One blueprint the base does not know yet, picked with `random`; null when none are left. */
export function drawBlueprint(
  content: Content,
  state: Pick<BaseState, "blueprints">,
  random: Rng,
): string | null {
  const left = unknownBlueprints(content, state);
  if (left.length === 0) return null;
  return left[Math.floor(random.next() * left.length)] ?? null;
}

/** A roll of `percent` chance, seeded from the base and the moment: replayable. */
export function rollBlueprint(
  content: Content,
  state: Pick<BaseState, "blueprints" | "seed">,
  percent: number,
  ...salt: number[]
): string | null {
  if (percent <= 0) return null;
  const random = rng(seedOf(state.seed, 0xb1e5, ...salt));
  if (random.next() * 100 >= percent) return null;
  return drawBlueprint(content, state, random);
}
