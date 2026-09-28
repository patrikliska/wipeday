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

export const RESOURCE_KINDS = ["raw", "refined", "part", "currency"] as const;

export const resourceSchema = z.strictObject({
  id,
  /**
   * raw: gathered (or grown). refined: smelted from a raw one. part: made at a station
   * (recipes.json5), not capped by storage. currency: scrap.
   */
  kind: z.enum(RESOURCE_KINDS),
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
  /** Base tier needed to buy it (a tool never outranks the holdfast that keeps it running). */
  minTier: tier.optional(),
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

export const ITEM_CATEGORIES = ["storage", "med", "weapon", "armor", "meal"] as const;

export const itemSchema = z.strictObject({
  id,
  category: z.enum(ITEM_CATEGORIES),
  /** Rarity, on the base-tier colour scale. */
  tier,
  /** Storage items: how much they add to every resource's cap. */
  capacity: z.int().min(1).optional(),
  /** A base holds at most one. */
  unique: z.boolean().optional(),
  /** Meals: served, they add this percent to Gather and node hits for `hours`. */
  boostPercent: z.int().min(1).max(100).optional(),
  hours: z.int().min(1).max(24).optional(),
  /** Weapons: success points at hostile sites for the survivor carrying it. */
  power: z.int().min(1).max(50).optional(),
  /** Armour: percent lower injury chance for the survivor wearing it. */
  protection: z.int().min(1).max(90).optional(),
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
  /** Room for more survivors. */
  crew: z.int().min(0).optional(),
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

export const HAZARDS = ["hostile", "blocked", "unstable", "flooded"] as const;
export type Hazard = (typeof HAZARDS)[number];

/** What a survivor is good at on trips; see traits.json5 for the meaning of each field. */
export const traitSchema = z.strictObject({
  id,
  success: z.int().min(0).max(50).optional(),
  hazard: z.partialRecord(z.enum(HAZARDS), z.int().min(0).max(50)).optional(),
  loot: z.int().min(0).max(200).optional(),
  lootRolls: z.int().min(0).max(5).optional(),
  tripTime: z.int().min(0).max(80).optional(),
  injury: z.int().min(0).max(90).optional(),
  recovery: z.int().min(0).max(90).optional(),
  rare: z.int().min(0).max(300).optional(),
});

export const crewSchema = z.strictObject({
  id,
  traits: z.array(z.string()).length(2),
});

export const crewRulesSchema = z.strictObject({
  /** Survivors every base starts with, in order. */
  start: z.array(z.string()).min(1),
  baseCap: z.int().min(1),
  arrivalHours: z.int().min(1),
  /** Cumulative XP to reach level 2, 3, ... */
  levels: z.array(z.int().min(1)).min(1),
  successPerLevel: z.int().min(0),
  successPerCompanion: z.int().min(0),
  /** Item id -> injury hours it takes off. */
  treat: z.record(z.string(), z.int().min(1)),
});
export type CrewRules = z.infer<typeof crewRulesSchema>;

export const TERRAINS = ["shore", "marsh", "forest", "hills", "ruins", "cliffs"] as const;

export const regionSchema = z.strictObject({
  id,
  x: z.int().min(0).max(1000),
  y: z.int().min(0).max(1000),
  /** Distance from the holdfast; ring 0 is known from the start. */
  ring: z.int().min(0),
  terrain: z.enum(TERRAINS),
  neighbours: z.array(z.string()).min(1),
  scout: z.strictObject({ cost: amounts, minutes: z.int().min(1) }),
});

export const mapRulesSchema = z.strictObject({
  /** Highest ring a scout can reach, by base tier: a stronger holdfast supplies longer trips. */
  range: z.record(tier, z.int().min(1)),
  maxParty: z.int().min(1),
});
export type MapRules = z.infer<typeof mapRulesSchema>;

export const recipeSchema = z.strictObject({
  /** What it makes: a part (resources.json5, lands in stock) or an item (items.json5). */
  output: z.string(),
  /** How many of `output` one unit of this recipe makes. */
  amount: z.int().min(1).default(1),
  /** The building that makes it, and the level it needs. */
  station: z.string(),
  level: z.int().min(1),
  /** Minutes per unit at that station, before the lights' speed-up. */
  minutes: z.int().min(1),
  /** Paid per unit, up front for the whole batch. */
  cost: amounts,
  /** Known only once a blueprint is found (barrels, perfect runs, tasks). */
  blueprint: z.boolean().optional(),
});

/** Production rules: per station level (index 0 = level 1), salvage and blueprint odds. */
export const craftingSchema = z.strictObject({
  /** Jobs a station holds, including the one being made. */
  queueSlots: z.array(z.int().min(1)).min(1),
  /** The most units in one job. */
  batchSize: z.array(z.int().min(1)).min(1),
  /** Salvage returns this share of an item's recipe cost (rounded down)... */
  salvagePercent: z.int().min(0).max(100),
  /** ...plus this much scrap, by the item's tier. */
  salvageScrap: z.record(tier, z.int().min(0)),
  blueprints: z.strictObject({
    /** Chance a broken barrel also holds a blueprint. */
    barrelPercent: z.int().min(0).max(100),
    /** Chance a perfect node run turns one up. */
    perfectRunPercent: z.int().min(0).max(100),
  }),
});
export type Crafting = z.infer<typeof craftingSchema>;

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
  "trip",
] as const;

export const taskSchema = z.strictObject({
  id,
  kind: z.enum(TASK_KINDS),
  target: z.int().min(1),
  /** Swapped out for players who lack this. */
  requires: z.enum(["furnace", "workbench"]).optional(),
  reward: amounts,
  /** Also pays a blueprint the base does not know yet (when one is left). */
  blueprint: z.boolean().optional(),
});
export type Task = z.infer<typeof taskSchema>;

export const lootEntry = z
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

export const siteSchema = z.strictObject({
  id,
  region: z.string(),
  tier: z.int().min(1).max(5),
  minutes: z.int().min(1),
  party: z.int().min(1),
  chance: z.int().min(1).max(100),
  hazard: z.enum(HAZARDS),
  injury: z.int().min(0).max(100),
  injuryHours: z.int().min(1),
  rations: amounts,
  rolls: z.int().min(1),
  xp: z.int().min(0),
  blueprint: z.int().min(0).max(100),
  fragment: z.int().min(0).max(100),
  loot: z.array(lootEntry).min(1),
});

const dayWindow = z.strictObject({ earliestDay: z.int().min(1), latestDay: z.int().min(1) });
export const pacingSchema = z.strictObject({
  casual: z.strictObject({
    stone: dayWindow,
    metal: dayWindow,
    hqm: dayWindow,
    /** At least `count` buildings standing on season day `day`. */
    buildings: z.strictObject({ day: z.int().min(1), count: z.int().min(1) }),
    /** Crafting throughput: the first of each output made by this day. */
    firstMade: z.record(z.string(), z.int().min(1)),
    /** Every station has made something by this day. */
    stationsWorkedByDay: z.int().min(1),
    /** Expeditions (W4a): the first trip, the first trip to a tier-3 site, the crew size. */
    firstTripByDay: z.int().min(1),
    tierThreeSiteByDay: z.int().min(1),
    crew: z.strictObject({ day: z.int().min(1), count: z.int().min(1) }),
    /** Scrap from the sites pays for this tool by this day. */
    tool: z.strictObject({ id: z.string(), byDay: z.int().min(1) }),
  }),
  optimal: z.strictObject({
    hqmNotBeforeDay: z.int().min(1),
    tierThreeSiteNotBeforeDay: z.int().min(1),
  }),
  tierCostRatio: z.strictObject({ min: z.number().min(1), max: z.number().min(1) }),
});

export type Resource = z.infer<typeof resourceSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type BaseTier = z.infer<typeof baseTierSchema>;
export type Furnace = z.infer<typeof furnaceSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Trait = z.infer<typeof traitSchema>;
export type CrewMember = z.infer<typeof crewSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Site = z.infer<typeof siteSchema>;
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
  traits: Trait[];
  crew: CrewMember[];
  crewRules: CrewRules;
  regions: Region[];
  mapRules: MapRules;
  sites: Site[];
  recipes: Recipe[];
  crafting: Crafting;
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
  { file: "traits.json5", key: "traits", field: "traits", kind: "trait", schema: traitSchema },
  { file: "crew.json5", key: "crew", field: "crew", kind: "crew", schema: crewSchema },
  {
    file: "regions.json5",
    key: "regions",
    field: "regions",
    kind: "region",
    schema: regionSchema,
  },
  { file: "sites.json5", key: "sites", field: "sites", kind: "site", schema: siteSchema },
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
  "traits.json5",
  "crew.json5",
  "regions.json5",
  "sites.json5",
  "recipes.json5",
  "crafting.json5",
  "nodes.json5",
  "active.json5",
  "pacing.json5",
] as const;
export type DataFile = (typeof DATA_FILES)[number];
