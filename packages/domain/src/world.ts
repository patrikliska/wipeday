/**
 * What only the server knows (W5). Every rule up to W4 needed nothing but the
 * player's own base, so the client could predict any command with the same
 * domain function. The Den breaks that in two ways:
 *
 * - shared state: a listing belongs to another player's base, and the slots'
 *   jackpot is one pool for everyone;
 * - secret randomness: casino outcomes must be unknown to the player before they
 *   bet (every seed in `BaseState` is visible to the client).
 *
 * The API fills a `World` for each command and each settle; the simulator and the
 * tests fill it from a seeded generator; the web client has none, so the commands
 * that need it refuse with `server_only` and wait for the server's answer instead
 * of being predicted, and wheel bets stay pending until the server spins.
 */
import type { MarketListing } from "./market";

export interface World {
  /** A fresh unpredictable seed for this command's roll (the slots, the dice). */
  seed?: number;
  /** The wheel's result for a round that has ended (a segment index); null when not known. */
  reveal?: (round: number) => number | null;
  /** The slots' shared jackpot pool, in hundredths of scrap. */
  jackpot?: number;
  /** The listing a buyer targets, as the server read it. */
  listing?: MarketListing;
  /** The acting player's id: nobody buys their own listing. */
  self?: number;
}
