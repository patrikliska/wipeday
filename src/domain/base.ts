/**
 * The season-layer base, as pure functions: state + content + `now` in, new
 * state + what happened out. No Discord, no database, no clock. The simulator
 * and the unit tests drive exactly this code.
 *
 * Time is UTC unix seconds; amounts are integers. Lazy evaluation: nothing
 * ticks. Resources are computed from `lastCollectedAt`, builds complete and
 * upkeep is paid in `settle`, which every action runs first.
 */
import type { Amounts, BaseTier, Content, Furnace, Recipe, Tool } from "../content/schema";
import { TIERS, type Tier } from "../ui/theme";
import { type Barrel, type DailyTasks, type NodeRun, newActive } from "./active";

export interface FurnaceJob {
  /** Ore id. */
  input: string;
  /** Refined id. */
  output: string;
  amount: number;
  startedAt: number;
  /** Output already taken out. */
  collected: number;
}

export interface BaseState {
  tier: Tier;
  toolId: string;
  /** Banked resources. A key is present from the moment the player first gains it. */
  stock: Amounts;
  lastCollectedAt: number;
  /** Null until the first Gather. */
  lastGatherAt: number | null;
  /** A running tier upgrade. */
  build: { tier: Tier; endsAt: number } | null;
  /** Upkeep is covered up to this moment; earlier than `now` means decaying. */
  upkeepPaidUntil: number;
  /** Furnace type owned, if any. Slots come from the base tier. */
  furnaceId: string | null;
  furnaceJobs: FurnaceJob[];
  /** Inventory: item id -> count. */
  items: Record<string, number>;
  /** Node mini-game, barrel and daily tasks: see `active.ts`. */
  nodeRun: NodeRun | null;
  barrel: Barrel | null;
  nextBarrelAt: number;
  tasks: DailyTasks;
}

const HOUR = 3600;

// --- lookups -----------------------------------------------------------------

export function newBase(content: Content, now: number): BaseState {
  const tool = content.tools[0];
  if (!tool) throw new Error("tools.json5 lists no tools");
  const stock: Amounts = {};
  for (const id of Object.keys(tool.rates)) stock[id] = 0;
  return {
    tier: "twig",
    toolId: tool.id,
    stock,
    lastCollectedAt: now,
    lastGatherAt: null,
    build: null,
    upkeepPaidUntil: now,
    furnaceId: null,
    furnaceJobs: [],
    items: {},
    ...newActive(content, now),
  };
}

export function toolOf(content: Content, state: BaseState): Tool {
  const tool = content.tools.find((candidate) => candidate.id === state.toolId);
  if (!tool) throw new Error(`unknown tool ${state.toolId}`);
  return tool;
}

/** The tool after the current one, or null at the top. */
export function nextTool(content: Content, state: BaseState): Tool | null {
  const index = content.tools.findIndex((tool) => tool.id === state.toolId);
  return content.tools[index + 1] ?? null;
}

export function tierOf(content: Content, tier: Tier): BaseTier {
  const found = content.baseTiers.find((candidate) => candidate.id === tier);
  if (!found) throw new Error(`unknown base tier ${tier}`);
  return found;
}

export function nextTier(tier: Tier): Tier | null {
  return TIERS[TIERS.indexOf(tier) + 1] ?? null;
}

export function furnaceOf(content: Content, state: BaseState): Furnace | null {
  if (state.furnaceId === null) return null;
  const found = content.furnaces.find((candidate) => candidate.id === state.furnaceId);
  if (!found) throw new Error(`unknown furnace ${state.furnaceId}`);
  return found;
}

/** The furnace type after the owned one (or the first), if the tier allows it. */
export function nextFurnace(content: Content, state: BaseState): Furnace | null {
  const index = content.furnaces.findIndex((furnace) => furnace.id === state.furnaceId);
  const candidate = content.furnaces[index + 1] ?? null;
  if (!candidate) return null;
  return TIERS.indexOf(candidate.minTier) <= TIERS.indexOf(state.tier) ? candidate : null;
}

export function furnaceSlots(content: Content, state: BaseState): number {
  return state.furnaceId === null ? 0 : tierOf(content, state.tier).furnaceSlots;
}

/** Highest workbench level usable: owned workbench, capped by the tier. */
export function workbenchLevel(content: Content, state: BaseState): number {
  let owned = 0;
  for (const item of content.items) {
    if (item.workbenchLevel !== undefined && (state.items[item.id] ?? 0) > 0) {
      owned = Math.max(owned, item.workbenchLevel);
    }
  }
  return Math.min(owned, tierOf(content, state.tier).workbenchLevel);
}

/** Boxes counting toward storage: the biggest ones first, up to the tier's slots. */
export function boxesInUse(content: Content, state: BaseState): number {
  let count = 0;
  for (const item of content.items) {
    if (item.category === "storage") count += state.items[item.id] ?? 0;
  }
  return Math.min(count, tierOf(content, state.tier).boxSlots);
}

/** Room per resource: the tier's cap plus the boxes in use. Every resource has its own. */
export function storageCap(content: Content, state: BaseState): number {
  const tier = tierOf(content, state.tier);
  const boxes = content.items
    .filter((item) => item.category === "storage" && item.capacity !== undefined)
    .flatMap((item) => Array<number>(state.items[item.id] ?? 0).fill(item.capacity ?? 0))
    .sort((a, b) => b - a)
    .slice(0, tier.boxSlots);
  return tier.storageCap + boxes.reduce((sum, capacity) => sum + capacity, 0);
}

export function total(amounts: Amounts): number {
  let sum = 0;
  for (const amount of Object.values(amounts)) sum += amount;
  return sum;
}

export function isEmpty(amounts: Amounts): boolean {
  return Object.values(amounts).every((amount) => amount === 0);
}

export function add(stock: Amounts, gained: Amounts): Amounts {
  const out = { ...stock };
  for (const [id, amount] of Object.entries(gained)) out[id] = (out[id] ?? 0) + amount;
  return out;
}

function subtract(stock: Amounts, cost: Amounts): Amounts {
  const out = { ...stock };
  for (const [id, amount] of Object.entries(cost)) out[id] = (out[id] ?? 0) - amount;
  return out;
}

function scale(amounts: Amounts, factor: number): Amounts {
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(amounts)) out[id] = amount * factor;
  return out;
}

/** What is still needed to pay `cost` from `stock`; empty when affordable. */
export function shortfall(cost: Amounts, stock: Amounts): Amounts {
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(cost)) {
    const missing = amount - (stock[id] ?? 0);
    if (missing > 0) out[id] = missing;
  }
  return out;
}

export function canAfford(cost: Amounts, stock: Amounts): boolean {
  return Object.keys(shortfall(cost, stock)).length === 0;
}

// --- accrual -----------------------------------------------------------------

/** What a span of production yields, per resource, rounded down. */
function production(rates: Amounts, seconds: number, percent = 100): Amounts {
  const out: Amounts = {};
  for (const [id, perHour] of Object.entries(rates)) {
    out[id] = Math.floor((perHour * seconds * percent) / (HOUR * 100));
  }
  return out;
}

/** Clamps each wanted amount to the room its resource has left. Never overflows. */
export function clampToCap(cap: number, stock: Amounts, wanted: Amounts): Amounts {
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(wanted)) {
    out[id] = Math.max(0, Math.min(amount, cap - (stock[id] ?? 0)));
  }
  return out;
}

/** The fullest resource, counting what is waiting to be collected: what the storage bar shows. */
export function storageFill(
  content: Content,
  state: BaseState,
  now: number,
): { resource: string; fraction: number } {
  const cap = storageCap(content, state);
  const waiting = accrued(content, state, now);
  let best = { resource: "wood", fraction: 0 };
  for (const resource of content.resources) {
    if (state.stock[resource.id] === undefined) continue;
    const held = (state.stock[resource.id] ?? 0) + (waiting[resource.id] ?? 0);
    const fraction = Math.min(1, held / cap);
    if (fraction > best.fraction) best = { resource: resource.id, fraction };
  }
  return best;
}

/**
 * True once a full hour of upkeep has gone unpaid. Upkeep is settled in whole
 * hours, so `upkeepPaidUntil` lags `now` by up to an hour on a healthy base.
 * Tiers without upkeep never decay.
 */
export function isDecaying(content: Content, state: BaseState, now: number): boolean {
  return !isEmpty(tierOf(content, state.tier).upkeep) && now - state.upkeepPaidUntil >= HOUR;
}

/** Hours of upkeep the banked stock can still cover at this tier. */
export function upkeepCoverHours(content: Content, state: BaseState): number {
  const upkeep = tierOf(content, state.tier).upkeep;
  if (isEmpty(upkeep)) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...Object.entries(upkeep).map(([id, perHour]) => Math.floor((state.stock[id] ?? 0) / perHour)),
  );
}

/**
 * What has piled up since the last collect, already capped by storage space.
 * Time spent with unpaid upkeep produces at the decay percentage.
 * Fractions of a unit are dropped, so collecting twice within a second loses
 * at most one unit per resource; accepted for the simplicity of integer state.
 */
export function accrued(content: Content, state: BaseState, now: number): Amounts {
  const from = state.lastCollectedAt;
  const to = Math.max(now, from);
  const hasUpkeep = !isEmpty(tierOf(content, state.tier).upkeep);
  // Decay starts with the first *full* unpaid hour (see `isDecaying`).
  const paidUntil = hasUpkeep ? Math.min(Math.max(state.upkeepPaidUntil + HOUR, from), to) : to;
  const rates = toolOf(content, state).rates;
  const healthy = production(rates, paidUntil - from);
  const decayed = production(rates, to - paidUntil, content.baseRules.decayProductionPercent);
  return clampToCap(storageCap(content, state), state.stock, add(healthy, decayed));
}

/** True when a gathered resource has no room left: its accrual has stopped. */
export function isStorageFull(content: Content, state: BaseState, now: number): boolean {
  const cap = storageCap(content, state);
  const waiting = accrued(content, state, now);
  return Object.keys(toolOf(content, state).rates).some(
    (id) => (state.stock[id] ?? 0) + (waiting[id] ?? 0) >= cap,
  );
}

export interface Collected {
  state: BaseState;
  gained: Amounts;
}

/** Banks everything accrued and restarts the accrual window. */
export function collect(content: Content, state: BaseState, now: number): Collected {
  const gained = accrued(content, state, now);
  return {
    state: {
      ...state,
      stock: add(state.stock, gained),
      lastCollectedAt: Math.max(now, state.lastCollectedAt),
    },
    gained,
  };
}

/** When the Gather bonus is next available. `<= now` means ready. */
export function gatherReadyAt(content: Content, state: BaseState): number {
  if (state.lastGatherAt === null) return 0;
  return state.lastGatherAt + toolOf(content, state).cooldownMinutes * 60;
}

export type GatherResult =
  | { ok: true; state: BaseState; gained: Amounts; bonus: Amounts }
  | { ok: false; reason: "cooldown"; readyAt: number };

/**
 * The manual click: banks what has accrued, then adds `bonusMinutes` of
 * production on top (also capped by storage), and starts the cooldown.
 */
export function gather(content: Content, state: BaseState, now: number): GatherResult {
  const readyAt = gatherReadyAt(content, state);
  if (now < readyAt) return { ok: false, reason: "cooldown", readyAt };
  const banked = collect(content, state, now);
  const tool = toolOf(content, state);
  const wanted = production(tool.rates, tool.bonusMinutes * 60);
  const bonus = clampToCap(storageCap(content, state), banked.state.stock, wanted);
  return {
    ok: true,
    state: { ...banked.state, stock: add(banked.state.stock, bonus), lastGatherAt: now },
    gained: banked.gained,
    bonus,
  };
}

// --- settle: builds and upkeep -----------------------------------------------

export type SettleEvent =
  | { type: "build_done"; tier: Tier }
  | { type: "auto_collect"; gained: Amounts }
  | { type: "upkeep_paid"; hours: number; paid: Amounts }
  | { type: "decayed"; from: Tier; to: Tier };

/**
 * Brings the state up to `now`: a finished build lands; upkeep is paid hour
 * by hour from stock, pulling from the nodes (an implicit collect) when stock
 * is short; a base unpaid for too long drops a tier. Idempotent: settling
 * twice at the same instant changes nothing the second time.
 */
export function settle(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: SettleEvent[] } {
  const events: SettleEvent[] = [];
  let next = state;

  if (next.build && next.build.endsAt <= now) {
    events.push({ type: "build_done", tier: next.build.tier });
    next = {
      ...next,
      tier: next.build.tier,
      build: null,
      upkeepPaidUntil: Math.max(next.upkeepPaidUntil, next.build.endsAt),
    };
  }

  const upkeep = tierOf(content, next.tier).upkeep;
  if (isEmpty(upkeep)) {
    return { state: { ...next, upkeepPaidUntil: Math.max(next.upkeepPaidUntil, now) }, events };
  }

  const due = Math.floor((now - next.upkeepPaidUntil) / HOUR);
  if (due > 0) {
    const affordableHours = (stock: Amounts) =>
      Math.min(
        due,
        ...Object.entries(upkeep).map(([id, amount]) => Math.floor((stock[id] ?? 0) / amount)),
      );
    let hours = affordableHours(next.stock);
    if (hours < due) {
      // The nodes were feeding the base all along: bank at the healthy rate,
      // then pay. Only the hours that still cannot be covered count as decay.
      const banked = collect(content, { ...next, upkeepPaidUntil: now }, now);
      if (!isEmpty(banked.gained)) {
        events.push({ type: "auto_collect", gained: banked.gained });
        next = { ...banked.state, upkeepPaidUntil: next.upkeepPaidUntil };
        hours = affordableHours(next.stock);
      }
    }
    if (hours > 0) {
      const paid = scale(upkeep, hours);
      events.push({ type: "upkeep_paid", hours, paid });
      next = {
        ...next,
        stock: subtract(next.stock, paid),
        upkeepPaidUntil: next.upkeepPaidUntil + hours * HOUR,
      };
    }
  }

  if (now - next.upkeepPaidUntil >= content.baseRules.tierLossAfterHours * HOUR) {
    const lower = TIERS[Math.max(0, TIERS.indexOf(next.tier) - 1)] ?? "twig";
    if (lower !== next.tier) {
      events.push({ type: "decayed", from: next.tier, to: lower });
      next = { ...next, tier: lower, upkeepPaidUntil: now };
    }
  }
  return { state: next, events };
}

// --- upgrades ----------------------------------------------------------------

export type UpgradeResult =
  | { ok: true; state: BaseState; tool: Tool; gained: Amounts; paid: Amounts }
  | { ok: false; reason: "maxed" }
  | { ok: false; reason: "unaffordable"; tool: Tool; missing: Amounts };

/**
 * Moves to the next tool tier. Banks the accrual first, at the old rates, so
 * the window is never re-priced at the new ones. Affordability is judged on
 * banked stock only: what the base card shows is what counts.
 */
export function upgradeTool(content: Content, state: BaseState, now: number): UpgradeResult {
  const tool = nextTool(content, state);
  if (!tool) return { ok: false, reason: "maxed" };
  const missing = shortfall(tool.cost, state.stock);
  if (Object.keys(missing).length > 0) return { ok: false, reason: "unaffordable", tool, missing };
  const banked = collect(content, state, now);
  const stock = subtract(banked.state.stock, tool.cost);
  // New rates reveal new resources: give them a slot so they show up at 0.
  for (const id of Object.keys(tool.rates)) stock[id] ??= 0;
  return {
    ok: true,
    state: { ...banked.state, stock, toolId: tool.id },
    tool,
    gained: banked.gained,
    paid: tool.cost,
  };
}

export type BuildResult =
  | { ok: true; state: BaseState; tier: BaseTier; paid: Amounts; endsAt: number }
  | { ok: false; reason: "maxed" }
  | { ok: false; reason: "building"; endsAt: number }
  | { ok: false; reason: "unaffordable"; tier: BaseTier; missing: Amounts };

/** Pays for the next base tier and starts its timer (instant when 0 minutes). */
export function startBuild(content: Content, state: BaseState, now: number): BuildResult {
  if (state.build) return { ok: false, reason: "building", endsAt: state.build.endsAt };
  const target = nextTier(state.tier);
  if (!target) return { ok: false, reason: "maxed" };
  const tier = tierOf(content, target);
  const missing = shortfall(tier.cost, state.stock);
  if (Object.keys(missing).length > 0) return { ok: false, reason: "unaffordable", tier, missing };
  const endsAt = now + tier.buildMinutes * 60;
  const paid = { ...state, stock: subtract(state.stock, tier.cost) };
  const next =
    tier.buildMinutes === 0
      ? { ...paid, tier: target, upkeepPaidUntil: Math.max(paid.upkeepPaidUntil, now) }
      : { ...paid, build: { tier: target, endsAt } };
  return { ok: true, state: next, tier, paid: tier.cost, endsAt };
}

// --- furnaces ----------------------------------------------------------------

export type BuyFurnaceResult =
  | { ok: true; state: BaseState; furnace: Furnace; paid: Amounts }
  | { ok: false; reason: "maxed" }
  | { ok: false; reason: "unaffordable"; furnace: Furnace; missing: Amounts };

export function buyFurnace(content: Content, state: BaseState): BuyFurnaceResult {
  const furnace = nextFurnace(content, state);
  if (!furnace) return { ok: false, reason: "maxed" };
  const missing = shortfall(furnace.cost, state.stock);
  if (Object.keys(missing).length > 0)
    return { ok: false, reason: "unaffordable", furnace, missing };
  return {
    ok: true,
    state: { ...state, stock: subtract(state.stock, furnace.cost), furnaceId: furnace.id },
    furnace,
    paid: furnace.cost,
  };
}

/** Fuel for smelting `amount` ore. */
export function fuelFor(furnace: Furnace, amount: number): number {
  return Math.ceil((amount * furnace.woodPer100Ore) / 100);
}

/** How much of `ore` a new job would take: all in stock, limited by fuel and the job cap. */
export function smeltable(content: Content, state: BaseState, ore: string): number {
  const furnace = furnaceOf(content, state);
  if (!furnace) return 0;
  let amount = Math.min(state.stock[ore] ?? 0, furnace.maxOrePerJob);
  if (furnace.woodPer100Ore > 0) {
    const byFuel = Math.floor(((state.stock.wood ?? 0) * 100) / furnace.woodPer100Ore);
    amount = Math.min(amount, byFuel);
  }
  return amount;
}

export type SmeltResult =
  | { ok: true; state: BaseState; job: FurnaceJob; fuel: number }
  | { ok: false; reason: "no_furnace" | "no_slot" | "nothing_to_smelt" | "not_ore" };

/** Starts a job with everything smeltable of `ore`. Fuel is burned up front. */
export function smelt(content: Content, state: BaseState, now: number, ore: string): SmeltResult {
  const furnace = furnaceOf(content, state);
  if (!furnace) return { ok: false, reason: "no_furnace" };
  const output = content.resources.find((resource) => resource.id === ore)?.smeltsInto;
  if (!output) return { ok: false, reason: "not_ore" };
  if (state.furnaceJobs.length >= furnaceSlots(content, state)) {
    return { ok: false, reason: "no_slot" };
  }
  const amount = smeltable(content, state, ore);
  if (amount <= 0) return { ok: false, reason: "nothing_to_smelt" };
  const fuel = fuelFor(furnace, amount);
  const job: FurnaceJob = { input: ore, output, amount, startedAt: now, collected: 0 };
  const stock = subtract(state.stock, { [ore]: amount, ...(fuel > 0 ? { wood: fuel } : {}) });
  stock[output] ??= 0;
  return {
    ok: true,
    state: { ...state, stock, furnaceJobs: [...state.furnaceJobs, job] },
    job,
    fuel,
  };
}

/** Units smelted so far, whether or not taken out. */
export function jobProgress(furnace: Furnace, job: FurnaceJob, now: number): number {
  return Math.min(
    job.amount,
    Math.floor((furnace.orePerHour * Math.max(0, now - job.startedAt)) / HOUR),
  );
}

export function jobEndsAt(furnace: Furnace, job: FurnaceJob): number {
  return job.startedAt + Math.ceil((job.amount * HOUR) / furnace.orePerHour);
}

/** Output waiting in every slot, by refined resource. */
export function furnaceReady(content: Content, state: BaseState, now: number): Amounts {
  const furnace = furnaceOf(content, state);
  const out: Amounts = {};
  if (!furnace) return out;
  for (const job of state.furnaceJobs) {
    const ready = jobProgress(furnace, job, now) - job.collected;
    if (ready > 0) out[job.output] = (out[job.output] ?? 0) + ready;
  }
  return out;
}

/** Takes finished output out of every slot (as far as storage allows); finished jobs free their slot. */
export function collectFurnaces(content: Content, state: BaseState, now: number): Collected {
  const furnace = furnaceOf(content, state);
  if (!furnace) return { state, gained: {} };
  const cap = storageCap(content, state);
  let stock = { ...state.stock };
  const gained: Amounts = {};
  const jobs: FurnaceJob[] = [];
  for (const job of state.furnaceJobs) {
    const ready = jobProgress(furnace, job, now) - job.collected;
    const take = Math.max(0, Math.min(ready, cap - (stock[job.output] ?? 0)));
    if (take > 0) {
      gained[job.output] = (gained[job.output] ?? 0) + take;
      stock = add(stock, { [job.output]: take });
    }
    const collected = job.collected + take;
    if (collected < job.amount) jobs.push({ ...job, collected });
  }
  return { state: { ...state, stock, furnaceJobs: jobs }, gained };
}

// --- crafting ----------------------------------------------------------------

export type CraftResult =
  | { ok: true; state: BaseState; recipe: Recipe; paid: Amounts }
  | { ok: false; reason: "unknown" }
  | { ok: false; reason: "workbench"; needed: number; have: number }
  | { ok: false; reason: "box_slots"; slots: number }
  | { ok: false; reason: "unaffordable"; missing: Amounts };

/** Crafts one unit, instantly (decision D30). */
export function craft(content: Content, state: BaseState, itemId: string): CraftResult {
  const recipe = content.recipes.find((candidate) => candidate.item === itemId);
  const item = content.items.find((candidate) => candidate.id === itemId);
  if (!recipe || !item) return { ok: false, reason: "unknown" };
  const have = workbenchLevel(content, state);
  if (recipe.workbench > have)
    return { ok: false, reason: "workbench", needed: recipe.workbench, have };
  if (item.category === "storage") {
    const slots = tierOf(content, state.tier).boxSlots;
    if (boxesInUse(content, state) >= slots) return { ok: false, reason: "box_slots", slots };
  }
  const missing = shortfall(recipe.cost, state.stock);
  if (Object.keys(missing).length > 0) return { ok: false, reason: "unaffordable", missing };
  return {
    ok: true,
    state: {
      ...state,
      stock: subtract(state.stock, recipe.cost),
      items: { ...state.items, [itemId]: (state.items[itemId] ?? 0) + 1 },
    },
    recipe,
    paid: recipe.cost,
  };
}

/** Recipes the player can see at all, with whether each is craftable now. */
export function craftable(
  content: Content,
  state: BaseState,
): Array<{ recipe: Recipe; unlocked: boolean; missing: Amounts }> {
  const level = workbenchLevel(content, state);
  return content.recipes.map((recipe) => ({
    recipe,
    unlocked: recipe.workbench <= level,
    missing: shortfall(recipe.cost, state.stock),
  }));
}
