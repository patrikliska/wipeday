/**
 * Shapes of the data files (`data/*.json5`). Every entity has an `id` that is also its locale
 * key (`{kind}.{id}.name`) and its icon name (D141). Amounts are finite doubles (D130), counts
 * integers. Browser-safe: no file access here (that is `load.ts`).
 *
 * R0 shipped the run's skeleton: resources (currencies and products), the hands, the lines'
 * formula, the prestige constants, the tap block and the simulator's pacing. R1 adds the run
 * itself: eras and their targets, Grip's prices, the shelf, milestones, flotsam and the
 * island's clock and weather. Each later phase adds its files (09-architecture.md 8.1).
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
  })
  // Zod types an absent key as `undefined`; it never writes one, so the parsed value is an Effect.
  .transform((effect) => effect as Effect);

export const RESOURCE_KINDS = ["currency", "product"] as const;

export const resourceSchema = z.strictObject({ id, kind: z.enum(RESOURCE_KINDS) });
export type Resource = z.infer<typeof resourceSchema>;

export const crewSchema = z.strictObject({ id });
export type CrewMember = z.infer<typeof crewSchema>;

const effects = z.array(effectSchema).default([]);

/** A Grip rung (docs/redesign/02-the-run.md 5.2): `tier` is its colour, not a gate. */
export const toolSchema = z.strictObject({
  id,
  tier,
  cost: amount,
  /** May be kept in a Pocket (R7). */
  pocket: z.boolean().default(false),
  effects,
});
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
  nightShift: z.strictObject({
    windowHours: factor,
    maxHours: factor,
    pingMinutes: factor,
    /** Away at least this long: one welcome-back card with one Collect (02 10.2). */
    welcomeAfterMinutes: factor,
  }),
  /** The ×1/×10/×100/Max toggle shows from this many hands on (02 9.1). */
  bulkAfterHands: count,
  /**
   * The crown (02 11.1): the next era or a hand is crowned when it is affordable within
   * `saveSeconds` at the current income. Purchases are scored over a day the player is away
   * `away` of, even while they tap now: unmanned lines and taps stop then, hands work (D177).
   */
  advisor: z.strictObject({ saveSeconds: factor, away: z.number().finite().min(0).lt(1) }),
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

/** An era's tap target (02 6.1): felled every `fellTaps` credited taps. */
export const targetSchema = z.strictObject({ id, era: tier, fellTaps: z.int().min(10), art: id });
export type TargetDef = z.infer<typeof targetSchema>;

export const targetsFileSchema = z.strictObject({ tap: tapSchema, targets: z.array(targetSchema) });

/** An era (02 5.5, 6): bought in order, each opens its lines and swaps the target. */
export const eraSchema = z.strictObject({
  id: tier,
  cost: amount,
  target: id,
  /** A real, reachable gate: Armored opens after Wipe Day #2. */
  requires: z.strictObject({ wipeDays: count }).optional(),
  effects,
});
export type EraDef = z.infer<typeof eraSchema>;

export const erasFileSchema = z.strictObject({ eras: z.array(eraSchema) });

const islandUpgradeSchema = z.strictObject({
  id,
  cost: amount,
  prop: id,
  pocket: z.boolean().default(false),
  effects,
});

export const upgradesFileSchema = z.strictObject({
  island: z.array(islandUpgradeSchema),
});

/** A row of the shelf (02 5): a Grip rung or an island upgrade (the Line Mks are research, D194). */
export interface UpgradeDef {
  id: string;
  kind: "grip" | "island";
  cost: number;
  effects: Effect[];
  pocket: boolean;
  /** Shown and buyable only once this one is bought (02 5.1; D152). */
  after?: string;
}

/** A Workshop item's one effect: no `per`, no `when`, and a level adds it once more. */
const researchEffectSchema = effectSchema.refine(
  (effect) =>
    effect.per === undefined &&
    effect.when === undefined &&
    (effect.op === "add" || effect.op === "inc" || effect.op === "more"),
  { message: "a Workshop effect is add, inc or more, with no `per` and no `when`" },
);

const researchItemSchema = z.strictObject({
  id,
  levels: z.int().min(1).max(25),
  effect: researchEffectSchema,
});

/** The Workshop (game-design 5.12; D185, D194): tiers of items, and one Line Mk per line. */
export const researchFileSchema = z.strictObject({
  /** Seconds after the run's clock starts. */
  opensAfterSeconds: z.number().finite().nonnegative(),
  /** Level n (0 first) of an item in tier k costs base × tierRatio^(k−1) × growth^n. */
  price: z.strictObject({ base: amount, tierRatio: factor, growth: factor }),
  tiers: z.array(z.strictObject({ era: tier, items: z.array(researchItemSchema).min(1).max(5) })),
  lineMk: z.strictObject({
    pocket: z.boolean().default(false),
    effect: researchEffectSchema,
    levels: z
      .array(z.strictObject({ costFactor: factor, needOwned: z.int().min(1) }))
      .min(1)
      .max(5),
  }),
});

/** A Workshop item with its prices derived (`deriveResearch`). */
export interface ResearchDef {
  id: string;
  /** A tier item, or a line's Mk. */
  kind: "tier" | "mk";
  /** Tier 1, 2, ...; 0 for a Line Mk. */
  tier: number;
  /** It opens with this era (a Line Mk: its line's). */
  era: Tier;
  levels: number;
  /** One level's effect (a Line Mk's is scoped to its line). */
  effect: Effect;
  /** Tier items: level n costs base × growth^n. */
  base: number;
  growth: number;
  /** Line Mks: each level's price and the units of the line it needs. */
  costs: number[];
  needOwned: number[];
  line?: string;
  pocket: boolean;
}

const multiplier = z.number().finite().min(1);

export const milestonesFileSchema = z.strictObject({
  /** Per line (02 4.1): exactly one of payout or speed. */
  line: z.array(
    z
      .strictObject({
        at: z.int().min(1),
        payout: multiplier.optional(),
        speed: multiplier.optional(),
      })
      .refine((step) => (step.payout === undefined) !== (step.speed === undefined), {
        message: "a milestone pays `payout` or `speed`, exactly one",
      }),
  ),
  /** Past the list: every `step` from `from` pays `payout`, unless `special` names the count. */
  lineEvery: z.strictObject({
    from: z.int().min(1),
    step: z.int().min(1),
    payout: multiplier,
    special: z.array(z.strictObject({ at: z.int().min(1), payout: multiplier })),
  }),
  /** Every unlocked line at `at` (02 4.2): kept for the run once reached. */
  roster: z.array(z.strictObject({ at: z.int().min(1), payout: multiplier })),
});
export type Milestones = z.infer<typeof milestonesFileSchema>;

const flotsamEffectSchema = z.union([
  z.strictObject({
    /** max(floorMinutes, min(heldShare × held, rateMinutes)) of output (02 8.1). */
    lump: z.strictObject({
      floorMinutes: factor,
      heldShare: z.number().finite().positive().max(1),
      rateMinutes: factor,
    }),
  }),
  z.strictObject({ buff: id, seconds, effects: z.array(effectSchema).min(1) }),
]);

export const flotsamKindSchema = z.strictObject({
  id,
  weight: factor,
  effect: flotsamEffectSchema,
});
export type FlotsamKind = z.infer<typeof flotsamKindSchema>;

export const flotsamFileSchema = z.strictObject({
  schedule: z.strictObject({
    gapMinutes: z.tuple([factor, factor]),
    floatSeconds: seconds,
    graceSeconds: z.number().finite().nonnegative(),
    rainFactor: factor,
  }),
  /** Run 1's guaranteed crate (errata E1): every repeatSeconds until one is caught. */
  firstRun: z.strictObject({
    atSeconds: seconds,
    repeatSeconds: seconds,
    kind: id,
    flatMinutes: factor,
  }),
  kinds: z.array(flotsamKindSchema),
});
export type Flotsam = z.infer<typeof flotsamFileSchema>;

export const WEATHERS = ["clear", "rain", "fog"] as const;
export type Weather = (typeof WEATHERS)[number];

/** The island's clock and weather, the same for every friend (02 8.2; 09 6.5). */
export const islandFileSchema = z.strictObject({
  id,
  /** East of UTC, no daylight saving (errata E9). */
  utcOffsetMinutes: z.int().min(-720).max(840),
  seed: z.int(),
  weather: z.strictObject({
    blockMinutes: z.int().min(1),
    clear: count,
    rain: count,
    fog: count,
  }),
});
export type IslandClock = z.infer<typeof islandFileSchema>;

/** The phases in order (12-feel.md 12: R2 Feel, R3 Cards, R4 The Big Red, … R9 Dares and live ops). */
export const PHASES = ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"] as const;
export type Phase = (typeof PHASES)[number];

/** "08:00+5m" (daily, UTC) or "hourly+5m". */
const sessionSchema = z
  .string()
  .regex(/^(\d\d:\d\d|hourly)\+\d+m$/, "a session is HH:MM+Nm or hourly+Nm");

export const archetypeSchema = z.strictObject({
  sessions: z.array(sessionSchema).min(1),
  tapsPerSecond: z.number().finite().nonnegative(),
  tapsWhileNothingRuns: z.number().finite().nonnegative().optional(),
  /** The share of the flotsam it catches while online (0: none). */
  catches: z.number().finite().min(0).max(1).default(0),
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
    z.strictObject({
      days: z.int().min(1),
      seeds: z.array(z.int()).min(1),
      /** The scenarios' seeds, when they differ from the archetypes' (a scenario is one day). */
      scenarioSeeds: z.array(z.int()).min(1).optional(),
      /**
       * Each archetype plays only as long as a due assertion reads it (`days` stays the cap):
       * `pnpm test`'s quick profile (D236).
       */
      early: z.boolean().optional(),
    }),
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
  /** Grip's rungs, Rock first (owned from the start). */
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
  /** One per era, in era order. */
  targets: TargetDef[];
  /** In tier order; Twig costs nothing. */
  eras: EraDef[];
  /** The shelf: Grip rungs after Rock, then the island upgrades. */
  upgrades: UpgradeDef[];
  /** The Workshop: tier items in tier order, then one Line Mk per line in rung order. */
  research: ResearchDef[];
  workshop: { opensAfterSeconds: number };
  milestones: Milestones;
  flotsam: Flotsam;
  islandClock: IslandClock;
  pacing: Pacing;
  /** What each timed buff does while it runs, by buff kind (from `flotsam.json5`). */
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
  "eras.json5",
  "upgrades.json5",
  "research.json5",
  "milestones.json5",
  "flotsam.json5",
  "island.json5",
  "pacing.json5",
] as const;
export type DataFile = (typeof DATA_FILES)[number];

/** The locale namespace of an entity's name: `{kind}.{id}.name`. */
export type EntityKind =
  | "resource"
  | "crew"
  | "tool"
  | "line"
  | "base_tier"
  | "target"
  | "upgrade"
  | "research"
  | "flotsam";

/** The named entities: their file, where `Content` keeps them and their locale namespace. */
export const FILES = [
  { file: "resources.json5", field: "resources", kind: "resource" },
  { file: "crew.json5", field: "crew", kind: "crew" },
  { file: "tools.json5", field: "tools", kind: "tool" },
  { file: "lines.json5", field: "lines", kind: "line" },
  { file: "eras.json5", field: "eras", kind: "base_tier" },
  { file: "targets.json5", field: "targets", kind: "target" },
] as const satisfies readonly {
  file: DataFile;
  field: keyof Content;
  kind: EntityKind;
}[];
