/**
 * The core loop, as pure functions: state + content + `now` in, new state +
 * what happened out. No Discord, no database, no clock. The simulator and the
 * unit tests drive exactly this code.
 *
 * Time is UTC unix seconds; amounts are integers. Lazy evaluation: nothing
 * ticks, resources are computed from `lastCollectedAt` when someone looks.
 */
import type { Amounts, Content, Tool } from "../content/schema";
import type { Tier } from "../ui/theme";

export interface BaseState {
  tier: Tier;
  toolId: string;
  /** Banked resources. A key is present from the moment the player first gains it. */
  stock: Amounts;
  lastCollectedAt: number;
  /** Null until the first Gather. */
  lastGatherAt: number | null;
}

const HOUR = 3600;

export function newBase(content: Content, now: number): BaseState {
  const tool = content.tools[0];
  if (!tool) throw new Error("tools.json5 lists no tools");
  const stock: Amounts = {};
  for (const id of Object.keys(tool.rates)) stock[id] = 0;
  return { tier: "twig", toolId: tool.id, stock, lastCollectedAt: now, lastGatherAt: null };
}

export function toolOf(content: Content, state: BaseState): Tool {
  const tool = content.tools.find((candidate) => candidate.id === state.toolId);
  if (!tool) throw new Error(`unknown tool ${state.toolId}`);
  return tool;
}

/** The tier after the current one, or null at the top. */
export function nextTool(content: Content, state: BaseState): Tool | null {
  const index = content.tools.findIndex((tool) => tool.id === state.toolId);
  return content.tools[index + 1] ?? null;
}

export function storageCap(content: Content, state: BaseState): number {
  const tier = content.baseTiers.find((candidate) => candidate.id === state.tier);
  if (!tier) throw new Error(`unknown base tier ${state.tier}`);
  return tier.storageCap;
}

export function total(amounts: Amounts): number {
  let sum = 0;
  for (const amount of Object.values(amounts)) sum += amount;
  return sum;
}

export function isEmpty(amounts: Amounts): boolean {
  return Object.values(amounts).every((amount) => amount === 0);
}

/** What a span of production yields, per resource, rounded down. */
function production(rates: Amounts, seconds: number): Amounts {
  const out: Amounts = {};
  for (const [id, perHour] of Object.entries(rates)) {
    out[id] = Math.floor((perHour * seconds) / HOUR);
  }
  return out;
}

/**
 * Shrinks `wanted` so its total fits in `free`, proportionally. Rounds down,
 * so a full storage never overflows by even one unit.
 */
export function fitToSpace(wanted: Amounts, free: number): Amounts {
  const sum = total(wanted);
  if (sum <= Math.max(0, free)) return { ...wanted };
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(wanted)) {
    out[id] = free <= 0 ? 0 : Math.floor((amount * free) / sum);
  }
  return out;
}

/**
 * What has piled up since the last collect, already capped by storage space.
 * Fractions of a unit are dropped, so collecting twice within a second loses
 * at most one unit per resource; accepted for the simplicity of integer state.
 */
export function accrued(content: Content, state: BaseState, now: number): Amounts {
  const seconds = Math.max(0, now - state.lastCollectedAt);
  const wanted = production(toolOf(content, state).rates, seconds);
  return fitToSpace(wanted, storageCap(content, state) - total(state.stock));
}

/** True when storage would not take another unit: the check-in signal. */
export function isStorageFull(content: Content, state: BaseState, now: number): boolean {
  return total(state.stock) + total(accrued(content, state, now)) >= storageCap(content, state);
}

function add(stock: Amounts, gained: Amounts): Amounts {
  const out = { ...stock };
  for (const [id, amount] of Object.entries(gained)) out[id] = (out[id] ?? 0) + amount;
  return out;
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
  const bonus = fitToSpace(wanted, storageCap(content, state) - total(banked.state.stock));
  return {
    ok: true,
    state: { ...banked.state, stock: add(banked.state.stock, bonus), lastGatherAt: now },
    gained: banked.gained,
    bonus,
  };
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
  const stock = { ...banked.state.stock };
  for (const [id, amount] of Object.entries(tool.cost)) stock[id] = (stock[id] ?? 0) - amount;
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
