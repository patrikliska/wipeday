/**
 * The prototype's world: a compact, self-contained stand-in for the real
 * domain package. Enough rules for the scene and HUD to feel alive (accrual,
 * caps, builds with timers, a furnace job, crafting, barrels, tasks, a day
 * cycle), none of the real balance. Everything here is placeholder content
 * with our own names: no Rust items.
 */

export type Tier = "twig" | "wood" | "stone" | "metal" | "hqm";
export const TIERS: Tier[] = ["twig", "wood", "stone", "metal", "hqm"];

export type ResourceId =
  | "timber"
  | "stone"
  | "ore"
  | "ingots"
  | "sulfur_ore"
  | "sulfur"
  | "fibre"
  | "hide"
  | "fat"
  | "fuel"
  | "scrap";

export interface Resource {
  id: ResourceId;
  name: string;
  /** Tile colour for the placeholder icon. */
  color: string;
  initials: string;
  kind: "raw" | "refined" | "currency";
}

export const RESOURCES: Resource[] = [
  { id: "timber", name: "Timber", color: "#b07840", initials: "TI", kind: "raw" },
  { id: "stone", name: "Stone", color: "#9aa0a6", initials: "ST", kind: "raw" },
  { id: "ore", name: "Iron Ore", color: "#8c6a4f", initials: "OR", kind: "raw" },
  { id: "ingots", name: "Iron Ingots", color: "#6c97bc", initials: "IN", kind: "refined" },
  { id: "sulfur_ore", name: "Sulfur Ore", color: "#c9a227", initials: "SO", kind: "raw" },
  { id: "sulfur", name: "Sulfur", color: "#e3c04f", initials: "SU", kind: "refined" },
  { id: "fibre", name: "Fibre", color: "#7fa043", initials: "FI", kind: "raw" },
  { id: "hide", name: "Hide", color: "#8a5a3c", initials: "HI", kind: "raw" },
  { id: "fat", name: "Animal Fat", color: "#e8d9b0", initials: "FA", kind: "raw" },
  { id: "fuel", name: "Fuel", color: "#c85a2b", initials: "FU", kind: "refined" },
  { id: "scrap", name: "Scrap", color: "#a49e93", initials: "SC", kind: "currency" },
];

export const resourceById = new Map(RESOURCES.map((resource) => [resource.id, resource]));

export type ToolId = "rock" | "stone_tools" | "iron_tools" | "salvaged_tools" | "power_tools";

export interface Tool {
  id: ToolId;
  name: string;
  tier: Tier;
  /** Per game hour. */
  rates: Partial<Record<ResourceId, number>>;
  cost: Partial<Record<ResourceId, number>>;
}

export const TOOLS: Tool[] = [
  { id: "rock", name: "Rock", tier: "twig", rates: { timber: 120, stone: 80 }, cost: {} },
  {
    id: "stone_tools",
    name: "Stone Tools",
    tier: "wood",
    rates: { timber: 240, stone: 180, ore: 60, sulfur_ore: 20, fibre: 30 },
    cost: { timber: 240, stone: 120 },
  },
  {
    id: "iron_tools",
    name: "Iron Tools",
    tier: "stone",
    rates: { timber: 400, stone: 320, ore: 150, sulfur_ore: 60, fibre: 50, hide: 12, fat: 8 },
    cost: { timber: 800, stone: 600, ingots: 250 },
  },
  {
    id: "salvaged_tools",
    name: "Salvaged Tools",
    tier: "metal",
    rates: { timber: 700, stone: 560, ore: 300, sulfur_ore: 130, fibre: 90, hide: 30, fat: 20 },
    cost: { ingots: 1500, scrap: 600 },
  },
  {
    id: "power_tools",
    name: "Power Tools",
    tier: "hqm",
    rates: { timber: 1200, stone: 1000, ore: 560, sulfur_ore: 260, fibre: 160, hide: 60, fat: 40 },
    cost: { ingots: 3000, fuel: 400, scrap: 2000 },
  },
];

export interface BaseTier {
  id: Tier;
  name: string;
  cap: number;
  cost: Partial<Record<ResourceId, number>>;
  /** Game minutes. */
  buildMinutes: number;
  upkeep: Partial<Record<ResourceId, number>>;
  furnaceSlots: number;
}

export const BASE_TIERS: BaseTier[] = [
  { id: "twig", name: "Twig", cap: 1500, cost: {}, buildMinutes: 0, upkeep: {}, furnaceSlots: 1 },
  {
    id: "wood",
    name: "Timber",
    cap: 5000,
    cost: { timber: 1500, stone: 500 },
    buildMinutes: 0,
    upkeep: { timber: 30 },
    furnaceSlots: 1,
  },
  {
    id: "stone",
    name: "Stone",
    cap: 20000,
    cost: { stone: 6000, ingots: 800 },
    buildMinutes: 240,
    upkeep: { timber: 40, stone: 100 },
    furnaceSlots: 2,
  },
  {
    id: "metal",
    name: "Sheet Metal",
    cap: 80000,
    cost: { stone: 40000, ingots: 38000 },
    buildMinutes: 720,
    upkeep: { timber: 60, stone: 150, ingots: 60 },
    furnaceSlots: 3,
  },
  {
    id: "hqm",
    name: "Armored",
    cap: 300000,
    cost: { ingots: 25000, fuel: 400 },
    buildMinutes: 1440,
    upkeep: { timber: 80, stone: 200, ingots: 100, fuel: 2 },
    furnaceSlots: 4,
  },
];

export const tierById = new Map(BASE_TIERS.map((tier) => [tier.id, tier]));

export type ItemId =
  | "crate"
  | "workbench"
  | "campfire"
  | "kiln"
  | "press"
  | "bandage"
  | "bow"
  | "spear"
  | "hide_vest"
  | "lantern";

export interface Item {
  id: ItemId;
  name: string;
  tier: Tier;
  category: "storage" | "station" | "med" | "weapon" | "armor" | "utility";
  cost: Partial<Record<ResourceId, number>>;
  effect: string;
  /** Storage capacity added per resource. */
  capacity?: number;
}

export const ITEMS: Item[] = [
  {
    id: "workbench",
    name: "Workbench",
    tier: "wood",
    category: "station",
    cost: { timber: 500, stone: 100 },
    effect: "Unlocks crafting",
  },
  {
    id: "crate",
    name: "Storage Crate",
    tier: "wood",
    category: "storage",
    cost: { timber: 300 },
    effect: "+1000 storage of each resource",
    capacity: 1000,
  },
  {
    id: "campfire",
    name: "Campfire",
    tier: "twig",
    category: "station",
    cost: { timber: 100, stone: 50 },
    effect: "Survivors rest faster at night",
  },
  {
    id: "kiln",
    name: "Charcoal Kiln",
    tier: "stone",
    category: "station",
    cost: { stone: 400, timber: 200 },
    effect: "Timber → charcoal for fuel",
  },
  {
    id: "press",
    name: "Oil Press",
    tier: "stone",
    category: "station",
    cost: { timber: 350, ingots: 40 },
    effect: "Fat and seeds → fuel",
  },
  {
    id: "bandage",
    name: "Bandage",
    tier: "twig",
    category: "med",
    cost: { fibre: 4 },
    effect: "Heals a wounded survivor",
  },
  {
    id: "bow",
    name: "Hunting Bow",
    tier: "twig",
    category: "weapon",
    cost: { timber: 200, fibre: 50 },
    effect: "+3 squad power",
  },
  {
    id: "spear",
    name: "Iron Spear",
    tier: "stone",
    category: "weapon",
    cost: { timber: 100, ingots: 25 },
    effect: "+5 squad power",
  },
  {
    id: "hide_vest",
    name: "Hide Vest",
    tier: "wood",
    category: "armor",
    cost: { hide: 15, fibre: 10 },
    effect: "+2 squad armour",
  },
  {
    id: "lantern",
    name: "Oil Lantern",
    tier: "stone",
    category: "utility",
    cost: { ingots: 10, fuel: 5 },
    effect: "Light at night: +10% night output",
  },
];

export const itemById = new Map(ITEMS.map((item) => [item.id, item]));

export interface Survivor {
  id: string;
  name: string;
  /** Hat colour, the one thing that tells them apart until portraits exist. */
  hat: string;
  perk: "scavenger" | "medic" | "demolition" | "marksman" | "mule";
  health: number;
}

export const SURVIVORS: Survivor[] = [
  { id: "s1", name: "Mara", hat: "#c85a2b", perk: "scavenger", health: 100 },
  { id: "s2", name: "Dax", hat: "#4a7fb5", perk: "demolition", health: 100 },
  { id: "s3", name: "Ivo", hat: "#7fa043", perk: "medic", health: 64 },
];

export interface Task {
  id: string;
  name: string;
  target: number;
  progress: number;
  reward: Partial<Record<ResourceId, number>>;
  done: boolean;
}

export const GAME_DAY = 86_400;
export const GATHER_COOLDOWN = 10 * 60;
export const GATHER_BONUS_MINUTES = 30;
export const BARREL_EVERY = 4 * 3600;
export const BARREL_LIFETIME = 45 * 60;
export const FURNACE_RATE = 120;

export function toolOf(id: ToolId): Tool {
  const tool = TOOLS.find((candidate) => candidate.id === id);
  if (!tool) throw new Error(`unknown tool ${id}`);
  return tool;
}

export function nextTier(tier: Tier): Tier | null {
  return TIERS[TIERS.indexOf(tier) + 1] ?? null;
}

export function canAfford(
  cost: Partial<Record<ResourceId, number>>,
  stock: Partial<Record<ResourceId, number>>,
): boolean {
  return Object.entries(cost).every(
    ([id, amount]) => (stock[id as ResourceId] ?? 0) >= (amount ?? 0),
  );
}

export function shortfall(
  cost: Partial<Record<ResourceId, number>>,
  stock: Partial<Record<ResourceId, number>>,
): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [id, amount] of Object.entries(cost)) {
    const missing = (amount ?? 0) - (stock[id as ResourceId] ?? 0);
    if (missing > 0) out[id as ResourceId] = missing;
  }
  return out;
}

/** `12.4k`, `1.2M`: the same formatter as the bot. Rounds toward zero. */
export function abbrev(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.trunc(Math.abs(amount));
  if (magnitude < 1000) return `${sign}${magnitude}`;
  const units = ["k", "M", "B"];
  let divisor = 1000;
  let unit = 0;
  while (magnitude / divisor >= 1000 && unit + 1 < units.length) {
    divisor *= 1000;
    unit += 1;
  }
  const whole = Math.floor(magnitude / divisor);
  const tenths = Math.floor((magnitude % divisor) / (divisor / 10));
  return whole >= 100 || tenths === 0
    ? `${sign}${whole}${units[unit]}`
    : `${sign}${whole}.${tenths}${units[unit]}`;
}

export function duration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds / 3_600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

/** 0..1 through the game day; 0 = midnight, 0.5 = noon. */
export function dayFraction(clock: number): number {
  return (((clock % GAME_DAY) + GAME_DAY) % GAME_DAY) / GAME_DAY;
}

export function clockLabel(clock: number): string {
  const seconds = ((clock % GAME_DAY) + GAME_DAY) % GAME_DAY;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
