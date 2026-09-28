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
  nextTool,
  smeltable,
  storageFill,
  tierOf,
  total,
} from "./base";
import { buildingCount, buildStatus, nextBuild } from "./buildings";
import { craftStatus } from "./craft";

export type Advice =
  | "collect"
  | "barrel"
  | "build"
  | "tools"
  | "furnace"
  | "building"
  | "craft"
  | "gather";

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
    furnace: furnaceOf(content, state) !== null || hasOre,
    craft: hasItems || anyCraftable || state.craftQueue.length > 0,
    inventory: hasItems,
  };
}

/** True when the furnace has something useful to do right now, or the first one can be built. */
export function furnaceWorthIt(content: Content, state: BaseState, now: number): boolean {
  if (!isEmpty(furnaceReady(state, now))) return true;
  if (furnaceOf(content, state)) {
    if (state.furnaceJobs.length >= furnaceSlots(content, state)) return false;
    return content.resources.some(
      (resource) => resource.smeltsInto && smeltable(content, state, resource.id) >= SMELT_WORTH,
    );
  }
  const hasOre = content.resources.some(
    (resource) => resource.smeltsInto && (state.stock[resource.id] ?? 0) >= SMELT_WORTH,
  );
  return hasOre && buildStatus(content, state, "furnace").code === "ok";
}

/**
 * The building most worth putting a free builder on: the workbench first (it
 * opens crafting), then the cheapest affordable one. Null when none is.
 */
export function buildingWorthIt(content: Content, state: BaseState): string | null {
  const ready = content.buildings
    .map((building) => building.id)
    .filter((id) => id !== "furnace" && buildStatus(content, state, id).code === "ok");
  if (ready.includes("workbench") && (state.buildings.workbench ?? 0) === 0) return "workbench";
  const cost = (id: string) => total(nextBuild(content, state, id)?.cost ?? {});
  return ready.sort((a, b) => cost(a) - cost(b))[0] ?? null;
}

/** True when a crate is the natural next step: storage is tight and one fits. */
export function craftWorthIt(content: Content, state: BaseState, now: number): boolean {
  const tier = tierOf(content, state.tier);
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
  if (buildStatus(content, state, "tier").code === "ok") return "build";
  const tool = nextTool(content, state);
  if (tool && canAfford(tool.cost, state.stock)) return "tools";
  if (furnaceWorthIt(content, state, now)) return "furnace";
  if (buildingWorthIt(content, state) !== null) return "building";
  if (craftWorthIt(content, state, now)) return "craft";
  if (gatherReadyAt(content, state) <= now) return "gather";
  // Nothing to spend on and Gather cooling down: bank what is waiting, or wait for Gather.
  return total(accrued(content, state, now)) >= 1 ? "collect" : "gather";
}

/** The hint to show under the base for `advice`, or null once it has retired. */
export function hintFor(state: BaseState, advice: Advice): Advice | null {
  return (state.hints[advice] ?? 0) < HINT_RETIRE_AFTER ? advice : null;
}

/** How many buildings stand: for the dock and the simulator. */
export { buildingCount };
