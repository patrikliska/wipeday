/**
 * Survivor and gear cards (docs/redesign/12-feel.md 7; R3 Cards): the rarity scale, the stats a
 * card may carry and how far, and a card's effect in the one vocabulary (D135). Browser-safe: the
 * domain, the web client and the content checks share these.
 *
 * A card names a stat and a value only; its op comes from `CARD_STATS`. Production stats
 * (`own`) reach the card holder's own line, which the domain fills in as the scope; the rest
 * reach the whole island. Everything a card does works only while its survivor is hired (owner,
 * D248).
 */
import type { Effect, Op, StatId } from "./effects";

/** The rarity scale, lowest first. (The era tiers stay `TIERS`.) */
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Supply Drop tiers: I, II, III. */
export const DROP_TIERS = [1, 2, 3] as const;
export type DropTier = (typeof DROP_TIERS)[number];

/** Gear slots: all three open at once (owner, D248). */
export const SLOTS = ["hand", "head", "pack"] as const;
export type Slot = (typeof SLOTS)[number];

export interface CardStat {
  op: Extract<Op, "add" | "inc" | "more">;
  /** The most a Legendary gear card may give: `more` as a factor, `add` and `inc` as amounts. */
  top: number;
  /** Reaches the holder's own line (production), not the whole island. */
  own: boolean;
}

/**
 * The stats a card may carry (12-feel.md 7.2-7.3), with the Legendary top of each. Production
 * only: cards make the crew work harder, never the taps, so an active hour stays 4-6× an idle
 * one (N9; tap, crit, fell, Frenzy and airdrop stats moved it to 7-8×, D252).
 */
export const CARD_STATS = {
  output: { op: "more", top: 1.6, own: true },
  speed: { op: "more", top: 1.6, own: true },
  /** The line's output while the player is away. */
  offline: { op: "more", top: 1.6, own: true },
  /** Hours (the Night Shift's unit). */
  night_shift: { op: "add", top: 0.6, own: false },
} as const satisfies Partial<Record<StatId, CardStat>>;

export type CardStatId = keyof typeof CARD_STATS;
export const CARD_STAT_IDS = Object.keys(CARD_STATS) as CardStatId[];

/** What share of a stat's Legendary top each rarity of gear may give (+20% … +60% output). */
export const RARITY_SHARE: Readonly<Record<Rarity, number>> = {
  common: 1 / 3,
  rare: 1 / 2,
  epic: 3 / 4,
  legendary: 1,
};

/** A trait gives at most this share of a stat's top (+25% output: "at most +25% on one stat"). */
export const TRAIT_SHARE = 0.25 / 0.6;

/** A card's stat and value, as data. */
export interface CardEffect {
  stat: CardStatId;
  value: number;
}

/** The most `stat` may give at `share` of its top. */
export function cardCap(stat: CardStatId, share: number): number {
  const def: CardStat = CARD_STATS[stat];
  return def.op === "more" ? 1 + (def.top - 1) * share : def.top * share;
}

/** Whether `value` gives anything and stays within `share` of its stat's top. */
export function withinCap(effect: CardEffect, share: number): boolean {
  const def: CardStat = CARD_STATS[effect.stat];
  const floor = def.op === "more" ? 1 : 0;
  return effect.value > floor && effect.value <= cardCap(effect.stat, share) + 1e-9;
}

/** The card's effect, scoped to `line` when its stat reaches the holder's own line. */
export function cardEffect(effect: CardEffect, line: string): Effect {
  const def: CardStat = CARD_STATS[effect.stat];
  return def.own
    ? { stat: effect.stat, op: def.op, value: effect.value, scope: line }
    : { stat: effect.stat, op: def.op, value: effect.value };
}
