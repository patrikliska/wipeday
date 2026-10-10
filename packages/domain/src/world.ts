/**
 * What only the server knows. The redesign's rules need nothing but the player's own base
 * until friends arrive (R6): then `World` carries friends' Wipe Days for Blowback, the Late Tide
 * median, the Island Count, the Freighter and first finds, and settle copies them into
 * `meta.world` so the client can predict with the last copy (D133;
 * docs/redesign/09-architecture.md 7.1).
 */
export interface World {
  /** The acting player's id. */
  self?: number;
}
