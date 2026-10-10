/**
 * The one effect vocabulary (D135; docs/redesign/09-architecture.md 5.1). Data files name
 * these stats only; the domain's evaluator folds them in a fixed order. Each stat is
 * registered once with its direction, so a `set` knows which value is best and the tests can
 * prove that adding a source never makes a stat worse. Browser-safe.
 */

export const OPS = ["add", "inc", "more", "set", "unlock"] as const;
export type Op = (typeof OPS)[number];

export interface StatDef {
  /** Which way is better for the player; "none" for odds and unlocks. */
  better: "higher" | "lower" | "none";
  ops: readonly Op[];
}

const higher = (...ops: Op[]): StatDef => ({ better: "higher", ops });
const lower = (...ops: Op[]): StatDef => ({ better: "lower", ops });

export const STATS = {
  output: higher("add", "inc", "more"),
  speed: higher("more"),
  line_cost: lower("more"),
  hand_cost: lower("more"),
  upgrade_cost: lower("more"),
  era_cost: lower("more"),
  milestone_x2: higher("set"),
  roster_x2: higher("set"),
  mk_mult: higher("set"),
  tap_flat: higher("more"),
  tap: higher("inc", "more"),
  tap_share: higher("add"),
  hustle_max: higher("add", "set"),
  hustle_hold: higher("add"),
  hustle_drain: lower("more"),
  hustle_gain: higher("add"),
  crit_chance: higher("add", "set"),
  crit_mult: higher("add", "set"),
  fell_taps: lower("more"),
  fell_bonus: higher("add"),
  afterglow: higher("set"),
  afterglow_half: higher("add"),
  afterglow_hold: higher("set"),
  flotsam_rate: higher("more"),
  flotsam_float: higher("add"),
  flotsam_effect: higher("inc"),
  flotsam_weight: { better: "none", ops: ["more", "set"] },
  rally_mult: higher("add"),
  night_shift: higher("add", "more"),
  offline: higher("more"),
  glass_gain: higher("inc", "more"),
  glow_k: higher("add", "set"),
  morale_per: higher("add"),
  morale: higher("more"),
  rank_mult: higher("set"),
  magnet_hours: lower("set"),
  rush_mult: higher("add", "more", "set"),
  rush_seconds: higher("add", "more", "set"),
  rush_cooldown: lower("add", "more", "set"),
  grit_step: higher("add", "more", "set"),
  grit_cap: higher("add", "more", "set"),
  grit_cooldown: lower("add", "more", "set"),
  flare_cooldown: lower("add", "more", "set"),
  start_owned: higher("set"),
  start_era: higher("set"),
  start_upgrade: { better: "none", ops: ["unlock"] },
  keep_hand: { better: "none", ops: ["unlock"] },
  foreman_lines: higher("set"),
  hand_cap: higher("set"),
} as const satisfies Record<string, StatDef>;

export type StatId = keyof typeof STATS;
export const STAT_IDS = Object.keys(STATS) as StatId[];

/** What a `per` effect counts (each carries a `max`). `sector:<id>` arrives with the Blast Map. */
export const PERS = ["owned", "hands", "nukes", "entries"] as const;
export type Per = (typeof PERS)[number];

/** When a conditional effect applies. `dare:<id>` arrives with Dares (R7). */
export const WHENS = ["online", "offline", "afterglow", "rain", "night", "hustle_full"] as const;
export type When = (typeof WHENS)[number];

export interface Effect {
  stat: StatId;
  op: Op;
  value: number;
  /** A line id, an era id or `all`; for shelf, flotsam and skill stats their kind or id. */
  scope?: string;
  per?: Per;
  /** The most a `per` effect adds up to (required with `per`). */
  max?: number;
  when?: When;
}
