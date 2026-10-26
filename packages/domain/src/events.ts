/**
 * What happened, as the domain reports it. Commands and settle return events; the API writes
 * the rare ones to `event_log` (D143: never a row per tap, ping or purchase), and the clients
 * turn all of them into feedback. Later phases add theirs (docs/redesign/09-architecture.md 7.2).
 */
import type { DropTier, Rarity } from "@wipe-day/content/cards";
import type { Pay } from "@wipe-day/content/schema";
import type { Amount } from "./amount";

/** Where a Supply Drop or scrap came from. */
export type ScrapSource =
  | "fells"
  | "badges"
  | "locker"
  | "orders"
  | "quests"
  /** A claimed order's or quest set's drop, paid by the gate. */
  | "claims"
  | "scrap"
  | "magpie";

/** A card a Supply Drop gave: new to the Album, or `shards` into a survivor's or a rarity's. */
export interface DropCard {
  kind: "survivor" | "gear";
  id: string;
  rarity: Rarity;
  fresh: boolean;
  shards: number;
  /** Where a duplicate's shards went: the survivor's own, or its rarity's gear shards. */
  into: "crew" | "gear" | null;
}

export type GameEvent =
  /**
   * A taps batch was credited (client feedback only): `value` in all, `direct` from the taps
   * and fells themselves (the rest is unmanned cycles the taps ran).
   */
  | {
      type: "tapped";
      credited: number;
      value: Amount;
      direct: Amount;
      crits: number;
      cycles: number;
    }
  /** Units bought (client feedback only; the run summary counts them from R4). */
  | { type: "bought"; line: string; count: number; cost: Amount }
  | { type: "hand_hired"; line: string; hand: string }
  /** A shelf row bought (client feedback only). */
  | { type: "upgraded"; upgrade: string; cost: Amount }
  /** Workshop levels bought: `count` of `item`, now at `level` (client feedback only). */
  | { type: "researched"; item: string; level: number; count: number; cost: Amount }
  /** The run reached an era, `at` seconds after its first tap or purchase. */
  | { type: "era_reached"; era: string; at: number }
  /** Flotsam arrival `k` caught; `value` is a crate's supplies (0 for a buff). */
  | { type: "flotsam_claimed"; kind: string; k: number; value: Amount }
  /** Crow `k` caught; `elite` for a Magpie; `value` its seconds of output. */
  | { type: "gull_caught"; k: number; elite: boolean; value: Amount }
  /** The era's target fell `count` times in a taps batch (client feedback only). */
  | { type: "felled"; target: string; count: number; value: Amount }
  /** Frenzy tripped in a taps batch; its buff runs until `until` (client feedback only). */
  | { type: "frenzy_tripped"; until: number }
  /** Collect pressed; `full` when the Night Shift had already run out (client feedback only). */
  | { type: "night_shift_collected"; full: boolean }
  /** Supply Drops earned (R3): `count` of `tier` from `source`. */
  | {
      type: "drop_earned";
      tier: DropTier;
      count: number;
      source: ScrapSource;
    }
  /** A Work Order claimed (D256): what it pays (a drop pays through the gate, later). */
  | { type: "order_claimed"; id: string; pays: Pay[] }
  /** The run's set is fuelled: five orders claimed; the Kettle lights (R4 crowns the Big Red). */
  | { type: "orders_fuelled"; run: number }
  /** A daily quest claimed, by hand or at the next day's roll (D257). */
  | { type: "quest_claimed"; id: string; pays: Pay[] }
  /** The day's three quests all claimed: the set's bonus. */
  | { type: "quest_set_done"; day: number; pays: Pay[] }
  /** The island day moved: new quests (client feedback only). */
  | { type: "quests_rolled"; day: number }
  /** Scrap earned: `n` from `source` (the plate's number pop). */
  | { type: "scrap_earned"; n: number; source: ScrapSource }
  /** Scrap spent: `n` on `what` (a boost id or `drop_2`, `drop_3`). */
  | { type: "scrap_spent"; n: number; what: string }
  /** A boost bought; its buff or tide runs until `until`. */
  | { type: "boost_bought"; boost: string; until: number }
  /** A Lucky Tide crate `k` caught; `value` is a crate's supplies (0 for a buff). */
  | { type: "tide_claimed"; kind: string; k: number; value: Amount }
  /** A Supply Drop opened: its cards in reveal order (logged for balance). */
  | { type: "drop_opened"; tier: DropTier; cards: DropCard[] }
  /** A survivor's next star, paid in its shards. */
  | { type: "starred"; survivor: string; stars: number; cost: number }
  /** A gear card bought with rarity shards. */
  | { type: "gear_crafted"; gear: string; cost: number }
  /** A gear card put on a survivor, or back in the Album (`survivor` null). */
  | { type: "gear_equipped"; gear: string; survivor: string | null }
  /** A badge earned (D198): the Logbook's toast; logged for the feed and balance. */
  | { type: "badge_unlocked"; id: string }
  /** The Night Shift window closed at `at`: manned lines stopped until the next command. */
  | { type: "night_shift_over"; at: number }
  /** A stored base of an older shape was replaced by a fresh v2 base (the API logs it). */
  | { type: "base_reset"; from: number };

/** Event types written to `event_log`. Everything else is feedback for the clients. */
export const LOGGED_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "hand_hired",
  "era_reached",
  "flotsam_claimed",
  "night_shift_over",
  "base_reset",
  "badge_unlocked",
  "drop_opened",
  "starred",
  "gear_crafted",
  "orders_fuelled",
  "quest_set_done",
  "scrap_spent",
  "boost_bought",
]);

export const isLogged = (event: GameEvent): boolean => LOGGED_TYPES.has(event.type);
