/**
 * What happened, as the domain reports it. Commands and settle return events; the API writes
 * the rare ones to `event_log` (D143: never a row per tap, ping or purchase), and the clients
 * turn all of them into feedback. Later phases add theirs (docs/redesign/09-architecture.md 7.2).
 */
import type { Amount } from "./amount";

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
  /** Units bought (client feedback only; the run summary counts them from R2). */
  | { type: "bought"; line: string; count: number; cost: Amount }
  | { type: "hand_hired"; line: string; hand: string }
  /** A shelf row bought (client feedback only). */
  | { type: "upgraded"; upgrade: string; cost: Amount }
  /** The run reached an era, `at` seconds after its first tap or purchase. */
  | { type: "era_reached"; era: string; at: number }
  /** Flotsam arrival `k` caught; `value` is a crate's supplies (0 for a buff). */
  | { type: "flotsam_claimed"; kind: string; k: number; value: Amount }
  /** The era's target fell `count` times in a taps batch (client feedback only). */
  | { type: "felled"; target: string; count: number; value: Amount }
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
]);

export const isLogged = (event: GameEvent): boolean => LOGGED_TYPES.has(event.type);
