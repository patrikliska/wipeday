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
  | { type: "craft_queued"; item: string; endsAt: number; paid: Amounts }
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
  | { type: "task_done"; task: string; reward: Amounts }
  // Time passing (settling).
  | { type: "build_done"; tier: Tier }
  | { type: "building_done"; building: string; level: number }
  /** Unpaid upkeep cost this building a level (`level` is what is left; 0 = gone). */
  | { type: "building_decayed"; building: string; level: number }
  /** `at`: when it landed (tells two identical crafts apart). */
  | { type: "crafted"; item: string; at: number }
  | { type: "barrel_spawned"; expiresAt: number }
  | { type: "auto_collect"; gained: Amounts }
  | { type: "upkeep_paid"; hours: number; paid: Amounts }
  | { type: "decayed"; from: Tier; to: Tier };

export type GameEventType = GameEvent["type"];
