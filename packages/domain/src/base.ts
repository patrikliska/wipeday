/**
 * The season-layer base, as pure functions: state + content + `now` in, new
 * state + what happened out. No IO, no clock, no unseeded randomness. The API,
 * the web client's prediction, the simulator and the unit tests all drive
 * exactly this code (through `commands.ts`).
 *
 * Time is UTC unix seconds; amounts are integers. Lazy evaluation: nothing
 * ticks. Resources are computed from `lastCollectedAt`; constructions, crafts,
 * barrels and upkeep resolve in `settleAll` (`settle.ts`), which every command
 * runs first. What the buildings add comes from `modifiers.ts`.
 */
import type { Amounts, BaseTier, Content, Furnace, Tool } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import type { CraftJob } from "./craft";
import type { GameEvent } from "./events";
import { modifiers } from "./modifiers";

export interface FurnaceJob {
  /** Ore id. */
  input: string;
  /** Refined id. */
  output: string;
  amount: number;
  startedAt: number;
  /** Output already taken out. */
  collected: number;
  /** Ore per hour, fixed when the job starts (so a later upgrade cannot re-price it). */
  perHour: number;
}

/** What a builder is putting up: the next base tier, or a building's next level. */
export type Target =
  | { kind: "tier"; tier: Tier }
  | { kind: "building"; building: string; level: number };

export interface Construction {
  target: Target;
  startedAt: number;
  endsAt: number;
}

/** The node being worked right now. */
export interface NodeRun {
  node: string;
  /** Client-chosen id of this run, so retries and a second tab cannot mix runs. */
  run: string;
  /** The node's hits so far, counting the ones taken before this run (`from`). */
  hits: number;
  /** The node's wear when this run began: 0 means a full streak can still be perfect. */
  from: number;
  lastHitAt: number;
}

export interface Barrel {
  spawnedAt: number;
  expiresAt: number;
  seed: number;
}

export interface DailyTasks {
  /** UTC day index these tasks belong to; -1 before the first roll. */
  day: number;
  /** Active task ids, in display order. */
  ids: string[];
  progress: Record<string, number>;
  done: string[];
}

export interface BaseState {
  /** Per-base random seed, fixed at creation: barrel loot and anything else rolled. */
  seed: number;
  tier: Tier;
  toolId: string;
  /** Banked resources. A key is present from the moment the player first gains it. */
  stock: Amounts;
  lastCollectedAt: number;
  /** Null until the first Gather. */
  lastGatherAt: number | null;
  /** Building id -> level (absent = not built). See `buildings.ts`. */
  buildings: Record<string, number>;
  /** What the builders are working on, earliest first. */
  construction: Construction[];
  /** Upkeep is covered up to this moment; earlier than `now` means decaying. */
  upkeepPaidUntil: number;
  furnaceJobs: FurnaceJob[];
  /** Inventory: item id -> count. */
  items: Record<string, number>;
  /** Station building id -> its jobs, the running one first. See `craft.ts`. */
  production: Record<string, CraftJob[]>;
  /** Blueprint recipes found (by output id). W7 moves them to the legacy layer. */
  blueprints: string[];
  /** A served meal's boost to Gather and node hits, until `until`. */
  wellFed: { percent: number; until: number } | null;
  /** The node mini-game. See `nodes.ts`. */
  nodeRun: NodeRun | null;
  /** Worked-out nodes: node id -> when it stands again. */
  depleted: Record<string, number>;
  /** Standing nodes that were hit but not worked out: node id -> hits taken (D76). */
  wear: Record<string, number>;
  /** Minutes of production node hits have paid in full on UTC day `day`. */
  haul: { day: number; minutes: number };
  barrel: Barrel | null;
  /** When the next barrel is scheduled to wash up. */
  nextBarrelAt: number;
  tasks: DailyTasks;
  /** Uses per hint key: a hint retires after two uses (see `advisor.ts`). */
  hints: Record<string, number>;
}

const HOUR = 3600;

// --- lookups -----------------------------------------------------------------

/** A fresh twig base. `seed` makes its rolls its own (the server picks it at random). */
export function newBase(content: Content, now: number, seed: number): BaseState {
  const tool = content.tools[0];
  if (!tool) throw new Error("tools.json5 lists no tools");
  const stock: Amounts = {};
  for (const id of Object.keys(tool.rates)) stock[id] = 0;
  return {
    seed: seed >>> 0,
    tier: "twig",
    toolId: tool.id,
    stock,
    lastCollectedAt: now,
    lastGatherAt: null,
    buildings: {},
    construction: [],
    upkeepPaidUntil: now,
    furnaceJobs: [],
    items: {},
    production: {},
    blueprints: [],
    wellFed: null,
    nodeRun: null,
    depleted: {},
    wear: {},
    haul: { day: -1, minutes: 0 },
    barrel: null,
    nextBarrelAt: now + content.active.barrels.firstAfterMinutes * 60,
    tasks: { day: -1, ids: [], progress: {}, done: [] },
    hints: {},
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

/** Whether the base has reached `tier`. */
export function tierAtLeast(state: Pick<BaseState, "tier">, tier: Tier): boolean {
  return TIERS.indexOf(state.tier) >= TIERS.indexOf(tier);
}

/** The furnace type the furnace building's level gives, or null without one. */
export function furnaceOf(content: Content, state: BaseState): Furnace | null {
  const level = modifiers(content, state).furnace;
  return level > 0 ? (content.furnaces[level - 1] ?? null) : null;
}

export function furnaceSlots(content: Content, state: BaseState): number {
  return furnaceOf(content, state) ? tierOf(content, state.tier).furnaceSlots : 0;
}

/** Crates counting toward storage: the biggest ones first, up to the tier's slots. */
export function boxesInUse(content: Content, state: BaseState): number {
  let count = 0;
  for (const item of content.items) {
    if (item.category === "storage") count += state.items[item.id] ?? 0;
  }
  return Math.min(count, tierOf(content, state.tier).boxSlots);
}

/** Room per resource: the tier's cap, the crates in use and the buildings. */
export function storageCap(content: Content, state: BaseState): number {
  const tier = tierOf(content, state.tier);
  const boxes = content.items
    .filter((item) => item.category === "storage" && item.capacity !== undefined)
    .flatMap((item) => Array<number>(state.items[item.id] ?? 0).fill(item.capacity ?? 0))
    .sort((a, b) => b - a)
    .slice(0, tier.boxSlots);
  const crates = boxes.reduce((sum, capacity) => sum + capacity, 0);
  return tier.storageCap + crates + modifiers(content, state).cap;
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

export function subtract(stock: Amounts, cost: Amounts): Amounts {
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
export function production(rates: Amounts, seconds: number, percent = 100): Amounts {
  const out: Amounts = {};
  for (const [id, perHour] of Object.entries(rates)) {
    out[id] = Math.floor((perHour * seconds * percent) / (HOUR * 100));
  }
  return out;
}

/**
 * Gathering per hour: the tool's rates raised by the buildings' percentages,
 * plus what buildings produce on their own (a garden grows fibre with any tool).
 */
export function effectiveRates(content: Content, state: BaseState): Amounts {
  const mods = modifiers(content, state);
  const out: Amounts = {};
  for (const [id, perHour] of Object.entries(toolOf(content, state).rates)) {
    out[id] = Math.floor((perHour * (100 + mods.allRates + (mods.rates[id] ?? 0))) / 100);
  }
  for (const [id, perHour] of Object.entries(mods.flat)) out[id] = (out[id] ?? 0) + perHour;
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
  let best = { resource: content.resources[0]?.id ?? "", fraction: 0 };
  for (const resource of content.resources) {
    // Parts are not capped (the queues are their throttle).
    if (resource.kind === "part" || state.stock[resource.id] === undefined) continue;
    const held = (state.stock[resource.id] ?? 0) + (waiting[resource.id] ?? 0);
    const fraction = Math.min(1, held / cap);
    if (fraction > best.fraction) best = { resource: resource.id, fraction };
  }
  return best;
}

/** Upkeep per hour: the tier's plus every building level's. */
export function upkeepOf(content: Content, state: BaseState): Amounts {
  let out: Amounts = { ...tierOf(content, state.tier).upkeep };
  for (const building of content.buildings) {
    const level = building.levels[(state.buildings[building.id] ?? 0) - 1];
    if (level) out = add(out, level.upkeep);
  }
  return out;
}

/**
 * True once a full hour of upkeep has gone unpaid. Upkeep is settled in whole
 * hours, so `upkeepPaidUntil` lags `now` by up to an hour on a healthy base.
 * A base without upkeep never decays.
 */
export function isDecaying(content: Content, state: BaseState, now: number): boolean {
  return !isEmpty(upkeepOf(content, state)) && now - state.upkeepPaidUntil >= HOUR;
}

/** Hours of upkeep the banked stock can still cover. */
export function upkeepCoverHours(content: Content, state: BaseState): number {
  const upkeep = upkeepOf(content, state);
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
  const hasUpkeep = !isEmpty(upkeepOf(content, state));
  // Decay starts with the first *full* unpaid hour (see `isDecaying`).
  const paidUntil = hasUpkeep ? Math.min(Math.max(state.upkeepPaidUntil + HOUR, from), to) : to;
  const rates = effectiveRates(content, state);
  const healthy = production(rates, paidUntil - from);
  const decayed = production(rates, to - paidUntil, content.baseRules.decayProductionPercent);
  return clampToCap(storageCap(content, state), state.stock, add(healthy, decayed));
}

/** True when a gathered resource has no room left: its accrual has stopped. */
export function isStorageFull(content: Content, state: BaseState, now: number): boolean {
  const cap = storageCap(content, state);
  const waiting = accrued(content, state, now);
  return Object.keys(effectiveRates(content, state)).some(
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
  // A served meal adds its percent to the bonus (not to what had accrued).
  const fed = state.wellFed && state.wellFed.until > now ? state.wellFed.percent : 0;
  const wanted = production(effectiveRates(content, state), tool.bonusMinutes * 60, 100 + fed);
  const bonus = clampToCap(storageCap(content, state), banked.state.stock, wanted);
  return {
    ok: true,
    state: { ...banked.state, stock: add(banked.state.stock, bonus), lastGatherAt: now },
    gained: banked.gained,
    bonus,
  };
}

// --- settle: constructions and upkeep ------------------------------------------

export type SettleEvent = Extract<
  GameEvent,
  {
    type:
      | "build_done"
      | "building_done"
      | "auto_collect"
      | "upkeep_paid"
      | "decayed"
      | "building_decayed";
  }
>;

/** Lands every construction whose time is up, earliest first. */
function settleConstruction(
  state: BaseState,
  now: number,
): { state: BaseState; events: SettleEvent[] } {
  const done = state.construction.filter((job) => job.endsAt <= now);
  if (done.length === 0) return { state, events: [] };
  const events: SettleEvent[] = [];
  let next: BaseState = {
    ...state,
    construction: state.construction.filter((job) => job.endsAt > now),
  };
  for (const job of [...done].sort((a, b) => a.endsAt - b.endsAt)) {
    if (job.target.kind === "tier") {
      events.push({ type: "build_done", tier: job.target.tier });
      next = {
        ...next,
        tier: job.target.tier,
        upkeepPaidUntil: Math.max(next.upkeepPaidUntil, job.endsAt),
      };
    } else {
      const { building, level } = job.target;
      events.push({ type: "building_done", building, level });
      next = { ...next, buildings: { ...next.buildings, [building]: level } };
    }
  }
  return { state: next, events };
}

/** Total cost of a building's current level: decay takes the dearest first. */
function levelCost(content: Content, id: string, level: number): number {
  const building = content.buildings.find((candidate) => candidate.id === id);
  return total(building?.levels[level - 1]?.cost ?? {});
}

/**
 * Brings the state up to `now`: finished constructions land; upkeep is paid
 * hour by hour from stock, pulling from the nodes (an implicit collect) when
 * stock is short; a base unpaid for too long loses a level of its dearest
 * building, or a tier when no building is left. Idempotent: settling twice at
 * the same instant changes nothing the second time.
 */
export function settle(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: SettleEvent[] } {
  const landed = settleConstruction(state, now);
  const events: SettleEvent[] = [...landed.events];
  let next = landed.state;

  const upkeep = upkeepOf(content, next);
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

  const grace = content.baseRules.tierLossAfterHours + modifiers(content, next).graceHours;
  if (now - next.upkeepPaidUntil >= grace * HOUR) {
    const standing = Object.entries(next.buildings)
      .filter(([, level]) => level > 0)
      .sort((a, b) => levelCost(content, b[0], b[1]) - levelCost(content, a[0], a[1]));
    const dearest = standing[0];
    if (dearest) {
      const [building, level] = dearest;
      const buildings = { ...next.buildings };
      if (level > 1) buildings[building] = level - 1;
      else delete buildings[building];
      events.push({ type: "building_decayed", building, level: level - 1 });
      next = { ...next, buildings, upkeepPaidUntil: now };
    } else {
      const lower = TIERS[Math.max(0, TIERS.indexOf(next.tier) - 1)] ?? "twig";
      if (lower !== next.tier) {
        events.push({ type: "decayed", from: next.tier, to: lower });
        next = { ...next, tier: lower, upkeepPaidUntil: now };
      }
    }
  }
  return { state: next, events };
}

// --- tools -------------------------------------------------------------------

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

// --- furnaces ----------------------------------------------------------------

/** Fuel per 100 ore after the buildings' savings (the kiln). */
export function fuelPer100(content: Content, state: BaseState, furnace: Furnace): number {
  return Math.max(0, furnace.fuelPer100Ore - modifiers(content, state).fuelPer100Ore);
}

/** Fuel for smelting `amount` ore, in `furnace.fuel`. */
export function fuelFor(
  content: Content,
  state: BaseState,
  furnace: Furnace,
  amount: number,
): number {
  return Math.ceil((amount * fuelPer100(content, state, furnace)) / 100);
}

/** Ore per hour a new job runs at: the furnace type sped up by the buildings (the generator). */
export function smeltRate(content: Content, state: BaseState, furnace: Furnace): number {
  return Math.floor((furnace.orePerHour * (100 + modifiers(content, state).smeltPercent)) / 100);
}

/** How much of `ore` a new job would take: all in stock, limited by fuel and the job cap. */
export function smeltable(content: Content, state: BaseState, ore: string): number {
  const furnace = furnaceOf(content, state);
  if (!furnace) return 0;
  let amount = Math.min(state.stock[ore] ?? 0, furnace.maxOrePerJob);
  const per100 = fuelPer100(content, state, furnace);
  if (per100 > 0) {
    // Burning the ore's own stock as fuel (never the case today) would double-count it.
    const fuelStock = (state.stock[furnace.fuel] ?? 0) - (furnace.fuel === ore ? amount : 0);
    const byFuel = Math.floor((Math.max(0, fuelStock) * 100) / per100);
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
  const fuel = fuelFor(content, state, furnace, amount);
  const job: FurnaceJob = {
    input: ore,
    output,
    amount,
    startedAt: now,
    collected: 0,
    perHour: smeltRate(content, state, furnace),
  };
  const paid: Amounts = { [ore]: amount };
  if (fuel > 0) paid[furnace.fuel] = (paid[furnace.fuel] ?? 0) + fuel;
  const stock = subtract(state.stock, paid);
  stock[output] ??= 0;
  return {
    ok: true,
    state: { ...state, stock, furnaceJobs: [...state.furnaceJobs, job] },
    job,
    fuel,
  };
}

/** Units smelted so far, whether or not taken out. */
export function jobProgress(job: FurnaceJob, now: number): number {
  return Math.min(job.amount, Math.floor((job.perHour * Math.max(0, now - job.startedAt)) / HOUR));
}

export function jobEndsAt(job: FurnaceJob): number {
  return job.startedAt + Math.ceil((job.amount * HOUR) / job.perHour);
}

/** Output waiting in every slot, by refined resource. */
export function furnaceReady(state: BaseState, now: number): Amounts {
  const out: Amounts = {};
  for (const job of state.furnaceJobs) {
    const ready = jobProgress(job, now) - job.collected;
    if (ready > 0) out[job.output] = (out[job.output] ?? 0) + ready;
  }
  return out;
}

/** Takes finished output out of every slot (as far as storage allows); finished jobs free their slot. */
export function collectFurnaces(content: Content, state: BaseState, now: number): Collected {
  const cap = storageCap(content, state);
  let stock = { ...state.stock };
  const gained: Amounts = {};
  const jobs: FurnaceJob[] = [];
  for (const job of state.furnaceJobs) {
    const ready = jobProgress(job, now) - job.collected;
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
