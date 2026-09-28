/**
 * The one obvious next action (CLAUDE.md 6.3 rule 1): which button glows. The
 * onboarding hint explains the same action, so the button and the one-line
 * hint never disagree. A hint retires after it has been acted on twice.
 */
import type { Content } from "@wipe-day/content/schema";
import {
  accrued,
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
  total,
  workbenchLevel,
} from "./base";
import { craftStatus } from "./craft";

export type Advice = "collect" | "barrel" | "build" | "tools" | "furnace" | "craft" | "gather";

/** A hint is shown until its action has been used this many times. */
export const HINT_RETIRE_AFTER = 2;

/** Ore worth walking to the furnace for. */
const SMELT_WORTH = 100;

/** Which mechanics exist for this player yet (rule 6: reveal as they become relevant). */
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
  const anyCraftable = content.recipes.some(
    (recipe) => craftStatus(content, state, recipe.item).code === "ok",
  );
  return {
    furnace: state.furnaceId !== null || hasOre,
    craft: hasItems || anyCraftable || state.craftQueue.length > 0,
    inventory: hasItems,
  };
}

/** True when the furnace has something useful to do right now. */
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

/** True when crafting is the natural next step: a workbench, or a crate when storage is tight. */
export function craftWorthIt(content: Content, state: BaseState, now: number): boolean {
  const level = workbenchLevel(content, state);
  const tier = tierOf(content, state.tier);
  const bench = content.items.find((item) => item.workbenchLevel === level + 1);
  if (bench && level < tier.workbenchLevel && craftStatus(content, state, bench.id).code === "ok")
    return true;
  if (
    storageFill(content, state, now).fraction >= 0.8 &&
    boxesInUse(content, state) < tier.boxSlots
  ) {
    return content.items.some(
      (item) => item.category === "storage" && craftStatus(content, state, item.id).code === "ok",
    );
  }
  return false;
}

export function advise(content: Content, state: BaseState, now: number): Advice {
  // Full storage with something waiting: bank it. Full with nothing waiting means
  // collecting would do nothing, so the advice moves on to spending.
  if (isStorageFull(content, state, now) && !isEmpty(accrued(content, state, now)))
    return "collect";
  if (state.barrel && now <= state.barrel.expiresAt) return "barrel";
  const target = nextTier(state.tier);
  if (!state.build && target && canAfford(tierOf(content, target).cost, state.stock))
    return "build";
  const tool = nextTool(content, state);
  if (tool && canAfford(tool.cost, state.stock)) return "tools";
  if (furnaceWorthIt(content, state, now)) return "furnace";
  if (craftWorthIt(content, state, now)) return "craft";
  if (gatherReadyAt(content, state) <= now) return "gather";
  // Nothing to spend on and Gather cooling down: bank what is waiting, or wait for Gather.
  return total(accrued(content, state, now)) >= 1 ? "collect" : "gather";
}

/** The hint to show under the base for `advice`, or null once it has retired. */
export function hintFor(state: BaseState, advice: Advice): Advice | null {
  return (state.hints[advice] ?? 0) < HINT_RETIRE_AFTER ? advice : null;
}
