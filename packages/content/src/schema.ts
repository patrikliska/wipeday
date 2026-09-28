/**
 * Shapes of the data files (`data/*.json5`). Every entity has an `id` that is
 * also its locale key (`{kind}.{id}.name`) and, later, its asset name.
 * Browser-safe: no file access here (that is `load.ts`).
 */
import { z } from "zod";
import { TIERS } from "./tiers";

/** Ids become locale keys and asset file names. */
export const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const id = z
  .string()
  .min(2, "id must be 2 to 32 characters")
  .max(32, "id must be 2 to 32 characters")
  .regex(ID_PATTERN, "id must be lowercase snake_case (a-z, 0-9, _ between words)");

const tier = z.enum(TIERS);

/** `{ resourceId: amount }`. Keys are checked against resources.json5 in crossCheck. */
const amounts = z.record(z.string(), z.int().min(0));
export type Amounts = Record<string, number>;

export const resourceSchema = z.strictObject({
  id,
  /** raw: gathered. refined: made from a raw resource. currency: scrap. */
  kind: z.enum(["raw", "refined", "currency"]),
  /** For ores: the refined resource a furnace turns them into, 1:1. */
  smeltsInto: z.string().optional(),
});

export const toolSchema = z.strictObject({
  id,
  tier,
  /** Passive gathering per hour, by resource. */
  rates: amounts,
  /** One Gather grants this many minutes of production. */
  bonusMinutes: z.int().min(1),
  cooldownMinutes: z.int().min(1),
  /** Paid once to upgrade to this tool. */
  cost: amounts,
});

export const baseTierSchema = z.strictObject({
  id: tier,
  /** How much of each resource the base can hold, before crates. */
  storageCap: z.int().min(1),
  /** How many crates count toward the cap. */
  boxSlots: z.int().min(0),
  furnaceSlots: z.int().min(0),
  /** Constructions (the tier or buildings) that can run at once. */
  builders: z.int().min(1),
  /** Paid up front to upgrade to this tier. */
  cost: amounts,
  buildMinutes: z.int().min(0),
  /** Drained every hour at this tier. */
  upkeep: amounts,
});

export const baseRulesSchema = z.strictObject({
  /** Production while upkeep is unpaid, as a percentage of normal. */
  decayProductionPercent: z.int().min(0).max(100),
  /** Unpaid for this long and the base drops one tier. */
  tierLossAfterHours: z.int().min(1),
  /** Items waiting in the crafting queue, including the one being made. */
  craftQueueSize: z.int().min(1),
});
export type BaseRules = z.infer<typeof baseRulesSchema>;

export const furnaceSchema = z.strictObject({
  id,
  tier,
  /** Smelting speed per slot. */
  orePerHour: z.int().min(1),
  /** The resource burned as fuel, up front when a job starts. */
  fuel: z.string(),
  fuelPer100Ore: z.int().min(0),
  maxOrePerJob: z.int().min(1),
});

export const ITEM_CATEGORIES = ["storage", "med", "weapon", "armor"] as const;

export const itemSchema = z.strictObject({
  id,
  category: z.enum(ITEM_CATEGORIES),
  /** Rarity, on the base-tier colour scale. */
  tier,
  /** Storage items: how much they add to every resource's cap. */
  capacity: z.int().min(1).optional(),
  /** A base holds at most one. */
  unique: z.boolean().optional(),
});

/** What a building level gives. All totals at that level; everything optional. */
export const effectsSchema = z.strictObject({
  /** Percent more of a resource from gathering. */
  rates: z.record(z.string(), z.int().min(0)).optional(),
  /** Percent more of every gathered resource. */
  allRates: z.int().min(0).optional(),
  /** Per hour, whatever the tool. */
  flat: z.record(z.string(), z.int().min(0)).optional(),
  /** Room for every resource. */
  cap: z.int().min(0).optional(),
  /** Less furnace fuel per 100 ore. */
  fuelPer100Ore: z.int().min(0).optional(),
  /** Percent faster furnaces. */
  smeltPercent: z.int().min(0).optional(),
  /** Percent faster crafting. */
  craftPercent: z.int().min(0).optional(),
  /** Minutes added to the daily node haul. */
  haulMinutes: z.int().min(0).optional(),
  /** Minutes a barrel stays longer. */
  barrelLifeMinutes: z.int().min(0).optional(),
  /** Minutes sooner the next barrel comes. */
  barrelEveryMinutes: z.int().min(0).optional(),
  /** Hours added before unpaid upkeep costs a level. */
  graceHours: z.int().min(0).optional(),
  /** Crafting level. */
  workbench: z.int().min(1).max(3).optional(),
  /** Furnace type: 1 = the first in furnaces.json5. */
  furnace: z.int().min(1).optional(),
});
export type Effects = z.infer<typeof effectsSchema>;

export const buildingLevelSchema = z.strictObject({
  /** Base tier needed for this level (level 1 also needs the building's `unlockTier`). */
  minTier: tier.optional(),
  cost: amounts,
  /** Builder time; 0 = at once. */
  minutes: z.int().min(0),
  /** Added to the base's upkeep per hour while this level stands. */
  upkeep: amounts,
  effects: effectsSchema,
});

export const buildingSchema = z.strictObject({
  id,
  /** Base tier needed to build level 1. */
  unlockTier: tier,
  levels: z.array(buildingLevelSchema).min(1),
});

export const perkSchema = z.strictObject({ id });

export const crewSchema = z.strictObject({
  id,
  perk: z.string(),
  health: z.int().min(1).max(100),
});

export const recipeSchema = z.strictObject({
  item: z.string(),
  /** Workbench level required; 0 = bare hands. */
  workbench: z.int().min(0).max(3),
  /** Time in the crafting queue; 0 = ready at once. */
  craftMinutes: z.int().min(0),
  cost: amounts,
});

export const nodeKindSchema = z.strictObject({
  id,
  /** One hit banks this many minutes of the tool's production of `yields`. */
  hitMinutes: z.int().min(1),
  /** Share of the slice per resource; 1 = all of it. */
  yields: z.record(z.string(), z.number().min(0).max(1)),
  /** Real seconds from worked out to standing again. */
  respawnSeconds: z.int().min(1),
});

export const nodeSchema = z.strictObject({ id, kind: z.string() });

export const TASK_KINDS = [
  "gather",
  "collect",
  "node_hits",
  "barrel",
  "smelt",
  "furnace_collect",
  "craft",
] as const;

export const taskSchema = z.strictObject({
  id,
  kind: z.enum(TASK_KINDS),
  target: z.int().min(1),
  /** Swapped out for players who lack this. */
  requires: z.enum(["furnace", "workbench"]).optional(),
  reward: amounts,
});
export type Task = z.infer<typeof taskSchema>;

const lootEntry = z
  .strictObject({
    resource: z.string(),
    min: z.int().min(1),
    max: z.int().min(1),
    weight: z.int().min(0),
  })
  .refine((entry) => entry.max >= entry.min, { message: "max must be >= min" });

export const activeSchema = z.strictObject({
  node: z.strictObject({
    maxHits: z.int().min(1),
    /** What the player sees: the marker fades this long after the last hit. */
    hitWindowSeconds: z.number().positive(),
    /** Extra time the server allows for network lag. */
    graceSeconds: z.number().min(0),
    /** Extra slices for a full run. */
    perfectBonusHits: z.int().min(0),
    /** Minutes of production that node hits pay in full per UTC day. */
    dailyHaulMinutes: z.int().min(1),
    /** What a hit pays once the day's haul is in, as a percentage. */
    afterHaulPercent: z.int().min(0).max(100),
  }),
  barrels: z.strictObject({
    firstAfterMinutes: z.int().min(0),
    everyMinutes: z.int().min(1),
    expiresMinutes: z.int().min(1),
    rolls: z.int().min(1),
    loot: z.array(lootEntry).min(1),
  }),
  tasks: z.strictObject({
    perDay: z.int().min(1),
    pool: z.array(taskSchema).min(1),
  }),
});
export type Active = z.infer<typeof activeSchema>;

const dayWindow = z.strictObject({ earliestDay: z.int().min(1), latestDay: z.int().min(1) });
export const pacingSchema = z.strictObject({
  casual: z.strictObject({
    stone: dayWindow,
    metal: dayWindow,
    hqm: dayWindow,
    /** At least `count` buildings standing on season day `day`. */
    buildings: z.strictObject({ day: z.int().min(1), count: z.int().min(1) }),
  }),
  optimal: z.strictObject({ hqmNotBeforeDay: z.int().min(1) }),
  tierCostRatio: z.strictObject({ min: z.number().min(1), max: z.number().min(1) }),
});

export type Resource = z.infer<typeof resourceSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type BaseTier = z.infer<typeof baseTierSchema>;
export type Furnace = z.infer<typeof furnaceSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Perk = z.infer<typeof perkSchema>;
export type CrewMember = z.infer<typeof crewSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Building = z.infer<typeof buildingSchema>;
export type BuildingLevel = z.infer<typeof buildingLevelSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type NodeDef = z.infer<typeof nodeSchema>;
export type Pacing = z.infer<typeof pacingSchema>;

export interface Content {
  resources: Resource[];
  tools: Tool[];
  baseTiers: BaseTier[];
  baseRules: BaseRules;
  furnaces: Furnace[];
  items: Item[];
  buildings: Building[];
  perks: Perk[];
  crew: CrewMember[];
  recipes: Recipe[];
  nodeKinds: NodeKind[];
  nodes: NodeDef[];
  pacing: Pacing;
  active: Active;
}

/**
 * One row per entity list: file, the top-level key holding the array, the
 * `Content` field it fills, and the locale namespace (`kind`) whose
 * `{kind}.{id}.name` key every entity must have.
 */
export const FILES = [
  {
    file: "resources.json5",
    key: "resources",
    field: "resources",
    kind: "resource",
    schema: resourceSchema,
  },
  { file: "tools.json5", key: "tools", field: "tools", kind: "tool", schema: toolSchema },
  {
    file: "base_tiers.json5",
    key: "baseTiers",
    field: "baseTiers",
    kind: "base_tier",
    schema: baseTierSchema,
  },
  {
    file: "furnaces.json5",
    key: "furnaces",
    field: "furnaces",
    kind: "furnace",
    schema: furnaceSchema,
  },
  { file: "items.json5", key: "items", field: "items", kind: "item", schema: itemSchema },
  {
    file: "buildings.json5",
    key: "buildings",
    field: "buildings",
    kind: "building",
    schema: buildingSchema,
  },
  { file: "perks.json5", key: "perks", field: "perks", kind: "perk", schema: perkSchema },
  { file: "crew.json5", key: "crew", field: "crew", kind: "crew", schema: crewSchema },
  { file: "nodes.json5", key: "kinds", field: "nodeKinds", kind: "node", schema: nodeKindSchema },
] as const;

export type EntityKind = (typeof FILES)[number]["kind"];

/** Every data file, for loaders that fetch or bundle them (the browser). */
export const DATA_FILES = [
  "resources.json5",
  "tools.json5",
  "base_tiers.json5",
  "furnaces.json5",
  "items.json5",
  "buildings.json5",
  "perks.json5",
  "crew.json5",
  "recipes.json5",
  "nodes.json5",
  "active.json5",
  "pacing.json5",
] as const;
export type DataFile = (typeof DATA_FILES)[number];
