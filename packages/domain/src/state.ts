/**
 * A player's base, version 2 (D133; docs/redesign/09-architecture.md 3). One JSON document:
 *
 * - `run`: the island now. Lost on every nuke.
 * - `meta`: what lasts. Glass, the Blast Map, Wipe Days, records and stats.
 *
 * Times are whole unix seconds; amounts are finite doubles (`Amount`, D130); counts are
 * integers. Each phase adds the fields its rules use, with defaults, which `normalizeState`
 * fills in for stored bases (R1: eras, the shelf, the roster, the target and the flotsam;
 * R2 Feel: the Workshop's levels, the Frenzy meter, the gulls and the badges; R3 the cards and
 * the Supply Drops, then scrap, the Work Orders, the daily quests and the boosts).
 */
import type { DropTier, Rarity } from "@wipe-day/content/cards";
import type { Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import { rollOrders } from "./orders";
import { SEED, seedOf } from "./rng";

/** A timed boost: Rally, a Drowned Drone, Adrenaline, Rush (what each does is content). */
export interface Buff {
  kind: string;
  /** Ends at this second. */
  until: number;
  /** The one line it boosts (the drone); every line otherwise. */
  line?: string;
}

export interface RunState {
  /** The run's number: meta.nukes + 1. */
  n: number;
  /** seedOf(base seed, SEED.run, meta.nukes): every roll of the run derives from it. */
  seed: number;
  /** Which island the run is on (canon 9's reserved field; Saltmarsh until the Crossing). */
  island: string;
  /** The nuke that started it, or the base's creation. */
  createdAt: number;
  /** The first taps or purchase; null while the run is fresh. The run's clock. */
  startedAt: number | null;
  /** The first taps batch's start: Afterglow counts from here. */
  afterglowFrom: number | null;
  /** The first purchase; null while rebuilding. */
  firstBuyAt: number | null;
  /** Production is credited up to here. */
  settledAt: number;
  /** The last command: the Night Shift window runs from here. */
  activeAt: number;
  /** `made` at activeAt: the welcome back shows made − madeAtActive. */
  madeAtActive: Amount;
  supplies: Amount;
  /** Earned this run from every source. */
  made: Amount;
  era: Tier;
  /** Seconds after `startedAt` each era was reached (Twig is the start). */
  eraAt: Partial<Record<Tier, number>>;
  /** Roster tiers reached (milestones.json5 `roster`): kept for the run once reached. */
  roster: number;
  /** Shelf rows bought this run, in order: Grip rungs, Line Mks, island upgrades. */
  upgrades: string[];
  /** Workshop levels bought this run, by item (12-feel.md 5; reset by the nuke). */
  research: Record<string, number>;
  /** The era's target: credited taps toward the next fell, and fells this run. */
  target: { taps: number; felled: number };
  /**
   * The flotsam cursor (09-architecture.md 6.4): arrival `k` washes up at `at` (null until the
   * run's first tap or purchase); `caught` counts this run's catches, `last` is the index of the
   * latest (−1: none), so a second claim of it reads "already caught", not "drifted off".
   */
  flotsam: { k: number; at: number | null; caught: number; last: number };
  /** Units owned per line. */
  lines: Record<string, number>;
  /** Manned lines, in hire order. */
  hands: string[];
  /** Unmanned lines: when the cycle in flight ends (busy-until). Paid once settle passes it. */
  readyAt: Record<string, number>;
  /** The tap meter, 0..cap, and the second of the last credited tap. */
  hustle: { value: number; at: number };
  /** The Frenzy meter (12-feel.md 3.1), 0..cap, the second it was last moved, and trips this run. */
  frenzy: { value: number; at: number; trips: number };
  /** Gulls caught this run, and the slot of the latest (−1: none), as for flotsam. */
  gulls: { caught: number; last: number };
  /** The tap credit (D134): whole tokens, refilled up to the second `at`. */
  bucket: { tokens: number; at: number };
  /** Taps credited this run: the crit seed's index. */
  taps: number;
  buffs: Buff[];
  /**
   * The run's Work Orders (D256): the ids rolled for it in their fixed order, the ones claimed
   * in claim order, and the second the set was fuelled (`fuel` claims), or null.
   */
  orders: { ids: string[]; claimed: string[]; fuelledAt: number | null };
  /**
   * A Lucky Tide (D258), or null: bought as `boost` at `from`, dropping crates until `until`;
   * `last` is the slot caught latest (−1: none), as for the crows.
   */
  tide: { boost: string; from: number; until: number; last: number } | null;
  /** The run's best glass an hour (the Big Red's readout, 03-the-big-red.md 2.1), sampled per command. */
  peak: number;
  /** The second this run's supplies made passed the best run's (Personal Best, R4), or null. */
  personalBestAt: number | null;
}

export interface Meta {
  /** Every press of the Big Red: run numbers and seeds. */
  nukes: number;
  /** Counted nukes (Wipe Day #N). */
  wipeDays: number;
  /** Supplies made in finished runs. */
  lifetime: Amount;
  /** Glass ever earned (Glow), held (to spend), the level paid so far, and spent. */
  glass: { ever: Amount; held: Amount; level: number; spent: Amount };
  /** Owned Blast Map nodes. */
  nodes: string[];
  /** Uses per hint; a hint retires after two. */
  hints: Record<string, number>;
  /** Lifetime counters: what the badges count (12-feel.md 9.1). */
  stats: {
    taps: number;
    hands: number;
    felled: number;
    flotsam: number;
    /** Critical taps. */
    crits: number;
    /** Frenzies tripped. */
    frenzies: number;
    gulls: number;
    /** Units of every line bought. */
    units: number;
    /** Workshop levels bought. */
    research: number;
    /** Shelf upgrades bought (Grip rungs, island upgrades). */
    upgrades: number;
    /** Eras reached (Twig, the start, not counted). */
    eras: number;
    /** Welcome-back Collects pressed. */
    collects: number;
    /** Supply Drops opened. */
    drops: number;
    /** Scrap ever earned (N19 reads it; `meta.scrap` is what is held). */
    scrap: number;
    /** Work Orders claimed. */
    orders: number;
    /** Daily quests claimed (by hand or at the roll). */
    quests: number;
  };
  /** Badges earned (the Logbook's wall), by id: the second each was earned. */
  badges: Record<string, number>;
  /** The chosen cosmetic; owned ones live in the `legacy` row. */
  skin: string | null;
  /**
   * The cards owned (12-feel.md 7): survivors by id with their stars, gear by id with who wears
   * it (null: in the Album). Only what changes effects lives here, so earning shards or drops
   * never rebuilds the effects cache (effects.ts keys on this object).
   */
  cards: { survivors: Record<string, number>; gear: Record<string, string | null> };
  /** Supply Drops: held unopened by tier, cards drawn, pity, shards, and what was paid. */
  drops: Drops;
  /** Scrap held (D182, D259): a whole number, earned in play, spent on drops and boosts. */
  scrap: number;
  /** The day's quests (D257). */
  quests: Quests;
  /** Records (R4): the most supplies a finished run made, and the biggest Wipe Day's gain. */
  records: { bestRun: Amount; bestBlast: Amount };
  /** Flight variants seen, in first-seen order (the Logbook backfills from it, R6). */
  flights: string[];
  /**
   * Nuke news (06-friends.md 2.2): when the last news nuke was, how many Wipe Days folded into
   * the next one since and their glass in all.
   */
  news: { at: number | null; folded: number; glass: Amount };
}

export interface Quests {
  /** The island day the set was rolled for (0: none yet; the first command rolls). */
  day: number;
  /** The day's quest ids, in the pool's order. */
  ids: string[];
  claimed: string[];
  /** `meta.stats` at the roll: a quest's progress is its counter's growth since. */
  snapshot: Meta["stats"];
  /** The day's set bonus paid. */
  setPaid: boolean;
}

export interface Drops {
  /** Earned and not yet opened, by tier. */
  held: Record<DropTier, number>;
  /** Cards drawn so far: the drop seed's index (the first is the printed first card). */
  pulls: number;
  /** Cards in a row without at least this rarity (pity, counted across tiers). */
  pity: { rare: number; epic: number; legendary: number };
  /** A survivor's own shards (its stars), and shards of each rarity (gear). */
  shards: { crew: Record<string, number>; gear: Record<Rarity, number> };
  /** Count-based drops already paid: tier-I drops for fells and for badges (`credit`). */
  paid: { fells: number; badges: number };
  /** Drops claims owe (the Work Orders', the quest set's): marks earned, and the ones the gate has paid (D256). */
  owed: { earned: number; paid: number };
  /** Felling's drops given on island day `day` (at most `fells.perDay`), the last one at `at`. */
  today: { day: number; fells: number; at: number };
}

export interface BaseState {
  v: 2;
  /** Fixed at creation. */
  seed: number;
  createdAt: number;
  run: RunState;
  meta: Meta;
}

/**
 * What a Crossing (canon 9, later) keeps of `meta`: true is kept, false is reset. Unused until
 * the Crossing exists; every Meta field must be listed.
 */
export const KEEP_ON_CROSSING: Record<keyof Meta, boolean> = {
  nukes: true,
  wipeDays: true,
  lifetime: false,
  glass: false,
  nodes: false,
  hints: true,
  stats: true,
  badges: true,
  skin: true,
  // Precious things are never at risk (guardrail 8).
  cards: true,
  drops: true,
  scrap: true,
  quests: true,
  records: true,
  flights: true,
  news: true,
};

/** Every lifetime counter at zero. */
export function newStats(): Meta["stats"] {
  return {
    taps: 0,
    hands: 0,
    felled: 0,
    flotsam: 0,
    crits: 0,
    frenzies: 0,
    gulls: 0,
    units: 0,
    research: 0,
    upgrades: 0,
    eras: 0,
    collects: 0,
    drops: 0,
    scrap: 0,
    orders: 0,
    quests: 0,
  };
}

export function newMeta(): Meta {
  return {
    nukes: 0,
    wipeDays: 0,
    lifetime: 0,
    glass: { ever: 0, held: 0, level: 0, spent: 0 },
    nodes: [],
    hints: {},
    stats: newStats(),
    badges: {},
    skin: null,
    cards: { survivors: {}, gear: {} },
    drops: newDrops(),
    scrap: 0,
    quests: newQuests(),
    records: { bestRun: 0, bestBlast: 0 },
    flights: [],
    news: { at: null, folded: 0, glass: 0 },
  };
}

/** No day rolled yet: the first command draws the island's quests for its day. */
export function newQuests(): Quests {
  return { day: 0, ids: [], claimed: [], snapshot: newStats(), setPaid: false };
}

export function newDrops(): Drops {
  return {
    held: { 1: 0, 2: 0, 3: 0 },
    pulls: 0,
    pity: { rare: 0, epic: 0, legendary: 0 },
    shards: { crew: {}, gear: { common: 0, rare: 0, epic: 0, legendary: 0 } },
    paid: { fells: 0, badges: 0 },
    owed: { earned: 0, paid: 0 },
    today: { day: 0, fells: 0, at: 0 },
  };
}

/** A fresh island for the next run: nothing owned, a full tap bucket. */
export function newRun(content: Content, meta: Meta, baseSeed: number, now: number): RunState {
  return {
    n: meta.nukes + 1,
    seed: seedOf(baseSeed, SEED.run, meta.nukes),
    island: content.island,
    createdAt: now,
    startedAt: null,
    afterglowFrom: null,
    firstBuyAt: null,
    settledAt: now,
    activeAt: now,
    madeAtActive: 0,
    supplies: 0,
    made: 0,
    era: "twig",
    eraAt: {},
    roster: 0,
    upgrades: [],
    research: {},
    target: { taps: 0, felled: 0 },
    flotsam: { k: 0, at: null, caught: 0, last: -1 },
    lines: {},
    hands: [],
    readyAt: {},
    hustle: { value: 0, at: now },
    frenzy: { value: 0, at: now, trips: 0 },
    gulls: { caught: 0, last: -1 },
    bucket: { tokens: content.tap.bucket.burst, at: now },
    taps: 0,
    buffs: [],
    orders: { ids: rollOrders(content, baseSeed, meta.nukes + 1), claimed: [], fuelledAt: null },
    tide: null,
    peak: 0,
    personalBestAt: null,
  };
}

/** A new player's base: run 1 on a bare island. */
export function newBase(content: Content, now: number, seed: number): BaseState {
  const meta = newMeta();
  return { v: 2, seed, createdAt: now, run: newRun(content, meta, seed, now), meta };
}

/** Units of `line` owned. */
export const owned = (state: BaseState, line: string): number => state.run.lines[line] ?? 0;

/** Whether `line` has its hand. */
export const manned = (state: BaseState, line: string): boolean => state.run.hands.includes(line);
