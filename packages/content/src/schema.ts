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

export const ITEM_CATEGORIES = ["storage", "med", "weapon", "armor", "meal", "keycode"] as const;

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
  /** Rings a scout reaches beyond the base tier's range. */
  scoutRange: z.int().min(0).optional(),
  /** Defence points against raids (W6). */
  defence: z.int().min(0).optional(),
  /** Hours more warning before NPC raiders land (W6). */
  warnHours: z.int().min(0).optional(),
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
  /** Percent more output on a node job. */
  job: z.int().min(0).max(200).optional(),
  /** Percent faster crafting on a station job: by station id, or `any`. */
  craft: z.record(z.string(), z.int().min(0).max(200)).optional(),
  /** Defence points on guard duty. */
  guard: z.int().min(0).max(50).optional(),
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
  /** Work at home (W4b): node, station and guard jobs, and the rest a worker needs. */
  jobs: z.strictObject({
    /** A node worker adds this percent of the tool's rate for the node's yields. */
    nodePercent: z.int().min(1).max(200),
    /** A station worker makes that station's crafting this much faster. */
    stationPercent: z.int().min(0).max(200),
    /** Defence points per guard, before traits. */
    guardScore: z.int().min(0),
    /** Hours awake before a worker tires. */
    awakeHours: z.int().min(1).max(24),
    /** Hours a rest takes. */
    sleepHours: z.int().min(1).max(24),
    /** A tired worker works at this percent of the pace. */
    tiredPercent: z.int().min(0).max(100),
  }),
  /** Pairs who have been out together `trips` times add `success` points when they go again. */
  bonds: z.strictObject({ trips: z.int().min(1), success: z.int().min(0).max(20) }),
});
export type CrewRules = z.infer<typeof crewRulesSchema>;

export const TERRAINS = [
  "shore",
  "marsh",
  "forest",
  "hills",
  "ruins",
  "cliffs",
  "tundra",
  "sea",
] as const;

export const regionSchema = z.strictObject({
  id,
  x: z.int().min(0).max(1000),
  y: z.int().min(0).max(1000),
  /** Distance from the holdfast; ring 0 is known from the start. */
  ring: z.int().min(0),
  terrain: z.enum(TERRAINS),
  neighbours: z.array(z.string()).min(1),
  scout: z.strictObject({ cost: amounts, minutes: z.int().min(1) }),
  /** `sea`: reached by boat only: the dock, and a navigator in every party. */
  access: z.enum(["sea"]).optional(),
  /** Sea regions: the dock level a boat needs to get there (1 when not given). */
  dock: z.int().min(1).optional(),
});

export const mapRulesSchema = z.strictObject({
  /** Highest ring a scout can reach, by base tier: a stronger holdfast supplies longer trips. */
  range: z.record(tier, z.int().min(1)),
  maxParty: z.int().min(1),
  /** The building whose first level launches boats to the sea regions. */
  boatBuilding: z.string(),
  /** The trait a scout at sea needs, and at least one member of every party at sea. */
  boatTrait: z.string(),
  /** After this many successes at a site without its find, the next success brings it. */
  findPity: z.int().min(1),
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
  /** An item (a keycode) spent when the party leaves. */
  keycode: z.string().optional(),
  /** Items a success may bring home, each with its percent chance. */
  finds: z.array(z.strictObject({ item: z.string(), chance: z.int().min(1).max(100) })).optional(),
  /** A bandit camp (W6): a raid on it, paid in charges; drawn apart and left out of the site chain. */
  camp: z.boolean().optional(),
  /** Where the map draws the marker, from the region's centre in map units (default: by order). */
  pin: z.tuple([z.int().min(-200).max(200), z.int().min(-200).max(200)]).optional(),
});

export const OUTCOMES = ["success", "partial", "fail"] as const;

/**
 * Something that can happen on a trip (events.json5). Chances are percent by site tier
 * (index 0 = tier 1), plus `hazard` points at sites with that hazard, plus `traits` points
 * for each member with the trait, minus `weapon` points per armed member.
 */
export const tripEventSchema = z.strictObject({
  id,
  chance: z.array(z.int().min(0).max(100)).length(5),
  hazard: z.partialRecord(z.enum(HAZARDS), z.int().min(-50).max(50)).optional(),
  traits: z.record(z.string(), z.int().min(-50).max(50)).optional(),
  weapon: z.int().min(0).max(50).optional(),
  /** The outcomes it can happen on. */
  outcomes: z.array(z.enum(OUTCOMES)).min(1),
  /** Percent more (or less) of every loot amount. */
  loot: z.int().min(-90).max(200).optional(),
  /** Extra loot rolls. */
  rolls: z.int().min(0).max(5).optional(),
  /** Percent more injury chance for every member. */
  injury: z.int().min(0).max(200).optional(),
  /** A stranger joins the crew (or the next boat comes at once when there is no room). */
  rescue: z.boolean().optional(),
});

export const tripEventRulesSchema = z.strictObject({
  /** The most events one trip can have. */
  most: z.int().min(1),
});
export type TripEventRules = z.infer<typeof tripEventRulesSchema>;

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
    /** W4b: a survivor on a job by this day, and the first trips to tier 4 and 5 sites. */
    jobsByDay: z.int().min(1),
    tierFourSiteByDay: z.int().min(1),
    tierFiveSiteByDay: z.int().min(1),
    crew: z.strictObject({ day: z.int().min(1), count: z.int().min(1) }),
    /** Scrap from the sites pays for this tool by this day. */
    tool: z.strictObject({ id: z.string(), byDay: z.int().min(1) }),
    /** W5: the scrap held on season day `day` stays between `min` and `max`. */
    scrap: z.strictObject({ day: z.int().min(1), min: z.int().min(0), max: z.int().min(0) }),
    /** W6: the first NPC raid lands by `firstByDay`; by `day`, at least `heldPercent` held. */
    raids: z.strictObject({
      firstByDay: z.int().min(1),
      day: z.int().min(1),
      heldPercent: z.int().min(0).max(100),
    }),
    /** W6: the first trip to a bandit camp (charges made and spent) by this day. */
    firstCampByDay: z.int().min(1),
  }),
  /** W6: the raider against a casual player in the raids. */
  pvp: z.strictObject({
    /** The raider gets in at least this many times in the season... */
    minRaids: z.int().min(0),
    /** ...and the raided casual player still reaches Armored by this day. */
    targetHqmByDay: z.int().min(1),
  }),
  optimal: z.strictObject({
    hqmNotBeforeDay: z.int().min(1),
    tierThreeSiteNotBeforeDay: z.int().min(1),
    /** The end of the site chain: the first trip to this site never before this day. */
    lastSite: z.strictObject({ id: z.string(), notBeforeDay: z.int().min(1) }),
  }),
  tierCostRatio: z.strictObject({ min: z.number().min(1), max: z.number().min(1) }),
});

/** The Den (W5): market, the Den's stock, contracts and the games (den.json5). */
const pays = z.int().min(0).max(100_000);
export const DICE_OPTIONS = ["over", "under", "seven", "doubles"] as const;
export type DiceOption = (typeof DICE_OPTIONS)[number];

export const denSchema = z.strictObject({
  open: z.strictObject({ tier }),
  map: z.strictObject({
    region: z.string(),
    x: z.int().min(0).max(1000),
    y: z.int().min(0).max(1000),
  }),
  market: z.strictObject({
    /** Scrap per 100 units of every tradeable good (resources but scrap, and items). */
    refPer100: z.record(z.string(), z.int().min(1)),
    floorPercent: z.int().min(1).max(100),
    feePercent: z.int().min(0).max(50),
    minFee: z.int().min(0),
    maxListings: z.int().min(1).max(20),
    listingHours: z.int().min(1),
  }),
  stock: z.strictObject({
    perDay: z.int().min(1),
    markupPercent: z.int().min(100),
    blueprintPrice: z.int().min(1),
    pool: z
      .array(
        z.strictObject({
          id,
          /** A resource or item id, or "blueprint". */
          good: z.string(),
          lot: z.int().min(1),
          lotsPerDay: z.int().min(1),
          minTier: tier,
        }),
      )
      .min(1),
  }),
  contracts: z.strictObject({
    perDay: z.int().min(1),
    payPercent: z.int().min(1).max(100),
    pool: z
      .array(
        z.strictObject({
          id,
          good: z.string(),
          /** How much it wants from a base at each tier; absent tiers never draw it. */
          amount: z.partialRecord(tier, z.int().min(1)),
          blueprint: z.int().min(0).max(100).optional(),
        }),
      )
      .min(1),
  }),
  casino: z.strictObject({
    betStep: z.int().min(1),
    limits: z.partialRecord(
      tier,
      z.strictObject({ maxBet: z.int().min(1), dailyWager: z.int().min(1) }),
    ),
    bigWin: z.int().min(2),
    wheel: z.strictObject({
      roundSeconds: z.int().min(5),
      closeSeconds: z.int().min(0),
      segments: z.array(z.strictObject({ id, weight: z.int().min(1), pays })).min(2),
    }),
    slots: z.strictObject({
      symbols: z
        .array(
          z.strictObject({
            id,
            weight: z.int().min(1),
            three: pays.optional(),
            two: pays.optional(),
            jackpot: z.boolean().optional(),
          }),
        )
        .min(2),
      jackpot: z.strictObject({ feedPercent: z.int().min(0).max(10), pays }),
    }),
    dice: z.strictObject({
      options: z.array(z.strictObject({ id: z.enum(DICE_OPTIONS), pays })).min(1),
    }),
  }),
});
export type Den = z.infer<typeof denSchema>;
export type Casino = Den["casino"];

/** Raids and defence (W6): raids.json5. */
const percent = z.int().min(0).max(100);
export const raidsSchema = z.strictObject({
  capPercent: z.int().min(1).max(100),
  scrapCeiling: z.partialRecord(tier, z.int().min(0)),
  minChance: percent,
  maxChance: percent,
  damagedPercent: percent,
  repair: z.partialRecord(tier, amounts),
  npc: z.strictObject({
    startTier: tier,
    firstAfterHours: z.int().min(0),
    planDays: z.int().min(1),
    windowStartHour: z.int().min(0).max(23),
    windowHours: z.int().min(1).max(24),
    warnBaseHours: z.int().min(0),
    lossPercent: z.int().min(1).max(100),
    scrapPerPoint: z.int().min(1),
    strength: z.partialRecord(tier, z.strictObject({ base: z.int().min(0), max: z.int().min(1) })),
    held: z.partialRecord(
      tier,
      z.array(
        z
          .strictObject({ resource: z.string(), min: z.int().min(1), max: z.int().min(1) })
          .refine((entry) => entry.max >= entry.min, { message: "max must be >= min" }),
      ),
    ),
  }),
  pvp: z.strictObject({
    minTier: tier,
    maxTierGap: z.int().min(0),
    charges: z.partialRecord(tier, z.int().min(1)),
    attack: z.partialRecord(tier, z.int().min(1)),
    shieldHours: z.int().min(1),
    attackHours: z.int().min(1),
    sameTargetHours: z.int().min(1),
    revengeHours: z.int().min(1),
    revengePercent: z.int().min(1).max(100),
  }),
});
export type Raids = z.infer<typeof raidsSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type BaseTier = z.infer<typeof baseTierSchema>;
export type Furnace = z.infer<typeof furnaceSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Trait = z.infer<typeof traitSchema>;
export type CrewMember = z.infer<typeof crewSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Site = z.infer<typeof siteSchema>;
export type TripEvent = z.infer<typeof tripEventSchema>;
export type Outcome = (typeof OUTCOMES)[number];
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
  tripEvents: TripEvent[];
  tripEventRules: TripEventRules;
  recipes: Recipe[];
  crafting: Crafting;
  nodeKinds: NodeKind[];
  nodes: NodeDef[];
  pacing: Pacing;
  active: Active;
  den: Den;
  raids: Raids;
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
  {
    file: "events.json5",
    key: "events",
    field: "tripEvents",
    kind: "trip_event",
    schema: tripEventSchema,
  },
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
  "events.json5",
  "recipes.json5",
  "crafting.json5",
  "nodes.json5",
  "active.json5",
  "pacing.json5",
  "den.json5",
  "raids.json5",
] as const;
export type DataFile = (typeof DATA_FILES)[number];
