/**
 * What happened, as the domain reports it. Commands and settling return these;
 * the API logs them and pushes them, the web scene turns them into effects
 * (floating gains, dust, sparks), and the welcome-back summary is built from the
 * ones that happened while the player was away.
 */
import type { Amounts } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";

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
  /** A blueprint turned up: `from` says where (a barrel, a perfect node run, a task). */
  | { type: "blueprint_found"; recipe: string; from: "barrel" | "node" | "task" }
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
  // Time passing (settling).
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
  | { type: "auto_collect"; gained: Amounts }
  | { type: "upkeep_paid"; hours: number; paid: Amounts }
  | { type: "decayed"; from: Tier; to: Tier };

export type GameEventType = GameEvent["type"];
