/**
 * Shapes of the data files (`data/*.json5`). Every entity has an `id` that is
 * also its asset file name and its locale key.
 *
 * Each phase adds the balance fields it needs here. Files from CLAUDE.md
 * section 8 that have no entities yet (loot tables, casino, ...) are
 * introduced by the phase that first reads them.
 */
import { z } from "zod";
import { TIERS } from "../ui/theme";

/** Highest phase number in CLAUDE.md section 11. */
export const LAST_PHASE = 7;

/** Ids become file names and Discord emoji names. */
export const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const id = z
  .string()
  .min(2, "id must be 2 to 32 characters")
  .max(32, "id must be 2 to 32 characters")
  .regex(ID_PATTERN, "id must be lowercase snake_case (a-z, 0-9, _ between words)");

const identity = {
  id,
  /** Rust item shortname or monument name, so the owner knows what to source. */
  rustRef: z.string().min(1),
  /** Unicode stand-in used inline until the application emoji is supplied. */
  fallbackEmoji: z.string().trim().min(1, "fallbackEmoji is empty"),
  /** First phase that uses the entity. */
  phase: z.int().min(0).max(LAST_PHASE),
};

const tier = z.enum(TIERS);

/** `{ resourceId: amount }`. Keys are checked against resources.json5 in crossCheck. */
const amounts = z.record(z.string(), z.int().min(0));
export type Amounts = Record<string, number>;

export const resourceSchema = z.strictObject({
  ...identity,
  /** raw: gathered from nodes. refined: produced by furnaces. currency: scrap. */
  kind: z.enum(["raw", "refined", "currency"]),
  /** For ores: the refined resource a furnace turns them into, 1:1. */
  smeltsInto: z.string().optional(),
});

export const toolSchema = z.strictObject({
  ...identity,
  tier,
  /** Passive gathering per hour, by resource. */
  rates: amounts,
  /** The manual Gather click grants this many minutes of production. */
  bonusMinutes: z.int().min(1),
  cooldownMinutes: z.int().min(1),
  /** Paid once to upgrade to this tier. */
  cost: amounts,
});

export const baseTierSchema = z.strictObject({
  ...identity,
  /** How much of each resource the base can hold, before boxes. */
  storageCap: z.int().min(1),
  /** How many storage boxes count toward the cap. */
  boxSlots: z.int().min(0),
  furnaceSlots: z.int().min(0),
  /** Highest workbench level usable at this tier. */
  workbenchLevel: z.int().min(0).max(3),
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
  ...identity,
  tier,
  /** Smelting speed per slot. */
  orePerHour: z.int().min(1),
  /** Fuel, burned up front. */
  woodPer100Ore: z.int().min(0),
  maxOrePerJob: z.int().min(1),
  /** Paid once to buy (or upgrade to) this type. */
  cost: amounts,
  /** Base tier needed. */
  minTier: tier,
});

export const ITEM_CATEGORIES = [
  "weapon",
  "armor",
  "med",
  "explosive",
  "defense",
  "keycard",
  "component",
  "storage",
  "workbench",
] as const;

export const itemSchema = z.strictObject({
  ...identity,
  category: z.enum(ITEM_CATEGORIES),
  /** Rarity, on the base-tier colour scale. */
  tier,
  /** Storage items: how much they add to every resource's cap. */
  capacity: z.int().min(1).optional(),
  /** Workbench items: the level they unlock. */
  workbenchLevel: z.int().min(1).max(3).optional(),
});

export const monumentSchema = z.strictObject({
  ...identity,
  /** Position in the chain, 1 = easiest. Unique and contiguous. */
  order: z.int().min(1),
  /** Keycard item id required to enter, if any. */
  keycard: z.string().optional(),
});

export const perkSchema = z.strictObject({ ...identity });

export const recipeSchema = z.strictObject({
  item: z.string(),
  /** Workbench level required; 0 = bare hands. */
  workbench: z.int().min(0).max(3),
  cost: amounts,
});

const dayWindow = z.strictObject({ earliestDay: z.int().min(1), latestDay: z.int().min(1) });
export const pacingSchema = z.strictObject({
  casual: z.strictObject({ stone: dayWindow, metal: dayWindow, hqm: dayWindow }),
  optimal: z.strictObject({ hqmNotBeforeDay: z.int().min(1) }),
  tierCostRatio: z.strictObject({ min: z.number().min(1), max: z.number().min(1) }),
});

export type Resource = z.infer<typeof resourceSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type BaseTier = z.infer<typeof baseTierSchema>;
export type Furnace = z.infer<typeof furnaceSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Monument = z.infer<typeof monumentSchema>;
export type Perk = z.infer<typeof perkSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Pacing = z.infer<typeof pacingSchema>;

export interface Content {
  resources: Resource[];
  tools: Tool[];
  baseTiers: BaseTier[];
  baseRules: BaseRules;
  furnaces: Furnace[];
  items: Item[];
  monuments: Monument[];
  perks: Perk[];
  recipes: Recipe[];
  pacing: Pacing;
}

/**
 * One row per entity file: file name, the top-level key holding the entity
 * array, the `Content` field it fills, and the locale namespace (`kind`) whose
 * `{kind}.{id}.name` key every entity must have.
 */
export const FILES = [
  { file: "resources.json5", field: "resources", kind: "resource", schema: resourceSchema },
  { file: "tools.json5", field: "tools", kind: "tool", schema: toolSchema },
  { file: "base_tiers.json5", field: "baseTiers", kind: "base_tier", schema: baseTierSchema },
  { file: "furnaces.json5", field: "furnaces", kind: "furnace", schema: furnaceSchema },
  { file: "items.json5", field: "items", kind: "item", schema: itemSchema },
  { file: "monuments.json5", field: "monuments", kind: "monument", schema: monumentSchema },
  { file: "survivor_perks.json5", field: "perks", kind: "perk", schema: perkSchema },
] as const;

export type EntityKind = (typeof FILES)[number]["kind"];
