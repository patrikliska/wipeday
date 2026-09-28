/**
 * Crafting: a timed queue. Queuing pays the cost at once; items land in the
 * inventory when their time is up (`settleCrafts`, part of settling), one after
 * another. Every rule the craft panel shows (workbench level, one of each
 * station, crate slots, queue room, cost) is decided here, never in the UI.
 */
import type { Amounts, Content, Item, Recipe } from "@wipe-day/content/schema";
import {
  type BaseState,
  boxesInUse,
  type CraftJob,
  shortfall,
  subtract,
  tierOf,
  workbenchLevel,
} from "./base";
import type { GameEvent } from "./events";

/** Why a recipe cannot be queued right now; `ok` when it can. */
export type CraftStatus =
  | { code: "ok" }
  | { code: "unknown" }
  | { code: "workbench"; needed: number; have: number }
  | { code: "owned" }
  | { code: "box_slots"; slots: number }
  | { code: "queue_full"; size: number }
  | { code: "unaffordable"; missing: Amounts };

export interface CraftOption {
  recipe: Recipe;
  item: Item;
  status: CraftStatus;
}

/** Owned plus waiting in the queue. */
export function ownedOrQueued(state: BaseState, itemId: string): number {
  return (state.items[itemId] ?? 0) + state.craftQueue.filter((job) => job.item === itemId).length;
}

/** Whether `itemId` could be queued now, and if not, the first reason why. */
export function craftStatus(content: Content, state: BaseState, itemId: string): CraftStatus {
  const recipe = content.recipes.find((candidate) => candidate.item === itemId);
  const item = content.items.find((candidate) => candidate.id === itemId);
  if (!recipe || !item) return { code: "unknown" };
  const have = workbenchLevel(content, state);
  if (recipe.workbench > have) return { code: "workbench", needed: recipe.workbench, have };
  if (item.unique && ownedOrQueued(state, itemId) > 0) return { code: "owned" };
  if (item.category === "storage") {
    const slots = tierOf(content, state.tier).boxSlots;
    const queued = state.craftQueue.filter(
      (job) => content.items.find((candidate) => candidate.id === job.item)?.category === "storage",
    ).length;
    if (boxesInUse(content, state) + queued >= slots) return { code: "box_slots", slots };
  }
  const size = content.baseRules.craftQueueSize;
  if (state.craftQueue.length >= size) return { code: "queue_full", size };
  const missing = shortfall(recipe.cost, state.stock);
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok" };
}

/** Every recipe with its status, in data order: what the craft panel lists. */
export function craftOptions(content: Content, state: BaseState): CraftOption[] {
  return content.recipes.flatMap((recipe) => {
    const item = content.items.find((candidate) => candidate.id === recipe.item);
    return item ? [{ recipe, item, status: craftStatus(content, state, recipe.item) }] : [];
  });
}

export type QueueCraftResult =
  | { ok: true; state: BaseState; job: CraftJob; paid: Amounts; events: GameEvent[] }
  | { ok: false; status: Exclude<CraftStatus, { code: "ok" }> };

/**
 * Pays for one `itemId` and puts it in the queue behind whatever is waiting. An
 * instant recipe with an empty queue lands at once.
 */
export function queueCraft(
  content: Content,
  state: BaseState,
  itemId: string,
  now: number,
): QueueCraftResult {
  const status = craftStatus(content, state, itemId);
  if (status.code !== "ok") return { ok: false, status };
  const recipe = content.recipes.find((candidate) => candidate.item === itemId);
  if (!recipe) return { ok: false, status: { code: "unknown" } };
  const startsAt = Math.max(now, state.craftQueue.at(-1)?.endsAt ?? now);
  const job: CraftJob = { item: itemId, endsAt: startsAt + recipe.craftMinutes * 60 };
  const paid = { ...state, stock: subtract(state.stock, recipe.cost) };
  const events: GameEvent[] = [
    { type: "craft_queued", item: itemId, endsAt: job.endsAt, paid: recipe.cost },
  ];
  if (job.endsAt <= now) {
    events.push({ type: "crafted", item: itemId });
    return {
      ok: true,
      state: { ...paid, items: { ...paid.items, [itemId]: (paid.items[itemId] ?? 0) + 1 } },
      job,
      paid: recipe.cost,
      events,
    };
  }
  return {
    ok: true,
    state: { ...paid, craftQueue: [...paid.craftQueue, job] },
    job,
    paid: recipe.cost,
    events,
  };
}

/** Lands every queued item whose time is up, in order. Part of settling. */
export function settleCrafts(
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const done = state.craftQueue.filter((job) => job.endsAt <= now);
  if (done.length === 0) return { state, events: [] };
  const items = { ...state.items };
  for (const job of done) items[job.item] = (items[job.item] ?? 0) + 1;
  return {
    state: { ...state, items, craftQueue: state.craftQueue.filter((job) => job.endsAt > now) },
    events: done.map((job) => ({ type: "crafted", item: job.item })),
  };
}
