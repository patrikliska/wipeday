/**
 * One-shot happenings the scene, the panels and the sound react to (the event bus). They are
 * the domain's events, played when the client predicts them, plus what only the client knows:
 * a tap's point on screen, a milestone the scene saw crossed, a sheet opened. Every sound plays
 * from here (D224): `data/sounds.json5` maps each type below to its cue or to silence.
 */
import type { Rarity } from "@wipe-day/content/cards";
import type { GameEvent as DomainEvent } from "@wipe-day/domain/events";

export type GameEvent =
  | DomainEvent
  /**
   * `count` taps landed at `x, y` (screen CSS px) and are predicted to bring in `gain` (a
   * fell's bonus comes apart, as a `felled` event right after).
   */
  | { type: "tap_at"; x: number; y: number; gain: number; count: number; target: string }
  /** `count` of those taps crit (the domain's crit stream, predicted). */
  | { type: "crit"; count: number }
  /** A line's milestone was crossed by a purchase (the scene saw it). */
  | { type: "milestone"; line: string }
  /** A roster tier was reached (every unlocked line owned at its count). */
  | { type: "roster" }
  /** An airdrop came into view. */
  | { type: "flotsam_arrived" }
  /** A sheet, panel, the drawer or the house opened or closed, or a switch was flipped. */
  | { type: "ui"; action: UiAction }
  /** A command was refused (the toast says why): the refuse sound. */
  | { type: "refused" }
  /** "Tap the ore seam": the panels close and the target pulses (a refusal's button). */
  | { type: "go_tap" }
  /** A claim on flotsam arrival `k` came too late: it drifted off (no toast). */
  | { type: "flotsam_lost"; k: number }
  /** A crow came into view (its caw); `elite` for a Magpie. */
  | { type: "gull_arrived"; elite: boolean }
  /** A claim on crow `k` came too late: it flew on (no toast). */
  | { type: "gull_lost"; k: number }
  /** The next era became affordable (once per era a run, never on arrival): the plate's tick. */
  | { type: "era_ready"; era: string }
  /** A running Frenzy burned out (the scene saw its timer end): the bar's tick and a fall. */
  | { type: "frenzy_ended" }
  /** A bought boost or a Lucky Tide ran out while watched (D267): its pill's tick. */
  | { type: "boost_ended"; boost: string }
  /** The welcome card's Collect: `gain` flies into the counter. */
  | { type: "collected"; gain: number }
  /** A card turned over in the reveal (D261): the flip, then its rarity's sting. */
  | { type: "card_flipped"; rarity: Rarity };

export type UiAction = "open" | "close" | "switch";

/**
 * Every event type, so a test can hold `sounds.json5` to the full list (the record's keys are
 * checked against the union by the compiler).
 */
export const EVENT_TYPES = Object.keys({
  tapped: 1,
  bought: 1,
  hand_hired: 1,
  upgraded: 1,
  researched: 1,
  era_reached: 1,
  flotsam_claimed: 1,
  felled: 1,
  night_shift_over: 1,
  base_reset: 1,
  frenzy_tripped: 1,
  gull_caught: 1,
  badge_unlocked: 1,
  night_shift_collected: 1,
  gull_arrived: 1,
  gull_lost: 1,
  tap_at: 1,
  crit: 1,
  milestone: 1,
  roster: 1,
  flotsam_arrived: 1,
  ui: 1,
  refused: 1,
  go_tap: 1,
  flotsam_lost: 1,
  collected: 1,
  frenzy_ended: 1,
  boost_ended: 1,
  era_ready: 1,
  drop_earned: 1,
  drop_opened: 1,
  starred: 1,
  gear_crafted: 1,
  gear_equipped: 1,
  order_claimed: 1,
  orders_fuelled: 1,
  quest_claimed: 1,
  quest_set_done: 1,
  quests_rolled: 1,
  scrap_earned: 1,
  shards_earned: 1,
  scrap_spent: 1,
  boost_bought: 1,
  tide_claimed: 1,
  card_flipped: 1,
} satisfies Record<GameEvent["type"], 1>) as GameEvent["type"][];

/** A sheet opened or closed, a switch flipped: the panels say so, the sound answers. */
export const uiEvent = (action: UiAction): void => emit({ type: "ui", action });

type Listener = (event: GameEvent) => void;

const listeners = new Set<Listener>();

export function emit(event: GameEvent): void {
  for (const listener of listeners) listener(event);
}

export function on(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
