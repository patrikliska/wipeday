/**
 * A player's base, version 2 (D133; docs/redesign/09-architecture.md 3). One JSON document:
 *
 * - `run`: the island now. Lost on every nuke.
 * - `meta`: what lasts. Glass, the Blast Map, Wipe Days, records and stats.
 *
 * Times are whole unix seconds; amounts are finite doubles (`Amount`, D130); counts are
 * integers. R0 holds the fields its rules use; each later phase adds its own with defaults,
 * which `normalizeState` fills in for stored bases.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
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
  /** Units owned per line. */
  lines: Record<string, number>;
  /** Manned lines, in hire order. */
  hands: string[];
  /** Unmanned lines: when the cycle in flight ends (busy-until). Paid once settle passes it. */
  readyAt: Record<string, number>;
  /** The tap meter, 0..cap, and the second of the last credited tap. */
  hustle: { value: number; at: number };
  /** The tap credit (D134): whole tokens, refilled up to the second `at`. */
  bucket: { tokens: number; at: number };
  /** Taps credited this run: the crit seed's index. */
  taps: number;
  buffs: Buff[];
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
  /** Lifetime counters. */
  stats: { taps: number; hands: number };
  /** The chosen cosmetic; owned ones live in the `legacy` row. */
  skin: string | null;
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
  skin: true,
};

export function newMeta(): Meta {
  return {
    nukes: 0,
    wipeDays: 0,
    lifetime: 0,
    glass: { ever: 0, held: 0, level: 0, spent: 0 },
    nodes: [],
    hints: {},
    stats: { taps: 0, hands: 0 },
    skin: null,
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
    lines: {},
    hands: [],
    readyAt: {},
    hustle: { value: 0, at: now },
    bucket: { tokens: content.tap.bucket.burst, at: now },
    taps: 0,
    buffs: [],
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
