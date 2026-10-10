/**
 * One-shot happenings the scene reacts to with effects. They are the domain's events, played
 * when the client predicts them, plus what only the client knows: a tap's point on screen.
 */
import type { GameEvent as DomainEvent } from "@wipe-day/domain/events";

export type GameEvent =
  | DomainEvent
  /**
   * A tap landed at `x, y` (screen CSS px) and is predicted to bring in `gain` (a fell's bonus
   * comes apart, as a `felled` event right after).
   */
  | { type: "tap_at"; x: number; y: number; gain: number }
  /** A command was refused (the toast says why): the refuse sound. */
  | { type: "refused" }
  /** "Tap the ore seam": the panels close and the target pulses (a refusal's button). */
  | { type: "go_tap" }
  /** A claim on flotsam arrival `k` came too late: it drifted off (no toast). */
  | { type: "flotsam_lost"; k: number }
  /** The welcome card's Collect: `gain` flies into the counter. */
  | { type: "collected"; gain: number };

type Listener = (event: GameEvent) => void;

const listeners = new Set<Listener>();

export function emit(event: GameEvent): void {
  for (const listener of listeners) listener(event);
}

export function on(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
