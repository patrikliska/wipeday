/**
 * What happened, as the domain reports it. Commands and settling return these;
 * the API logs them and pushes them, the web scene turns them into effects
 * (floating gains, dust, sparks), and the welcome-back summary is built from the
 * ones that happened while the player was away.
 */
import type { CasinoGame } from "@wipe-day/content/odds";
import type { Amounts } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import type { Job } from "./crew";
import type { Listing } from "./market";
import type { RaidReport } from "./raids";

export type GameEvent =
  // Player actions.
  | { type: "gathered"; gained: Amounts; bonus: Amounts }
  | { type: "collected"; gained: Amounts }
  | { type: "tool_upgraded"; tool: string; paid: Amounts }
  | { type: "build_started"; tier: Tier; endsAt: number; paid: Amounts }
  | { type: "building_started"; building: string; level: number; endsAt: number; paid: Amounts }
  | { type: "smelt_started"; ore: string; amount: number; fuel: number }
  | { type: "furnace_out"; gained: Amounts }
  | {
      type: "craft_queued";
      /** The recipe, by its output id. */
      recipe: string;
      station: string;
      /** Units queued; each makes the recipe's amount. */
      count: number;
      endsAt: number;
      paid: Amounts;
    }
  | { type: "craft_cancelled"; recipe: string; station: string; refunded: Amounts }
  | { type: "salvaged"; item: string; count: number; gained: Amounts }
  | { type: "served"; meal: string; percent: number; until: number }
  /** A blueprint turned up: `from` says where (a barrel, a perfect node run, a task, a site). */
  | {
      type: "blueprint_found";
      recipe: string;
      from: "barrel" | "node" | "task" | "site" | "den" | "contract";
    }
  | {
      type: "scout_started";
      mission: string;
      region: string;
      survivor: string;
      endsAt: number;
      paid: Amounts;
    }
  | {
      type: "trip_started";
      mission: string;
      site: string;
      crew: string[];
      endsAt: number;
      paid: Amounts;
      /** The keycode spent on the way in. */
      keycode?: string;
    }
  | { type: "equipped"; survivor: string; slot: "weapon" | "armor"; item: string | null }
  | { type: "treated"; survivor: string; item: string; until: number }
  /** A survivor took a job at home (null: free again). */
  | { type: "assigned"; survivor: string; job: Job | null }
  /** A survivor went to bed until `until`. */
  | { type: "rested"; survivor: string; until: number }
  | { type: "barrel_broken"; gained: Amounts }
  | {
      type: "node_hit";
      node: string;
      kind: string;
      hits: number;
      gained: Amounts;
      perfect: boolean;
      /** True once the day's haul was in: this hit paid the reduced share. */
      reduced: boolean;
    }
  | { type: "node_depleted"; node: string; kind: string; until: number }
  /** A run stopped short: the node stands, keeping `hits` of wear for the next run. */
  | { type: "node_run_ended"; node: string; hits: number }
  | { type: "task_done"; task: string; reward: Amounts }
  // The Den (W5).
  /** Goods went up on the market; `fee` is what the Den kept. */
  | { type: "listed"; listing: Listing; fee: number }
  | { type: "listing_cancelled"; listing: string; good: string; amount: number }
  /** The buyer's side of a sale (`listing` is the server's row id). */
  | {
      type: "bought";
      listing: number;
      good: string;
      amount: number;
      price: number;
      seller: number;
      sellerName: string;
    }
  /** Bought from the Den's own counter (a blueprint arrives as `blueprint_found` too). */
  | { type: "den_bought"; offer: string; good: string; amount: number; price: number }
  | { type: "contract_done"; contract: string; good: string; amount: number; pay: number }
  /** A bet on the wheel, waiting for round `round` to spin. */
  | { type: "wheel_bet"; round: number; segment: string; amount: number }
  /**
   * A bet resolved. `result`: the wheel's segment index, the three reels or the two dice.
   * `feed`: hundredths of scrap the stake added to the slots' jackpot.
   */
  | {
      type: "wager";
      game: CasinoGame;
      option: string | null;
      bet: number;
      payout: number;
      result: number[];
      feed: number;
      at: number;
      round?: number;
    }
  /** A payout of at least `bigWin` times the bet: for the feed. */
  | { type: "big_win"; game: CasinoGame; bet: number; payout: number; at: number }
  | { type: "jackpot_won"; amount: number; at: number }
  // Raids (W6).
  | { type: "repaired"; paid: Amounts }
  | { type: "pvp_set"; on: boolean }
  /** This base raided another: `report` from the attacker's side (the feed's PvP line). */
  | { type: "raid_launched"; report: RaidReport; target: number; targetName: string; paid: Amounts }
  // Time passing (settling).
  /** Raiders were sighted at `at`; they land at `lands`. */
  | { type: "raid_warned"; at: number; lands: number }
  /** NPC raiders hit the base. */
  | { type: "raid_landed"; report: RaidReport }
  /** Another player raided this base (the defender's side). */
  | { type: "raided"; report: RaidReport; attacker: number; attackerName: string }
  | { type: "build_done"; tier: Tier }
  | { type: "building_done"; building: string; level: number }
  /** Unpaid upkeep cost this building a level (`level` is what is left; 0 = gone). */
  | { type: "building_decayed"; building: string; level: number }
  /**
   * Units of a job landed: `amount` of `recipe`'s output. `at`: when the last one did.
   * `done`: that was the job's last unit.
   */
  | {
      type: "crafted";
      recipe: string;
      station: string;
      amount: number;
      at: number;
      done: boolean;
    }
  | { type: "barrel_spawned"; expiresAt: number }
  /** A scout or a party came home. The full story is the report with the same id. */
  | {
      type: "mission_back";
      mission: string;
      kind: "scout" | "trip";
      target: string;
      outcome: "success" | "partial" | "fail";
      crew: string[];
      gained: Amounts;
      at: number;
    }
  | { type: "region_revealed"; region: string; from: "scout" | "fragment" }
  /** A survivor joined: off the boat, or rescued on a trip. */
  | { type: "survivor_arrived"; survivor: string; at: number; from: "boat" | "rescue" }
  /** Something happened on a trip (events.json5); the report has the line. */
  | { type: "trip_event"; mission: string; event: string; site: string; at: number }
  | { type: "level_up"; survivor: string; level: number; at: number }
  /** An item (a keycode) came home from `from` (a site). */
  | { type: "item_found"; item: string; from: string; at: number }
  /** The seller's side of a sale (time passing for them: someone bought it). */
  | { type: "sold"; listing: string; good: string; amount: number; price: number; at: number }
  | { type: "listing_expired"; listing: string; good: string; amount: number; at: number }
  | { type: "auto_collect"; gained: Amounts }
  | { type: "upkeep_paid"; hours: number; paid: Amounts }
  | { type: "decayed"; from: Tier; to: Tier };

export type GameEventType = GameEvent["type"];
