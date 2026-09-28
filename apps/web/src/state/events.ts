/**
 * One-shot happenings the scene reacts to with effects (a burst of leaves, a
 * build rising, a barrel splash). They are the domain's events, played when the
 * client predicts them (a command, or a timer ending on screen), plus a few
 * that only exist in the client.
 */
import type { GameEvent as DomainEvent } from "@wipe-day/domain/events";

export type GameEvent =
  | DomainEvent
  /** A worked-out node stands again (derived from time, no domain event). */
  | { type: "node_respawned"; node: string; kind: string }
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
