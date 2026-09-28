/**
 * Barrels and daily tasks. Pure like `base.ts`; randomness comes from the
 * base's own seed. Balance in `data/active.json5`.
 */
import type { Amounts, Content, Task } from "@wipe-day/content/schema";
import { add, type BaseState, clampToCap, type DailyTasks, furnaceOf, storageCap } from "./base";
import type { GameEvent } from "./events";
import { modifiers } from "./modifiers";
import { rollBlueprint } from "./recipes";
import { pickWeighted, rng, seedOf } from "./rng";

const DAY = 86400;

// --- barrels ----------------------------------------------------------------------

/** Spawns or expires the barrel according to the schedule. Part of settling. */
export function settleBarrel(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const { barrels } = content.active;
  const mods = modifiers(content, state);
  // The radio mast brings them sooner (never more than hourly); the watchtower keeps them longer.
  const every = Math.max(60, barrels.everyMinutes - mods.barrelEveryMinutes) * 60;
  const lifetime = (barrels.expiresMinutes + mods.barrelLifeMinutes) * 60;
  let next = state;
  if (next.barrel && now > next.barrel.expiresAt) next = { ...next, barrel: null };
  if (next.barrel || now < next.nextBarrelAt) return { state: next, events: [] };
  // Skip the barrels that washed up and drifted off while nobody looked.
  const missed = Math.floor((now - next.nextBarrelAt) / every);
  const spawnedAt = next.nextBarrelAt + missed * every;
  const expiresAt = spawnedAt + lifetime;
  const nextBarrelAt = spawnedAt + every;
  if (now > expiresAt) return { state: { ...next, nextBarrelAt }, events: [] };
  return {
    state: {
      ...next,
      barrel: { spawnedAt, expiresAt, seed: seedOf(state.seed, spawnedAt) },
      nextBarrelAt,
    },
    events: [{ type: "barrel_spawned", expiresAt }],
  };
}

export type BarrelResult =
  | { ok: true; state: BaseState; gained: Amounts; blueprint: string | null }
  | { ok: false; reason: "no_barrel" };

/**
 * Breaks the barrel: weighted rolls from the loot table, banked at once (capped),
 * and now and then a blueprint the base does not know yet.
 */
export function breakBarrel(content: Content, state: BaseState, now: number): BarrelResult {
  const barrel = state.barrel;
  if (!barrel || now > barrel.expiresAt) return { ok: false, reason: "no_barrel" };
  const { barrels } = content.active;
  const random = rng(barrel.seed);
  const loot: Amounts = {};
  for (let roll = 0; roll < barrels.rolls; roll++) {
    const entry =
      barrels.loot[
        pickWeighted(
          random,
          barrels.loot.map((c) => c.weight),
        )
      ];
    if (!entry) continue;
    loot[entry.resource] = (loot[entry.resource] ?? 0) + random.int(entry.min, entry.max);
  }
  const gained = clampToCap(storageCap(content, state), state.stock, loot);
  const blueprint = rollBlueprint(
    content,
    state,
    content.crafting.blueprints.barrelPercent,
    barrel.seed,
  );
  const blueprints = blueprint ? [...state.blueprints, blueprint] : state.blueprints;
  return {
    ok: true,
    state: { ...state, stock: add(state.stock, gained), barrel: null, blueprints },
    gained,
    blueprint,
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
  if (task.requires === "furnace") return furnaceOf(content, state) !== null;
  if (task.requires === "workbench") return (state.buildings.workbench ?? 0) > 0;
  return true;
}

/** Today's picks: the same order for everyone, tasks the base cannot do yet skipped. */
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

/** Adds progress to every active task of `kind`; completed ones pay out at once. */
export function progressTasks(
  content: Content,
  state: BaseState,
  kind: Task["kind"],
  amount: number,
): { state: BaseState; events: GameEvent[] } {
  if (amount <= 0) return { state, events: [] };
  const events: GameEvent[] = [];
  let next = state;
  for (const id of next.tasks.ids) {
    if (next.tasks.done.includes(id)) continue;
    const task = taskOf(content, id);
    if (!task || task.kind !== kind) continue;
    const progress = Math.min(task.target, (next.tasks.progress[id] ?? 0) + amount);
    const done = progress >= task.target;
    const reward = done ? clampToCap(storageCap(content, next), next.stock, task.reward) : {};
    // A blueprint task draws one the base does not know yet, seeded by the day and the task.
    const blueprint =
      done && task.blueprint
        ? rollBlueprint(content, next, 100, next.tasks.day, next.tasks.ids.indexOf(id))
        : null;
    next = {
      ...next,
      stock: done ? add(next.stock, reward) : next.stock,
      tasks: {
        ...next.tasks,
        progress: { ...next.tasks.progress, [id]: progress },
        done: done ? [...next.tasks.done, id] : next.tasks.done,
      },
      blueprints: blueprint ? [...next.blueprints, blueprint] : next.blueprints,
    };
    if (done) events.push({ type: "task_done", task: id, reward });
    if (blueprint) events.push({ type: "blueprint_found", recipe: blueprint, from: "task" });
  }
  return { state: next, events };
}

export function taskOf(content: Content, id: string): Task | undefined {
  return content.active.tasks.pool.find((task) => task.id === id);
}
