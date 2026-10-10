/**
 * The social layer's two outlets for what happens, decided here so the web feed, push
 * notifications and the Discord channel agree:
 *
 * - the feed: the happenings worth telling the other players. R2 adds Wipe Days and the first
 *   Armored era, R4 shared first finds, R6 the Freighter's tiers
 *   (docs/redesign/09-architecture.md 7.2); until then the feed is empty;
 * - notifications: which happenings may ping a player's phone, by kind, each opt-in per kind
 *   (CLAUDE.md 6.3 rule 11). On by default: only "Night Shift over" (D138).
 */
import type { GameEvent } from "./events";

/** Event types that can reach the feed: the server queries the log by these. */
export const FEED_TYPES = [] as const satisfies readonly GameEvent["type"][];

export type FeedEvent = Extract<GameEvent, { type: (typeof FEED_TYPES)[number] }>;

/** One line of the feed: who, when, what. `id` orders it (newest has the highest). */
export interface FeedItem {
  id: number;
  at: number;
  playerId: number;
  playerName: string;
  event: FeedEvent;
}

/** Whether an event is worth telling everyone. */
export function isFeedWorthy(event: GameEvent): event is FeedEvent {
  return (FEED_TYPES as readonly string[]).includes(event.type);
}

/** The kinds of notification a player can turn on, in the order the settings list them. */
export const NOTIFY_KINDS = ["night_shift_over"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
export type NotifyPrefs = Record<NotifyKind, boolean>;

export const DEFAULT_NOTIFY: NotifyPrefs = { night_shift_over: true };

/** Which notification kind an event is, or null when it never notifies. */
export function notifyKindOf(event: GameEvent): NotifyKind | null {
  return event.type === "night_shift_over" ? "night_shift_over" : null;
}

/** A player's stored preferences over the defaults (unknown and old kinds dropped). */
export function notifyPrefs(stored: Partial<Record<string, unknown>> | null): NotifyPrefs {
  const out = { ...DEFAULT_NOTIFY };
  for (const kind of NOTIFY_KINDS) {
    const value = stored?.[kind];
    if (typeof value === "boolean") out[kind] = value;
  }
  return out;
}
