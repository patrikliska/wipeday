/**
 * One-shot happenings the scene reacts to with effects (a burst of leaves, a
 * build rising, a barrel splash). State lives in the store; this only says
 * "something just happened, here".
 */
import type { ItemId, ResourceId, Tier } from "./world";

export type GameEvent =
  | { type: "gathered"; node: string; gained: Partial<Record<ResourceId, number>> }
  | { type: "collected"; gained: Partial<Record<ResourceId, number>> }
  | { type: "build_started"; tier: Tier }
  | { type: "build_done"; tier: Tier }
  | { type: "crafted"; item: ItemId }
  | { type: "smelt_started" }
  | { type: "furnace_out"; gained: Partial<Record<ResourceId, number>> }
  | { type: "barrel_spawned" }
  | { type: "barrel_broken"; gained: Partial<Record<ResourceId, number>> }
  | { type: "node_hit"; node: string; hits: number; gained: Partial<Record<ResourceId, number>> }
  | { type: "node_run_over"; node: string; perfect: boolean }
  | { type: "task_done"; name: string }
  | { type: "weather"; weather: "clear" | "rain" | "fog" };

type Listener = (event: GameEvent) => void;

const listeners = new Set<Listener>();

export function emit(event: GameEvent): void {
  for (const listener of listeners) listener(event);
}

export function on(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
