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
import { CARD_STAT_IDS, type CardStatId, RARITIES, SLOTS } from "./cards";
import {
  type Effect,
  FEATURE_STAT,
  isFeatureStat,
  OPS,
  PERS,
  SECTOR_PER,
  STAT_IDS,
  STATS,
  type StatId,
  WHENS,
} from "./effects";
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
    stat: z.union([
      z.enum(STAT_IDS as [StatId, ...StatId[]]),
      z.string().regex(FEATURE_STAT, "a feature is `feature:<id>`"),
    ]),
    op: z.enum(OPS),
    value: z.number().finite(),
    scope: z.string().min(1).max(40).optional(),
    per: z
      .union([z.enum(PERS), z.string().regex(SECTOR_PER, "a sector count is `sector:<id>`")])
      .optional(),
    max: z.number().finite().optional(),
    when: z.enum(WHENS).optional(),
  })
  .refine((effect) => effect.per === undefined || effect.max !== undefined, {
    message: "an effect with `per` needs a `max`",
  })
  .refine(
    (effect) =>
      isFeatureStat(effect.stat)
        ? effect.op === "unlock"
        : ((STATS[effect.stat as StatId]?.ops as readonly string[] | undefined)?.includes(
            effect.op,
          ) ?? false),
    { message: "this op is not allowed for this stat" },
  )
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
  advisor: z.strictObject({
    saveSeconds: factor,
    away: z.number().finite().min(0).lt(1),
    /** A kind of purchase is new (its Buy orange) until bought this many times (D244). */
    hintUses: z.number().int().positive(),
  }),
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

/** What a nuke pays beside its glass (D248, 12-feel.md 7.1, 8): a Supply Drop tier and scrap. */
const nukePaySchema = z.strictObject({
  drop: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  scrap: z.int().min(0),
});

export const prestigeSchema = z.strictObject({
  l0: factor,
  exponent: z.number().finite().positive().max(1),
  glowK: z.number().finite().nonnegative(),
  firstNukeGlass: count,
  /** Later nukes are pressable at this gain (03-the-big-red.md 1.5). */
  laterNukeGlass: z.int().min(1),
  countShare: z.number().finite().nonnegative().max(1),
  /** A later Wipe Day's gain is at least this, whatever the share says (D269). */
  countMinGlass: z.int().min(1),
  afterglow: z.strictObject({
    start: factor,
    halfSeconds: seconds,
    holdSeconds: z.number().finite().nonnegative(),
    endsAfterSeconds: seconds,
  }),
  /**
   * The Kettle's stages (03 3.2): the pad at `padAt` lifetime supplies in run 1 (from the start
   * later); the frame at a gain of `frameFirst` before the first nuke, later at `frameShare` of
   * glass ever (at least 1); the warhead when the nuke counts; fuel and steam when crowned.
   */
  kettle: z.strictObject({
    padAt: amount,
    frameFirst: z.int().min(1),
    frameShare: z.number().finite().positive().max(1),
  }),
  /** The crown's "a day's run" rule (03 2.2 rule 4): a counting nuke in a run this old. */
  crown: z.strictObject({ ageSeconds: seconds }),
  /**
   * Nuke news (06-friends.md 2.2): a Wipe Day is news when the last news nuke was `foldMinutes`
   * ago or more, or its count is a milestone (`milestones`, then every `every`); the rest fold
   * into the next one.
   */
  news: z.strictObject({
    foldMinutes: factor,
    milestones: z.array(z.int().min(1)).min(1),
    every: z.int().min(1),
  }),
  /** What each kind of press pays beside glass: a small blast, a Wipe Day, a doubling Wipe Day. */
  pays: z.strictObject({ small: nukePaySchema, wipeDay: nukePaySchema, doubling: nukePaySchema }),
  /**
   * The cinematic's flights (03 7.3), rolled on the run's seed: each from Wipe Day `unlockAt`,
   * weighed `weight` (unseen ones ×`unseenWeight`); `small` is the one every small blast flies.
   */
  flights: z.strictObject({
    unseenWeight: factor,
    small: id,
    variants: z.array(z.strictObject({ id, unlockAt: count, weight: factor })).min(1),
  }),
});
export type Prestige = z.infer<typeof prestigeSchema>;

// --- the Blast Map and the agenda (R4; docs/redesign/04-blast-map.md 9, 03-the-big-red.md 12) --

export const NODE_TYPES = [
  "small",
  "notable",
  "keystone",
  "unlock",
  "automation",
  "completion",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/** A node of the Blast Map (04 9.1). Ground Zero has no sector and ring 0. */
export const nodeSchema = z.strictObject({
  id,
  sector: id.nullable(),
  ring: z.int().min(0).max(9),
  slot: z.int().min(0).max(7),
  type: z.enum(NODE_TYPES),
  cost: amount,
  /** Parents, OR: one owned is enough (a completion needs its whole previous ring). */
  requires: z.array(id),
  effects: z.array(effectSchema).min(1),
  /** Small nodes of one series share a name (`node.<series>.name` with a numeral). */
  series: id.optional(),
  /** It changes the island's picture. */
  scene: z.boolean().optional(),
  /** Its own Wipe Day gate, at least its ring's. */
  gate: count.optional(),
});
export type NodeDef = z.infer<typeof nodeSchema>;

export const blastMapFileSchema = z.strictObject({
  /** Clockwise from 12 o'clock. */
  sectors: z.array(id).min(1),
  /** Rings up to this wave are drawn, listed and buyable; the rest wait for their phase. */
  shippedWave: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  rings: z
    .array(
      z.strictObject({
        ring: z.int().min(1).max(9),
        size: z.int().min(1).max(7),
        band: z.tuple([amount, amount]),
      }),
    )
    .min(1),
  /** The one ladder of prices (04 3.1). */
  prices: z.array(amount).min(1),
  typeFactor: z.record(z.enum(NODE_TYPES), factor),
  /** The most all shipped non-keystone nodes may add to a stat together (04 4.2). */
  ceilings: z.partialRecord(z.enum(STAT_IDS as [StatId, ...StatId[]]), z.number().finite()),
  nodes: z.array(nodeSchema),
});
export type BlastMapFile = z.infer<typeof blastMapFileSchema>;

/** The wave a ring belongs to (04 1.4): 1 for rings 1-3, 2 for 4-6, 3 for 7-9. */
export const waveOf = (ring: number): 1 | 2 | 3 => (ring <= 3 ? 1 : ring <= 6 ? 2 : 3);

/**
 * An agenda unlock (03 12), `kind:id`: a `feature` the code reads, a `ring` of the map, an
 * `era`, a `flight`, a `sign` style, or `hands:<rung>` (hands for lines 1-rung survive nukes).
 */
export const AGENDA_KINDS = ["feature", "ring", "era", "flight", "sign", "hands"] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];
export const SIGN_STYLES = ["plank", "painted", "metal", "lit"] as const;
export type SignStyle = (typeof SIGN_STYLES)[number];
const unlock = z.string().regex(/^[a-z]+:[a-z0-9_]+$/, "an unlock is `kind:id`");

export const agendaFileSchema = z.strictObject({
  /** Each row: at Wipe Day `at`, these unlock. Shipped content only (a check refuses the rest). */
  rows: z.array(z.strictObject({ at: z.int().min(1), unlocks: z.array(unlock).min(1) })).min(1),
});
export type AgendaFile = z.infer<typeof agendaFileSchema>;

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
  /**
   * Frenzy (D196, D237): a second meter, +perTap a credited tap from opensAfterSeconds on the
   * run's clock; it holds graceSeconds, then drains. At cap it trips the `frenzy` buff for
   * `seconds`: taps and lines ×mult (lines through speed ×speed and output ×mult/speed).
   */
  frenzy: z.strictObject({
    opensAfterSeconds: z.number().finite().nonnegative(),
    perTap: factor,
    cap: factor,
    graceSeconds: z.number().finite().nonnegative(),
    drainPerSecond: z.number().finite().nonnegative(),
    seconds: seconds,
    mult: factor,
    speed: factor,
    multCeiling: factor,
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
  /** A Supply Drop of this tier (the Sealed Locker, 12-feel.md 7.1). */
  z.strictObject({ drop: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
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
  /**
   * Crows (the `gull` id; D197, D238): slot j crosses the sky `firstAfterSeconds + j × every`
   * after the run's clock starts, plus a seeded offset in [0, jitter]; one in 1/eliteOdds is a
   * Magpie. A catch pays `seconds` (a Magpie `eliteSeconds`) of output.
   */
  gulls: z.strictObject({
    firstAfterSeconds: seconds,
    every: seconds,
    jitter: z.number().finite().nonnegative(),
    crossSeconds: seconds,
    eliteCrossSeconds: seconds,
    graceSeconds: z.number().finite().nonnegative(),
    eliteOdds: z.number().finite().positive().max(1),
    seconds: seconds,
    eliteSeconds: seconds,
  }),
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
  /** Night on the island's clock, for "at night" badges: from `from` until `to` (hours). */
  night: z.strictObject({ from: z.int().min(0).max(23), to: z.int().min(0).max(23) }),
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
  /** What it does with scrap (R3 S2): boosts at a session's start, tier-II drops, or hoard. */
  spend: z.enum(["boosts", "drops", "none"]).default("none"),
  /** The quick profile plays it this many days at most (its later days are `--full`'s, D236). */
  quickDays: z.int().min(1).optional(),
  /** A scenario's runs in the quick profile: its session ends with this run's press (D272). */
  quickRuns: z.int().min(1).optional(),
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

/**
 * Badges (12-feel.md 9.1; D198, D239): the Logbook's first pages. Each `when` is one condition
 * from a closed vocabulary the domain evaluates after every successful command (`badges.ts`).
 */
export const BADGE_STATS = [
  "taps",
  "hands",
  "felled",
  "flotsam",
  "frenzies",
  "gulls",
  "units",
  "research",
  "eras",
  "collects",
  "drops",
] as const;
export type BadgeStat = (typeof BADGE_STATS)[number];
/** Domain events a badge may wait for (the domain test holds each to a real event type). */
export const BADGE_EVENTS = [
  "era_reached",
  "hand_hired",
  "felled",
  "flotsam_claimed",
  "gull_caught",
  "frenzy_tripped",
  "researched",
  "night_shift_collected",
] as const;
export type BadgeEvent = (typeof BADGE_EVENTS)[number];
/** Named predicates on the state after a command. */
export const BADGE_STATES = [
  "era",
  "lines_min_owned",
  "line_max_owned",
  "hands_working",
  "hustle",
  "supplies_digits",
  "made_ever",
  "research_maxed",
  "window_hours",
  // Run-scoped (the Work Orders, D256): this run's taps, fells, catches, crows, Frenzies and
  // supplies made, and the units of one `line`.
  "run_taps",
  "run_felled",
  "run_flotsam",
  "run_gulls",
  "run_frenzies",
  "run_made",
  "line_owned",
] as const;
export type BadgeState = (typeof BADGE_STATES)[number];
/** The states that name their line. */
export const LINE_STATES: readonly BadgeState[] = ["line_owned"];
const scalar = z.union([z.string(), z.number(), z.boolean()]);
/** Parsed into a tagged shape (`kind`) so the domain can switch on it. */
export const badgeWhenSchema = z.union([
  z
    .strictObject({ stat: z.enum(BADGE_STATS), gte: factor })
    .transform((when) => ({ kind: "stat" as const, ...when })),
  z
    .strictObject({
      state: z.enum(BADGE_STATES),
      gte: factor.optional(),
      eq: z.number().finite().optional(),
      era: tier.optional(),
      /** `line_owned`'s line. */
      line: id.optional(),
    })
    .transform((when) => ({ kind: "state" as const, ...when })),
  z
    .strictObject({ buffs: z.array(id).min(2) })
    .transform((when) => ({ kind: "buffs" as const, ...when })),
  // Field filters on the event (`field: value`, or `fieldLte` / `fieldGte` for numbers); also
  // `weather` and `night`, read from the island's clock at the command's second.
  z
    .object({ event: z.enum(BADGE_EVENTS) })
    .catchall(scalar)
    .transform(({ event, ...filters }) => ({
      kind: "event" as const,
      event: event as BadgeEvent,
      filters: filters as Record<string, string | number | boolean>,
    })),
]);
export type BadgeWhen = z.infer<typeof badgeWhenSchema>;
export const BADGE_CHAPTERS = [
  "eras",
  "lines",
  "hands",
  "taps",
  "frenzy",
  "gulls",
  "airdrops",
  "workshop",
  "night_shift",
  "supplies",
] as const;
export const badgeSchema = z.strictObject({
  id,
  chapter: z.enum(BADGE_CHAPTERS),
  /** `<kind>/<id>`: an existing icon (D141). */
  icon: z.string().regex(/^[a-z_]+\/[a-z0-9_]+$/),
  when: badgeWhenSchema,
});
export type BadgeDef = z.infer<typeof badgeSchema>;
export const achievementsFileSchema = z.strictObject({
  /** Morale = 1 + moralePer × badges earned (D198). */
  moralePer: z.number().finite().nonnegative().max(0.1),
  badges: z.array(badgeSchema),
});
export type Achievements = z.infer<typeof achievementsFileSchema>;

/**
 * What an order or a quest pays: a Supply Drop of a tier, scrap, or gear shards of a rarity
 * (12-feel.md 7.1, 8; D266: the orders pay shards at once, their set a drop).
 */
export const paySchema = z.union([
  z.strictObject({ drop: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.strictObject({ scrap: z.int().min(1) }),
  z.strictObject({ shards: z.strictObject({ rarity: z.enum(RARITIES), n: z.int().min(1) }) }),
]);
export type Pay = z.infer<typeof paySchema>;

/**
 * Work Orders (13-adventure.md 3; D255, D256): a run's checklist, rolled per run from pools per
 * era. `when` is a state predicate (progress must be showable, so no events or buffs).
 */
export const orderSchema = z.strictObject({
  id,
  era: tier,
  when: badgeWhenSchema.refine((when) => when.kind === "state", {
    message: "an order's `when` is a `state` predicate",
  }),
  pays: z.array(paySchema).min(1),
  /** Needs the player at the screen (taps, fells, catches, Frenzy): at most `activeMax` a roll. */
  active: z.boolean().optional(),
  /** Reached by any player given time (eras, supplies made): at least `idleMin` a roll (N32). */
  idle: z.boolean().optional(),
});
export type OrderDef = z.infer<typeof orderSchema>;
export const ordersFileSchema = z.strictObject({
  perRun: z.int().min(1),
  /** Claimed orders that fuel the Kettle (crown the Big Red). */
  fuel: z.int().min(1),
  /** What the `fuel`-th claim pays on top (D266): a drop, through the gate. */
  set: z.array(paySchema),
  /** How many of each era's pool a run gets, in era order. */
  spread: z.array(z.strictObject({ era: tier, count: z.int().min(1) })).min(1),
  activeMax: z.int().min(0),
  idleMin: z.int().min(0),
  orders: z.array(orderSchema),
});
export type OrdersFile = z.infer<typeof ordersFileSchema>;

/** Daily quests (12-feel.md 9.2; D257): lifetime counters that must grow by `n` in the day. */
export const questSchema = z.strictObject({ id, stat: z.enum(BADGE_STATS), n: z.int().min(1) });
export type QuestDef = z.infer<typeof questSchema>;
export const questsFileSchema = z.strictObject({
  perDay: z.int().min(1),
  pays: z.strictObject({ each: z.array(paySchema), set: z.array(paySchema) }),
  quests: z.array(questSchema),
});
export type QuestsFile = z.infer<typeof questsFileSchema>;

/** A scrap boost (12-feel.md 8; D258): a timed buff (`effects`) or the Lucky Tide (`tide`). */
export const boostSchema = z
  .strictObject({
    id,
    cost: z.int().min(1),
    seconds,
    effects: z.array(effectSchema).min(1).optional(),
    tide: z
      .strictObject({ firstAfterSeconds: z.number().finite().nonnegative(), every: seconds })
      .optional(),
  })
  .refine((boost) => (boost.effects === undefined) !== (boost.tide === undefined), {
    message: "a boost has either `effects` or `tide`",
  });
export type BoostDef = z.infer<typeof boostSchema>;
export const scrapFileSchema = z.strictObject({
  /** Supply Drop prices by tier (only the tiers scrap buys). */
  drops: z.strictObject({ 2: z.int().min(1), 3: z.int().min(1) }),
  /** What the Magpie pays. */
  magpie: z.int().min(0),
  boosts: z.array(boostSchema),
});
export type ScrapFile = z.infer<typeof scrapFileSchema>;

const rarity = z.enum(RARITIES);
const cardEffectSchema = z.strictObject({
  stat: z.enum(CARD_STAT_IDS as [CardStatId, ...CardStatId[]]),
  value: z.number().finite(),
});
const byRarity = (value: z.ZodType<number>) =>
  z.strictObject({ common: value, rare: value, epic: value, legendary: value });
const percent = z.number().finite().min(0).max(100);

/**
 * Survivor and gear cards, the sets and the Supply Drops (12-feel.md 7; R3 Cards). A survivor is
 * a hand of crew.json5; owning the card adds, while the hand is hired, its stars, its trait and
 * the gear it wears (D248).
 */
export const cardsFileSchema = z.strictObject({
  /** Stars 2-5 cost these shards of the survivor; each star above 1 gives its line ×(1 + perStar). */
  stars: z.strictObject({
    costs: z.array(z.int().min(1)).length(4),
    perStar: z.number().finite().positive().max(1),
  }),
  shards: z.strictObject({
    /** A duplicate survivor pays this many of its own shards (a 5★ one pays gear shards). */
    survivor: byRarity(z.int().min(1)),
    /** A duplicate gear card pays this many shards of its rarity. */
    gear: byRarity(z.int().min(1)),
    /** Rarity shards buy any gear card of that rarity. */
    craft: byRarity(z.int().min(1)),
  }),
  drops: z.strictObject({
    /** Cards in a drop. */
    cards: z.int().min(1).max(5),
    /** The first drop's first card (printed on the odds page). */
    first: id,
    /** Tier I, II, III: the odds of each card's rarity, in percent. */
    tiers: z.array(z.strictObject({ odds: byRarity(percent) })).length(3),
    /** Pity, counted per player across tiers: at least this rarity within this many cards. */
    pity: z.strictObject({ rare: z.int().min(2), epic: z.int().min(2), legendary: z.int().min(2) }),
    /**
     * A tier-I drop at each of these lifetime fells, then one every `every` fells; at most one
     * every `gapMinutes` and `perDay` an island day (marks passed meanwhile pay nothing, D249).
     */
    fells: z.strictObject({
      at: z.array(z.int().min(1)).min(1),
      every: z.int().min(1),
      gapMinutes: z.number().finite().nonnegative(),
      perDay: z.int().min(1),
    }),
    /** A tier-I drop per this many badges earned. */
    badgesPer: z.int().min(1),
  }),
  survivors: z.array(z.strictObject({ id, rarity, trait: cardEffectSchema })),
  gear: z.array(z.strictObject({ id, rarity, slot: z.enum(SLOTS), effect: cardEffectSchema })),
  sets: z.strictObject({
    /** Every survivor (of `rarity`, when named) owned at `stars` or more. */
    crews: z.array(
      z.strictObject({
        id,
        rarity: rarity.optional(),
        stars: z.int().min(1).max(5),
        effects: z.array(effectSchema).min(1),
      }),
    ),
    /** A hired survivor wearing `pieces` gear cards of one rarity: `effect` on its own line. */
    kit: z.strictObject({ id, pieces: z.int().min(2).max(3), effect: cardEffectSchema }),
  }),
});
export type CardsFile = z.infer<typeof cardsFileSchema>;
export type SurvivorDef = CardsFile["survivors"][number];
export type GearDef = CardsFile["gear"][number];

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
  /** The Logbook's badges and what each is worth in Morale. */
  achievements: Achievements;
  /** What each timed buff does while it runs, by buff kind (from `flotsam.json5`). */
  buffs: Record<string, Effect[]>;
  /** Survivor and gear cards, sets and Supply Drops (R3). */
  cards: CardsFile;
  /** Work Orders: the run's checklist (R3 S2, D256). */
  orders: OrdersFile;
  /** Daily quests on the island's clock (R3 S2, D257). */
  quests: QuestsFile;
  /** Scrap: drop prices, the Magpie's pay and the boosts (R3 S2, D258). */
  scrap: ScrapFile;
  /** The Blast Map: sectors, rings, the price ladder and the nodes in data (R4). */
  blastMap: BlastMapFile;
  /** What each counted Wipe Day unlocks (R4). */
  agenda: AgendaFile;
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
  "achievements.json5",
  "cards.json5",
  "orders.json5",
  "quests.json5",
  "scrap.json5",
  "blastmap.json5",
  "agenda.json5",
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
  | "flotsam"
  | "gear"
  | "set"
  | "order"
  | "quest"
  | "boost"
  | "node"
  | "sector";

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
