/**
 * Production: every station building (workbench, loom, tannery, kiln, press,
 * the campfire's kitchen) runs its own queue. A job is a batch of units of one
 * recipe, paid up front; units land one by one as settling passes them, parts
 * into stock (uncapped) and items into the inventory. The next job starts when
 * the one before it ends. The station's level sets its queue slots and batch
 * size (`crafting.json5`); the lights shorten every unit. Also here: salvage
 * (an item back into part of its cost) and serving a meal.
 */
import type { Amounts, Content, Item, Recipe } from "@wipe-day/content/schema";
import { add, type BaseState, boxesInUse, clampToCap, shortfall, storageCap, tierOf } from "./base";
import type { GameEvent } from "./events";
import { modifiers } from "./modifiers";
import { isPart, knows, recipeFor, stationLevel, stations } from "./recipes";

export interface CraftJob {
  /** The recipe, by its output id. */
  recipe: string;
  /** Units in this job; each makes the recipe's `amount`. */
  count: number;
  /** Units already landed. */
  done: number;
  /** Seconds per unit, fixed when queued (a later lights upgrade does not re-price it). */
  unitSeconds: number;
  /** When its first unit started: when it was queued, or when the job before it ended. */
  startedAt: number;
}

/** Why a recipe cannot be queued right now; `ok` when it can. */
export type CraftStatus =
  | { code: "ok" }
  | { code: "unknown" }
  | { code: "blueprint" }
  | { code: "station"; station: string }
  | { code: "workbench"; station: string; needed: number; have: number }
  | { code: "owned" }
  | { code: "box_slots"; slots: number }
  | { code: "queue_full"; station: string; size: number }
  | { code: "batch"; station: string; size: number }
  | { code: "unaffordable"; missing: Amounts };

export interface CraftOption {
  recipe: Recipe;
  status: CraftStatus;
}

function levelRule(rule: number[], level: number): number {
  return rule[Math.min(rule.length, Math.max(1, level)) - 1] ?? 1;
}

export function queueSlots(content: Content, state: BaseState, station: string): number {
  return levelRule(content.crafting.queueSlots, stationLevel(state, station));
}

export function batchSize(content: Content, state: BaseState, station: string): number {
  return levelRule(content.crafting.batchSize, stationLevel(state, station));
}

/** Seconds one unit takes here: its minutes, sped up by the buildings (the lights). */
export function unitSeconds(content: Content, state: BaseState, recipe: Recipe): number {
  return Math.max(
    1,
    Math.round((recipe.minutes * 60 * 100) / (100 + modifiers(content, state).craftPercent)),
  );
}

export function jobEndsAt(job: CraftJob): number {
  return job.startedAt + job.count * job.unitSeconds;
}

/** Units of `job` finished by `now` (landed or about to land). */
export function unitsDone(job: CraftJob, now: number): number {
  if (now <= job.startedAt) return 0;
  return Math.min(job.count, Math.floor((now - job.startedAt) / job.unitSeconds));
}

export function queueOf(state: BaseState, station: string): CraftJob[] {
  return state.production[station] ?? [];
}

/** Storage items owned plus queued: what counts against the tier's crate slots. */
function boxesPlanned(content: Content, state: BaseState): number {
  let queued = 0;
  for (const jobs of Object.values(state.production)) {
    for (const job of jobs) {
      const item = content.items.find((candidate) => candidate.id === job.recipe);
      if (item?.category === "storage") queued += job.count - job.done;
    }
  }
  return boxesInUse(content, state) + queued;
}

function itemOf(content: Content, id: string): Item | undefined {
  return content.items.find((item) => item.id === id);
}

function costOf(recipe: Recipe, units: number): Amounts {
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(recipe.cost)) out[id] = amount * units;
  return out;
}

/** The most units of `output` that could be queued now: batch size, crate slots and stock. */
export function maxBatch(content: Content, state: BaseState, output: string): number {
  const recipe = recipeFor(content, output);
  if (!recipe) return 0;
  let most = batchSize(content, state, recipe.station);
  for (const [id, amount] of Object.entries(recipe.cost)) {
    if (amount > 0) most = Math.min(most, Math.floor((state.stock[id] ?? 0) / amount));
  }
  if (itemOf(content, output)?.category === "storage") {
    most = Math.min(most, tierOf(content, state.tier).boxSlots - boxesPlanned(content, state));
  }
  return Math.max(0, most);
}

/** Whether `count` units of `output` could be queued now, and if not, the first reason why. */
export function craftStatus(
  content: Content,
  state: BaseState,
  output: string,
  count = 1,
): CraftStatus {
  const recipe = recipeFor(content, output);
  if (!recipe || count < 1) return { code: "unknown" };
  if (!knows(state, recipe)) return { code: "blueprint" };
  const { station } = recipe;
  const have = stationLevel(state, station);
  if (have === 0) return { code: "station", station };
  if (recipe.level > have) return { code: "workbench", station, needed: recipe.level, have };
  const item = itemOf(content, output);
  if (item?.unique && (state.items[output] ?? 0) > 0) return { code: "owned" };
  if (item?.category === "storage") {
    const slots = tierOf(content, state.tier).boxSlots;
    if (boxesPlanned(content, state) + count > slots) return { code: "box_slots", slots };
  }
  const size = queueSlots(content, state, station);
  if (queueOf(state, station).length >= size) return { code: "queue_full", station, size };
  const most = batchSize(content, state, station);
  if (count > most) return { code: "batch", station, size: most };
  const missing = shortfall(costOf(recipe, count), state.stock);
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok" };
}

/** Every recipe with its status for one unit, in data order: what the craft panel lists. */
export function craftOptions(content: Content, state: BaseState, station?: string): CraftOption[] {
  return content.recipes
    .filter((recipe) => station === undefined || recipe.station === station)
    .map((recipe) => ({ recipe, status: craftStatus(content, state, recipe.output) }));
}

export type QueueCraftResult =
  | { ok: true; state: BaseState; job: CraftJob; paid: Amounts; events: GameEvent[] }
  | { ok: false; status: Exclude<CraftStatus, { code: "ok" }> };

/** Pays for `count` units of `output` and puts the job at the back of its station's queue. */
export function queueCraft(
  content: Content,
  state: BaseState,
  output: string,
  count: number,
  now: number,
): QueueCraftResult {
  const status = craftStatus(content, state, output, count);
  if (status.code !== "ok") return { ok: false, status };
  const recipe = recipeFor(content, output);
  if (!recipe) return { ok: false, status: { code: "unknown" } };
  const queue = queueOf(state, recipe.station);
  const last = queue.at(-1);
  const job: CraftJob = {
    recipe: output,
    count,
    done: 0,
    unitSeconds: unitSeconds(content, state, recipe),
    startedAt: last ? Math.max(now, jobEndsAt(last)) : now,
  };
  const paid = costOf(recipe, count);
  const stock: Amounts = { ...state.stock };
  for (const [id, amount] of Object.entries(paid)) stock[id] = (stock[id] ?? 0) - amount;
  return {
    ok: true,
    state: {
      ...state,
      stock,
      production: { ...state.production, [recipe.station]: [...queue, job] },
    },
    job,
    paid,
    events: [
      {
        type: "craft_queued",
        recipe: output,
        station: recipe.station,
        count,
        endsAt: jobEndsAt(job),
        paid,
      },
    ],
  };
}

export type CancelResult =
  | { ok: true; state: BaseState; refunded: Amounts; events: GameEvent[] }
  | { ok: false; reason: "no_job" };

/**
 * Cancels job `index` at `station` (settled first, so finished units have
 * landed). The units not made yet are refunded in full; the jobs behind it move up.
 */
export function cancelCraft(
  content: Content,
  state: BaseState,
  station: string,
  index: number,
  now: number,
): CancelResult {
  const queue = queueOf(state, station);
  const job = queue[index];
  const recipe = job ? recipeFor(content, job.recipe) : undefined;
  if (!job || !recipe || job.done >= job.count) return { ok: false, reason: "no_job" };
  const refunded = costOf(recipe, job.count - job.done);
  // Jobs behind an unfinished one have not started: lay them end to end again.
  const before = queue.slice(0, index);
  const previous = before.at(-1);
  let at = previous ? Math.max(now, jobEndsAt(previous)) : now;
  const behind = queue.slice(index + 1).map((other) => {
    const moved = { ...other, startedAt: at };
    at = jobEndsAt(moved);
    return moved;
  });
  const jobs = [...before, ...behind];
  return {
    ok: true,
    state: {
      ...state,
      stock: add(state.stock, refunded),
      production: { ...state.production, [station]: jobs },
    },
    refunded,
    events: [{ type: "craft_cancelled", recipe: job.recipe, station, refunded }],
  };
}

/** Lands every finished unit at every station, in order. Part of settling. */
export function settleCrafts(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let stock = state.stock;
  let items = state.items;
  let production = state.production;
  for (const station of Object.keys(state.production)) {
    const jobs: CraftJob[] = [];
    let changed = false;
    for (const job of state.production[station] ?? []) {
      const units = unitsDone(job, now);
      const landed = units - job.done;
      if (landed > 0) {
        changed = true;
        const recipe = recipeFor(content, job.recipe);
        const amount = landed * (recipe?.amount ?? 1);
        if (isPart(content, job.recipe)) stock = add(stock, { [job.recipe]: amount });
        else items = { ...items, [job.recipe]: (items[job.recipe] ?? 0) + amount };
        events.push({
          type: "crafted",
          recipe: job.recipe,
          station,
          amount,
          at: job.startedAt + units * job.unitSeconds,
          done: units >= job.count,
        });
      }
      if (units < job.count) jobs.push(landed > 0 ? { ...job, done: units } : job);
    }
    if (changed) production = { ...production, [station]: jobs };
  }
  if (production === state.production) return { state, events };
  // Drop stations whose queue ran empty, so the state stays small.
  const kept: Record<string, CraftJob[]> = {};
  for (const [station, jobs] of Object.entries(production))
    if (jobs.length > 0) kept[station] = jobs;
  return { state: { ...state, stock, items, production: kept }, events };
}

/** The earliest moment a unit lands anywhere, for the server's timer. */
export function nextCraftAt(state: BaseState): number | null {
  let next: number | null = null;
  for (const jobs of Object.values(state.production)) {
    const job = jobs[0];
    if (!job) continue;
    const at = job.startedAt + (job.done + 1) * job.unitSeconds;
    next = next === null ? at : Math.min(next, at);
  }
  return next;
}

/** Stations with something in their queue, in panel order. */
export function busyStations(content: Content, state: BaseState): string[] {
  return stations(content).filter((station) => queueOf(state, station).length > 0);
}

// --- salvage ------------------------------------------------------------------------

/** What salvaging `count` of `itemId` gives back: a share of its recipe and some scrap. */
export function salvageValue(content: Content, itemId: string, count: number): Amounts {
  const item = itemOf(content, itemId);
  const recipe = recipeFor(content, itemId);
  if (!item || !recipe) return {};
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(recipe.cost)) {
    const back = Math.floor((amount * count * content.crafting.salvagePercent) / 100);
    if (back > 0) out[id] = back;
  }
  const scrap = (content.crafting.salvageScrap[item.tier] ?? 0) * count;
  if (scrap > 0) out.scrap = (out.scrap ?? 0) + scrap;
  return out;
}

export type SalvageResult =
  | { ok: true; state: BaseState; gained: Amounts; events: GameEvent[] }
  | { ok: false; reason: "not_owned" | "unknown" };

/** Breaks `count` of an owned item down. Parts come back uncapped, the rest up to storage. */
export function salvage(
  content: Content,
  state: BaseState,
  itemId: string,
  count: number,
): SalvageResult {
  if (!itemOf(content, itemId) || !recipeFor(content, itemId) || count < 1)
    return { ok: false, reason: "unknown" };
  const owned = state.items[itemId] ?? 0;
  if (owned < count) return { ok: false, reason: "not_owned" };
  const items = { ...state.items, [itemId]: owned - count };
  if (items[itemId] === 0) delete items[itemId];
  // Room is measured after the items go (a salvaged crate takes its room with it).
  const without = { ...state, items };
  const value = salvageValue(content, itemId, count);
  const parts: Amounts = {};
  const rest: Amounts = {};
  for (const [id, amount] of Object.entries(value)) {
    if (isPart(content, id)) parts[id] = amount;
    else rest[id] = amount;
  }
  const capped = clampToCap(storageCap(content, without), without.stock, rest);
  const gained = { ...parts, ...capped };
  return {
    ok: true,
    state: { ...without, stock: add(without.stock, gained) },
    gained,
    events: [{ type: "salvaged", item: itemId, count, gained }],
  };
}

// --- meals --------------------------------------------------------------------------

/** The boost a served meal gives right now: percent more from Gather and node hits. */
export function boostPercent(state: BaseState, now: number): number {
  return state.wellFed && state.wellFed.until > now ? state.wellFed.percent : 0;
}

export type ServeResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; reason: "not_owned" | "not_meal" }
  | { ok: false; reason: "fed_better"; until: number };

/**
 * Serves one meal: its boost runs for its hours from now. A weaker meal cannot
 * cut a stronger one short; an equal or better one replaces it.
 */
export function serve(
  content: Content,
  state: BaseState,
  mealId: string,
  now: number,
): ServeResult {
  const meal = itemOf(content, mealId);
  if (!meal || meal.category !== "meal" || !meal.boostPercent || !meal.hours)
    return { ok: false, reason: "not_meal" };
  const owned = state.items[mealId] ?? 0;
  if (owned < 1) return { ok: false, reason: "not_owned" };
  const current = boostPercent(state, now);
  if (current > meal.boostPercent && state.wellFed)
    return { ok: false, reason: "fed_better", until: state.wellFed.until };
  const items = { ...state.items, [mealId]: owned - 1 };
  if (items[mealId] === 0) delete items[mealId];
  const wellFed = { percent: meal.boostPercent, until: now + meal.hours * 3600 };
  return {
    ok: true,
    state: { ...state, items, wellFed },
    events: [{ type: "served", meal: mealId, percent: wellFed.percent, until: wellFed.until }],
  };
}
