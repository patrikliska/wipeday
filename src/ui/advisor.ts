/**
 * Picks the one primary action on the home screen (CLAUDE.md 4.3 rule 1):
 * the most useful thing the player can do right now. The onboarding hint
 * explains the same action, so the glowing button and the hint always agree.
 */
import type { Content } from "../content/schema";
import {
  type BaseState,
  boxesInUse,
  canAfford,
  furnaceOf,
  furnaceReady,
  furnaceSlots,
  gatherReadyAt,
  isEmpty,
  isStorageFull,
  nextFurnace,
  nextTier,
  nextTool,
  smeltable,
  storageFill,
  tierOf,
  workbenchLevel,
} from "../domain/base";

export type Advice = "collect" | "build" | "tools" | "furnace" | "craft" | "gather";

/** Ore worth walking to the furnace for. */
const SMELT_WORTH = 100;

/** Which mechanics the home screen shows at all (rule 6: reveal as they become relevant). */
export interface Revealed {
  furnace: boolean;
  craft: boolean;
  inventory: boolean;
}

export function revealed(content: Content, state: BaseState): Revealed {
  const hasOre = content.resources.some(
    (resource) => resource.smeltsInto && state.stock[resource.id] !== undefined,
  );
  const hasItems = Object.values(state.items).some((count) => count > 0);
  const anyRecipeAffordable = content.recipes.some(
    (recipe) =>
      recipe.workbench <= workbenchLevel(content, state) && canAfford(recipe.cost, state.stock),
  );
  return {
    furnace: state.furnaceId !== null || hasOre,
    craft: hasItems || anyRecipeAffordable,
    inventory: hasItems,
  };
}

/** True when the furnace screen has something useful right now. */
export function furnaceWorthIt(content: Content, state: BaseState, now: number): boolean {
  if (!isEmpty(furnaceReady(content, state, now))) return true;
  if (furnaceOf(content, state)) {
    if (state.furnaceJobs.length >= furnaceSlots(content, state)) return false;
    return content.resources.some(
      (resource) => resource.smeltsInto && smeltable(content, state, resource.id) >= SMELT_WORTH,
    );
  }
  const first = nextFurnace(content, state);
  const hasOre = content.resources.some(
    (resource) => resource.smeltsInto && (state.stock[resource.id] ?? 0) >= SMELT_WORTH,
  );
  return first !== null && hasOre && canAfford(first.cost, state.stock);
}

/** True when crafting is the natural next step: a workbench, or a box when storage is tight. */
export function craftWorthIt(content: Content, state: BaseState, now: number): boolean {
  const level = workbenchLevel(content, state);
  const tier = tierOf(content, state.tier);
  const benchItem = content.items.find((item) => item.workbenchLevel === level + 1);
  const bench = benchItem && content.recipes.find((recipe) => recipe.item === benchItem.id);
  if (bench && level < tier.workbenchLevel && canAfford(bench.cost, state.stock)) return true;
  if (
    storageFill(content, state, now).fraction >= 0.8 &&
    boxesInUse(content, state) < tier.boxSlots
  ) {
    return content.recipes.some(
      (recipe) =>
        content.items.find((item) => item.id === recipe.item)?.category === "storage" &&
        recipe.workbench <= level &&
        canAfford(recipe.cost, state.stock),
    );
  }
  return false;
}

export function advise(content: Content, state: BaseState, now: number): Advice {
  // The status line says "collect" when full; the button must agree.
  if (isStorageFull(content, state, now)) return "collect";
  const target = nextTier(state.tier);
  if (!state.build && target && canAfford(tierOf(content, target).cost, state.stock))
    return "build";
  const tool = nextTool(content, state);
  if (tool && canAfford(tool.cost, state.stock)) return "tools";
  if (furnaceWorthIt(content, state, now)) return "furnace";
  if (craftWorthIt(content, state, now)) return "craft";
  if (gatherReadyAt(content, state) <= now) return "gather";
  return "collect";
}
