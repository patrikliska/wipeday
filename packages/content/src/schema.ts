/**
 * Shapes of the data files (`data/*.json5`). Every entity has an `id` that is also its locale
 * key (`{kind}.{id}.name`) and its icon name (D141). Amounts are finite doubles (D130), counts
 * integers. Browser-safe: no file access here (that is `load.ts`).
 *
 * R0 ships the run's skeleton: resources (currencies and products), the hands, the tool ids,
 * the lines' formula, the prestige constants, the tap block and the simulator's pacing. Each
 * later phase adds its files (docs/redesign/09-architecture.md 8.1).
 */
import { z } from "zod";
import { type Effect, OPS, PERS, STAT_IDS, STATS, type StatId, WHENS } from "./effects";
import { TIERS, type Tier } from "./tiers";

/** Ids become locale keys and icon file names. */
export const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export const id = z
  .string()
  .min(2, "id must be 2 to 32 characters")
  .max(32, "id must be 2 to 32 characters")
  .regex(ID_PATTERN, "id must be lowercase snake_case (a-z, 0-9, _ between words)");

const tier = z.enum(TIERS);
/** A quantity of supplies or glass (D130). */
export const amount = z.number().finite().nonnegative();
/** Owned units, taps, nukes: whole numbers. */
export const count = z.int().min(0);
/** A multiplier or growth factor. */
export const factor = z.number().finite().positive();
/** A duration in seconds. */
export const seconds = z.number().finite().positive();

export const effectSchema = z
  .strictObject({
    stat: z.enum(STAT_IDS as [StatId, ...StatId[]]),
    op: z.enum(OPS),
    value: z.number().finite(),
    scope: z.string().min(1).max(40).optional(),
    per: z.enum(PERS).optional(),
    max: z.number().finite().optional(),
    when: z.enum(WHENS).optional(),
  })
  .refine((effect) => effect.per === undefined || effect.max !== undefined, {
    message: "an effect with `per` needs a `max`",
  })
  .refine((effect) => (STATS[effect.stat].ops as readonly string[]).includes(effect.op), {
    message: "this op is not allowed for this stat",
  });

export const RESOURCE_KINDS = ["currency", "product"] as const;

export const resourceSchema = z.strictObject({ id, kind: z.enum(RESOURCE_KINDS) });
export type Resource = z.infer<typeof resourceSchema>;

export const crewSchema = z.strictObject({ id });
export type CrewMember = z.infer<typeof crewSchema>;

export const toolSchema = z.strictObject({ id, tier });
export type Tool = z.infer<typeof toolSchema>;

export const lineFormulaSchema = z.strictObject({
  costBase: amount,
  costRatio: factor,
  rateBase: amount,
  rateRatio: factor,
  cycleBase: seconds,
  cycleRatio: factor,
  cycleFloor: seconds,
  growthBase: factor,
  growthStep: z.number().finite(),
  handFactor: factor,
});
export type LineFormula = z.infer<typeof lineFormulaSchema>;

export const lineRowSchema = z.strictObject({
  id,
  rung: z.int().min(1).max(14),
  era: tier,
  hand: id,
  product: id,
  maxOwned: count.default(2000),
  /** Overrides of the derived numbers. */
  cost: amount.optional(),
  rate: amount.optional(),
  cycle: seconds.optional(),
  growth: factor.optional(),
});

export const runRulesSchema = z.strictObject({
  nightShift: z.strictObject({ windowHours: factor, maxHours: factor, pingMinutes: factor }),
});
export type RunRules = z.infer<typeof runRulesSchema>;

export const linesFileSchema = z.strictObject({
  island: id,
  formula: lineFormulaSchema,
  stages: z.array(count).min(1),
  run: runRulesSchema,
  lines: z.array(lineRowSchema),
});

/** A line with its derived numbers filled in (`deriveLines`). */
export interface LineDef {
  id: string;
  rung: number;
  era: Tier;
  hand: string;
  product: string;
  maxOwned: number;
  /** The first unit's price. */
  cost: number;
  /** Supplies a second per unit, before any multiplier. */
  rate: number;
  /** Seconds per cycle, before speed. */
  cycle: number;
  /** Each unit costs this much more than the last. */
  growth: number;
  /** The hand's price. */
  handPrice: number;
}

export const prestigeSchema = z.strictObject({
  l0: factor,
  exponent: z.number().finite().positive().max(1),
  glowK: z.number().finite().nonnegative(),
  firstNukeGlass: count,
  countShare: z.number().finite().nonnegative().max(1),
  afterglow: z.strictObject({
    start: factor,
    halfSeconds: seconds,
    holdSeconds: z.number().finite().nonnegative(),
    endsAfterSeconds: seconds,
  }),
});
export type Prestige = z.infer<typeof prestigeSchema>;

export const tapSchema = z.strictObject({
  bucket: z.strictObject({ perSecond: factor, burst: factor }),
  holdTapsPerSecond: factor,
  holdAfterSeconds: z.number().finite().nonnegative(),
  flat: amount,
  share: z.number().finite().nonnegative(),
  hustle: z.strictObject({
    perTap: factor,
    cap: factor,
    peak: factor,
    peakCeiling: factor,
    graceSeconds: z.number().finite().nonnegative(),
    drainPerSecond: z.number().finite().nonnegative(),
  }),
  fellBonusTaps: count,
  popSeconds: seconds,
});
export type TapRules = z.infer<typeof tapSchema>;

export const targetsFileSchema = z.strictObject({ tap: tapSchema });

export const PHASES = ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7"] as const;
export type Phase = (typeof PHASES)[number];

/** "08:00+5m" (daily, UTC) or "hourly+5m". */
const sessionSchema = z
  .string()
  .regex(/^(\d\d:\d\d|hourly)\+\d+m$/, "a session is HH:MM+Nm or hourly+Nm");

export const archetypeSchema = z.strictObject({
  sessions: z.array(sessionSchema).min(1),
  tapsPerSecond: z.number().finite().nonnegative(),
  tapsWhileNothingRuns: z.number().finite().nonnegative().optional(),
  nuke: z.enum(["crown", "double", "best"]),
  startDay: z.int().min(1).optional(),
});
export type Archetype = z.infer<typeof archetypeSchema>;

export const assertionSchema = z.looseObject({
  /** The canon number (N1-N27) or the canon section it covers. */
  n: z.string().min(1),
  on: z.enum(PHASES),
  check: z.string().min(1),
  warn: z.boolean().optional(),
});
export type Assertion = z.infer<typeof assertionSchema>;

export const pacingSchema = z.strictObject({
  shipped: z.enum(PHASES),
  profiles: z.record(
    z.string(),
    z.strictObject({ days: z.int().min(1), seeds: z.array(z.int()).min(1) }),
  ),
  archetypes: z.record(z.string(), archetypeSchema),
  scenarios: z.record(z.string(), archetypeSchema),
  assertions: z.array(assertionSchema),
});
export type Pacing = z.infer<typeof pacingSchema>;

/** Everything the game's rules read, validated. */
export interface Content {
  resources: Resource[];
  crew: CrewMember[];
  tools: Tool[];
  /** The island the lines stand on (canon 9's reserved field). */
  island: string;
  formula: LineFormula;
  /** In rung order, with derived numbers. */
  lines: LineDef[];
  /** Owned counts at which a line is drawn anew. */
  stages: number[];
  run: RunRules;
  prestige: Prestige;
  tap: TapRules;
  pacing: Pacing;
  /**
   * What each timed buff does while it runs, by buff kind. Flotsam fills it from R1
   * (`flotsam.json5`); empty in R0.
   */
  buffs: Record<string, Effect[]>;
}

/** Data files the game needs, in load order. */
export const DATA_FILES = [
  "resources.json5",
  "crew.json5",
  "tools.json5",
  "lines.json5",
  "prestige.json5",
  "targets.json5",
  "pacing.json5",
] as const;
export type DataFile = (typeof DATA_FILES)[number];

export type EntityKind = "resource" | "crew" | "tool" | "line";

/** The files that are lists of named entities, and the locale namespace of their names. */
export const FILES = [
  { file: "resources.json5", key: "resources", field: "resources", kind: "resource" },
  { file: "crew.json5", key: "crew", field: "crew", kind: "crew" },
  { file: "tools.json5", key: "tools", field: "tools", kind: "tool" },
  { file: "lines.json5", key: "lines", field: "lines", kind: "line" },
] as const satisfies readonly {
  file: DataFile;
  key: string;
  field: "resources" | "crew" | "tools" | "lines";
  kind: EntityKind;
}[];
