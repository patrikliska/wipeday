/**
 * The social layer's two outlets for what happens (W4b), decided here so the
 * web feed, push notifications and (from W8) the Discord channel agree:
 *
 * - the feed: the happenings worth telling the other players about (a party back
 *   with something, a rescue, a new tier, a level up, a blueprint, a keycode, and
 *   from W5 a sale at the Den, a big win and a jackpot);
 * - notifications: which happenings may ping a player's phone, by kind, each
 *   opt-in per kind (CLAUDE.md 6.3 rule 11).
 */
import type { GameEvent } from "./events";

/** Event types that can reach the feed: the server queries the log by these. */
export const FEED_TYPES = [
  "mission_back",
  "survivor_arrived",
  "build_done",
  "level_up",
  "blueprint_found",
  "item_found",
  "sold",
  "big_win",
  "jackpot_won",
] as const satisfies readonly GameEvent["type"][];

export type FeedEvent = Extract<GameEvent, { type: (typeof FEED_TYPES)[number] }>;

/** One line of the feed: who, when, what. `id` orders it (newest has the highest). */
export interface FeedItem {
  id: number;
  at: number;
  playerId: number;
  playerName: string;
  event: FeedEvent;
}

/** Whether an event is worth telling everyone: trips that brought something, rescues. */
export function isFeedWorthy(event: GameEvent): event is FeedEvent {
  switch (event.type) {
    case "mission_back":
      return event.kind === "trip" && event.outcome !== "fail";
    case "survivor_arrived":
      return event.from === "rescue";
    case "build_done":
    case "level_up":
    case "blueprint_found":
    case "item_found":
    case "sold":
    case "big_win":
    case "jackpot_won":
      return true;
    default:
      return false;
  }
}

/** The kinds of notification a player can turn on, in the order the settings list them. */
export const NOTIFY_KINDS = ["party_back", "raided", "arrivals", "builds_done", "sold"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
export type NotifyPrefs = Record<NotifyKind, boolean>;

/** On by default: only a party back and a raid (W6), as the spec says. */
export const DEFAULT_NOTIFY: NotifyPrefs = {
  party_back: true,
  raided: true,
  arrivals: false,
  builds_done: false,
  sold: false,
};

/** Which notification kind an event is, or null when it never notifies. */
export function notifyKindOf(event: GameEvent): NotifyKind | null {
  switch (event.type) {
    case "mission_back":
      return "party_back";
    case "survivor_arrived":
      return "arrivals";
    case "build_done":
    case "building_done":
      return "builds_done";
    case "sold":
      return "sold";
    default:
      return null;
  }
}

/** A player's stored preferences over the defaults (unknown keys dropped). */
export function notifyPrefs(stored: Partial<Record<string, unknown>> | null): NotifyPrefs {
  const out = { ...DEFAULT_NOTIFY };
  for (const kind of NOTIFY_KINDS) {
    const value = stored?.[kind];
    if (typeof value === "boolean") out[kind] = value;
  }
  return out;
}
