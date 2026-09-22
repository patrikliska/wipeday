/**
 * Active play between gathers: the node mini-game, barrels and daily tasks.
 * Pure like `base.ts`; randomness comes in as seeds. Balance in
 * `data/active.json5`.
 */
import type { Amounts, Content, Task } from "../content/schema";
import {
  add,
  type BaseState,
  clampToCap,
  type SettleEvent,
  settle,
  storageCap,
  toolOf,
  workbenchLevel,
} from "./base";
import { pickWeighted, rng, seedOf } from "./rng";

const HOUR = 3600;
const DAY = 86400;

// --- state -------------------------------------------------------------------

export interface NodeRun {
  hits: number;
  /** Which of the `positions` buttons is the marker, 0-based. */
  marker: number;
  seed: number;
  /** The run starts on this hit; the marker fades `hitWindowSeconds` after. */
  lastHitAt: number;
  /** What one hit banks. Fixed at run start so a tool upgrade mid-run cannot re-price it. */
  perHit: Amounts;
  /** Everything banked so far. */
  banked: Amounts;
  /** Why it ended; null while alive. */
  ended: "perfect" | "missed" | "faded" | null;
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

export interface ActiveState {
  nodeRun: NodeRun | null;
  barrel: Barrel | null;
  /** When the next barrel is scheduled to wash up. */
  nextBarrelAt: number;
  tasks: DailyTasks;
}

export function newActive(content: Content, now: number): ActiveState {
  return {
    nodeRun: null,
    barrel: null,
    nextBarrelAt: now + content.active.barrels.firstAfterMinutes * 60,
    tasks: { day: -1, ids: [], progress: {}, done: [] },
  };
}

// --- node runs -----------------------------------------------------------------

/** Positions are 0-based; the first marker never sits on the first button, so a reflexive tap does not score. */
function nextMarker(seed: number, hits: number, positions: number, previous: number): number {
  const random = rng(seedOf(seed, hits));
  const marker = random.int(0, positions - 2);
  return marker >= previous ? marker + 1 : marker;
}

/** Starts a run right after a gather: what one hit is worth comes from the current tool. */
export function startNodeRun(
  content: Content,
  state: BaseState,
  now: number,
  seed: number,
): BaseState {
  const { node } = content.active;
  const tool = toolOf(content, state);
  const perHit: Amounts = {};
  for (const [id, perHour] of Object.entries(tool.rates)) {
    perHit[id] = Math.floor((perHour * tool.bonusMinutes * node.hitPercentOfBonus) / (60 * 100));
  }
  const run: NodeRun = {
    hits: 0,
    marker: nextMarker(seed, 0, node.positions, 0),
    seed,
    lastHitAt: now,
    perHit,
    banked: {},
    ended: null,
  };
  return { ...state, nodeRun: run };
}

export function nodeRunAlive(content: Content, state: BaseState, now: number): boolean {
  const run = state.nodeRun;
  if (!run || run.ended) return false;
  return now - run.lastHitAt <= content.active.node.hitWindowSeconds;
}

export type HitResult =
  | { ok: true; state: BaseState; gained: Amounts; run: NodeRun }
  | { ok: false; reason: "no_run" | "over"; run: NodeRun | null };

/** One press of button `position`. */
export function hitNode(
  content: Content,
  state: BaseState,
  now: number,
  position: number,
): HitResult {
  const run = state.nodeRun;
  if (!run) return { ok: false, reason: "no_run", run: null };
  if (run.ended) return { ok: false, reason: "over", run };
  const { node } = content.active;
  if (now - run.lastHitAt > node.hitWindowSeconds) {
    const faded = { ...run, ended: "faded" as const };
    return { ok: false, reason: "over", run: faded };
  }
  if (position !== run.marker) {
    const missed = { ...run, ended: "missed" as const };
    return { ok: true, state: { ...state, nodeRun: missed }, gained: {}, run: missed };
  }
  const gained = clampToCap(storageCap(content, state), state.stock, run.perHit);
  const hits = run.hits + 1;
  const next: NodeRun = {
    ...run,
    hits,
    marker: nextMarker(run.seed, hits, node.positions, run.marker),
    lastHitAt: now,
    banked: add(run.banked, gained),
    ended: hits >= node.maxHits ? "perfect" : null,
  };
  return {
    ok: true,
    state: { ...state, stock: add(state.stock, gained), nodeRun: next },
    gained,
    run: next,
  };
}

/** Marks a run whose window passed as faded, so the screen can say so. */
export function expireNodeRun(content: Content, state: BaseState, now: number): BaseState {
  const run = state.nodeRun;
  if (!run || run.ended || nodeRunAlive(content, state, now)) return state;
  return { ...state, nodeRun: { ...run, ended: "faded" } };
}

// --- barrels ----------------------------------------------------------------------

/** Spawns or expires the barrel according to the schedule. Part of settling. */
export function settleBarrel(content: Content, state: BaseState, now: number): BaseState {
  const { barrels } = content.active;
  const every = barrels.everyMinutes * 60;
  const lifetime = barrels.expiresMinutes * 60;
  let next = state;
  if (next.barrel && now > next.barrel.expiresAt) next = { ...next, barrel: null };
  if (next.barrel || now < next.nextBarrelAt) return next;
  // Skip the barrels that washed up and vanished while nobody looked.
  const missed = Math.floor((now - next.nextBarrelAt) / every);
  const spawnedAt = next.nextBarrelAt + missed * every;
  const expiresAt = spawnedAt + lifetime;
  const nextBarrelAt = spawnedAt + every;
  if (now > expiresAt) return { ...next, nextBarrelAt };
  return { ...next, barrel: { spawnedAt, expiresAt, seed: seedOf(spawnedAt) }, nextBarrelAt };
}

export interface BarrelLoot {
  resources: Amounts;
  items: Record<string, number>;
}

export type BarrelResult =
  | { ok: true; state: BaseState; loot: BarrelLoot }
  | { ok: false; reason: "no_barrel" | "expired" };

/** Breaks the barrel: weighted rolls from the loot table, banked at once. */
export function breakBarrel(content: Content, state: BaseState, now: number): BarrelResult {
  const barrel = state.barrel;
  if (!barrel) return { ok: false, reason: "no_barrel" };
  if (now > barrel.expiresAt) return { ok: false, reason: "expired" };
  const { barrels } = content.active;
  const random = rng(barrel.seed);
  const loot: BarrelLoot = { resources: {}, items: {} };
  for (let roll = 0; roll < barrels.rolls; roll++) {
    const entry =
      barrels.loot[
        pickWeighted(
          random,
          barrels.loot.map((candidate) => candidate.weight),
        )
      ];
    if (!entry) continue;
    const amount = random.int(entry.min, entry.max);
    if (entry.resource)
      loot.resources[entry.resource] = (loot.resources[entry.resource] ?? 0) + amount;
    if (entry.item) loot.items[entry.item] = (loot.items[entry.item] ?? 0) + amount;
  }
  const resources = clampToCap(storageCap(content, state), state.stock, loot.resources);
  const items = { ...state.items };
  for (const [id, count] of Object.entries(loot.items)) items[id] = (items[id] ?? 0) + count;
  return {
    ok: true,
    state: { ...state, stock: add(state.stock, resources), items, barrel: null },
    loot: { resources, items: loot.items },
  };
}

// --- daily tasks ----------------------------------------------------------------

export function utcDay(now: number): number {
  return Math.floor(now / DAY);
}

export function nextTaskResetAt(now: number): number {
  return (utcDay(now) + 1) * DAY;
}

function eligible(content: Content, state: BaseState, task: Task): boolean {
  if (task.requires === "furnace") return state.furnaceId !== null;
  if (task.requires === "workbench") return workbenchLevel(content, state) > 0;
  return true;
}

/** Today's picks: the same order for everyone, tasks the player cannot do yet skipped. */
export function rollTasks(content: Content, state: BaseState, day: number): DailyTasks {
  const { tasks } = content.active;
  const random = rng(seedOf(day, 0x7a5c));
  const order = tasks.pool.map((task, index) => ({ task, key: random.next(), index }));
  order.sort((a, b) => a.key - b.key || a.index - b.index);
  const ids = order
    .map((entry) => entry.task)
    .filter((task) => eligible(content, state, task))
    .slice(0, tasks.perDay)
    .map((task) => task.id);
  return { day, ids, progress: {}, done: [] };
}

/** Rolls new tasks when the UTC day changed. Part of settling. */
export function settleTasks(content: Content, state: BaseState, now: number): BaseState {
  const day = utcDay(now);
  if (state.tasks.day === day) return state;
  return { ...state, tasks: rollTasks(content, state, day) };
}

export interface TaskDone {
  task: Task;
  reward: Amounts;
}

/** Adds progress to every active task of `kind`; completed ones pay out at once. */
export function progressTasks(
  content: Content,
  state: BaseState,
  kind: Task["kind"],
  amount: number,
): { state: BaseState; completed: TaskDone[] } {
  if (amount <= 0) return { state, completed: [] };
  const completed: TaskDone[] = [];
  let next = state;
  for (const id of next.tasks.ids) {
    if (next.tasks.done.includes(id)) continue;
    const task = content.active.tasks.pool.find((candidate) => candidate.id === id);
    if (!task || task.kind !== kind) continue;
    const progress = Math.min(task.target, (next.tasks.progress[id] ?? 0) + amount);
    const done = progress >= task.target;
    const reward = done ? clampToCap(storageCap(content, next), next.stock, task.reward) : {};
    next = {
      ...next,
      stock: done ? add(next.stock, reward) : next.stock,
      tasks: {
        ...next.tasks,
        progress: { ...next.tasks.progress, [id]: progress },
        done: done ? [...next.tasks.done, id] : next.tasks.done,
      },
    };
    if (done) completed.push({ task, reward });
  }
  return { state: next, completed };
}

export function taskOf(content: Content, id: string): Task | undefined {
  return content.active.tasks.pool.find((task) => task.id === id);
}

// --- settle everything -------------------------------------------------------------

/** `base.settle` plus barrels, task days and a faded node run. What every action runs first. */
export function settleAll(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: SettleEvent[] } {
  const base = settle(content, state, now);
  let next = settleBarrel(content, base.state, now);
  next = settleTasks(content, next, now);
  next = expireNodeRun(content, next, now);
  return { state: next, events: base.events };
}

/** Seconds of upkeep grace used by the UI to phrase "barrel gone <t:R>"; re-exported for convenience. */
export const SECONDS_PER_HOUR = HOUR;
