/**
 * The prototype store. A fake clock drives accrual, timers and the day cycle;
 * actions mutate state and emit scene events. This is placeholder logic that
 * the real domain package will replace one function at a time.
 */
import { create } from "zustand";
import { emit } from "./events";
import {
  BARREL_EVERY,
  BARREL_LIFETIME,
  BASE_TIERS,
  FURNACE_RATE,
  GAME_DAY,
  GATHER_BONUS_MINUTES,
  GATHER_COOLDOWN,
  ITEMS,
  type ItemId,
  itemById,
  nextTier,
  type ResourceId,
  SURVIVORS,
  type Survivor,
  type Task,
  type Tier,
  TOOLS,
  type ToolId,
  tierById,
  toolOf,
} from "./world";

export type Amounts = Partial<Record<ResourceId, number>>;
export type Weather = "clear" | "rain" | "fog";
export type Panel = "build" | "craft" | "furnace" | "inventory" | "tasks" | "squad" | "map" | null;

export interface FurnaceJob {
  input: ResourceId;
  output: ResourceId;
  amount: number;
  startedAt: number;
  taken: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

export interface WorldState {
  /** Game seconds since the season started. */
  clock: number;
  /** Game seconds per real second. */
  timeScale: number;
  paused: boolean;
  tier: Tier;
  build: { tier: Tier; endsAt: number } | null;
  tool: ToolId;
  stock: Amounts;
  /** Accrued since the last collect. */
  pending: Amounts;
  lastGatherAt: number;
  items: Partial<Record<ItemId, number>>;
  furnace: { owned: boolean; jobs: FurnaceJob[] };
  survivors: Survivor[];
  barrel: { expiresAt: number } | null;
  nextBarrelAt: number;
  weather: Weather;
  tasks: Task[];
  toasts: Toast[];
  panel: Panel;
  showAway: boolean;
  demoOpen: boolean;
}

interface Actions {
  tick(realSeconds: number): void;
  gather(): boolean;
  collect(): void;
  startBuild(): void;
  craft(item: ItemId): void;
  smelt(ore: ResourceId): void;
  takeOut(): void;
  breakBarrel(): void;
  bankNodeHit(node: string, hits: number): void;
  openPanel(panel: Panel): void;
  dismissAway(): void;
  toast(text: string, tone?: Toast["tone"]): void;
  dismissToast(id: number): void;
  setTimeScale(scale: number): void;
  setPaused(paused: boolean): void;
  setWeather(weather: Weather): void;
  jumpTier(tier: Tier): void;
  spawnBarrel(): void;
  giveEverything(): void;
  setDemoOpen(open: boolean): void;
  addHours(hours: number): void;
}

export type Store = WorldState & Actions;

let toastId = 0;

const cap = (state: Pick<WorldState, "tier" | "items">): number => {
  const base = tierById.get(state.tier)?.cap ?? 1500;
  const crates = state.items.crate ?? 0;
  return base + crates * (itemById.get("crate")?.capacity ?? 0);
};

function add(a: Amounts, b: Amounts, limit?: number): Amounts {
  const out: Amounts = { ...a };
  for (const [id, amount] of Object.entries(b)) {
    const key = id as ResourceId;
    const next = (out[key] ?? 0) + (amount ?? 0);
    out[key] = limit === undefined ? next : Math.min(limit, next);
  }
  return out;
}

function subtract(a: Amounts, b: Amounts): Amounts {
  const out: Amounts = { ...a };
  for (const [id, amount] of Object.entries(b)) {
    const key = id as ResourceId;
    out[key] = (out[key] ?? 0) - (amount ?? 0);
  }
  return out;
}

function production(tool: ToolId, seconds: number): Amounts {
  const out: Amounts = {};
  for (const [id, perHour] of Object.entries(toolOf(tool).rates)) {
    out[id as ResourceId] = ((perHour ?? 0) * seconds) / 3600;
  }
  return out;
}

const initialTasks = (): Task[] => [
  {
    id: "gather_4",
    name: "Gather 4 times",
    target: 4,
    progress: 1,
    reward: { scrap: 5, timber: 200 },
    done: false,
  },
  {
    id: "smelt_300",
    name: "Smelt 300 ore",
    target: 300,
    progress: 0,
    reward: { scrap: 10, ingots: 50 },
    done: false,
  },
  {
    id: "craft_1",
    name: "Craft something",
    target: 1,
    progress: 0,
    reward: { scrap: 10 },
    done: false,
  },
];

const START_CLOCK = 3 * GAME_DAY + 9 * 3600;

const initial: WorldState = {
  clock: START_CLOCK,
  timeScale: 240,
  paused: false,
  tier: "wood",
  build: null,
  tool: "stone_tools",
  stock: { timber: 1840, stone: 1210, ore: 260, sulfur_ore: 40, fibre: 90, ingots: 120, scrap: 14 },
  pending: { timber: 210, stone: 160, ore: 40, sulfur_ore: 12, fibre: 20 },
  lastGatherAt: START_CLOCK - 20 * 60,
  items: { workbench: 1, crate: 2, campfire: 1, bow: 1 },
  furnace: { owned: true, jobs: [] },
  survivors: SURVIVORS,
  barrel: { expiresAt: START_CLOCK + 30 * 60 },
  nextBarrelAt: START_CLOCK + BARREL_EVERY,
  weather: "clear",
  tasks: initialTasks(),
  toasts: [],
  panel: null,
  showAway: true,
  demoOpen: false,
};

function progressTask(
  tasks: Task[],
  id: string,
  amount: number,
): { tasks: Task[]; done: Task | null } {
  let done: Task | null = null;
  const next = tasks.map((task) => {
    if (task.id !== id || task.done) return task;
    const progress = Math.min(task.target, task.progress + amount);
    const finished = progress >= task.target;
    if (finished) done = { ...task, progress, done: true };
    return { ...task, progress, done: finished };
  });
  return { tasks: next, done };
}

export const useWorld = create<Store>((set, get) => ({
  ...initial,

  tick(realSeconds) {
    const state = get();
    if (state.paused) return;
    const dt = realSeconds * state.timeScale;
    const clock = state.clock + dt;
    let next: Partial<WorldState> = { clock };

    // Accrual into the pending pile, each resource capped by its room.
    const room = cap(state);
    const gained = production(state.tool, dt);
    const pending: Amounts = { ...state.pending };
    for (const [id, amount] of Object.entries(gained)) {
      const key = id as ResourceId;
      const held = (state.stock[key] ?? 0) + (pending[key] ?? 0);
      pending[key] = (pending[key] ?? 0) + Math.min(amount ?? 0, Math.max(0, room - held));
    }
    next.pending = pending;

    // Builds land.
    if (state.build && state.build.endsAt <= clock) {
      next = { ...next, tier: state.build.tier, build: null };
      emit({ type: "build_done", tier: state.build.tier });
      get().toast(`Your base is now ${tierById.get(state.build.tier)?.name}.`, "success");
    }

    // Barrels wash up and drift off.
    if (state.barrel && clock > state.barrel.expiresAt) {
      next.barrel = null;
    }
    if (!state.barrel && clock >= state.nextBarrelAt) {
      next.barrel = { expiresAt: clock + BARREL_LIFETIME };
      next.nextBarrelAt = clock + BARREL_EVERY;
      emit({ type: "barrel_spawned" });
      get().toast("A barrel washed up on the shore.", "warning");
    }
    set(next);
  },

  gather() {
    const state = get();
    if (state.clock - state.lastGatherAt < GATHER_COOLDOWN) return false;
    const bonus = production(state.tool, GATHER_BONUS_MINUTES * 60);
    const banked = add(state.pending, {}, undefined);
    const stock = add(add(state.stock, banked), bonus, cap(state));
    const { tasks, done } = progressTask(state.tasks, "gather_4", 1);
    set({ stock, pending: {}, lastGatherAt: state.clock, tasks });
    emit({ type: "gathered", node: "tree_1", gained: bonus });
    if (done) {
      get().toast(`Task done: ${done.name}`, "success");
      set({ stock: add(get().stock, done.reward, cap(state)) });
    }
    return true;
  },

  collect() {
    const state = get();
    const gained = state.pending;
    set({ stock: add(state.stock, gained, cap(state)), pending: {} });
    emit({ type: "collected", gained });
  },

  startBuild() {
    const state = get();
    const target = nextTier(state.tier);
    if (!target || state.build) return;
    const tier = tierById.get(target);
    if (!tier) return;
    const stock = subtract(state.stock, tier.cost);
    const endsAt = state.clock + tier.buildMinutes * 60;
    if (tier.buildMinutes === 0) {
      set({ stock, tier: target });
      emit({ type: "build_done", tier: target });
      get().toast(`Your base is now ${tier.name}.`, "success");
    } else {
      set({ stock, build: { tier: target, endsAt } });
      emit({ type: "build_started", tier: target });
      get().toast(`Upgrade to ${tier.name} started.`, "neutral");
    }
  },

  craft(itemId) {
    const state = get();
    const item = itemById.get(itemId);
    if (!item) return;
    const { tasks, done } = progressTask(state.tasks, "craft_1", 1);
    set({
      stock: subtract(state.stock, item.cost),
      items: { ...state.items, [itemId]: (state.items[itemId] ?? 0) + 1 },
      tasks,
    });
    emit({ type: "crafted", item: itemId });
    get().toast(`Crafted ${item.name}.`, "success");
    if (done) get().toast(`Task done: ${done.name}`, "success");
  },

  smelt(ore) {
    const state = get();
    const slots = tierById.get(state.tier)?.furnaceSlots ?? 1;
    if (!state.furnace.owned || state.furnace.jobs.length >= slots) return;
    const output: ResourceId = ore === "ore" ? "ingots" : "sulfur";
    const amount = Math.min(state.stock[ore] ?? 0, 1000);
    if (amount <= 0) return;
    const fuel = Math.ceil(amount / 2);
    const job: FurnaceJob = { input: ore, output, amount, startedAt: state.clock, taken: 0 };
    const { tasks, done } = progressTask(state.tasks, "smelt_300", amount);
    set({
      stock: subtract(state.stock, { [ore]: amount, timber: fuel }),
      furnace: { ...state.furnace, jobs: [...state.furnace.jobs, job] },
      tasks,
    });
    emit({ type: "smelt_started" });
    if (done) get().toast(`Task done: ${done.name}`, "success");
  },

  takeOut() {
    const state = get();
    const gained: Amounts = {};
    const jobs: FurnaceJob[] = [];
    for (const job of state.furnace.jobs) {
      const progress = Math.min(
        job.amount,
        Math.floor((FURNACE_RATE * (state.clock - job.startedAt)) / 3600),
      );
      const take = progress - job.taken;
      if (take > 0) gained[job.output] = (gained[job.output] ?? 0) + take;
      if (progress < job.amount) jobs.push({ ...job, taken: progress });
    }
    set({ stock: add(state.stock, gained, cap(state)), furnace: { ...state.furnace, jobs } });
    emit({ type: "furnace_out", gained });
  },

  breakBarrel() {
    const state = get();
    if (!state.barrel) return;
    const gained: Amounts = {
      scrap: 3 + Math.floor(Math.random() * 6),
      fibre: 10 + Math.floor(Math.random() * 20),
    };
    if (Math.random() < 0.4) gained.fat = 5 + Math.floor(Math.random() * 10);
    set({ stock: add(state.stock, gained, cap(state)), barrel: null });
    emit({ type: "barrel_broken", gained });
  },

  bankNodeHit(node, hits) {
    const state = get();
    const slice = production(state.tool, GATHER_BONUS_MINUTES * 60 * 0.1);
    set({ stock: add(state.stock, slice, cap(state)) });
    emit({ type: "node_hit", node, hits, gained: slice });
  },

  openPanel(panel) {
    set({ panel: get().panel === panel ? null : panel });
  },

  dismissAway() {
    set({ showAway: false });
  },

  toast(text, tone = "neutral") {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    setTimeout(() => get().dismissToast(id), 4500);
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },

  setTimeScale(timeScale) {
    set({ timeScale });
  },

  setPaused(paused) {
    set({ paused });
  },

  setWeather(weather) {
    set({ weather });
    emit({ type: "weather", weather });
  },

  jumpTier(tier) {
    set({ tier, build: null });
    emit({ type: "build_done", tier });
  },

  spawnBarrel() {
    set({ barrel: { expiresAt: get().clock + BARREL_LIFETIME } });
    emit({ type: "barrel_spawned" });
  },

  giveEverything() {
    const state = get();
    const stock: Amounts = {};
    for (const id of [
      "timber",
      "stone",
      "ore",
      "ingots",
      "sulfur_ore",
      "sulfur",
      "fibre",
      "hide",
      "fat",
      "fuel",
      "scrap",
    ] as ResourceId[]) {
      stock[id] = 50_000;
    }
    const items: Partial<Record<ItemId, number>> = {};
    for (const item of ITEMS) items[item.id] = 1;
    set({ stock, items: { ...items, crate: 6 }, tool: TOOLS[2]?.id ?? state.tool });
  },

  setDemoOpen(demoOpen) {
    set({ demoOpen });
  },

  addHours(hours) {
    set({ clock: get().clock + hours * 3600 });
  },
}));

/** Storage room per resource, for the HUD. */
export function storageCap(state: Pick<WorldState, "tier" | "items">): number {
  return cap(state);
}

export function gatherReadyIn(state: Pick<WorldState, "clock" | "lastGatherAt">): number {
  return Math.max(0, state.lastGatherAt + GATHER_COOLDOWN - state.clock);
}

export function nextTierInfo(state: Pick<WorldState, "tier">) {
  const target = nextTier(state.tier);
  return target ? (BASE_TIERS.find((tier) => tier.id === target) ?? null) : null;
}
